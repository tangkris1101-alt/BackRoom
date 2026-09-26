import * as THREE from "three";
import { createGameMaterial } from "../common/materials.js";
import { clampColor, createSeededRandom, drawSpeckles } from "../common/texture-utils.js";

// The world item keeps the silhouette its spawn offsets were authored for: a
// 0.37m tin centred on the model origin, so floor offsets and the aim highlight
// box still line up.
const BODY_RADIUS = 0.158;
const HALF_HEIGHT = 0.185;
const RIM_RADIUS = 0.166;
const LABEL_RADIUS = 0.169;

// Node-side checks build scenes without a canvas: every texture below has to
// fall back to a flat colour there.
function canCreateCanvasTexture() {
  return typeof document !== "undefined" && typeof document.createElement === "function";
}

function createCanvasTexture(width, height, draw, { colorSpace = THREE.SRGBColorSpace } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  draw(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = colorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createTinMaps(baseColor, seed) {
  if (!canCreateCanvasTexture()) return { map: null, bumpMap: null };
  const size = 256;
  const base = `#${new THREE.Color(baseColor).getHexString()}`;
  const drawStreaks = (context, random, light, dark, count) => {
    for (let i = 0; i < count; i += 1) {
      const x = random() * size;
      context.strokeStyle = random() > 0.5
        ? `rgba(${light}, ${0.05 + random() * 0.1})`
        : `rgba(${dark}, ${0.05 + random() * 0.1})`;
      context.lineWidth = 0.5 + random() * 1.2;
      context.beginPath();
      context.moveTo(x, -4);
      context.lineTo(x + (random() - 0.5) * 5, size + 4);
      context.stroke();
    }
  };
  // Rust eats in from the rolled rims, which is where a real can goes first.
  const drawRust = (context, random, top, alpha) => {
    const gradient = context.createLinearGradient(0, top ? 0 : size, 0, top ? size * 0.3 : size * 0.7);
    gradient.addColorStop(0, `rgba(118, 66, 32, ${alpha})`);
    gradient.addColorStop(1, "rgba(118, 66, 32, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, top ? 0 : size * 0.7, size, size * 0.3);
    for (let i = 0; i < 120; i += 1) {
      const x = random() * size;
      const y = top ? random() * size * 0.34 : size - random() * size * 0.34;
      context.fillStyle = `rgba(${104 + random() * 46}, ${52 + random() * 34}, ${22 + random() * 20}, ${0.18 + random() * 0.42})`;
      const radius = 1 + random() * 4.5;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  };

  const map = createCanvasTexture(size, size, (context) => {
    const random = createSeededRandom(seed);
    context.fillStyle = base;
    context.fillRect(0, 0, size, size);
    drawStreaks(context, random, "236, 242, 230", "26, 32, 28", 300);
    drawRust(context, random, true, 0.5);
    drawRust(context, random, false, 0.5);
    // Scuffs down to bare metal, then a dusting of grit.
    for (let i = 0; i < 26; i += 1) {
      const x = random() * size;
      const y = random() * size;
      context.strokeStyle = `rgba(214, 220, 206, ${0.12 + random() * 0.24})`;
      context.lineWidth = 0.8 + random() * 1.4;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + (random() - 0.5) * 26, y + (random() - 0.5) * 5);
      context.stroke();
    }
    drawSpeckles(context, size, 500, 0.1, "24, 20, 16", random);
    drawSpeckles(context, size, 220, 0.06, "232, 236, 224", random);
  });

  const bumpMap = createCanvasTexture(size, size, (context) => {
    const random = createSeededRandom(seed);
    context.fillStyle = "#8c8c8c";
    context.fillRect(0, 0, size, size);
    drawStreaks(context, random, "255,255,255", "0,0,0", 300);
    for (let i = 0; i < 420; i += 1) {
      const x = random() * size;
      const y = random() * size;
      context.fillStyle = `rgba(0, 0, 0, ${0.12 + random() * 0.3})`;
      context.fillRect(x, y, 1 + random() * 3, 1 + random() * 3);
    }
  }, { colorSpace: THREE.NoColorSpace });

  return { map, bumpMap };
}

function createLabelTexture(seed) {
  if (!canCreateCanvasTexture()) return { map: null };
  // The band is 1.06m around by 0.19m tall, so the canvas matches that aspect
  // instead of a print-sized sheet: text then lands at the size it was drawn.
  const width = 1024;
  const height = 192;
  return {
    map: createCanvasTexture(width, height, (context) => {
      const random = createSeededRandom(seed);
      context.fillStyle = "#ddd6b4";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "#4d5b3c";
      context.fillRect(0, 0, width, 26);
      context.fillRect(0, height - 26, width, 26);

      context.fillStyle = "#454f33";
      context.font = "bold 74px Arial, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("M.E.G. RATIONS", width * 0.5, height * 0.5 - 6);
      context.font = "600 30px Arial, sans-serif";
      context.fillText("BEANS IN SAUCE · NET WT 400 g", width * 0.5, height * 0.5 + 44);

      // A second, smaller print run on the far side of the wrap.
      context.font = "bold 42px Arial, sans-serif";
      context.fillText("FIELD ISSUE", width * 0.12, height * 0.5);
      context.font = "600 22px Arial, sans-serif";
      context.fillText("KEEP DRY", width * 0.12, height * 0.5 + 34);
      context.textAlign = "left";
      for (let line = 0; line < 5; line += 1) {
        context.fillStyle = "rgba(69, 79, 51, 0.62)";
        context.fillRect(width * 0.78, height * 0.34 + line * 12, 150 - line * 12, 4);
      }
      context.textAlign = "center";

      // Rust bleeding up from both crimped edges, water stains, dust.
      const bleed = (fromTop) => {
        const gradient = context.createLinearGradient(0, fromTop ? 26 : height - 26, 0, fromTop ? height * 0.55 : height * 0.45);
        gradient.addColorStop(0, "rgba(126, 74, 34, 0.42)");
        gradient.addColorStop(1, "rgba(126, 74, 34, 0)");
        context.fillStyle = gradient;
        context.fillRect(0, fromTop ? 26 : height * 0.45, width, height * 0.29);
      };
      bleed(true);
      bleed(false);
      for (let i = 0; i < 260; i += 1) {
        const x = random() * width;
        const y = random() < 0.5 ? random() * height * 0.2 : height - random() * height * 0.2;
        context.fillStyle = `rgba(112, 64, 28, ${0.08 + random() * 0.3})`;
        context.beginPath();
        context.arc(x, y, 0.8 + random() * 3.6, 0, Math.PI * 2);
        context.fill();
      }
      for (let i = 0; i < 8; i += 1) {
        const x = random() * width;
        const y = 40 + random() * (height - 80);
        context.strokeStyle = `rgba(120, 96, 54, ${0.06 + random() * 0.12})`;
        context.lineWidth = 6 + random() * 16;
        context.beginPath();
        context.arc(x, y, 20 + random() * 40, 0, Math.PI * 2);
        context.stroke();
      }
      // One corner peeled back to bare metal.
      context.fillStyle = "rgba(150, 146, 130, 0.92)";
      context.beginPath();
      context.moveTo(width * 0.62, 26);
      context.lineTo(width * 0.78, 26);
      context.lineTo(width * 0.66, height * 0.46);
      context.closePath();
      context.fill();
      context.strokeStyle = "rgba(86, 70, 40, 0.5)";
      context.lineWidth = 2;
      context.stroke();

      drawSpeckles(context, width, 900, 0.07, "72, 60, 34", random);
      drawSpeckles(context, width, 300, 0.05, "246, 242, 222", random);
      context.strokeStyle = "rgba(84, 68, 38, 0.16)";
      context.lineWidth = 5;
      context.strokeRect(2, 2, width - 4, height - 4);
    }),
  };
}

// A couple of dents: the radius is pulled in over a patch of the wall and
// blended vertically, which reads as a crushed tin without extra geometry.
function applyDents(geometry, dents) {
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    if (Math.hypot(x, z) < 1e-4) continue;
    const y = position.getY(i);
    const angle = Math.atan2(z, x);
    let scale = 1;
    for (const dent of dents) {
      let delta = angle - dent.angle;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      const across = Math.exp(-(delta * delta) / (2 * dent.width * dent.width));
      const along = Math.max(0, 1 - Math.abs(y - dent.y) / dent.height);
      scale *= 1 - dent.depth * across * along;
    }
    position.setX(i, x * scale);
    position.setZ(i, z * scale);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Opened tin can: rolled rims top and bottom, a brushed and rusted shell, a
 * paper label that has bled and peeled, a dark interior and the lid levered up
 * so it still hangs off the rim. Origin is the can's centre.
 */
export function createEmptyCanModel() {
  const group = new THREE.Group();
  group.name = "empty-can-model";

  const metal = createTinMaps(0x9aa39c, 0x2f13);
  const label = createLabelTexture(0x77a1);
  const shellMaterial = createGameMaterial(({ lowQuality }) => ({
    map: metal.map,
    color: metal.map ? 0xffffff : 0x9aa39c,
    roughness: 0.46,
    metalness: 0.56,
    emissive: 0x141a17,
    emissiveIntensity: 0.06,
    side: THREE.DoubleSide,
    ...(lowQuality || !metal.bumpMap ? {} : { bumpMap: metal.bumpMap, bumpScale: 0.05 }),
  }));
  const labelMaterial = createGameMaterial({
    map: label.map,
    color: label.map ? 0xffffff : 0xcfc7a4,
    roughness: 0.88,
    metalness: 0.02,
    emissive: 0x16170f,
    emissiveIntensity: 0.05,
  });
  const interiorMaterial = createGameMaterial({
    color: 0x2b322c,
    roughness: 0.7,
    metalness: 0.34,
    emissive: 0x0c0f0d,
    emissiveIntensity: 0.05,
    side: THREE.DoubleSide,
  });

  const dents = [
    { angle: 0.5, y: -0.03, width: 0.42, height: 0.12, depth: 0.09 },
    { angle: 3.4, y: 0.06, width: 0.3, height: 0.09, depth: 0.06 },
  ];

  const shell = new THREE.LatheGeometry([
    new THREE.Vector2(0.0, -HALF_HEIGHT),
    new THREE.Vector2(0.06, -HALF_HEIGHT - 0.002),
    new THREE.Vector2(0.12, -HALF_HEIGHT),
    new THREE.Vector2(0.15, -0.181),
    new THREE.Vector2(0.162, -0.172),
    new THREE.Vector2(RIM_RADIUS, -0.16),
    new THREE.Vector2(RIM_RADIUS, -0.15),
    new THREE.Vector2(0.161, -0.12),
    new THREE.Vector2(BODY_RADIUS, -0.06),
    new THREE.Vector2(0.157, 0.0),
    new THREE.Vector2(BODY_RADIUS, 0.06),
    new THREE.Vector2(0.161, 0.12),
    new THREE.Vector2(RIM_RADIUS, 0.15),
    new THREE.Vector2(RIM_RADIUS, 0.162),
    new THREE.Vector2(0.162, 0.172),
    new THREE.Vector2(0.152, 0.179),
    new THREE.Vector2(0.14, 0.182),
    new THREE.Vector2(0.132, 0.178),
    new THREE.Vector2(0.13, 0.17),
  ], 32);
  shell.translate(0, 0, 0);
  const shellMesh = new THREE.Mesh(applyDents(shell, dents), shellMaterial);
  shellMesh.name = "empty-can-shell";
  group.add(shellMesh);

  const interior = new THREE.Mesh(
    applyDents(new THREE.CylinderGeometry(0.128, 0.126, 0.34, 28, 1, true), dents),
    interiorMaterial,
  );
  interior.name = "empty-can-interior";
  interior.position.y = -0.006;
  const interiorFloor = new THREE.Mesh(
    applyDents(new THREE.CircleGeometry(0.128, 28).rotateX(Math.PI / 2), dents),
    interiorMaterial,
  );
  interiorFloor.name = "empty-can-interior-floor";
  interiorFloor.position.y = -0.172;
  group.add(interior, interiorFloor);

  const band = new THREE.Mesh(
    applyDents(new THREE.CylinderGeometry(LABEL_RADIUS, LABEL_RADIUS, 0.185, 32, 1, true), dents),
    labelMaterial,
  );
  band.position.y = -0.014;
  band.name = "empty-can-label";
  group.add(band);

  // The lid was levered open: one edge still rests near the rim, the other has
  // dropped inside, and the pull tab hangs off the raised side. Tilting it
  // further leaves the dark interior readable from above.
  const lid = new THREE.Mesh(applyDents(new THREE.CircleGeometry(0.126, 28).rotateX(Math.PI / 2), []), shellMaterial);
  lid.name = "empty-can-lid";
  lid.position.set(0.018, 0.158, -0.012);
  lid.rotation.set(0.66, 0.3, -0.16);
  group.add(lid);

  const tab = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.0042, 6, 16), shellMaterial);
  tab.name = "empty-can-pull-tab";
  tab.position.set(-0.024, 0.177, 0.026);
  tab.rotation.set(Math.PI / 2 - 0.66, 0.3, 0);
  group.add(tab);
  const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 8), shellMaterial);
  rivet.name = "empty-can-tab-rivet";
  rivet.position.set(-0.014, 0.156, 0.02);
  rivet.rotation.set(0.3, 0, 0.5);
  group.add(rivet);

  group.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = false;
    object.receiveShadow = false;
  });
  return group;
}
