import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";

const storage = new Map();
globalThis.window = {
  addEventListener: () => {},
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
};
globalThis.document = { addEventListener: () => {} };

const { loadSave, createEntitySnapshot } = await import("../src/save.js");
const levelOne = await import("../src/scene/level-one/layout.js");
const { collectLevelOneTransforms } = await import("../src/scene/level-one/props.js");
const levelThree = await import("../src/scene/level-three/layout.js");
const levelFive = await import("../src/scene/level-five/layout.js");
const { collectLevelFiveTransforms } = await import("../src/scene/level-five/props.js");
const levelSix = await import("../src/scene/level-six/layout.js");
const levelEight = await import("../src/scene/level-eight/layout.js");
const levelNine = await import("../src/scene/level-nine/layout.js");
const levelTen = await import("../src/scene/level-ten/layout.js");
const levelEleven = await import("../src/scene/level-eleven/layout.js");
const levelTwelve = await import("../src/scene/level-twelve/layout.js");
const levelThirteen = await import("../src/scene/level-thirteen/layout.js");
const levelThirtySeven = await import("../src/scene/level-thirty-seven/layout.js");
const levelZero = await import("../src/scene/level-zero/layout.js");
const levelZeroWorld = await import("../src/scene/level-zero/world.js");
const { CELL_SIZE, FIRESALT_EFFECT_RADIUS, FIRESALT_STUN_DURATION, PLAYABLE_LEVEL_IDS } = await import("../src/scene/constants.js");
const { createExitNetwork } = await import("../src/scene/common/exit-network.js");
const { createLocalRelocationNetwork } = await import("../src/scene/common/local-relocation.js");
const { createMatrixProgression } = await import("../src/scene/level-twelve/matrix-progression.js");
const { createPassivePatrolState } = await import("../src/scene/entities/passive-patrol.js");
const { createInteractionSpot } = await import("../src/scene/entities/interactions.js");
const { resolveHubEntry } = await import("../src/scene/hub/entry.js");
const { LEVEL_KEY_TARGETS } = await import("../src/scene/common/world-items.js");

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
// Level 5's modeled stairwell leaves through the north edge of cell 7,5.
// Its throat must be truly open, rather than revealing a wallpapered grid wall.
assert.equal(levelFive.isLevelFiveOpenCell(7, 4), true);
const levelFiveStairCenter = levelFive.levelFiveCellCenter(7, 5);
assert.equal(
  collectLevelFiveTransforms().northSouth.some(
    (wall) => wall.x === levelFiveStairCenter.x && wall.z === levelFiveStairCenter.z - CELL_SIZE / 2,
  ),
  false,
);
assert.deepEqual(
  [levelEight.LEVEL_EIGHT_COLS, levelEight.LEVEL_EIGHT_ROWS, levelThirtySeven.LEVEL_THIRTY_SEVEN_COLS, levelThirtySeven.LEVEL_THIRTY_SEVEN_ROWS],
  [52, 40, 48, 36],
);
assert.equal(canReach({ cols: 52, rows: 40, start: levelEight.LEVEL_EIGHT_START_CELL, target: levelEight.LEVEL_EIGHT_TARGET_CELL, isOpen: levelEight.isLevelEightOpenCell }), true);
assert.deepEqual([levelNine.LEVEL_NINE_COLS, levelNine.LEVEL_NINE_ROWS], [52, 40]);
assert.equal(canReach({ cols: 52, rows: 40, start: levelNine.LEVEL_NINE_START_CELL, target: levelNine.LEVEL_NINE_TARGET_CELL, isOpen: levelNine.isLevelNineOpenCell }), true);
assert.equal(levelNine.isLevelNineOpenCell(2, 2), true);
assert.equal(levelNine.isLevelNineOpenCell(0, 0), false);
assert.equal(levelNine.isLevelNineRoadCell(levelNine.LEVEL_NINE_START_CELL.col, levelNine.LEVEL_NINE_START_CELL.row), true);
assert.deepEqual([levelTen.LEVEL_TEN_COLS, levelTen.LEVEL_TEN_ROWS], [56, 42]);
assert.equal(canReach({ cols: 56, rows: 42, start: levelTen.LEVEL_TEN_START_CELL, target: levelTen.LEVEL_TEN_TARGET_CELL, isOpen: levelTen.isLevelTenOpenCell }), true);
assert.equal(levelTen.LEVEL_TEN_WHEAT_PLOTS.length, 12);
assert.deepEqual([levelEleven.LEVEL_ELEVEN_COLS, levelEleven.LEVEL_ELEVEN_ROWS], [60, 48]);
assert.equal(canReach({ cols: 60, rows: 48, start: levelEleven.LEVEL_ELEVEN_START_CELL, target: levelEleven.LEVEL_ELEVEN_BACKROAD_CELL, isOpen: levelEleven.isLevelElevenOpenCell }), true);
assert.equal(canReach({ cols: 60, rows: 48, start: levelEleven.LEVEL_ELEVEN_START_CELL, target: levelEleven.LEVEL_ELEVEN_POOL_EXIT_CELL, isOpen: levelEleven.isLevelElevenOpenCell }), true);
assert.equal(canReach({ cols: 60, rows: 48, start: levelEleven.LEVEL_ELEVEN_START_CELL, target: levelEleven.LEVEL_ELEVEN_MATRIX_WINDOW_CELL, isOpen: levelEleven.isLevelElevenOpenCell }), true);
assert.equal(canReach({ cols: 60, rows: 48, start: levelEleven.LEVEL_ELEVEN_START_CELL, target: levelEleven.LEVEL_ELEVEN_APARTMENT_EXIT_CELL, isOpen: levelEleven.isLevelElevenOpenCell }), true);
assert.deepEqual([levelTwelve.LEVEL_TWELVE_COLS, levelTwelve.LEVEL_TWELVE_ROWS], [40, 34]);
for (const target of [levelTwelve.LEVEL_TWELVE_COPYCAT_CELL, levelTwelve.LEVEL_TWELVE_STAIR_CELL, levelTwelve.LEVEL_TWELVE_EXIT_CELL]) {
  assert.equal(canReach({ cols: 40, rows: 34, start: levelTwelve.LEVEL_TWELVE_START_CELL, target, isOpen: levelTwelve.isLevelTwelveOpenCell }), true);
}
assert.deepEqual([levelThirteen.LEVEL_THIRTEEN_COLS, levelThirteen.LEVEL_THIRTEEN_ROWS], [72, 42]);
assert.deepEqual(levelThirteen.LEVEL_THIRTEEN_FLOORS.map((floor) => floor.id), [0, 71, 283]);
assert.equal(levelThirteen.LEVEL_THIRTEEN_APARTMENTS.length, 5);
assert.equal(levelThirteen.getLevelThirteenSpawnFloor(11).id, 0);
assert.equal(levelThirteen.getLevelThirteenSpawnFloor(12).id, 283);
assert.equal(levelThirteen.getLevelThirteenSpawnFloor(-1).id, 71);
assert.equal(levelThirteen.updateLevelThirteenLethargy(0, true, 45), 1);
assert.equal(levelThirteen.updateLevelThirteenLethargy(1, false, 12), 0);
for (const [col, row] of [[11, 37], [35, 37], [35, 4], [59, 4], [18, 7], [42, 12], [55, 19], [41, 12]]) {
  assert.equal(levelThirteen.isLevelThirteenOpenCell(col, row), true, `Level 13 route cell ${col},${row} must be open`);
}
assert.equal(canReach({ cols: 48, rows: 36, start: levelThirtySeven.LEVEL_THIRTY_SEVEN_START_CELL, target: levelThirtySeven.LEVEL_THIRTY_SEVEN_TARGET_CELL, isOpen: levelThirtySeven.isLevelThirtySevenOpenCell }), true);
assert.equal(loadFixture(1, 8).player.level, -1);
assert.equal(loadFixture(2, 8).player.level, 8);
assert.equal(loadFixture(2, 9).player.level, 9);
assert.equal(loadFixture(2, 10).player.level, 10);
assert.equal(loadFixture(2, 11).player.level, 11);
assert.equal(loadFixture(2, 12).player.level, 12);
assert.equal(loadFixture(2, 13).player.level, 13);
assert.equal(loadFixture(2, 37).player.level, 37);
assert.deepEqual(LEVEL_KEY_TARGETS, PLAYABLE_LEVEL_IDS.filter((level) => level !== -1));

const savedSmiler = loadFixture(2, 8, {
  8: [{ id: "smiler-1", type: "smiler", position: { x: 4, z: 5 }, alertTimer: 3, stunnedTimer: 2 }],
}).entities[8][0];
assert.equal(savedSmiler.type, "smiler");
assert.equal(savedSmiler.alertTimer, 3);
assert.equal(savedSmiler.stunnedTimer, 2);
assert.equal(createEntitySnapshot({ id: "future-entity", type: "future-entity", position: { x: 0, z: 0 } }).type, "future-entity");
assert.equal(FIRESALT_EFFECT_RADIUS, 8);
assert.equal(FIRESALT_STUN_DURATION, 4);
assert.equal(levelZeroWorld.LEVEL_ZERO_ROOM_TABLE_COUNT, 10);
assert.equal(
  levelZeroWorld.LEVEL_ZERO_ROOM_TABLE_CELLS.every(({ col, row }) => levelZero.isOpenCell(col, row)),
  true,
);
const levelZeroTableScene = new THREE.Scene();
const levelZeroTableColliders = levelZeroWorld.addRoomTables(levelZeroTableScene, levelZero.cellCenter);
assert.equal(levelZeroTableColliders.length, levelZeroWorld.LEVEL_ZERO_ROOM_TABLE_COUNT);
assert.equal(levelZeroTableScene.getObjectByName("level-zero-room-table-1")?.isGroup, true);

// Scene documents use the ordinary F/mobile interaction path and return the
// reader document id while keeping their interaction count save-compatible.
const megFileSpot = createInteractionSpot({
  id: "level-zero-meg-file",
  position: { x: 0, y: 1.12, z: 0 },
  radius: 2.8,
  onInteract: () => ({ documentId: "level-zero-meg-file" }),
});
assert.deepEqual(megFileSpot.interact({ x: 0, z: 2 }), {
  interacted: true,
  id: "level-zero-meg-file",
  textKey: "level-zero-meg-fileResponse",
  count: 1,
  documentId: "level-zero-meg-file",
});
assert.deepEqual(megFileSpot.getState(), { count: 1 });

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

// Real stair routes are open stairwells, not a second type of animated door.
const stairwellScene = new THREE.Scene();
const stairwellCamera = new THREE.PerspectiveCamera();
stairwellCamera.position.set(0, 1.62, 2.4);
stairwellCamera.rotation.set(0, 0, 0);
const stairwellNetwork = createExitNetwork(stairwellScene, stairwellCamera, [
  { id: "modeled-stairwell", targetLevel: 5, targetLabel: "LEVEL 5", kind: "stair", stairModel: true, position: { x: 0, z: 0 }, noSign: true },
]);
const stairwellModel = stairwellScene.getObjectByName("exit-network-modeled-stairwell");
assert.equal(stairwellModel?.getObjectByName("exit-stair-tread-modeled-stairwell-14")?.isMesh, true);
assert.equal(stairwellModel?.getObjectByName("exit-stair-point-light-modeled-stairwell")?.isPointLight, true);
assert.equal(stairwellModel?.getObjectByName("exit-stair-light-housing-modeled-stairwell")?.isMesh, true);
assert.equal(stairwellModel?.getObjectByName("exit-stair-jamb-left-modeled-stairwell")?.isMesh, true);
assert.equal(stairwellModel?.getObjectByName("exit-stair-shaft-black-end-wall-modeled-stairwell")?.isMesh, true);
assert.equal(stairwellModel?.getObjectByName("exit-stair-shaft-darkness-modeled-stairwell")?.isMesh, true);
assert.equal(stairwellModel?.getObjectByName("exit-portal-modeled-stairwell"), undefined);
assert.equal(stairwellNetwork.inspect(stairwellCamera.position)?.available, false);
assert.equal(stairwellNetwork.interact(stairwellCamera.position), null);
assert.equal(stairwellNetwork.update(0.016, { x: 0, z: 0 })?.id, "modeled-stairwell");

// Outdoor routes are invisible one-shot thresholds: no door model, prompt,
// interaction state, or repeated transition while the old world is alive.
const thresholdScene = new THREE.Scene();
const thresholdCamera = new THREE.PerspectiveCamera();
const thresholdNetwork = createExitNetwork(thresholdScene, thresholdCamera, [
  { id: "field-threshold", targetLevel: 10, kind: "threshold", position: { x: 0, z: 0 }, enterRadius: 2 },
]);
assert.equal(thresholdScene.getObjectByName("exit-network-field-threshold"), undefined);
assert.equal(thresholdNetwork.inspect({ x: 0, z: 0 }), null);
assert.equal(thresholdNetwork.interact({ x: 0, z: 0 }), null);
assert.deepEqual(thresholdNetwork.getState(), {});
assert.equal(thresholdNetwork.update(0.016, { x: 0, z: 0 })?.targetLevel, 10);
assert.equal(thresholdNetwork.update(0.016, { x: 0, z: 0 }), null);

// Local relocations are one-shot signals, re-arm after leaving, and persist
// only their interaction count rather than marking a level complete.
const relocationCamera = new THREE.PerspectiveCamera();
const relocationNetwork = createLocalRelocationNetwork(relocationCamera, [{
  id: "test-local-loop",
  position: { x: 0, z: 0 },
  destination: { x: 12, z: 8, yaw: Math.PI / 2 },
  radius: 1.5,
}], {});
const firstRelocation = relocationNetwork.update({ x: 0, z: 0 });
assert.match(firstRelocation.id, /^test-local-loop-1$/);
assert.deepEqual({ x: firstRelocation.x, z: firstRelocation.z, yaw: firstRelocation.yaw }, { x: 12, z: 8, yaw: Math.PI / 2 });
assert.equal(relocationNetwork.update({ x: 0, z: 0 }), null);
relocationNetwork.update({ x: 4, z: 0 });
assert.match(relocationNetwork.update({ x: 0, z: 0 }).id, /^test-local-loop-2$/);
assert.deepEqual(relocationNetwork.getState(), { "test-local-loop": { count: 2 } });

const matrixProgression = createMatrixProgression();
assert.equal(matrixProgression.beginChairObservation(), false);
assert.equal(matrixProgression.completeCopycat(), false);
assert.equal(matrixProgression.tryDoor(), false);
assert.equal(matrixProgression.beginChairObservation(), true);
assert.equal(matrixProgression.updateChairObservation(4, true), false);
assert.equal(matrixProgression.updateChairObservation(4, false), false);
assert.equal(matrixProgression.updateChairObservation(4, true), true);
assert.equal(matrixProgression.tryDoor(), false);
assert.equal(matrixProgression.completeCopycat(), true);
assert.equal(matrixProgression.tryDoor(), true);
const restoredMatrix = createMatrixProgression(matrixProgression.getInteractionState());
assert.equal(restoredMatrix.doorOpened, true);
assert.equal(restoredMatrix.chairCompleted, true);
assert.equal(restoredMatrix.copycatCompleted, true);

// Level 11's hound patrols harmlessly until a Firesalt burst breaks the effect.
const passivePatrol = createPassivePatrolState({
  points: [{ x: 4, z: 0 }, { x: 4, z: 4 }],
  provokeDuration: 12,
});
assert.equal(passivePatrol.update(0.016, { x: 0, z: 0 }).provoked, false);
const provokedHound = passivePatrol.update(0.016, { x: 0, z: 0 }, {
  firesaltActive: true,
  firesaltPosition: { x: 0, z: 0 },
  firesaltRadius: 8,
});
assert.equal(provokedHound.provoked, true);
assert.ok(passivePatrol.getState().provokedTimer > 11);
passivePatrol.update(2, { x: 0, z: 0 }, {
  firesaltActive: true,
  firesaltPosition: { x: 0, z: 0 },
  firesaltRadius: 8,
});
assert.ok(passivePatrol.getState().provokedTimer < 10.1);
assert.equal(passivePatrol.update(10.1, { x: 20, z: 20 }).provoked, false);

// Hub debug access must be able to open a key-gated door without consuming a key.
const debugDoorScene = new THREE.Scene();
const debugDoorCamera = new THREE.PerspectiveCamera();
debugDoorCamera.position.set(0, 1.62, 2.4);
debugDoorCamera.rotation.set(0, 0, 0);
const debugDoorNetwork = createExitNetwork(debugDoorScene, debugDoorCamera, [
  { id: "debug-hub-door", targetLevel: 3, targetLabel: "LEVEL 3", kind: "door", position: { x: 0, z: 0 }, noSign: true, requiresLevelKey: true },
]);
assert.equal(debugDoorNetwork.inspect(debugDoorCamera.position, { hasLevelKey: () => true })?.available, true);
assert.equal(
  debugDoorNetwork.interact(debugDoorCamera.position, {
    hasLevelKey: () => true,
    consumeLevelKey: () => true,
  })?.interacted,
  true,
);

// Entering the Hub through a level door places the player beside the matching
// Hub door and unlocks that door without leaving it open. Completion entry has
// no source-door context and must retain the ordinary Hub spawn/state.
const hubEntryRoutes = [
  { id: "hub-door-level-2", targetLevel: 2, position: { x: 17, z: 57 } },
  { id: "hub-door-level-7", targetLevel: 7, position: { x: -17, z: 21 } },
];
const defaultHubSpawn = { x: 0, z: 112, yaw: Math.PI };
const hubDoorEntry = resolveHubEntry({
  routes: hubEntryRoutes,
  initialInteractions: { "hub-door-level-2": { count: 1, unlocked: false } },
  entryContext: { type: "door", sourceLevel: 2 },
  defaultSpawn: defaultHubSpawn,
});
assert.deepEqual(hubDoorEntry.spawn, { x: 14.6, z: 57, yaw: Math.PI / 2 });
assert.deepEqual(hubDoorEntry.interactions["hub-door-level-2"], { count: 0, unlocked: true });
assert.equal(hubDoorEntry.entryRoute?.id, "hub-door-level-2");
const hubCompletionEntry = resolveHubEntry({
  routes: hubEntryRoutes,
  initialInteractions: {},
  defaultSpawn: defaultHubSpawn,
});
assert.equal(hubCompletionEntry.spawn, defaultHubSpawn);
assert.deepEqual(hubCompletionEntry.interactions, {});
assert.equal(hubCompletionEntry.entryRoute, null);
const mainSource = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
const hubSource = await readFile(new URL("../src/scene/hub/index.js", import.meta.url), "utf8");
const levelZeroSource = await readFile(new URL("../src/scene/level-zero/index.js", import.meta.url), "utf8");
const uiTextSource = await readFile(new URL("../src/ui/text.js", import.meta.url), "utf8");
assert.match(levelZeroSource, /id: "level-zero-meg-file"/);
assert.match(levelZeroSource, /focusInteraction: getFocusedInteraction\(camera, playerPosition, interactions\)/);
assert.match(levelZeroSource, /interact: \(playerPosition\) => tryInteractWithSpots/);
assert.match(uiTextSource, /"level-zero-meg-file": \{/);
assert.match(mainSource, /openDocumentReader\(interaction\.documentId\)/);
assert.match(mainSource, /const prewarm = preloadLevelScene\(nextLevelInfo\.level\);/);
assert.match(mainSource, /await transition\.prewarm;/);
assert.match(mainSource, /await renderingPipeline\.prewarm\(\);/);
const renderingPipelineSource = await readFile(new URL("../src/rendering-pipeline.js", import.meta.url), "utf8");
assert.match(renderingPipelineSource, /await renderer\.compileAsync\?\.\(world\.scene, world\.camera\);/);
assert.match(mainSource, /levelTransition\.revealElapsed \+= delta \* 1000;/);
assert.doesNotMatch(mainSource, /LEVEL_TRANSITION_MS/);
assert.match(mainSource, /const debugBypassHubLocks = isDebugFeaturesActive\(\) && world\?\.level === HUB_LEVEL;/);
assert.match(mainSource, /debugBypassHubLocks \|\| getLevelKeyTarget/);
assert.match(mainSource, /nextLevelInfo\.level === HUB_LEVEL\s*\? \{ type: "door", sourceLevel: world\.level \}/);
assert.match(mainSource, /\{ type: "route", sourceLevel: world\.level, exitId \}/);
assert.match(mainSource, /entryContext: transition\.entryContext/);
assert.match(mainSource, /\(world\.movementSpeedMultiplier \?\? 1\)\s*\* \(metrics\.playerModifiers\?\.movementSpeedMultiplier \?\? 1\)/);
assert.match(mainSource, /if \(typeof entity\.contact === "boolean"\) return entity\.contact;/);
const hubRouteBlock = hubSource.match(/const routes = \[([\s\S]*?)\]\.map/)?.[1] ?? "";
const hubRouteLevels = [...hubRouteBlock.matchAll(/\{ level:\s*(-?\d+)/g)].map((match) => Number(match[1]));
assert.equal(hubRouteLevels.length, 15);
assert.deepEqual([...hubRouteLevels].sort((a, b) => a - b), [...LEVEL_KEY_TARGETS].sort((a, b) => a - b));
const controlsSource = await readFile(new URL("../src/first-person-controls.js", import.meta.url), "utf8");
assert.match(controlsSource, /event\.code === "KeyC"/);
assert.match(controlsSource, /this\.camera\.fov = nextFov/);
const { FirstPersonControls } = await import("../src/first-person-controls.js");
const zoomCamera = new THREE.PerspectiveCamera(72, 1, 0.05, 100);
const zoomCanvas = {
  dataset: {},
  addEventListener: () => {},
  classList: { add: () => {}, remove: () => {}, toggle: () => {} },
};
const zoomControls = new FirstPersonControls({
  camera: zoomCamera,
  canvas: zoomCanvas,
  isWalkable: () => true,
  getFloorHeight: () => 0,
  spawn: { x: 0, z: 0, yaw: 0 },
});
zoomControls.onKeyDown({ code: "KeyC", preventDefault: () => {} });
zoomControls.update(0.5);
assert.ok(zoomCamera.fov < 50);
assert.equal(zoomCanvas.dataset.zoomed, "true");
zoomControls.onKeyUp({ code: "KeyC", preventDefault: () => {} });
zoomControls.update(0.5);
assert.ok(Math.abs(zoomCamera.fov - 72) < 0.1);
zoomControls.setEnvironmentModifiers({ movementSpeedMultiplier: 0.78, staminaRecoveryMultiplier: 0.5 });
assert.equal(zoomControls.environmentSpeedMultiplier, 0.78);
assert.equal(zoomControls.environmentStaminaRecoveryMultiplier, 0.5);
zoomControls.verticalVelocity = -18;
assert.equal(zoomControls.relocate({ x: 9, z: -7, yaw: 1.25 }), true);
assert.deepEqual([zoomCamera.position.x, zoomCamera.position.z, zoomControls.verticalVelocity, zoomControls.yaw], [9, -7, 0, 1.25]);

const gaitCamera = new THREE.PerspectiveCamera(72, 1, 0.05, 100);
const gaitControls = new FirstPersonControls({
  camera: gaitCamera,
  canvas: zoomCanvas,
  isWalkable: () => true,
  getFloorHeight: () => 0,
  spawn: { x: 0, z: 0, yaw: 0 },
});
gaitControls.onKeyDown({ code: "KeyW", preventDefault: () => {} });
gaitControls.update(0.1);
const walkingCycleAdvance = gaitControls.walkCycle;
gaitControls.onKeyDown({ code: "ShiftLeft", preventDefault: () => {} });
gaitControls.walkCycle = 0;
gaitControls.update(0.1);
const sprintingCycleAdvance = gaitControls.walkCycle;
assert.ok(sprintingCycleAdvance > walkingCycleAdvance * 1.3);
assert.equal(gaitControls.isSprinting, true);

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
const levelEightSource = await readFile(new URL("../src/scene/level-eight/index.js", import.meta.url), "utf8");
const sceneIndexSource = await readFile(new URL("../src/scene/index.js", import.meta.url), "utf8");
const levelNineSource = await readFile(new URL("../src/scene/level-nine/index.js", import.meta.url), "utf8");
const levelTenSource = await readFile(new URL("../src/scene/level-ten/index.js", import.meta.url), "utf8");
const levelElevenSource = await readFile(new URL("../src/scene/level-eleven/index.js", import.meta.url), "utf8");
const levelTwelveSource = await readFile(new URL("../src/scene/level-twelve/index.js", import.meta.url), "utf8");
const levelThirteenSource = await readFile(new URL("../src/scene/level-thirteen/index.js", import.meta.url), "utf8");
const levelOneSource = await readFile(new URL("../src/scene/level-one/index.js", import.meta.url), "utf8");
const levelOnePropsSource = await readFile(new URL("../src/scene/level-one/props.js", import.meta.url), "utf8");
const levelOneTexturesSource = await readFile(new URL("../src/scene/level-one/textures.js", import.meta.url), "utf8");
const viewModelSource = await readFile(new URL("../src/scene/common/view-model.js", import.meta.url), "utf8");
const ambientAudioSource = await readFile(new URL("../src/ambient-audio.js", import.meta.url), "utf8");
const { getFootstepProfile, resolveFootstepSurface } = await import("../src/scene/common/footstep-surfaces.js");
assert.match(levelEightSource, /targetLevel:\s*9/);
assert.match(sceneIndexSource, /level-nine\/index\.js/);
assert.match(levelNineSource, /targetLevel:\s*10/);
assert.match(levelNineSource, /targetLevel:\s*11/);
assert.match(levelNineSource, /kind:\s*"threshold"/);
assert.match(levelTenSource, /targetLevel:\s*11/);
assert.match(levelTenSource, /level:\s*10/);
assert.match(levelElevenSource, /targetLevel:\s*10/);
assert.match(levelElevenSource, /targetLevel:\s*37/);
assert.match(levelElevenSource, /targetLevel:\s*12/);
assert.match(levelElevenSource, /targetLevel:\s*13/);
assert.match(levelElevenSource, /passivePatrol:/);
assert.match(levelElevenSource, /isCellOpen:\s*isHoundCellOpen/);
assert.match(sceneIndexSource, /level-twelve\/index\.js/);
assert.match(sceneIndexSource, /level-thirteen\/index\.js/);
assert.match(levelTwelveSource, /targetLevel:\s*13/);
assert.match(levelTwelveSource, /nextLevel:\s*doorEntered \? 10/);
assert.match(levelTwelveSource, /createMatrixProgression\(savedInteractions\)/);
assert.match(levelThirteenSource, /getLevelThirteenSpawnFloor\(entryContext\?\.sourceLevel\)/);
assert.match(levelThirteenSource, /targetLevel:\s*3/);
assert.match(levelThirteenSource, /movementSpeedMultiplier: THREE\.MathUtils\.lerp\(1, 0\.78, lethargy\)/);
assert.match(levelThirteenSource, /staminaRecoveryMultiplier: THREE\.MathUtils\.lerp\(1, 0\.5, lethargy\)/);
assert.match(levelThirteenSource, /contactRadius:\s*1\.05/);
assert.match(levelThirteenSource, /contactDamage:\s*18/);
assert.match(levelNineSource, /level-nine-asphalt-roads/);
assert.doesNotMatch(levelNineSource, /collectGridWallTransforms|CEILING_Y|createLevelNineCeilingTexture/);
const levelNinePropsSource = await readFile(new URL("../src/scene/level-nine/props.js", import.meta.url), "utf8");
assert.match(levelNinePropsSource, /gradient\.addColorStop\(0, "rgba\(255, 255, 255, 0\.92\)"\)/);
assert.match(levelNinePropsSource, /const lampGlass = new THREE\.MeshStandardMaterial\(\{ color: 0xffffff, emissive: 0xffffff/);
assert.match(levelNinePropsSource, /new THREE\.PointLight\(0xffffff, 0, 68, 1\.45\)/);
assert.match(levelNinePropsSource, /new THREE\.CircleGeometry\(15\.2, 32\)/);
assert.match(levelNinePropsSource, /map: lampPoolTexture,\s+color: 0xffffff,/);
assert.match(levelNinePropsSource, /light\.intensity = strength \* 3\.6/);
assert.match(levelNinePropsSource, /pool\.material\.opacity = \(fogSurge \? 0\.12 : 0\.24\) \* flicker/);
assert.match(levelOneSource, /createLevelOneLights\(scene, fixturePositions, \{ dynamicPointLights: true \}\)/);
assert.match(levelOneSource, /createLevelOneWallPbrMaps\(\{ includeDetailMaps: !useLowQuality \}\)/);
assert.match(levelOneSource, /createLevelOneWallPbrMaps\(\{ corridor: true, includeDetailMaps: !useLowQuality \}\)/);
assert.match(levelOneSource, /corridorWallMaterials/);
assert.match(levelOneTexturesSource, /const CORRIDOR_WALL_SEED = 0x1e1e14/);
assert.match(levelOneTexturesSource, /createLevelOneWallPbrMaps/);
assert.match(levelOneSource, /applyLevelOnePropLightField\(scene, lightField\)/);
assert.match(levelOnePropsSource, /fixtures\.updatePointLights = \(playerPosition, delta, elapsed\)/);
assert.match(viewModelSource, /setFirstPersonViewModelLighting/);
assert.match(viewModelSource, /THREE\.MathUtils\.lerp\(0\.78, 2\.2, sprintBlend\)/);
assert.match(controlsSource, /this\.isSprinting \? SPRINT_STEP_DISTANCE : WALK_STEP_DISTANCE/);
assert.match(controlsSource, /export const GROUND_ACCELERATION = 14/);
assert.match(controlsSource, /export const AIR_CONTROL = 0\.35/);
assert.match(ambientAudioSource, /getFootstepProfile\(surface\)/);
assert.match(ambientAudioSource, /effort \* FOOTSTEP_OUTPUT_GAIN/);
assert.match(mainSource, /canvas\.dataset\.footstepSurface = footstepSurface/);
assert.equal(resolveFootstepSurface({ level: 0 }, { x: 0, z: 0 }), "carpet");
assert.equal(resolveFootstepSurface({ level: 2 }, { x: 0, z: 0 }), "metal");
assert.equal(resolveFootstepSurface({ level: 9, getFootstepSurface: () => "asphalt" }, { x: 0, z: 0 }), "asphalt");
assert.notDeepEqual(getFootstepProfile("carpet"), getFootstepProfile("metal"));

console.log("content expansion checks passed");
