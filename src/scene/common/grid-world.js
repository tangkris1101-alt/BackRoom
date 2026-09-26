import * as THREE from "three";
import { CELL_SIZE, WALL_HEIGHT, WALL_THICKNESS, circleIntersectsAabb } from "../constants.js";
import { colliderBlocksAtFeetHeight, getPlatformFloorHeight, resolvePlatformOverlap } from "./platform-collision.js";
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
import { wallSegmentTransform } from "./wall-corners.js";

export function collectGridWallTransforms({ cols, rows, isOpen, cellCenter }) {
  const northSouth = [];
  const eastWest = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!isOpen(col, row)) continue;
      const center = cellCenter(col, row);
      // Ends that poke into open space on both flanks are stretched past the
      // corner so the perpendicular wall boxes overlap instead of leaving a
      // half-thickness notch (see wall-corners.js).
      if (!isOpen(col, row - 1)) {
        northSouth.push(wallSegmentTransform(
          center.x,
          center.z - CELL_SIZE / 2,
          "x",
          isOpen(col - 1, row) && isOpen(col - 1, row - 1),
          isOpen(col + 1, row) && isOpen(col + 1, row - 1),
        ));
      }
      if (!isOpen(col, row + 1)) {
        northSouth.push(wallSegmentTransform(
          center.x,
          center.z + CELL_SIZE / 2,
          "x",
          isOpen(col - 1, row) && isOpen(col - 1, row + 1),
          isOpen(col + 1, row) && isOpen(col + 1, row + 1),
        ));
      }
      if (!isOpen(col - 1, row)) {
        eastWest.push(wallSegmentTransform(
          center.x - CELL_SIZE / 2,
          center.z,
          "z",
          isOpen(col, row - 1) && isOpen(col - 1, row - 1),
          isOpen(col, row + 1) && isOpen(col - 1, row + 1),
        ));
      }
      if (!isOpen(col + 1, row)) {
        eastWest.push(wallSegmentTransform(
          center.x + CELL_SIZE / 2,
          center.z,
          "z",
          isOpen(col, row - 1) && isOpen(col + 1, row - 1),
          isOpen(col, row + 1) && isOpen(col + 1, row + 1),
        ));
      }
    }
  }
  return { northSouth, eastWest };
}

// Prop colliders carrying a `topY` are platforms rather than walls: they stop
// blocking once the player's feet clear their top, so a knee-high drum can be
// hopped over and a low table landed on instead of acting as an invisible
// full-height barrier. `getFloorHeight`/`resolvePosition` publish the matching
// standable tops and the bounded push-out for props the player lands inside.
export function createGridCollision({ worldToCell, isOpen, colliders = [] }) {
  const isWalkable = (x, z, radius = 0.36, feetY = 0) => {
    const corner = radius * 0.72;
    const samples = [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius], [corner, corner], [-corner, corner], [corner, -corner], [-corner, -corner]];
    if (!samples.every(([dx, dz]) => {
      const cell = worldToCell(x + dx, z + dz);
      return isOpen(cell.col, cell.row);
    })) return false;
    return !colliders.some((bounds) => colliderBlocksAtFeetHeight(bounds, feetY) && circleIntersectsAabb(x, z, radius, bounds));
  };

  return {
    isWalkable,
    getFloorHeight: (x, z, feetY) => getPlatformFloorHeight({ colliders, x, z, feetY }),
    resolvePosition: (x, z, radius, feetY, maxCorrection) =>
      resolvePlatformOverlap({ colliders, x, z, radius, feetY, maxCorrection }),
  };
}

export function createGridWalkability({ worldToCell, isOpen, colliders = [] }) {
  return createGridCollision({ worldToCell, isOpen, colliders }).isWalkable;
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

// Adjacent wall sections meet at their edges. Extending each box by its
// thickness made their visible faces coplanar at joins, causing depth-buffer
// flicker (Z-fighting) while preserving no useful visual detail.
export const northSouthWallGeometry = enableAoUv(new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, WALL_THICKNESS));
export const eastWestWallGeometry = enableAoUv(new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, CELL_SIZE));
