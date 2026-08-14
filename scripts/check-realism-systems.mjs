import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getGraphicsProfile } from "../src/graphics-profile.js";
import {
  AIR_CONTROL,
  GROUND_ACCELERATION,
  GROUND_BRAKING,
  GRAVITY,
  JUMP_VELOCITY,
  SPRINT_STEP_DISTANCE,
  WALK_STEP_DISTANCE,
  moveToward,
} from "../src/first-person-controls.js";
import { HUB_LEVEL, PLAYABLE_LEVEL_IDS, circleIntersectsAabb } from "../src/scene/constants.js";
import {
  getLevelPresentation,
  getSurfaceState,
  hasLevelPresentation,
} from "../src/scene/common/presentation.js";
import {
  createContactAttackCycle,
  createEntityNavCellFilter,
  getEntityPlayerDistance,
} from "../src/scene/entities/behavior.js";
import { aStar, createNavGrid } from "../src/scene/entities/pathfinding.js";
import {
  LEVEL_ELEVEN_COLS,
  LEVEL_ELEVEN_HOUND_PATROL_CELLS,
  LEVEL_ELEVEN_ROWS,
  isLevelElevenOpenCell,
  levelElevenCellCenter,
  levelElevenWorldToCell,
} from "../src/scene/level-eleven/layout.js";
import { snapEntityStateToNavCell } from "../src/scene/common/snap.js";

const high = getGraphicsProfile("high");
const low = getGraphicsProfile("low");
assert.deepEqual(
  {
    shadows: high.shadows,
    gtao: high.gtao,
    anisotropy: high.maxAnisotropy,
    indoorShadowMapSize: high.indoorShadowMapSize,
    outdoorShadowMapSize: high.outdoorShadowMapSize,
  },
  { shadows: true, gtao: true, anisotropy: 8, indoorShadowMapSize: 1024, outdoorShadowMapSize: 2048 },
);
assert.deepEqual(
  { shadows: low.shadows, gtao: low.gtao, anisotropy: low.maxAnisotropy },
  { shadows: false, gtao: false, anisotropy: 4 },
);
assert.equal(high.minPixelRatio, 0.75);
assert.equal(high.maxPixelRatio, 1.25);
assert.equal(low.minPixelRatio, 0.65);
assert.equal(low.maxPixelRatio, 1);

for (const level of [HUB_LEVEL, ...PLAYABLE_LEVEL_IDS]) {
  assert.equal(hasLevelPresentation(level), true, `level ${level} must register presentation`);
  const presentation = getLevelPresentation(level);
  assert.ok(presentation.surface, `level ${level} surface`);
  assert.ok(presentation.shadowMode, `level ${level} shadow mode`);
  assert.ok(presentation.environment, `level ${level} environment`);
  assert.ok(presentation.reverb, `level ${level} reverb`);
  assert.ok(Number.isFinite(presentation.exposure), `level ${level} exposure`);
}
assert.equal(getSurfaceState("water").wetness, 1);
assert.equal(getSurfaceState("carpet").footstepSet, "carpet");
assert.ok(getSurfaceState("grass").traction < 1);

assert.equal(GROUND_ACCELERATION, 14);
assert.equal(GROUND_BRAKING, 18);
assert.equal(AIR_CONTROL, 0.35);
assert.equal(WALK_STEP_DISTANCE, 1.35);
assert.equal(SPRINT_STEP_DISTANCE, 1.75);
assert.ok(
  (3.05 / WALK_STEP_DISTANCE) < (5.64 / SPRINT_STEP_DISTANCE),
  "sprint foot-plant cadence stays faster than walking without doubling it",
);
assert.ok(
  (5.64 / SPRINT_STEP_DISTANCE) < 3.3,
  "sprint camera bob stays below 3.3 vertical cycles per second",
);
let groundVelocity = 0;
for (let index = 0; index < 10; index += 1) {
  groundVelocity = moveToward(groundVelocity, 3.05, GROUND_ACCELERATION * 0.1);
}
assert.equal(groundVelocity, 3.05, "ground acceleration reaches walking speed without overshoot");
for (let index = 0; index < 2; index += 1) {
  groundVelocity = moveToward(groundVelocity, 0, GROUND_BRAKING * 0.1);
}
assert.equal(groundVelocity, 0, "ground braking reaches rest without reversing");
assert.equal(moveToward(0, 3.05, GROUND_ACCELERATION * AIR_CONTROL * 0.1), 0.49);
assert.ok(Math.abs((JUMP_VELOCITY ** 2) / (2 * GRAVITY) - 1.153) < 0.01);

assert.equal(
  getEntityPlayerDistance({ x: 0, z: 0 }, { x: 2, z: 0 }),
  2,
  "entity HUD distance remains relative to the player",
);
const colliderAwareCellOpen = createEntityNavCellFilter({
  isCellOpen: (col, row) => col >= 0 && row >= 0,
  cellCenter: (col, row) => ({ x: col * 4 + 2, z: row * 4 + 2 }),
  isWalkable: (x, z, radius) => Math.hypot(x - 14, z - 6) > 2.1 + radius,
});
assert.equal(colliderAwareCellOpen(3, 1), false, "entity navigation blocks a prop-occupied cell");
assert.equal(colliderAwareCellOpen(3, 2), true, "entity navigation keeps the adjacent road cell open");
assert.equal(colliderAwareCellOpen(-1, 1), false, "entity navigation preserves the base grid boundary");

const levelElevenCarCenter = levelElevenCellCenter(34, 37);
const levelElevenCarBounds = {
  minX: levelElevenCarCenter.x - 2.1,
  maxX: levelElevenCarCenter.x + 2.1,
  minZ: levelElevenCarCenter.z - 1,
  maxZ: levelElevenCarCenter.z + 1,
};
const levelElevenHoundCellOpen = createEntityNavCellFilter({
  isCellOpen: isLevelElevenOpenCell,
  cellCenter: levelElevenCellCenter,
  isWalkable: (x, z, radius) => !circleIntersectsAabb(x, z, radius, levelElevenCarBounds),
});
const levelElevenHoundNav = createNavGrid({
  cols: LEVEL_ELEVEN_COLS,
  rows: LEVEL_ELEVEN_ROWS,
  isCellOpen: levelElevenHoundCellOpen,
});
const levelElevenPatrolPath = aStar(
  levelElevenHoundNav,
  LEVEL_ELEVEN_HOUND_PATROL_CELLS[0],
  LEVEL_ELEVEN_HOUND_PATROL_CELLS[1],
);
assert.ok(levelElevenPatrolPath?.length > 0, "Level 11 Hound keeps a route around the parked car");
assert.equal(
  levelElevenPatrolPath.some(({ col, row }) => col === 34 && row === 37),
  false,
  "Level 11 Hound patrol path does not cross the parked-car collider",
);
const stuckLevelElevenHound = {
  id: "hound-level-eleven",
  position: { ...levelElevenCellCenter(34, 37) },
};
const recoveredLevelElevenHound = snapEntityStateToNavCell(stuckLevelElevenHound, {
  isCellOpen: levelElevenHoundCellOpen,
  worldToCell: levelElevenWorldToCell,
  cellCenter: levelElevenCellCenter,
  cols: LEVEL_ELEVEN_COLS,
  rows: LEVEL_ELEVEN_ROWS,
});
assert.notDeepEqual(
  recoveredLevelElevenHound.position,
  stuckLevelElevenHound.position,
  "a Level 11 Hound saved in the parked-car cell relocates to an open navigation cell",
);

const attack = createContactAttackCycle({ windup: 0.3, hitDuration: 0.1, recovery: 0.5 });
assert.equal(attack.update(0.1, true).phase, "windup");
assert.equal(attack.update(0.1, true).shouldDamage, false);
const hit = attack.update(0.1, true);
assert.equal(hit.phase, "hit");
assert.equal(hit.shouldDamage, true);
assert.equal(attack.update(0.01, true).shouldDamage, false, "one attack has one hit frame");
assert.equal(attack.update(0.1, true).phase, "recovery");
for (let index = 0; index < 5; index += 1) attack.update(0.1, false);
assert.equal(attack.phase, "idle");

const renderingSource = await readFile(new URL("../src/rendering-pipeline.js", import.meta.url), "utf8");
const audioSource = await readFile(new URL("../src/ambient-audio.js", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
const houndSource = await readFile(new URL("../src/scene/entities/hound.js", import.meta.url), "utf8");
const levelZeroSceneSource = await readFile(new URL("../src/scene/level-zero/index.js", import.meta.url), "utf8");
const levelZeroWorldSource = await readFile(new URL("../src/scene/level-zero/world.js", import.meta.url), "utf8");
assert.match(renderingSource, /GTAOPass/);
assert.match(renderingSource, /PCFShadowMap/);
assert.match(renderingSource, /canReducePixelRatio/);
assert.match(renderingSource, /object\.isPointLight/);
assert.doesNotMatch(renderingSource, /isPointLight[^\n]+castShadow\s*=\s*true/);
assert.match(levelZeroSceneSource, /collectReachableLightCells/);
assert.match(levelZeroSceneSource, /context\.clip\(\)/);
assert.match(levelZeroSceneSource, /new THREE\.HemisphereLight\([^\n]+0\.92\)/);
assert.equal((levelZeroWorldSource.match(/new THREE\.InstancedMesh/g) ?? []).length, 3);
assert.match(levelZeroWorldSource, /level-zero-fixture-halos/);
assert.match(levelZeroWorldSource, /const panelMaterial = new THREE\.MeshBasicMaterial\(\{\s*color: 0xfff4d2,\s*toneMapped: false,/);
assert.doesNotMatch(levelZeroWorldSource, /panels\.setColorAt/);
assert.match(levelZeroWorldSource, /instanceColor\.needsUpdate = true/);
assert.doesNotMatch(levelZeroWorldSource, /fixture\.material\.emissiveIntensity/);
assert.match(audioSource, /updateWorldAudio/);
assert.match(audioSource, /backrooms:audio:master/);
assert.match(audioSource, /stored === null/);
assert.match(audioSource, /createConvolver/);
const audioStartSource = audioSource.slice(
  audioSource.indexOf("  function start()"),
  audioSource.indexOf("  function ensureHotelJazzAudio()"),
);
assert.doesNotMatch(
  audioStartSource,
  /new Audio\(levelFiveJazzUrl\)/,
  "Level 5 music must not download when another level starts",
);
assert.match(audioSource, /if \(inHotel\) ensureHotelJazzAudio\(\);/);
assert.match(
  houndSource,
  /distance:\s*playerDistance/,
  "Hound markers must expose player-relative distance while passive patrol targets a waypoint",
);
assert.match(mainSource, /averageFrameMs/);
assert.match(mainSource, /onePercentLowFps/);
assert.match(mainSource, /renderingPipeline\.prewarm/);

console.log("realism systems checks passed");
