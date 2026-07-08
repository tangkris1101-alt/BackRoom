import * as THREE from "three";
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
  texture.anisotropy = 6;
  return texture;
}

export function createSeededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function clampColor(value) {
  return Math.max(0, Math.min(255, value));
}

export function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

export function tileHash(x, y, seed) {
  const value = Math.sin((x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453);
  return value - Math.floor(value);
}

export function tileNoise(x, y, size, cells, seed) {
  const scaledX = (x / size) * cells;
  const scaledY = (y / size) * cells;
  const x0 = Math.floor(scaledX);
  const y0 = Math.floor(scaledY);
  const x1 = (x0 + 1) % cells;
  const y1 = (y0 + 1) % cells;
  const tx = smoothstep(scaledX - x0);
  const ty = smoothstep(scaledY - y0);
  const a = tileHash(x0 % cells, y0 % cells, seed);
  const b = tileHash(x1, y0 % cells, seed);
  const c = tileHash(x0 % cells, y1, seed);
  const d = tileHash(x1, y1, seed);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

export function drawSpeckles(context, size, count, alpha, color = "0,0,0", random = Math.random) {
  for (let i = 0; i < count; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const radius = random() * 2.4 + 0.35;
    context.fillStyle = `rgba(${color},${random() * alpha})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
}
