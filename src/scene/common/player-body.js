import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createGameMaterial } from "./materials.js";
import { createSeededRandom, drawSpeckles } from "./texture-utils.js";

// The player's body. Until now the player was only a pair of camera-parented
// arms: nothing to see when looking down and - more importantly - nothing that
// could drop a shadow on the floor. This module builds a full hazmat-suited
// figure with the same fabric the baked sleeves use, hangs it off the camera so
// every level picks it up for free, and animates it from the first-person
// motion block.
//
// The root name deliberately matches SHADOW_CASTER_PATTERN in
// src/rendering-pipeline.js ("lifeform"): configureMeshQuality assigns
// castShadow from that pattern and would otherwise turn the shadow back off. It
// must NOT start with "first-person-", because Level 1 keys the same prefix to
// keep the fixture light field off the camera-parented hands - the body is a
// scene object that should receive the baked warehouse lighting like props do.
export const PLAYER_BODY_NAME = "player-lifeform-body";

// Eye height has to stay in step with FirstPersonControls.eyeHeight: the camera
// sits at the eye, so the whole figure is measured from it.
export const PLAYER_BODY_METRICS = Object.freeze({
  eyeHeight: 1.62,
  totalHeight: 1.77,
  // How far in front of the body's own centre line the eye sits. Anatomically
  // this is about 0.05, but at that distance the chest's front surface lands in
  // front of the near plane and a steep look down fills the screen with a
  // shoulder. A little more offset puts the chin and chest just outside the
  // view while the legs and boots stay centred - which is what a player expects
  // to see when they look down.
  eyeForward: 0.19,
  hipHeight: 0.9,
  pelvisHeight: 0.92,
  waistHeight: 1.02,
  shoulderHeight: 1.42,
  collarHeight: 1.5,
  kneeHeight: 0.47,
  ankleHeight: 0.1,
  hipHalfWidth: 0.1,
  shoulderHalfWidth: 0.175,
  footLength: 0.285,
  hipToKnee: 0.43,
  kneeToAnkle: 0.37,
});
const METRICS = PLAYER_BODY_METRICS;
const LEG_REACH = METRICS.hipToKnee + METRICS.kneeToAnkle;
const FABRIC_TILE_METERS = 0.82;
const TWO_PI = Math.PI * 2;

const ROUND_SEGMENTS = 20;
const TORSO_SEGMENTS = 28;
const HOOD_SEGMENTS = 30;
const LIMB_SEGMENTS = 16;

// Fabric tints are multipliers on the material colour, so the model keeps a
// readable flat tone in low quality, where vertex colours are dropped.
const TINT = Object.freeze({
  suit: [1, 1, 1],
  sleeve: [0.98, 0.99, 1.02],
  panel: [0.7, 0.71, 0.73],
  cuff: [0.62, 0.62, 0.64],
  pocket: [0.86, 0.87, 0.9],
  hood: [0.94, 0.95, 0.98],
  liner: [0.34, 0.35, 0.38],
  patch: [0.8, 0.79, 0.72],
  gear: [1, 1, 1],
  rubber: [0.62, 0.63, 0.66],
  sole: [0.44, 0.45, 0.48],
});

const UP = new THREE.Vector3(0, 1, 0);
const DEPTH = new THREE.Vector3(0, 0, 1);

function canCreateCanvasTexture() {
  return typeof document !== "undefined" && typeof document.createElement === "function";
}

function createCanvasTexture(width, height, draw, { colorSpace = THREE.SRGBColorSpace } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // Sweep UVs are authored in metres, so one repeat is one fabric tile on every
  // part no matter how large the part is.
  texture.repeat.set(1 / FABRIC_TILE_METERS, 1 / FABRIC_TILE_METERS);
  texture.colorSpace = colorSpace;
  texture.anisotropy = 6;
  return texture;
}

// A worn coverall: woven threads, soft fold shading, ground-in grime and the
// scuffs that collect on elbows and knees. Kept high-key because the material
// colour carries the actual suit tone.
function createClothMaps(seed) {
  if (!canCreateCanvasTexture()) return { map: null, bumpMap: null };
  const size = 512;
  const weave = (context, random) => {
    for (let x = 0; x < size; x += 3) {
      context.fillStyle = `rgba(255, 255, 255, ${(0.03 + random() * 0.05).toFixed(3)})`;
      context.fillRect(x, 0, 1, size);
    }
    for (let y = 0; y < size; y += 3) {
      context.fillStyle = `rgba(64, 55, 42, ${(0.02 + random() * 0.04).toFixed(3)})`;
      context.fillRect(0, y, size, 1);
    }
  };
  const folds = (context, random, ink, weight, count) => {
    for (let fold = 0; fold < count; fold += 1) {
      const x = random() * size;
      context.strokeStyle = ink(0.03 + random() * 0.07);
      context.lineWidth = weight * (0.4 + random() * 1.6);
      context.lineCap = "round";
      context.beginPath();
      let y = -24;
      context.moveTo(x, y);
      while (y < size + 24) {
        const step = 46 + random() * 74;
        context.quadraticCurveTo(
          x + (random() - 0.5) * 18,
          y + step * 0.5,
          x + (random() - 0.5) * 30,
          y + step,
        );
        y += step;
      }
      context.stroke();
    }
  };

  const map = createCanvasTexture(size, size, (context) => {
    const random = createSeededRandom(seed);
    context.fillStyle = "#d7d0c2";
    context.fillRect(0, 0, size, size);
    weave(context, random);
    folds(context, random, (alpha) => `rgba(52, 44, 34, ${alpha})`, 9, 44);
    folds(context, random, (alpha) => `rgba(255, 250, 238, ${alpha})`, 7, 30);
    // Rubbed-away dye, dust and the odd rust stain from brushing against metal.
    drawSpeckles(context, size, 1500, 0.05, "58, 50, 38", random);
    drawSpeckles(context, size, 620, 0.045, "252, 246, 232", random);
    for (let stain = 0; stain < 5; stain += 1) {
      const x = random() * size;
      const y = random() * size;
      const radius = 26 + random() * 60;
      const glow = context.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, `rgba(96, 62, 34, ${(0.05 + random() * 0.07).toFixed(3)})`);
      glow.addColorStop(1, "rgba(96, 62, 34, 0)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(x, y, radius, 0, TWO_PI);
      context.fill();
    }
  });

  const bumpMap = createCanvasTexture(size, size, (context) => {
    const random = createSeededRandom(seed + 7);
    context.fillStyle = "#808080";
    context.fillRect(0, 0, size, size);
    for (let x = 0; x < size; x += 3) {
      context.fillStyle = `rgba(255, 255, 255, ${(0.1 + random() * 0.12).toFixed(3)})`;
      context.fillRect(x, 0, 1, size);
    }
    for (let y = 0; y < size; y += 3) {
      context.fillStyle = `rgba(0, 0, 0, ${(0.08 + random() * 0.1).toFixed(3)})`;
      context.fillRect(0, y, size, 1);
    }
    folds(context, random, (alpha) => `rgba(0, 0, 0, ${alpha * 1.6})`, 11, 34);
    folds(context, random, (alpha) => `rgba(255, 255, 255, ${alpha * 1.5})`, 8, 22);
    drawSpeckles(context, size, 900, 0.12, "0, 0, 0", random);
    drawSpeckles(context, size, 500, 0.1, "255, 255, 255", random);
  }, { colorSpace: THREE.NoColorSpace });

  return { map, bumpMap };
}

function createRubberMaps(seed) {
  if (!canCreateCanvasTexture()) return { bumpMap: null, roughnessMap: null };
  const size = 256;
  const bumpMap = createCanvasTexture(size, size, (context) => {
    const random = createSeededRandom(seed);
    context.fillStyle = "#808080";
    context.fillRect(0, 0, size, size);
    // Mould texture: shallow puckers, boot creases and sole scuffs.
    for (let crease = 0; crease < 40; crease += 1) {
      const y = random() * size;
      context.strokeStyle = `rgba(0, 0, 0, ${(0.12 + random() * 0.3).toFixed(3)})`;
      context.lineWidth = 1 + random() * 3.4;
      context.beginPath();
      context.moveTo(0, y);
      for (let x = 0; x <= size; x += 32) {
        context.lineTo(x, y + Math.sin(x * 0.05 + crease) * 5);
      }
      context.stroke();
    }
    drawSpeckles(context, size, 1400, 0.22, "0, 0, 0", random);
    drawSpeckles(context, size, 700, 0.16, "255, 255, 255", random);
  }, { colorSpace: THREE.NoColorSpace });
  return { bumpMap, roughnessMap: null };
}

// ---------------------------------------------------------------------------
// Geometry builders
// ---------------------------------------------------------------------------

const frameScratch = {
  side: new THREE.Vector3(),
  up: new THREE.Vector3(),
  tangent: new THREE.Vector3(),
};
const previousFrame = {
  side: new THREE.Vector3(),
  up: new THREE.Vector3(),
  tangent: new THREE.Vector3(),
};
const transportQuaternion = new THREE.Quaternion();

function resolveFrame(tangent, transport) {
  if (transport && previousFrame.tangent.lengthSq() > 0) {
    transportQuaternion.setFromUnitVectors(previousFrame.tangent, tangent);
    frameScratch.side.copy(previousFrame.side).applyQuaternion(transportQuaternion).normalize();
    frameScratch.up.crossVectors(tangent, frameScratch.side).normalize();
  } else {
    // A reference axis that is never parallel to the sweep keeps limbs from
    // collapsing, but it can flip while a path turns from horizontal to
    // vertical - those paths ask for parallel transport instead.
    const helper = Math.abs(tangent.y) > 0.86 ? DEPTH : UP;
    frameScratch.side.crossVectors(helper, tangent).normalize();
    frameScratch.up.crossVectors(tangent, frameScratch.side).normalize();
  }
  frameScratch.tangent.copy(tangent);
  previousFrame.side.copy(frameScratch.side);
  previousFrame.up.copy(frameScratch.up);
  previousFrame.tangent.copy(tangent);
}

function superellipse(angle, exponent) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  if (exponent === 2) return [cos, sin];
  const power = 2 / exponent;
  return [
    Math.sign(cos) * Math.abs(cos) ** power,
    Math.sign(sin) * Math.abs(sin) ** power,
  ];
}

/**
 * Sweeps an elliptical (or rounded-rectangle) cross-section along a spine.
 *
 * `nodes` are absolute positions in the part's own frame, each with its own
 * radii, profile exponent and optional arc window - an arc window is what makes
 * an open shell such as a knee panel or a hood with a face opening. UVs are in
 * metres (u around the ring, v along the spine) so the fabric tile stays the
 * same size on every part.
 */
function createSweptGeometry(rawNodes, {
  radialSegments = ROUND_SEGMENTS,
  capStart = false,
  capEnd = false,
  transport = false,
  closed = false,
  flip = false,
} = {}) {
  // Every field gets a default: a node that only carries rings still has to
  // produce a finite tangent, or the whole sweep turns into NaNs.
  const nodes = rawNodes.map((node) => ({
    x: node.x ?? 0,
    y: node.y ?? 0,
    z: node.z ?? 0,
    rx: node.rx ?? 0.02,
    rz: node.rz ?? node.rx ?? 0.02,
    n: node.n ?? 2,
    arcStart: node.arcStart ?? 0,
    arcSweep: node.arcSweep ?? TWO_PI,
    segments: node.segments ?? radialSegments,
  }));
  const positions = [];
  const uvs = [];
  const indices = [];
  const rings = [];
  const ringOffsets = [];
  const ringLengths = [];
  const pathLengths = [];
  const ringCount = nodes.length;
  const tangent = new THREE.Vector3();
  const point = new THREE.Vector3();
  let travelled = 0;

  // Every sweep starts its own frame: a transported frame must never inherit
  // the tangent of the previous path.
  previousFrame.tangent.set(0, 0, 0);

  for (let index = 0; index < ringCount; index += 1) {
    const node = nodes[index];
    const previous = nodes[Math.max(0, index - 1)];
    const next = nodes[Math.min(ringCount - 1, index + 1)];
    tangent.set(next.x - previous.x, next.y - previous.y, next.z - previous.z);
    if (tangent.lengthSq() < 1e-10) tangent.set(0, 1, 0);
    tangent.normalize();
    resolveFrame(tangent, transport);
    if (index > 0) {
      const prior = nodes[index - 1];
      travelled += Math.hypot(node.x - prior.x, node.y - prior.y, node.z - prior.z);
    }
    pathLengths.push(travelled);

    const arcStart = node.arcStart ?? 0;
    const arcSweep = node.arcSweep ?? TWO_PI;
    const segments = Math.max(4, node.segments ?? radialSegments);
    const exponent = node.n ?? 2;
    const ring = [];
    let perimeter = 0;
    let priorPoint = null;

    for (let step = 0; step <= segments; step += 1) {
      const angle = arcStart + (arcSweep * step) / segments;
      const [cos, sin] = superellipse(angle, exponent);
      point.set(
        (node.x ?? 0) + frameScratch.side.x * node.rx * cos + frameScratch.up.x * node.rz * sin,
        node.y + frameScratch.side.y * node.rx * cos + frameScratch.up.y * node.rz * sin,
        node.z + frameScratch.side.z * node.rx * cos + frameScratch.up.z * node.rz * sin,
      );
      if (priorPoint) perimeter += point.distanceTo(priorPoint);
      priorPoint = point;
      ring.push(point.clone());
      positions.push(point.x, point.y, point.z);
      uvs.push(perimeter, pathLengths[index]);
    }

    ringOffsets.push(index === 0 ? 0 : ringOffsets[index - 1] + ringLengths[index - 1]);
    ringLengths.push(segments + 1);
    rings.push(ring);
  }

  const quad = (a, b, c, d) => {
    if (flip) indices.push(a, c, b, a, d, c);
    else indices.push(a, b, c, a, c, d);
  };

  const ringPairs = closed ? ringCount : ringCount - 1;
  for (let index = 0; index < ringPairs; index += 1) {
    const nextIndex = (index + 1) % ringCount;
    const base = ringOffsets[index];
    const nextBase = ringOffsets[nextIndex];
    const segments = ringLengths[index] - 1;
    for (let step = 0; step < segments; step += 1) {
      quad(base + step, base + step + 1, nextBase + step + 1, nextBase + step);
    }
  }

  const addCap = (ringIndex, forward) => {
    const ring = rings[ringIndex];
    const base = ringOffsets[ringIndex];
    const segments = ringLengths[ringIndex] - 1;
    const centre = new THREE.Vector3();
    ring.slice(0, segments).forEach((vertex) => centre.add(vertex));
    centre.multiplyScalar(1 / segments);
    const centreIndex = positions.length / 3;
    positions.push(centre.x, centre.y, centre.z);
    uvs.push(0, pathLengths[ringIndex]);
    const capFlipped = forward === flip;
    for (let step = 0; step < segments; step += 1) {
      const a = base + step;
      const b = base + step + 1;
      if (capFlipped) indices.push(centreIndex, a, b);
      else indices.push(centreIndex, b, a);
    }
  };

  if (capStart) addCap(0, false);
  if (capEnd) addCap(ringCount - 1, true);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.rings = rings;
  return geometry;
}

function createTubeGeometry(points, { radius = 0.02, radialSegments = 10, closed = false } = {}) {
  return createSweptGeometry(
    points.map((entry) => ({
      x: entry.x,
      y: entry.y,
      z: entry.z,
      rx: entry.radius ?? radius,
      rz: entry.radius ?? radius,
    })),
    // Tubes follow paths that turn from horizontal to vertical, which is where
    // the helper-axis frame flips: transport the frame along the path instead.
    { radialSegments, closed, transport: true },
  );
}

function ellipsePath(centre, radiusX, radiusZ, count, tilt = 0) {
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * TWO_PI;
    const x = Math.cos(angle) * radiusX;
    const z = Math.sin(angle) * radiusZ;
    points.push({
      x: centre.x + x * Math.cos(tilt) - z * Math.sin(tilt),
      y: centre.y,
      z: centre.z + x * Math.sin(tilt) + z * Math.cos(tilt),
    });
  }
  return points;
}

function paintTint(geometry, tint) {
  const count = geometry.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    colors[index * 3] = tint[0];
    colors[index * 3 + 1] = tint[1];
    colors[index * 3 + 2] = tint[2];
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// Box parts arrive with per-face UVs, which would stretch the fabric tile by the
// size of the face. Project them along the dominant normal axis instead so the
// weave keeps its scale across pockets, straps and buckles.
function applyPlanarUv(geometry) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = new Float32Array(position.count * 2);
  for (let index = 0; index < position.count; index += 1) {
    const nx = Math.abs(normal.getX(index));
    const ny = Math.abs(normal.getY(index));
    const nz = Math.abs(normal.getZ(index));
    if (nx >= ny && nx >= nz) {
      uv[index * 2] = position.getZ(index);
      uv[index * 2 + 1] = position.getY(index);
    } else if (ny >= nx && ny >= nz) {
      uv[index * 2] = position.getX(index);
      uv[index * 2 + 1] = position.getZ(index);
    } else {
      uv[index * 2] = position.getX(index);
      uv[index * 2 + 1] = position.getY(index);
    }
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geometry;
}

function createBoxGeometry(width, height, depth, { radius = 0.008, segments = 4 } = {}) {
  // RoundedBoxGeometry is non-indexed in r184 and every swept part is indexed,
  // and mergeGeometries refuses to mix the two.
  const geometry = mergeVertices(new RoundedBoxGeometry(width, height, depth, segments, radius), 1e-4);
  return applyPlanarUv(geometry);
}

function createSphereGeometry(radius, { widthSegments = 16, heightSegments = 12, scale = [1, 1, 1] } = {}) {
  const geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
  geometry.scale(scale[0], scale[1], scale[2]);
  // A non-uniform scale leaves the normals pointing the wrong way unless they
  // are recomputed - squashed shoulder caps shaded like broken shells without it.
  geometry.computeVertexNormals();
  return applyPlanarUv(geometry);
}

function placeGeometry(geometry, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  if (rx) geometry.rotateX(rx);
  if (ry) geometry.rotateY(ry);
  if (rz) geometry.rotateZ(rz);
  if (x || y || z) geometry.translate(x, y, z);
  return geometry;
}

function mergeParts(parts) {
  const usable = parts.filter(Boolean);
  if (usable.length === 0) return null;
  if (usable.length === 1) return usable[0];
  return mergeGeometries(usable, false);
}

// ---------------------------------------------------------------------------
// Suit parts
// ---------------------------------------------------------------------------

function buildPelvisParts() {
  const cloth = [];
  const gear = [];
  const metal = [];

  cloth.push(paintTint(createSweptGeometry([
    { y: 0.0, rx: 0.152, rz: 0.118, n: 2.5, segments: TORSO_SEGMENTS },
    { y: 0.04, rx: 0.158, rz: 0.121, n: 2.6, segments: TORSO_SEGMENTS },
    { y: 0.1, rx: 0.152, rz: 0.118, n: 2.6, segments: TORSO_SEGMENTS },
    { y: 0.16, rx: 0.144, rz: 0.113, n: 2.5, segments: TORSO_SEGMENTS },
  ], { capStart: true, capEnd: true }), TINT.suit));

  // Hip pouches ride the belt; the left one is a flat map case, the right one a
  // chunky utility pouch with a flap and a snap.
  for (const side of [-1, 1]) {
    const isLeft = side < 0;
    const width = isLeft ? 0.035 : 0.052;
    const height = isLeft ? 0.115 : 0.1;
    const depth = isLeft ? 0.13 : 0.105;
    gear.push(paintTint(
      placeGeometry(createBoxGeometry(width, height, depth, { radius: 0.012 }), {
        x: side * 0.145,
        y: 0.03,
        z: isLeft ? 0.045 : -0.035,
        ry: side * 0.12,
        rz: side * -0.05,
      }),
      TINT.gear,
    ));
    if (!isLeft) {
      cloth.push(paintTint(
        placeGeometry(createBoxGeometry(0.058, 0.045, 0.11, { radius: 0.01 }), {
          x: side * 0.15,
          y: 0.08,
          z: -0.035,
          ry: side * 0.12,
          rz: side * -0.05,
        }),
        TINT.pocket,
      ));
      metal.push(placeGeometry(createSphereGeometry(0.011, { widthSegments: 10, heightSegments: 8 }), {
        x: side * 0.178,
        y: 0.072,
        z: -0.035,
      }));
    }
  }

  // Belt: a closed tube around the waist, with a low-profile buckle at the
  // front and a few keeper loops.
  gear.push(paintTint(
    createTubeGeometry(ellipsePath(new THREE.Vector3(0, 0.088, 0), 0.152, 0.121, 22), { radius: 0.019 }),
    TINT.gear,
  ));
  for (const z of [-0.05, 0.02, 0.09]) {
    gear.push(paintTint(
      placeGeometry(createBoxGeometry(0.026, 0.034, 0.014, { radius: 0.004 }), { x: 0.152, y: 0.088, z }),
      TINT.gear,
    ));
  }
  metal.push(placeGeometry(createBoxGeometry(0.062, 0.036, 0.018, { radius: 0.005 }), { y: 0.088, z: -0.132 }));
  return { cloth, gear, metal };
}

function buildTorsoParts() {
  const cloth = [];
  const gear = [];
  const metal = [];
  const hivis = [];

  cloth.push(paintTint(createSweptGeometry([
    { y: -0.02, z: 0.006, rx: 0.143, rz: 0.112, n: 2.4, segments: TORSO_SEGMENTS },
    { y: 0.06, z: 0.008, rx: 0.147, rz: 0.116, n: 2.5, segments: TORSO_SEGMENTS },
    { y: 0.16, z: 0.006, rx: 0.158, rz: 0.124, n: 2.6, segments: TORSO_SEGMENTS },
    { y: 0.25, z: 0.0, rx: 0.174, rz: 0.132, n: 2.7, segments: TORSO_SEGMENTS },
    { y: 0.315, z: -0.004, rx: 0.181, rz: 0.13, n: 2.7, segments: TORSO_SEGMENTS },
    { y: 0.375, z: -0.004, rx: 0.172, rz: 0.123, n: 2.6, segments: TORSO_SEGMENTS },
    { y: 0.425, z: 0.0, rx: 0.138, rz: 0.104, n: 2.5, segments: TORSO_SEGMENTS },
    { y: 0.462, z: 0.006, rx: 0.094, rz: 0.08, n: 2.4, segments: TORSO_SEGMENTS },
  ], { capStart: true, capEnd: true }), TINT.suit));

  for (const side of [-1, 1]) {
    // Shoulder caps smooth the transition into the sleeves; the straps run from
    // the shoulder line down to the belt like a light field harness.
    cloth.push(paintTint(
      placeGeometry(createSphereGeometry(0.073, { widthSegments: 20, heightSegments: 16, scale: [1.06, 0.92, 1.03] }), {
        x: side * 0.162,
        y: 0.348,
        z: -0.008,
      }),
      TINT.suit,
    ));
    gear.push(paintTint(createSweptGeometry([
      { x: side * 0.112, y: 0.398, z: -0.062, rx: 0.024, rz: 0.009, n: 6 },
      { x: side * 0.104, y: 0.33, z: -0.104, rx: 0.024, rz: 0.009, n: 6 },
      { x: side * 0.09, y: 0.22, z: -0.126, rx: 0.024, rz: 0.009, n: 6 },
      { x: side * 0.075, y: 0.1, z: -0.124, rx: 0.024, rz: 0.009, n: 6 },
      { x: side * 0.069, y: 0.0, z: -0.114, rx: 0.024, rz: 0.009, n: 6 },
    ], { radialSegments: 12, transport: true }), TINT.gear));
    metal.push(placeGeometry(createBoxGeometry(0.036, 0.026, 0.014, { radius: 0.004 }), {
      x: side * 0.085,
      y: 0.214,
      z: -0.138,
    }));
  }

  // Chest strap, with the buckle offset to the left the way a real harness sits.
  gear.push(paintTint(createSweptGeometry([
    { x: -0.088, y: 0.262, z: -0.132, rx: 0.021, rz: 0.008, n: 6 },
    { x: -0.03, y: 0.268, z: -0.142, rx: 0.021, rz: 0.008, n: 6 },
    { x: 0.03, y: 0.268, z: -0.142, rx: 0.021, rz: 0.008, n: 6 },
    { x: 0.088, y: 0.262, z: -0.13, rx: 0.021, rz: 0.008, n: 6 },
  ], { radialSegments: 12, transport: true }), TINT.gear));
  metal.push(placeGeometry(createBoxGeometry(0.048, 0.032, 0.016, { radius: 0.005 }), {
    x: -0.042,
    y: 0.267,
    z: -0.148,
  }));

  // Front closure: a raised tape with teeth and a slider parked near the collar.
  cloth.push(paintTint(createSweptGeometry([
    { y: 0.05, z: -0.113, rx: 0.015, rz: 0.008, n: 4 },
    { y: 0.17, z: -0.129, rx: 0.015, rz: 0.008, n: 4 },
    { y: 0.28, z: -0.139, rx: 0.015, rz: 0.008, n: 4 },
    { y: 0.38, z: -0.128, rx: 0.015, rz: 0.008, n: 4 },
    { y: 0.44, z: -0.104, rx: 0.015, rz: 0.008, n: 4 },
  ], { radialSegments: 10, transport: true }), TINT.panel));
  metal.push(placeGeometry(createBoxGeometry(0.03, 0.024, 0.016, { radius: 0.005 }), {
    y: 0.404,
    z: -0.126,
  }));
  metal.push(placeGeometry(createBoxGeometry(0.014, 0.032, 0.007, { radius: 0.003 }), {
    y: 0.378,
    z: -0.136,
    rx: 0.14,
  }));

  // Chest pocket with its flap, plus a printed ID patch on the other side.
  cloth.push(paintTint(
    placeGeometry(createBoxGeometry(0.1, 0.086, 0.014, { radius: 0.006 }), {
      x: 0.082, y: 0.19, z: -0.134, rx: -0.06, ry: 0.06,
    }),
    TINT.pocket,
  ));
  cloth.push(paintTint(
    placeGeometry(createBoxGeometry(0.106, 0.036, 0.016, { radius: 0.005 }), {
      x: 0.082, y: 0.238, z: -0.138, rx: -0.06, ry: 0.06,
    }),
    TINT.panel,
  ));
  cloth.push(paintTint(
    placeGeometry(createBoxGeometry(0.074, 0.05, 0.006, { radius: 0.003 }), {
      x: -0.086, y: 0.222, z: -0.128, rx: -0.05, ry: -0.07,
    }),
    TINT.patch,
  ));

  // Waist reflective band: the one hi-vis feature that is always in view when
  // the player looks down.
  hivis.push(createSweptGeometry([
    { y: 0.03, rx: 0.148, rz: 0.118, n: 2.5, segments: TORSO_SEGMENTS },
    { y: 0.048, rx: 0.152, rz: 0.121, n: 2.5, segments: TORSO_SEGMENTS },
    { y: 0.072, rx: 0.154, rz: 0.123, n: 2.5, segments: TORSO_SEGMENTS },
    { y: 0.09, rx: 0.15, rz: 0.119, n: 2.5, segments: TORSO_SEGMENTS },
  ], { capStart: true, capEnd: true }));

  // Rolled collar: a closed tube, so there is no open rim to see through when
  // the player looks up into the hood.
  cloth.push(paintTint(
    createTubeGeometry(ellipsePath(new THREE.Vector3(0, 0.45, 0.004), 0.086, 0.076, 20), { radius: 0.024 }),
    TINT.hood,
  ));
  return { cloth, gear, metal, hivis };
}

function hoodNode(y, z, rx, rz, gap = 0, segments = HOOD_SEGMENTS) {
  const openFront = gap > 0;
  // Ring angle 270 degrees points at -Z, so the missing window has to be
  // centred there for the face opening to end up on the front of the hood.
  return {
    y,
    z,
    rx,
    rz,
    n: 2,
    segments,
    arcStart: openFront ? Math.PI * 1.5 + gap / 2 : 0,
    arcSweep: openFront ? TWO_PI - gap : TWO_PI,
  };
}

function buildHoodParts() {
  // Rings run from the collar up over the skull. The face opening is cut by a
  // window over the chin-to-brow band. Its width tapers at both ends instead of
  // switching on at full size, otherwise the hole reads as a rectangular visor
  // cut into a box rather than an oval face opening.
  const outerNodes = [
    hoodNode(-0.015, 0.05, 0.101, 0.104),
    hoodNode(0.035, 0.05, 0.107, 0.109, Math.PI * 0.5),
    hoodNode(0.075, 0.048, 0.11, 0.111, Math.PI * 0.62),
    hoodNode(0.115, 0.046, 0.111, 0.112, Math.PI * 0.66),
    hoodNode(0.152, 0.044, 0.107, 0.109, Math.PI * 0.62),
    hoodNode(0.185, 0.042, 0.099, 0.102, Math.PI * 0.5),
    hoodNode(0.213, 0.042, 0.086, 0.089),
    hoodNode(0.238, 0.044, 0.061, 0.063),
    hoodNode(0.255, 0.047, 0.031, 0.032),
    hoodNode(0.263, 0.05, 0.012, 0.012),
  ];
  const outer = createSweptGeometry(outerNodes, { capStart: true, capEnd: true, transport: false });

  const innerNodes = outerNodes.map((node) => ({
    ...node,
    rx: node.rx - 0.012,
    rz: node.rz - 0.012,
  }));
  const inner = createSweptGeometry(innerNodes, {
    capStart: false,
    capEnd: true,
    flip: true,
    transport: false,
  });

  const cloth = [
    paintTint(outer, TINT.hood),
    paintTint(inner, TINT.liner),
  ];

  // Rolled rim around the face opening: the boundary of an open ring is the
  // first and last point of every open row, so the two columns plus the crown
  // give one closed loop.
  const openRings = [];
  outerNodes.forEach((node, index) => {
    if ((node.arcSweep ?? TWO_PI) < TWO_PI - 1e-6) openRings.push(index);
  });
  if (openRings.length >= 2) {
    const rimPoints = [];
    const first = openRings[0];
    const last = openRings[openRings.length - 1];
    for (let index = first; index <= last; index += 1) {
      const ring = outer.userData.rings[index];
      rimPoints.push(ring[0]);
    }
    for (let index = last; index >= first; index -= 1) {
      const ring = outer.userData.rings[index];
      rimPoints.push(ring[ring.length - 1]);
    }
    cloth.push(paintTint(
      createTubeGeometry(rimPoints, { radius: 0.011, radialSegments: 10, closed: true }),
      TINT.cuff,
    ));
  }

  return { cloth, gear: [], metal: [], hivis: [] };
}

function buildArmParts(side) {
  const cloth = [];
  const hivis = [];
  const armSign = side;

  // Upper arm: abducted a few degrees and bent slightly forward, ending where
  // the elbow group takes over. It starts high and narrow so its cap stays
  // buried inside the shoulder cap instead of showing as a flat plate.
  cloth.push(paintTint(createSweptGeometry([
    { x: armSign * 0.0, y: -0.03, z: -0.004, rx: 0.058, rz: 0.06, n: 2.2, segments: LIMB_SEGMENTS },
    { x: armSign * 0.012, y: -0.09, z: 0.004, rx: 0.056, rz: 0.058, n: 2.2, segments: LIMB_SEGMENTS },
    { x: armSign * 0.022, y: -0.18, z: 0.008, rx: 0.05, rz: 0.052, n: 2.2, segments: LIMB_SEGMENTS },
    { x: armSign * 0.028, y: -0.26, z: 0.012, rx: 0.046, rz: 0.048, n: 2.2, segments: LIMB_SEGMENTS },
    { x: armSign * 0.031, y: -0.3, z: 0.014, rx: 0.044, rz: 0.046, n: 2.2, segments: LIMB_SEGMENTS },
  ], { capStart: true, capEnd: true }), TINT.sleeve));

  hivis.push(createSweptGeometry([
    { x: armSign * 0.02, y: -0.108, z: 0.004, rx: 0.058, rz: 0.06, n: 2.2, segments: LIMB_SEGMENTS },
    { x: armSign * 0.023, y: -0.13, z: 0.006, rx: 0.059, rz: 0.061, n: 2.2, segments: LIMB_SEGMENTS },
  ], { capStart: true, capEnd: true }));

  // Elbow reinforcement patch: a curved pad on the back of the joint rather
  // than a lump, so it reads as a sewn-on panel from every angle.
  cloth.push(paintTint(createSweptGeometry([
    { x: armSign * 0.03, y: -0.255, z: 0.0, rx: 0.047, rz: 0.049, n: 2.2, segments: 10, arcStart: Math.PI * 0.24, arcSweep: Math.PI * 0.52 },
    { x: armSign * 0.031, y: -0.295, z: 0.002, rx: 0.045, rz: 0.047, n: 2.2, segments: 10, arcStart: Math.PI * 0.24, arcSweep: Math.PI * 0.52 },
    { x: armSign * 0.031, y: -0.335, z: 0.006, rx: 0.043, rz: 0.045, n: 2.2, segments: 10, arcStart: Math.PI * 0.26, arcSweep: Math.PI * 0.48 },
  ], { transport: true }), TINT.panel));

  return { cloth, gear: [], metal: [], hivis };
}

function buildForearmParts(side) {
  const cloth = [];
  const skin = [];
  const armSign = side;

  cloth.push(paintTint(createSweptGeometry([
    { x: 0.0, y: 0.004, z: 0.0, rx: 0.046, rz: 0.048, n: 2.2, segments: LIMB_SEGMENTS },
    { x: armSign * 0.002, y: -0.08, z: 0.006, rx: 0.042, rz: 0.044, n: 2.2, segments: LIMB_SEGMENTS },
    { x: armSign * 0.004, y: -0.17, z: 0.012, rx: 0.038, rz: 0.04, n: 2.2, segments: LIMB_SEGMENTS },
    { x: armSign * 0.004, y: -0.235, z: 0.016, rx: 0.036, rz: 0.038, n: 2.2, segments: LIMB_SEGMENTS },
  ], { capStart: true, capEnd: true }), TINT.sleeve));
  // Ribbed cuff where the sleeve meets the bare hand.
  cloth.push(paintTint(createSweptGeometry([
    { x: armSign * 0.004, y: -0.228, z: 0.016, rx: 0.04, rz: 0.042, n: 2.2, segments: LIMB_SEGMENTS },
    { x: armSign * 0.004, y: -0.252, z: 0.017, rx: 0.041, rz: 0.043, n: 2.2, segments: LIMB_SEGMENTS },
    { x: armSign * 0.004, y: -0.268, z: 0.018, rx: 0.037, rz: 0.039, n: 2.2, segments: LIMB_SEGMENTS },
  ], { capStart: true, capEnd: true }), TINT.cuff));

  // Hand: palm, four curled fingers and a thumb. It hangs relaxed beside the
  // thigh, which is how the baked view-model arms hold the same pose.
  const wrist = { x: armSign * 0.004, y: -0.268, z: 0.018 };
  skin.push(paintTint(placeGeometry(
    createSphereGeometry(0.04, { widthSegments: 14, heightSegments: 10, scale: [0.9, 1.1, 0.95] }),
    { x: wrist.x, y: wrist.y - 0.026, z: wrist.z },
  ), [1, 1, 1]));
  const palmCentre = { x: wrist.x + armSign * 0.002, y: wrist.y - 0.072, z: wrist.z - 0.002 };
  skin.push(paintTint(placeGeometry(
    createBoxGeometry(0.036, 0.096, 0.082, { radius: 0.016, segments: 5 }),
    { x: palmCentre.x, y: palmCentre.y, z: palmCentre.z },
  ), [1, 1, 1]));

  const fingers = [
    { z: -0.03, length: 0.062, spread: -0.03 },
    { z: -0.01, length: 0.068, spread: -0.008 },
    { z: 0.011, length: 0.062, spread: 0.012 },
    { z: 0.03, length: 0.05, spread: 0.034 },
  ];
  fingers.forEach((finger, index) => {
    const rootY = palmCentre.y - 0.046;
    const midY = rootY - finger.length * 0.55;
    const tipY = rootY - finger.length;
    const curl = 0.02 + index * 0.002;
    skin.push(paintTint(createSweptGeometry([
      { x: palmCentre.x, y: rootY, z: palmCentre.z + finger.z, rx: 0.0135, rz: 0.0135, segments: 8 },
      {
        x: palmCentre.x + armSign * curl * 0.4,
        y: midY,
        z: palmCentre.z + finger.z + finger.spread * 0.3,
        rx: 0.012,
        rz: 0.012,
        segments: 8,
      },
      {
        x: palmCentre.x + armSign * curl,
        y: tipY,
        z: palmCentre.z + finger.z + finger.spread * 0.6,
        rx: 0.0105,
        rz: 0.0105,
        segments: 8,
      },
    ], { capStart: true, capEnd: true }), [1, 1, 1]));
  });

  // Thumb sits on the forward edge of the palm and folds across it.
  skin.push(paintTint(createSweptGeometry([
    { x: palmCentre.x, y: palmCentre.y - 0.012, z: palmCentre.z - 0.038, rx: 0.016, rz: 0.016, segments: 8 },
    { x: palmCentre.x + armSign * 0.014, y: palmCentre.y - 0.046, z: palmCentre.z - 0.05, rx: 0.014, rz: 0.014, segments: 8 },
    { x: palmCentre.x + armSign * 0.024, y: palmCentre.y - 0.07, z: palmCentre.z - 0.052, rx: 0.012, rz: 0.012, segments: 8 },
  ], { transport: true, capStart: true, capEnd: true }), [1, 1, 1]));

  return { cloth, gear: [], metal: [], skin };
}

function buildThighParts(side) {
  const cloth = [];
  const legSign = side;

  cloth.push(paintTint(createSweptGeometry([
    { x: legSign * 0.004, y: -0.02, z: 0.004, rx: 0.098, rz: 0.104, n: 2.15, segments: LIMB_SEGMENTS },
    { x: legSign * 0.006, y: -0.1, z: 0.006, rx: 0.094, rz: 0.099, n: 2.15, segments: LIMB_SEGMENTS },
    { x: legSign * 0.008, y: -0.2, z: 0.008, rx: 0.087, rz: 0.091, n: 2.15, segments: LIMB_SEGMENTS },
    { x: legSign * 0.008, y: -0.3, z: 0.008, rx: 0.079, rz: 0.082, n: 2.15, segments: LIMB_SEGMENTS },
    { x: legSign * 0.006, y: -0.38, z: 0.006, rx: 0.072, rz: 0.075, n: 2.15, segments: LIMB_SEGMENTS },
    { x: legSign * 0.004, y: -0.44, z: 0.004, rx: 0.069, rz: 0.072, n: 2.15, segments: LIMB_SEGMENTS },
  ], { capStart: true, capEnd: true }), TINT.suit));

  // Cargo pocket on the outside of the thigh, with a flap and a Velcro strip.
  const pocketX = legSign * 0.092;
  cloth.push(paintTint(
    placeGeometry(createBoxGeometry(0.028, 0.145, 0.112, { radius: 0.012 }), {
      x: pocketX, y: -0.2, z: -0.008, rz: legSign * -0.06,
    }),
    TINT.pocket,
  ));
  cloth.push(paintTint(
    placeGeometry(createBoxGeometry(0.03, 0.048, 0.117, { radius: 0.008 }), {
      x: pocketX, y: -0.12, z: -0.008, rz: legSign * -0.06,
    }),
    TINT.panel,
  ));
  // Reinforced knee panel, cut as a front-facing arc so it wraps the joint.
  // Ring angle 270 degrees is the front of a downward sweep.
  cloth.push(paintTint(createSweptGeometry([
    { y: -0.36, z: 0.006, rx: 0.076, rz: 0.079, n: 2.15, segments: 12, arcStart: Math.PI * 1.28, arcSweep: Math.PI * 0.44 },
    { y: -0.42, z: 0.005, rx: 0.073, rz: 0.076, n: 2.15, segments: 12, arcStart: Math.PI * 1.28, arcSweep: Math.PI * 0.44 },
  ], {}), TINT.panel));
  return { cloth, gear: [], metal: [], hivis: [] };
}

function buildShinParts(side) {
  const cloth = [];
  const hivis = [];
  const legSign = side;

  cloth.push(paintTint(createSweptGeometry([
    { x: 0.0, y: 0.004, z: 0.002, rx: 0.07, rz: 0.073, n: 2.2, segments: LIMB_SEGMENTS },
    { x: legSign * 0.002, y: -0.09, z: 0.004, rx: 0.062, rz: 0.065, n: 2.2, segments: LIMB_SEGMENTS },
    { x: legSign * 0.004, y: -0.19, z: 0.006, rx: 0.056, rz: 0.058, n: 2.2, segments: LIMB_SEGMENTS },
    { x: legSign * 0.004, y: -0.28, z: 0.006, rx: 0.053, rz: 0.055, n: 2.2, segments: LIMB_SEGMENTS },
    { x: legSign * 0.004, y: -0.33, z: 0.004, rx: 0.055, rz: 0.057, n: 2.2, segments: LIMB_SEGMENTS },
  ], { capStart: true, capEnd: true }), TINT.suit));

  hivis.push(createSweptGeometry([
    { x: legSign * 0.003, y: -0.15, z: 0.005, rx: 0.058, rz: 0.061, n: 2.2, segments: LIMB_SEGMENTS },
    { x: legSign * 0.003, y: -0.178, z: 0.005, rx: 0.06, rz: 0.063, n: 2.2, segments: LIMB_SEGMENTS },
  ], { capStart: true, capEnd: true }));
  return { cloth, gear: [], metal: [], hivis };
}

function buildBootParts(side) {
  const gear = [];
  const legSign = side;
  const ankle = METRICS.ankleHeight;
  const halfWidth = 0.058;
  const soleY = -ankle;

  // Foot: swept front to back so the toe tapers and the heel stays square.
  gear.push(paintTint(createSweptGeometry([
    { x: 0, y: 0.052, z: 0.082, rx: halfWidth, rz: 0.05, n: 2.6, segments: 14 },
    { x: 0, y: 0.028, z: 0.03, rx: halfWidth + 0.006, rz: 0.062, n: 2.8, segments: 14 },
    { x: 0, y: 0.022, z: -0.05, rx: halfWidth + 0.004, rz: 0.06, n: 2.8, segments: 14 },
    { x: 0, y: 0.026, z: -0.13, rx: halfWidth - 0.002, rz: 0.052, n: 2.8, segments: 14 },
    { x: 0, y: 0.036, z: -0.185, rx: halfWidth - 0.012, rz: 0.042, n: 2.6, segments: 14 },
    { x: 0, y: 0.05, z: -0.208, rx: halfWidth - 0.024, rz: 0.03, n: 2.4, segments: 14 },
  ], { capStart: true, capEnd: true }), TINT.rubber));

  // Shaft over the ankle, flared at the top where the trouser tucks in.
  gear.push(paintTint(createSweptGeometry([
    { x: 0, y: soleY + 0.012, z: 0.028, rx: 0.062, rz: 0.07, n: 2.4, segments: 14 },
    { x: 0, y: 0.0, z: 0.02, rx: 0.064, rz: 0.07, n: 2.4, segments: 14 },
    { x: 0, y: 0.05, z: 0.012, rx: 0.066, rz: 0.072, n: 2.4, segments: 14 },
    { x: 0, y: 0.088, z: 0.008, rx: 0.062, rz: 0.068, n: 2.4, segments: 14 },
  ], { capStart: true, capEnd: true }), TINT.rubber));

  // Sole and heel block. Both are laid on the ground plane of the ankle frame
  // (soleY): anything poking below it sinks the boot into the floor, which is
  // exactly what the player sees when they look down while walking.
  gear.push(paintTint(
    placeGeometry(createBoxGeometry(halfWidth * 2 + 0.008, 0.022, METRICS.footLength - 0.008, { radius: 0.009 }), {
      y: soleY + 0.011, z: -0.05,
    }),
    TINT.sole,
  ));
  gear.push(paintTint(
    placeGeometry(createBoxGeometry(halfWidth * 2 + 0.004, 0.026, 0.09, { radius: 0.008 }), {
      y: soleY + 0.024, z: 0.048,
    }),
    TINT.sole,
  ));
  // Tread ridges stand proud of the sole by a millimetre instead of hanging
  // below it, so they shade like tread without touching the floor.
  for (let lug = 0; lug < 5; lug += 1) {
    const z = -0.15 + lug * 0.058;
    gear.push(paintTint(
      placeGeometry(createBoxGeometry(halfWidth * 2 - 0.014, 0.012, 0.024, { radius: 0.004 }), {
        y: soleY + 0.006, z,
      }),
      TINT.sole,
    ));
  }

  // Instep lacing: five rows of cord across the tongue plus a top eyelet pair.
  for (let row = 0; row < 5; row += 1) {
    const y = 0.052 + row * 0.019;
    const width = halfWidth * 0.78 - row * 0.004;
    const z = 0.012 - row * 0.026;
    gear.push(paintTint(createTubeGeometry([
      { x: -width, y, z, radius: 0.006 },
      { x: 0, y: y + 0.004, z: z - 0.014, radius: 0.006 },
      { x: width, y, z, radius: 0.006 },
    ], { radialSegments: 6 }), TINT.sole));
  }
  return { cloth: [], gear, metal: [], hivis: [] };
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

function createSegmentedMesh(parts, material, name) {
  const geometry = mergeParts(parts);
  if (!geometry) return null;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  // configureMeshQuality re-derives these from the root name, but the body is
  // attached during level construction and must be correct even if a caller
  // builds it outside the pipeline.
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function attachSegmentMeshes(group, parts, materials, prefix) {
  const meshes = {};
  for (const key of Object.keys(parts)) {
    const mesh = createSegmentedMesh(parts[key], materials[key], `${prefix}-${key}`);
    if (!mesh) continue;
    group.add(mesh);
    meshes[key] = mesh;
  }
  group.userData.meshes = meshes;
  return meshes;
}

function createBodyMaterials({ seed }) {
  const { map, bumpMap } = createClothMaps(seed);
  const { bumpMap: rubberBump } = createRubberMaps(seed + 31);

  const cloth = createGameMaterial(({ lowQuality }) => {
    const props = {
      color: 0x796c59,
      vertexColors: true,
      roughness: 0.88,
      metalness: 0,
      map,
      bumpScale: 0.045,
      // Level 1 bakes its fixture light field into every material whose
      // emissiveIntensity is 0.5 or less, and three.js defaults that property to
      // 1. Without these dark, explicit values the figure would be the only
      // object in the warehouse that misses the baked lighting.
      emissive: 0x14120c,
      emissiveIntensity: 0.06,
    };
    if (!lowQuality && bumpMap) props.bumpMap = bumpMap;
    return props;
  });
  cloth.name = "player-body-cloth";

  const gear = createGameMaterial(({ lowQuality }) => {
    const props = {
      color: 0x3c352a,
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.02,
      bumpScale: 0.05,
      emissive: 0x100e08,
      emissiveIntensity: 0.05,
    };
    if (!lowQuality && rubberBump) props.bumpMap = rubberBump;
    return props;
  });
  gear.name = "player-body-gear";

  const metal = createGameMaterial({
    color: 0x9c9689,
    roughness: 0.42,
    metalness: 0.36,
    bumpScale: 0,
    emissive: 0x0e0d0a,
    emissiveIntensity: 0.04,
  });
  metal.name = "player-body-metal";

  const skin = createGameMaterial({
    color: 0xbf7c61,
    vertexColors: true,
    roughness: 0.68,
    metalness: 0,
    emissive: 0x160b07,
    emissiveIntensity: 0.05,
  });
  skin.name = "player-body-skin";

  const hivis = createGameMaterial({
    color: 0xd8d3c1,
    roughness: 0.46,
    metalness: 0.02,
    emissive: 0x2b2c22,
    emissiveIntensity: 0.24,
  });
  hivis.name = "player-body-hivis";

  // The baked view-model arms already put the player's hands and sleeves in
  // front of the camera. Drawing the body's own arms as well reads as four
  // hands the moment a walk swings them into frame - and standing still it is
  // four legs whenever the player looks down. So the body's arm segments keep
  // casting their shadow and drop out of every render pass that draws colour.
  //
  // Hide the arms from the colour pass - and from the AO pass with them.
  //
  // `colorWrite = false` hides the arm from the colour pass but leaves it in the
  // GTAO depth/normal buffer, and that buffer is what decides how much ambient
  // light the wall behind the arm loses. The result was an arm-shaped *bright*
  // patch on the wall next to the chest: invisible geometry casting an
  // occlusion shadow. Two pale limbs, counted as extra legs on a look down.
  // `material.visible = false` drops the arm from every pass that builds a
  // render list, so no artefact is left behind.
  //
  // The cost is the arms in the cast shadow: WebGLShadowMap walks the scene
  // graph itself and skips objects whose material is invisible, so a shadow
  // cannot be kept alongside. A shadow silhouette without arms is far less
  // noticeable in these soft interior lights than an extra pair of limbs in the
  // view was.
  //
  // The arms need their own material instances: the shared ones are on the
  // torso and the legs, and hiding those would hide the whole figure.
  const shadowOnly = (source, name) => {
    const material = source.clone();
    material.name = name;
    material.visible = false;
    material.userData.shadowOnly = true;
    return material;
  };
  const arm = {
    cloth: shadowOnly(cloth, "player-body-arm-cloth"),
    hivis: shadowOnly(hivis, "player-body-arm-hivis"),
    skin: shadowOnly(skin, "player-body-arm-skin"),
  };

  return { cloth, gear, metal, skin, hivis, arm };
}

/**
 * Builds the player figure. The hierarchy is joint-based rather than skinned -
 * every segment is a small group whose pivot is the anatomical joint - so the
 * animation can stay a handful of rotations per frame.
 */
export function createPlayerBody({ seed = 0x51fe9a } = {}) {
  const materials = createBodyMaterials({ seed });
  const root = new THREE.Group();
  root.name = PLAYER_BODY_NAME;

  const pelvis = new THREE.Group();
  pelvis.name = "player-body-pelvis";
  pelvis.position.set(0, METRICS.pelvisHeight, 0.008);
  root.add(pelvis);
  pelvis.userData.metrics = { hipHeight: METRICS.hipHeight - METRICS.pelvisHeight };

  const torso = new THREE.Group();
  torso.name = "player-body-torso";
  torso.position.set(0, METRICS.waistHeight - METRICS.pelvisHeight, 0);
  pelvis.add(torso);

  const hood = new THREE.Group();
  hood.name = "player-body-hood";
  hood.position.set(0, METRICS.collarHeight - METRICS.waistHeight, 0);
  torso.add(hood);

  const legs = {};
  const shins = {};
  const ankles = {};
  const arms = {};
  const forearms = {};

  attachSegmentMeshes(pelvis, buildPelvisParts(), materials, "player-body-pelvis");
  attachSegmentMeshes(torso, buildTorsoParts(), materials, "player-body-torso");
  attachSegmentMeshes(hood, buildHoodParts(), materials, "player-body-hood");

  // Arm segments draw no colour (see createBodyMaterials) but still cast.
  const armMaterials = { ...materials, ...materials.arm };

  for (const side of [-1, 1]) {
    const key = side < 0 ? "left" : "right";
    const leg = new THREE.Group();
    leg.name = `player-body-leg-${key}`;
    leg.position.set(side * METRICS.hipHalfWidth, METRICS.hipHeight - METRICS.pelvisHeight, -0.004);
    pelvis.add(leg);

    const shin = new THREE.Group();
    shin.name = `player-body-shin-${key}`;
    shin.position.set(0, -METRICS.hipToKnee, 0);
    leg.add(shin);

    const ankle = new THREE.Group();
    ankle.name = `player-body-ankle-${key}`;
    ankle.position.set(0, -METRICS.kneeToAnkle, 0);
    shin.add(ankle);

    const arm = new THREE.Group();
    arm.name = `player-body-arm-${key}`;
    arm.position.set(side * METRICS.shoulderHalfWidth, METRICS.shoulderHeight - METRICS.waistHeight, 0);
    torso.add(arm);

    const forearm = new THREE.Group();
    forearm.name = `player-body-forearm-${key}`;
    forearm.position.set(side * 0.031, -0.3, 0.014);
    arm.add(forearm);

    attachSegmentMeshes(leg, buildThighParts(side), materials, `player-body-thigh-${key}`);
    attachSegmentMeshes(shin, buildShinParts(side), materials, `player-body-shin-${key}`);
    attachSegmentMeshes(ankle, buildBootParts(side), materials, `player-body-boot-${key}`);
    attachSegmentMeshes(arm, buildArmParts(side), armMaterials, `player-body-arm-${key}`);
    attachSegmentMeshes(forearm, buildForearmParts(side), armMaterials, `player-body-forearm-${key}`);

    legs[key] = leg;
    shins[key] = shin;
    ankles[key] = ankle;
    arms[key] = arm;
    forearms[key] = forearm;
  }

  root.userData.joints = { pelvis, torso, hood, legs, shins, ankles, arms, forearms };
  root.userData.materials = materials;
  root.userData.metrics = METRICS;
  root.userData.partCount = countMeshes(root);
  // Measured while the figure still stands at the origin in its rest pose, so
  // the debug readout does not change with whatever the camera is doing.
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  root.userData.size = { x: size.x, y: size.y, z: size.z };
  root.visible = false;
  return root;
}

function countMeshes(root) {
  let meshes = 0;
  root.traverse((object) => {
    if (object.isMesh) meshes += 1;
  });
  return meshes;
}

export function describePlayerBody(body) {
  if (!body) return "NONE";
  const size = body.userData.size ?? { x: 0, y: 0, z: 0 };
  return `${body.name} ${body.userData.partCount ?? 0} meshes ${size.y.toFixed(2)}m`;
}

// ---------------------------------------------------------------------------
// Attachment and animation
// ---------------------------------------------------------------------------

const SIDE_KEYS = ["left", "right"];
const scratchCameraPosition = new THREE.Vector3();
const scratchCameraQuaternion = new THREE.Quaternion();
const scratchCameraInverse = new THREE.Quaternion();
const scratchForward = new THREE.Vector3();
const scratchWorldPosition = new THREE.Vector3();
const scratchWorldQuaternion = new THREE.Quaternion();
const scratchEuler = new THREE.Euler(0, 0, 0, "YXZ");

export function attachPlayerBody(camera) {
  if (!camera) return null;
  const body = createPlayerBody();
  // Parented to the camera for the same reason the arms are: every level gets
  // the figure from attachFirstPersonViewModel without touching level code, and
  // Level 1 still has it inside the scene when the fixture light field is baked.
  // updatePlayerBody cancels the camera's pitch and roll every frame, so the
  // figure stays upright in world space.
  camera.add(body);
  return body;
}

function updateLegJointSet(joints, key, phase, amounts) {
  const { strideAmount, sprintBlend, crouchAngle, grounded } = amounts;
  const isLeft = key === "left";
  const hipSwing = Math.sin(phase) * strideAmount * 0.46;
  // The knee carries the whole walk: nearly straight from heel strike to the
  // late stance, then a deep bend through the swing so the boot clears the floor.
  // Peaking just after toe-off is what a real stride does; peaking earlier drags
  // the planted foot backwards and eats the forward reach.
  const lift = Math.max(0, Math.sin(phase - 3.9));
  const kneeFlex = -(0.08 + (0.55 + sprintBlend * 0.8) * lift * lift) * strideAmount;
  let hipExtra = crouchAngle;
  let kneeExtra = -crouchAngle * 2;
  if (!grounded) {
    hipExtra += 0.24;
    kneeExtra -= 0.5;
  }
  const leg = joints.legs[key];
  leg.rotation.set(hipSwing + hipExtra, 0, (isLeft ? -1 : 1) * 0.016);
  joints.shins[key].rotation.x = kneeFlex + kneeExtra;
  // The ankle carries the opposite of everything above it, which keeps the sole
  // roughly parallel to the floor, then adds heel-strike and toe-off roll.
  const footRoll = grounded
    ? Math.sin(phase + 0.6) * 0.26 * strideAmount
    : -0.16;
  joints.ankles[key].rotation.x = -(hipSwing + hipExtra + kneeFlex + kneeExtra) + footRoll;
}

/**
 * Drives the figure from the camera. Called every frame from
 * updateFirstPersonHazmatViewModel so no level has to know about it.
 */
export function updatePlayerBody(body, camera, elapsed) {
  if (!body || !camera) return;
  const metrics = body.userData.metrics ?? PLAYER_BODY_METRICS;
  const joints = body.userData.joints;
  if (!joints) return;

  camera.updateWorldMatrix(true, false);
  camera.getWorldPosition(scratchCameraPosition);
  camera.getWorldQuaternion(scratchCameraQuaternion);
  camera.getWorldDirection(scratchForward);

  const motion = camera.userData?.firstPersonMotion ?? null;
  const time = Number.isFinite(elapsed) ? elapsed : 0;
  const delta = Number.isFinite(body.userData.lastElapsed)
    ? THREE.MathUtils.clamp(time - body.userData.lastElapsed, 0, 0.1)
    : 1 / 60;
  body.userData.lastElapsed = time;

  const walkAmount = THREE.MathUtils.clamp(motion?.walkBobStrength ?? 0, 0, 1);
  const stridePhase = Number.isFinite(motion?.walkCycle) ? motion.walkCycle : 0;
  const grounded = motion?.grounded !== false;
  const landingImpact = THREE.MathUtils.clamp(motion?.landingImpact ?? 0, 0, 1);
  const speed = Number.isFinite(motion?.movementSpeed) ? motion.movementSpeed : 0;
  const sprintTarget = motion?.sprinting && walkAmount > 0.05 ? 1 : 0;
  body.userData.sprintBlend = THREE.MathUtils.damp(
    body.userData.sprintBlend ?? 0,
    sprintTarget,
    sprintTarget ? 9 : 6,
    delta,
  );
  const sprintBlend = body.userData.sprintBlend;

  const yaw = Math.atan2(-scratchForward.x, -scratchForward.z);
  const eyeHeight = Number.isFinite(motion?.eyeHeight) ? motion.eyeHeight : metrics.eyeHeight;
  const bodyY = Number.isFinite(motion?.bodyY) ? motion.bodyY : scratchCameraPosition.y;
  // Whatever the camera adds on top of bodyY is head bob (or the landing dip
  // that comes with it). Bent knees can only absorb so much, so the pelvis
  // follows a third of it; a jump moves the whole figure.
  const headOffset = scratchCameraPosition.y - bodyY;
  // A jump moves the whole figure; while grounded the pelvis only follows a
  // third of the head bob, because bent knees can absorb just so much. The
  // landing crouch is added on top and the knee angle below cancels it exactly,
  // so the boots stay on the floor through the dip.
  const pelvisLift = (grounded
    ? THREE.MathUtils.clamp(headOffset, -0.06, 0.06) * 0.34
    : headOffset) - (grounded ? landingImpact * 0.05 : 0);
  const crouchDrop = Math.max(0, -pelvisLift);
  const crouchAngle = Math.min(
    0.7,
    Math.acos(THREE.MathUtils.clamp(1 - crouchDrop / LEG_REACH, -1, 1)),
  );

  const strideAmount = walkAmount * THREE.MathUtils.lerp(1, 1.72, sprintBlend);
  const idle = Math.sin(time * 0.72);
  const breathe = Math.sin(time * 1.65);
  const pelvisYaw = Math.sin(stridePhase) * 0.075 * strideAmount;
  const roll = Math.sin(stridePhase) * 0.012 * strideAmount + idle * 0.004;
  const lean = -(0.012 + Math.min(speed, 5.6) * 0.006 + sprintBlend * 0.05 + landingImpact * 0.08);

  scratchEuler.set(lean * 0.45, yaw + pelvisYaw, roll, "YXZ");
  scratchWorldQuaternion.setFromEuler(scratchEuler);
  scratchWorldPosition.set(
    scratchCameraPosition.x + Math.sin(yaw) * metrics.eyeForward,
    bodyY - eyeHeight + pelvisLift,
    scratchCameraPosition.z + Math.cos(yaw) * metrics.eyeForward,
  );
  scratchCameraInverse.copy(scratchCameraQuaternion).invert();
  body.quaternion.copy(scratchCameraInverse).multiply(scratchWorldQuaternion);
  body.position
    .copy(scratchWorldPosition)
    .sub(scratchCameraPosition)
    .applyQuaternion(scratchCameraInverse);

  joints.torso.rotation.set(
    lean + breathe * 0.006,
    -pelvisYaw * 1.1,
    idle * 0.012,
  );
  joints.hood.rotation.set(breathe * 0.005 - landingImpact * 0.03, 0, idle * -0.01);

  for (const key of SIDE_KEYS) {
    const isLeft = key === "left";
    const sideSign = isLeft ? -1 : 1;
    const armPhase = stridePhase + (isLeft ? Math.PI : 0);
    const armStride = Math.sin(armPhase) * strideAmount;
    joints.arms[key].rotation.set(
      armStride * 0.5 - landingImpact * 0.22,
      0,
      sideSign * (0.13 + sprintBlend * 0.05 + Math.abs(armStride) * 0.045 + idle * 0.012),
    );
    joints.forearms[key].rotation.set(
      0.24 + Math.max(0, armStride) * 0.42 + sprintBlend * 0.42 + landingImpact * 0.18,
      0,
      sideSign * 0.05,
    );
    updateLegJointSet(joints, key, stridePhase + (isLeft ? 0 : Math.PI), {
      strideAmount,
      sprintBlend,
      crouchAngle,
      grounded,
    });
  }

  body.userData.positioned = true;
}

export function updateFirstPersonPlayerBody(viewModel, elapsed) {
  const body = viewModel?.userData?.body;
  if (!body) return;
  updatePlayerBody(body, viewModel.parent, elapsed);
  // The opening cutscene hides the hands while the camera lies on the floor;
  // the body has to disappear with them, and it must never appear before it has
  // been placed at least once.
  body.visible = viewModel.visible !== false && body.userData.positioned === true;
}

