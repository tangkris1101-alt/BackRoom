import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";

// The adaptive-quality ladder used to answer only outside a 54-58fps band, so a
// machine pinned at 100% GPU while sitting at 55-57fps never shed anything. It
// now decides against the frame rate the player actually asked for, which makes
// the policy testable without a GPU: updateAdaptive is pure bookkeeping over the
// samples main.js feeds it.
//
// The rungs themselves (ambient occlusion, bloom, the shadow map resize) only
// exist once a composer is built, so this drives the same policy through the
// shadow rung and the pixel-ratio verdict. The shim mirrors
// scripts/check-light-count-stability.mjs: the pipeline module pulls in three's
// addons, so it has to be loaded through vite.

const noop = () => {};

globalThis.window = {
  addEventListener: noop,
  removeEventListener: noop,
  devicePixelRatio: 1,
  innerWidth: 1280,
  innerHeight: 720,
  matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: noop,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
  location: { protocol: "http:", href: "http://localhost/", search: "" },
};

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
const failures = [];
let summary = "";
try {
  const { createRenderingPipeline, ADAPTIVE_SHED_MARGIN_FPS } = await server.ssrLoadModule("/src/rendering-pipeline.js");
  const { getGraphicsProfile } = await server.ssrLoadModule("/src/graphics-profile.js");

  const profile = getGraphicsProfile("high");
  assert.equal(ADAPTIVE_SHED_MARGIN_FPS, 2, "main.js shares this margin for the pixel-ratio lever");

  function makePipeline() {
    const renderer = {
      shadowMap: {},
      info: { autoReset: true, reset: noop, memory: {}, programs: [] },
      capabilities: {},
    };
    return createRenderingPipeline(renderer, { dataset: {} }, profile);
  }
  const feed = (pipeline, fps, samples, targetFps = 60) => {
    const results = [];
    for (let index = 0; index < samples; index += 1) results.push(pipeline.updateAdaptive(fps, targetFps));
    return results;
  };
  const changedCount = (results) => results.filter((result) => result.changed).length;

  // 1. The dead band itself. 57fps against a 60fps target used to satisfy
  //    neither "below 54" nor "above 58", so three samples did nothing at all.
  {
    const pipeline = makePipeline();
    const before = feed(pipeline, 57, 2);
    assert.equal(changedCount(before), 0, "the ladder must not act on one or two missed samples");
    const after = feed(pipeline, 57, 1);
    assert.equal(changedCount(after), 1, "57fps against a 60fps target has to take a step off");
  }

  // 2. The resolution stays out of it while the ladder still has a rung to give.
  {
    const pipeline = makePipeline();
    const early = feed(pipeline, 57, 2).map((result) => result.canReducePixelRatio);
    assert.deepEqual(early, [false, false], "the resolution must wait for the ladder to spend itself");
    feed(pipeline, 57, 3);
    const spent = feed(pipeline, 57, 1)[0];
    assert.equal(spent.canReducePixelRatio, true, "once the ladder is spent the resolution is the next lever");
    assert.equal(spent.canRaisePixelRatio, false, "the resolution must not rise while a rung is off");
  }

  // 3. A rung comes back only after the target is held, and a probe that fails
  //    doubles the proof the next one needs instead of flickering every few
  //    seconds.
  {
    const pipeline = makePipeline();
    feed(pipeline, 57, 3);
    const restored = feed(pipeline, 60, 12);
    assert.equal(changedCount(restored), 1, "holding the target has to bring the rung back");

    // Back under the line inside the probation window: the rung comes off again.
    assert.equal(changedCount(feed(pipeline, 57, 3)), 1, "a failing probe has to be reverted");
    assert.equal(changedCount(feed(pipeline, 60, 12)), 0, "a failed probe must not be retried on the same short window");
    assert.equal(changedCount(feed(pipeline, 60, 12)), 1, "the doubled window has to restore it again");
  }

  // 4. A rung that holds its probation window is trusted again, so the backoff
  //    does not ratchet up forever.
  {
    const pipeline = makePipeline();
    feed(pipeline, 57, 3);
    feed(pipeline, 60, 12);            // restore, probation window opens
    feed(pipeline, 60, 24);            // probation survives
    assert.equal(changedCount(feed(pipeline, 57, 3)), 1, "still reactive after a good probe");
  }

  // 5. The target is the player's frame rate, not a hardcoded 60: at a 30fps cap
  //    a solid 29fps is left alone and 27fps is not.
  {
    const pipeline = makePipeline();
    assert.equal(changedCount(feed(pipeline, 29, 6, 30)), 0, "29fps against a 30fps cap is not missing the target");
    assert.equal(changedCount(feed(pipeline, 27, 3, 30)), 1, "27fps against a 30fps cap has to shed");
  }

  // 6. Low quality has no rungs to shed, so the resolution lever must stay
  //    available from the first sample - the old early-out did the same.
  {
    const low = createRenderingPipeline(
      { shadowMap: {}, info: { autoReset: true, reset: noop, memory: {}, programs: [] }, capabilities: {} },
      { dataset: {} },
      getGraphicsProfile("low"),
    );
    assert.equal(feed(low, 50, 1)[0].canReducePixelRatio, true, "low quality resolves with the resolution alone");
  }

  summary = "no dead band, resolution gated behind the ladder, probes back off";
} catch (error) {
  failures.push(`adaptive quality checks could not run: ${error?.message ?? error}`);
} finally {
  await server.close();
}

// 7. Main.js has to keep driving the ladder with the real target instead of the
//    old fixed thresholds.
try {
  const source = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  if (/FPS_LOW_THRESHOLD|FPS_HIGH_THRESHOLD/.test(source)) {
    failures.push("main.js still defines the retired 54/58 thresholds");
  }
  if (!/renderingPipeline\.updateAdaptive\(displayedFps, targetFps\)/.test(source)) {
    failures.push("main.js no longer passes the target frame rate into updateAdaptive");
  }
  if (!/function getAdaptiveTargetFps\(\)/.test(source)) {
    failures.push("main.js no longer derives the target frame rate from the limit/refresh rate");
  }
} catch (error) {
  failures.push(`main.js could not be inspected: ${error?.message ?? error}`);
}

if (failures.length) {
  console.error("adaptive quality checks failed:\n" + failures.map((failure) => `  - ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`adaptive quality checks passed (${summary})`);
