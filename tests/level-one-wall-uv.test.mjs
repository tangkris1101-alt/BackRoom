import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { collapseWallRuns, createWorldMappedWallGeometry } from "../src/scene/level-one/wall-geometry.js";
import { CELL_SIZE, WALL_THICKNESS } from "../src/scene/constants.js";
import { collectLevelOneTransforms } from "../src/scene/level-one/props.js";

test("adjacent modules collapse into one wall while a doorway gap remains open", () => {
  const runs = collapseWallRuns([
    new THREE.Vector3(0, 1.5, 2),
    new THREE.Vector3(4, 1.5, 2),
    new THREE.Vector3(12, 1.5, 2),
  ], "x", 4, 0.2);
  assert.equal(runs.length, 2);
  assert.equal(runs[0].width, 8);
  assert.equal(runs[0].transforms[0].x, 2);
  assert.equal(runs[1].width, 4);
  assert.equal(runs[1].transforms[0].x, 12);
});

test("Level 1 wall run merging preserves the span of every original wall group", () => {
  const { northSouth, eastWest, corridorNorthSouth, corridorEastWest } = collectLevelOneTransforms();
  const spanTolerance = CELL_SIZE * 1e-6;
  for (const [transforms, along] of [
    [northSouth, "x"], [eastWest, "z"],
    [corridorNorthSouth, "x"], [corridorEastWest, "z"],
  ]) {
    const runs = collapseWallRuns(transforms, along, CELL_SIZE, WALL_THICKNESS);
    const span = runs.reduce((sum, run) => sum + (along === "x" ? run.width : run.depth), 0);
    const expectedSpan = transforms.length * CELL_SIZE;
    // Convex corner ends stretch past the vertex, so a run may exceed the raw
    // module span; it must never fall short of it.
    const cornerTolerance = runs.length * (WALL_THICKNESS / 2 - 0.001) * 2 + spanTolerance;
    assert.ok(
      span >= expectedSpan - spanTolerance && span <= expectedSpan + cornerTolerance,
      `${along}-run span ${span} must stay within [${expectedSpan}, ${expectedSpan + cornerTolerance}]`,
    );
    assert.ok(runs.length <= transforms.length);
  }
});

test("adjacent Level 1 wall sections share continuous world-space paint UVs", () => {
  const tileMeters = 6.4;
  const { wall, caps } = createWorldMappedWallGeometry([
    {
      width: 4,
      depth: 0.2,
      transforms: [new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(4, 1.5, 0)],
    },
  ], 3, { horizontalTileMeters: tileMeters });
  const positions = wall.getAttribute("position");
  const normals = wall.getAttribute("normal");
  const uvs = wall.getAttribute("uv");
  const seamUvs = [];
  const farUvs = [];
  for (let index = 0; index < positions.count; index += 1) {
    if (normals.getZ(index) < 0.9 || Math.abs(positions.getY(index)) > 1e-6) continue;
    if (Math.abs(positions.getX(index) - 2) < 1e-6) seamUvs.push(uvs.getX(index));
    if (Math.abs(positions.getX(index) - 6) < 1e-6) farUvs.push(uvs.getX(index));
  }
  assert.ok(seamUvs.length >= 2, "both wall modules must meet at the seam");
  seamUvs.forEach((u) => assert.ok(Math.abs(u - 2 / tileMeters) < 1e-6));
  farUvs.forEach((u) => assert.ok(Math.abs(u - 6 / tileMeters) < 1e-6));
  assert.equal(positions.count, 48);
  assert.equal(caps.getAttribute("position").count, 24);
  wall.dispose();
  caps.dispose();
});

test("wall runs stretch past convex corners so perpendicular walls overlap", () => {
  const { northSouth, eastWest } = collectLevelOneTransforms();
  const extension = WALL_THICKNESS / 2 - 0.001;
  const extended = [...northSouth, ...eastWest].filter((transform) => transform.scale);
  assert.ok(extended.length > 0, "some wall ends must be stretched to fill a corner");
  for (const transform of extended) {
    const isAlongX = transform.scale.x !== 1;
    const scale = isAlongX ? transform.scale.x : transform.scale.z;
    assert.ok(scale > 1 && scale < 1 + extension, `unexpected corner stretch ${scale}`);
    const other = isAlongX ? transform.scale.z : transform.scale.x;
    assert.equal(other, 1, "only the run axis may stretch");
  }
  const runs = collapseWallRuns(northSouth, "x", CELL_SIZE, WALL_THICKNESS);
  const span = runs.reduce((sum, run) => sum + run.width, 0);
  const plainSpan = northSouth.length * CELL_SIZE;
  assert.ok(span > plainSpan, "corner extension must widen the wall surface");
  assert.ok(span - plainSpan <= runs.length * extension * 2 + 1e-6);

});
