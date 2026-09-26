import * as THREE from "three";
import { createGameMaterial } from "../common/materials.js";
import { clampColor, createSeededRandom, drawSpeckles } from "../common/texture-utils.js";

// One texture tile covers this much pipe, so painted couplings repeat at a
// believable joint spacing instead of stretching across a whole run.
export const PIPE_TILE_METERS = 2.4;
export const PIPE_RADIUS = 0.125;

// Node-side checks build Level 1 without a canvas: fall back to flat colours.
function canCreateCanvasTexture() {
  return typeof document !== "undefined" && typeof document.createElement === "function";
}

function createCanvasTexture(size, draw, { colorSpace = THREE.SRGBColorSpace } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  draw(context, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = colorSpace;
  texture.anisotropy = 6;
  return texture;
}

/**
 * Galvanised steel service pipe: a longitudinal weld along one side, socket
 * couplings with bolts every half tile, a painted marker band and water tag,
 * rust bleeding out of the joints and pitting across the barrel. The pattern is
 * deliberately orientation-free because each run is rotated onto a different
 * world axis.
 */
export function createLevelOnePipeMaps({ seed = 0x50495045 } = {}) {
  if (!canCreateCanvasTexture()) return { map: null, bumpMap: null };
  const size = 512;
  const seamX = size * 0.27;
  const couplingCenters = [size * 0.08, size * 0.58];
  const markerY = size * 0.33;

  const drawStreaks = (context, random, light, dark, count) => {
    for (let i = 0; i < count; i += 1) {
      const x = random() * size;
      context.strokeStyle = random() > 0.5
        ? `rgba(${light}, ${0.05 + random() * 0.1})`
        : `rgba(${dark}, ${0.05 + random() * 0.1})`;
      context.lineWidth = 0.5 + random() * 1.4;
      context.beginPath();
      context.moveTo(x, -4);
      context.lineTo(x + (random() - 0.5) * 6, size + 4);
      context.stroke();
    }
  };

  const drawRustBlotches = (context, random, count, centreY, spreadY, alpha) => {
    for (let i = 0; i < count; i += 1) {
      const x = random() * size;
      const y = centreY + (random() - 0.5) * spreadY;
      const radius = 4 + random() * 22;
      const gradient = context.createRadialGradient(x, y, radius * 0.15, x, y, radius);
      gradient.addColorStop(0, `rgba(122, 70, 32, ${alpha * (0.5 + random() * 0.5)})`);
      gradient.addColorStop(1, "rgba(122, 70, 32, 0)");
      context.fillStyle = gradient;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
  };

  // Water running down a pipe drags rust along the barrel, which reads as
  // lengthwise streaks because the tile's V axis follows the run.
  const drawDripStreaks = (context, random, count) => {
    for (let i = 0; i < count; i += 1) {
      const x = random() * size;
      const length = 40 + random() * 150;
      const y = random() * size;
      const gradient = context.createLinearGradient(0, y, 0, y + length);
      gradient.addColorStop(0, `rgba(112, 64, 28, ${0.16 + random() * 0.22})`);
      gradient.addColorStop(1, "rgba(112, 64, 28, 0)");
      context.fillStyle = gradient;
      context.fillRect(x, y, 1.5 + random() * 4, length);
    }
  };

  const drawCouplings = (context, random, { metallic, dark, light }) => {
    for (const centre of couplingCenters) {
      const height = 30;
      const top = centre - height / 2;
      context.fillStyle = metallic;
      context.fillRect(0, top, size, height);
      drawStreaks(context, random, light, dark, 90);
      context.strokeStyle = dark;
      context.lineWidth = 2.4;
      context.beginPath();
      context.moveTo(0, top + 1.2);
      context.lineTo(size, top + 1.2);
      context.moveTo(0, top + height - 1.2);
      context.lineTo(size, top + height - 1.2);
      context.stroke();
      // Six bolts around the socket.
      for (let bolt = 0; bolt < 6; bolt += 1) {
        const x = size * (0.06 + bolt / 6) + (random() - 0.5) * 6;
        context.fillStyle = "rgba(72, 84, 76, 0.75)";
        context.beginPath();
        context.arc(x, centre, 3.4, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "rgba(238, 244, 236, 0.4)";
        context.beginPath();
        context.arc(x - 0.9, centre - 0.9, 1.5, 0, Math.PI * 2);
        context.fill();
      }
      // Rust creeps out from under the sockets.
      drawRustBlotches(context, random, 26, centre - height * 0.6, 46, 0.5);
      drawRustBlotches(context, random, 26, centre + height * 0.6, 46, 0.5);
    }
  };

  const drawWaterTag = (context, random, { plate, ink }) => {
    const width = 168;
    const height = 54;
    const x = size * 0.6;
    const y = size * 0.18;
    context.fillStyle = plate;
    context.fillRect(x, y, width, height);
    context.strokeStyle = "rgba(226, 236, 222, 0.55)";
    context.lineWidth = 2;
    context.strokeRect(x + 2, y + 2, width - 4, height - 4);
    context.fillStyle = ink;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "bold 26px Arial, sans-serif";
    context.fillText("WATER", x + width / 2, y + 21);
    context.font = "600 15px Arial, sans-serif";
    context.fillText("DN125 · COLD LOOP", x + width / 2, y + 40);
    // Scrubbed and stained like every other marking in the level.
    for (let i = 0; i < 60; i += 1) {
      context.fillStyle = `rgba(154, 160, 148, ${0.1 + random() * 0.3})`;
      context.fillRect(x + random() * width, y + random() * height, 1 + random() * 5, 1 + random() * 3);
    }
  };

  const map = createCanvasTexture(size, (context) => {
    const random = createSeededRandom(seed);
    // Base tone deliberately sits a little under the flat colour this material
    // replaced (0x9ab7aa): the brushed highlights drawn on top average it back
    // up, so the run keeps the level's muted tone instead of reading as mint.
    context.fillStyle = "#8ea79b";
    context.fillRect(0, 0, size, size);
    drawStreaks(context, random, "238, 244, 236", "46, 58, 50", 220);

    // Longitudinal weld: a raised bead with its heat-tint halo.
    const seam = context.createLinearGradient(seamX - 16, 0, seamX + 16, 0);
    seam.addColorStop(0, "rgba(120, 132, 122, 0)");
    seam.addColorStop(0.45, "rgba(128, 140, 128, 0.45)");
    seam.addColorStop(0.55, "rgba(128, 140, 128, 0.45)");
    seam.addColorStop(1, "rgba(120, 132, 122, 0)");
    context.fillStyle = seam;
    context.fillRect(seamX - 16, 0, 32, size);
    context.fillStyle = "rgba(226, 234, 222, 0.4)";
    context.fillRect(seamX - 1.6, 0, 3.2, size);
    for (let i = 0; i < 150; i += 1) {
      context.fillStyle = `rgba(92, 104, 94, ${0.1 + random() * 0.2})`;
      context.beginPath();
      context.arc(seamX + (random() - 0.5) * 26, random() * size, 1 + random() * 2.6, 0, Math.PI * 2);
      context.fill();
    }

    drawCouplings(context, random, { metallic: "#94a89b", dark: "rgba(52, 64, 56, 0.72)", light: "236, 242, 234" });

    // Painted marker band next to the couplings.
    context.fillStyle = "rgba(196, 158, 62, 0.85)";
    context.fillRect(0, markerY, size, 20);
    context.strokeStyle = "rgba(96, 70, 24, 0.6)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, markerY + 1);
    context.lineTo(size, markerY + 1);
    context.moveTo(0, markerY + 19);
    context.lineTo(size, markerY + 19);
    context.stroke();
    drawDripStreaks(context, random, 26);

    drawWaterTag(context, random, { plate: "#3d4b3f", ink: "#dbe8cf" });

    // Wear across the barrel, then grime and pitting.
    for (let i = 0; i < 40; i += 1) {
      const x = random() * size;
      const y = random() * size;
      context.strokeStyle = `rgba(216, 224, 210, ${0.08 + random() * 0.18})`;
      context.lineWidth = 0.8 + random() * 1.6;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + (random() - 0.5) * 30, y + (random() - 0.5) * 8);
      context.stroke();
    }
    drawRustBlotches(context, random, 46, size * 0.5, size, 0.34);
    drawRustBlotches(context, random, 30, size * 0.5, size, 0.22);
    drawSpeckles(context, size, 900, 0.09, "42, 52, 46", random);
    drawSpeckles(context, size, 420, 0.07, "236, 242, 230", random);
  });

  const bumpMap = createCanvasTexture(size, (context) => {
    const random = createSeededRandom(seed);
    context.fillStyle = "#8a8a8a";
    context.fillRect(0, 0, size, size);
    drawStreaks(context, random, "255,255,255", "20,20,20", 320);
    // Raised weld bead and sockets, grooved at their edges.
    context.fillStyle = "#e8e8e8";
    context.fillRect(seamX - 5, 0, 10, size);
    context.fillStyle = "#3c3c3c";
    context.fillRect(seamX - 8, 0, 3, size);
    context.fillRect(seamX + 5, 0, 3, size);
    for (const centre of couplingCenters) {
      const top = centre - 15;
      context.fillStyle = "#f2f2f2";
      context.fillRect(0, top, size, 30);
      context.fillStyle = "#2e2e2e";
      context.fillRect(0, top - 3, size, 3);
      context.fillRect(0, top + 30, size, 3);
      for (let bolt = 0; bolt < 6; bolt += 1) {
        const x = size * (0.06 + bolt / 6);
        context.fillStyle = "#ffffff";
        context.beginPath();
        context.arc(x, centre, 3.4, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.fillStyle = "#d8d8d8";
    context.fillRect(size * 0.6, size * 0.18, 168, 54);
    for (let i = 0; i < 500; i += 1) {
      const x = random() * size;
      const y = random() * size;
      context.fillStyle = `rgba(0, 0, 0, ${0.12 + random() * 0.3})`;
      context.fillRect(x, y, 1 + random() * 3, 1 + random() * 3);
    }
  }, { colorSpace: THREE.NoColorSpace });

  return { map, bumpMap };
}

export function createLevelOnePipeMaterial(maps, {
  // Galvanised steel reads mostly diffuse under the level's dim fixtures: the
  // previous high metalness had no environment map to reflect, so the run came
  // out flat and self-lit. Keep the metal modest so the fixture lights and the
  // baked light field both shape it along its length, and leave only a faint
  // emissive floor so dark zones do not swallow it entirely.
  emissive = 0x2b3a33,
  emissiveIntensity = 0.12,
} = {}) {
  return createGameMaterial(({ lowQuality }) => ({
    map: maps.map,
    color: maps.map ? 0xffffff : 0x9ab7aa,
    roughness: 0.58,
    metalness: 0.34,
    emissive,
    emissiveIntensity,
    ...(lowQuality || !maps.bumpMap ? {} : { bumpMap: maps.bumpMap, bumpScale: 0.05 }),
  }));
}

/** Stretch the tile along the run so couplings repeat every half tile. */
export function applyPipeRunUv(geometry, length) {
  const uv = geometry.getAttribute("uv");
  const repeat = Math.max(1, Math.round(length / PIPE_TILE_METERS));
  for (let i = 0; i < uv.count; i += 1) {
    uv.setY(i, uv.getY(i) * repeat);
  }
  uv.needsUpdate = true;
  return geometry;
}
