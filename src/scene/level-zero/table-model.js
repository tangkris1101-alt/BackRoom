import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createGameMaterial } from "../common/materials.js";

// The content-expansion check builds tables in Node, where no canvas exists.
// Texture creation must degrade to plain colors there.
function canCreateCanvasTexture() {
  return typeof document !== "undefined" && typeof document.createElement === "function";
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createWoodTextures(baseColor) {
  if (!canCreateCanvasTexture()) return { map: null, bumpMap: null };
  const width = 512;
  const height = 256;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const base = new THREE.Color(baseColor);
  context.fillStyle = `#${base.getHexString()}`;
  context.fillRect(0, 0, width, height);
  const rng = mulberry32(baseColor ^ 0x9e3779b9);

  const drawGrain = (ctx, light, dark) => {
    for (let i = 0; i < 110; i++) {
      const y = rng() * height;
      const wobble = 2 + rng() * 7;
      ctx.strokeStyle = rng() > 0.5 ? light : dark;
      ctx.lineWidth = 0.6 + rng() * 1.8;
      ctx.beginPath();
      ctx.moveTo(-10, y);
      for (let x = 0; x <= width + 64; x += 64) {
        ctx.bezierCurveTo(
          x - 48, y + (rng() - 0.5) * wobble,
          x - 16, y + (rng() - 0.5) * wobble,
          x, y + (rng() - 0.5) * wobble,
        );
      }
      ctx.stroke();
    }
  };
  drawGrain(context, "rgba(214, 186, 140, 0.09)", "rgba(26, 17, 10, 0.12)");

  // Knots: concentric squashed ellipses with a dark core.
  for (let k = 0; k < 2; k++) {
    const cx = 60 + rng() * (width - 120);
    const cy = 40 + rng() * (height - 80);
    context.save();
    context.translate(cx, cy);
    context.scale(1, 0.42);
    for (let ring = 5; ring > 0; ring--) {
      context.strokeStyle = `rgba(24, 15, 8, ${0.05 + rng() * 0.06})`;
      context.lineWidth = 1.4 + rng() * 1.6;
      context.beginPath();
      context.arc(0, 0, ring * (4.5 + rng() * 2), 0, Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = "rgba(20, 12, 6, 0.5)";
    context.beginPath();
    context.arc(0, 0, 3.2, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  for (let i = 0; i < 1400; i++) {
    context.fillStyle = rng() > 0.5
      ? `rgba(255, 240, 210, ${0.02 + rng() * 0.03})`
      : `rgba(10, 6, 4, ${0.02 + rng() * 0.03})`;
    context.fillRect(rng() * width, rng() * height, 1.4, 1.4);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bumpContext = bumpCanvas.getContext("2d");
  bumpContext.fillStyle = "#7f7f7f";
  bumpContext.fillRect(0, 0, width, height);
  drawGrain(bumpContext, "rgba(255, 255, 255, 0.16)", "rgba(0, 0, 0, 0.2)");
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function createBrushedMetalTexture(baseColor) {
  if (!canCreateCanvasTexture()) return { map: null };
  const width = 128;
  const height = 256;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = `#${new THREE.Color(baseColor).getHexString()}`;
  context.fillRect(0, 0, width, height);
  const rng = mulberry32(baseColor ^ 0x51ab3c);
  for (let i = 0; i < 220; i++) {
    const x = rng() * width;
    context.strokeStyle = rng() > 0.45
      ? `rgba(226, 230, 218, ${0.04 + rng() * 0.1})`
      : `rgba(12, 13, 10, ${0.04 + rng() * 0.1})`;
    context.lineWidth = 0.5 + rng() * 1.1;
    context.beginPath();
    context.moveTo(x, -4);
    context.lineTo(x + (rng() - 0.5) * 5, height + 4);
    context.stroke();
  }
  // Scuffed, darker foot of the leg.
  const scuff = context.createLinearGradient(0, height * 0.8, 0, height);
  scuff.addColorStop(0, "rgba(8, 8, 6, 0)");
  scuff.addColorStop(1, "rgba(8, 8, 6, 0.42)");
  context.fillStyle = scuff;
  context.fillRect(0, height * 0.8, width, height * 0.2);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  return { map };
}

const PAPER_NOTE_LINES = [
  "Day 4. The lights hum at sixty hertz. It never stops.",
  "Carpet is damp. Wallpaper repeats every few hundred",
  "metres. Compass spins. Radios pick up nothing.",
  "",
  "Do NOT follow arrows scratched near the baseboards.",
  "Heard footsteps two rooms east. Nobody there.",
  "",
  "We left marker tape on the north pillar. By morning",
  "it was gone. If you find this, keep moving. Standing",
  "still is what it waits for.",
];

function createPaperTexture(tint) {
  if (!canCreateCanvasTexture()) return { map: null };
  const width = 512;
  const height = 384;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const rng = mulberry32(0x2b3a71);

  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#f0e9d2");
  gradient.addColorStop(1, `#${new THREE.Color(tint).getHexString()}`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  for (let i = 0; i < 900; i++) {
    context.fillStyle = rng() > 0.5
      ? `rgba(120, 100, 60, ${0.02 + rng() * 0.03})`
      : `rgba(255, 252, 240, ${0.03 + rng() * 0.04})`;
    context.fillRect(rng() * width, rng() * height, 1.3, 1.3);
  }

  context.fillStyle = "#38352c";
  context.font = "bold 29px \"Courier New\", monospace";
  context.fillText("M.E.G. FIELD NOTES", 34, 52);
  context.font = "16px \"Courier New\", monospace";
  context.fillStyle = "#565243";
  context.fillText("LEVEL 0 — EXPLORATION LOG", 36, 80);
  context.strokeStyle = "rgba(56, 53, 44, 0.75)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(34, 92);
  context.lineTo(width - 34, 92);
  context.stroke();

  context.font = "15px \"Courier New\", monospace";
  PAPER_NOTE_LINES.forEach((line, index) => {
    if (!line) return;
    const y = 122 + index * 23;
    context.fillStyle = `rgba(67, 64, 55, ${0.68 + rng() * 0.22})`;
    context.fillText(line, 36 + (rng() - 0.5) * 4, y);
    if (index === 4) {
      context.strokeStyle = "rgba(150, 40, 30, 0.8)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(30, y + 7);
      context.bezierCurveTo(150, y + 10, 320, y + 4, 470, y + 8);
      context.stroke();
    }
  });

  // Hand-drawn map doodle with an X marking a pillar.
  context.strokeStyle = "rgba(67, 64, 55, 0.6)";
  context.lineWidth = 1.4;
  context.strokeRect(width - 128, 118, 84, 64);
  context.beginPath();
  context.moveTo(width - 128, 150);
  context.lineTo(width - 44, 150);
  context.moveTo(width - 86, 118);
  context.lineTo(width - 86, 182);
  context.stroke();
  context.strokeStyle = "rgba(150, 40, 30, 0.85)";
  context.lineWidth = 2.4;
  context.beginPath();
  context.moveTo(width - 74, 138);
  context.lineTo(width - 56, 160);
  context.moveTo(width - 56, 138);
  context.lineTo(width - 74, 160);
  context.stroke();

  // Coffee ring with a couple of drips.
  context.strokeStyle = "rgba(122, 84, 38, 0.32)";
  context.lineWidth = 5.5;
  context.beginPath();
  context.arc(width - 108, height - 84, 34, 0.4, Math.PI * 2 + 0.2);
  context.stroke();
  context.strokeStyle = "rgba(122, 84, 38, 0.18)";
  context.lineWidth = 2.5;
  context.beginPath();
  context.arc(width - 106, height - 82, 28, 0.9, Math.PI * 1.7);
  context.stroke();
  context.fillStyle = "rgba(122, 84, 38, 0.25)";
  context.beginPath();
  context.arc(width - 68, height - 52, 3, 0, Math.PI * 2);
  context.arc(width - 58, height - 62, 2, 0, Math.PI * 2);
  context.fill();

  // Fold crease and darkened edges.
  const crease = context.createLinearGradient(width * 0.5 - 5, 0, width * 0.5 + 5, 0);
  crease.addColorStop(0, "rgba(70, 58, 34, 0)");
  crease.addColorStop(0.5, "rgba(70, 58, 34, 0.16)");
  crease.addColorStop(1, "rgba(70, 58, 34, 0)");
  context.fillStyle = crease;
  context.fillRect(width * 0.5 - 5, 0, 10, height);
  context.strokeStyle = "rgba(60, 50, 30, 0.16)";
  context.lineWidth = 3;
  context.strokeRect(1.5, 1.5, width - 3, height - 3);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return { map };
}

export function createTableAssetKit({ woodColor = 0x4b3a28, metalColor = 0x3b3b34, paperTint = 0xe3dac0 } = {}) {
  const wood = createWoodTextures(woodColor);
  const metal = createBrushedMetalTexture(metalColor);
  const paper = createPaperTexture(paperTint);
  return {
    materials: {
      woodTop: createGameMaterial(({ lowQuality }) => ({
        color: wood.map ? 0xffffff : woodColor,
        map: wood.map,
        roughness: 0.82,
        metalness: 0.02,
        ...(lowQuality || !wood.bumpMap ? {} : { bumpMap: wood.bumpMap, bumpScale: 0.5 }),
      })),
      woodTrim: createGameMaterial({
        color: new THREE.Color(woodColor).multiplyScalar(0.62),
        roughness: 0.88,
      }),
      metal: createGameMaterial({
        color: metal.map ? 0xffffff : metalColor,
        map: metal.map,
        roughness: 0.5,
        metalness: 0.62,
        flatShading: true,
      }),
      rubber: createGameMaterial({ color: 0x191917, roughness: 0.96 }),
      paperPlain: createGameMaterial({ color: 0xd9d0b2, roughness: 0.97 }),
      paperPrinted: createGameMaterial({
        color: paper.map ? 0xffffff : paperTint,
        map: paper.map,
        roughness: 0.95,
        side: THREE.DoubleSide,
      }),
    },
  };
}

// Merging needs a consistent index layout; non-indexed everywhere is simplest.
function mergeParts(geometries) {
  return mergeGeometries(geometries.map((geometry) => geometry.toNonIndexed()), false);
}

/**
 * High-detail table: rounded slab with wood grain, apron rails, tapered square
 * metal legs with collars, mounting plates, glide feet and an H-stretcher.
 * Origin is the floor at the table's centre; the top surface lands on
 * topCenterY + topThickness / 2 so gameplay colliders stay valid.
 */
export function buildDetailedTable(kit, { width, depth, topThickness, topCenterY, legX, legZ }) {
  const { materials } = kit;
  const group = new THREE.Group();
  const underside = topCenterY - topThickness / 2;

  const top = new THREE.Mesh(
    new RoundedBoxGeometry(width, topThickness, depth, 4, 0.024),
    materials.woodTop,
  );
  top.position.y = topCenterY;
  group.add(top);

  const apronHeight = 0.085;
  const apronY = underside - apronHeight / 2 + 0.006;
  const railX = legX - 0.075;
  const railZ = legZ - 0.075;
  const apronParts = [
    new THREE.BoxGeometry(railX * 2, apronHeight, 0.045).translate(0, apronY, railZ),
    new THREE.BoxGeometry(railX * 2, apronHeight, 0.045).translate(0, apronY, -railZ),
    new THREE.BoxGeometry(0.045, apronHeight, railZ * 2 - 0.09).translate(railX, apronY, 0),
    new THREE.BoxGeometry(0.045, apronHeight, railZ * 2 - 0.09).translate(-railX, apronY, 0),
  ];
  group.add(new THREE.Mesh(mergeParts(apronParts), materials.woodTrim));

  const metalParts = [];
  const rubberParts = [];
  const shaftTop = underside - 0.07;
  const shaftBottom = 0.05;
  const shaftHeight = shaftTop - shaftBottom;
  const shaftCenterY = (shaftTop + shaftBottom) / 2;
  for (const lx of [-legX, legX]) {
    for (const lz of [-legZ, legZ]) {
      metalParts.push(
        new THREE.BoxGeometry(0.13, 0.018, 0.13).translate(lx, underside - 0.009, lz),
        new THREE.CylinderGeometry(0.072, 0.062, 0.055, 4).rotateY(Math.PI / 4).translate(lx, underside - 0.0455, lz),
        new THREE.CylinderGeometry(0.06, 0.048, shaftHeight, 4).rotateY(Math.PI / 4).translate(lx, shaftCenterY, lz),
        new THREE.CylinderGeometry(0.013, 0.013, 0.05, 10).translate(lx, 0.035, lz),
      );
      rubberParts.push(
        new THREE.CylinderGeometry(0.05, 0.056, 0.02, 16).translate(lx, 0.01, lz),
      );
    }
  }
  metalParts.push(
    new THREE.BoxGeometry(legX * 2 - 0.07, 0.034, 0.022).translate(0, 0.17, legZ),
    new THREE.BoxGeometry(legX * 2 - 0.07, 0.034, 0.022).translate(0, 0.17, -legZ),
    new THREE.BoxGeometry(0.022, 0.034, legZ * 2 - 0.07).translate(0, 0.17, 0),
  );
  group.add(new THREE.Mesh(mergeParts(metalParts), materials.metal));
  group.add(new THREE.Mesh(mergeParts(rubberParts), materials.rubber));

  return group;
}

function createCurledSheetGeometry(width, depth, seed) {
  const rng = mulberry32(seed ^ 0xc411);
  const geometry = new THREE.PlaneGeometry(width, depth, 28, 20);
  const position = geometry.attributes.position;
  const flipU = rng() > 0.5;
  const flipV = rng() > 0.5;
  const phase = rng() * Math.PI * 2;
  for (let i = 0; i < position.count; i++) {
    const u = position.getX(i) / width + 0.5;
    const v = position.getY(i) / depth + 0.5;
    const du = flipU ? 1 - u : u;
    const dv = flipV ? 1 - v : v;
    // Soft pillow across the sheet plus a lifted, curling corner.
    let z = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.0032;
    const corner = Math.max(0, du - 0.66) * Math.max(0, dv - 0.6);
    z += corner * corner * 1.9;
    if (dv > 0.86) {
      z += Math.sin(u * Math.PI * 3 + phase) * 0.0018 * ((dv - 0.86) / 0.14);
    }
    position.setZ(i, z);
  }
  geometry.computeVertexNormals();
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export function buildPaperSheet(kit, { width = 0.5, depth = 0.36, seed = 1, printed = true } = {}) {
  return new THREE.Mesh(
    createCurledSheetGeometry(width, depth, seed),
    printed ? kit.materials.paperPrinted : kit.materials.paperPlain,
  );
}

export function buildPaperStack(kit, { width = 0.5, depth = 0.36, sheets = 4, seed = 1 } = {}) {
  const rng = mulberry32(seed ^ 0x51f3);
  const group = new THREE.Group();
  const underSheets = [];
  for (let i = 0; i < sheets; i++) {
    const sheet = new THREE.BoxGeometry(width * (0.965 + rng() * 0.03), 0.0015, depth * (0.965 + rng() * 0.03));
    sheet.rotateY((rng() - 0.5) * 0.09);
    sheet.translate((rng() - 0.5) * 0.012, 0.00195 + i * 0.0021, (rng() - 0.5) * 0.012);
    underSheets.push(sheet);
  }
  group.add(new THREE.Mesh(mergeParts(underSheets), kit.materials.paperPlain));
  const topSheet = buildPaperSheet(kit, { width, depth, seed });
  topSheet.position.y = 0.0012 + sheets * 0.0021;
  topSheet.rotation.y = (rng() - 0.5) * 0.05;
  group.add(topSheet);
  return group;
}
