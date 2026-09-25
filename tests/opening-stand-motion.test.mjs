import assert from "node:assert/strict";
import test from "node:test";
import { OPENING_STAND_UP_DURATION_S, sampleOpeningStandPose } from "../src/opening-stand-motion.js";

const at = (fraction) => sampleOpeningStandPose(fraction * OPENING_STAND_UP_DURATION_S);

test("opening stand-up begins low and finishes at the standing pose", () => {
  assert.deepEqual(at(-1), { height: 0, pitch: 0 });
  assert.deepEqual(at(0), { height: 0, pitch: 0 });
  assert.deepEqual(at(1), { height: 1, pitch: 1 });
  assert.deepEqual(at(2), { height: 1, pitch: 1 });
});

test("stand-up has a forceful lift, delayed gaze, and small balance correction", () => {
  assert.ok(at(0.10).height < 0.05);
  assert.ok(at(0.52).height > 0.7);
  assert.ok(at(0.52).pitch < at(0.52).height);
  assert.ok(at(0.75).height < at(0.68).height);
  assert.ok(at(0.75).height > 0.85);
});
