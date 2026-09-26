import * as THREE from "three";
import { CELL_SIZE, WALL_HEIGHT, WALL_THICKNESS } from "../constants.js";

// Perpendicular wall boxes only meet at their inner edges, so a convex corner
// leaves an empty half-thickness notch over the full wall height — a scooped
// dent that reads clearly near the floor. When both cells beyond a wall end are
// open, the corner pokes into walkable space, so that end is stretched past the
// vertex; the extension stops 1 mm short of the partner's outer face so no
// coplanar faces z-fight.
export const WALL_CORNER_EXTENSION = WALL_THICKNESS / 2 - 0.001;

export function wallSegmentTransform(x, z, axis, extendNegative, extendPositive, {
  cellSize = CELL_SIZE,
  height = WALL_HEIGHT,
} = {}) {
  const negative = extendNegative ? WALL_CORNER_EXTENSION : 0;
  const positive = extendPositive ? WALL_CORNER_EXTENSION : 0;
  if (!negative && !positive) {
    return new THREE.Vector3(x, height / 2, z);
  }
  const stretch = (cellSize + negative + positive) / cellSize;
  const shift = (positive - negative) / 2;
  return {
    position: new THREE.Vector3(
      axis === "x" ? x + shift : x,
      height / 2,
      axis === "z" ? z + shift : z,
    ),
    scale: new THREE.Vector3(axis === "x" ? stretch : 1, 1, axis === "z" ? stretch : 1),
  };
}

export function getWallTransformPosition(transform) {
  return transform?.position ?? transform;
}

export function getWallTransformScale(transform) {
  return transform?.scale ?? null;
}
