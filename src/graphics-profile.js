import { getMaterialQuality, MATERIAL_QUALITY } from "./scene/common/materials.js";

/**
 * @typedef {Object} GraphicsProfile
 * @property {"high"|"low"} id
 * @property {boolean} pbr
 * @property {boolean} shadows
 * @property {boolean} gtao
 * @property {number} minPixelRatio
 * @property {number} maxPixelRatio
 * @property {number} maxAnisotropy
 * @property {number} indoorShadowMapSize
 * @property {number} outdoorShadowMapSize
 * @property {number} maxShadowLights
 */

const PROFILES = Object.freeze({
  [MATERIAL_QUALITY.HIGH]: Object.freeze({
    id: MATERIAL_QUALITY.HIGH,
    pbr: true,
    shadows: true,
    gtao: true,
    minPixelRatio: 0.75,
    maxPixelRatio: 1.25,
    maxAnisotropy: 8,
    indoorShadowMapSize: 1024,
    outdoorShadowMapSize: 2048,
    maxShadowLights: 1,
  }),
  [MATERIAL_QUALITY.LOW]: Object.freeze({
    id: MATERIAL_QUALITY.LOW,
    pbr: false,
    shadows: false,
    gtao: false,
    minPixelRatio: 0.65,
    maxPixelRatio: 1,
    maxAnisotropy: 4,
    indoorShadowMapSize: 0,
    outdoorShadowMapSize: 0,
    maxShadowLights: 0,
  }),
});

export function getGraphicsProfile(quality = getMaterialQuality()) {
  return PROFILES[quality] ?? PROFILES[MATERIAL_QUALITY.HIGH];
}

export function getGraphicsProfiles() {
  return PROFILES;
}
