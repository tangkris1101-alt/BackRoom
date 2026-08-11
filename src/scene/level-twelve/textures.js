import * as THREE from "three";
import wallDiffuseUrl from "../../assets/textures/level-twelve-thirteen/beige-wall-001/diffuse.jpg?url";
import wallNormalUrl from "../../assets/textures/level-twelve-thirteen/beige-wall-001/normal.jpg?url";
import wallArmUrl from "../../assets/textures/level-twelve-thirteen/beige-wall-001/arm.jpg?url";
import floorDiffuseUrl from "../../assets/textures/concrete-floor-worn/diff.jpg?url";
import floorNormalUrl from "../../assets/textures/concrete-floor-worn/normal.jpg?url";
import floorRoughnessUrl from "../../assets/textures/concrete-floor-worn/roughness.jpg?url";
import floorAoUrl from "../../assets/textures/concrete-floor-worn/ao.jpg?url";

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

export function createLevelTwelveWallMaps(repeatX, repeatY, detail = true) {
  const maps = { map: load(wallDiffuseUrl, repeatX, repeatY, true) };
  if (!detail) return maps;
  maps.normalMap = load(wallNormalUrl, repeatX, repeatY);
  const arm = load(wallArmUrl, repeatX, repeatY);
  maps.aoMap = arm;
  maps.roughnessMap = arm;
  maps.metalnessMap = arm;
  return maps;
}

export function createLevelTwelveFloorMaps(repeatX, repeatY, detail = true) {
  const maps = { map: load(floorDiffuseUrl, repeatX, repeatY, true) };
  if (!detail) return maps;
  maps.normalMap = load(floorNormalUrl, repeatX, repeatY);
  maps.roughnessMap = load(floorRoughnessUrl, repeatX, repeatY);
  maps.aoMap = load(floorAoUrl, repeatX, repeatY);
  return maps;
}
