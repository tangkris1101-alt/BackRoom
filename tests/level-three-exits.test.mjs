import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";

// Level 3's two exits used to be loose props dropped on a cell centre: the
// office car faced the wall behind it and sat in the middle of the hall, and
// the hotel car stood a few corridors from the entry stub. Entity movers plan
// against the cell grid but move against the door colliders, so both doorways
// also collected entities that could never get out.
//
// These checks pin the fixes: wall mounts that face the room, a second exit
// that is a real walk away from the entry, and an entity navigation grid that
// treats the doorway cells as closed.

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

async function withLevelThree(run) {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  try {
    const { createLevelThreeScene } = await vite.ssrLoadModule("/src/scene/level-three/index.js");
    const layout = await vite.ssrLoadModule("/src/scene/level-three/layout.js");
    await run({ createLevelThreeScene, layout });
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

// The mount rotations name the wall the prop stands against (N = 0, S = 180,
// W = 90, E = -90 degrees), keyed in degrees so the float never decides.
const WALL_BY_DEGREES = new Map([
  [0, { dCol: 0, dRow: -1 }],
  [180, { dCol: 0, dRow: 1 }],
  [90, { dCol: -1, dRow: 0 }],
  [-90, { dCol: 1, dRow: 0 }],
]);

test("Level 3 mounts both elevators on a wall, facing the room", async () => {
  await withLevelThree(async ({ createLevelThreeScene, layout }) => {
    const world = createLevelThreeScene();
    const routes = world.scene.userData.exitRoutes ?? [];
    const byId = new Map(routes.map((route) => [route.id, route]));
    const office = byId.get("level-three-elevator-level-four");
    const hotel = byId.get("level-three-elevator-level-five");
    assert.ok(office && hotel, "both exits exist");

    for (const route of [office, hotel]) {
      const cell = layout.levelThreeWorldToCell(route.position.x, route.position.z);
      const mount = layout.getLevelThreeTargetMount(layout.levelThreeCellCenter(cell.col, cell.row));
      assert.ok(
        Math.hypot(mount.x - route.position.x, mount.z - route.position.z) < 0.01,
        `${route.id} stands on its wall mount`,
      );
      const degrees = Math.round((mount.rotation * 180) / Math.PI);
      const wall = WALL_BY_DEGREES.get(degrees);
      assert.ok(wall, `${route.id} rotation matches a wall mount`);
      // The built model, not just the route table, carries the mount yaw.
      const model = world.scene.getObjectByName(`exit-network-${route.id}`);
      assert.ok(model, `${route.id} has a model`);
      assert.equal(
        Math.round((model.rotation.y * 180) / Math.PI + 360) % 360,
        (degrees + 360) % 360,
        `${route.id} is built with the mount rotation`,
      );
      // The prop is mounted against a solid cell, so its doorway opens into the
      // room rather than into the wall.
      assert.equal(
        layout.isLevelThreeOpenCell(cell.col + wall.dCol, cell.row + wall.dRow),
        false,
        `${route.id} backs onto a solid cell`,
      );
      // And the cell in front of the doorway is open floor.
      const front = { dCol: -wall.dCol, dRow: -wall.dRow };
      assert.equal(
        layout.isLevelThreeOpenCell(cell.col + front.dCol, cell.row + front.dRow),
        true,
        `${route.id} opens onto walkable floor`,
      );
    }
  });
});

test("Level 3 keeps the second exit a real walk from the entry stub", async () => {
  await withLevelThree(async ({ createLevelThreeScene, layout }) => {
    const world = createLevelThreeScene();
    const routes = world.scene.userData.exitRoutes ?? [];
    const byId = new Map(routes.map((route) => [route.id, route]));
    const entry = layout.levelThreeCellCenter(3, 3);
    const hotel = byId.get("level-three-elevator-level-five").position;
    const office = byId.get("level-three-elevator-level-four").position;

    const entryToHotel = Math.hypot(hotel.x - entry.x, hotel.z - entry.z);
    const entryToOffice = Math.hypot(office.x - entry.x, office.z - entry.z);
    assert.ok(entryToHotel > 110, `the hotel car is a long walk in (${entryToHotel.toFixed(0)}m)`);
    assert.ok(
      entryToHotel > entryToOffice * 0.5,
      "the hotel car is not the quick way out of the arrival stub",
    );
    assert.ok(
      Math.hypot(hotel.x - office.x, hotel.z - office.z) > 12,
      "the two cars do not share a room",
    );
    // The car lives in the Boiler Room, which is where the hotel link comes up.
    assert.equal(layout.isLevelThreeOpenCell(30, 18), true);
  });
});

test("Level 3 entities never stand in an elevator cell", async () => {
  await withLevelThree(async ({ createLevelThreeScene, layout }) => {
    const world = createLevelThreeScene();
    const office = world.scene.userData.exitRoutes.find(
      (route) => route.id === "level-three-elevator-level-four",
    );
    const hotels = layout.LEVEL_THREE_ELEVATOR_CELLS;

    // Stand on the office car: every entity is drawn to the player and pushed
    // against the doorway for the whole run.
    const player = { x: office.position.x, y: 0, z: office.position.z + 1.2 };
    let run = advance(world, 30, player, { playerMoving: true, playerSprinting: true });
    let elapsed = run.elapsed;

    const intruders = new Set();
    for (let index = 0; index < 600; index += 1) {
      elapsed += STEP;
      const metrics = world.update(STEP, elapsed, player, { playerMoving: true, playerSprinting: true });
      for (const entity of metrics.entities) {
        const cell = layout.levelThreeWorldToCell(entity.x, entity.z);
        if (hotels.some((elevator) => elevator.col === cell.col && elevator.row === cell.row)) {
          intruders.add(entity.id ?? entity.type);
        }
      }
    }
    assert.deepEqual([...intruders], [], "no entity walks into a doorway cell");
  });
});

test("Level 3 snaps a saved entity out of an elevator cell", async () => {
  await withLevelThree(async ({ createLevelThreeScene, layout }) => {
    const officeCell = layout.LEVEL_THREE_ELEVATOR_CELLS[0];
    const center = layout.levelThreeCellCenter(officeCell.col, officeCell.row);
    const world = createLevelThreeScene({
      initialState: {
        entities: [
          { type: "hound", position: { x: center.x, z: center.z }, yaw: 0 },
          { type: "bacteria", position: { x: center.x, z: center.z }, yaw: 0 },
        ],
      },
    });
    const metrics = world.update(1 / 60, 1 / 60, { x: 0, y: 0, z: 0 }, {});
    for (const entity of metrics.entities) {
      const cell = layout.levelThreeWorldToCell(entity.x, entity.z);
      assert.equal(
        layout.isLevelThreeElevatorCell(cell.col, cell.row),
        false,
        `${entity.id} is restored outside the doorway`,
      );
    }
  });
});
