export const FOOTSTEP_SURFACE_PROFILES = Object.freeze({
  carpet: Object.freeze({
    filterType: "lowpass", cutoff: 560, q: 0.65, noiseGain: 0.5, duration: 0.13,
    thumpStart: 58, thumpEnd: 38, thumpGain: 0.48,
  }),
  concrete: Object.freeze({
    filterType: "bandpass", cutoff: 1560, q: 0.85, noiseGain: 0.92, duration: 0.12,
    thumpStart: 84, thumpEnd: 48, thumpGain: 0.68,
    toneType: "triangle", toneStart: 190, toneEnd: 118, toneGain: 0.07, toneDuration: 0.13,
  }),
  metal: Object.freeze({
    filterType: "highpass", cutoff: 980, q: 0.75, noiseGain: 0.72, duration: 0.1,
    thumpStart: 104, thumpEnd: 62, thumpGain: 0.55,
    toneType: "triangle", toneStart: 760, toneEnd: 390, toneGain: 0.18, toneDuration: 0.15,
  }),
  wood: Object.freeze({
    filterType: "bandpass", cutoff: 920, q: 1.1, noiseGain: 0.64, duration: 0.14,
    thumpStart: 72, thumpEnd: 42, thumpGain: 0.6,
    toneType: "triangle", toneStart: 205, toneEnd: 126, toneGain: 0.13, toneDuration: 0.17,
  }),
  water: Object.freeze({
    filterType: "bandpass", cutoff: 1220, q: 0.5, noiseGain: 1.12, duration: 0.23,
    thumpStart: 64, thumpEnd: 37, thumpGain: 0.44,
    toneType: "sine", toneStart: 235, toneEnd: 105, toneGain: 0.08, toneDuration: 0.2,
  }),
  rock: Object.freeze({
    filterType: "bandpass", cutoff: 2050, q: 1.15, noiseGain: 0.96, duration: 0.09,
    thumpStart: 94, thumpEnd: 54, thumpGain: 0.64,
    toneType: "triangle", toneStart: 330, toneEnd: 190, toneGain: 0.08, toneDuration: 0.1,
  }),
  grass: Object.freeze({
    filterType: "lowpass", cutoff: 760, q: 0.55, noiseGain: 0.6, duration: 0.17,
    thumpStart: 54, thumpEnd: 35, thumpGain: 0.38,
  }),
  asphalt: Object.freeze({
    filterType: "bandpass", cutoff: 1160, q: 0.72, noiseGain: 0.82, duration: 0.12,
    thumpStart: 78, thumpEnd: 45, thumpGain: 0.61,
  }),
});

const LEVEL_DEFAULT_SURFACES = new Map([
  [-1, "asphalt"],
  [0, "carpet"],
  [1, "concrete"],
  [2, "metal"],
  [3, "concrete"],
  [4, "carpet"],
  [5, "carpet"],
  [6, "concrete"],
  [7, "water"],
  [8, "rock"],
  [9, "grass"],
  [10, "grass"],
  [11, "asphalt"],
  [12, "concrete"],
  [13, "carpet"],
  [37, "water"],
]);

export function normalizeFootstepSurface(surface) {
  return Object.hasOwn(FOOTSTEP_SURFACE_PROFILES, surface) ? surface : "concrete";
}

export function getFootstepProfile(surface) {
  return FOOTSTEP_SURFACE_PROFILES[normalizeFootstepSurface(surface)];
}

export function resolveFootstepSurface(world, position) {
  const localSurface = world?.getFootstepSurface?.(position);
  const defaultSurface = LEVEL_DEFAULT_SURFACES.get(Number(world?.level));
  return normalizeFootstepSurface(localSurface ?? world?.footstepSurface ?? defaultSurface);
}
