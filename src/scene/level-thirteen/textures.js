import * as THREE from "three";
import wallDiffuseUrl from "../../assets/textures/level-twelve-thirteen/beige-wall-001/diffuse.jpg?url";
import wallNormalUrl from "../../assets/textures/level-twelve-thirteen/beige-wall-001/normal.jpg?url";
import wallArmUrl from "../../assets/textures/level-twelve-thirteen/beige-wall-001/arm.jpg?url";
import laminateDiffuseUrl from "../../assets/textures/level-twelve-thirteen/laminate-floor-03/diffuse.jpg?url";
import laminateNormalUrl from "../../assets/textures/level-twelve-thirteen/laminate-floor-03/normal.jpg?url";
import laminateArmUrl from "../../assets/textures/level-twelve-thirteen/laminate-floor-03/arm.jpg?url";
import carpetNormalUrl from "../../assets/textures/level-twelve-thirteen/carpet-011/normal.jpg?url";
import carpetRoughnessUrl from "../../assets/textures/level-twelve-thirteen/carpet-011/roughness.jpg?url";
import carpetAoUrl from "../../assets/textures/level-twelve-thirteen/carpet-011/ao.jpg?url";
import tileDiffuseUrl from "../../assets/textures/long-white-tiles/diff.jpg?url";
import tileNormalUrl from "../../assets/textures/long-white-tiles/normal.jpg?url";
import tileRoughnessUrl from "../../assets/textures/long-white-tiles/roughness.jpg?url";
import tileAoUrl from "../../assets/textures/long-white-tiles/ao.jpg?url";
import rustDiffuseUrl from "../../assets/textures/level-five/rusty-metal-05/diffuse.jpg?url";
import rustNormalUrl from "../../assets/textures/level-five/rusty-metal-05/normal.jpg?url";
import rustRoughnessUrl from "../../assets/textures/level-five/rusty-metal-05/roughness.jpg?url";

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

function armMaps(diffuse, normal, arm, x, y, detail) {
  const maps = { map: load(diffuse, x, y, true) };
  if (!detail) return maps;
  maps.normalMap = load(normal, x, y);
  const armMap = load(arm, x, y);
  maps.aoMap = armMap;
  maps.roughnessMap = armMap;
  maps.metalnessMap = armMap;
  return maps;
}

export const createLevelThirteenWallMaps = (x, y, detail = true) => armMaps(wallDiffuseUrl, wallNormalUrl, wallArmUrl, x, y, detail);
export const createLevelThirteenLaminateMaps = (x, y, detail = true) => armMaps(laminateDiffuseUrl, laminateNormalUrl, laminateArmUrl, x, y, detail);

export function createLevelThirteenCarpetMaps(x, y, detail = true) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  context.fillStyle = "#60472f";
  context.fillRect(0, 0, 512, 512);
  context.strokeStyle = "rgba(211,174,112,.38)";
  context.lineWidth = 13;
  for (let offset = -512; offset < 1024; offset += 96) {
    context.beginPath();
    context.moveTo(offset, 0);
    context.lineTo(offset + 512, 512);
    context.stroke();
    context.beginPath();
    context.moveTo(offset + 512, 0);
    context.lineTo(offset, 512);
    context.stroke();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(x, y);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 6;
  const maps = { map };
  if (!detail) return maps;
  maps.normalMap = load(carpetNormalUrl, x, y);
  maps.roughnessMap = load(carpetRoughnessUrl, x, y);
  maps.aoMap = load(carpetAoUrl, x, y);
  return maps;
}

export function createLevelThirteenTileMaps(x, y, detail = true) {
  const maps = { map: load(tileDiffuseUrl, x, y, true) };
  if (!detail) return maps;
  maps.normalMap = load(tileNormalUrl, x, y);
  maps.roughnessMap = load(tileRoughnessUrl, x, y);
  maps.aoMap = load(tileAoUrl, x, y);
  return maps;
}

export function createLevelThirteenRustMaps(x, y, detail = true) {
  const maps = { map: load(rustDiffuseUrl, x, y, true) };
  if (!detail) return maps;
  maps.normalMap = load(rustNormalUrl, x, y);
  maps.roughnessMap = load(rustRoughnessUrl, x, y);
  return maps;
}
