import { CELL_SIZE } from "../constants.js";

export function snapEntityPosition(position, isWalkable) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) {
    return position;
  }
  if (isWalkable(position.x, position.z)) {
    return position;
  }

  const maxRadius = CELL_SIZE * 12;
  const step = CELL_SIZE * 0.25;
  for (let radius = step; radius <= maxRadius; radius += step) {
    const circumference = 2 * Math.PI * radius;
    const steps = Math.max(8, Math.ceil(circumference / (CELL_SIZE * 0.5)));
    for (let i = 0; i < steps; i += 1) {
      const angle = (i / steps) * Math.PI * 2;
      const nx = position.x + Math.cos(angle) * radius;
      const nz = position.z + Math.sin(angle) * radius;
      if (isWalkable(nx, nz)) {
        return { x: nx, z: nz };
      }
    }
  }

  return position;
}

export function snapEntityState(entityState, isWalkable) {
  if (!entityState || !entityState.position) return entityState;
  const snapped = snapEntityPosition(entityState.position, isWalkable);
  if (snapped === entityState.position) return entityState;
  return { ...entityState, position: snapped };
}

export function snapEntityStates(entityStates, isWalkable) {
  if (!Array.isArray(entityStates)) return [];
  return entityStates.map((entity) => snapEntityState(entity, isWalkable));
}

export function snapEntityStateToNavCell(
  entityState,
  { isCellOpen, worldToCell, cellCenter, cols, rows, maxRadius = 8 } = {},
) {
  const position = entityState?.position;
  if (
    !position ||
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.z) ||
    typeof isCellOpen !== "function" ||
    typeof worldToCell !== "function" ||
    typeof cellCenter !== "function"
  ) {
    return entityState;
  }

  const origin = worldToCell(position.x, position.z);
  if (isCellOpen(origin.col, origin.row)) return entityState;
  const limit = Math.max(1, Math.floor(maxRadius));
  for (let radius = 1; radius <= limit; radius += 1) {
    for (let rowOffset = -radius; rowOffset <= radius; rowOffset += 1) {
      for (let colOffset = -radius; colOffset <= radius; colOffset += 1) {
        if (Math.abs(colOffset) + Math.abs(rowOffset) !== radius) continue;
        const col = origin.col + colOffset;
        const row = origin.row + rowOffset;
        if (col < 0 || row < 0 || col >= cols || row >= rows || !isCellOpen(col, row)) continue;
        const center = cellCenter(col, row);
        return {
          ...entityState,
          position: { ...position, x: center.x, z: center.z },
        };
      }
    }
  }
  return entityState;
}
