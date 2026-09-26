import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";

const sourceUrl = new URL("../src/scene/common/view-model.js", import.meta.url);
const levelOneSourceUrl = new URL("../src/scene/level-one/index.js", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const levelOneSource = await readFile(levelOneSourceUrl, "utf8");
const bakedArms = [
  ["left", "fps-arm-para-baked.bin.b64", "fps-arm-para-relaxed-baked.bin"],
  ["right", "fps-arm-para-right-baked.bin.b64", "fps-arm-para-right-relaxed-baked.bin"],
];

for (const [side, gripName, relaxedName] of bakedArms) {
  const gripUrl = new URL(`../src/assets/models/${gripName}`, import.meta.url);
  const relaxedUrl = new URL(`../src/assets/models/${relaxedName}`, import.meta.url);
  await access(gripUrl);
  await access(relaxedUrl);
  assert.ok((await stat(gripUrl)).size > 1_000, `${gripName} must contain baked geometry`);
  assert.ok((await stat(relaxedUrl)).size > 1_000, `${relaxedName} must contain baked geometry`);
  const grip = Buffer.from((await readFile(gripUrl, "utf8")).trim(), "base64");
  const relaxed = await readFile(relaxedUrl);
  assert.equal(grip.readUInt32LE(0), relaxed.readUInt32LE(0), `${side} arm poses must share a vertex count`);
  assert.notDeepEqual(grip, relaxed, `${side} relaxed fingers must differ from the grip pose`);
}

assert.match(source, /bakedLeftArmBase64/);
assert.match(source, /bakedRightArmBase64/);
assert.match(source, /relaxedLeftArmUrl/);
assert.match(source, /relaxedRightArmUrl/);
assert.match(source, /surfaceRoughness/);
assert.match(source, /skinSurface/);
assert.match(source, /nailSurface/);
assert.match(source, /vertexColors:\s*true/);
assert.match(source, /first-person-human-skin-surface-v3/);
// Hands lighting must stay inside the view-model material. A real light parented
// to the camera would also illuminate every wall inside its range, because
// three.js collects lights per camera (object.layers.test(camera.layers)).
assert.match(source, /viewModelLighting/);
assert.match(source, /shader\.uniforms\.viewModelKeyIntensity/);
assert.match(source, /outgoingLight \+= viewModelKeyColor/);
assert.match(source, /setFirstPersonViewModelKeyLight/);
assert.match(source, /viewModelLighting\.keyIntensity\.value/);
assert.doesNotMatch(source, /first-person-view-model-key/);
assert.doesNotMatch(source, /new THREE\.PointLight\(0xffe7d8/);
// The soft hemisphere fill is deliberately a real light (and lifts the level).
assert.match(source, /first-person-view-model-fill/);
assert.match(source, /const fillLight = viewModel\?\.userData\?\.fillLight/);
assert.match(levelOneSource, /setFirstPersonViewModelKeyLight\(viewModel/);
assert.match(levelOneSource, /intensity: \(3\.2 \+ localExposure \* 1\.2\)/);
assert.match(source, /setArmPoseGeometry\(arms, targetId \? "grip" : "empty"\)/);
assert.match(source, /updateArmPoseTransition\(viewModel, motionDelta\)/);
assert.match(source, /restPosition\.y \+ returnSwing \* 0\.085/);
assert.match(source, /const heldDamping = holdingItem && !isLeft \? 0\.36 : 1/);
assert.doesNotMatch(source, /mesh\.scale\.set\(mirrorSign, 1, 1\)/);

// Held props are anchored to the baked grip centre and parented to the right
// hand, so the placement can never drift back into camera-space constants.
const anchorUrl = new URL("../src/assets/models/fps-arm-anchors.json", import.meta.url);
await access(anchorUrl);
const anchors = JSON.parse(await readFile(anchorUrl, "utf8"));
for (const pose of ["grip", "empty"]) {
  for (const side of ["left", "right"]) {
    const entry = anchors?.[pose]?.[side];
    assert.ok(entry, `fps-arm-anchors.json must describe the ${pose} ${side} grip anchor`);
    for (const key of ["position", "palm", "tips"]) {
      assert.ok(Array.isArray(entry[key]) && entry[key].length === 3, `${pose}.${side}.${key} must be a 3-vector`);
      assert.ok(entry[key].every((value) => Number.isFinite(value)), `${pose}.${side}.${key} must be finite`);
    }
  }
}
const gripCentre = anchors.grip.right.position;
const palmToTips = anchors.grip.right.tips.map((value, index) => value - anchors.grip.right.palm[index]);
assert.ok(Math.hypot(...palmToTips) > 0.5, "the grip anchor must sit between the palm root and the fingertips");

// view-model.js carries a hand-written fallback for a missing or stale anchor
// file, so the two sources of truth must not drift apart unnoticed. The fallback
// is written with three decimals, hence the small tolerance.
const FALLBACK_GRIP_ANCHOR_TOLERANCE = 1e-3;
const fallbackMatch = source.match(/const FALLBACK_GRIP_ANCHOR = new THREE\.Vector3\(([^)]+)\)/);
assert.ok(fallbackMatch, "view-model.js must keep a fallback grip anchor for a missing anchor file");
const fallbackAnchor = fallbackMatch[1].split(",").map((value) => Number(value.trim()));
assert.equal(fallbackAnchor.length, 3, `unexpected fallback grip anchor: ${fallbackMatch[1]}`);
assert.ok(
  fallbackAnchor.every((value) => Number.isFinite(value)),
  `non-numeric fallback grip anchor: ${fallbackMatch[1]}`,
);
const fallbackDrift = Math.max(
  ...fallbackAnchor.map((value, index) => Math.abs(value - gripCentre[index])),
);
assert.ok(
  fallbackDrift <= FALLBACK_GRIP_ANCHOR_TOLERANCE,
  `the fallback grip anchor drifted ${fallbackDrift} away from the baked grip anchor`,
);

assert.match(source, /import armAnchors from "\.\.\/\.\.\/assets\/models\/fps-arm-anchors\.json"/);
assert.match(source, /mount\.scale\.setScalar\(1 \/ ARMS_SCALE\)/);
assert.match(source, /mesh\.add\(mount\)/);
assert.match(source, /mount\.add\(heldItem\)/);
assert.match(source, /mount\.position\.copy\(getGripAnchor\(arms, "right"\)\)/);
assert.match(source, /previous\.removeFromParent\(\)/);
assert.doesNotMatch(source, /viewModel\.add\(heldItem\)/);
assert.doesNotMatch(source, /userData\.gripPosition/);
assert.match(source, /item\.scale\.multiplyScalar/);
assert.doesNotMatch(source, /item\.scale\.setScalar/);

// Every authored offset is a small grip-relative nudge, not a camera-space
// position: anything beyond 20 cm would push props off the hand again. The match
// count is asserted as well, otherwise renaming the call site would quietly turn
// this loop into a check that never runs.
const itemOffsets = [...source.matchAll(/item\.position\.set\(([^)]+)\)/g)];
assert.ok(
  itemOffsets.length > 0,
  "held items must still be nudged from the grip anchor with item.position.set(...)",
);
for (const match of itemOffsets) {
  const values = match[1].split(",").map((value) => Number(value.trim()));
  assert.equal(values.length, 3, `unexpected item position: ${match[1]}`);
  assert.ok(values.every((value) => Number.isFinite(value)), `non-numeric item position: ${match[1]}`);
  assert.ok(Math.hypot(...values) <= 0.2, `held item offset ${match[1]} is too far from the grip anchor`);
}
assert.ok(Math.hypot(...gripCentre) > 2, "the exported grip anchor must be expressed in the arm rig's own units");

console.log("first-person hand realism checks passed");
