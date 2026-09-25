import * as THREE from "three";
import asphaltDiffuseUrl from "../../assets/textures/level-eleven/asphalt-02/diffuse.jpg?url";
import asphaltNormalUrl from "../../assets/textures/level-eleven/asphalt-02/normal.jpg?url";
import asphaltArmUrl from "../../assets/textures/level-eleven/asphalt-02/arm.jpg?url";
import { createSeededRandom, drawSpeckles, makeTexture } from "../common/texture-utils.js";

const textureLoader = new THREE.TextureLoader();

function loadAsphaltTexture(url, color = false) {
  const texture = textureLoader.load(url);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function suburbTexture(base, repeatX, repeatY, seed, lineColor) {
  return makeTexture(512, (context, size) => {
    const random = createSeededRandom(seed);
    context.fillStyle = base;
    context.fillRect(0, 0, size, size);
    drawSpeckles(context, size, 680, 0.22, "12,15,18", random);
    context.strokeStyle = lineColor;
    context.globalAlpha = 0.18;
    context.lineWidth = 2;
    for (let index = 0; index < 24; index += 1) {
      const offset = random() * size;
      context.beginPath();
      context.moveTo(0, offset);
      context.lineTo(size, offset + (random() - 0.5) * 28);
      context.stroke();
    }
    context.globalAlpha = 1;
  }, repeatX, repeatY);
}

export function createLevelNineAsphaltMaps(detail = true) {
  const maps = { map: loadAsphaltTexture(asphaltDiffuseUrl, true) };
  if (!detail) return maps;
  const arm = loadAsphaltTexture(asphaltArmUrl);
  maps.normalMap = loadAsphaltTexture(asphaltNormalUrl);
  maps.roughnessMap = arm;
  maps.aoMap = arm;
  maps.metalnessMap = arm;
  return maps;
}

export const createLevelNineGrassTexture = () => suburbTexture("#1c3026", 18, 14, 902, "#40543d");
