import * as THREE from "three";
import groundDiffuseUrl from "../../assets/textures/level-ten/ground-030/diffuse.jpg?url";
import groundNormalUrl from "../../assets/textures/level-ten/ground-030/normal.jpg?url";
import groundRoughnessUrl from "../../assets/textures/level-ten/ground-030/roughness.jpg?url";
import groundAoUrl from "../../assets/textures/level-ten/ground-030/ao.jpg?url";
import barnDiffuseUrl from "../../assets/textures/level-ten/barn-planks/diffuse.jpg?url";
import barnNormalUrl from "../../assets/textures/level-ten/barn-planks/normal.jpg?url";
import barnArmUrl from "../../assets/textures/level-ten/barn-planks/arm.jpg?url";
import roofDiffuseUrl from "../../assets/textures/level-ten/roof-metal/diffuse.jpg?url";
import roofNormalUrl from "../../assets/textures/level-ten/roof-metal/normal.jpg?url";
import roofArmUrl from "../../assets/textures/level-ten/roof-metal/arm.jpg?url";

const loader = new THREE.TextureLoader();

function load(url, repeatX, repeatY, color = false) {
  const texture = loader.load(url);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 6;
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createLevelTenGroundMaps(repeatX, repeatY, { detail = true } = {}) {
  const maps = { map: load(groundDiffuseUrl, repeatX, repeatY, true) };
  if (!detail) return maps;
  maps.normalMap = load(groundNormalUrl, repeatX, repeatY);
  maps.roughnessMap = load(groundRoughnessUrl, repeatX, repeatY);
  maps.aoMap = load(groundAoUrl, repeatX, repeatY);
  return maps;
}

function createArmMaps(diffuse, normal, arm, repeatX, repeatY, detail) {
  const maps = { map: load(diffuse, repeatX, repeatY, true) };
  if (!detail) return maps;
  maps.normalMap = load(normal, repeatX, repeatY);
  const armMap = load(arm, repeatX, repeatY);
  maps.roughnessMap = armMap;
  maps.aoMap = armMap;
  maps.metalnessMap = armMap;
  return maps;
}

export const createLevelTenBarnMaps = (repeatX, repeatY, options = {}) => createArmMaps(
  barnDiffuseUrl, barnNormalUrl, barnArmUrl, repeatX, repeatY, options.detail !== false,
);
export const createLevelTenRoofMaps = (repeatX, repeatY, options = {}) => createArmMaps(
  roofDiffuseUrl, roofNormalUrl, roofArmUrl, repeatX, repeatY, options.detail !== false,
);

export function createWheatAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, 256, 256);
  const gradient = context.createLinearGradient(0, 256, 0, 0);
  gradient.addColorStop(0, "#6e7531");
  gradient.addColorStop(0.62, "#c6aa45");
  gradient.addColorStop(1, "#ead77a");
  context.strokeStyle = gradient;
  context.lineWidth = 6;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(128, 252);
  context.quadraticCurveTo(122, 142, 132, 28);
  context.stroke();
  context.fillStyle = "#d3b653";
  for (let index = 0; index < 9; index += 1) {
    const y = 42 + index * 13;
    const side = index % 2 ? -1 : 1;
    context.beginPath();
    context.ellipse(128 + side * 13, y, 18, 6, side * -0.55, 0, Math.PI * 2);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
