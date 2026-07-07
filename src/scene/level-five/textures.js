import { createSeededRandom, makeTexture, drawSpeckles } from "../common/texture-utils.js";

export function createLevelFiveCarpetTexture() {
  const random = createSeededRandom(0x5e1f05);
  return makeTexture(
    512,
    (context, size) => {
      context.fillStyle = "#45180f";
      context.fillRect(0, 0, size, size);

      for (let y = 0; y < size; y += 74) {
        context.fillStyle = "rgba(164,112,42,0.24)";
        context.fillRect(0, y + 12, size, 3);
        context.fillStyle = "rgba(18,5,3,0.22)";
        context.fillRect(0, y + 40, size, 2);
      }
      for (let x = 0; x < size; x += 96) {
        context.fillStyle = "rgba(210,154,66,0.10)";
        context.fillRect(x, 0, 2, size);
      }

      context.strokeStyle = "rgba(190,132,45,0.18)";
      context.lineWidth = 2;
      for (let y = -64; y < size + 64; y += 64) {
        for (let x = -64; x < size + 64; x += 64) {
          context.beginPath();
          context.moveTo(x + 32, y);
          context.bezierCurveTo(x + 54, y + 18, x + 54, y + 46, x + 32, y + 64);
          context.bezierCurveTo(x + 10, y + 46, x + 10, y + 18, x + 32, y);
          context.stroke();
        }
      }

      for (let i = 0; i < 18; i += 1) {
        const x = random() * size;
        const y = random() * size;
        const radius = 28 + random() * 82;
        const stain = context.createRadialGradient(x, y, 0, x, y, radius);
        stain.addColorStop(0, "rgba(8,3,2,0.14)");
        stain.addColorStop(1, "rgba(8,3,2,0)");
        context.fillStyle = stain;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
      drawSpeckles(context, size, 1900, 0.09, "12,4,2", random);
      drawSpeckles(context, size, 500, 0.06, "218,168,82", random);
    },
    12,
    9,
  );
}

export function createLevelFiveWallpaperTexture() {
  const random = createSeededRandom(0x5a11);
  return makeTexture(
    512,
    (context, size) => {
      context.fillStyle = "#552016";
      context.fillRect(0, 0, size, size);

      for (let x = 0; x < size; x += 72) {
        context.fillStyle = "rgba(116,62,24,0.42)";
        context.fillRect(x, 0, 10, size);
        context.fillStyle = "rgba(210,166,74,0.16)";
        context.fillRect(x + 12, 0, 2, size);
      }

      context.strokeStyle = "rgba(210,166,74,0.16)";
      context.lineWidth = 2;
      for (let y = -48; y < size + 48; y += 64) {
        for (let x = 0; x < size; x += 72) {
          context.beginPath();
          context.arc(x + 36, y + 34, 17, 0, Math.PI * 2);
          context.stroke();
          context.beginPath();
          context.moveTo(x + 24, y + 34);
          context.quadraticCurveTo(x + 36, y + 24, x + 48, y + 34);
          context.quadraticCurveTo(x + 36, y + 44, x + 24, y + 34);
          context.stroke();
        }
      }

      for (let i = 0; i < 14; i += 1) {
        const x = random() * size;
        const y = random() * size;
        const radius = 20 + random() * 62;
        const stain = context.createRadialGradient(x, y, 0, x, y, radius);
        stain.addColorStop(0, "rgba(20,5,2,0.12)");
        stain.addColorStop(1, "rgba(20,5,2,0)");
        context.fillStyle = stain;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
      drawSpeckles(context, size, 900, 0.08, "18,6,4", random);
      drawSpeckles(context, size, 240, 0.06, "222,178,88", random);
    },
    2.8,
    1.2,
  );
}

export function createLevelFiveCeilingTexture() {
  const random = createSeededRandom(0x050ce11);
  return makeTexture(
    512,
    (context, size) => {
      context.fillStyle = "#b99d75";
      context.fillRect(0, 0, size, size);
      context.strokeStyle = "rgba(45,24,14,0.34)";
      context.lineWidth = 8;
      context.strokeRect(0, 0, size, size);
      context.strokeStyle = "rgba(255,222,160,0.16)";
      context.lineWidth = 2;
      context.strokeRect(18, 18, size - 36, size - 36);
      drawSpeckles(context, size, 1400, 0.08, "42,22,12", random);
      drawSpeckles(context, size, 180, 0.05, "244,210,150", random);
    },
    18,
    13,
  );
}

export function createLevelFiveBoilerWallTexture() {
  const random = createSeededRandom(0xb011e8);
  return makeTexture(
    512,
    (context, size) => {
      context.fillStyle = "#46362e";
      context.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 96) {
        context.fillStyle = "rgba(18,10,7,0.22)";
        context.fillRect(0, y, size, 4);
      }
      for (let i = 0; i < 28; i += 1) {
        const x = random() * size;
        const y = random() * size;
        const radius = 16 + random() * 72;
        const stain = context.createRadialGradient(x, y, 0, x, y, radius);
        stain.addColorStop(0, "rgba(0,0,0,0.20)");
        stain.addColorStop(1, "rgba(0,0,0,0)");
        context.fillStyle = stain;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
      drawSpeckles(context, size, 1600, 0.12, "8,5,4", random);
      drawSpeckles(context, size, 300, 0.06, "146,106,72", random);
    },
    5,
    2,
  );
}
