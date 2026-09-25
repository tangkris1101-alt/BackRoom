import assert from "node:assert/strict";
import test, { after } from "node:test";
import * as THREE from "three";
import {
  ALMOND_WATER_STAMINA_BONUS,
  BASE_STAMINA_MAX,
  SUPER_ALMOND_WATER_STAMINA_MAX,
} from "../src/scene/constants.js";

const previousWindow = globalThis.window;
const previousDocument = globalThis.document;

globalThis.window = { addEventListener: () => {} };
globalThis.document = { addEventListener: () => {} };

// Restore in a hook, not in the test body, so a failing import cannot leak the stubs
// into whatever test file shares this process.
after(() => {
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
});

const { FirstPersonControls } = await import("../src/first-person-controls.js");

test("base and almond-water stamina caps are doubled without changing fill behavior", () => {
  const canvas = {
    dataset: {},
    addEventListener: () => {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
  };
  const controls = new FirstPersonControls({
    camera: new THREE.PerspectiveCamera(72, 1, 0.05, 100),
    canvas,
    isWalkable: () => true,
    getFloorHeight: () => 0,
    spawn: { x: 0, z: 0, yaw: 0 },
  });

  assert.equal(BASE_STAMINA_MAX, 200);
  assert.equal(controls.stamina, 200);
  assert.equal(controls.staminaMax, 200);
  controls.drinkAlmondWater();
  assert.equal(ALMOND_WATER_STAMINA_BONUS, 100);
  assert.equal(controls.staminaMax, 300);
  assert.equal(controls.stamina, 300);
  controls.drinkSuperAlmondWater();
  assert.equal(SUPER_ALMOND_WATER_STAMINA_MAX, 500);
  assert.equal(controls.staminaMax, 500);
  assert.equal(controls.stamina, 500);
  controls.updateStaminaEffects(25);
  assert.equal(controls.staminaMax, 200);
  assert.equal(controls.stamina, 200);
});
