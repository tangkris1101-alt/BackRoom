import * as THREE from "three";
import asphaltDiffuseUrl from "../../assets/textures/level-eleven/asphalt-02/diffuse.jpg?url";
import asphaltNormalUrl from "../../assets/textures/level-eleven/asphalt-02/normal.jpg?url";
import asphaltArmUrl from "../../assets/textures/level-eleven/asphalt-02/arm.jpg?url";
import pavementDiffuseUrl from "../../assets/textures/level-eleven/pavement-04/diffuse.jpg?url";
import pavementNormalUrl from "../../assets/textures/level-eleven/pavement-04/normal.jpg?url";
import pavementArmUrl from "../../assets/textures/level-eleven/pavement-04/arm.jpg?url";
import brickDiffuseUrl from "../../assets/textures/level-eleven/red-brick-03/diffuse.jpg?url";
import brickNormalUrl from "../../assets/textures/level-eleven/red-brick-03/normal.jpg?url";
import brickArmUrl from "../../assets/textures/level-eleven/red-brick-03/arm.jpg?url";
import concreteDiffuseUrl from "../../assets/textures/level-eleven/concrete-wall-006/diffuse.jpg?url";
import concreteNormalUrl from "../../assets/textures/level-eleven/concrete-wall-006/normal.jpg?url";
import concreteArmUrl from "../../assets/textures/level-eleven/concrete-wall-006/arm.jpg?url";
import tileDiffuseUrl from "../../assets/textures/long-white-tiles/diff.jpg?url";
import tileNormalUrl from "../../assets/textures/long-white-tiles/normal.jpg?url";
import tileRoughnessUrl from "../../assets/textures/long-white-tiles/roughness.jpg?url";
import tileAoUrl from "../../assets/textures/long-white-tiles/ao.jpg?url";
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

function armSet(diffuse, normal, arm, repeatX, repeatY, detail) {
  const maps = { map: load(diffuse, repeatX, repeatY, true) };
  if (!detail) return maps;
  maps.normalMap = load(normal, repeatX, repeatY);
  const armMap = load(arm, repeatX, repeatY);
  maps.roughnessMap = armMap;
  maps.aoMap = armMap;
  maps.metalnessMap = armMap;
  return maps;
}

function pbrSet(diffuse, normal, roughness, ao, repeatX, repeatY, detail) {
  const maps = { map: load(diffuse, repeatX, repeatY, true) };
  if (!detail) return maps;
  maps.normalMap = load(normal, repeatX, repeatY);
  maps.roughnessMap = load(roughness, repeatX, repeatY);
  maps.aoMap = load(ao, repeatX, repeatY);
  return maps;
}

export const createLevelElevenAsphaltMaps = (x, y, detail = true) => armSet(asphaltDiffuseUrl, asphaltNormalUrl, asphaltArmUrl, x, y, detail);
export const createLevelElevenPavementMaps = (x, y, detail = true) => armSet(pavementDiffuseUrl, pavementNormalUrl, pavementArmUrl, x, y, detail);
export const createLevelElevenBrickMaps = (x, y, detail = true) => armSet(brickDiffuseUrl, brickNormalUrl, brickArmUrl, x, y, detail);
export const createLevelElevenConcreteMaps = (x, y, detail = true) => armSet(concreteDiffuseUrl, concreteNormalUrl, concreteArmUrl, x, y, detail);
export const createLevelElevenTileMaps = (x, y, detail = true) => pbrSet(tileDiffuseUrl, tileNormalUrl, tileRoughnessUrl, tileAoUrl, x, y, detail);
export const createLevelElevenInteriorFloorMaps = (x, y, detail = true) => pbrSet(floorDiffuseUrl, floorNormalUrl, floorRoughnessUrl, floorAoUrl, x, y, detail);
