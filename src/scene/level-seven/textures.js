import * as THREE from "three";

function makeCanvas(size = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return { canvas, ctx: canvas.getContext("2d") };
}

function makeTexture(canvas, repeatX, repeatY) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  return texture;
}

export function createLevelSevenRoomFloorTexture() {
  const { canvas, ctx } = makeCanvas(512);
  ctx.fillStyle = "#2b2520";
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = "rgba(95, 82, 72, 0.5)";
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
  for (let i = 0; i < 180; i += 1) {
    ctx.fillStyle = `rgba(35, 26, 18, ${0.12 + Math.random() * 0.2})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 4 + Math.random() * 16, 1 + Math.random() * 5);
  }
  return makeTexture(canvas, 8, 6);
}

export function createLevelSevenWallpaperTexture() {
  const { canvas, ctx } = makeCanvas(512);
  ctx.fillStyle = "#1f1919";
  ctx.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 42) {
    const gradient = ctx.createLinearGradient(x, 0, x + 42, 0);
    gradient.addColorStop(0, "rgba(78, 54, 58, 0.26)");
    gradient.addColorStop(0.52, "rgba(26, 20, 22, 0.16)");
    gradient.addColorStop(1, "rgba(88, 62, 62, 0.22)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, 0, 42, 512);
  }
  ctx.strokeStyle = "rgba(130, 92, 94, 0.22)";
  ctx.lineWidth = 2;
  for (let x = 20; x < 512; x += 42) {
    ctx.beginPath();
    for (let y = 0; y <= 512; y += 32) {
      const dx = Math.sin(y * 0.04) * 8;
      if (y === 0) ctx.moveTo(x + dx, y);
      else ctx.lineTo(x + dx, y);
    }
    ctx.stroke();
  }
  return makeTexture(canvas, 5, 2);
}

export function createLevelSevenCeilingTexture() {
  const { canvas, ctx } = makeCanvas(512);
  ctx.fillStyle = "#0a0809";
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = "rgba(82, 64, 54, 0.22)";
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
  return makeTexture(canvas, 6, 4);
}

export function createLevelSevenWaterTexture() {
  const { canvas, ctx } = makeCanvas(512);
  const gradient = ctx.createRadialGradient(256, 256, 20, 256, 256, 390);
  gradient.addColorStop(0, "#0f1d1f");
  gradient.addColorStop(1, "#010608");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 44; i += 1) {
    ctx.strokeStyle = `rgba(76, 116, 122, ${0.05 + Math.random() * 0.09})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    const y = Math.random() * 512;
    for (let x = -40; x <= 552; x += 24) {
      const waveY = y + Math.sin(x * 0.03 + i) * (8 + Math.random() * 8);
      if (x === -40) ctx.moveTo(x, waveY);
      else ctx.lineTo(x, waveY);
    }
    ctx.stroke();
  }
  return makeTexture(canvas, 7, 7);
}
