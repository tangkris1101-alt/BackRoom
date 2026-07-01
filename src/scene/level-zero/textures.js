import * as THREE from "three";
import { createSeededRandom, makeTexture, drawSpeckles, clampColor, tileNoise } from "../common/texture-utils.js";

// Level 0 专用纹理（精细版，带 seeded random 和程序化噪声）。

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
          const paperNoise =
            (tileNoise(x, y, size, 18, 2.7) - 0.5) * 6 + (random() - 0.5) * 4;
          const agedEdge = Math.max(0, Math.abs(y / size - 0.5) - 0.36) * 5;
          data[i] = clampColor(222 + seamBand + paperNoise - agedEdge);
          data[i + 1] = clampColor(214 + seamBand * 0.8 + paperNoise - agedEdge);
          data[i + 2] = clampColor(153 + seamBand * 0.45 + paperNoise * 0.55);
          data[i + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);

      for (let x = 0; x <= size; x += 74) {
        context.fillStyle = "rgba(112,100,55,0.08)";
        context.fillRect(x - 1, 0, 2, size);
        context.fillStyle = "rgba(245,235,174,0.08)";
        context.fillRect(x + 2, 0, 1, size);
      }

      context.strokeStyle = "rgba(66,78,58,0.2)";
      context.lineWidth = 0.9;
      const motifWidth = 34;
      const motifHeight = 38;
      for (let y = -motifHeight; y < size + motifHeight; y += motifHeight) {
        for (let x = -motifWidth; x < size + motifWidth; x += motifWidth) {
          const wobble = (random() - 0.5) * 1.2;
          context.beginPath();
          context.moveTo(x + 10 + wobble, y + 4);
          context.lineTo(x + 18 + wobble, y + 17);
          context.lineTo(x + 10 + wobble, y + 31);
          context.moveTo(x + 24 - wobble, y + 4);
          context.lineTo(x + 16 - wobble, y + 17);
          context.lineTo(x + 24 - wobble, y + 31);
          context.stroke();

          context.fillStyle = "rgba(65,74,55,0.14)";
          context.fillRect(x + 16, y + 18, 1.2, 1.2);
        }
      }

      for (let i = 0; i < 12; i += 1) {
        const x = random() * size;
        const y = random() * size;
        const radius = 18 + random() * 48;
        const stain = context.createRadialGradient(x, y, 0, x, y, radius);
        stain.addColorStop(0, "rgba(96,82,44,0.035)");
        stain.addColorStop(1, "rgba(96,82,44,0)");
        context.fillStyle = stain;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
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

export function createLevelZeroCarpetTexture() {
  const random = createSeededRandom(0xca9f04);
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
          const fine = (random() - 0.5) * 4;
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
      drawSpeckles(context, size, 1500, 0.055, "72,58,32", random);
    },
    7.5,
    7.5,
  );
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