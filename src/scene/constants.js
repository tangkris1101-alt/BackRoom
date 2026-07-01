// 顶层共享常量 — 跨关卡使用的世界/实体参数。
// 关卡自身的尺寸（如 LEVEL_ONE_COLS）放在对应关卡目录里。

export const CELL_SIZE = 4;
export const WALL_HEIGHT = 3.72;
export const WALL_THICKNESS = 0.22;
export const CEILING_Y = 3.66;
export const MAX_POINT_LIGHTS = 12;
export const MIN_FIXTURE_DISTANCE = CELL_SIZE * 4.25;
export const SHOW_FIRST_PERSON_VIEW_MODEL = false;

export const ALMOND_WATER_STAMINA_BONUS = 50;
export const ALMOND_WATER_RESPAWN_MIN = 24;
export const ALMOND_WATER_RESPAWN_VARIANCE = 18;
export const ALMOND_WATER_INSPECT_DISTANCE = 8.0;
export const ALMOND_WATER_MODEL_SCALE = 0.72;
export const ALMOND_WATER_PICKUP_RADIUS = 3.2;

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

export const BACTERIA_CONTACT_RADIUS = 0.74;
export const BACTERIA_SPAWN_MIN_FROM_PLAYER = CELL_SIZE * 7;
export const BACTERIA_SPAWN_MAX_FROM_EXIT = CELL_SIZE * 6.4;
export const HOUND_CONTACT_RADIUS = 0.86;
export const ENTITY_INSPECT_DISTANCE = 10.5;
export const INTERACTION_RADIUS = 3.0;
export const INTERACTION_INSPECT_DISTANCE = 8.0;

export const LAYOUT_COLS = 31;
export const LAYOUT_ROWS = 27;

export const LEVEL_INFOS = new Map([
  [0, { level: 0, levelLabel: "LEVEL 0", levelName: "NOCLIP ZONE" }],
  [1, { level: 1, levelLabel: "LEVEL 1", levelName: "HABITABLE ZONE" }],
  [2, { level: 2, levelLabel: "LEVEL 2", levelName: "PIPE DREAMS" }],
  [3, { level: 3, levelLabel: "LEVEL 3", levelName: "ELECTRICAL STATION" }],
  [4, { level: 4, levelLabel: "LEVEL 4", levelName: "ABANDONED OFFICE" }],
]);

export function getBackroomsLevelInfo(level = 0) {
  return LEVEL_INFOS.get(Number(level)) ?? LEVEL_INFOS.get(0);
}

export function circleIntersectsAabb(x, z, radius, bounds) {
  const closestX = Math.max(bounds.minX, Math.min(x, bounds.maxX));
  const closestZ = Math.max(bounds.minZ, Math.min(z, bounds.maxZ));
  return (x - closestX) ** 2 + (z - closestZ) ** 2 < radius ** 2;
}