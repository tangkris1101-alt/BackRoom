export const SAVE_VERSION = 2;
export const LEGACY_SAVE_VERSION = 1;
export const CLOUD_SAVE_SCHEMA_VERSION = 1;
export const MAX_SAVE_CHARS = 1_000_000;

const HUB_LEVEL = -1;
const PLAYABLE_LEVELS = new Set([HUB_LEVEL, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 37]);
const MAX_LEVEL_STATES = 32;
const MAX_STATES_PER_LEVEL = 256;
const MAX_PROGRESS_ENTRIES = 512;

function normalizeLevelId(level, legacy = false) {
  const normalized = Math.floor(level);
  if (legacy && normalized === 8) return HUB_LEVEL;
  return PLAYABLE_LEVELS.has(normalized) ? normalized : 0;
}

function limitedEntries(value, limit = MAX_LEVEL_STATES) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value).slice(0, limit);
}

function limitedArray(value, limit = MAX_STATES_PER_LEVEL) {
  return Array.isArray(value) ? value.slice(0, limit) : [];
}

function clampNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function sanitizePickupState(raw) {
  if (!raw || typeof raw !== "object") return null;
  const position = raw.position;
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return null;
  return {
    active: Boolean(raw.active),
    respawnTimer: clampNumber(raw.respawnTimer, 0),
    position: { x: position.x, y: 0, z: position.z },
    rotation: clampNumber(raw.rotation, 0),
  };
}

function sanitizeInteractionState(raw) {
  if (!raw || typeof raw !== "object") return { count: 0 };
  const state = { count: Math.max(0, Math.floor(raw.count ?? 0)) };
  if (typeof raw.unlocked === "boolean") state.unlocked = raw.unlocked;
  return state;
}

function sanitizeEntityState(raw) {
  if (!raw || typeof raw !== "object") return null;
  const position = raw.position;
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return null;
  const type = typeof raw.type === "string" && /^[a-z0-9-]{1,48}$/.test(raw.type)
    ? raw.type
    : "unknown";
  const savedId = typeof raw.id === "string" && raw.id ? raw.id : type;
  return {
    id: savedId === "super-bacteria" ? "bacteria" : savedId,
    type,
    position: { x: position.x, z: position.z },
    contact: Boolean(raw.contact),
    alertTimer: clampNumber(raw.alertTimer, 0),
    stunnedTimer: clampNumber(raw.stunnedTimer, 0),
    patrolIndex: Math.max(0, Math.floor(clampNumber(raw.patrolIndex, 0))),
    provokedTimer: Math.max(0, clampNumber(raw.provokedTimer, 0)),
  };
}

function sanitizeWorldItem(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || !raw.id) return null;
  const position = raw.position;
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return null;
  return {
    id: raw.id,
    active: raw.active !== false,
    position: {
      x: position.x,
      y: Number.isFinite(position.y) ? position.y : 0.24,
      z: position.z,
    },
    rotation: clampNumber(raw.rotation, 0),
    tiltX: clampNumber(raw.tiltX, 0),
    tiltZ: clampNumber(raw.tiltZ, 0),
    data: raw.data && typeof raw.data === "object"
      ? {
          battery: clampNumber(raw.data.battery, 0),
          activeTimer: clampNumber(raw.data.activeTimer, 0),
          cooldownTimer: clampNumber(raw.data.cooldownTimer, 0),
        }
      : null,
  };
}

function sanitizeInventoryEntry(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || !raw.id) return null;
  return {
    id: raw.id,
    count: Math.max(1, Math.min(999, Math.floor(raw.count ?? 1))),
    type: typeof raw.type === "string" ? raw.type.slice(0, 64) : raw.id,
  };
}

function sanitizePlayer(raw, legacy = false) {
  if (!raw || typeof raw !== "object") return null;
  const position = raw.position;
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return null;
  const almondWaterTimer = clampNumber(raw.almondWaterTimer, 0);
  const superAlmondWaterTimer = clampNumber(raw.superAlmondWaterTimer, 0);
  const staminaMax = superAlmondWaterTimer > 0 ? 250 : almondWaterTimer > 0 ? 150 : 100;
  return {
    level: normalizeLevelId(raw.level ?? 0, legacy),
    position: {
      x: position.x,
      y: Number.isFinite(position.y) ? position.y : 0,
      z: position.z,
    },
    yaw: clampNumber(raw.yaw, 0),
    pitch: clampNumber(raw.pitch, -0.025),
    stamina: Math.max(0, Math.min(clampNumber(raw.stamina, staminaMax), staminaMax)),
    staminaMax,
    staminaBaseMax: 100,
    staminaRecoveryDelay: Math.max(0, clampNumber(raw.staminaRecoveryDelay, 0)),
    almondWaterTimer: Math.max(0, almondWaterTimer),
    superAlmondWaterTimer: Math.max(0, superAlmondWaterTimer),
    health: Math.max(0, clampNumber(raw.health, 100)),
    healthMax: Math.max(1, clampNumber(raw.healthMax, 100)),
    isSprinting: Boolean(raw.isSprinting),
    sprintExhausted: Boolean(raw.sprintExhausted),
    isDrinking: Boolean(raw.isDrinking),
    drinkTimer: Math.max(0, clampNumber(raw.drinkTimer, 0)),
    drinkItemId: typeof raw.drinkItemId === "string" ? raw.drinkItemId.slice(0, 64) : null,
    drinkStaminaBonus: clampNumber(raw.drinkStaminaBonus, 0),
    runTime: Math.max(0, clampNumber(raw.runTime, 0)),
  };
}

function sanitizeFlashlight(raw) {
  if (!raw || typeof raw !== "object") return { owned: false, on: false, battery: 0 };
  return {
    owned: Boolean(raw.owned),
    on: Boolean(raw.on) && Boolean(raw.owned),
    battery: Math.max(0, clampNumber(raw.battery, 0)),
  };
}

function sanitizeDetector(raw) {
  if (!raw || typeof raw !== "object") return { owned: false, activeTimer: 0, cooldownTimer: 0 };
  return {
    owned: Boolean(raw.owned),
    activeTimer: Math.max(0, clampNumber(raw.activeTimer, 0)),
    cooldownTimer: Math.max(0, clampNumber(raw.cooldownTimer, 0)),
  };
}

export function parseAndSanitizeGameSave(value) {
  let parsed = value;
  if (typeof value === "string") {
    if (!value || value.length > MAX_SAVE_CHARS) return null;
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.version !== SAVE_VERSION && parsed.version !== LEGACY_SAVE_VERSION) return null;
  const legacy = parsed.version === LEGACY_SAVE_VERSION;
  const player = sanitizePlayer(parsed.player, legacy);
  if (!player) return null;
  const inventory = limitedArray(parsed.inventory).map(sanitizeInventoryEntry).filter(Boolean);
  const equippedIndex = Math.max(-1, Math.min(inventory.length - 1, Math.floor(parsed.equippedIndex ?? -1)));
  const pickups = {};
  for (const [levelKey, levelPickups] of limitedEntries(parsed.pickups)) {
    const levelNum = normalizeLevelId(Number(levelKey), legacy);
    const sanitized = {};
    for (const [id, state] of limitedEntries(levelPickups, MAX_STATES_PER_LEVEL)) {
      const next = sanitizePickupState(state);
      if (next && typeof id === "string" && id) sanitized[id.slice(0, 96)] = next;
    }
    pickups[levelNum] = sanitized;
  }
  const interactions = {};
  for (const [levelKey, levelInteractions] of limitedEntries(parsed.interactions)) {
    const levelNum = normalizeLevelId(Number(levelKey), legacy);
    const sanitized = {};
    for (const [spotId, state] of limitedEntries(levelInteractions, MAX_STATES_PER_LEVEL)) {
      if (typeof spotId === "string" && spotId) sanitized[spotId.slice(0, 96)] = sanitizeInteractionState(state);
    }
    interactions[levelNum] = sanitized;
  }
  const objectives = {};
  for (const [levelKey, objective] of limitedEntries(parsed.objectives)) {
    objectives[normalizeLevelId(Number(levelKey), legacy)] = { reached: Boolean(objective?.reached) };
  }
  const entities = {};
  for (const [levelKey, list] of limitedEntries(parsed.entities)) {
    entities[normalizeLevelId(Number(levelKey), legacy)] = limitedArray(list)
      .map(sanitizeEntityState)
      .filter(Boolean);
  }
  const worldItems = {};
  for (const [levelKey, list] of limitedEntries(parsed.worldItems)) {
    worldItems[normalizeLevelId(Number(levelKey), legacy)] = limitedArray(list)
      .map(sanitizeWorldItem)
      .filter(Boolean);
  }
  return {
    version: SAVE_VERSION,
    savedAt: clampNumber(parsed.savedAt, Date.now()),
    player,
    inventory,
    equippedIndex,
    flashlight: sanitizeFlashlight(parsed.flashlight),
    detector: sanitizeDetector(parsed.detector),
    pickups,
    interactions,
    objectives,
    entities,
    worldItems,
  };
}

function sanitizeIntegerProgress(value) {
  return [...new Set(limitedArray(value, MAX_PROGRESS_ENTRIES)
    .filter((entry) => Number.isInteger(entry) && PLAYABLE_LEVELS.has(entry)))]
    .sort((a, b) => a - b);
}

function sanitizeStringProgress(value) {
  return [...new Set(limitedArray(value, MAX_PROGRESS_ENTRIES)
    .filter((entry) => typeof entry === "string" && /^[a-z0-9-]{1,96}$/i.test(entry)))]
    .sort();
}

export function sanitizeCloudSaveEnvelope(raw) {
  if (!raw || typeof raw !== "object" || raw.schemaVersion !== CLOUD_SAVE_SCHEMA_VERSION) return null;
  const gameSave = parseAndSanitizeGameSave(raw.gameSave);
  if (!gameSave) return null;
  const progress = raw.progress && typeof raw.progress === "object" ? raw.progress : {};
  return {
    schemaVersion: CLOUD_SAVE_SCHEMA_VERSION,
    gameSave,
    progress: {
      reachedLevels: sanitizeIntegerProgress(progress.reachedLevels),
      completedLevels: sanitizeIntegerProgress(progress.completedLevels),
      pickedUpItems: sanitizeStringProgress(progress.pickedUpItems),
    },
    gameBuild: typeof raw.gameBuild === "string" ? raw.gameBuild.slice(0, 64) : "unknown",
    deviceId: typeof raw.deviceId === "string" && /^[a-z0-9-]{8,80}$/i.test(raw.deviceId)
      ? raw.deviceId
      : "unknown-device",
    clientSavedAt: Number.isFinite(raw.clientSavedAt) ? Math.max(0, raw.clientSavedAt) : gameSave.savedAt,
  };
}

export function createPickupSnapshot({ active, respawnTimer, position, rotation }) {
  return {
    active: Boolean(active),
    respawnTimer: clampNumber(respawnTimer, 0),
    position: { x: position.x, y: 0, z: position.z },
    rotation: clampNumber(rotation, 0),
  };
}

export function createEntitySnapshot({ id, type, position, contact, alertTimer = 0, stunnedTimer = 0, patrolIndex = 0, provokedTimer = 0 }) {
  return {
    id,
    type: typeof type === "string" && /^[a-z0-9-]{1,48}$/.test(type) ? type : "unknown",
    position: { x: position.x, z: position.z },
    contact: Boolean(contact),
    alertTimer: clampNumber(alertTimer, 0),
    stunnedTimer: clampNumber(stunnedTimer, 0),
    patrolIndex: Math.max(0, Math.floor(clampNumber(patrolIndex, 0))),
    provokedTimer: Math.max(0, clampNumber(provokedTimer, 0)),
  };
}
