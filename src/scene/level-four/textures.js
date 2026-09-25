import * as THREE from "three";
import { createSeededRandom, makeTexture, drawSpeckles, clampColor, tileNoise } from "../common/texture-utils.js";
import carpetNormalUrl from "../../assets/textures/level-twelve-thirteen/carpet-011/normal.jpg?url";
import carpetRoughnessUrl from "../../assets/textures/level-twelve-thirteen/carpet-011/roughness.jpg?url";

const CARPET_COLOR_REPEAT = [18, 14];
const CARPET_DETAIL_REPEAT = [43, 31];

export function createLevelFourCarpetTexture() {
  const random = createSeededRandom(0x4f4f04);
  return makeTexture(
    1024,
    (context, size) => {
      const image = context.createImageData(size, size);
      const pixels = image.data;
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const index = (y * size + x) * 4;
          const broad = (tileNoise(x, y, size, 5, 4.04) - 0.5) * 23;
          const mottling = (tileNoise(x, y, size, 27, 7.16) - 0.5) * 11;
          const fibre = (random() - 0.5) * 18;
          const shade = broad + mottling + fibre;
          pixels[index] = clampColor(133 + shade * 0.9);
          pixels[index + 1] = clampColor(143 + shade);
          pixels[index + 2] = clampColor(134 + shade * 0.88);
          pixels[index + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);

      // Short, offset pile strokes break up the pixel grain without making
      // a repeating tile grid or a hard seam every metre.
      for (let i = 0; i < 43000; i += 1) {
        const x = random() * size;
        const y = random() * size;
        const length = 2 + random() * 6;
        context.strokeStyle = random() < 0.55
          ? `rgba(39,49,43,${0.035 + random() * 0.065})`
          : `rgba(221,226,209,${0.025 + random() * 0.06})`;
        context.lineWidth = 0.5 + random() * 0.45;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + (random() - 0.5) * 1.4, y + length);
        context.stroke();
      }
      drawSpeckles(context, size, 7000, 0.055, "36,42,38", random);
      drawSpeckles(context, size, 2500, 0.045, "210,214,200", random);
    },
    ...CARPET_COLOR_REPEAT,
  );
}

export function createLevelFourCarpetMaps({ includeDetailMaps = true } = {}) {
  const maps = { map: createLevelFourCarpetTexture() };
  if (!includeDetailMaps) return maps;

  const loader = new THREE.TextureLoader();
  const loadDetail = (url) => {
    const texture = loader.load(url);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(...CARPET_DETAIL_REPEAT);
    texture.colorSpace = THREE.NoColorSpace;
    texture.anisotropy = 8;
    return texture;
  };
  maps.normalMap = loadDetail(carpetNormalUrl);
  maps.roughnessMap = loadDetail(carpetRoughnessUrl);
  return maps;
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

