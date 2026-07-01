import { createSeededRandom, makeTexture, drawSpeckles, clampColor, tileNoise } from "../common/texture-utils.js";

export function createLevelOneConcreteTexture(seed, repeatX, repeatY, base, contrast = 1) {
  const random = createSeededRandom(seed);
  return makeTexture(
    512,
    (context, size) => {
      const image = context.createImageData(size, size);
      const data = image.data;

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const i = (y * size + x) * 4;
          const broad = (tileNoise(x, y, size, 4, seed * 0.03) - 0.5) * 30 * contrast;
          const mid = (tileNoise(x, y, size, 15, seed * 0.07) - 0.5) * 12 * contrast;
          const fine = (random() - 0.5) * 9 * contrast;
          const stain = Math.max(0, tileNoise(x, y, size, 7, seed * 0.11) - 0.62) * -32;
          const wear = broad + mid + fine + stain;
          data[i] = clampColor(base[0] + wear);
          data[i + 1] = clampColor(base[1] + wear * 0.94);
          data[i + 2] = clampColor(base[2] + wear * 0.86);
          data[i + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);

      const isFloor = seed === 0x1e1e10;
      const isWall = seed === 0x1e1e11;
      const isCeiling = seed === 0x1e1e12;
      if (isFloor) {
        context.strokeStyle = "rgba(20,23,21,0.24)";
        context.lineWidth = 2;
        for (let x = 0; x <= size; x += 128) {
          context.beginPath();
          context.moveTo(x, 0);
          context.lineTo(x + (random() - 0.5) * 14, size);
          context.stroke();
        }
        context.globalAlpha = 0.14;
        context.strokeStyle = "#202823";
        context.lineWidth = 9;
        for (let i = 0; i < 5; i += 1) {
          const y = 60 + random() * (size - 120);
          context.beginPath();
          context.moveTo(-40, y);
          context.bezierCurveTo(size * 0.28, y + random() * 30, size * 0.7, y - random() * 26, size + 40, y + random() * 12);
          context.stroke();
        }
        context.globalAlpha = 1;
      } else if (isWall) {
        context.globalAlpha = 0.18;
        context.fillStyle = "#2d3832";
        for (let i = 0; i < 18; i += 1) {
          const x = random() * size;
          const width = 4 + random() * 18;
          const height = 80 + random() * 240;
          context.fillRect(x, random() * 70, width, height);
        }
        context.globalAlpha = 1;
      } else if (isCeiling) {
        context.strokeStyle = "rgba(22,27,24,0.22)";
        context.lineWidth = 2;
        for (let x = 0; x <= size; x += 128) {
          context.beginPath();
          context.moveTo(x, 0);
          context.lineTo(x, size);
          context.stroke();
        }
        for (let y = 0; y <= size; y += 128) {
          context.beginPath();
          context.moveTo(0, y);
          context.lineTo(size, y);
          context.stroke();
        }
      }

      context.strokeStyle = "rgba(28,31,30,0.28)";
      context.lineWidth = 1.2;
      for (let i = 0; i < 34; i += 1) {
        const x = random() * size;
        const y = random() * size;
        const length = 18 + random() * 86;
        const angle = random() * Math.PI;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
        context.stroke();
      }

      drawSpeckles(context, size, 900, 0.09, "18,20,19", random);
      drawSpeckles(context, size, 180, 0.06, "190,197,184", random);
    },
    repeatX,
    repeatY,
  );
}

export function createLevelOneFloorTexture() {
  return createLevelOneConcreteTexture(0x1e1e10, 13, 10, [84, 88, 82], 1.08);
}

export function createLevelOneWallTexture() {
  return createLevelOneConcreteTexture(0x1e1e11, 2.8, 1.15, [102, 107, 101], 0.9);
}

export function createLevelOneCeilingTexture() {
  const texture = createLevelOneConcreteTexture(0x1e1e12, 10, 7, [76, 80, 77], 0.82);
  texture.needsUpdate = true;
  return texture;
}