import assert from "node:assert/strict";
import { createServer } from "vite";

// Scene factories are only exercised by the browser, so a module-order mistake
// such as reading a binding that is still in its temporal dead zone shows up as
// "Failed to load level scene" for the player and nowhere else. This check
// builds every level in Node behind a DOM/canvas shim, with a save that carries
// entity positions, which is the shape that reaches the saved-state code paths.

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

const SAVED_ENTITY = { type: "bacteria", position: { x: 0, z: 0 }, yaw: 0 };

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
let built = 0;
try {
  for (const scene of SCENES) {
    let createScene;
    try {
      const module = await vite.ssrLoadModule(scene.module);
      createScene = Object.entries(module).find(([name]) => /^create[A-Za-z]*Scene$/.test(name))?.[1];
    } catch (error) {
      assert.fail(`${scene.name} cannot be imported: ${error?.message}`);
    }
    assert.equal(typeof createScene, "function", `${scene.name} must export a scene factory`);

    for (const [label, initialState] of [
      ["a fresh start", null],
      ["a save with entity positions", { entities: [SAVED_ENTITY] }],
    ]) {
      let result;
      try {
        result = createScene({ initialState, entryContext: null });
      } catch (error) {
        assert.fail(`${scene.name} must build from ${label}: ${error?.message}`);
      }
      assert.ok(result && typeof result === "object", `${scene.name} must return a scene from ${label}`);
      built += 1;
    }
  }
} finally {
  await vite.close();
}

console.log(`level scene load checks passed (${built} scene builds across ${SCENES.length} levels)`);
