import { createSeededRandom, makeTexture, drawSpeckles } from "../common/texture-utils.js";

export function createLevelThreeBrickTexture() {
  return makeTexture(
    512,
    (context, size) => {
      context.fillStyle = "#514334";
      context.fillRect(0, 0, size, size);
      const random = createSeededRandom(0x3e3001);
      for (let y = 0; y < size; y += 48) {
        const offset = (y / 48) % 2 === 0 ? 0 : 64;
        for (let x = -offset; x < size; x += 128) {
          context.fillStyle = `rgba(${70 + random() * 34},${54 + random() * 24},${38 + random() * 20},0.5)`;
          context.fillRect(x + 1, y + 1, 126, 46);
        }
      }
      context.strokeStyle = "rgba(18,16,13,0.42)";
      context.lineWidth = 3;
      for (let y = 0; y <= size; y += 48) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(size, y);
        context.stroke();
      }
      for (let y = 0; y < size; y += 48) {
        const offset = (y / 48) % 2 === 0 ? 0 : 64;
        for (let x = -offset; x < size; x += 128) {
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(x, y + 48);
          context.stroke();
        }
      }
      drawSpeckles(context, size, 900, 0.13, "10,8,6", random);
      drawSpeckles(context, size, 260, 0.1, "154,102,62", random);
    },
    2.8,
    2.1,
  );
}

export function createLevelThreeFloorTexture() {
  return makeTexture(
    512,
    (context, size) => {
      const random = createSeededRandom(0x3e3002);
      context.fillStyle = "#393b34";
      context.fillRect(0, 0, size, size);
      context.strokeStyle = "rgba(12,13,12,0.5)";
      context.lineWidth = 3;
      for (let x = 0; x <= size; x += 96) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x + (random() - 0.5) * 10, size);
        context.stroke();
      }
      for (let y = 0; y <= size; y += 96) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(size, y + (random() - 0.5) * 10);
        context.stroke();
      }
      context.globalAlpha = 0.22;
      context.fillStyle = "#1d1f1c";
      for (let i = 0; i < 18; i += 1) {
        context.fillRect(random() * size, random() * size, 90 + random() * 190, 10 + random() * 32);
      }
      context.globalAlpha = 1;
      drawSpeckles(context, size, 1200, 0.16, "8,8,7", random);
      drawSpeckles(context, size, 260, 0.08, "181,126,70", random);
    },
    12,
    8,
  );
}

export function createLevelThreeCeilingTexture() {
  return makeTexture(
    512,
    (context, size) => {
      const random = createSeededRandom(0x3e3003);
      context.fillStyle = "#282c27";
      context.fillRect(0, 0, size, size);
      context.strokeStyle = "rgba(8,9,8,0.45)";
      context.lineWidth = 3;
      for (let y = 0; y <= size; y += 96) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(size, y);
        context.stroke();
      }
      for (let x = 0; x <= size; x += 128) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, size);
        context.stroke();
      }
      drawSpeckles(context, size, 850, 0.13, "8,8,8", random);
      drawSpeckles(context, size, 180, 0.08, "104,96,72", random);
    },
    8,
    6,
  );
}

