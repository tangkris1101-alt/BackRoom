import * as THREE from "three";

export function enableAoUv(geometry) {
  const uv = geometry.getAttribute("uv");
  if (!uv) return geometry;
  if (!geometry.getAttribute("uv1")) geometry.setAttribute("uv1", uv.clone());
  if (!geometry.getAttribute("uv2")) geometry.setAttribute("uv2", uv.clone());
  return geometry;
}
// Procedural canvases are deterministic (every generator seeds its randomness),
// so a pattern only has to be painted once per session. Caching the *canvas* and
// not the Texture keeps world disposal working exactly as before: each level
// still owns its own Texture objects and disposes them on unload.
const canvasCache = new Map();
const CANVAS_CACHE_LIMIT = 64;

export function paintCachedCanvas(key, size, draw) {
  const cached = canvasCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext("2d"), size);
  if (canvasCache.size >= CANVAS_CACHE_LIMIT) {
    canvasCache.delete(canvasCache.keys().next().value);
  }
  canvasCache.set(key, canvas);
  return canvas;
}

export function wrapCanvasTexture(canvas, repeatX, repeatY, colorSpace = THREE.SRGBColorSpace) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = colorSpace;
  texture.anisotropy = 6;
  return texture;
}

export function makeTexture(size, draw, repeatX, repeatY) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext("2d"), size);
  return wrapCanvasTexture(canvas, repeatX, repeatY);
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
  return tileNoiseXY(x, y, size, cells, cells, seed);
}

/**
 * Seamless value noise with independent cell counts per axis. A stretched axis
 * (fewer cells) still wraps at the texture edge, so stained walls and slabs can
 * use vertically elongated features without a seam at every tile boundary.
 */
export function tileNoiseXY(x, y, size, cellsX, cellsY, seed) {
  const scaledX = (x / size) * cellsX;
  const scaledY = (y / size) * cellsY;
  const x0 = Math.floor(scaledX);
  const y0 = Math.floor(scaledY);
  const x1 = (x0 + 1) % cellsX;
  const y1 = (y0 + 1) % cellsY;
  const tx = smoothstep(scaledX - x0);
  const ty = smoothstep(scaledY - y0);
  const a = tileHash(x0 % cellsX, y0 % cellsY, seed);
  const b = tileHash(x1, y0 % cellsY, seed);
  const c = tileHash(x0 % cellsX, y1, seed);
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
