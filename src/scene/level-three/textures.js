import { createSeededRandom, makeTexture, drawSpeckles } from "../common/texture-utils.js";

const BRICK_WIDTH = 128;
const BRICK_HEIGHT = 64;

function paintBrickwork(context, size, heightOnly, variant) {
  context.fillStyle = heightOnly ? "#646464" : "#625d52";
  context.fillRect(0, 0, size, size);

  // Four full bricks per row and eight rows make both axes tile cleanly.
  // Split bricks at the texture seam reuse the same seeded surface marks.
  for (let row = 0; row < size / BRICK_HEIGHT; row += 1) {
    const offset = row % 2 ? BRICK_WIDTH / 2 : 0;
    for (let column = 0; column < size / BRICK_WIDTH + 1; column += 1) {
      const x = column * BRICK_WIDTH - offset;
      const y = row * BRICK_HEIGHT;
      const wrappedColumn = column % (size / BRICK_WIDTH);
      const random = createSeededRandom(0x3e3001 + variant * 104729 + row * 97 + wrappedColumn * 701);
      const shade = (random() - 0.5) * 42;
      const soot = random() > 0.83 ? 17 : 0;
      const red = Math.round(139 + shade - soot);
      const green = Math.round(113 + shade * 0.8 - soot);
      const blue = Math.round(84 + shade * 0.55 - soot);

      if (heightOnly) {
        context.fillStyle = "#a0a0a0";
        context.fillRect(x + 3, y + 3, BRICK_WIDTH - 6, BRICK_HEIGHT - 6);
        context.fillStyle = "#b9b9b9";
        context.fillRect(x + 6, y + 6, BRICK_WIDTH - 12, BRICK_HEIGHT - 13);
        context.fillStyle = "#7f7f7f";
        context.fillRect(x + 5, y + BRICK_HEIGHT - 8, BRICK_WIDTH - 10, 3);
      } else {
        const face = context.createLinearGradient(0, y + 3, 0, y + BRICK_HEIGHT - 3);
        face.addColorStop(0, `rgb(${red + 10},${green + 10},${blue + 9})`);
        face.addColorStop(0.27, `rgb(${red},${green},${blue})`);
        face.addColorStop(1, `rgb(${red - 17},${green - 15},${blue - 12})`);
        context.fillStyle = face;
        context.fillRect(x + 3, y + 3, BRICK_WIDTH - 6, BRICK_HEIGHT - 6);
        context.fillStyle = "rgba(224,207,176,0.14)";
        context.fillRect(x + 5, y + 5, BRICK_WIDTH - 10, 2);
        context.fillStyle = "rgba(23,19,15,0.16)";
        context.fillRect(x + 5, y + BRICK_HEIGHT - 8, BRICK_WIDTH - 10, 3);
      }

      // Fine aggregate, small chips and uneven soot break up the flat faces.
      for (let mark = 0; mark < 95; mark += 1) {
        const px = x + 7 + random() * (BRICK_WIDTH - 14);
        const py = y + 9 + random() * (BRICK_HEIGHT - 18);
        const radius = 0.4 + random() * 1.9;
        const dark = random() > 0.45;
        context.fillStyle = heightOnly
          ? dark ? "rgba(55,55,55,0.23)" : "rgba(235,235,235,0.16)"
          : dark ? "rgba(29,24,19,0.22)" : "rgba(224,199,151,0.16)";
        context.beginPath();
        context.arc(px, py, radius, 0, Math.PI * 2);
        context.fill();
      }
      if (random() > 0.72) {
        context.strokeStyle = heightOnly ? "rgba(84,84,84,0.35)" : "rgba(45,35,27,0.21)";
        context.lineWidth = 1 + random();
        context.beginPath();
        const scratchX = x + 18 + random() * 75;
        const scratchY = y + 17 + random() * 26;
        context.moveTo(scratchX, scratchY);
        context.lineTo(scratchX + 8 + random() * 24, scratchY + (random() - 0.5) * 5);
        context.stroke();
      }
    }
  }
}

export function createLevelThreeBrickTexture(variant = 0) {
  return makeTexture(512, (context, size) => paintBrickwork(context, size, false, variant), 3, 2);
}

export function createLevelThreeBrickBumpTexture(variant = 0) {
  return makeTexture(512, (context, size) => paintBrickwork(context, size, true, variant), 3, 2);
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

