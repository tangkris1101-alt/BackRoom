import { createSeededRandom, drawSpeckles, makeTexture } from "../common/texture-utils.js";

function suburbTexture(base, repeatX, repeatY, seed, lineColor) {
  return makeTexture(512, (context, size) => {
    const random = createSeededRandom(seed);
    context.fillStyle = base;
    context.fillRect(0, 0, size, size);
    drawSpeckles(context, size, 680, 0.22, "12,15,18", random);
    context.strokeStyle = lineColor;
    context.globalAlpha = 0.18;
    context.lineWidth = 2;
    for (let index = 0; index < 24; index += 1) {
      const offset = random() * size;
      context.beginPath();
      context.moveTo(0, offset);
      context.lineTo(size, offset + (random() - 0.5) * 28);
      context.stroke();
    }
    context.globalAlpha = 1;
  }, repeatX, repeatY);
}

export const createLevelNineRoadTexture = () => suburbTexture("#1f252d", 18, 14, 901, "#5e6670");
export const createLevelNineWallTexture = () => suburbTexture("#363b43", 15, 7, 902, "#9b9a8a");
export const createLevelNineCeilingTexture = () => suburbTexture("#10151d", 18, 14, 903, "#3d4652");
