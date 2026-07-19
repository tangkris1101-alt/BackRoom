import assert from "node:assert/strict";

const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
};

const { loadSave, createEntitySnapshot } = await import("../src/save.js");
const levelOne = await import("../src/scene/level-one/layout.js");
const levelThree = await import("../src/scene/level-three/layout.js");
const levelSix = await import("../src/scene/level-six/layout.js");
const levelEight = await import("../src/scene/level-eight/layout.js");
const levelThirtySeven = await import("../src/scene/level-thirty-seven/layout.js");
const { FIRESALT_EFFECT_RADIUS, FIRESALT_STUN_DURATION } = await import("../src/scene/constants.js");

function canReach({ cols, rows, start, target, isOpen }) {
  const queue = [[start.col, start.row]];
  const visited = new Set([`${start.col},${start.row}`]);
  for (let index = 0; index < queue.length; index += 1) {
    const [col, row] = queue[index];
    if (col === target.col && row === target.row) return true;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nextCol = col + dc;
      const nextRow = row + dr;
      const key = `${nextCol},${nextRow}`;
      if (nextCol < 0 || nextCol >= cols || nextRow < 0 || nextRow >= rows || visited.has(key) || !isOpen(nextCol, nextRow)) continue;
      visited.add(key);
      queue.push([nextCol, nextRow]);
    }
  }
  return false;
}

function savedPlayer(level) {
  return { level, position: { x: 1, y: 0, z: 2 }, stamina: 100, health: 100 };
}

function loadFixture(version, level, entities = {}) {
  storage.set("backrooms-save", JSON.stringify({ version, player: savedPlayer(level), entities }));
  return loadSave();
}

assert.deepEqual(
  [levelOne.LEVEL_ONE_COLS, levelOne.LEVEL_ONE_ROWS, levelThree.LEVEL_THREE_COLS, levelThree.LEVEL_THREE_ROWS, levelSix.LEVEL_SIX_COLS, levelSix.LEVEL_SIX_ROWS],
  [45, 33, 49, 31, 46, 35],
);
assert.deepEqual(
  [levelOne.LEVEL_ONE_ORIGIN_X, levelOne.LEVEL_ONE_ORIGIN_Z, levelThree.LEVEL_THREE_ORIGIN_X, levelThree.LEVEL_THREE_ORIGIN_Z, levelSix.LEVEL_SIX_ORIGIN_X, levelSix.LEVEL_SIX_ORIGIN_Z],
  [-70, -50, -78, -46, -72, -54],
);
assert.deepEqual(
  [levelEight.LEVEL_EIGHT_COLS, levelEight.LEVEL_EIGHT_ROWS, levelThirtySeven.LEVEL_THIRTY_SEVEN_COLS, levelThirtySeven.LEVEL_THIRTY_SEVEN_ROWS],
  [52, 40, 48, 36],
);
assert.equal(canReach({ cols: 52, rows: 40, start: levelEight.LEVEL_EIGHT_START_CELL, target: levelEight.LEVEL_EIGHT_TARGET_CELL, isOpen: levelEight.isLevelEightOpenCell }), true);
assert.equal(canReach({ cols: 48, rows: 36, start: levelThirtySeven.LEVEL_THIRTY_SEVEN_START_CELL, target: levelThirtySeven.LEVEL_THIRTY_SEVEN_TARGET_CELL, isOpen: levelThirtySeven.isLevelThirtySevenOpenCell }), true);
assert.equal(loadFixture(1, 8).player.level, -1);
assert.equal(loadFixture(2, 8).player.level, 8);
assert.equal(loadFixture(2, 37).player.level, 37);

const savedSmiler = loadFixture(2, 8, {
  8: [{ id: "smiler-1", type: "smiler", position: { x: 4, z: 5 }, alertTimer: 3, stunnedTimer: 2 }],
}).entities[8][0];
assert.equal(savedSmiler.type, "smiler");
assert.equal(savedSmiler.alertTimer, 3);
assert.equal(savedSmiler.stunnedTimer, 2);
assert.equal(createEntitySnapshot({ id: "future-entity", type: "future-entity", position: { x: 0, z: 0 } }).type, "future-entity");
assert.equal(FIRESALT_EFFECT_RADIUS, 8);
assert.equal(FIRESALT_STUN_DURATION, 4);

console.log("content expansion checks passed");
