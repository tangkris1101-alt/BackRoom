import { createSeededRandom, makeTexture, drawSpeckles, clampColor, tileNoise } from "../common/texture-utils.js";

export function createLevelTwoGrimyTexture(seed, repeatX, repeatY, base, rust = 1) {
  const random = createSeededRandom(seed);
  return makeTexture(
    512,
    (context, size) => {
      const image = context.createImageData(size, size);
      const data = image.data;

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const i = (y * size + x) * 4;
          const grime = (tileNoise(x, y, size, 5, seed * 0.021) - 0.5) * 36;
          const soot = Math.max(0, tileNoise(x, y, size, 11, seed * 0.047) - 0.58) * -46;
          const heat = Math.max(0, tileNoise(x, y, size, 8, seed * 0.091) - 0.68) * 28 * rust;
          const fine = (random() - 0.5) * 10;
          data[i] = clampColor(base[0] + grime + soot + heat + fine);
          data[i + 1] = clampColor(base[1] + grime * 0.84 + soot * 0.72 + heat * 0.42 + fine);
          data[i + 2] = clampColor(base[2] + grime * 0.58 + soot * 0.62 + heat * 0.18 + fine * 0.7);
          data[i + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);

      const isWall = seed === 0x2f2003;
      const isCeiling = seed === 0x2f2004;
      if (isWall) {
        context.globalAlpha = 0.24;
        for (let i = 0; i < 18; i += 1) {
          const x = random() * size;
          const y = random() * size * 0.38;
          const length = 70 + random() * 210;
          const width = 4 + random() * 12;
          const gradient = context.createLinearGradient(x, y, x, y + length);
          gradient.addColorStop(0, "rgba(124,63,25,0.52)");
          gradient.addColorStop(1, "rgba(124,63,25,0)");
          context.fillStyle = gradient;
          context.fillRect(x, y, width, length);
        }
        context.globalAlpha = 1;
      } else if (isCeiling) {
        context.strokeStyle = "rgba(7,8,7,0.34)";
        context.lineWidth = 3;
        for (let y = 24; y < size; y += 76) {
          context.beginPath();
          context.moveTo(0, y);
          context.lineTo(size, y + (random() - 0.5) * 14);
          context.stroke();
        }
      }

      context.globalAlpha = 0.18;
      context.strokeStyle = "#15140f";
      context.lineWidth = 1.3;
      for (let i = 0; i < 28; i += 1) {
        const x = random() * size;
        const y = random() * size;
        const length = 24 + random() * 120;
        const angle = random() * Math.PI;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
        context.stroke();
      }
      context.globalAlpha = 1;

      for (let x = 0; x <= size; x += 86) {
        context.fillStyle = "rgba(28,24,18,0.18)";
        context.fillRect(x - 1, 0, 2, size);
      }

      drawSpeckles(context, size, 980, 0.1, "13,12,9", random);
      drawSpeckles(context, size, 210, 0.08, "173,104,50", random);
    },
    repeatX,
    repeatY,
  );
}

export function createLevelTwoFloorTexture() {
  const random = createSeededRandom(0x2f2002);
  return makeTexture(
    512,
    (context, size) => {
      context.fillStyle = "#3d3d30";
      context.fillRect(0, 0, size, size);

      for (let y = 0; y < size; y += 1) {
        const shade = 0.05 + Math.sin(y * 0.08) * 0.018;
        context.fillStyle = `rgba(0,0,0,${shade})`;
        context.fillRect(0, y, size, 1);
      }

      context.strokeStyle = "rgba(15,14,10,0.46)";
      context.lineWidth = 2;
      for (let x = 0; x <= size; x += 64) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, size);
        context.stroke();
      }
      for (let y = 0; y <= size; y += 96) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(size, y);
        context.stroke();
      }

      context.globalAlpha = 0.2;
      context.strokeStyle = "#b15d2d";
      context.lineWidth = 2.2;
      for (let i = 0; i < 16; i += 1) {
        const y = random() * size;
        context.beginPath();
        context.moveTo(random() * 80, y);
        context.lineTo(size - random() * 80, y + (random() - 0.5) * 18);
        context.stroke();
      }
      context.globalAlpha = 1;

      context.globalAlpha = 0.22;
      context.fillStyle = "#0d0d0a";
      for (let y = 44; y < size; y += 132) {
        context.fillRect(0, y, size, 18);
        context.fillStyle = "#7b4a24";
        for (let x = 0; x < size; x += 42) {
          context.fillRect(x, y, 22, 18);
        }
        context.fillStyle = "#0d0d0a";
      }
      context.globalAlpha = 1;

      drawSpeckles(context, size, 1050, 0.1, "12,12,9", random);
      drawSpeckles(context, size, 360, 0.12, "153,92,43", random);
    },
    11,
    9,
  );
}

export function createLevelTwoWallTexture() {
  return createLevelTwoGrimyTexture(0x2f2003, 2.4, 1.1, [84, 78, 61], 1.15);
}

export function createLevelTwoCeilingTexture() {
  return createLevelTwoGrimyTexture(0x2f2004, 8, 6, [56, 54, 44], 0.8);
}

