import assert from "node:assert/strict";
import * as THREE from "three";
import { createAlmondWaterPickup } from "../src/scene/items/almond-water.js";
import { createDetectorPickup } from "../src/scene/items/detector.js";
import { createFlashlightPickup } from "../src/scene/items/flashlight.js";
import { createSilenceLiquidPickup } from "../src/scene/items/silence-liquid.js";

const labelContext = {
  fillRect: () => {},
  getImageData: () => ({ data: new Uint8ClampedArray(512 * 256 * 4) }),
  putImageData: () => {},
  strokeRect: () => {},
  fillText: () => {},
  beginPath: () => {},
  ellipse: () => {},
  fill: () => {},
  stroke: () => {},
  moveTo: () => {},
  bezierCurveTo: () => {},
};
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => labelContext }),
};

const PICKUP_OPTIONS = {
  cols: 1,
  rows: 1,
  isCellOpen: () => true,
  getCellCenter: () => ({ x: 0, z: 0 }),
  initialState: {
    active: true,
    respawnTimer: 0,
    position: { x: 0, z: 0 },
    rotation: 0,
  },
};

function assertGroundShadow(createPickup, pickupName, modelName) {
  const scene = new THREE.Scene();
  createPickup(scene, PICKUP_OPTIONS);
  const pickup = scene.getObjectByName(pickupName);
  const model = pickup?.getObjectByName(modelName);
  const shadow = pickup?.getObjectByName("item-ground-shadow");

  assert.equal(shadow?.parent, pickup, `${pickupName} shadow must belong to the upright pickup root`);
  assert.equal(model?.getObjectByName("item-ground-shadow"), undefined, `${pickupName} model must not own the ground shadow`);

  // Tilting only the visual model must not rotate the world-space shadow.
  model.rotation.set(0.24, 0, -0.31);
  pickup.updateMatrixWorld(true);
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(shadow.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(Math.abs(normal.x) < 1e-6 && Math.abs(normal.z) < 1e-6 && normal.y > 0.999999, `${pickupName} shadow must stay horizontal`);
}

assertGroundShadow(createAlmondWaterPickup, "almond-water-pickup", "almond-water-model");
assertGroundShadow(createSilenceLiquidPickup, "silence-liquid-pickup", "silence-liquid-model");
assertGroundShadow(createFlashlightPickup, "flashlight-pickup", "flashlight-model");
assertGroundShadow(createDetectorPickup, "entity-detector-pickup", "entity-detector-model");

console.log("item ground-shadow checks passed");
