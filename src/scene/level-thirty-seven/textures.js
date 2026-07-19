import { makeTexture, createSeededRandom } from "../common/texture-utils.js";
import * as THREE from "three";
import tileColorUrl from "../../assets/textures/long-white-tiles/diff.jpg?url";
import tileNormalUrl from "../../assets/textures/long-white-tiles/normal.jpg?url";
import tileRoughnessUrl from "../../assets/textures/long-white-tiles/roughness.jpg?url";
import tileAoUrl from "../../assets/textures/long-white-tiles/ao.jpg?url";

function tiles(base, grout, repeatX, repeatY, seed) {
  return makeTexture(512, (context, size) => {
    const random = createSeededRandom(seed);
    context.fillStyle = base;
    context.fillRect(0, 0, size, size);
    const tile = 64;
    context.strokeStyle = grout;
    context.lineWidth = 5;
    for (let y = 0; y <= size; y += tile) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(size, y); context.stroke();
    }
    for (let x = 0; x <= size; x += tile) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, size); context.stroke();
    }
    for (let i = 0; i < 110; i += 1) {
      context.fillStyle = `rgba(40,92,96,${random() * 0.045})`;
      context.fillRect(random() * size, random() * size, 5 + random() * 28, 1 + random() * 4);
    }
  }, repeatX, repeatY);
}
export const createLevelThirtySevenFloorTexture = () => tiles("#dce3dc", "#849b98", 24, 18, 3701);
export const createLevelThirtySevenWallTexture = () => tiles("#e8ece4", "#9bb0aa", 16, 8, 3702);
export const createLevelThirtySevenCeilingTexture = () => tiles("#e4e8df", "#a7b4ac", 18, 14, 3703);

export function createLevelThirtySevenPbrMaps(repeatX, repeatY) {
  const loader = new THREE.TextureLoader();
  const configure = (texture, color = false) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.anisotropy = 6;
    if (color) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };
  return {
    map: configure(loader.load(tileColorUrl), true),
    normalMap: configure(loader.load(tileNormalUrl)),
    roughnessMap: configure(loader.load(tileRoughnessUrl)),
    aoMap: configure(loader.load(tileAoUrl)),
  };
}
