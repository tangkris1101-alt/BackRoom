import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { CELL_SIZE } from "../src/scene/constants.js";
import { cellCenter, EXIT_CELL, isOpenCell, START_CELL } from "../src/scene/level-zero/layout.js";
import { getLevelZeroElevatorFocus, getLevelZeroElevatorWallMount } from "../src/scene/level-zero/elevator.js";

test("Level 0 elevator door sits in an east-wall opening with its cabin behind the wall", () => {
  assert.equal(isOpenCell(EXIT_CELL.col, EXIT_CELL.row), true);
  assert.equal(isOpenCell(EXIT_CELL.col - 1, EXIT_CELL.row), true);
  assert.equal(isOpenCell(EXIT_CELL.col + 1, EXIT_CELL.row), true);
  assert.equal(isOpenCell(EXIT_CELL.col + 2, EXIT_CELL.row), false);
  assert.equal(isOpenCell(EXIT_CELL.col + 1, EXIT_CELL.row - 1), false);
  assert.equal(isOpenCell(EXIT_CELL.col + 1, EXIT_CELL.row + 1), false);

  const cell = cellCenter(EXIT_CELL.col, EXIT_CELL.row);
  const mount = getLevelZeroElevatorWallMount(cell);
  const wallPlaneX = cell.x + CELL_SIZE / 2;
  const cabinRearFaceX = mount.x + 0.94 + 0.14 / 2;
  const doorFrontX = mount.x - (0.83 + 0.055 + 0.074 / 2);

  assert.ok(Math.abs(doorFrontX - wallPlaneX) < 1e-9);
  assert.ok(cabinRearFaceX > wallPlaneX);
  assert.ok(cabinRearFaceX < wallPlaneX + CELL_SIZE);
  assert.equal(mount.z, cell.z);
});

test("the wall-mounted elevator remains reachable from the Level 0 spawn", () => {
  const queue = [[START_CELL.col, START_CELL.row]];
  const visited = new Set();
  for (let index = 0; index < queue.length; index += 1) {
    const [col, row] = queue[index];
    const key = `${col}:${row}`;
    if (visited.has(key) || !isOpenCell(col, row)) continue;
    if (col === EXIT_CELL.col && row === EXIT_CELL.row) return;
    visited.add(key);
    queue.push([col - 1, row], [col + 1, row], [col, row - 1], [col, row + 1]);
  }
  assert.fail("the east-wall elevator cell is disconnected from the spawn");
});

test("the elevator prompt follows the visible door or call button at close range", () => {
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 100);
  camera.position.set(-1.2, 1.64, 0);
  const door = { x: 0, z: 0 };
  const call = { x: 0, z: 1.68 };

  camera.lookAt(0, 1.35, 0);
  assert.equal(getLevelZeroElevatorFocus(camera, door, call)?.target, "door");

  camera.lookAt(0, 1.31, 1.68);
  assert.equal(getLevelZeroElevatorFocus(camera, door, call)?.target, "call");

  camera.lookAt(-4, 1.64, 0);
  assert.equal(getLevelZeroElevatorFocus(camera, door, call), null);
});
