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