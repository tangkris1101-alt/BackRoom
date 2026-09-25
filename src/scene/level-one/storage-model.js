import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createGameMaterial } from "../common/materials.js";
import { clampColor, createSeededRandom, drawSpeckles } from "../common/texture-utils.js";
import { createWideSignTexture } from "../common/textures.js";

// The content-expansion check imports these props in Node, where no canvas
// exists. Every texture factory must degrade to flat colours there.
function canCreateCanvasTexture() {
  return typeof document !== "undefined" && typeof document.createElement === "function";
}

function createCanvasTexture(width, height, draw, { colorSpace = THREE.SRGBColorSpace, repeat = 1 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  draw(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = colorSpace;
  texture.anisotropy = 6;
  return texture;
}

function createTransparentTexture(width, height, draw) {
  return createCanvasTexture(width, height, (context, w, h) => {
    context.clearRect(0, 0, w, h);
    draw(context, w, h);
  });
}

// Grain runs along the canvas U axis; the crate rotates the UVs of its
// vertical planks so the sawn lines follow each board's length.
function drawWoodGrain(context, size, random, light, dark, weight) {
  for (let i = 0; i < 150; i += 1) {
    const y = random() * size;
    context.strokeStyle = random() > 0.5 ? light : dark;
    context.lineWidth = weight * (0.5 + random() * 1.7);
    context.beginPath();
    let x = -12;
    context.moveTo(x, y);
    while (x < size + 12) {
      const step = 32 + random() * 46;
      context.bezierCurveTo(
        x + step * 0.3, y + (random() - 0.5) * 6,
        x + step * 0.7, y + (random() - 0.5) * 6,
        x + step, y + (random() - 0.5) * 5,
      );
      x += step;
    }
    context.stroke();
  }
}

function drawKnots(context, size, random, count, ink) {
  for (let k = 0; k < count; k += 1) {
    const cx = 30 + random() * (size - 60);
    const cy = 30 + random() * (size - 60);
    context.save();
    context.translate(cx, cy);
    context.scale(1, 0.44);
    for (let ring = 4; ring > 0; ring -= 1) {
      context.strokeStyle = `rgba(${ink}, ${0.05 + random() * 0.07})`;
      context.lineWidth = 1.3 + random() * 1.5;
      context.beginPath();
      context.arc(0, 0, ring * (4 + random() * 2.4), 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }
}

function createPlankMaps(baseColor, seed) {
  if (!canCreateCanvasTexture()) return { map: null, bumpMap: null };
  const size = 512;
  const base = `#${new THREE.Color(baseColor).getHexString()}`;
  // Board ends and edges are drawn into the tile so every plank keeps a
  // readable outline instead of a repeating flat fill.
  const drawEdges = (context, color) => {
    const edge = context.createLinearGradient(0, 0, 0, size);
    edge.addColorStop(0, color);
    edge.addColorStop(0.06, "rgba(0,0,0,0)");
    edge.addColorStop(0.94, "rgba(0,0,0,0)");
    edge.addColorStop(1, color);
    context.fillStyle = edge;
    context.fillRect(0, 0, size, size);
    const sides = context.createLinearGradient(0, 0, size, 0);
    sides.addColorStop(0, color);
    sides.addColorStop(0.05, "rgba(0,0,0,0)");
    sides.addColorStop(0.95, "rgba(0,0,0,0)");
    sides.addColorStop(1, color);
    context.fillStyle = sides;
    context.fillRect(0, 0, size, size);
  };

  const map = createCanvasTexture(size, size, (context) => {
    const random = createSeededRandom(seed);
    context.fillStyle = base;
    context.fillRect(0, 0, size, size);
    drawWoodGrain(context, size, random, "rgba(232, 206, 164, 0.14)", "rgba(34, 21, 10, 0.17)", 1.05);
    drawKnots(context, size, random, 3, "20, 12, 6");
    // Rough planing marks and a dry, dusty film.
    for (let i = 0; i < 26; i += 1) {
      const y = random() * size;
      context.strokeStyle = `rgba(255, 236, 200, ${0.03 + random() * 0.05})`;
      context.lineWidth = 0.8 + random() * 1.6;
      context.beginPath();
      context.moveTo(random() * size * 0.5, y);
      context.lineTo(random() * size * 0.5 + size * 0.5, y + (random() - 0.5) * 4);
      context.stroke();
    }
    drawSpeckles(context, size, 900, 0.075, "30, 20, 10", random);
    drawSpeckles(context, size, 420, 0.06, "246, 226, 186", random);
    drawEdges(context, "rgba(28, 18, 9, 0.34)");
  });

  const bumpMap = createCanvasTexture(size, size, (context) => {
    const random = createSeededRandom(seed);
    context.fillStyle = "#7f7f7f";
    context.fillRect(0, 0, size, size);
    drawWoodGrain(context, size, random, "rgba(255,255,255,0.2)", "rgba(0,0,0,0.24)", 1);
    drawKnots(context, size, random, 3, "0, 0, 0");
    drawEdges(context, "rgba(0, 0, 0, 0.4)");
  }, { colorSpace: THREE.NoColorSpace });
  return { map, bumpMap };
}

function createCardboardMap(baseColor, seed) {
  if (!canCreateCanvasTexture()) return { map: null };
  const size = 256;
  const map = createCanvasTexture(size, size, (context) => {
    const random = createSeededRandom(seed);
    context.fillStyle = `#${new THREE.Color(baseColor).getHexString()}`;
    context.fillRect(0, 0, size, size);
    // Corrugation read as a fine vertical flute through the liner.
    for (let x = 0; x < size; x += 4) {
      context.fillStyle = `rgba(70, 48, 26, ${0.03 + random() * 0.03})`;
      context.fillRect(x, 0, 1.4, size);
    }
    // Fold creases meet at the middle of every face.
    context.strokeStyle = "rgba(64, 42, 22, 0.3)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(size / 2, 0);
    context.lineTo(size / 2, size);
    context.moveTo(0, size / 2);
    context.lineTo(size, size / 2);
    context.stroke();
    // Packing tape over the mid seam.
    context.fillStyle = "rgba(206, 190, 158, 0.55)";
    context.fillRect(0, size * 0.42, size, size * 0.16);
    context.strokeStyle = "rgba(120, 104, 74, 0.45)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, size * 0.42);
    context.lineTo(size, size * 0.42);
    context.moveTo(0, size * 0.58);
    context.lineTo(size, size * 0.58);
    context.stroke();
    // Printed handling block with an up arrow.
    context.fillStyle = "rgba(240, 234, 216, 0.62)";
    context.fillRect(size * 0.09, size * 0.66, size * 0.36, size * 0.26);
    context.strokeStyle = "rgba(58, 44, 28, 0.75)";
    context.lineWidth = 1.6;
    context.strokeRect(size * 0.09, size * 0.66, size * 0.36, size * 0.26);
    context.beginPath();
    context.moveTo(size * 0.18, size * 0.87);
    context.lineTo(size * 0.18, size * 0.72);
    context.lineTo(size * 0.13, size * 0.78);
    context.moveTo(size * 0.18, size * 0.72);
    context.lineTo(size * 0.23, size * 0.78);
    context.stroke();
    context.fillStyle = "rgba(58, 44, 28, 0.8)";
    context.fillRect(size * 0.27, size * 0.71, size * 0.15, 2);
    context.fillRect(size * 0.27, size * 0.77, size * 0.15, 2);
    context.fillRect(size * 0.27, size * 0.83, size * 0.11, 2);
    context.fillStyle = "rgba(240, 234, 216, 0.5)";
    context.fillRect(size * 0.56, size * 0.7, size * 0.32, size * 0.2);
    context.fillStyle = "rgba(70, 52, 32, 0.6)";
    context.fillRect(size * 0.6, size * 0.75, size * 0.24, 3);
    context.fillRect(size * 0.6, size * 0.81, size * 0.18, 3);
    drawSpeckles(context, size, 320, 0.07, "60, 40, 20", random);
    drawSpeckles(context, size, 160, 0.05, "246, 236, 214", random);
    const edge = context.createLinearGradient(0, 0, 0, size);
    edge.addColorStop(0, "rgba(52, 34, 16, 0.22)");
    edge.addColorStop(0.08, "rgba(0,0,0,0)");
    edge.addColorStop(0.92, "rgba(0,0,0,0)");
    edge.addColorStop(1, "rgba(52, 34, 16, 0.22)");
    context.fillStyle = edge;
    context.fillRect(0, 0, size, size);
  });
  return { map };
}

function createSteelMap(baseColor, seed) {
  if (!canCreateCanvasTexture()) return { map: null, bumpMap: null };
  const size = 256;
  const drawStreaks = (context, random, light, dark) => {
    for (let i = 0; i < 260; i += 1) {
      const x = random() * size;
      context.strokeStyle = random() > 0.5
        ? `rgba(${light}, ${0.04 + random() * 0.09})`
        : `rgba(${dark}, ${0.04 + random() * 0.09})`;
      context.lineWidth = 0.5 + random() * 1.1;
      context.beginPath();
      context.moveTo(x, -4);
      context.lineTo(x + (random() - 0.5) * 4, size + 4);
      context.stroke();
    }
  };
  const map = createCanvasTexture(size, size, (context) => {
    const random = createSeededRandom(seed);
    context.fillStyle = `#${new THREE.Color(baseColor).getHexString()}`;
    context.fillRect(0, 0, size, size);
    drawStreaks(context, random, "230, 236, 222", "10, 14, 10");
    // Chipped paint over a dull primer, plus a few rust blooms at the edges.
    for (let i = 0; i < 34; i += 1) {
      const x = random() * size;
      const y = random() * size;
      const w = 2 + random() * 9;
      const h = 1.5 + random() * 6;
      context.fillStyle = `rgba(38, 40, 34, ${0.32 + random() * 0.3})`;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + w, y + (random() - 0.5) * 3);
      context.lineTo(x + w * 0.8, y + h);
      context.lineTo(x - w * 0.2, y + h * 0.7);
      context.closePath();
      context.fill();
    }
    for (let i = 0; i < 20; i += 1) {
      const x = random() * size;
      const y = random() * size;
      context.fillStyle = `rgba(122, 78, 40, ${0.12 + random() * 0.16})`;
      context.fillRect(x, y, 1.5 + random() * 3, 1.5 + random() * 2.5);
    }
    drawSpeckles(context, size, 420, 0.09, "16, 18, 14", random);
    drawSpeckles(context, size, 180, 0.06, "214, 220, 206", random);
  });
  const bumpMap = createCanvasTexture(size, size, (context) => {
    const random = createSeededRandom(seed);
    context.fillStyle = "#8a8a8a";
    context.fillRect(0, 0, size, size);
    drawStreaks(context, random, "255,255,255", "0,0,0");
    for (let i = 0; i < 200; i += 1) {
      const x = random() * size;
      const y = random() * size;
      context.fillStyle = `rgba(0, 0, 0, ${0.1 + random() * 0.25})`;
      context.fillRect(x, y, 1 + random() * 3, 1 + random() * 3);
    }
  }, { colorSpace: THREE.NoColorSpace });
  return { map, bumpMap };
}

const STENCIL_LAYOUTS = {
  meg: [
    { text: "M.E.G.", font: "bold 118px Arial, sans-serif", y: 0.4, spacing: 6 },
    { text: "SUPPLY DEPOT", font: "bold 44px Arial, sans-serif", y: 0.58 },
    { text: "FRAGILE — HANDLE WITH CARE", font: "30px Arial, sans-serif", y: 0.72 },
  ],
  rations: [
    { text: "RATIONS", font: "bold 96px Arial, sans-serif", y: 0.4, spacing: 4 },
    { text: "12 UNITS · 25 KG", font: "bold 44px Arial, sans-serif", y: 0.58 },
    { text: "STORE BELOW 30°C", font: "30px Arial, sans-serif", y: 0.72 },
  ],
};

function createStencilMap(layout) {
  if (!canCreateCanvasTexture()) return { map: null };
  const width = 512;
  const height = 256;
  return {
    map: createTransparentTexture(width, height, (context) => {
      const random = createSeededRandom(0x5ea1 + layout.length * 977);
      context.fillStyle = "rgba(226, 234, 214, 0.86)";
      context.strokeStyle = "rgba(226, 234, 214, 0.86)";
      context.textAlign = "center";
      context.textBaseline = "middle";
      layout.forEach((line) => {
        context.font = line.font;
        context.fillText(line.text, width / 2, height * line.y);
      });
      context.lineWidth = 6;
      context.strokeRect(16, 16, width - 32, height - 32);
      context.beginPath();
      context.moveTo(width - 74, height * 0.42);
      context.lineTo(width - 74, height * 0.2);
      context.lineTo(width - 92, height * 0.28);
      context.moveTo(width - 74, height * 0.2);
      context.lineTo(width - 56, height * 0.28);
      context.stroke();
      // Sprayed stencils break up: punch fine speckle holes through the ink.
      for (let i = 0; i < 1500; i += 1) {
        const x = random() * width;
        const y = random() * height;
        context.clearRect(x, y, 1 + random() * 2.6, 1 + random() * 2.2);
      }
    }),
  };
}

function mergeParts(geometries) {
  return mergeGeometries(geometries.map((geometry) => geometry.toNonIndexed()), false);
}

function rotateUvQuarterTurn(geometry) {
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < uv.count; i += 1) {
    const u = uv.getX(i);
    uv.setXY(i, uv.getY(i), u);
  }
  uv.needsUpdate = true;
  return geometry;
}

function plankPart(width, height, thickness, x, y, z, { grainAlongHeight = false } = {}) {
  const geometry = new THREE.BoxGeometry(width, height, thickness);
  if (grainAlongHeight) rotateUvQuarterTurn(geometry);
  geometry.translate(x, y, z);
  return geometry;
}

function boardPart(length, thickness, depth, x, y, z) {
  return new THREE.BoxGeometry(length, thickness, depth).translate(x, y, z);
}

function nailGeometry(x, y, z, { axis = "z", length = 0.014, radius = 0.0085 } = {}) {
  const geometry = new THREE.CylinderGeometry(radius, radius * 0.82, length, 6);
  if (axis === "z") geometry.rotateX(Math.PI / 2);
  else if (axis === "x") geometry.rotateZ(Math.PI / 2);
  geometry.translate(x, y, z);
  return geometry;
}

function addMesh(group, name, parts, material) {
  if (parts.length === 0) return null;
  const mesh = new THREE.Mesh(mergeParts(parts), material);
  mesh.name = name;
  group.add(mesh);
  return mesh;
}

export function createLevelOneStorageAssetKit({
  plankColor = 0x9c7746,
  plankAltColor = 0x8a6638,
  frameColor = 0x6d5330,
  coreColor = 0x4a3a23,
  darkPlankColor = 0x7d7a68,
  darkFrameColor = 0x585747,
  darkCoreColor = 0x36362c,
  steelColor = 0x505c4e,
  deckColor = 0x8b7247,
  cardboardColor = 0xa9855c,
  cardboardAltColor = 0x936f4a,
} = {}) {
  const plank = createPlankMaps(plankColor, 0x51a7);
  const plankAltMaps = createPlankMaps(plankAltColor, 0x77c1);
  const darkPlank = createPlankMaps(darkPlankColor, 0x2d19);
  const darkFrame = createPlankMaps(darkFrameColor, 0x4b73);
  const cardboard = createCardboardMap(cardboardColor, 0x1c07);
  const cardboardAlt = createCardboardMap(cardboardAltColor, 0x33a9);
  const steel = createSteelMap(steelColor, 0x6f2d);
  const stencilMeg = createStencilMap(STENCIL_LAYOUTS.meg);
  const stencilRations = createStencilMap(STENCIL_LAYOUTS.rations);
  const labelSupply = canCreateCanvasTexture()
    ? { map: createWideSignTexture("A-03 SUPPLY", "#233026", "#e7f3d9") }
    : { map: null };
  const labelRations = canCreateCanvasTexture()
    ? { map: createWideSignTexture("B-02 RATIONS", "#2b2a22", "#f0eccf") }
    : { map: null };

  // The wheeled crates read as a second tone of the same board stock, so the
  // textures are shared and only the colour multiplier changes.
  // With the board texture in place the tint multiplies it; without a canvas
  // the same slot has to carry the board colour on its own.
  const boardMaterial = (maps, tint, fallbackColor, roughness = 0.88) => createGameMaterial(({ lowQuality }) => ({
    map: maps.map,
    color: maps.map ? tint : fallbackColor,
    roughness,
    metalness: 0.02,
    emissive: 0x1f1508,
    emissiveIntensity: 0.07,
    ...(lowQuality || !maps.bumpMap ? {} : { bumpMap: maps.bumpMap, bumpScale: 0.32 }),
  }));

  return {
    materials: {
      plank: boardMaterial(plank, 0xffffff, plankColor),
      plankAlt: boardMaterial(plankAltMaps, 0xffffff, plankAltColor, 0.9),
      frame: createGameMaterial(({ lowQuality }) => ({
        color: frameColor,
        roughness: 0.9,
        metalness: 0.02,
        emissive: 0x1a1206,
        emissiveIntensity: 0.07,
        ...(lowQuality ? {} : { flatShading: true }),
      })),
      core: createGameMaterial({ color: coreColor, roughness: 0.94, emissive: 0x140d05, emissiveIntensity: 0.05 }),
      plankDark: boardMaterial(darkPlank, 0xffffff, darkPlankColor, 0.92),
      plankDarkAlt: boardMaterial(darkPlank, 0xd8d8cc, darkPlankColor, 0.92),
      frameDark: createGameMaterial({ color: darkFrameColor, roughness: 0.92, emissive: 0x14140f, emissiveIntensity: 0.06 }),
      coreDark: createGameMaterial({ color: darkCoreColor, roughness: 0.95, emissive: 0x101009, emissiveIntensity: 0.05 }),
      nail: createGameMaterial({
        color: 0x33352e,
        roughness: 0.62,
        metalness: 0.55,
        emissive: 0x0f100c,
        emissiveIntensity: 0.05,
      }),
      steel: createGameMaterial(({ lowQuality }) => ({
        map: steel.map,
        color: steel.map ? 0xffffff : steelColor,
        roughness: 0.52,
        metalness: 0.46,
        emissive: 0x1b2018,
        emissiveIntensity: 0.09,
        ...(lowQuality || !steel.bumpMap ? {} : { bumpMap: steel.bumpMap, bumpScale: 0.22 }),
      })),
      deck: boardMaterial({ map: plank.map, bumpMap: plank.bumpMap }, 0xd8c49a, deckColor, 0.86),
      deckAlt: boardMaterial({ map: plankAltMaps.map, bumpMap: plankAltMaps.bumpMap }, 0xc4b18c, deckColor, 0.88),
      cardboard: createGameMaterial({
        map: cardboard.map,
        color: cardboard.map ? 0xffffff : cardboardColor,
        roughness: 0.95,
        emissive: 0x1c1409,
        emissiveIntensity: 0.06,
      }),
      cardboardAlt: createGameMaterial({
        map: cardboardAlt.map,
        color: cardboardAlt.map ? 0xffffff : cardboardAltColor,
        roughness: 0.95,
        emissive: 0x1a1207,
        emissiveIntensity: 0.06,
      }),
      stencilMeg: createGameMaterial({
        map: stencilMeg.map,
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        roughness: 0.9,
        emissive: 0x1a1d17,
        emissiveIntensity: 0.06,
        side: THREE.DoubleSide,
      }),
      stencilRations: createGameMaterial({
        map: stencilRations.map,
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        roughness: 0.9,
        emissive: 0x1a1d17,
        emissiveIntensity: 0.06,
        side: THREE.DoubleSide,
      }),
      labelSupply: createGameMaterial({
        map: labelSupply.map,
        color: labelSupply.map ? 0xffffff : 0xe7f3d9,
        transparent: Boolean(labelSupply.map),
        alphaTest: labelSupply.map ? 0.05 : 0,
        roughness: 0.72,
        emissive: 0x223026,
        emissiveIntensity: 0.16,
        side: THREE.DoubleSide,
      }),
      labelRations: createGameMaterial({
        map: labelRations.map,
        color: labelRations.map ? 0xffffff : 0xf0eccf,
        transparent: Boolean(labelRations.map),
        alphaTest: labelRations.map ? 0.05 : 0,
        roughness: 0.72,
        emissive: 0x2c2b21,
        emissiveIntensity: 0.16,
        side: THREE.DoubleSide,
      }),
    },
  };
}

/**
 * Framed board crate: skid base, plank shell around a solid core, batten frame
 * with rails and nails, plank lid with top rails and stencilled markings.
 * Origin is the floor at the crate centre, so topY colliders stay valid.
 */
export function buildDetailedSupplyCrate({
  materials,
  width = 1.25,
  height = 0.86,
  depth = 1.15,
  seed = 1,
  tone = "light",
  braced = false,
  stencil = "meg",
} = {}) {
  const group = new THREE.Group();
  const random = createSeededRandom(seed);
  const dark = tone === "dark";
  const plankMaterial = dark ? materials.plankDark : materials.plank;
  const plankAltMaterial = dark ? materials.plankDarkAlt : materials.plankAlt;
  const frameMaterial = dark ? materials.frameDark : materials.frame;
  const coreMaterial = dark ? materials.coreDark : materials.core;
  const decalMaterial = stencil === "rations" ? materials.stencilRations : materials.stencilMeg;

  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const skidHeight = height * 0.105;
  const lidHeight = height * 0.093;
  const bodyTop = height - lidHeight;
  const bodyHeight = bodyTop - skidHeight;
  const batten = 0.07;
  const plankThickness = 0.028;
  const frameOuterZ = halfDepth - batten / 2;
  const frameOuterX = halfWidth - batten / 2;
  const plankOuterZ = frameOuterZ - plankThickness / 2 - 0.004;
  const plankOuterX = frameOuterX - plankThickness / 2 - 0.004;
  const bodyMidY = skidHeight + bodyHeight / 2;

  const core = [new RoundedBoxGeometry(
    width - batten * 2 - plankThickness * 2 - 0.03,
    bodyHeight,
    depth - batten * 2 - plankThickness * 2 - 0.03,
    2,
    0.008,
  ).translate(0, bodyMidY, 0)];

  const planks = [];
  const planksAlt = [];
  const frame = [];
  const nails = [];

  const longSpan = width - batten * 2;
  const longCount = 6;
  const longGap = 0.006;
  const longWidth = (longSpan - longGap * (longCount - 1)) / longCount;
  const shortSpan = depth - batten * 2;
  const shortCount = 5;
  const shortWidth = (shortSpan - longGap * (shortCount - 1)) / shortCount;
  for (const side of [-1, 1]) {
    let alternate = random() > 0.5;
    for (let i = 0; i < longCount; i += 1) {
      const x = -longSpan / 2 + longWidth / 2 + i * (longWidth + longGap);
      const part = plankPart(longWidth, bodyHeight, plankThickness, x, bodyMidY, side * plankOuterZ, { grainAlongHeight: true });
      (alternate ? planks : planksAlt).push(part);
      alternate = !alternate;
    }
    alternate = random() > 0.5;
    for (let i = 0; i < shortCount; i += 1) {
      const z = -shortSpan / 2 + shortWidth / 2 + i * (shortWidth + longGap);
      const part = plankPart(plankThickness, bodyHeight, shortWidth, side * plankOuterX, bodyMidY, z);
      (alternate ? planks : planksAlt).push(part);
      alternate = !alternate;
    }
  }

  const railHeight = bodyHeight * 0.125;
  const railY = [skidHeight + railHeight / 2, bodyTop - railHeight / 2];
  for (const side of [-1, 1]) {
    for (const y of railY) {
      frame.push(boardPart(longSpan + 0.002, railHeight, batten, 0, y, side * frameOuterZ));
      frame.push(new THREE.BoxGeometry(batten, railHeight, shortSpan + 0.002).translate(side * frameOuterX, y, 0));
      for (const x of [-0.38, -0.13, 0.13, 0.38]) {
        nails.push(nailGeometry(x * longSpan, y, side * (frameOuterZ + batten / 2 - 0.002)));
      }
      for (const z of [-0.3, 0, 0.3]) {
        nails.push(nailGeometry(side * (frameOuterX + batten / 2 - 0.002), y, z * shortSpan, { axis: "x" }));
      }
    }
    // The board field is tied to the frame by paired nails at mid height.
    nails.push(nailGeometry(-longSpan * 0.36, bodyMidY, side * (frameOuterZ + batten / 2 - 0.002)));
    nails.push(nailGeometry(longSpan * 0.36, bodyMidY, side * (frameOuterZ + batten / 2 - 0.002)));
  }

  for (const side of [-1, 1]) {
    for (const x of [-frameOuterX, frameOuterX]) {
      for (const z of [-frameOuterZ, frameOuterZ]) {
        frame.push(new THREE.BoxGeometry(batten, height - skidHeight, batten).translate(x, (height + skidHeight) / 2, z));
      }
    }
  }

  if (braced) {
    // Braces live on the crate's ends: the long faces stay clear for the
    // stencilled markings.
    const fieldHeight = bodyTop - skidHeight - railHeight * 2;
    const fieldMidY = skidHeight + railHeight + fieldHeight / 2;
    const diagonal = Math.hypot(shortSpan, fieldHeight);
    const angle = Math.atan2(fieldHeight, shortSpan);
    for (const side of [-1, 1]) {
      const geometry = new THREE.BoxGeometry(0.026, 0.062, diagonal);
      geometry.rotateX(side > 0 ? angle : -angle);
      geometry.translate(side * (frameOuterX + 0.004), fieldMidY, 0);
      frame.push(geometry);
      const half = diagonal / 2 - 0.06;
      for (const sign of [-1, 1]) {
        nails.push(nailGeometry(
          side * (frameOuterX + batten / 2 - 0.004),
          fieldMidY - Math.sin(angle) * half * sign,
          Math.cos(angle) * half * sign,
          { axis: "x" },
        ));
      }
    }
  }

  const skidRunner = skidHeight * 0.62;
  for (const z of [-0.34, 0, 0.34]) {
    frame.push(new THREE.BoxGeometry(width, skidRunner, 0.14).translate(0, skidRunner / 2, z * depth));
  }
  for (const x of [-0.34, 0.34]) {
    frame.push(new THREE.BoxGeometry(0.14, skidHeight - skidRunner, depth - 0.2)
      .translate(x * width, skidRunner + (skidHeight - skidRunner) / 2, 0));
  }

  const lidPlankThickness = lidHeight * 0.62;
  const lidSpan = depth - batten * 2;
  const lidCount = 5;
  const lidWidth = (lidSpan - longGap * (lidCount - 1)) / lidCount;
  let lidAlternate = random() > 0.5;
  for (let i = 0; i < lidCount; i += 1) {
    const z = -lidSpan / 2 + lidWidth / 2 + i * (lidWidth + longGap);
    const part = new THREE.BoxGeometry(width - batten * 2, lidPlankThickness, lidWidth)
      .translate(0, bodyTop + lidPlankThickness / 2, z);
    (lidAlternate ? planks : planksAlt).push(part);
    lidAlternate = !lidAlternate;
  }
  for (const z of [-frameOuterZ, frameOuterZ]) {
    frame.push(new THREE.BoxGeometry(width, height - bodyTop + 0.002, batten)
      .translate(0, (height + bodyTop) / 2, z));
    for (const x of [-0.35, 0, 0.35]) {
      nails.push(nailGeometry(x * width, height - 0.006, z, { axis: "y", length: 0.012 }));
    }
  }

  const decals = [];
  const fieldMidY = skidHeight + railHeight + (bodyTop - skidHeight - railHeight * 2) / 2;
  for (const side of [-1, 1]) {
    const decal = new THREE.PlaneGeometry(width * 0.42, height * 0.36);
    if (side < 0) decal.rotateY(Math.PI);
    decal.translate(0, fieldMidY, side * (plankOuterZ + plankThickness / 2 + 0.0015));
    decals.push(decal);
  }
  const lidDecal = new THREE.PlaneGeometry(width * 0.44, depth * 0.3);
  lidDecal.rotateX(-Math.PI / 2);
  lidDecal.translate(0, bodyTop + lidPlankThickness + 0.0015, 0);
  decals.push(lidDecal);

  addMesh(group, "level-one-crate-planks", planks, plankMaterial);
  addMesh(group, "level-one-crate-planks-alt", planksAlt, plankAltMaterial);
  addMesh(group, "level-one-crate-frame", frame, frameMaterial);
  addMesh(group, "level-one-crate-core", core, coreMaterial);
  addMesh(group, "level-one-crate-nails", nails, materials.nail);
  addMesh(group, "level-one-crate-stencil", decals, decalMaterial);
  return group;
}

/**
 * Warehouse shelving bay: bolted uprights on levelling feet, steel beams with
 * board decks, plywood back with stiffeners, end braces, bin labels and a
 * stocked front bay (pallet, cartons and optionally a smaller crate).
 */
export function buildDetailedSupplyShelf({
  materials,
  width = 2.3,
  depth = 1.22,
  height = 1.55,
  seed = 1,
  stocked = "cartons",
  labels = "supply",
} = {}) {
  const group = new THREE.Group();
  const random = createSeededRandom(seed);
  const halfWidth = width / 2;
  const upright = 0.075;
  const frontZ = -(depth / 2 - 0.06);
  const backZ = depth / 2 - 0.31;
  const footHeight = 0.022;
  const uprightHeight = height - footHeight;
  const postX = halfWidth - upright / 2 - 0.002;
  const deckDepth = backZ - frontZ + 0.14;
  const deckCenterZ = (frontZ + backZ) / 2;
  // Three bays keep roughly half a metre of clear height: enough for a pallet
  // plus a carton on the bottom deck.
  const levels = [0.16, 0.8, height - 0.15];

  const steel = [];
  const frame = [];
  const decks = [];
  const decksAlt = [];
  const labels3d = [];

  for (const x of [-postX, postX]) {
    for (const z of [frontZ, backZ]) {
      steel.push(new THREE.BoxGeometry(upright, uprightHeight, upright)
        .translate(x, footHeight + uprightHeight / 2, z));
      steel.push(new THREE.BoxGeometry(0.17, footHeight, 0.17).translate(x, footHeight / 2, z));
      steel.push(new THREE.CylinderGeometry(0.028, 0.032, 0.02, 10).translate(x, 0.008, z));
      for (let i = 0; i < 4; i += 1) {
        steel.push(nailGeometry(x + (i < 2 ? -0.05 : 0.05), 0.36 + i * 0.32, z, { axis: "z", length: 0.009, radius: 0.007 }));
      }
    }
  }

  levels.forEach((levelY, index) => {
    for (const z of [frontZ, backZ]) {
      steel.push(new THREE.BoxGeometry(width - upright * 2 - 0.02, 0.09, 0.058).translate(0, levelY, z));
      steel.push(new THREE.BoxGeometry(width - upright * 2 - 0.02, 0.02, 0.1)
        .translate(0, levelY + 0.055, z + (z === frontZ ? -0.02 : 0.02)));
    }
    const board = new THREE.BoxGeometry(width - 0.16 - random() * 0.02, 0.032, deckDepth)
      .translate((random() - 0.5) * 0.012, levelY + 0.062, deckCenterZ + (random() - 0.5) * 0.01);
    (index % 2 === 0 ? decks : decksAlt).push(board);
  });

  const bayHeight = levels[levels.length - 1];
  steel.push(new THREE.BoxGeometry(width - 0.06, uprightHeight - 0.12, 0.02).translate(0, 0.08 + (uprightHeight - 0.12) / 2, backZ + 0.075));
  for (const x of [-width * 0.3, 0, width * 0.3]) {
    steel.push(new THREE.BoxGeometry(0.05, uprightHeight - 0.16, 0.03).translate(x, 0.08 + (uprightHeight - 0.16) / 2, backZ + 0.088));
  }
  for (const x of [-postX, postX]) {
    for (const direction of [-1, 1]) {
      const run = backZ - frontZ;
      const brace = Math.hypot(run, bayHeight - 0.16);
      const angle = Math.atan2(run, bayHeight - 0.16) * Math.sign(direction);
      const geometry = new THREE.BoxGeometry(0.048, brace, 0.026);
      geometry.rotateX(direction > 0 ? -angle : angle);
      geometry.translate(x, 0.16 + (bayHeight - 0.16) / 2, (frontZ + backZ) / 2);
      steel.push(geometry);
    }
  }

  const cartons = [];
  const cartonsAlt = [];
  const palletParts = [];
  const palletNails = [];
  const palletY = levels[0] + 0.078;
  for (const z of [-0.42, 0, 0.42]) {
    palletParts.push(new THREE.BoxGeometry(1.06, 0.022, 0.145).translate(0, palletY + 0.011, deckCenterZ + z * 0.5));
  }
  for (const x of [-0.44, 0, 0.44]) {
    palletParts.push(new THREE.BoxGeometry(0.13, 0.072, 1.0).translate(x, palletY + 0.042, deckCenterZ));
    for (const z of [-0.44, 0.44]) {
      palletNails.push(nailGeometry(x, palletY + 0.095, deckCenterZ + z * 0.5, { axis: "y", length: 0.01, radius: 0.007 }));
    }
  }
  palletParts.push(new THREE.BoxGeometry(1.06, 0.022, 0.145).translate(0, palletY + 0.081, deckCenterZ - 0.42));
  palletParts.push(new THREE.BoxGeometry(1.06, 0.022, 0.145).translate(0, palletY + 0.081, deckCenterZ + 0.42));

  const carton = (cartonWidth, cartonHeight, cartonDepth, x, deckTopY, z, rotation, alternate) => {
    const geometry = new RoundedBoxGeometry(cartonWidth, cartonHeight, cartonDepth, 2, 0.012);
    geometry.rotateY(rotation);
    geometry.translate(x, deckTopY + cartonHeight / 2, z);
    (alternate ? cartonsAlt : cartons).push(geometry);
  };
  const palletTopY = palletY + 0.092;
  const bayTops = [levels[0] + 0.078, levels[1] + 0.078, levels[2] + 0.078];
  carton(0.86, 0.4, 0.62, -0.12, palletTopY, deckCenterZ + 0.02, 0.05, false);
  carton(0.6, 0.34, 0.5, 0.74, bayTops[0], deckCenterZ + 0.04, -0.11, true);
  if (stocked === "crate") {
    carton(0.66, 0.38, 0.52, 0.52, bayTops[1], deckCenterZ + 0.04, -0.13, false);
  } else {
    carton(0.9, 0.44, 0.6, -0.5, bayTops[1], deckCenterZ - 0.02, 0.06, true);
    carton(0.68, 0.36, 0.52, 0.42, bayTops[1], deckCenterZ + 0.04, -0.13, false);
  }
  carton(0.7, 0.32, 0.48, 0.34, bayTops[2], deckCenterZ + 0.02, -0.05, true);

  for (const levelY of levels) {
    const label = new THREE.PlaneGeometry(0.44, 0.16);
    // The bay opens towards -Z, so the printed faces have to be turned around.
    label.rotateY(Math.PI);
    label.translate(0, levelY + 0.012, frontZ - 0.033);
    labels3d.push(label);
  }

  addMesh(group, "level-one-supply-shelf-frame", steel, materials.steel);
  addMesh(group, "level-one-supply-shelf-decks", decks, materials.deck);
  addMesh(group, "level-one-supply-shelf-decks-alt", decksAlt, materials.deckAlt);
  addMesh(group, "level-one-supply-shelf-pallet", palletParts, materials.deckAlt);
  addMesh(group, "level-one-supply-shelf-pallet-nails", palletNails, materials.nail);
  addMesh(group, "level-one-supply-shelf-cartons", cartons, materials.cardboard);
  addMesh(group, "level-one-supply-shelf-cartons-alt", cartonsAlt, materials.cardboardAlt);
  addMesh(
    group,
    "level-one-supply-shelf-labels",
    labels3d,
    labels === "rations" ? materials.labelRations : materials.labelSupply,
  );

  if (stocked === "crate") {
    const crate = buildDetailedSupplyCrate({
      materials,
      width: 0.8,
      height: 0.44,
      depth: 0.64,
      seed: seed + 17,
      tone: "dark",
      braced: true,
      stencil: "rations",
    });
    crate.name = `${group.name}-crate`;
    crate.position.set(-0.5, bayTops[1], deckCenterZ + 0.02);
    crate.rotation.y = 0.08;
    group.add(crate);
  }

  return group;
}
