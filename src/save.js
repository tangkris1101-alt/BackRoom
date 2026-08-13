import {
  MAX_SAVE_CHARS,
  SAVE_VERSION,
  createEntitySnapshot,
  createPickupSnapshot,
  parseAndSanitizeGameSave,
} from "./save-schema.js";
import { getScopedStorageKey } from "./save-scope.js";

const STORAGE_KEY = "backrooms-save";

function safeStorage() {
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function storageKeyForAccount(accountId) {
  return arguments.length === 0
    ? getScopedStorageKey(STORAGE_KEY)
    : getScopedStorageKey(STORAGE_KEY, accountId);
}

export function hasSavedGame() {
  const storage = safeStorage();
  if (!storage) return false;
  try {
    const raw = storage.getItem(storageKeyForAccount());
    return Boolean(raw && raw.length <= MAX_SAVE_CHARS && parseAndSanitizeGameSave(raw));
  } catch {
    return false;
  }
}

export function loadSave() {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    return parseAndSanitizeGameSave(storage.getItem(storageKeyForAccount()));
  } catch {
    return null;
  }
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
        worldItems: { ...(current.worldItems ?? {}), ...(updates.worldItems ?? {}) },
      }
    : { ...updates };
  merged.version = SAVE_VERSION;
  merged.savedAt = Date.now();
  const sanitized = parseAndSanitizeGameSave(merged);
  if (!sanitized) return false;
  try {
    storage.setItem(storageKeyForAccount(), JSON.stringify(sanitized));
    return true;
  } catch {
    return false;
  }
}

export function replaceSave(save) {
  const storage = safeStorage();
  const sanitized = parseAndSanitizeGameSave(save);
  if (!storage || !sanitized) return false;
  try {
    storage.setItem(storageKeyForAccount(), JSON.stringify(sanitized));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(storageKeyForAccount());
  } catch {
    // ignore
  }
}

export function loadGuestSave() {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    return parseAndSanitizeGameSave(storage.getItem(storageKeyForAccount(null)));
  } catch {
    return null;
  }
}

export function getInitialLevelFromSave(save) {
  return save?.player?.level ?? null;
}

export { createEntitySnapshot, createPickupSnapshot };
