import { createSeededRandom, makeTexture, drawSpeckles } from "../common/texture-utils.js";

export function createLevelFourCarpetTexture() {
  const random = createSeededRandom(0x4f4f04);
  return makeTexture(
    512,
    (context, size) => {
      context.fillStyle = "#858f86";
      context.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 42) {
        context.fillStyle = "rgba(42,48,44,0.12)";
        context.fillRect(0, y, size, 2);
      }
      for (let x = 0; x < size; x += 42) {
        context.fillStyle = "rgba(220,224,210,0.08)";
        context.fillRect(x, 0, 1, size);
      }
      for (let i = 0; i < 24; i += 1) {
        const x = random() * size;
        const y = random() * size;
        const radius = 28 + random() * 72;
        const stain = context.createRadialGradient(x, y, 0, x, y, radius);
        stain.addColorStop(0, "rgba(32,38,34,0.11)");
        stain.addColorStop(1, "rgba(32,38,34,0)");
        context.fillStyle = stain;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
      drawSpeckles(context, size, 1800, 0.07, "36,42,38", random);
      drawSpeckles(context, size, 520, 0.05, "210,214,200", random);
    },
    12,
    10,
  );
}

export function createLevelFourWallTexture() {
  const random = createSeededRandom(0x0ff1ce);
  return makeTexture(
    512,
    (context, size) => {
      context.fillStyle = "#c9c4ae";
      context.fillRect(0, 0, size, size);
      for (let x = 0; x < size; x += 128) {
        context.fillStyle = "rgba(90,84,68,0.08)";
        context.fillRect(x, 0, 2, size);
      }
      for (let i = 0; i < 10; i += 1) {
        const x = random() * size;
        const y = random() * size;
        const radius = 20 + random() * 50;
        const stain = context.createRadialGradient(x, y, 0, x, y, radius);
        stain.addColorStop(0, "rgba(88,80,60,0.08)");
        stain.addColorStop(1, "rgba(88,80,60,0)");
        context.fillStyle = stain;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
      drawSpeckles(context, size, 520, 0.08, "80,74,58", random);
    },
    2.6,
    1.15,
  );
}

export function createLevelFourCeilingTexture() {
  const random = createSeededRandom(0xce1414);
  return makeTexture(
    512,
    (context, size) => {
      context.fillStyle = "#d8d4bf";
      context.fillRect(0, 0, size, size);
      context.strokeStyle = "rgba(72,70,58,0.32)";
      context.lineWidth = 6;
      context.strokeRect(0, 0, size, size);
      context.strokeStyle = "rgba(255,255,240,0.13)";
      context.lineWidth = 1.4;
      context.strokeRect(10, 10, size - 20, size - 20);
      drawSpeckles(context, size, 1700, 0.08, "92,88,72", random);
    },
    18,
    16,
  );
}