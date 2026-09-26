import assert from "node:assert/strict";
import * as THREE from "three";
import { createServer } from "vite";

// three.js bakes the active light count into every material's shader program, so
// a level that hides or reveals a light while the player walks invalidates the
// whole level's programs and recompiles them on the spot (seconds of frozen
// frames). Scene factories only run in the browser, so this check builds every
// level behind a DOM shim, walks a synthetic player around it and asserts the
// light inventory never changes.
//
// The DOM shim mirrors scripts/check-level-scene-load.mjs.

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

function countLights(scene) {
  let total = 0;
  let visible = 0;
  scene.traverse((object) => {
    if (!object.isLight) return;
    total += 1;
    if (object.visible) visible += 1;
  });
  return { total, visible };
}

// Walks a synthetic player through the level and reports every light-inventory
// change with the light that caused it.
function findLightInventoryChanges(world, steps = 90) {
  const changes = [];
  const spawn = world.spawn ?? { x: 0, z: 0 };
  const isWalkable = typeof world.isWalkable === "function" ? world.isWalkable : () => true;
  const getFloorHeight = typeof world.getFloorHeight === "function" ? world.getFloorHeight : () => 0;
  const baseline = countLights(world.scene);
  let previous = baseline;
  let previousNames = lightNames(world.scene);
  let elapsed = 0;

  for (let step = 0; step < steps; step += 1) {
    // A widening ring around the spawn keeps the walk inside the level without
    // needing level-specific geometry, and revisits cells so time-based light
    // ranking gets a chance to reshuffle.
    const radius = 1.5 + (step % 12) * 2.6;
    const angle = step * 0.7;
    const x = spawn.x + Math.cos(angle) * radius;
    const z = spawn.z + Math.sin(angle) * radius;
    if (!isWalkable(x, z)) continue;
    const y = getFloorHeight(x, z) + 1.62;
    const position = new THREE.Vector3(x, y, z);
    const effects = {
      entityRepelActive: false,
      repelRadius: 0,
      repelSpeedMultiplier: 1,
      equippedLevelKey: null,
      debugBypassLevelKeys: false,
      flashlightBeam: { active: false },
      flashlightOn: false,
      playerView: { origin: position, direction: new THREE.Vector3(0, 0, -1), minimumDot: 0.985, entityLookHeight: 0.9 },
      playerSprinting: false,
      playerMoving: true,
      firesaltActive: false,
      firesaltPosition: null,
      firesaltRadius: 0,
    };
    for (let frame = 0; frame < 6; frame += 1) {
      elapsed += 0.12;
      world.update?.(0.05, elapsed, position, effects);
    }
    const current = countLights(world.scene);
    const names = lightNames(world.scene);
    if (current.total !== previous.total) {
      changes.push(`step ${step}: light count ${previous.total} -> ${current.total} (lights added/removed)`);
    }
    if (current.visible !== previous.visible) {
      const toggled = [...names].filter((name) => previousNames.has(name) !== names.has(name)).slice(0, 4);
      changes.push(
        `step ${step} at (${x.toFixed(1)}, ${z.toFixed(1)}): visible lights ${previous.visible} -> ${current.visible}` +
          (toggled.length ? ` [${toggled.join(", ")}]` : ""),
      );
    }
    previous = current;
    previousNames = names;
  }
  return { changes, baseline, final: previous };
}

function lightNames(scene) {
  const names = new Set();
  let index = 0;
  scene.traverse((object) => {
    if (!object.isLight) return;
    index += 1;
    if (object.visible) names.add(object.name || `${object.type}#${index}`);
  });
  return names;
}

// The detector itself has to be trustworthy: a light that toggles must be
// reported, otherwise the level walk below proves nothing.
{
  const scene = new THREE.Scene();
  const light = new THREE.PointLight(0xffffff, 1, 10, 2);
  light.name = "self-test-light";
  scene.add(light);
  const world = {
    scene,
    spawn: { x: 0, z: 0 },
    isWalkable: () => true,
    getFloorHeight: () => 0,
    update: (delta, elapsed) => {
      light.visible = Math.sin(elapsed) > 0;
    },
  };
  const { changes } = findLightInventoryChanges(world, 20);
  assert.ok(changes.length > 0, "the light-inventory detector must report a toggling light");
}

const SCENES = [
  ...[
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "thirty-seven",
  ].map((level) => ({ name: `level-${level}`, module: `/src/scene/level-${level}/index.js` })),
  { name: "hub", module: "/src/scene/hub/index.js" },
];

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
const failures = [];
let checked = 0;
try {
  for (const scene of SCENES) {
    let createScene;
    try {
      const module = await vite.ssrLoadModule(scene.module);
      createScene = Object.entries(module).find(([name]) => /^create[A-Za-z]*Scene$/.test(name))?.[1];
    } catch (error) {
      failures.push(`${scene.name}: cannot be imported (${error?.message})`);
      continue;
    }
    if (typeof createScene !== "function") continue;

    let world;
    try {
      world = createScene({ initialState: null, entryContext: null });
    } catch (error) {
      failures.push(`${scene.name}: cannot build (${error?.message})`);
      continue;
    }
    const { changes, baseline, final } = findLightInventoryChanges(world);
    checked += 1;
    if (changes.length) {
      failures.push(
        `${scene.name}: light inventory changes during play ` +
          `(start ${baseline.total} lights / ${baseline.visible} visible, end ${final.total} / ${final.visible})\n    ` +
          changes.slice(0, 6).join("\n    "),
      );
    }
  }
} finally {
  await vite.close();
}

if (failures.length) {
  console.error(
    "light count stability checks failed:\n" +
      failures.map((failure) => `  - ${failure}`).join("\n") +
      "\n\nA changing light count invalidates every material program in the level. Keep a fixed set of lights\n" +
      "in the scene and drive them with intensity/position instead of visibility.",
  );
  process.exit(1);
}

console.log(`light count stability checks passed (${checked} levels walked)`);
