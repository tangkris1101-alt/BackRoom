import * as THREE from "three";

// 纹理构建工具 — 程序化生成 canvas 纹理。

export function makeTexture(size, draw, repeatX, repeatY) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  draw(context, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

export function clampColor(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

export function tileHash(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

export function tileNoise(x, y, size, cells, seed) {
  const nx = (x / size) * cells;
  const ny = (y / size) * cells;
  const xi = Math.floor(nx);
  const yi = Math.floor(ny);
  const xf = smoothstep(nx - xi);
  const yf = smoothstep(ny - yi);
  const a = tileHash(xi, yi, seed);
  const b = tileHash(xi + 1, yi, seed);
  const c = tileHash(xi, yi + 1, seed);
  const d = tileHash(xi + 1, yi + 1, seed);
  const ab = a + (b - a) * xf;
  const cd = c + (d - c) * xf;
  return ab + (cd - ab) * yf;
}

export function drawSpeckles(context, size, count, alpha, color = "0,0,0", random = Math.random) {
  context.fillStyle = `rgba(${color},${alpha})`;
  for (let i = 0; i < count; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const r = 0.4 + random() * 1.6;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
  }
}