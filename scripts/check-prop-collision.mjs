import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  colliderBlocksAtFeetHeight,
  getPlatformFloorHeight,
  resolvePlatformOverlap,
} from "../src/scene/common/platform-collision.js";
import { getManilaRoomFurniture } from "../src/scene/level-zero/manila-room.js";
import { MANILA_ROOM, cellCenter } from "../src/scene/level-zero/layout.js";

const PLAYER_RADIUS = 0.36;

// Level 0's M.E.G. documentation room keeps a chair in front of the table. It
// used to be scenery only: the seat and the backrest had no collider, so the
// player walked straight through both.
const roomCenter = cellCenter(
  MANILA_ROOM.col + Math.floor(MANILA_ROOM.width / 2),
  MANILA_ROOM.row + Math.floor(MANILA_ROOM.height / 2),
);
const { colliders, chairX, chairZ, tableX, tableZ } = getManilaRoomFurniture(roomCenter);
const [table, seat, back] = colliders;

assert.equal(colliders.length, 3, "the room publishes the table plus both chair layers");
assert.ok(table.maxZ < seat.minZ, "the chair layer never merges with the tabletop");

const blocks = (x, z, feetY = 0) =>
  colliders.some(
    (collider) =>
      colliderBlocksAtFeetHeight(collider, feetY) &&
      x + PLAYER_RADIUS > collider.minX &&
      x - PLAYER_RADIUS < collider.maxX &&
      z + PLAYER_RADIUS > collider.minZ &&
      z - PLAYER_RADIUS < collider.maxZ,
  );

assert.equal(blocks(chairX, chairZ - 0.1), true, "the chair seat blocks a walking player");
assert.equal(blocks(chairX - 0.05, chairZ + 0.31), true, "the backrest blocks a walking player");
assert.equal(blocks(chairX, chairZ + 1.2), false, "the aisle behind the chair stays open");
assert.equal(blocks(tableX, tableZ), true, "the documentation table still blocks");

// The seat is low enough to clear midway through a jump, while the backrest
// keeps blocking, so the chair reads as a solid object rather than a wall.
assert.equal(colliderBlocksAtFeetHeight(seat, 0), true);
assert.equal(colliderBlocksAtFeetHeight(seat, 0.46), false);
assert.equal(colliderBlocksAtFeetHeight(back, 1), true);

// The chair is too small to be fully supported by the player's radius, so it
// stays an obstacle instead of an unintended standing surface.
assert.equal(getPlatformFloorHeight({ colliders, x: chairX, z: chairZ, feetY: 1.1 }), 0);
assert.equal(getPlatformFloorHeight({ colliders, x: tableX, z: tableZ, feetY: 1.1 }), 1.11);

const escaped = resolvePlatformOverlap({ colliders, x: chairX, z: chairZ, feetY: 0 });
assert.equal(
  blocks(escaped.x, escaped.z),
  false,
  "a player who lands inside the chair is pushed back out",
);

// Every playable level wires its prop colliders through the shared height-aware
// helpers, so a prop with a `topY` can be jumped over or stood on instead of
// acting as an invisible full-height wall, and a player who ends up inside one
// is pushed out again.
const LEVEL_DIRECTORIES = [
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
];
for (const level of LEVEL_DIRECTORIES) {
  const source = await readFile(new URL(`../src/scene/level-${level}/index.js`, import.meta.url), "utf8");
  assert.match(
    source,
    /colliderBlocksAtFeetHeight\(|createGridCollision\(/,
    `level ${level} must filter prop colliders by feet height`,
  );
  assert.match(source, /getFloorHeight/, `level ${level} must publish getFloorHeight`);
  assert.match(source, /resolvePosition/, `level ${level} must publish resolvePosition`);
}

// The hub used to have no floor height at all: the 10.5cm raised walkways were
// walked through, and the only reason its fifteen doors could still be reached
// was a missing floor strip that the walkable clamp silently treated as ground.
const hubSource = await readFile(new URL("../src/scene/hub/index.js", import.meta.url), "utf8");
assert.match(hubSource, /colliderBlocksAtFeetHeight\(/, "the hub must filter its walkway colliders by feet height");
assert.match(hubSource, /getFloorHeight,/, "the hub must publish getFloorHeight");
assert.match(hubSource, /resolvePosition,/, "the hub must publish resolvePosition");
assert.match(hubSource, /hub-floor-pad-/, "the hub must pave the strip its doors are reached from");
assert.match(hubSource, /FLOOR_PAD_OUTER_X/, "the hub floor pads must reach the wall face");

// Door leaves are solid while closed and, for single doors, swing into the
// corridor once opened. Both states are published as toggled colliders.
const exitNetworkSource = await readFile(new URL("../src/scene/common/exit-network.js", import.meta.url), "utf8");
assert.match(exitNetworkSource, /doorCollider/, "exit network doors must publish a shut-leaf collider");
assert.match(exitNetworkSource, /swingCollider/, "single exit network doors must publish an open-leaf collider");
for (const level of [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "eleven",
  "thirty-seven",
]) {
  const source = await readFile(new URL(`../src/scene/level-${level}/index.js`, import.meta.url), "utf8");
  assert.match(
    source,
    /createExitNetwork\([\s\S]{0,400}?colliders/,
    `level ${level} must hand its collider set to the exit network so doors are solid`,
  );
}

// Level 3 cabinets, notes, murals and stains must hug a wall instead of
// floating on the cell centre they used to be returned for.
const levelThreeLayout = await import("../src/scene/level-three/layout.js");
const MOUNT_FACING = {
  0: [0, -1],
  [Math.PI]: [0, 1],
  [Math.PI / 2]: [-1, 0],
  [-Math.PI / 2]: [1, 0],
};
for (const [col, row] of [[5, 5], [8, 7], [14, 14], [11, 17], [30, 19], [9, 8], [20, 5], [23, 9], [14, 17], [19, 8], [32, 18]]) {
  const cell = levelThreeLayout.levelThreeCellCenter(col, row);
  const mount = levelThreeLayout.getLevelThreeTargetMount(cell);
  const facing = MOUNT_FACING[mount.rotation];
  assert.ok(facing, `level 3 mount at cell ${col},${row} must face one of the four walls`);
  const own = levelThreeLayout.levelThreeWorldToCell(mount.x, mount.z);
  const ownCenter = levelThreeLayout.levelThreeCellCenter(own.col, own.row);
  assert.ok(
    Math.abs(Math.hypot(mount.x - ownCenter.x, mount.z - ownCenter.z) - 1.846) < 1e-6,
    `level 3 mount at cell ${col},${row} must sit one bracket offset from its cell centre`,
  );
  assert.equal(
    levelThreeLayout.isLevelThreeOpenCell(own.col + facing[0], own.row + facing[1]),
    false,
    `level 3 mount at cell ${col},${row} must back onto a solid cell`,
  );
}

// Level 3's floor plane was re-centred on the world origin, so 115 walkable
// cells had no floor under them.
const levelThreeIndexSource = await readFile(new URL("../src/scene/level-three/index.js", import.meta.url), "utf8");
assert.doesNotMatch(
  levelThreeIndexSource,
  /floor\.position\.set\(\s*0\s*,\s*0\s*,\s*0\s*\)/,
  "level 3's floor must stay centred on the level grid, not the world origin",
);
assert.match(
  levelThreeIndexSource,
  /floor\.position\.set\(LEVEL_THREE_CENTER_X, 0, LEVEL_THREE_CENTER_Z\)/,
  "level 3's floor must share the ceiling's centre",
);

// Level 4's vending machines and Level 1's crates must stand in walkable cells;
// both were reported after props were left inside sealed blocks of the grid.
const levelOneLayout = await import("../src/scene/level-one/layout.js");
const levelFourPropsSource = await readFile(new URL("../src/scene/level-four/props.js", import.meta.url), "utf8");
for (const [col, row] of [[4, 5], [29, 4], [16, 4]]) {
  assert.equal(
    levelOneLayout.isLevelOneOpenCell(col, row),
    true,
    `level 4 machine cell ${col},${row} must be walkable`,
  );
  assert.match(
    levelFourPropsSource,
    new RegExp(`col:\\s*${col},\\s*row:\\s*${row}`),
    `level 4 must still place a machine on cell ${col},${row}`,
  );
}
const levelOnePropsSource = await readFile(new URL("../src/scene/level-one/props.js", import.meta.url), "utf8");
assert.match(
  levelOnePropsSource,
  /col:\s*28,\s*row:\s*18/,
  "the crate that used to share a cell with the supply shelf must stay moved aside",
);

console.log("prop collision checks passed");
