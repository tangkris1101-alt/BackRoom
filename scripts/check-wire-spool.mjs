import assert from "node:assert/strict";
import * as THREE from "three";
import { createServer } from "vite";
import { readFile } from "node:fs/promises";

// The wire spool is a decorative world item: its spawn offsets, floor offset and
// aim box were authored against a 0.5m spool lying on its side. Swapping the old
// single-cylinder stand-in for a modelled spool must therefore keep the
// silhouette, keep the flat material rules of a held/world item, and keep
// building in Node where there is no canvas to paint textures into.
//
// The DOM shim mirrors scripts/check-light-count-stability.mjs.

const noop = () => {};
const gradient = { addColorStop: noop };

function makeCanvasContext() {
  const target = {
    canvas: null,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => null,
    measureText: () => ({ width: 10 }),
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

function describe(model) {
  const box = new THREE.Box3().setFromObject(model);
  const seen = new Map();
  let meshes = 0;
  let triangles = 0;
  let lowest = Infinity;
  const position = new THREE.Vector3();
  model.updateMatrixWorld(true);
  model.traverse((object) => {
    if (!object.isMesh) return;
    meshes += 1;
    const geometry = object.geometry;
    triangles += (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
    seen.set(object.material.uuid, object.material);
    const attribute = geometry.attributes.position;
    for (let index = 0; index < attribute.count; index += 1) {
      position.fromBufferAttribute(attribute, index).applyMatrix4(object.matrixWorld);
      lowest = Math.min(lowest, position.y);
    }
  });
  return { box, meshes, triangles, materials: seen, lowest };
}

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
const failures = [];
let summary = "";
try {
  const module = await server.ssrLoadModule("/src/scene/items/wire-spool.js");
  const factory = module.createWireSpoolModel;
  assert.equal(typeof factory, "function", "wire-spool.js must export createWireSpoolModel");

  const first = factory();
  const stats = describe(first);

  // 1. The stand-in it replaced was one 16-segment cylinder (~96 triangles).
  if (stats.meshes < 5 || stats.triangles < 6000) {
    failures.push(`model is too simple to be the modelled spool (${stats.meshes} meshes / ${stats.triangles} triangles)`);
  }

  // 2. Silhouette the spawn data was authored against: rim radius 0.25m, lying
  //    on its side with the axis along X and the origin at its centre.
  const size = stats.box.getSize(new THREE.Vector3());
  const centre = stats.box.getCenter(new THREE.Vector3());
  summary = `${stats.meshes} meshes, ${Math.round(stats.triangles)} triangles, ` +
    `${size.x.toFixed(2)}x${size.y.toFixed(2)}x${size.z.toFixed(2)}m, lowest ${stats.lowest.toFixed(3)}`;
  if (Math.abs(centre.y) > 0.06 || Math.abs(centre.z) > 0.06) {
    failures.push(`model centre drifted off the origin (y=${centre.y.toFixed(3)} z=${centre.z.toFixed(3)})`);
  }
  if (size.x > 0.62 || size.y > 0.64 || size.z > 0.64) {
    failures.push(`model grew past the aim box (${size.x.toFixed(2)}x${size.y.toFixed(2)}x${size.z.toFixed(2)}m)`);
  }
  if (size.y < 0.46 || size.z < 0.46) {
    failures.push(`model no longer fills the authored 0.5m rim (${size.y.toFixed(2)}x${size.z.toFixed(2)}m)`);
  }

  // 3. Floor contact: the rim and the lead end have to sit on the floor plane
  //    when the item is placed at the authored 0.26m offset.
  if (stats.lowest > -0.244 || stats.lowest < -0.262) {
    failures.push(`lowest point sits at y=${stats.lowest.toFixed(4)}, which no longer matches the 0.26m floor offset`);
  }

  // 4. World and held copies are lit and flagged independently, so no material
  //    instance may be shared between two builds (the held copy rewrites
  //    depthTest/depthWrite/needsUpdate on every one of its materials).
  const second = factory();
  for (const uuid of describe(second).materials.keys()) {
    if (stats.materials.has(uuid)) failures.push(`a material instance is shared between two spool builds (${uuid})`);
  }

  // 5. Items never cast or receive shadows; the level paints its own floor
  //    contact decal for pickups.
  first.traverse((object) => {
    if (!object.isMesh) return;
    if (object.castShadow || object.receiveShadow) {
      failures.push(`${object.name || object.type} must not cast or receive shadows`);
    }
  });

  // 6. Node-side scene builds run without a canvas: the model must fall back to
  //    flat colours instead of throwing.
  const savedDocument = globalThis.document;
  globalThis.document = undefined;
  try {
    const headless = describe(factory());
    if (headless.meshes !== stats.meshes) {
      failures.push(`headless build produced ${headless.meshes} meshes instead of ${stats.meshes}`);
    }
  } catch (error) {
    failures.push(`headless build failed: ${error?.message ?? error}`);
  } finally {
    globalThis.document = savedDocument;
  }
} catch (error) {
  failures.push(`wire-spool checks could not run: ${error?.message ?? error}`);
} finally {
  await server.close();
}

// 7. Both authored spawns place the spool at the height its rim rests at. They
//    used to drop it 0.2m into the slab, which buried the bottom of the part.
for (const level of ["two", "three"]) {
  const source = await readFile(new URL(`../src/scene/level-${level}/index.js`, import.meta.url), "utf8");
  const spawn = /id: "wire-spool", position: \{ \.\.\.[A-Za-z]+CellCenter\(\d+, \d+\), y: ([\d.]+) \}/.exec(source);
  if (!spawn) {
    failures.push(`level-${level} no longer spawns a wire-spool in the expected shape`);
    continue;
  }
  const y = Number(spawn[1]);
  if (!(y >= 0.25 && y <= 0.28)) {
    failures.push(`level-${level} spawns the wire-spool at y=${y}; its rim rests at 0.26 and anything lower sinks it into the floor`);
  }
}

if (failures.length) {
  console.error(
    "wire spool checks failed:\n" + failures.map((failure) => `  - ${failure}`).join("\n"),
  );
  process.exit(1);
}

console.log(`wire spool checks passed (${summary}; silhouette, floor contact and flat materials intact)`);
