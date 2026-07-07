const STORAGE_KEY = "backrooms-save";
const SAVE_VERSION = 1;

function safeStorage() {
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function safeParse(json) {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
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
  return { count: Math.max(0, Math.floor(raw.count ?? 0)) };
}

function sanitizeEntityState(raw) {
  if (!raw || typeof raw !== "object") return null;
  const position = raw.position;
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return null;
  const type = raw.type === "hound" ? "hound" : "bacteria";
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : type,
    type,
    position: { x: position.x, z: position.z },
    contact: Boolean(raw.contact),
  };
}

function sanitizeInventoryEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = raw.id;
  if (typeof id !== "string" || !id) return null;
  return {
    id,
    count: Math.max(1, Math.floor(raw.count ?? 1)),
    type: typeof raw.type === "string" ? raw.type : id,
  };
}

function sanitizePlayer(raw) {
  if (!raw || typeof raw !== "object") return null;
  const position = raw.position;
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return null;
  return {
    level: Math.max(0, Math.min(5, Math.floor(raw.level ?? 0))),
    position: {
      x: position.x,
      y: Number.isFinite(position.y) ? position.y : 0,
      z: position.z,
    },
    yaw: clampNumber(raw.yaw, 0),
    pitch: clampNumber(raw.pitch, -0.025),
    stamina: clampNumber(raw.stamina, 0),
    staminaMax: clampNumber(raw.staminaMax, 150),
    staminaBaseMax: clampNumber(raw.staminaBaseMax, 150),
    staminaRecoveryDelay: clampNumber(raw.staminaRecoveryDelay, 0),
    almondWaterTimer: clampNumber(raw.almondWaterTimer, 0),
    superAlmondWaterTimer: clampNumber(raw.superAlmondWaterTimer, 0),
    health: clampNumber(raw.health, 100),
    healthMax: clampNumber(raw.healthMax, 100),
    houndSlowTimer: clampNumber(raw.houndSlowTimer, 0),
    isSprinting: Boolean(raw.isSprinting),
    isDrinking: Boolean(raw.isDrinking),
    drinkTimer: clampNumber(raw.drinkTimer, 0),
    drinkItemId: typeof raw.drinkItemId === "string" ? raw.drinkItemId : null,
    drinkStaminaBonus: clampNumber(raw.drinkStaminaBonus, 0),
    runTime: clampNumber(raw.runTime, 0),
  };
}

function sanitizeFlashlight(raw) {
  if (!raw || typeof raw !== "object") return { owned: false, on: false, battery: 0 };
  return {
    owned: Boolean(raw.owned),
    on: Boolean(raw.on) && Boolean(raw.owned),
    battery: clampNumber(raw.battery, 0),
  };
}

function sanitizeDetector(raw) {
  if (!raw || typeof raw !== "object") return { owned: false, activeTimer: 0, cooldownTimer: 0 };
  return {
    owned: Boolean(raw.owned),
    activeTimer: clampNumber(raw.activeTimer, 0),
    cooldownTimer: clampNumber(raw.cooldownTimer, 0),
  };
}

export function hasSavedGame() {
  const storage = safeStorage();
  if (!storage) return false;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const parsed = safeParse(raw);
    return Boolean(parsed && parsed.version === SAVE_VERSION && parsed.player);
  } catch {
    return false;
  }
}

export function loadSave() {
  const storage = safeStorage();
  if (!storage) return null;
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  const parsed = safeParse(raw);
  if (!parsed || parsed.version !== SAVE_VERSION) return null;
  const player = sanitizePlayer(parsed.player);
  if (!player) return null;
  const inventory = Array.isArray(parsed.inventory)
    ? parsed.inventory.map(sanitizeInventoryEntry).filter(Boolean)
    : [];
  const equippedIndex = Math.max(-1, Math.min(inventory.length - 1, Math.floor(parsed.equippedIndex ?? -1)));
  const flashlight = sanitizeFlashlight(parsed.flashlight);
  const detector = sanitizeDetector(parsed.detector);
  const pickups = {};
  if (parsed.pickups && typeof parsed.pickups === "object") {
    for (const [levelKey, levelPickups] of Object.entries(parsed.pickups)) {
      const levelNum = Math.floor(Number(levelKey));
      if (!Number.isFinite(levelNum)) continue;
      const sanitized = {};
      if (levelPickups && typeof levelPickups === "object") {
        for (const [id, state] of Object.entries(levelPickups)) {
          const s = sanitizePickupState(state);
          if (s) sanitized[id] = s;
        }
      }
      pickups[levelNum] = sanitized;
    }
  }
  const interactions = {};
  if (parsed.interactions && typeof parsed.interactions === "object") {
    for (const [levelKey, levelInteractions] of Object.entries(parsed.interactions)) {
      const levelNum = Math.floor(Number(levelKey));
      if (!Number.isFinite(levelNum)) continue;
      const sanitized = {};
      if (levelInteractions && typeof levelInteractions === "object") {
        for (const [spotId, state] of Object.entries(levelInteractions)) {
          if (typeof spotId === "string" && spotId) {
            sanitized[spotId] = sanitizeInteractionState(state);
          }
        }
      }
      interactions[levelNum] = sanitized;
    }
  }
  const objectives = {};
  if (parsed.objectives && typeof parsed.objectives === "object") {
    for (const [levelKey, value] of Object.entries(parsed.objectives)) {
      const levelNum = Math.floor(Number(levelKey));
      if (!Number.isFinite(levelNum)) continue;
      objectives[levelNum] = { reached: Boolean(value?.reached) };
    }
  }
  const entities = {};
  if (parsed.entities && typeof parsed.entities === "object") {
    for (const [levelKey, list] of Object.entries(parsed.entities)) {
      const levelNum = Math.floor(Number(levelKey));
      if (!Number.isFinite(levelNum)) continue;
      if (Array.isArray(list)) {
        entities[levelNum] = list.map(sanitizeEntityState).filter(Boolean);
      }
    }
  }
  return {
    version: SAVE_VERSION,
    savedAt: clampNumber(parsed.savedAt, Date.now()),
    player,
    inventory,
    equippedIndex,
    flashlight,
    detector,
    pickups,
    interactions,
    objectives,
    entities,
  };
}

export function writeSave(updates) {
  const storage = safeStorage();
  if (!storage) return false;
  const current = loadSave();
  const merged = current
    ? {
        ...current,
        ...updates,
        pickups: { ...(current.pickups ?? {}), ...(updates.pickups ?? {}) },
        interactions: { ...(current.interactions ?? {}), ...(updates.interactions ?? {}) },
        objectives: { ...(current.objectives ?? {}), ...(updates.objectives ?? {}) },
        entities: { ...(current.entities ?? {}), ...(updates.entities ?? {}) },
      }
    : { ...updates };
  merged.version = SAVE_VERSION;
  merged.savedAt = Date.now();
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getInitialLevelFromSave(save) {
  if (!save?.player) return null;
  return save.player.level;
}

export function createPickupSnapshot({ active, respawnTimer, position, rotation }) {
  return {
    active: Boolean(active),
    respawnTimer: clampNumber(respawnTimer, 0),
    position: { x: position.x, y: 0, z: position.z },
    rotation: clampNumber(rotation, 0),
  };
}

export function createEntitySnapshot({ id, type, position, contact }) {
  return {
    id,
    type: type === "hound" ? "hound" : "bacteria",
    position: { x: position.x, z: position.z },
    contact: Boolean(contact),
  };
}
