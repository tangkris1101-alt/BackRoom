import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";

const sourceUrl = new URL("../src/scene/common/view-model.js", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const bakedArms = [
  new URL("../src/assets/models/fps-arm-para-baked.bin.b64", import.meta.url),
  new URL("../src/assets/models/fps-arm-para-right-baked.bin.b64", import.meta.url),
];

for (const bakedArm of bakedArms) {
  await access(bakedArm);
  assert.ok((await stat(bakedArm)).size > 1_000, `${bakedArm.pathname} must contain baked geometry`);
}

assert.match(source, /bakedLeftArmBase64/);
assert.match(source, /bakedRightArmBase64/);
assert.match(source, /surfaceRoughness/);
assert.match(source, /skinSurface/);
assert.match(source, /nailSurface/);
assert.match(source, /vertexColors:\s*true/);
assert.match(source, /first-person-human-skin-surface-v3/);
assert.match(source, /const cadence = isLeft \? 0\.94 : 1\.06/);
assert.match(source, /const heldDamping = holdingItem && !isLeft \? 0\.36 : 1/);
assert.doesNotMatch(source, /mesh\.scale\.set\(mirrorSign, 1, 1\)/);

console.log("first-person hand realism checks passed");
