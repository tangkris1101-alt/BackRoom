import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";

// Level 2 no longer opens a door into Level 3 in the middle of Tunnel C: the
// exit is the thermal noclip site at the end of the pipe gallery. Nothing solid
// is left standing in the corridor, which is what used to trap the hound, so
// these checks drive the level the way the game does: stand in the pool, watch
// the exposure climb, and make sure the entity is refused entry.

const noop = () => {};
const gradient = { addColorStop: noop };

function makeCanvasContext() {
  const target = {
    canvas: null,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => null,
    measureText: () => ({ width: 10 }),
    getImageData: (x, y, width, height) => ({
      data: new Uint8ClampedArray(Math.max(1, width * height * 4)),
      width: Math.max(1, width),
      height: Math.max(1, height),
    }),
    createImageData: (width, height) => ({
      data: new Uint8ClampedArray(Math.max(1, width * height * 4)),
      width: Math.max(1, width),
      height: Math.max(1, height),
    }),
  };
  return new Proxy(target, {
    get: (object, key) => (key in object ? object[key] : noop),
    set: (object, key, value) => {
      object[key] = value;
      return true;
    },
  });
}

function makeCanvas() {
  const canvas = {
    width: 1,
    height: 1,
    style: {},
    addEventListener: noop,
    removeEventListener: noop,
    setAttribute: noop,
    toDataURL: () => "data:image/png;base64,",
  };
  canvas.getContext = () => {
    const context = makeCanvasContext();
    context.canvas = canvas;
    return context;
  };
  return canvas;
}

function makeElement(tagName) {
  if (tagName === "canvas") return makeCanvas();
  return {
    tagName: String(tagName).toUpperCase(),
    style: {},
    dataset: {},
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    children: [],
    addEventListener: noop,
    removeEventListener: noop,
    setAttribute: noop,
    removeAttribute: noop,
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    removeChild: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    getContext: () => null,
    focus: noop,
    blur: noop,
  };
}

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
globalThis.document = {
  createElement: makeElement,
  createElementNS: (namespace, tagName) => makeElement(tagName),
  addEventListener: noop,
  removeEventListener: noop,
  body: makeElement("body"),
  head: makeElement("head"),
  documentElement: makeElement("html"),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  hidden: false,
  visibilityState: "visible",
};

const STEP = 1 / 60;

async function withLevelTwo(run) {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  try {
    const { createLevelTwoScene } = await vite.ssrLoadModule("/src/scene/level-two/index.js");
    const layout = await vite.ssrLoadModule("/src/scene/level-two/layout.js");
    const { HUB_LEVEL } = await vite.ssrLoadModule("/src/scene/constants.js");
    await run({ createLevelTwoScene, layout, HUB_LEVEL });
  } finally {
    await vite.close();
  }
}

function advance(world, seconds, playerPosition, effects = {}, startElapsed = 0) {
  let elapsed = startElapsed;
  let metrics = null;
  for (let index = 0; index < Math.round(seconds / STEP); index += 1) {
    elapsed += STEP;
    metrics = world.update(STEP, elapsed, playerPosition, effects);
  }
  return { metrics, elapsed };
}

test("Level 2 exits into Level 3 through the thermal gallery, never through a corridor door", async () => {
  await withLevelTwo(async ({ createLevelTwoScene, layout }) => {
    const world = createLevelTwoScene();
    const gallery = layout.LEVEL_TWO_HEAT_GALLERY_CENTER;
    const { LEVEL_TWO_HEAT_GALLERY } = layout;

    const routes = world.scene.userData.exitRoutes ?? [];
    assert.ok(
      !routes.some((route) => route.id === "level-two-door-level-three"),
      "the corridor door into Level 3 must be gone",
    );
    // The compass and the HUD aim at the gallery: it is the way out now.
    assert.equal(Math.round(world.targetPosition.x), Math.round(gallery.x - 4));
    assert.equal(Math.round(world.targetPosition.z), Math.round(gallery.z));

    // Walk into the pool and stand there.
    const player = { x: gallery.x, y: 0, z: gallery.z };
    const before = advance(world, LEVEL_TWO_HEAT_GALLERY.noclipSeconds - 0.5, player);
    assert.equal(before.metrics.exitReached, false, "the floor must hold before the dwell elapses");
    assert.ok(before.metrics.environmentDamagePerSecond > 0, "the pool burns while you stand in it");
    assert.ok(before.metrics.screenEffects.vignette > 0.2, "heat haze ramps up with exposure");
    assert.match(before.metrics.statusText, /CORE TEMP/, "the HUD reports the rising core temperature");

    const after = advance(world, 1, player, {}, before.elapsed);
    assert.equal(after.metrics.exitReached, true, "the floor gives way at full exposure");
    assert.equal(after.metrics.nextLevel, 3);
    assert.equal(after.metrics.exitId, "level-two-thermal-noclip");
    assert.equal(after.metrics.screenEffects.whiteout, 1);
    assert.equal(after.metrics.environmentDamagePerSecond, 0, "no more burning once the noclip starts");

    // Stepping out cools the meter back down instead of banking progress.
    const coolWorld = createLevelTwoScene();
    const warmed = advance(coolWorld, LEVEL_TWO_HEAT_GALLERY.noclipSeconds / 2, { x: gallery.x, y: 0, z: gallery.z });
    assert.ok(warmed.metrics.screenEffects.vignette > 0.1);
    const cooled = advance(coolWorld, LEVEL_TWO_HEAT_GALLERY.coolSeconds, { x: gallery.x - 30, y: 0, z: gallery.z }, {}, warmed.elapsed);
    assert.equal(cooled.metrics.screenEffects.vignette, 0, "exposure bleeds off once the player leaves");
    assert.equal(cooled.metrics.exitReached, false);
  });
});

test("Level 2 hound refuses to enter the thermal gallery", async () => {
  await withLevelTwo(async ({ createLevelTwoScene, layout }) => {
    const world = createLevelTwoScene();
    const gallery = layout.LEVEL_TWO_HEAT_GALLERY_CENTER;
    const { LEVEL_TWO_HEAT_GALLERY } = layout;

    // Stand in the pool: the hound is drawn to the player and pushed against the
    // gallery boundary for the whole run.
    const player = { x: gallery.x, y: 0, z: gallery.z };
    const run = advance(world, 26, player, { playerMoving: true, playerSprinting: true });
    const hound = run.metrics.entities[0];
    assert.ok(Number.isFinite(hound.x), "the hound keeps a live position");

    let intruded = false;
    let elapsed = run.elapsed;
    let closest = Infinity;
    let closestToPlayer = Infinity;
    for (let index = 0; index < 600; index += 1) {
      elapsed += STEP;
      const metrics = world.update(STEP, elapsed, player, { playerMoving: true, playerSprinting: true });
      const entity = metrics.entities[0];
      const distance = Math.hypot(entity.x - gallery.x, entity.z - gallery.z);
      closest = Math.min(closest, distance);
      closestToPlayer = Math.min(closestToPlayer, entity.distance);
      if (distance < LEVEL_TWO_HEAT_GALLERY.triggerRadius) intruded = true;
    }
    assert.equal(closest < Infinity, true);
    assert.equal(intruded, false, `the hound must wait outside the hot floor (closest ${closest.toFixed(2)}m)`);
    // Standing in the pool has to be survivable: the hound's reach is 1.18m.
    assert.ok(
      closestToPlayer > 1.18,
      `the hound must never reach a player standing in the heat (closest ${closestToPlayer.toFixed(2)}m)`,
    );
  });
});

test("Level 2 releases a hound that a save restored inside the gallery", async () => {
  await withLevelTwo(async ({ createLevelTwoScene, layout }) => {
    const gallery = layout.LEVEL_TWO_HEAT_GALLERY_CENTER;
    const { LEVEL_TWO_HEAT_GALLERY } = layout;
    const world = createLevelTwoScene({
      initialState: {
        entities: [{ type: "hound", position: { x: gallery.x, z: gallery.z }, yaw: 0 }],
      },
    });

    // The player waits outside; the restored hound has to walk out on its own.
    const player = { x: gallery.x - 10, y: 0, z: gallery.z };
    const run = advance(world, 12, player);
    const hound = run.metrics.entities[0];
    const distance = Math.hypot(hound.x - gallery.x, hound.z - gallery.z);
    assert.ok(
      distance > LEVEL_TWO_HEAT_GALLERY.triggerRadius,
      `a hound restored inside the heat must be able to leave it (distance ${distance.toFixed(2)})`,
    );
  });
});

test("Level 2 keeps the Hub doorway sealed until the corridor walk is performed", async () => {
  await withLevelTwo(async ({ createLevelTwoScene, layout, HUB_LEVEL }) => {
    const world = createLevelTwoScene();
    const trail = layout.LEVEL_TWO_HUB_TRAIL;
    const cellCenter = (cell) => layout.levelTwoCellCenter(cell.col, cell.row);
    const doorCenter = cellCenter(trail.door);
    const stand = { x: doorCenter.x, y: 0, z: doorCenter.z + 2.3 };

    // Sealed: a flush slab, no doorway, and no way to open it.
    const sealed = world.interact(stand, {});
    assert.notEqual(sealed?.exitRoute, true, "a sealed slab cannot be opened");
    assert.equal(
      world.scene.getObjectByName("level-two-hub-seal-plug").visible,
      true,
      "the plug is what the player sees while the route is sealed",
    );
    assert.equal(
      world.scene.getObjectByName("exit-network-level-two-hidden-hub-door").visible,
      false,
      "the doorway itself stays hidden",
    );

    let run = advance(world, 0.1, stand);
    let elapsed = run.elapsed;
    const stepInto = (cell) => {
      const center = cellCenter(cell);
      run = advance(world, 0.05, { x: center.x, y: 0, z: center.z }, {}, elapsed);
      elapsed = run.elapsed;
      return run.metrics;
    };

    // A wrong turn holds the progress instead of advancing it.
    stepInto(trail.start);
    stepInto({ col: 29, row: 12 });
    assert.doesNotMatch(run.metrics.statusText, /NEXUS TRAIL/, "an off-route cell does not advance the walk");

    // Up, up, down, down, left, right, left, right, then the two plates.
    stepInto(trail.start);
    for (const step of trail.steps) stepInto(step);
    assert.equal(run.metrics.statusText, "NEXUS TRAIL COMPLETE");

    // Woken: the slab drops away, the doorway is there and it opens.
    advance(world, 1.6, stand, {}, elapsed);
    const seal = world.scene.getObjectByName("level-two-hub-seal");
    assert.equal(
      seal.getObjectByName("level-two-hub-seal-plug").visible,
      false,
      "the plug is gone once the doorway wakes",
    );
    seal.children
      .filter((child) => child.name === "level-two-hub-seal-seam")
      .forEach((seam) => assert.equal(seam.visible, false, "the seam is gone with the plug"));
    assert.equal(world.scene.getObjectByName("exit-network-level-two-hidden-hub-door").visible, true);

    world.camera.position.set(stand.x, 1.62, stand.z);
    world.camera.lookAt(doorCenter.x, 1.35, doorCenter.z);
    world.camera.updateMatrixWorld(true);
    const wokenRun = advance(world, 0.05, stand, {}, elapsed);
    assert.equal(wokenRun.metrics.focusInteraction?.id, "level-two-hidden-hub-door");

    const open = world.interact(stand, {});
    assert.equal(open?.exitRoute, true, "the woken doorway opens");
    assert.equal(open?.targetLevel, HUB_LEVEL);
    assert.equal(open?.i18n?.en?.name, "NEXUS DOORWAY");
  });
});

test("Level 2 restores an already-woken Hub doorway from a save", async () => {
  await withLevelTwo(async ({ createLevelTwoScene, layout }) => {
    const doorCenter = layout.levelTwoCellCenter(
      layout.LEVEL_TWO_HUB_TRAIL.door.col,
      layout.LEVEL_TWO_HUB_TRAIL.door.row,
    );
    const world = createLevelTwoScene({
      initialState: { interactions: { "level-two-hidden-hub-door": { count: 1, unlocked: true } } },
    });
    assert.equal(
      world.scene.getObjectByName("level-two-hub-seal-plug").visible,
      false,
      "a save from after the walk must not re-seal the doorway",
    );
    assert.equal(world.scene.getObjectByName("exit-network-level-two-hidden-hub-door").visible, true);

    const stand = { x: doorCenter.x, y: 0, z: doorCenter.z + 2.3 };
    const run = advance(world, 0.2, stand);
    assert.equal(run.metrics.exitReached, false, "an open Hub doorway is not a transition by itself");
  });
});
