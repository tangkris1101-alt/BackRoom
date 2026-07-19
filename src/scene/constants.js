export const CELL_SIZE = 4;
export const WALL_HEIGHT = 3.72;
export const WALL_THICKNESS = 0.22;
export const CEILING_Y = 3.66;
export const MAX_POINT_LIGHTS = 12;
export const MIN_FIXTURE_DISTANCE = CELL_SIZE * 4.25;
export const SHOW_FIRST_PERSON_VIEW_MODEL = true;
export const ALMOND_WATER_PICKUP_RADIUS = 3.2;
export const ALMOND_WATER_STAMINA_BONUS = 50;
export const ALMOND_WATER_RESPAWN_MIN = 24;
export const ALMOND_WATER_RESPAWN_VARIANCE = 18;
export const ALMOND_WATER_INSPECT_DISTANCE = 8.0;
export const ALMOND_WATER_MODEL_SCALE = 0.72;
export const SUPER_ALMOND_WATER_RESPAWN_MIN = 92;
export const SUPER_ALMOND_WATER_RESPAWN_VARIANCE = 72;
export const SUPER_ALMOND_WATER_INITIAL_SPAWN_CHANCE = 0.22;
export const SUPER_ALMOND_WATER_RESPAWN_CHANCE = 0.32;
export const SUPER_ALMOND_WATER_MODEL_SCALE = 0.66;
export const FLASHLIGHT_PICKUP_RADIUS = 3.0;
export const FLASHLIGHT_INSPECT_DISTANCE = 8.0;
export const FLASHLIGHT_RESPAWN_MIN = 36;
export const FLASHLIGHT_RESPAWN_VARIANCE = 24;
export const DETECTOR_PICKUP_RADIUS = 3.0;
export const DETECTOR_INSPECT_DISTANCE = 8.0;
export const DETECTOR_RESPAWN_MIN = 84;
export const DETECTOR_RESPAWN_VARIANCE = 42;
export const COMPASS_PICKUP_RADIUS = 3.0;
export const COMPASS_INSPECT_DISTANCE = 8.0;
export const COMPASS_RESPAWN_MIN = 72;
export const COMPASS_RESPAWN_VARIANCE = 36;
export const SILENCE_LIQUID_PICKUP_RADIUS = 3.0;
export const SILENCE_LIQUID_INSPECT_DISTANCE = 8.0;
export const SILENCE_LIQUID_DURATION = 12;
export const SILENCE_LIQUID_REPEL_RADIUS = 14;
export const SILENCE_LIQUID_REPEL_SPEED_MULTIPLIER = 1.45;
export const SILENCE_LIQUID_RESPAWN_MIN = 68;
export const SILENCE_LIQUID_RESPAWN_VARIANCE = 46;
export const SILENCE_LIQUID_INITIAL_SPAWN_CHANCE = 0.48;
export const SILENCE_LIQUID_RESPAWN_CHANCE = 0.52;
export const SILENCE_LIQUID_MODEL_SCALE = 0.66;
export const FIRESALT_PICKUP_RADIUS = 3;
export const FIRESALT_INSPECT_DISTANCE = 8;
export const FIRESALT_RESPAWN_MIN = 74;
export const FIRESALT_RESPAWN_VARIANCE = 48;
export const FIRESALT_EFFECT_RADIUS = 8;
export const FIRESALT_STUN_DURATION = 4;
export const BACTERIA_CONTACT_RADIUS = 0.74;
export const BACTERIA_SPAWN_MIN_FROM_PLAYER = CELL_SIZE * 7;
export const BACTERIA_SPAWN_MAX_FROM_EXIT = CELL_SIZE * 6.4;
export const HOUND_CONTACT_RADIUS = 1.18;
export const ENTITY_SPEED_MULTIPLIER = 2;
export const ENTITY_INSPECT_DISTANCE = 10.5;
export const INTERACTION_RADIUS = 3.0;
export const INTERACTION_INSPECT_DISTANCE = 8.0;
export const HUB_LEVEL = -1;
export const PLAYABLE_LEVEL_IDS = Object.freeze([
  HUB_LEVEL,
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  37,
]);

// Level 0 grows toward positive X/Z so existing saved coordinates remain valid.
export const LAYOUT_COLS = 45;
export const LAYOUT_ROWS = 39;

const LEVEL_INFOS = new Map([
  [HUB_LEVEL, { level: HUB_LEVEL, levelLabel: "THE HUB", levelName: "NEXUS TUNNELS", danger: "safe" }],
  [0, { level: 0, levelLabel: "LEVEL 0", levelName: "NOCLIP ZONE", danger: "minimal" }],
  [1, { level: 1, levelLabel: "LEVEL 1", levelName: "HABITABLE ZONE", danger: "moderate" }],
  [2, { level: 2, levelLabel: "LEVEL 2", levelName: "PIPE DREAMS", danger: "moderate" }],
  [3, { level: 3, levelLabel: "LEVEL 3", levelName: "ELECTRICAL STATION", danger: "high" }],
  [4, { level: 4, levelLabel: "LEVEL 4", levelName: "ABANDONED OFFICE", danger: "moderate" }],
  [5, { level: 5, levelLabel: "LEVEL 5", levelName: "TERROR HOTEL", danger: "high" }],
  [6, { level: 6, levelLabel: "LEVEL 6", levelName: "LIGHTS OUT", danger: "high" }],
  [7, { level: 7, levelLabel: "LEVEL 7", levelName: "THALASSOPHOBIA", danger: "critical" }],
  [8, { level: 8, levelLabel: "LEVEL 8", levelName: "CAVE SYSTEMS", danger: "critical" }],
  [37, { level: 37, levelLabel: "LEVEL 37", levelName: "SUBLIMITY", danger: "safe" }],
]);

export function getBackroomsLevelInfo(level = 0) {
  return LEVEL_INFOS.get(Number(level)) ?? LEVEL_INFOS.get(0);
}

export function isPlayableLevel(level) {
  return PLAYABLE_LEVEL_IDS.includes(Number(level));
}

export function circleIntersectsAabb(x, z, radius, bounds) {
  const closestX = Math.max(bounds.minX, Math.min(x, bounds.maxX));
  const closestZ = Math.max(bounds.minZ, Math.min(z, bounds.maxZ));
  return (x - closestX) ** 2 + (z - closestZ) ** 2 < radius ** 2;
}
