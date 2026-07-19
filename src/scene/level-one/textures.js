import { createSeededRandom, makeTexture, drawSpeckles, clampColor, tileNoise } from "../common/texture-utils.js";
import * as THREE from "three";
import concreteColorUrl from "../../assets/textures/concrete-floor-worn/diff.jpg?url";
import concreteNormalUrl from "../../assets/textures/concrete-floor-worn/normal.jpg?url";
import concreteRoughnessUrl from "../../assets/textures/concrete-floor-worn/roughness.jpg?url";
import concreteAoUrl from "../../assets/textures/concrete-floor-worn/ao.jpg?url";

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
export function createLevelOneFloorPbrMaps() {
  const loader = new THREE.TextureLoader();
  const configure = (texture, color = false) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(18, 13);
    texture.anisotropy = 6;
    if (color) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };
  return {
    map: configure(loader.load(concreteColorUrl), true),
    normalMap: configure(loader.load(concreteNormalUrl)),
    roughnessMap: configure(loader.load(concreteRoughnessUrl)),
    aoMap: configure(loader.load(concreteAoUrl)),
  };
}

export function createLevelOneWallTexture() {
  return createLevelOneConcreteTexture(0x1e1e11, 2.8, 1.15, [102, 107, 101], 0.9);
}

export function createLevelOneCeilingTexture() {
  const texture = createLevelOneConcreteTexture(0x1e1e12, 10, 7, [76, 80, 77], 0.82);
  texture.needsUpdate = true;
  return texture;
}

export function createLevelOneCorridorFloorTexture() {
  return createLevelOneConcreteTexture(CORRIDOR_FLOOR_SEED, 6.2, 5.2, [118, 124, 124], 0.72);
}

export function createLevelOneCorridorWallTexture() {
  return createLevelOneConcreteTexture(CORRIDOR_WALL_SEED, 4.8, 1.25, [190, 199, 201], 0.58);
}

export function createLevelOneCorridorCeilingTexture() {
  return createLevelOneConcreteTexture(CORRIDOR_CEILING_SEED, 8.4, 6.4, [181, 190, 193], 0.52);
}
