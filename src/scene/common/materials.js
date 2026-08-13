import * as THREE from "three";

const QUALITY_STORAGE_KEY = "backrooms:material:quality";

export const MATERIAL_QUALITY = {
  HIGH: "high",
  LOW: "low",
};

export const MATERIAL_PRESETS = Object.freeze({
  wallpaper: Object.freeze({ roughness: 0.9, metalness: 0 }),
  concrete: Object.freeze({ roughness: 0.94, metalness: 0 }),
  carpet: Object.freeze({ roughness: 0.98, metalness: 0 }),
  wood: Object.freeze({ roughness: 0.76, metalness: 0 }),
  metal: Object.freeze({ roughness: 0.48, metalness: 0.72 }),
  wet: Object.freeze({ roughness: 0.34, metalness: 0.04 }),
  entitySkin: Object.freeze({ roughness: 0.68, metalness: 0 }),
});

let _currentQuality = null;

function loadQuality() {
  if (_currentQuality === null) {
    try {
      _currentQuality = localStorage.getItem(QUALITY_STORAGE_KEY) || MATERIAL_QUALITY.HIGH;
    } catch {
      _currentQuality = MATERIAL_QUALITY.HIGH;
    }
  }
  return _currentQuality;
}

export function isLowQuality() {
  return loadQuality() === MATERIAL_QUALITY.LOW;
}

export function getMaterialQuality() {
  return loadQuality();
}

export function setMaterialQuality(quality) {
  _currentQuality = quality;
  try {
    localStorage.setItem(QUALITY_STORAGE_KEY, quality);
  } catch { /* ignore */ }
}

/**
 * 根据当前画质创建材质。
 * HIGH → MeshStandardMaterial（完整 PBR）
 * LOW  → MeshLambertMaterial（顶点光照，性能优先）
 *
 * 降级时保留：color, emissive, emissiveIntensity, map, alphaMap,
 * transparent, opacity, side, visible
 * 丢弃：roughness, metalness, normalMap, normalScale, aoMap, aoMapIntensity 等
 */
export function createGameMaterial(propsOrFactory = {}) {
  const lowQuality = isLowQuality();
  const props = typeof propsOrFactory === "function"
    ? propsOrFactory({ lowQuality })
    : propsOrFactory;
  if (lowQuality) {
    const lambertProps = {};
    const keepKeys = [
      "color", "emissive", "emissiveIntensity", "map", "alphaMap",
      "transparent", "opacity", "side", "visible",
    ];
    for (const key of keepKeys) {
      if (key in props) lambertProps[key] = props[key];
    }
    return new THREE.MeshLambertMaterial(lambertProps);
  }
  return new THREE.MeshStandardMaterial(props);
}

export function createSemanticMaterial(preset, propsOrFactory = {}) {
  const defaults = MATERIAL_PRESETS[preset] ?? {};
  return createGameMaterial(({ lowQuality }) => {
    const props = typeof propsOrFactory === "function"
      ? propsOrFactory({ lowQuality })
      : propsOrFactory;
    return { ...defaults, ...props };
  });
}

/**
 * 条件性地应用 fixture light field。
 * 低画质下跳过自定义 shader（MeshLambertMaterial 不支持 onBeforeCompile），
 * 避免报错并保持性能。
 */
export function applyFixtureLightFieldIfNeeded(material, applyFn, ...args) {
  if (isLowQuality()) return;
  if (material?.isMeshStandardMaterial) {
    applyFn(material, ...args);
  }
}
