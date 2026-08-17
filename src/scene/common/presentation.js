import * as THREE from "three";
import { HUB_LEVEL } from "../constants.js";

const DEFAULT_PRESENTATION = Object.freeze({
  exposure: 1,
  shadowMode: "indoor",
  shadow: null,
  surface: "concrete",
  environment: "indoor",
  reverb: "medium",
  post: Object.freeze({ aoIntensity: 0.58, vignette: 0.14, grain: 0.035, bloom: null, exposureDrift: 0 }),
});

const LEVEL_PRESENTATIONS = new Map([
  [HUB_LEVEL, { exposure: 0.86, shadowMode: "indoor", surface: "asphalt", environment: "tunnel", reverb: "large", post: { aoIntensity: 0.68, vignette: 0.2, grain: 0.04 } }],
  [0, { exposure: 0.98, shadowMode: "indoor", shadow: { penumbra: 0.9, radius: 4.5, intensityScale: 0.3, intensityCap: 1.15, angle: 0.5 }, surface: "carpet", environment: "carpeted-indoor", reverb: "medium", post: { aoIntensity: 0.55, vignette: 0.1, grain: 0.045, bloom: { threshold: 0.85, strength: 0.18, radius: 0.4 }, exposureDrift: 0.035 } }],
  [1, { exposure: 0.94, shadowMode: "indoor", surface: "concrete", environment: "industrial", reverb: "large", post: { aoIntensity: 0.62, vignette: 0.18, grain: 0.04 } }],
  [2, { exposure: 0.82, shadowMode: "indoor", surface: "metal", environment: "industrial", reverb: "large", post: { aoIntensity: 0.72, vignette: 0.22, grain: 0.045 } }],
  [3, { exposure: 0.8, shadowMode: "indoor", surface: "concrete", environment: "industrial", reverb: "large", post: { aoIntensity: 0.72, vignette: 0.24, grain: 0.05 } }],
  [4, { exposure: 1, shadowMode: "indoor", surface: "carpet", environment: "office", reverb: "small", post: { aoIntensity: 0.58, vignette: 0.13, grain: 0.03 } }],
  [5, { exposure: 0.76, shadowMode: "indoor", surface: "carpet", environment: "hotel", reverb: "medium", post: { aoIntensity: 0.72, vignette: 0.24, grain: 0.045 } }],
  [6, { exposure: 0.62, shadowMode: "indoor", surface: "concrete", environment: "dark-industrial", reverb: "large", post: { aoIntensity: 0.78, vignette: 0.3, grain: 0.055 } }],
  [7, { exposure: 0.78, shadowMode: "wet", surface: "water", environment: "water", reverb: "large", post: { aoIntensity: 0.6, vignette: 0.22, grain: 0.035 } }],
  [8, { exposure: 0.72, shadowMode: "wet", surface: "rock", environment: "cavern", reverb: "cavern", post: { aoIntensity: 0.76, vignette: 0.25, grain: 0.04 } }],
  [9, { exposure: 0.68, shadowMode: "outdoor", surface: "grass", environment: "night-outdoor", reverb: "open", post: { aoIntensity: 0.5, vignette: 0.28, grain: 0.05 } }],
  [10, { exposure: 1, shadowMode: "outdoor", surface: "grass", environment: "day-outdoor", reverb: "open", post: { aoIntensity: 0.46, vignette: 0.1, grain: 0.02 } }],
  [11, { exposure: 0.94, shadowMode: "outdoor", surface: "asphalt", environment: "city-outdoor", reverb: "open", post: { aoIntensity: 0.54, vignette: 0.12, grain: 0.025 } }],
  [12, { exposure: 1.04, shadowMode: "indoor", surface: "concrete", environment: "matrix", reverb: "large", post: { aoIntensity: 0.5, vignette: 0.1, grain: 0.025 } }],
  [13, { exposure: 0.72, shadowMode: "indoor", surface: "carpet", environment: "apartments", reverb: "medium", post: { aoIntensity: 0.76, vignette: 0.28, grain: 0.05 } }],
  [37, { exposure: 1.02, shadowMode: "wet", surface: "water", environment: "pool", reverb: "large", post: { aoIntensity: 0.52, vignette: 0.12, grain: 0.025 } }],
]);

const SURFACE_STATES = Object.freeze({
  carpet: Object.freeze({ traction: 1, wetness: 0 }),
  concrete: Object.freeze({ traction: 0.98, wetness: 0 }),
  metal: Object.freeze({ traction: 0.93, wetness: 0 }),
  wood: Object.freeze({ traction: 0.97, wetness: 0 }),
  water: Object.freeze({ traction: 0.82, wetness: 1 }),
  rock: Object.freeze({ traction: 0.9, wetness: 0.2 }),
  grass: Object.freeze({ traction: 0.88, wetness: 0.15 }),
  asphalt: Object.freeze({ traction: 0.98, wetness: 0 }),
});

function mergePresentation(level, existing = {}) {
  const preset = LEVEL_PRESENTATIONS.get(Number(level)) ?? DEFAULT_PRESENTATION;
  return {
    ...DEFAULT_PRESENTATION,
    ...preset,
    ...existing,
    post: { ...DEFAULT_PRESENTATION.post, ...preset.post, ...existing.post },
  };
}

function collectFixtureEmitters(scene) {
  const emitters = [];
  scene.traverse((object) => {
    if (emitters.length >= 8 || (!object.isPointLight && !object.isSpotLight)) return;
    if (object.name?.includes("debug") || object.name?.includes("flashlight")) return;
    emitters.push({
      id: object.name || `fixture-${emitters.length + 1}`,
      type: "fixture-hum",
      object,
      maxDistance: Math.max(7, Math.min(24, object.distance || 14)),
    });
  });
  return emitters;
}

function normalizeMaterialTextures(material) {
  if (!material) return;
  const materials = Array.isArray(material) ? material : [material];
  materials.forEach((entry) => {
    if (!entry) return;
    if (entry.map) entry.map.colorSpace = THREE.SRGBColorSpace;
    for (const key of ["normalMap", "roughnessMap", "metalnessMap", "aoMap", "alphaMap", "bumpMap", "displacementMap"]) {
      if (entry[key]) entry[key].colorSpace = THREE.NoColorSpace;
    }
  });
}

export function applyWorldPresentation(world) {
  if (!world?.scene) return world;
  world.presentation = mergePresentation(world.level, world.presentation);
  const existingSurfaceResolver = world.getFootstepSurface?.bind(world);
  world.getSurfaceState = world.getSurfaceState ?? ((position) => {
    const surface = existingSurfaceResolver?.(position) ?? world.footstepSurface ?? world.presentation.surface;
    const state = SURFACE_STATES[surface] ?? SURFACE_STATES.concrete;
    return { id: surface, footstepSet: surface, ...state };
  });
  world.audioZones = world.audioZones ?? [{
    id: `level-${world.level}-environment`,
    type: world.presentation.environment,
    reverb: world.presentation.reverb,
    contains: () => true,
  }];
  world.audioEmitters = world.audioEmitters ?? collectFixtureEmitters(world.scene);
  if (Number(world.level) === 5 && !world.audioEmitters.some((emitter) => emitter.type === "music")) {
    world.audioEmitters.push({
      id: "level-five-lobby-jazz",
      type: "music",
      position: new THREE.Vector3(-32, 1.8, 4),
      maxDistance: 70,
    });
  }
  world.scene.traverse((object) => normalizeMaterialTextures(object.material));
  return world;
}

export function getLevelPresentation(level) {
  return mergePresentation(level);
}

export function hasLevelPresentation(level) {
  return LEVEL_PRESENTATIONS.has(Number(level));
}

export function getSurfaceState(surface) {
  return { id: surface, footstepSet: surface, ...(SURFACE_STATES[surface] ?? SURFACE_STATES.concrete) };
}
