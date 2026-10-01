import assert from "node:assert/strict";
import { test } from "node:test";
import { CELL_SIZE, WALL_THICKNESS } from "../src/scene/constants.js";
import { WALL_CORNER_EXTENSION } from "../src/scene/common/wall-corners.js";
import {
  COLS,
  ROWS,
  MAP,
  START_CELL,
  EXIT_CELL,
  LEVEL_ZERO_ANGLED_CELLS,
  CELL_OPEN,
  DIAGONAL_TYPES,
  DIAGONAL_WALL_LENGTH,
  isOpenCell,
  isDiagonalCell,
  getDiagonalPorts,
  diagonalSideSpan,
  diagonalWallTransform,
  pointInDiagonalCell,
  walkableCenter,
  cellCenter,
  worldToCell,
  ORIGIN_X,
  ORIGIN_Z,
} from "../src/scene/level-zero/layout.js";
import { collectWallTransforms, LEVEL_ZERO_ROOM_TABLE_CELLS } from "../src/scene/level-zero/world.js";

const PLAYER_RADIUS = 0.36;
const SAMPLE_RING = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0.72, 0.72],
  [-0.72, 0.72],
  [0.72, -0.72],
  [-0.72, -0.72],
];

// The level's own walk test, minus the prop and lift colliders: every sample of
// the body's ring has to land in open floor, and inside the walkable corner of
// an angled bay.
function isWalkablePoint(x, z, radius = PLAYER_RADIUS) {
  return SAMPLE_RING.every(([offsetX, offsetZ]) => {
    const sampleX = x + offsetX * radius;
    const sampleZ = z + offsetZ * radius;
    const cell = worldToCell(sampleX, sampleZ);
    if (!isOpenCell(cell.col, cell.row)) return false;
    if (isDiagonalCell(cell.col, cell.row) && !pointInDiagonalCell(cell.col, cell.row, sampleX, sampleZ)) {
      return false;
    }
    return true;
  });
}

// Fine-grained flood fill over the open floor, used to prove the walk from the
// spawn to the lift never crosses a wall.
function floodFill(start) {
  const step = 0.4;
  const key = (x, z) => `${Math.round(x / step)}:${Math.round(z / step)}`;
  const seen = new Set([key(start.x, start.z)]);
  const queue = [start];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const { x, z } = queue[cursor];
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const nextX = x + dx;
      const nextZ = z + dz;
      const nextKey = key(nextX, nextZ);
      if (seen.has(nextKey) || !isWalkablePoint(nextX, nextZ)) continue;
      seen.add(nextKey);
      queue.push({ x: nextX, z: nextZ });
    }
  }
  return { seen, has: (x, z) => seen.has(key(x, z)) };
}

const SIDE_DIRECTIONS = {
  N: { dc: 0, dr: -1, opposite: "S" },
  S: { dc: 0, dr: 1, opposite: "N" },
  W: { dc: -1, dr: 0, opposite: "E" },
  E: { dc: 1, dr: 0, opposite: "W" },
};

// The opening two neighbouring bays share, as the fraction of the bay edge both
// sides leave open. A wholesale wall, or a pier's mass, closes it.
function sharedOpening(col, row, side) {
  const { dc, dr, opposite } = SIDE_DIRECTIONS[side];
  const neighborCol = col + dc;
  const neighborRow = row + dr;
  if (!isOpenCell(neighborCol, neighborRow)) return null;
  const span = isDiagonalCell(col, row) ? diagonalSideSpan(col, row, side) : [0, 1];
  const neighborSpan = isDiagonalCell(neighborCol, neighborRow)
    ? diagonalSideSpan(neighborCol, neighborRow, opposite)
    : [0, 1];
  if (!span || !neighborSpan) return null;
  const from = Math.max(span[0], neighborSpan[0]);
  const to = Math.min(span[1], neighborSpan[1]);
  return (to - from) * CELL_SIZE;
}

// Cell-graph walkability: bays connect wherever the opening is wide enough to
// fit a body through.
function reachableCells(start) {
  const key = (col, row) => `${col}:${row}`;
  const seen = new Set([key(start.col, start.row)]);
  const queue = [start];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const { col, row } = queue[cursor];
    for (const [side, { dc, dr }] of Object.entries(SIDE_DIRECTIONS)) {
      const opening = sharedOpening(col, row, side);
      if (opening === null || opening < PLAYER_RADIUS * 2) continue;
      const nextKey = key(col + dc, row + dr);
      if (seen.has(nextKey)) continue;
      seen.add(nextKey);
      queue.push({ col: col + dc, row: row + dr });
    }
  }
  return seen;
}

test("every angled bay keeps its two open ports and closes the rest", () => {
  assert.ok(LEVEL_ZERO_ANGLED_CELLS.length >= 12, "the level has a spread of angled bays");
  const taken = new Set();
  for (const { col, row, type } of LEVEL_ZERO_ANGLED_CELLS) {
    const label = `angled bay (${col},${row})`;
    assert.ok(DIAGONAL_TYPES.has(MAP[row][col]), `${label} keeps its type in the map`);
    assert.ok(!taken.has(`${col},${row}`), `${label} is listed once`);
    taken.add(`${col},${row}`);
    const ports = getDiagonalPorts(col, row);
    assert.equal(ports.length, 2, `${label} has two ports`);
    for (const port of ports) {
      const { dc, dr } = SIDE_DIRECTIONS[port];
      assert.ok(isOpenCell(col + dc, row + dr), `${label} port ${port} leads into the level`);
    }
  }
  // Two angled bays sharing an edge would need a joint between two 45° faces.
  for (const { col, row } of LEVEL_ZERO_ANGLED_CELLS) {
    for (const { dc, dr } of Object.values(SIDE_DIRECTIONS)) {
      assert.ok(
        !DIAGONAL_TYPES.has(MAP[row + dr]?.[col + dc]),
        `angled bay (${col},${row}) does not share an edge with another angled bay`,
      );
    }
  }
});

test("the walkable corner and the 45° face agree with the bay's ports", () => {
  for (const { col, row } of LEVEL_ZERO_ANGLED_CELLS) {
    const center = cellCenter(col, row);
    const wall = diagonalWallTransform(col, row);
    const half = CELL_SIZE / 2;
    const ports = getDiagonalPorts(col, row);

    // The centroid of the corner is walkable, the bay centre is not.
    const inside = walkableCenter(col, row);
    assert.ok(
      pointInDiagonalCell(col, row, inside.x, inside.z),
      `(${col},${row}) walkable centre sits in the open corner`,
    );
    assert.equal(
      pointInDiagonalCell(col, row, center.x, center.z),
      false,
      `(${col},${row}) bay centre is inside the pier`,
    );
    assert.ok(
      isWalkablePoint(inside.x, inside.z),
      `(${col},${row}) a body fits in the open corner`,
    );

    // The 45° wall separates the two: the point one step off its middle towards
    // the corner is open, the point one step the other way is pier.
    const toCorner = { x: inside.x - wall.x, z: inside.z - wall.z };
    const toCornerLength = Math.hypot(toCorner.x, toCorner.z);
    const step = 0.3;
    const openPoint = {
      x: wall.x + (toCorner.x / toCornerLength) * step,
      z: wall.z + (toCorner.z / toCornerLength) * step,
    };
    const pierPoint = {
      x: wall.x - (toCorner.x / toCornerLength) * step,
      z: wall.z - (toCorner.z / toCornerLength) * step,
    };
    assert.equal(
      pointInDiagonalCell(col, row, openPoint.x, openPoint.z),
      true,
      `(${col},${row}) the corner side of the 45° face is walkable`,
    );
    assert.equal(
      pointInDiagonalCell(col, row, pierPoint.x, pierPoint.z),
      false,
      `(${col},${row}) the far side of the 45° face is pier`,
    );

    // The face spans exactly the two bay-edge midpoints it joins: its ends stop
    // at the bay boundary (plus the corner extension) and never cross into the
    // neighbouring bays.
    const faceDirection = { x: Math.cos(wall.yaw), z: -Math.sin(wall.yaw) };
    const faceHalf = (DIAGONAL_WALL_LENGTH + WALL_CORNER_EXTENSION * 2) / 2;
    for (const sign of [1, -1]) {
      const endX = wall.x + faceDirection.x * faceHalf * sign;
      const endZ = wall.z + faceDirection.z * faceHalf * sign;
      const localX = endX - (ORIGIN_X + col * CELL_SIZE);
      const localZ = endZ - (ORIGIN_Z + row * CELL_SIZE);
      const slack = WALL_CORNER_EXTENSION + 1e-9;
      assert.ok(
        localX >= -slack && localX <= CELL_SIZE + slack && localZ >= -slack && localZ <= CELL_SIZE + slack,
        `(${col},${row}) the 45° face stays inside its bay (end ${sign > 0 ? "high" : "low"})`,
      );
      const distanceToEdge = Math.min(
        Math.abs(localX),
        Math.abs(localX - CELL_SIZE),
        Math.abs(localZ),
        Math.abs(localZ - CELL_SIZE),
      );
      assert.ok(
        distanceToEdge <= slack,
        `(${col},${row}) the 45° face ends on a bay edge (end ${sign > 0 ? "high" : "low"})`,
      );
    }

    // The radius margin is the body the caller wants to fit: a point 0.3 m clear
    // of the face is walkable as a point and too close for a body.
    const nearFace = {
      x: wall.x + (toCorner.x / toCornerLength) * 0.3,
      z: wall.z + (toCorner.z / toCornerLength) * 0.3,
    };
    assert.equal(pointInDiagonalCell(col, row, nearFace.x, nearFace.z, 0), true);
    assert.equal(pointInDiagonalCell(col, row, nearFace.x, nearFace.z, PLAYER_RADIUS), false);

    // Each port side hands the corner the half of the edge named by the span.
    for (const port of ports) {
      const span = diagonalSideSpan(col, row, port);
      assert.ok(span, `(${col},${row}) port ${port} has a walkable span`);
      for (let t = 0.06; t < 0.46; t += 0.08) {
        const along = span[0] + t * (span[1] - span[0]);
        const point = port === "N" ? { x: center.x - half + along * CELL_SIZE, z: center.z - half }
          : port === "S" ? { x: center.x - half + along * CELL_SIZE, z: center.z + half }
          : port === "W" ? { x: center.x - half, z: center.z - half + along * CELL_SIZE }
          : { x: center.x + half, z: center.z - half + along * CELL_SIZE };
        assert.equal(
          pointInDiagonalCell(col, row, point.x, point.z),
          true,
          `(${col},${row}) port ${port} sample ${along.toFixed(2)} is walkable`,
        );
      }
    }
  }
});

test("the angled bays wall off every exposed side and leave the ports open", () => {
  const { northSouth, eastWest, angledWalls } = collectWallTransforms();
  assert.equal(angledWalls.length, LEVEL_ZERO_ANGLED_CELLS.length, "one 45° face per angled bay");

  const wallCenter = (entry) => (entry.isVector3 ? entry : entry.position);
  const wallScale = (entry) => (entry.isVector3 ? null : entry.scale);
  const boxes = [
    ...northSouth.map((entry) => ({ entry, axis: "x" })),
    ...eastWest.map((entry) => ({ entry, axis: "z" })),
  ].map(({ entry, axis }) => {
    const position = wallCenter(entry);
    const scale = wallScale(entry);
    const length = CELL_SIZE * (axis === "x" ? scale?.x ?? 1 : scale?.z ?? 1);
    const halfAlong = length / 2;
    const halfAcross = WALL_THICKNESS / 2;
    return axis === "x"
      ? {
        minX: position.x - halfAlong, maxX: position.x + halfAlong,
        minZ: position.z - halfAcross, maxZ: position.z + halfAcross,
      }
      : {
        minX: position.x - halfAcross, maxX: position.x + halfAcross,
        minZ: position.z - halfAlong, maxZ: position.z + halfAlong,
      };
  });
  const covered = (x, z) =>
    boxes.some(
      (box) => x > box.minX - 0.02 && x < box.maxX + 0.02 && z > box.minZ - 0.02 && z < box.maxZ + 0.02,
    );

  for (const { col, row } of LEVEL_ZERO_ANGLED_CELLS) {
    const center = cellCenter(col, row);
    const half = CELL_SIZE / 2;
    for (const [side, { dc, dr }] of Object.entries(SIDE_DIRECTIONS)) {
      const neighborOpen = isOpenCell(col + dc, row + dr);
      const span = diagonalSideSpan(col, row, side);
      // Samples stay off the bay corners and off the edge midpoints: those are
      // joints, covered by the corner extension and the 45° face instead of by
      // the side's own wall.
      for (const t of [0.125, 0.25, 0.375, 0.625, 0.75, 0.875]) {
        const along = t * CELL_SIZE - half;
        const point = side === "N" ? { x: center.x + along, z: center.z - half }
          : side === "S" ? { x: center.x + along, z: center.z + half }
          : side === "W" ? { x: center.x - half, z: center.z + along }
          : { x: center.x + half, z: center.z + along };
        // The fraction of the edge this sample sits at, in the span's own
        // convention (from the west on N/S, from the north on W/E).
        const openOnOurSide = Boolean(span) && t >= span[0] && t <= span[1];
        // The neighbouring bay is only open where the edge lines up with its
        // own walkable corner.
        const neighborSpan = !neighborOpen
          ? null
          : isDiagonalCell(col + dc, row + dr)
            ? diagonalSideSpan(col + dc, row + dr, SIDE_DIRECTIONS[side].opposite)
            : [0, 1];
        const openOnTheirSide = Boolean(neighborSpan) && t >= neighborSpan[0] && t <= neighborSpan[1];
        const wallNeeded = openOnOurSide !== openOnTheirSide;
        assert.equal(
          covered(point.x, point.z),
          wallNeeded,
          `(${col},${row}) ${side} at ${t.toFixed(2)} ${wallNeeded ? "needs" : "must not have"} a wall`,
        );
      }
    }
  }
});

test("the angled bays stay on the level's routes and light field", () => {
  const start = walkableCenter(START_CELL.col, START_CELL.row);
  const flooded = floodFill(start);
  assert.ok(flooded.seen.size > 2000, `the open floor is one large region (${flooded.seen.size} samples)`);

  // The walk from the spawn to the lift, plus every prop and pickup the level
  // places by cell, has to stay inside that one region.
  const mustStayReachable = [
    { label: "the lift", ...cellCenter(EXIT_CELL.col, EXIT_CELL.row) },
    ...LEVEL_ZERO_ROOM_TABLE_CELLS.map(({ col, row }, index) => ({
      label: `room table ${index + 1}`,
      ...cellCenter(col, row),
    })),
    { label: "the documentation room", ...cellCenter(34, 28) },
    { label: "the rusted key", ...cellCenter(3, 18) },
    { label: "the crumpled note", ...cellCenter(10, 21) },
  ];
  for (const { label, x, z } of mustStayReachable) {
    assert.ok(isWalkablePoint(x, z), `${label} keeps open floor`);
    assert.ok(flooded.has(x, z), `${label} is reachable from the spawn`);
  }

  // Every open bay is either reachable or pier space, never a sealed pocket,
  // and each angled bay is reachable through its own ports.
  const reachable = reachableCells(START_CELL);
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (MAP[row][col] !== CELL_OPEN) continue;
      assert.ok(reachable.has(`${col}:${row}`), `open bay (${col},${row}) is not sealed off`);
    }
  }
  for (const { col, row } of LEVEL_ZERO_ANGLED_CELLS) {
    assert.ok(reachable.has(`${col}:${row}`), `angled bay (${col},${row}) is reachable`);
  }
});

test("walls only ever stand on bay lines", () => {
  const { northSouth, eastWest, angledWalls } = collectWallTransforms();
  // Walls are centred on bay lines, so every centre coordinate lands on a whole
  // or half bay (bay centres, where nothing should ever be built, do not).
  const onBayLine = (value) =>
    Math.abs(value / (CELL_SIZE / 2) - Math.round(value / (CELL_SIZE / 2))) < 1e-6;
  for (const entry of [...northSouth, ...eastWest]) {
    const position = entry.isVector3 ? entry : entry.position;
    assert.ok(
      onBayLine(position.x) || onBayLine(position.z),
      `wall at ${position.x.toFixed(2)},${position.z.toFixed(2)} sits on a bay line`,
    );
  }
  for (const { position } of angledWalls) {
    const cell = worldToCell(position.x, position.z);
    assert.ok(isDiagonalCell(cell.col, cell.row), "45° faces sit in angled bays");
  }
});
