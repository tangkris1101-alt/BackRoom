import * as THREE from "three";
import { CELL_SIZE, WALL_HEIGHT, WALL_THICKNESS, circleIntersectsAabb } from "../constants.js";
import {
  createAlmondWaterPickup,
  createCompassPickup,
  createDetectorPickup,
  createFiresaltPickup,
  createFlashlightPickup,
  createSilenceLiquidPickup,
} from "../items/index.js";
import { getFocusedItem, getPickupTarget, tryPickupItems } from "../entities/index.js";
import { enableAoUv } from "./texture-utils.js";

export function collectGridWallTransforms({ cols, rows, isOpen, cellCenter }) {
  const northSouth = [];
  const eastWest = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!isOpen(col, row)) continue;
      const center = cellCenter(col, row);
      if (!isOpen(col, row - 1)) northSouth.push(new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z - CELL_SIZE / 2));
      if (!isOpen(col, row + 1)) northSouth.push(new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z + CELL_SIZE / 2));
      if (!isOpen(col - 1, row)) eastWest.push(new THREE.Vector3(center.x - CELL_SIZE / 2, WALL_HEIGHT / 2, center.z));
      if (!isOpen(col + 1, row)) eastWest.push(new THREE.Vector3(center.x + CELL_SIZE / 2, WALL_HEIGHT / 2, center.z));
    }
  }
  return { northSouth, eastWest };
}

export function createGridWalkability({ worldToCell, isOpen, colliders = [] }) {
  return (x, z, radius = 0.36) => {
    const corner = radius * 0.72;
    const samples = [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius], [corner, corner], [-corner, corner], [corner, -corner], [-corner, -corner]];
    if (!samples.every(([dx, dz]) => {
      const cell = worldToCell(x + dx, z + dz);
      return isOpen(cell.col, cell.row);
    })) return false;
    return !colliders.some((bounds) => circleIntersectsAabb(x, z, radius, bounds));
  };
}

export function createStandardPickupSet(scene, {
  cols,
  rows,
  isCellOpen,
  getCellCenter,
  avoidPositions,
  blockedAabbs = [],
  initialState = {},
  includeFiresalt = false,
  firesaltSpawnChance = 0.55,
}) {
  const options = { cols, rows, isCellOpen, getCellCenter, avoidPositions, blockedAabbs };
  const pickups = {
    flashlight: createFlashlightPickup(scene, { ...options, initialState: initialState.flashlight ?? null }),
    detector: createDetectorPickup(scene, { ...options, initialState: initialState.detector ?? null }),
    compass: createCompassPickup(scene, { ...options, initialState: initialState.compass ?? null }),
    "silence-liquid": createSilenceLiquidPickup(scene, { ...options, initialState: initialState["silence-liquid"] ?? null }),
    "almond-water": createAlmondWaterPickup(scene, { ...options, initialState: initialState["almond-water"] ?? null }),
  };
  if (includeFiresalt) {
    pickups.firesalt = createFiresaltPickup(scene, {
      ...options,
      initialState: initialState.firesalt ?? null,
      initialSpawnChance: firesaltSpawnChance,
    });
  }
  const list = Object.values(pickups);
  return {
    update(delta, elapsed, playerPosition) {
      return Object.fromEntries(Object.entries(pickups).map(([id, pickup]) => [id, pickup.update(delta, elapsed, playerPosition)]));
    },
    inspect(camera) {
      return getFocusedItem(...list.map((pickup) => pickup.inspect(camera)));
    },
    getPickupTarget(playerPosition) {
      return getPickupTarget(playerPosition, ...list);
    },
    tryPickup(playerPosition) {
      return tryPickupItems(playerPosition, ...list);
    },
    getState() {
      return Object.fromEntries(Object.entries(pickups).map(([id, pickup]) => [id, pickup.getState()]));
    },
  };
}

export const northSouthWallGeometry = enableAoUv(new THREE.BoxGeometry(CELL_SIZE + WALL_THICKNESS, WALL_HEIGHT, WALL_THICKNESS));
export const eastWestWallGeometry = enableAoUv(new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, CELL_SIZE + WALL_THICKNESS));
