import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  ALMOND_WATER_STAMINA_BONUS,
  BASE_STAMINA_MAX,
  SUPER_ALMOND_WATER_STAMINA_MAX,
} from "../src/scene/constants.js";

globalThis.window = { addEventListener: () => {} };
globalThis.document = { addEventListener: () => {} };
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
