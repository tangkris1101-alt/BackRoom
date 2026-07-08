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

export function createLevelSixFloorTexture() {
  const { canvas, ctx } = makeCanvas(512);
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
    const shade = 20 + Math.floor(Math.random() * 44);
    ctx.fillStyle = `rgba(${shade}, ${shade + 2}, ${shade + 4}, ${0.12 + Math.random() * 0.22})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 4, 1 + Math.random() * 4);
  }
  return makeTexture(canvas, 9, 7);
}

export function createLevelSixWallTexture() {
  const { canvas, ctx } = makeCanvas(512);
  ctx.fillStyle = "#090a0b";
  ctx.fillRect(0, 0, 512, 512);

  for (let x = 0; x < 512; x += 16) {
    const alpha = 0.04 + Math.random() * 0.08;
    ctx.fillStyle = `rgba(90, 96, 96, ${alpha})`;
    ctx.fillRect(x, 0, 2 + Math.random() * 8, 512);
  }

  ctx.strokeStyle = "rgba(120, 126, 120, 0.16)";
  ctx.lineWidth = 1;
  for (let y = 96; y < 512; y += 112) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.random() * 8);
    ctx.lineTo(512, y + Math.random() * 8);
    ctx.stroke();
  }

  for (let i = 0; i < 38; i += 1) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.strokeStyle = `rgba(160, 166, 150, ${0.08 + Math.random() * 0.1})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 10 + Math.random() * 60, y + (Math.random() - 0.5) * 40);
    ctx.stroke();
  }
  return makeTexture(canvas, 4, 2);
}

export function createLevelSixCeilingTexture() {
  const { canvas, ctx } = makeCanvas(512);
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
    ctx.fillStyle = `rgba(70, 72, 68, ${0.08 + Math.random() * 0.12})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 5, 1 + Math.random() * 3);
  }
  return makeTexture(canvas, 7, 5);
}
