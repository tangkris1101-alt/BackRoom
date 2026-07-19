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
          const broad = (tileNoise(x, y, size, 4, seed * 0.03) - 0.5) * 24 * contrast;
          const mid = (tileNoise(x, y, size, 15, seed * 0.07) - 0.5) * 8 * contrast;
          const fine = (random() - 0.5) * 5 * contrast;
          const damp = Math.max(0, tileNoise(x, y, size, 2, seed * 0.11) - 0.58) * -18;
          const wear = broad + mid + fine + damp;
          data[i] = clampColor(base[0] + wear);
          data[i + 1] = clampColor(base[1] + wear * 0.99);
          data[i + 2] = clampColor(base[2] + wear * 0.97);
          data[i + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);

      drawSpeckles(context, size, 420, 0.035, "45,47,45", random);
      drawSpeckles(context, size, 80, 0.02, "174,176,171", random);
    },
    repeatX,
    repeatY,
  );
}

export function createLevelOneFloorTexture() {
  return createLevelOneConcreteTexture(0x1e1e10, 13, 10, [100, 101, 98], 0.78);
}
