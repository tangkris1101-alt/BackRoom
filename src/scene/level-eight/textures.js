import { makeTexture, createSeededRandom, drawSpeckles } from "../common/texture-utils.js";
import * as THREE from "three";
import rockColorUrl from "../../assets/textures/rock027/Rock027_1K-JPG_Color.jpg?url";
import rockNormalUrl from "../../assets/textures/rock027/Rock027_1K-JPG_NormalGL.jpg?url";
import rockRoughnessUrl from "../../assets/textures/rock027/Rock027_1K-JPG_Roughness.jpg?url";
import rockAoUrl from "../../assets/textures/rock027/Rock027_1K-JPG_AmbientOcclusion.jpg?url";

function rockTexture(base, repeatX, repeatY, seed) {
  return makeTexture(512, (context, size) => {
    const random = createSeededRandom(seed);
    context.fillStyle = base;
    context.fillRect(0, 0, size, size);
    for (let i = 0; i < 180; i += 1) {
      const shade = 35 + Math.floor(random() * 55);
      context.fillStyle = `rgba(${shade},${shade + 4},${shade + 2},${0.08 + random() * 0.18})`;
      context.beginPath();
      context.ellipse(random() * size, random() * size, 5 + random() * 34, 3 + random() * 22, random() * Math.PI, 0, Math.PI * 2);
      context.fill();
    }
    drawSpeckles(context, size, 520, 0.24, "12,15,14", random);
  }, repeatX, repeatY);
}

export const createLevelEightFloorTexture = () => rockTexture("#343a37", 18, 14, 801);
export const createLevelEightWallTexture = () => rockTexture("#3f4742", 22, 8, 802);
export const createLevelEightCeilingTexture = () => rockTexture("#242a28", 18, 14, 803);

export function createLevelEightPbrMaps(repeatX, repeatY) {
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
    map: configure(loader.load(rockColorUrl), true),
    normalMap: configure(loader.load(rockNormalUrl)),
    roughnessMap: configure(loader.load(rockRoughnessUrl)),
    aoMap: configure(loader.load(rockAoUrl)),
  };
}
