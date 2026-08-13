import assert from "node:assert/strict";
import test from "node:test";
import {
  CLOUD_SAVE_SCHEMA_VERSION,
  parseAndSanitizeGameSave,
  sanitizeCloudSaveEnvelope,
} from "../src/save-schema.js";

function gameSave(version = 2, level = 0) {
  return {
    version,
    savedAt: 123,
    player: { level, position: { x: 1, y: 1.7, z: 2 }, health: 100 },
    inventory: [],
    equippedIndex: -1,
    flashlight: { owned: false, on: false, battery: 0 },
    detector: { owned: false, activeTimer: 0, cooldownTimer: 0 },
    pickups: {},
    interactions: { "-1": { "hub-door-level-2": { count: 0, unlocked: true } } },
    objectives: {},
    entities: {},
    worldItems: {},
  };
}

test("legacy saves retain the Level 8 to Hub migration", () => {
  assert.equal(parseAndSanitizeGameSave(gameSave(1, 8)).player.level, -1);
  assert.equal(parseAndSanitizeGameSave(gameSave(2, 8)).player.level, 8);
});

test("interaction unlock state survives shared sanitization", () => {
  const save = parseAndSanitizeGameSave(gameSave());
  assert.deepEqual(save.interactions[-1]["hub-door-level-2"], { count: 0, unlocked: true });
});

test("cloud envelopes normalize progress and reject malformed saves", () => {
  const envelope = sanitizeCloudSaveEnvelope({
    schemaVersion: CLOUD_SAVE_SCHEMA_VERSION,
    gameSave: gameSave(),
    progress: {
      reachedLevels: [0, 1, 1, 999],
      completedLevels: [0],
      pickedUpItems: ["0-flashlight", "../../bad"],
    },
    gameBuild: "test-build",
    deviceId: "device-12345678",
    clientSavedAt: 456,
  });
  assert.deepEqual(envelope.progress.reachedLevels, [0, 1]);
  assert.deepEqual(envelope.progress.pickedUpItems, ["0-flashlight"]);
  assert.equal(sanitizeCloudSaveEnvelope({ schemaVersion: 1, gameSave: {} }), null);
});
