import assert from "node:assert/strict";
import {
  colliderBlocksAtFeetHeight,
  getPlatformFloorHeight,
  resolvePlatformOverlap,
} from "../src/scene/common/platform-collision.js";

const table = { minX: -1.14, maxX: 1.14, minZ: -0.59, maxZ: 0.59, topY: 0.88 };

assert.equal(colliderBlocksAtFeetHeight(table, 0), true, "table blocks its side from the floor");
assert.equal(colliderBlocksAtFeetHeight(table, 0.9), false, "player can move over a table after clearing its top");
assert.equal(
  getPlatformFloorHeight({ colliders: [table], x: 0, z: 0, feetY: 0.72 }),
  0.88,
  "descending player finds the table top",
);

const escaped = resolvePlatformOverlap({ colliders: [table], x: 0, z: 0, feetY: 0 });
assert.ok(
  escaped.x <= table.minX - 0.36 || escaped.x >= table.maxX + 0.36 ||
    escaped.z <= table.minZ - 0.36 || escaped.z >= table.maxZ + 0.36,
  "a player embedded after falling is pushed outside the furniture collider",
);
const nudged = resolvePlatformOverlap({ colliders: [table], x: 0, z: 0, feetY: 0, maxCorrection: 0.05 });
assert.equal(
  Math.hypot(nudged.x, nudged.z),
  0.05,
  "contact correction is bounded to a small per-frame nudge",
);
assert.equal(
  getPlatformFloorHeight({ colliders: [table], x: 0.9, z: 0, feetY: 0.2 }),
  0,
  "player cannot step up from the side",
);
assert.equal(
  getPlatformFloorHeight({ colliders: [table], x: 1.05, z: 0, feetY: 1 }),
  0,
  "a player only lands when fully supported by the tabletop",
);

console.log("platform collision checks passed");
