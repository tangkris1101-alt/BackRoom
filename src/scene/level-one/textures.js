import { createSeededRandom, makeTexture, drawSpeckles, clampColor, tileNoise } from "../common/texture-utils.js";
import * as THREE from "three";
import concreteColorUrl from "../../assets/textures/concrete-floor-worn/diff.jpg?url";
import concreteNormalUrl from "../../assets/textures/concrete-floor-worn/normal.jpg?url";
import concreteRoughnessUrl from "../../assets/textures/concrete-floor-worn/roughness.jpg?url";
import concreteAoUrl from "../../assets/textures/concrete-floor-worn/ao.jpg?url";

const CORRIDOR_FLOOR_SEED = 0x1e1e13;
const CORRIDOR_WALL_SEED = 0x1e1e14;
const CORRIDOR_CEILING_SEED = 0x1e1e15;

export function createLevelOneConcreteTexture(seed, repeatX, repeatY, base, contrast = 1, { painted = false, corridor = false } = {}) {
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
          // Keep ageing dry and subtle: this is maintained warehouse paint,
          // not wet or crumbling concrete.
          const settling = Math.max(0, tileNoise(x, y, size, 2, seed * 0.11) - 0.62) * -5 * contrast;
          const seamPhase = ((y / size) * (corridor ? 3.15 : 2.45) + 0.12) % 1;
          const seamDistance = Math.min(seamPhase, 1 - seamPhase);
          const paintJoint = painted
            ? Math.max(0, 1 - seamDistance / 0.012) * -8 * contrast
            : 0;
          const wear = broad + mid + fine + settling + paintJoint;
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
export function createLevelOneFloorPbrMaps({ includeDetailMaps = true } = {}) {
  const loader = new THREE.TextureLoader();
  const configure = (texture, color = false) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(18, 13);
    texture.anisotropy = 6;
    if (color) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };
  const maps = {
    map: configure(loader.load(concreteColorUrl), true),
  };
  if (!includeDetailMaps) return maps;
  maps.normalMap = configure(loader.load(concreteNormalUrl));
  maps.roughnessMap = configure(loader.load(concreteRoughnessUrl));
  maps.aoMap = configure(loader.load(concreteAoUrl));
  return maps;
}

export function createLevelOneWallTexture() {
  // Old, sealed warehouse concrete: varied enough to break up the large wall
  // planes, but without the damp stains or aggressive damage of a ruin.
  return createLevelOneConcreteTexture(0x1e1e11, 1.65, 1.05, [210, 216, 209], 0.56, { painted: true });
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
  return createLevelOneConcreteTexture(CORRIDOR_WALL_SEED, 1.82, 1.08, [220, 226, 223], 0.46, { painted: true, corridor: true });
}

function getLevelOneWallHeight(x, y, size, seed, corridor) {
  const broad = (tileNoise(x, y, size, 4, seed * 0.031) - 0.5) * 0.62;
  const paint = (tileNoise(x, y, size, 17, seed * 0.073) - 0.5) * 0.27;
  const fine = (tileNoise(x, y, size, 49, seed * 0.119) - 0.5) * 0.12;
  // Low-amplitude horizontal construction seams make the material read as
  // painted concrete rather than a featureless, plastic wall.
  const seamPhase = ((y / size) * (corridor ? 3.15 : 2.45) + 0.12) % 1;
  const seamDistance = Math.min(seamPhase, 1 - seamPhase);
  const seam = Math.max(0, 1 - seamDistance / 0.018) * (corridor ? -0.18 : -0.24);
  return broad + paint + fine + seam;
}

function createLevelOneWallDetailTexture(seed, { corridor = false, mode = "normal" } = {}) {
  const size = 256;
  const texture = makeTexture(
    size,
    (context) => {
      const image = context.createImageData(size, size);
      const data = image.data;
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const i = (y * size + x) * 4;
          const height = getLevelOneWallHeight(x, y, size, seed, corridor);
          if (mode === "roughness") {
            const roughness = 226 + height * 19;
            data[i] = clampColor(roughness);
            data[i + 1] = clampColor(roughness);
            data[i + 2] = clampColor(roughness);
          } else {
            const dx = getLevelOneWallHeight(x + 1, y, size, seed, corridor) - getLevelOneWallHeight(x - 1, y, size, seed, corridor);
            const dy = getLevelOneWallHeight(x, y + 1, size, seed, corridor) - getLevelOneWallHeight(x, y - 1, size, seed, corridor);
            data[i] = clampColor(128 - dx * 38);
            data[i + 1] = clampColor(128 - dy * 38);
            data[i + 2] = 255;
          }
          data[i + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);
    },
    1,
    1,
  );
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

export function createLevelOneWallPbrMaps({ corridor = false, includeDetailMaps = true } = {}) {
  const seed = corridor ? CORRIDOR_WALL_SEED : 0x1e1e11;
  const maps = {
    map: corridor ? createLevelOneCorridorWallTexture() : createLevelOneWallTexture(),
  };
  if (!includeDetailMaps) return maps;
  maps.normalMap = createLevelOneWallDetailTexture(seed, { corridor, mode: "normal" });
  maps.roughnessMap = createLevelOneWallDetailTexture(seed, { corridor, mode: "roughness" });
  return maps;
}

export function createLevelOneCorridorCeilingTexture() {
  return createLevelOneConcreteTexture(CORRIDOR_CEILING_SEED, 8.4, 6.4, [181, 190, 193], 0.52);
}
