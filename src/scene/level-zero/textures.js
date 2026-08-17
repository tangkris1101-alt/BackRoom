import * as THREE from "three";
import {
  makeTexture,
  createSeededRandom,
  drawSpeckles,
  clampColor,
  tileNoise,
  tileHash,
} from "../common/texture-utils.js";

const WALLPAPER_MOTIF_WIDTH = 34;
const WALLPAPER_MOTIF_HEIGHT = 38;

// Walks the wallpaper motif grid with a dedicated seeded random so the colour
// pass and the bump/roughness passes draw identical geometry. The callback
// receives the motif origin, its wobble and a deterministic print-strength
// factor so the stamp reads like unevenly printed stock instead of a uniform
// decal.
function forEachWallpaperMotif(size, callback) {
  const random = createSeededRandom(0x9071f5);
  let row = 0;
  for (let y = -WALLPAPER_MOTIF_HEIGHT; y < size + WALLPAPER_MOTIF_HEIGHT; y += WALLPAPER_MOTIF_HEIGHT) {
    let col = 0;
    for (let x = -WALLPAPER_MOTIF_WIDTH; x < size + WALLPAPER_MOTIF_WIDTH; x += WALLPAPER_MOTIF_WIDTH) {
      const wobble = (random() - 0.5) * 1.2;
      const strength = 0.55 + tileHash(col, row, 5.3) * 0.45;
      callback(x, y, wobble, strength);
      col += 1;
    }
    row += 1;
  }
}

function strokeWallpaperMotif(context, x, y, wobble) {
  context.beginPath();
  context.moveTo(x + 10 + wobble, y + 4);
  context.lineTo(x + 18 + wobble, y + 17);
  context.lineTo(x + 10 + wobble, y + 31);
  context.moveTo(x + 24 - wobble, y + 4);
  context.lineTo(x + 16 - wobble, y + 17);
  context.lineTo(x + 24 - wobble, y + 31);
  context.stroke();
}

export function createLevelZeroWallpaperTexture() {
  const random = createSeededRandom(0xbacc00);
  const texture = makeTexture(
    512,
    (context, size) => {
      const image = context.createImageData(size, size);
      const data = image.data;

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const i = (y * size + x) * 4;
          const seamBand = Math.sin(x * 0.045) * 2.2;
          const broad = (tileNoise(x, y, size, 4, 6.1) - 0.5) * 10;
          const paperNoise =
            (tileNoise(x, y, size, 18, 2.7) - 0.5) * 6 + (random() - 0.5) * 4;
          const agedEdge = Math.max(0, Math.abs(y / size - 0.5) - 0.36) * 5;
          data[i] = clampColor(222 + seamBand + broad + paperNoise - agedEdge);
          data[i + 1] = clampColor(214 + seamBand * 0.8 + broad + paperNoise - agedEdge);
          data[i + 2] = clampColor(153 + seamBand * 0.45 + broad * 0.6 + paperNoise * 0.55);
          data[i + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);

      let seamIndex = 0;
      for (let x = 0; x <= size; x += 74) {
        const seamAlpha = 0.05 + tileHash(seamIndex, 0, 8.9) * 0.05;
        context.fillStyle = `rgba(112,100,55,${seamAlpha})`;
        context.fillRect(x - 1, 0, 2, size);
        context.fillStyle = `rgba(245,235,174,${seamAlpha})`;
        context.fillRect(x + 2, 0, 1, size);
        seamIndex += 1;
      }

      context.lineWidth = 0.9;
      forEachWallpaperMotif(size, (x, y, wobble, strength) => {
        context.strokeStyle = `rgba(66,78,58,${0.2 * strength})`;
        strokeWallpaperMotif(context, x, y, wobble);

        context.fillStyle = `rgba(65,74,55,${0.14 * strength})`;
        context.fillRect(x + 16, y + 18, 1.2, 1.2);
      });

      // Broad, faint tonal drift in both directions so large wall areas never
      // read as flat repeats; kept well below stain visibility.
      for (let i = 0; i < 12; i += 1) {
        const pale = random() < 0.5;
        const spot = {
          x: random(),
          y: random(),
          rx: 0.1 + random() * 0.16,
          ry: 0.1 + random() * 0.16,
          angle: random() * Math.PI,
        };
        drawSoftEllipse(
          context,
          size,
          spot,
          pale
            ? `rgba(240,228,170,${0.018 + random() * 0.012})`
            : `rgba(118,104,58,${0.018 + random() * 0.012})`,
          "rgba(0,0,0,0)",
        );
      }

      drawSpeckles(context, size, 300, 0.07, "76,68,38", random);
      drawSpeckles(context, size, 110, 0.06, "238,226,169", random);
    },
    1.85,
    1.05,
  );

  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

// Greyscale detail maps for the wallpaper, mirroring the carpet detail maps.
// Both stay linear (NoColorSpace) and share the colour map's repeat and
// ClampToEdge vertical wrap so paper grain, motif emboss and seam dents line
// up exactly with what is visible.
export function createLevelZeroWallpaperDetailMaps() {
  const bumpRandom = createSeededRandom(0xba11f1);
  const bumpMap = makeTexture(
    512,
    (context, size) => {
      const image = context.createImageData(size, size);
      const data = image.data;

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const i = (y * size + x) * 4;
          const mid = (tileNoise(x, y, size, 18, 2.7) - 0.5) * 12;
          const fine = (bumpRandom() - 0.5) * 36;
          const height = clampColor(128 + mid + fine);
          data[i] = height;
          data[i + 1] = height;
          data[i + 2] = height;
          data[i + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);

      // Printed ink sits a hair proud of the paper.
      context.strokeStyle = "rgba(255,255,255,0.16)";
      context.lineWidth = 0.9;
      forEachWallpaperMotif(size, (x, y, wobble) => {
        strokeWallpaperMotif(context, x, y, wobble);
      });

      // Seams sit slightly recessed.
      context.fillStyle = "rgba(70,70,70,0.35)";
      for (let x = 0; x <= size; x += 74) {
        context.fillRect(x - 1, 0, 2, size);
      }
    },
    1.85,
    1.05,
  );
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;

  const roughRandom = createSeededRandom(0x09c3a7);
  const roughnessMap = makeTexture(
    512,
    (context, size) => {
      const image = context.createImageData(size, size);
      const data = image.data;

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const i = (y * size + x) * 4;
          const broad = (tileNoise(x, y, size, 4, 3.4) - 0.5) * 28;
          const fine = (roughRandom() - 0.5) * 8;
          const value = clampColor(235 + broad + fine);
          data[i] = value;
          data[i + 1] = value;
          data[i + 2] = value;
          data[i + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);

      // Ink is a touch smoother than the paper around it.
      context.strokeStyle = "rgba(190,190,190,0.22)";
      context.lineWidth = 0.9;
      forEachWallpaperMotif(size, (x, y, wobble) => {
        strokeWallpaperMotif(context, x, y, wobble);
      });

      // Seam ridges catch light a little rougher.
      context.fillStyle = "rgba(255,255,255,0.18)";
      for (let x = 0; x <= size; x += 74) {
        context.fillRect(x - 1, 0, 2, size);
      }
    },
    1.85,
    1.05,
  );
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.wrapT = THREE.ClampToEdgeWrapping;

  return { bumpMap, roughnessMap };
}

// The Level 0 floor is 180x156 metres (45x39 cells x CELL_SIZE 4). These
// repeats make one 512px tile cover ~3x3 metres (~170px/m), so fibre strokes,
// footprints and pile rows land at real carpet scale instead of being
// stretched into invisible blurs.
const CARPET_REPEAT_X = 60;
const CARPET_REPEAT_Y = 52;

// Deterministic traffic-wear layout shared by the colour map and the detail
// maps so compaction, footprints and roughness changes line up exactly.
function createCarpetWearLayout() {
  const random = createSeededRandom(0x5a17c9);
  const lanes = [];
  const footprints = [];
  for (let lane = 0; lane < 3; lane += 1) {
    const pads = [];
    let x = random();
    let y = random();
    let angle = random() * Math.PI * 2;
    const padCount = 9 + Math.floor(random() * 4);
    for (let i = 0; i < padCount; i += 1) {
      angle += (random() - 0.5) * 0.7;
      x += Math.cos(angle) * (0.06 + random() * 0.05);
      y += Math.sin(angle) * (0.06 + random() * 0.05);
      const pad = {
        x,
        y,
        rx: 0.05 + random() * 0.045,
        ry: 0.035 + random() * 0.03,
        angle,
        strength: 0.6 + random() * 0.4,
      };
      if (i > 0 && random() > 0.6) {
        const prev = pads[i - 1];
        const side = (i % 2 === 0 ? 1 : -1) * 0.018;
        footprints.push({
          x: (prev.x + pad.x) / 2 + Math.cos(angle + Math.PI / 2) * side,
          y: (prev.y + pad.y) / 2 + Math.sin(angle + Math.PI / 2) * side,
          rx: 0.014 + random() * 0.006,
          ry: 0.038 + random() * 0.012,
          angle,
          strength: 0.5 + random() * 0.5,
        });
      }
      pads.push(pad);
    }
    lanes.push(pads);
  }
  return { lanes, footprints };
}

// Draws a soft-edged ellipse. Spots may sit outside the 0..1 tile, so the
// ellipse is repeated at neighbouring tile offsets to keep the wrap seamless.
function drawSoftEllipse(context, size, spot, inner, outer) {
  for (let ox = -1; ox <= 1; ox += 1) {
    for (let oy = -1; oy <= 1; oy += 1) {
      context.save();
      context.translate((spot.x + ox) * size, (spot.y + oy) * size);
      context.rotate(spot.angle);
      context.scale(Math.max(spot.rx * size, 0.5), Math.max(spot.ry * size, 0.5));
      const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
      gradient.addColorStop(0, inner);
      gradient.addColorStop(1, outer);
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(0, 0, 1, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }
}

function drawCarpetWear(context, size, layout, laneColor, printColor) {
  for (const lane of layout.lanes) {
    for (const pad of lane) {
      drawSoftEllipse(context, size, pad, laneColor(pad.strength), laneColor(0));
    }
  }
  for (const print of layout.footprints) {
    drawSoftEllipse(context, size, print, printColor(print.strength), printColor(0));
  }
}

export function createLevelZeroCarpetTexture() {
  const random = createSeededRandom(0xca9f04);
  const layout = createCarpetWearLayout();
  return makeTexture(
    512,
    (context, size) => {
      const image = context.createImageData(size, size);
      const data = image.data;

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const i = (y * size + x) * 4;
          const u = x / size;
          const v = y / size;
          const broad = (tileNoise(x, y, size, 4, 4.1) - 0.5) * 12;
          const mid = (tileNoise(x, y, size, 11, 8.7) - 0.5) * 7;
          const fine = (random() - 0.5) * 6;
          const pile =
            Math.sin(Math.PI * 2 * (u * 18 + v * 2)) * 0.55 +
            Math.sin(Math.PI * 2 * (u * 7 - v * 3)) * 0.45;
          const wear = broad + mid + fine + pile;
          data[i] = clampColor(185 + wear);
          data[i + 1] = clampColor(165 + wear * 0.78);
          data[i + 2] = clampColor(120 + wear * 0.5);
          data[i + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);

      // Broad, faint tonal drift so large areas never read as a flat fill.
      for (let i = 0; i < 10; i += 1) {
        const pale = random() < 0.5;
        const spot = {
          x: random(),
          y: random(),
          rx: 0.12 + random() * 0.2,
          ry: 0.12 + random() * 0.2,
          angle: random() * Math.PI,
        };
        drawSoftEllipse(
          context,
          size,
          spot,
          pale
            ? `rgba(228,210,152,${0.025 + random() * 0.015})`
            : `rgba(118,106,72,${0.02 + random() * 0.015})`,
          "rgba(0,0,0,0)",
        );
      }

      // Trod-down traffic lanes and faint footprints, kept deliberately weak.
      drawCarpetWear(
        context,
        size,
        layout,
        (strength) => `rgba(94,80,46,${0.07 * strength})`,
        (strength) => `rgba(88,74,44,${0.08 * strength})`,
      );

      context.globalAlpha = 0.028;
      for (let y = 0; y < size; y += 5) {
        const offset = Math.sin((y / size) * Math.PI * 2 * 4) * 0.8;
        context.strokeStyle = y % 10 === 0 ? "#8b774e" : "#ddc48c";
        context.lineWidth = 0.55;
        context.beginPath();
        context.moveTo(0, y + offset);
        context.lineTo(size, y + offset);
        context.stroke();
      }
      context.globalAlpha = 1;

      // Short fibre strokes: the close-range carpet grain.
      const fiberRandom = createSeededRandom(0xf1be09);
      context.lineWidth = 0.6;
      for (let i = 0; i < 4600; i += 1) {
        const x = fiberRandom() * size;
        const y = fiberRandom() * size;
        const length = 1 + fiberRandom() * 1.6;
        const angle =
          (fiberRandom() - 0.5) * 0.9 + (fiberRandom() < 0.72 ? 0 : Math.PI / 2);
        const alpha = 0.03 + fiberRandom() * 0.04;
        context.strokeStyle =
          fiberRandom() < 0.45
            ? `rgba(233,216,164,${alpha})`
            : `rgba(74,60,34,${alpha})`;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
        context.stroke();
      }

      drawSpeckles(context, size, 1200, 0.05, "72,58,32", random);
      drawSpeckles(context, size, 550, 0.05, "234,220,170", random);
    },
    CARPET_REPEAT_X,
    CARPET_REPEAT_Y,
  );
}

// Greyscale data maps for the carpet. Both stay linear (NoColorSpace); the
// wear layout matches the colour map so trod-down spots align across maps.
export function createLevelZeroCarpetDetailMaps() {
  const layout = createCarpetWearLayout();
  const bumpRandom = createSeededRandom(0xca9f04);
  const bumpMap = makeTexture(
    512,
    (context, size) => {
      const image = context.createImageData(size, size);
      const data = image.data;

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const i = (y * size + x) * 4;
          const u = x / size;
          const v = y / size;
          const mid = (tileNoise(x, y, size, 11, 8.7) - 0.5) * 16;
          const fine = (bumpRandom() - 0.5) * 44;
          const pile =
            Math.sin(Math.PI * 2 * (u * 18 + v * 2)) * 6 +
            Math.sin(Math.PI * 2 * (u * 7 - v * 3)) * 4;
          const height = clampColor(128 + mid + fine + pile);
          data[i] = height;
          data[i + 1] = height;
          data[i + 2] = height;
          data[i + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);

      // Compacted pile sits slightly lower.
      drawCarpetWear(
        context,
        size,
        layout,
        (strength) => `rgba(70,70,70,${0.28 * strength})`,
        (strength) => `rgba(60,60,60,${0.34 * strength})`,
      );
    },
    CARPET_REPEAT_X,
    CARPET_REPEAT_Y,
  );
  bumpMap.colorSpace = THREE.NoColorSpace;

  const roughRandom = createSeededRandom(0x9c41d2);
  const roughnessMap = makeTexture(
    512,
    (context, size) => {
      const image = context.createImageData(size, size);
      const data = image.data;

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const i = (y * size + x) * 4;
          const mid = (tileNoise(x, y, size, 11, 8.7) - 0.5) * 14;
          const fine = (roughRandom() - 0.5) * 10;
          const value = clampColor(245 + mid + fine);
          data[i] = value;
          data[i + 1] = value;
          data[i + 2] = value;
          data[i + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);

      // Trod-down fibres are a touch smoother.
      drawCarpetWear(
        context,
        size,
        layout,
        (strength) => `rgba(170,170,170,${0.3 * strength})`,
        (strength) => `rgba(160,160,160,${0.36 * strength})`,
      );
    },
    CARPET_REPEAT_X,
    CARPET_REPEAT_Y,
  );
  roughnessMap.colorSpace = THREE.NoColorSpace;

  return { bumpMap, roughnessMap };
}

export function createLevelZeroCeilingTexture() {
  const random = createSeededRandom(0xce1119);
  return makeTexture(
    512,
    (context, size) => {
      context.fillStyle = "#d6cfaa";
      context.fillRect(0, 0, size, size);

      const shade = context.createLinearGradient(0, 0, size, size);
      shade.addColorStop(0, "rgba(255,250,224,0.12)");
      shade.addColorStop(1, "rgba(105,99,68,0.1)");
      context.fillStyle = shade;
      context.fillRect(0, 0, size, size);

      context.strokeStyle = "rgba(85,82,58,0.24)";
      context.lineWidth = 5;
      context.strokeRect(0, 0, size, size);
      context.strokeStyle = "rgba(245,239,200,0.12)";
      context.lineWidth = 1.5;
      context.strokeRect(9, 9, size - 18, size - 18);

      for (let i = 0; i < 7; i += 1) {
        const x = random() * size;
        const y = random() * size;
        const radius = 26 + random() * 58;
        const grd = context.createRadialGradient(x, y, 0, x, y, radius);
        grd.addColorStop(0, "rgba(92,80,43,0.065)");
        grd.addColorStop(1, "rgba(92,80,43,0)");
        context.fillStyle = grd;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }

      drawSpeckles(context, size, 1500, 0.08, "91,86,58", random);
      drawSpeckles(context, size, 260, 0.05, "238,231,190", random);
    },
    20,
    18,
  );
}

export function createManilaWallpaperTexture() {
  return makeTexture(
    512,
    (context, size) => {
      context.fillStyle = "#bca989";
      context.fillRect(0, 0, size, size);

      for (let x = 0; x <= size; x += 76) {
        context.fillStyle = "rgba(91, 76, 54, 0.12)";
        context.fillRect(x, 0, 2, size);
        context.fillStyle = "rgba(241, 228, 198, 0.1)";
        context.fillRect(x + 3, 0, 1, size);
      }

      context.strokeStyle = "rgba(104, 86, 62, 0.09)";
      context.lineWidth = 1.2;
      for (let y = 34; y < size; y += 64) {
        for (let x = 38; x < size; x += 76) {
          context.beginPath();
          context.arc(x, y, 17, 0, Math.PI * 2);
          context.stroke();
          context.beginPath();
          context.arc(x, y, 7, 0, Math.PI * 2);
          context.stroke();
        }
      }

      const age = context.createLinearGradient(0, size, 0, size * 0.52);
      age.addColorStop(0, "rgba(73, 58, 42, 0.2)");
      age.addColorStop(1, "rgba(73, 58, 42, 0)");
      context.fillStyle = age;
      context.fillRect(0, size * 0.5, size, size * 0.5);
      drawSpeckles(context, size, 210, 0.08, "76,62,43");
    },
    1.42,
    1.05,
  );
}

