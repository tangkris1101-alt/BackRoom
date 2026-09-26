import { createSeededRandom, paintCachedCanvas, wrapCanvasTexture, drawSpeckles, clampColor, tileNoise } from "../common/texture-utils.js";

export function createLevelTwoGrimyTexture(seed, repeatX, repeatY, base, rust = 1) {
  const random = createSeededRandom(seed);
  // Painted once per session: the pattern only depends on the arguments below.
  const cacheKey = ["level-two-grimy", seed, base.join(","), rust].join("|");
  return wrapCanvasTexture(
    paintCachedCanvas(cacheKey, 512, (context, size) => {
      const image = context.createImageData(size, size);
      const data = image.data;

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const i = (y * size + x) * 4;
          const grime = (tileNoise(x, y, size, 5, seed * 0.021) - 0.5) * 52;
          const soot = Math.max(0, tileNoise(x, y, size, 11, seed * 0.047) - 0.58) * -68;
          const heat = Math.max(0, tileNoise(x, y, size, 8, seed * 0.091) - 0.68) * 38 * rust;
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
        context.globalAlpha = 0.42;
        for (let i = 0; i < 14; i += 1) {
          const x = random() * size;
          const y = random() * size * 0.38;
          const length = 70 + random() * 210;
          const width = 4 + random() * 12;
          const gradient = context.createLinearGradient(x, y, x, y + length);
          gradient.addColorStop(0, "rgba(112,47,18,0.78)");
          gradient.addColorStop(1, "rgba(124,63,25,0)");
          context.fillStyle = gradient;
          context.fillRect(x, y, width, length);
        }
        for (let i = 0; i < 12; i += 1) {
          const x = random() * size;
          const y = random() * size;
          const radius = 24 + random() * 76;
          const rust = context.createRadialGradient(x, y, 2, x, y, radius);
          rust.addColorStop(0, "rgba(94,44,20,0.7)");
          rust.addColorStop(1, "rgba(94,44,20,0)");
          context.fillStyle = rust;
          context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
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

      if (isWall) {
        context.fillStyle = "rgba(22,19,14,0.35)";
        context.fillRect(size / 2 - 1, 0, 2, size);
        context.fillStyle = "rgba(216,176,118,0.1)";
        context.fillRect(size / 2 + 2, 0, 1, size);
      }

      drawSpeckles(context, size, 980, 0.1, "13,12,9", random);
      drawSpeckles(context, size, 210, 0.08, "173,104,50", random);
    }),
    repeatX,
    repeatY,
  );
}

export function createLevelTwoFloorTexture() {
  const random = createSeededRandom(0x2f2002);
  return wrapCanvasTexture(
    paintCachedCanvas("level-two-floor", 512, (context, size) => {
      context.fillStyle = "#726d5c";
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
    }),
    11,
    9,
  );
}

export function createLevelTwoWallTexture() {
  return createLevelTwoGrimyTexture(0x2f2003, 1.2, 1.1, [130, 119, 96], 1.15);
}

export function createLevelTwoCeilingTexture() {
  return createLevelTwoGrimyTexture(0x2f2004, 8, 6, [105, 100, 82], 0.8);
}

export function createLevelTwoMetalTexture(seed = 0x2f2005) {
  const random = createSeededRandom(seed);
  return wrapCanvasTexture(
    paintCachedCanvas(["level-two-metal", seed].join("|"), 256, (context, size) => {
      const image = context.createImageData(size, size);
      const data = image.data;
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const i = (y * size + x) * 4;
          const wear = (tileNoise(x, y, size, 8, seed * 0.031) - 0.5) * 56;
          const rust = Math.max(0, tileNoise(x, y, size, 5, seed * 0.067) - 0.56) * 138;
          const grain = (random() - 0.5) * 16;
          data[i] = clampColor(116 + wear + rust + grain);
          data[i + 1] = clampColor(110 + wear * 0.78 + rust * 0.36 + grain);
          data[i + 2] = clampColor(96 + wear * 0.6 + rust * 0.12 + grain);
          data[i + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);
      context.strokeStyle = "rgba(24,21,17,0.22)";
      context.lineWidth = 1;
      for (let i = 0; i < 28; i += 1) {
        const x = random() * size;
        const y = random() * size;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + (random() - 0.5) * 11, y + 15 + random() * 70);
        context.stroke();
      }
    }),
    1,
    1,
  );
}

