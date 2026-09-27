import {
  createSeededRandom,
  paintCachedCanvas,
  wrapCanvasTexture,
  drawSpeckles,
  clampColor,
  tileHash,
  tileNoise,
  tileNoiseXY,
} from "../common/texture-utils.js";

export function createLevelTwoGrimyTexture(seed, repeatX, repeatY, base, rust = 1) {
  const random = createSeededRandom(seed);
  // Painted once per session: the pattern only depends on the arguments below.
  const cacheKey = ["level-two-grimy", seed, base.join(","), rust].join("|");
  return wrapCanvasTexture(
    paintCachedCanvas(cacheKey, 512, (context, size) => {
      const image = context.createImageData(size, size);
      const data = image.data;

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const i = (y * size + x) * 4;
          const grime = (tileNoise(x, y, size, 5, seed * 0.021) - 0.5) * 52;
          const soot = Math.max(0, tileNoise(x, y, size, 11, seed * 0.047) - 0.58) * -68;
          const heat = Math.max(0, tileNoise(x, y, size, 8, seed * 0.091) - 0.68) * 38 * rust;
          const fine = (random() - 0.5) * 10;
          data[i] = clampColor(base[0] + grime + soot + heat + fine);
          data[i + 1] = clampColor(base[1] + grime * 0.84 + soot * 0.72 + heat * 0.42 + fine);
          data[i + 2] = clampColor(base[2] + grime * 0.58 + soot * 0.62 + heat * 0.18 + fine * 0.7);
          data[i + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);

      const isWall = seed === 0x2f2003;
      const isCeiling = seed === 0x2f2004;
      if (isWall) {
        context.globalAlpha = 0.42;
        for (let i = 0; i < 14; i += 1) {
          const x = random() * size;
          const y = random() * size * 0.38;
          const length = 70 + random() * 210;
          const width = 4 + random() * 12;
          const gradient = context.createLinearGradient(x, y, x, y + length);
          gradient.addColorStop(0, "rgba(112,47,18,0.78)");
          gradient.addColorStop(1, "rgba(124,63,25,0)");
          context.fillStyle = gradient;
          context.fillRect(x, y, width, length);
        }
        for (let i = 0; i < 12; i += 1) {
          const x = random() * size;
          const y = random() * size;
          const radius = 24 + random() * 76;
          const rust = context.createRadialGradient(x, y, 2, x, y, radius);
          rust.addColorStop(0, "rgba(94,44,20,0.7)");
          rust.addColorStop(1, "rgba(94,44,20,0)");
          context.fillStyle = rust;
          context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
        context.globalAlpha = 1;
      } else if (isCeiling) {
        context.strokeStyle = "rgba(7,8,7,0.34)";
        context.lineWidth = 3;
        for (let y = 24; y < size; y += 76) {
          context.beginPath();
          context.moveTo(0, y);
          context.lineTo(size, y + (random() - 0.5) * 14);
          context.stroke();
        }
      }

      context.globalAlpha = 0.18;
      context.strokeStyle = "#15140f";
      context.lineWidth = 1.3;
      for (let i = 0; i < 28; i += 1) {
        const x = random() * size;
        const y = random() * size;
        const length = 24 + random() * 120;
        const angle = random() * Math.PI;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
        context.stroke();
      }
      context.globalAlpha = 1;

      if (isWall) {
        context.fillStyle = "rgba(22,19,14,0.35)";
        context.fillRect(size / 2 - 1, 0, 2, size);
        context.fillStyle = "rgba(216,176,118,0.1)";
        context.fillRect(size / 2 + 2, 0, 1, size);
      }

      drawSpeckles(context, size, 980, 0.1, "13,12,9", random);
      drawSpeckles(context, size, 210, 0.08, "173,104,50", random);
    }),
    repeatX,
    repeatY,
  );
}

// One slab seam: a narrow, wobbling groove with the dirt that piles up beside
// it. Real joints are rarely a clean line — stretches of the groove are packed
// flush with dust, others are chipped or filled, so both are modelled per pixel
// instead of being stroked as a uniform rule.
function buildLevelTwoJointProfiles(size, bases, seed) {
  const sines = [0, 1, 2, 3];
  return bases.map((base, index) => {
    const offset = new Float32Array(size);
    const openness = new Float32Array(size);
    const packed = new Float32Array(size);
    const chipped = new Float32Array(size);
    for (let i = 0; i < size; i += 1) {
      const t = (i / size) * Math.PI * 2;
      offset[i] = sines.reduce(
        (total, harmonic) =>
          total +
          Math.sin(t * (harmonic + 1) * 2 + index * 1.7 + harmonic * 2.3) *
            (1.15 / (harmonic + 1)),
        0,
      );
      openness[i] = 0.42 + 0.58 * tileNoiseXY(0, i, size, 1, 5, seed + index * 13);
      packed[i] = tileNoiseXY(0, i, size, 1, 41, seed + 91 + index * 13);
      chipped[i] = tileNoiseXY(0, i, size, 1, 17, seed + 57 + index * 13);
    }
    return { base, offset, openness, packed, chipped };
  });
}

export function createLevelTwoFloorTexture() {
  const random = createSeededRandom(0x2f2002);
  return wrapCanvasTexture(
    paintCachedCanvas("level-two-floor", 512, (context, size) => {
      const image = context.createImageData(size, size);
      const data = image.data;
      // Slab seams sit ~6 m apart in world space (the level floor is 200 m x 112 m
      // across 11 x 9 repeats), which is why the seams are drawn sparsely and
      // slightly out of step between the two axes.
      const jointsX = buildLevelTwoJointProfiles(size, [0, size / 3, (size * 2) / 3], 0x2f21);
      const jointsZ = buildLevelTwoJointProfiles(size, [0, size / 2], 0x2f35);
      const jointSums = { grime: 0, dust: 0 };

      function accumulateJoint(joints, along, across, chipField) {
        for (const joint of joints) {
          const center = joint.base + joint.offset[along];
          const raw = Math.abs(across - center);
          const distance = Math.min(raw, size - raw);
          const band = Math.max(0, 1 - distance / 6.2);
          if (band <= 0) continue;
          const groove = Math.max(0, 1 - distance / 1.75);
          const pack = joint.packed[along] > 0.54 ? 1 : 0;
          const grooveStrength =
            groove * groove * 0.24 * joint.openness[along] * (pack ? 0.4 : 1);
          const bandStrength = band * band * 0.09 * (0.6 + 0.4 * joint.openness[along]);
          const chip =
            joint.chipped[along] > 0.6 && chipField > 0.68 && band > 0.45
              ? (chipField - 0.68) * 0.8
              : 0;
          jointSums.grime += grooveStrength + bandStrength + chip;
          jointSums.dust += groove * 0.85 * (pack ? 0.5 : 0);
        }
      }

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const i = (y * size + x) * 4;
          const patch = (tileNoiseXY(x, y, size, 3, 4, 0x2f41) - 0.5) * 34;
          const mottle = (tileNoiseXY(x, y, size, 9, 7, 0x2f42) - 0.5) * 24;
          const fine = (tileNoiseXY(x, y, size, 26, 26, 0x2f43) - 0.5) * 9;
          const grain = (random() - 0.5) * 6;
          const base = 114 + patch + mottle + fine + grain;

          const chipField = tileNoiseXY(x, y, size, 34, 34, 0x2f44);
          jointSums.grime = 0;
          jointSums.dust = 0;
          accumulateJoint(jointsX, y, x, chipField);
          accumulateJoint(jointsZ, x, y, chipField);

          const jitter = (tileHash(x, y, 0x2f45) - 0.5) * 0.1;
          const shade = Math.min(1.25, Math.max(0, jointSums.grime + jitter * 0.5));
          const lift = Math.min(0.7, jointSums.dust) * (0.5 + patch / 90);
          data[i] = clampColor(base - shade * 88 + lift * 13);
          data[i + 1] = clampColor(base - shade * 82 + lift * 12);
          data[i + 2] = clampColor(base - shade * 70 + lift * 10);
          data[i + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);

      // Oil and rust pooling: soft, edge-free blooms instead of the straight
      // streaks that used to run the full width of every repeat. Kept large and
      // low-contrast so the shape does not read as a stamp repeating every tile.
      for (let i = 0; i < 8; i += 1) {
        const x = size * (0.12 + random() * 0.76);
        const y = size * (0.12 + random() * 0.76);
        const rx = 34 + random() * 86;
        const ry = rx * (0.4 + random() * 0.7);
        const warm = random() > 0.62;
        const stain = context.createRadialGradient(0, 0, 0, 0, 0, 1);
        stain.addColorStop(0, warm ? "rgba(92,52,24,0.2)" : "rgba(18,16,11,0.26)");
        stain.addColorStop(0.5, warm ? "rgba(92,52,24,0.09)" : "rgba(18,16,11,0.12)");
        stain.addColorStop(1, "rgba(0,0,0,0)");
        context.save();
        context.translate(x, y);
        context.scale(rx, ry);
        context.fillStyle = stain;
        context.beginPath();
        context.arc(0, 0, 1, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }

      // Hairline cracks, kept clear of the tile border so the repeat never
      // shows a crack that stops dead at a seam.
      context.globalAlpha = 0.24;
      context.strokeStyle = "#131109";
      context.lineWidth = 1;
      for (let i = 0; i < 4; i += 1) {
        let x = size * (0.16 + random() * 0.68);
        let y = size * (0.16 + random() * 0.68);
        let angle = random() * Math.PI * 2;
        context.beginPath();
        context.moveTo(x, y);
        const steps = 6 + Math.floor(random() * 7);
        for (let step = 0; step < steps; step += 1) {
          angle += (random() - 0.5) * 1.5;
          x = Math.max(size * 0.08, Math.min(size * 0.92, x + Math.cos(angle) * (10 + random() * 24)));
          y = Math.max(size * 0.08, Math.min(size * 0.92, y + Math.sin(angle) * (10 + random() * 24)));
          context.lineTo(x, y);
        }
        context.stroke();
      }
      context.globalAlpha = 1;

      drawSpeckles(context, size, 980, 0.11, "12,12,9", random);
      drawSpeckles(context, size, 340, 0.1, "156,132,104", random);
    }),
    11,
    9,
  );
}

export function createLevelTwoWallTexture() {
  return createLevelTwoGrimyTexture(0x2f2003, 1.2, 1.1, [130, 119, 96], 1.15);
}

export function createLevelTwoCeilingTexture() {
  return createLevelTwoGrimyTexture(0x2f2004, 8, 6, [105, 100, 82], 0.8);
}

export function createLevelTwoMetalTexture(seed = 0x2f2005) {
  const random = createSeededRandom(seed);
  return wrapCanvasTexture(
    paintCachedCanvas(["level-two-metal", seed].join("|"), 256, (context, size) => {
      const image = context.createImageData(size, size);
      const data = image.data;
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const i = (y * size + x) * 4;
          const wear = (tileNoise(x, y, size, 8, seed * 0.031) - 0.5) * 56;
          const rust = Math.max(0, tileNoise(x, y, size, 5, seed * 0.067) - 0.56) * 138;
          const grain = (random() - 0.5) * 16;
          data[i] = clampColor(116 + wear + rust + grain);
          data[i + 1] = clampColor(110 + wear * 0.78 + rust * 0.36 + grain);
          data[i + 2] = clampColor(96 + wear * 0.6 + rust * 0.12 + grain);
          data[i + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);
      context.strokeStyle = "rgba(24,21,17,0.22)";
      context.lineWidth = 1;
      for (let i = 0; i < 28; i += 1) {
        const x = random() * size;
        const y = random() * size;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + (random() - 0.5) * 11, y + 15 + random() * 70);
        context.stroke();
      }
    }),
    1,
    1,
  );
}

