import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import {
  PLAYER_BODY_METRICS,
  PLAYER_BODY_NAME,
  attachPlayerBody,
  createPlayerBody,
  describePlayerBody,
  updateFirstPersonPlayerBody,
  updatePlayerBody,
} from "../src/scene/common/player-body.js";

// The player used to be a pair of camera-parented hands with no shadow. These
// checks pin down the contract that makes the new figure work: it has to be
// named for the shadow pattern, it has to stay out of the Level 1 light-field
// skip list, its feet have to sit on the floor, and its world pose must not
// follow the camera's pitch.

const pipelineSource = await readFile(new URL("../src/rendering-pipeline.js", import.meta.url), "utf8");
const levelOneSource = await readFile(new URL("../src/scene/level-one/index.js", import.meta.url), "utf8");
const controlsSource = await readFile(new URL("../src/first-person-controls.js", import.meta.url), "utf8");

// --- shadow contract -------------------------------------------------------
const patternMatch = pipelineSource.match(/const SHADOW_CASTER_PATTERN = \/(.+?)\/[a-z]*;/);
assert.ok(patternMatch, "rendering-pipeline.js must keep exporting a shadow caster pattern");
const shadowPattern = new RegExp(patternMatch[1], "i");
assert.ok(
  shadowPattern.test(PLAYER_BODY_NAME),
  `${PLAYER_BODY_NAME} must match the shadow caster pattern (${patternMatch[1]}) or configureMeshQuality turns its shadow off`,
);
// Level 1 keys the same prefix to keep the fixture light field off the hands.
// The body is a scene object and should be lit like one.
assert.ok(
  !PLAYER_BODY_NAME.startsWith("first-person-"),
  "the body must not be named like the view model or Level 1 will skip its light field",
);
assert.match(levelOneSource, /startsWith\("first-person-"\)/);

// --- geometry and materials ------------------------------------------------
const body = createPlayerBody();
assert.equal(body.name, PLAYER_BODY_NAME);
assert.ok(body.userData.partCount >= 16, `the figure must be built from segmented parts, got ${body.userData.partCount}`);
assert.ok(body.visible === false, "the body has to start hidden until the first update places it");
body.updateMatrixWorld(true);

let meshes = 0;
let triangles = 0;
let lowest = Infinity;
const vertex = new THREE.Vector3();
body.traverse((object) => {
  if (!object.isMesh) return;
  meshes += 1;
  const geometry = object.geometry;
  triangles += (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
  const position = geometry.getAttribute("position");
  for (let index = 0; index < position.count; index += 1) {
    vertex.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
    lowest = Math.min(lowest, vertex.y);
  }
  assert.equal(object.castShadow, true, `${object.name} must cast a shadow`);
  assert.equal(object.receiveShadow, true, `${object.name} must receive shadows`);
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  for (const material of materials) {
    assert.ok(
      material?.isMeshStandardMaterial || material?.isMeshLambertMaterial,
      `${object.name} must use a game material so the low profile can still shade it`,
    );
  }
});
// Same idea for the light field itself: Level 1 bakes its fixtures into every
// material that claims emissiveIntensity <= 0.5, and three.js defaults that
// property to 1, so leaving it unset would quietly drop the body out of the
// warehouse lighting.
const lightFieldLimit = levelOneSource.match(/material\.emissiveIntensity > ([\d.]+)/);
assert.ok(lightFieldLimit, "Level 1 must keep gating its light field on emissiveIntensity");
const emissiveLimit = Number(lightFieldLimit[1]);
const bodyMaterials = Object.entries(body.userData.materials)
  .flatMap(([key, value]) => (key === "arm" ? Object.values(value) : [value]));
for (const material of bodyMaterials) {
  assert.ok(
    material.emissiveIntensity <= emissiveLimit,
    `${material.name} would be skipped by the Level 1 light field (emissiveIntensity ${material.emissiveIntensity})`,
  );
}
// The baked view-model arms are the arms the player sees. The body's own arm
// segments exist to cast their shadow, so they must draw no colour - while the
// torso, legs and hood must keep drawing, which is why they cannot share the
// same material instances.
const shadowOnlyMaterials = new Set(Object.values(body.userData.materials.arm));
assert.equal(shadowOnlyMaterials.size, 3, "the arm segments need their own material instances");
for (const material of shadowOnlyMaterials) {
  // `visible = false` is the only switch that keeps the arm out of *both* the
  // colour pass and the GTAO depth/normal buffer. colorWrite alone left an
  // arm-shaped occlusion hole in the wall behind it, which reads as an extra
  // limb: see the note in player-body.js.
  assert.equal(material.visible, false, `${material.name} must not draw at all`);
}
let armMeshes = 0;
body.traverse((object) => {
  if (!object.isMesh) return;
  const isArm = /player-body-(?:arm|forearm)-/.test(object.name);
  const isShadowOnly = shadowOnlyMaterials.has(object.material);
  assert.equal(isShadowOnly, isArm, `${object.name} has the wrong material for an arm segment`);
  // The arcless shadow is the accepted cost of hiding the arms; everything else
  // still has to cast.
  if (!isArm) assert.equal(object.castShadow, true, `${object.name} must still cast its shadow`);
  if (!isArm) return;
  armMeshes += 1;
});
assert.equal(armMeshes, 8, `the arms must stay four shadow-casting segments per side, got ${armMeshes}`);
for (const material of bodyMaterials) {
  if (shadowOnlyMaterials.has(material)) continue;
  assert.notEqual(material.visible, false, `${material.name} must keep drawing the figure`);
}
assert.equal(body.userData.materials.arm.cloth.visible, false);
assert.notEqual(
  body.userData.materials.arm.cloth,
  body.userData.materials.cloth,
  "hiding the arms must not hide the torso with them",
);

assert.equal(meshes, body.userData.partCount, "every part reported by the model must be a mesh");
assert.ok(triangles > 8000, `a high-detail figure should not be a box: got ${Math.round(triangles)} triangles`);

// Feet on the floor, height under the metric, and the eye where the camera is.
assert.ok(Math.abs(lowest) < 0.004, `the boots must rest on the floor plane, lowest vertex at ${lowest.toFixed(4)}`);
const height = body.userData.size.y;
assert.ok(
  Math.abs(height - PLAYER_BODY_METRICS.totalHeight) < 0.06,
  `the figure stands ${height.toFixed(3)}m tall, not ${PLAYER_BODY_METRICS.totalHeight}m`,
);
const eyeMatch = controlsSource.match(/this\.eyeHeight = ([\d.]+)/);
assert.ok(eyeMatch, "first-person-controls.js must keep defining this.eyeHeight");
assert.equal(
  Number(eyeMatch[1]),
  PLAYER_BODY_METRICS.eyeHeight,
  "the camera sits at the eye, so the body metric has to follow this.eyeHeight",
);

// --- joints ----------------------------------------------------------------
const joints = body.userData.joints;
for (const key of ["pelvis", "torso", "hood", "legs", "shins", "ankles", "arms", "forearms"]) {
  assert.ok(joints?.[key], `the rig must expose ${key}`);
}
for (const side of ["left", "right"]) {
  for (const key of ["legs", "shins", "ankles", "arms", "forearms"]) {
    assert.ok(joints[key][side], `the rig must expose the ${side} ${key} joint`);
  }
}
assert.ok(
  Math.abs(joints.ankles.left.getWorldPosition(new THREE.Vector3()).y - PLAYER_BODY_METRICS.ankleHeight) < 1e-6,
  "the ankle must sit at its metric height when the figure stands",
);

// --- attachment ------------------------------------------------------------
const camera = new THREE.PerspectiveCamera(76, 1, 0.05, 100);
camera.rotation.order = "YXZ";
const scene = new THREE.Scene();
scene.add(camera);
const attached = attachPlayerBody(camera);
assert.equal(attached.parent, camera, "the body rides the camera so every level inherits it");

function motion(overrides = {}) {
  return {
    walkCycle: 0,
    walkBobStrength: 0,
    moving: false,
    movementSpeed: 0,
    sprinting: false,
    grounded: true,
    verticalVelocity: 0,
    landingImpact: 0,
    bodyY: PLAYER_BODY_METRICS.eyeHeight,
    eyeHeight: PLAYER_BODY_METRICS.eyeHeight,
    ...overrides,
  };
}

function tick(elapsed, overrides) {
  camera.userData.firstPersonMotion = motion(overrides);
  updatePlayerBody(attached, camera, elapsed);
  scene.updateMatrixWorld(true);
}

function worldY(joint) {
  return joint.getWorldPosition(new THREE.Vector3()).y;
}

// The animated rig belongs to the attached body; the standalone one above only
// ever proves the rest pose.
const rig = attached.userData.joints;

camera.position.set(4, PLAYER_BODY_METRICS.eyeHeight, -3);
tick(0, {});
const rootWorld = attached.getWorldPosition(new THREE.Vector3());
assert.ok(Math.abs(rootWorld.y) < 1e-6, `the figure must stand on the floor, root at ${rootWorld.y}`);
const rootOffset = Math.hypot(rootWorld.x - 4, rootWorld.z + 3);
assert.ok(
  Math.abs(rootOffset - PLAYER_BODY_METRICS.eyeForward) < 0.02,
  `the figure must stand under the camera, one eye-forward step behind it (was ${rootOffset.toFixed(3)})`,
);
assert.equal(attached.visible, false, "the body stays hidden until the view model shows it");

// Pitch and roll belong to the camera: looking down or leaning must not tip the
// figure over, only yaw may reach it. Comparing world transforms is the point -
// the body's *local* quaternion has to change, because it is a camera child.
const bodyForward = new THREE.Vector3();
const bodyYaw = () => {
  // Group.getWorldDirection returns +Z (the figure's back), where a camera
  // reports the view direction as -Z.
  attached.getWorldDirection(bodyForward);
  return Math.atan2(bodyForward.x, bodyForward.z);
};

camera.rotation.set(0, 0.4, 0);
tick(0.1, {});
const levelYaw = bodyYaw();
camera.rotation.set(-1.35, 0.4, 0.05);
tick(0.2, {});
const pitchedYaw = bodyYaw();
assert.ok(
  Math.abs(pitchedYaw - levelYaw) < 0.02,
  `camera pitch or roll leaked into the body yaw (${levelYaw.toFixed(3)} -> ${pitchedYaw.toFixed(3)})`,
);
assert.ok(
  Math.abs(bodyForward.y) < 0.05,
  `the figure must stay upright in world space, forward.y was ${bodyForward.y.toFixed(3)}`,
);
assert.ok(
  Math.abs(levelYaw - 0.4) < 0.05,
  `the figure must face where the player looks, yaw ${levelYaw.toFixed(3)} vs 0.4`,
);
camera.rotation.set(0, 0, 0);

// --- walk cycle ------------------------------------------------------------
function strideSamples(cycle) {
  const samples = [];
  for (let step = 0; step < 12; step += 1) {
    const phase = cycle + (step / 12) * Math.PI * 2;
    tick(10 + step, { walkCycle: phase, walkBobStrength: 1, moving: true, movementSpeed: 3.05 });
    samples.push({
      left: worldY(rig.ankles.left),
      right: worldY(rig.ankles.right),
    });
  }
  return samples;
}

const samples = strideSamples(0);
const lowestAnkle = Math.min(...samples.flatMap((sample) => [sample.left, sample.right]));
const highestAnkle = Math.max(...samples.flatMap((sample) => [sample.left, sample.right]));
assert.ok(lowestAnkle >= PLAYER_BODY_METRICS.ankleHeight - 0.012, `a swing foot sank to ${lowestAnkle.toFixed(3)}`);
assert.ok(
  highestAnkle - lowestAnkle > 0.05,
  "the legs have to actually stride: foot height barely changed over a cycle",
);
for (const sample of samples) {
  assert.ok(
    Math.abs(sample.left - sample.right) > 1e-6,
    "the two legs must not move as one rigid block",
  );
}

tick(40, { walkCycle: Math.PI, walkBobStrength: 1, moving: true, movementSpeed: 5.6, sprinting: true });
const sprintKnee = rig.shins.left.rotation.x;
tick(41, {});
const idleKnee = rig.shins.left.rotation.x;
assert.ok(sprintKnee !== idleKnee, "sprinting has to bend the knees differently from standing");

// --- airborne and landing --------------------------------------------------
tick(50, { grounded: false, verticalVelocity: 3.4, bodyY: PLAYER_BODY_METRICS.eyeHeight + 0.4 });
camera.position.y = PLAYER_BODY_METRICS.eyeHeight + 0.4;
const airborneY = worldY(rig.ankles.left);
tick(51, { grounded: false, verticalVelocity: 3.4, bodyY: PLAYER_BODY_METRICS.eyeHeight + 0.4 });
assert.ok(airborneY > PLAYER_BODY_METRICS.ankleHeight + 0.2, `a jump must lift the whole figure, feet at ${airborneY.toFixed(3)}`);

camera.position.y = PLAYER_BODY_METRICS.eyeHeight;
tick(52, { landingImpact: 1 });
assert.ok(
  worldY(rig.ankles.left) >= PLAYER_BODY_METRICS.ankleHeight - 0.02,
  "the landing crouch must not push the boots through the floor",
);

camera.position.y = PLAYER_BODY_METRICS.eyeHeight;
tick(53, {});
assert.ok(Math.abs(worldY(rig.ankles.left) - PLAYER_BODY_METRICS.ankleHeight) < 0.02, "standing still must settle back on the floor");

// --- visibility ------------------------------------------------------------
// The opening cutscene hides the hands while the camera lies on the floor, so
// the figure has to follow the view model's visibility exactly.
const fakeViewModel = { userData: { body: attached }, visible: false, parent: camera };
updateFirstPersonPlayerBody(fakeViewModel, 60);
assert.equal(attached.visible, false, "the body must stay hidden while the view model is hidden");
fakeViewModel.visible = true;
updateFirstPersonPlayerBody(fakeViewModel, 61);
assert.equal(attached.visible, true, "the body must appear together with the hands");

console.log(`player body checks passed (${meshes} meshes, ${Math.round(triangles)} triangles, ${describePlayerBody(body)})`);
