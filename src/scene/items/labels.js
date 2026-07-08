import * as THREE from "three";
import { clampColor } from "../common/texture-utils.js";

export function createAlmondWaterLabelTexture(variant = "normal") {
  const isSuper = variant === "super";
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");

  context.fillStyle = isSuper ? "#fff0a8" : "#f5f0d4";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = isSuper ? "#9f7216" : "#2f6f94";
  context.fillRect(0, 0, canvas.width, 42);
  context.fillRect(0, canvas.height - 44, canvas.width, 44);

  const noise = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < noise.data.length; i += 4) {
    const grain = (Math.random() - 0.5) * 12;
    noise.data[i] = clampColor(noise.data[i] + grain);
    noise.data[i + 1] = clampColor(noise.data[i + 1] + grain);
    noise.data[i + 2] = clampColor(noise.data[i + 2] + grain);
  }
  context.putImageData(noise, 0, 0);

  context.fillStyle = isSuper ? "#fff8c4" : "#f9f5df";
  context.fillRect(58, 54, 292, 134);
  context.strokeStyle = isSuper ? "rgba(117, 74, 0, 0.5)" : "rgba(35, 76, 79, 0.42)";
  context.lineWidth = 4;
  context.strokeRect(58, 54, 292, 134);

  context.fillStyle = isSuper ? "#754300" : "#234c4f";
  context.font = isSuper ? "900 28px Arial, sans-serif" : "900 34px Arial, sans-serif";
  context.fillText(isSuper ? "SUPER" : "ALMOND", isSuper ? 98 : 82, 98);
  context.font = isSuper ? "900 27px Arial, sans-serif" : "900 32px Arial, sans-serif";
  context.fillText(isSuper ? "ALMOND WATER" : "WATER", isSuper ? 74 : 102, 138);
  context.font = "700 11px Arial, sans-serif";
  context.fillStyle = isSuper ? "#8e5d05" : "#5f6542";
  context.fillText(isSuper ? "RARE GOLDEN SUPPLY" : "LEVEL 0 SUPPLY", isSuper ? 91 : 106, 164);
  context.fillText(isSuper ? "250 CAP / RECOVERY x2" : "+50 STAMINA BOOST", isSuper ? 74 : 83, 181);

  context.fillStyle = isSuper ? "#ffd33f" : "#dccb83";
  context.beginPath();
  context.ellipse(304, 120, 28, 45, -0.12, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = isSuper ? "rgba(116, 65, 0, 0.48)" : "rgba(96, 82, 38, 0.35)";
  context.lineWidth = 3;
  context.stroke();
  context.strokeStyle = isSuper ? "rgba(125, 74, 0, 0.54)" : "rgba(86, 76, 34, 0.42)";
  context.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    context.beginPath();
    context.moveTo(286 + i * 7, 84 + i * 6);
    context.bezierCurveTo(302, 110, 302, 132, 287 + i * 6, 156 - i * 5);
    context.stroke();
  }

  context.fillStyle = isSuper ? "#80520b" : "#18303a";
  for (let x = 384; x < 462; x += 4) {
    const width = x % 12 === 0 ? 3 : 1;
    context.fillRect(x, 78, width, 88);
  }
  context.font = "700 10px Arial, sans-serif";
  context.fillStyle = isSuper ? "#9a6714" : "#24414a";
  context.fillText(isSuper ? "NOT FOR EVERYONE" : "NOT FROM HERE", isSuper ? 366 : 374, 190);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 2;
  texture.needsUpdate = true;
  return texture;
}

