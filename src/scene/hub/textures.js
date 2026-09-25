import * as THREE from "three";
import asphaltDiffuseUrl from "../../assets/textures/level-eleven/asphalt-02/diffuse.jpg?url";
import asphaltNormalUrl from "../../assets/textures/level-eleven/asphalt-02/normal.jpg?url";
import asphaltArmUrl from "../../assets/textures/level-eleven/asphalt-02/arm.jpg?url";
import concreteDiffuseUrl from "../../assets/textures/level-eleven/concrete-wall-006/diffuse.jpg?url";
import concreteNormalUrl from "../../assets/textures/level-eleven/concrete-wall-006/normal.jpg?url";
import concreteArmUrl from "../../assets/textures/level-eleven/concrete-wall-006/arm.jpg?url";
import walkwayDiffuseUrl from "../../assets/textures/concrete-floor-worn/diff.jpg?url";
import walkwayNormalUrl from "../../assets/textures/concrete-floor-worn/normal.jpg?url";
import walkwayRoughnessUrl from "../../assets/textures/concrete-floor-worn/roughness.jpg?url";

const loader = new THREE.TextureLoader();

function load(url, color = false) {
  const texture = loader.load(url);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return texture;
}

function createMaps(diffuse, normal, roughness) {
  return {
    map: load(diffuse, true),
    normalMap: load(normal),
    roughnessMap: load(roughness),
  };
}

export function createHubConcreteMaps() {
  return createMaps(concreteDiffuseUrl, concreteNormalUrl, concreteArmUrl);
}

export function createHubAsphaltMaps() {
  return createMaps(asphaltDiffuseUrl, asphaltNormalUrl, asphaltArmUrl);
}

export function createHubWalkwayMaps() {
  return createMaps(walkwayDiffuseUrl, walkwayNormalUrl, walkwayRoughnessUrl);
}
