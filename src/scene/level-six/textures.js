import * as THREE from "three";
import { createSeededRandom, paintCachedCanvas } from "../common/texture-utils.js";

const FLOOR_SEED = 601;
const WALL_SEED = 602;
const CEILING_SEED = 603;

function makeTexture(canvas, repeatX, repeatY) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  return texture;
}

// The grain used to come from Math.random(); seeding it keeps the paint
// reproducible so the canvas can be reused for the rest of the session.
function paintLevelSixFloor(ctx) {
  const random = createSeededRandom(FLOOR_SEED);
  const gradient = ctx.createLinearGradient(0, 0, 512, 512);
  gradient.addColorStop(0, "#111315");
  gradient.addColorStop(1, "#060708");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = "rgba(80, 86, 90, 0.22)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  for (let i = 0; i < 420; i += 1) {
    const shade = 20 + Math.floor(random() * 44);
    ctx.fillStyle = `rgba(${shade}, ${shade + 2}, ${shade + 4}, ${0.12 + random() * 0.22})`;
    ctx.fillRect(random() * 512, random() * 512, 1 + random() * 4, 1 + random() * 4);
  }
}

export function createLevelSixFloorTexture() {
  const cacheKey = ["level-six-floor", FLOOR_SEED].join("|");
  return makeTexture(paintCachedCanvas(cacheKey, 512, paintLevelSixFloor), 9, 7);
}

function paintLevelSixWall(ctx) {
  const random = createSeededRandom(WALL_SEED);
  ctx.fillStyle = "#090a0b";
  ctx.fillRect(0, 0, 512, 512);

  for (let x = 0; x < 512; x += 16) {
    const alpha = 0.04 + random() * 0.08;
    ctx.fillStyle = `rgba(90, 96, 96, ${alpha})`;
    ctx.fillRect(x, 0, 2 + random() * 8, 512);
  }

  ctx.strokeStyle = "rgba(120, 126, 120, 0.16)";
  ctx.lineWidth = 1;
  for (let y = 96; y < 512; y += 112) {
    ctx.beginPath();
    ctx.moveTo(0, y + random() * 8);
    ctx.lineTo(512, y + random() * 8);
    ctx.stroke();
  }

  for (let i = 0; i < 38; i += 1) {
    const x = random() * 512;
    const y = random() * 512;
    ctx.strokeStyle = `rgba(160, 166, 150, ${0.08 + random() * 0.1})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 10 + random() * 60, y + (random() - 0.5) * 40);
    ctx.stroke();
  }
}

export function createLevelSixWallTexture() {
  const cacheKey = ["level-six-wall", WALL_SEED].join("|");
  return makeTexture(paintCachedCanvas(cacheKey, 512, paintLevelSixWall), 4, 2);
}

function paintLevelSixCeiling(ctx) {
  const random = createSeededRandom(CEILING_SEED);
  ctx.fillStyle = "#050606";
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = "rgba(90, 92, 88, 0.2)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  for (let i = 0; i < 150; i += 1) {
    ctx.fillStyle = `rgba(70, 72, 68, ${0.08 + random() * 0.12})`;
    ctx.fillRect(random() * 512, random() * 512, 2 + random() * 5, 1 + random() * 3);
  }
}

export function createLevelSixCeilingTexture() {
  const cacheKey = ["level-six-ceiling", CEILING_SEED].join("|");
  return makeTexture(paintCachedCanvas(cacheKey, 512, paintLevelSixCeiling), 7, 5);
}
