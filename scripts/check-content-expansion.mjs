import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";

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
const { collectLevelOneTransforms } = await import("../src/scene/level-one/props.js");
const levelThree = await import("../src/scene/level-three/layout.js");
const levelSix = await import("../src/scene/level-six/layout.js");
const levelEight = await import("../src/scene/level-eight/layout.js");
const levelThirtySeven = await import("../src/scene/level-thirty-seven/layout.js");
const { FIRESALT_EFFECT_RADIUS, FIRESALT_STUN_DURATION } = await import("../src/scene/constants.js");
const { createExitNetwork } = await import("../src/scene/common/exit-network.js");

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
const levelOneFixtures = collectLevelOneTransforms().fixturePositions;
assert.equal(levelOne.LEVEL_ONE_MAX_POINT_LIGHTS, 32);
assert.ok(levelOneFixtures.length >= 39);
assert.ok(levelOneFixtures.filter((fixture) => fixture.hasPointLight).length >= levelOne.LEVEL_ONE_MAX_POINT_LIGHTS);
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

// A focused door must win over a closer, unrelated route when F is pressed.
const doorTestScene = new THREE.Scene();
const doorTestCamera = new THREE.PerspectiveCamera();
doorTestCamera.position.set(0, 1.62, 2.4);
doorTestCamera.rotation.set(0, 0, 0);
const doorTestNetwork = createExitNetwork(doorTestScene, doorTestCamera, [
  { id: "focused-stairs", targetLevel: 4, targetLabel: "LEVEL 4", kind: "stair", position: { x: 0, z: 0 }, noSign: true },
  { id: "closer-wrong-door", targetLevel: 2, targetLabel: "LEVEL 2", kind: "door", position: { x: 0.4, z: 0.3 }, noSign: true },
]);
const focusedDoor = doorTestNetwork.inspect(doorTestCamera.position);
assert.equal(focusedDoor?.id, "focused-stairs");
const openedDoor = doorTestNetwork.interact(doorTestCamera.position, { routeId: focusedDoor?.id });
assert.equal(openedDoor?.id, "focused-stairs");
assert.equal(openedDoor?.interacted, true);

// Exit furniture must carry a visible fixture and a matching source light.
// In particular, elevator cabins may not use an opaque threshold plane that
// overlaps the closed doors and turns them into a black slab.
const exitLightScene = new THREE.Scene();
const exitLightCamera = new THREE.PerspectiveCamera();
createExitNetwork(exitLightScene, exitLightCamera, [
  { id: "lit-elevator", targetLevel: 2, kind: "elevator", position: { x: 0, z: 0 }, noSign: true },
  { id: "lit-cabinet", targetLevel: -1, kind: "cabinet", position: { x: 5, z: 0 }, noSign: true },
]);
const elevatorModel = exitLightScene.getObjectByName("exit-network-lit-elevator");
const cabinetModel = exitLightScene.getObjectByName("exit-network-lit-cabinet");
assert.equal(elevatorModel?.getObjectByName("exit-header-light-lit-elevator")?.isPointLight, true);
assert.equal(cabinetModel?.getObjectByName("exit-header-light-lit-cabinet")?.isPointLight, true);
assert.equal(elevatorModel?.getObjectByName("exit-portal-lit-elevator"), undefined);

for (const level of ["one", "two", "three", "four", "five", "six", "seven"]) {
  const source = await readFile(new URL(`../src/scene/level-${level}/index.js`, import.meta.url), "utf8");
  assert.match(source, /interact:\s*\(playerPosition, access\)\s*=>\s*exitNetwork\.interact\(playerPosition, access\)/);
}

console.log("content expansion checks passed");
