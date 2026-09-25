import { createSeededRandom, makeTexture, drawSpeckles, clampColor, tileNoise, smoothstep } from "../common/texture-utils.js";
import * as THREE from "three";
import concreteColorUrl from "../../assets/textures/concrete-floor-worn/diff.jpg?url";
import concreteNormalUrl from "../../assets/textures/concrete-floor-worn/normal.jpg?url";
import concreteRoughnessUrl from "../../assets/textures/concrete-floor-worn/roughness.jpg?url";
import concreteAoUrl from "../../assets/textures/concrete-floor-worn/ao.jpg?url";

const CORRIDOR_WALL_SEED = 0x1e1e14;

// Level 1 is a working parking level, not a clean room: the paint has
// yellowed, damp streaks run down from the slab and grime collects along the
// wall foot, matching the published MEG photographs of the zone.
const WALL_BASE = [188, 181, 160];
const CORRIDOR_WALL_BASE = [199, 193, 173];
const CEILING_BASE = [148, 144, 131];

function dampMask(value, threshold) {
  return Math.max(0, value - threshold) / (1 - threshold);
}

export function createLevelOneConcreteTexture(seed, repeatX, repeatY, base, contrast = 1, { painted = false, grime = 0 } = {}) {
  const random = createSeededRandom(seed);
  return makeTexture(
    512,
    (context, size) => {
      const image = context.createImageData(size, size);
      const data = image.data;

      for (let y = 0; y < size; y += 1) {
        const vertical = y / size;
        const runDown = Math.pow(1 - vertical, 1.7);
        const foot = smoothstep(Math.min(1, Math.max(0, (vertical - 0.87) / 0.13)));
        for (let x = 0; x < size; x += 1) {
          const i = (y * size + x) * 4;
          const broad = (tileNoise(x, y, size, 4, seed * 0.03) - 0.5) * (painted ? 8 : 24) * contrast;
          const mid = (tileNoise(x, y, size, 15, seed * 0.07) - 0.5) * (painted ? 10 : 8) * contrast;
          const fine = (random() - 0.5) * (painted ? 9 : 5) * contrast;
          const settling = Math.max(0, tileNoise(x, y, size, 2, seed * 0.11) - 0.62) * -5 * contrast;
          const wear = broad + mid + fine + settling;

          let stain = 0;
          if (grime > 0) {
            const blotch = dampMask(tileNoise(x, y, size, 3, seed * 0.05), 0.52);
            const depth = 0.45 + dampMask(tileNoise(x, y, size, 8, seed * 0.09), 0.35) * 0.55;
            // Streaks come in clusters of narrow and wide runs so the wall
            // never reads as evenly spaced stripes.
            const cluster = 0.25 + tileNoise(x, y * 0.1, size, 7, seed * 0.19) * 0.95;
            const streak = dampMask(tileNoise(x, y * 0.35, size, 26, seed * 0.17), 0.55) * cluster * runDown;
            const wideStreak = dampMask(tileNoise(x, y * 0.18, size, 9, seed * 0.21), 0.61) * 0.45 * runDown;
            const footNoise = 0.55 + tileNoise(x, y, size, 30, seed * 0.23) * 0.45;
            stain = Math.min(1.45, blotch * depth * 0.75 + (streak + wideStreak) * 0.72 + foot * footNoise * 0.85);
          }

          // Damp stains pull the blue channel down first so the grime reads as
          // the yellow-brown film of a working parking level.
          data[i] = clampColor(base[0] + wear - stain * 14 * grime);
          data[i + 1] = clampColor(base[1] + wear * 0.99 - stain * 24 * grime);
          data[i + 2] = clampColor(base[2] + wear * 0.97 - stain * 38 * grime);
          data[i + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);

      if (painted) {
        // Fine dry roller stipple avoids printed seams on long wall runs.
        for (let i = 0; i < 1700; i += 1) {
          const x = random() * size;
          const y = random() * size;
          context.fillStyle = random() < 0.55
            ? "rgba(42,51,45,0.06)"
            : "rgba(244,248,239,0.08)";
          context.fillRect(x, y, 0.6 + random() * 1.2, 1 + random() * 3);
        }
      }

      drawSpeckles(context, size, 420, 0.035, "45,47,45", random);
      drawSpeckles(context, size, 80, 0.02, "174,176,171", random);
    },
    repeatX,
    repeatY,
  );
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
  // Aged parking-level paint: flat enough to stay a wall, dirty enough that
  // the damp streaks and wall-foot grime read from across the hall.
  return createLevelOneConcreteTexture(0x1e1e11, 1, 1, WALL_BASE, 0.62, { painted: true, grime: 1 });
}

export function createLevelOneCeilingTexture() {
  const texture = createLevelOneConcreteTexture(0x1e1e12, 10, 7, CEILING_BASE, 0.8, { grime: 1.3 });
  texture.needsUpdate = true;
  return texture;
}

export function createLevelOneCorridorWallTexture() {
  return createLevelOneConcreteTexture(CORRIDOR_WALL_SEED, 1, 1, CORRIDOR_WALL_BASE, 0.58, { painted: true, grime: 0.9 });
}

function getLevelOneWallHeight(x, y, size, seed) {
  const broad = (tileNoise(x, y, size, 4, seed * 0.031) - 0.5) * 0.72;
  const paint = (tileNoise(x, y, size, 17, seed * 0.073) - 0.5) * 0.38;
  const fine = (tileNoise(x, y, size, 49, seed * 0.119) - 0.5) * 0.18;
  // The damp film sits slightly proud of the paint and holds a sheen, so it
  // also has to show up in the roughness and normal maps.
  const stain = Math.max(0, tileNoise(x, y, size, 3, seed * 0.05) - 0.52) * 1.25;
  return broad + paint + fine - stain;
}

function createLevelOneWallDetailTexture(seed, { mode = "normal" } = {}) {
  const size = 256;
  const texture = makeTexture(
    size,
    (context) => {
      const image = context.createImageData(size, size);
      const data = image.data;
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const i = (y * size + x) * 4;
          const height = getLevelOneWallHeight(x, y, size, seed);
          if (mode === "roughness") {
            const roughness = 214 + height * 42;
            data[i] = clampColor(roughness);
            data[i + 1] = clampColor(roughness);
            data[i + 2] = clampColor(roughness);
          } else {
            const dx = getLevelOneWallHeight(x + 1, y, size, seed) - getLevelOneWallHeight(x - 1, y, size, seed);
            const dy = getLevelOneWallHeight(x, y + 1, size, seed) - getLevelOneWallHeight(x, y - 1, size, seed);
            data[i] = clampColor(128 - dx * 52);
            data[i + 1] = clampColor(128 - dy * 52);
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
  maps.normalMap = createLevelOneWallDetailTexture(seed, { mode: "normal" });
  maps.roughnessMap = createLevelOneWallDetailTexture(seed, { mode: "roughness" });
  return maps;
}
