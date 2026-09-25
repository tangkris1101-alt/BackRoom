import * as THREE from "three";
import wallDiffuseUrl from "../../assets/textures/level-twelve-thirteen/beige-wall-001/diffuse.jpg?url";
import wallNormalUrl from "../../assets/textures/level-twelve-thirteen/beige-wall-001/normal.jpg?url";
import wallArmUrl from "../../assets/textures/level-twelve-thirteen/beige-wall-001/arm.jpg?url";
import plasterVariationUrl from "../../assets/textures/level-eleven/concrete-wall-006/diffuse.jpg?url";
import floorDiffuseUrl from "../../assets/textures/concrete-floor-worn/diff.jpg?url";
import floorNormalUrl from "../../assets/textures/concrete-floor-worn/normal.jpg?url";
import floorRoughnessUrl from "../../assets/textures/concrete-floor-worn/roughness.jpg?url";
import floorAoUrl from "../../assets/textures/concrete-floor-worn/ao.jpg?url";
import originalWoodDiffuseUrl from "../../assets/textures/level-five/dark-wood/diffuse.jpg?url";
import originalWoodNormalUrl from "../../assets/textures/level-five/dark-wood/normal.jpg?url";
import originalWoodRoughnessUrl from "../../assets/textures/level-five/dark-wood/roughness.jpg?url";
import fieldWoodDiffuseUrl from "../../assets/textures/level-twelve-thirteen/laminate-floor-03/diffuse.jpg?url";
import fieldWoodNormalUrl from "../../assets/textures/level-twelve-thirteen/laminate-floor-03/normal.jpg?url";
import fieldWoodArmUrl from "../../assets/textures/level-twelve-thirteen/laminate-floor-03/arm.jpg?url";

const loader = new THREE.TextureLoader();

function load(url, repeatX, repeatY, color = false, onLoad) {
  const texture = loader.load(url, onLoad);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 6;
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addSubtlePlasterVariation(texture) {
  const detailImage = new Image();
  detailImage.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = texture.image.width;
    canvas.height = texture.image.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(texture.image, 0, 0, canvas.width, canvas.height);
    const coating = context.getImageData(0, 0, canvas.width, canvas.height);
    context.drawImage(detailImage, 0, 0, canvas.width, canvas.height);
    const plaster = context.getImageData(0, 0, canvas.width, canvas.height);
    let average = 0;
    for (let index = 0; index < plaster.data.length; index += 4) {
      average += (plaster.data[index] + plaster.data[index + 1] + plaster.data[index + 2]) / 3;
    }
    average /= plaster.data.length / 4;
    for (let index = 0; index < coating.data.length; index += 4) {
      const luminance = (plaster.data[index] + plaster.data[index + 1] + plaster.data[index + 2]) / 3;
      const variation = THREE.MathUtils.clamp((luminance - average) * 0.2, -14, 9);
      for (let channel = 0; channel < 3; channel += 1) coating.data[index + channel] += variation;
    }
    context.putImageData(coating, 0, 0);
    texture.image = canvas;
    texture.needsUpdate = true;
  };
  detailImage.src = plasterVariationUrl;
}

export function createLevelTwelveWallMaps(repeatX, repeatY, detail = true) {
  const maps = { map: load(wallDiffuseUrl, repeatX, repeatY, true, addSubtlePlasterVariation) };
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

export function createLevelTwelveFurnitureMaps(style, detail = true) {
  if (style === "original") {
    const maps = { map: load(originalWoodDiffuseUrl, 1, 1, true) };
    if (detail) {
      maps.normalMap = load(originalWoodNormalUrl, 1, 1);
      maps.roughnessMap = load(originalWoodRoughnessUrl, 1, 1);
    }
    return maps;
  }
  const maps = { map: load(fieldWoodDiffuseUrl, 1, 1, true) };
  if (detail) {
    maps.normalMap = load(fieldWoodNormalUrl, 1, 1);
    const arm = load(fieldWoodArmUrl, 1, 1);
    maps.roughnessMap = arm;
  }
  return maps;
}
