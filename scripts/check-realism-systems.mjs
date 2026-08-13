import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getGraphicsProfile } from "../src/graphics-profile.js";
import {
  AIR_CONTROL,
  GROUND_ACCELERATION,
  GROUND_BRAKING,
  GRAVITY,
  JUMP_VELOCITY,
  WALK_STEP_DISTANCE,
  moveToward,
} from "../src/first-person-controls.js";
import { HUB_LEVEL, PLAYABLE_LEVEL_IDS } from "../src/scene/constants.js";
import {
  getLevelPresentation,
  getSurfaceState,
  hasLevelPresentation,
} from "../src/scene/common/presentation.js";
import { createContactAttackCycle } from "../src/scene/entities/behavior.js";

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
assert.equal(WALK_STEP_DISTANCE, 0.72);
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
assert.match(renderingSource, /GTAOPass/);
assert.match(renderingSource, /PCFShadowMap/);
assert.match(renderingSource, /canReducePixelRatio/);
assert.match(renderingSource, /object\.isPointLight/);
assert.doesNotMatch(renderingSource, /isPointLight[^\n]+castShadow\s*=\s*true/);
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
assert.match(mainSource, /averageFrameMs/);
assert.match(mainSource, /onePercentLowFps/);
assert.match(mainSource, /renderingPipeline\.prewarm/);

console.log("realism systems checks passed");
