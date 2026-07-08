import { CELL_SIZE, BACTERIA_SPAWN_MAX_FROM_EXIT, BACTERIA_SPAWN_MIN_FROM_PLAYER } from "../constants.js";

export function chooseBacteriaSpawn({
  cols,
  rows,
  isCellOpen,
  getCellCenter,
  targetPosition,
  spawnPosition,
  avoidPositions = [],
  minSeparation = CELL_SIZE * 5,
}) {
  const candidates = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!isCellOpen(col, row)) continue;
      const center = getCellCenter(col, row);
      const fromExit = Math.hypot(center.x - targetPosition.x, center.z - targetPosition.z);
      const fromSpawn = Math.hypot(center.x - spawnPosition.x, center.z - spawnPosition.z);
      const farFromAvoids = avoidPositions.every(
        (avoid) => Math.hypot(center.x - avoid.x, center.z - avoid.z) >= minSeparation,
      );
      if (
        fromExit <= BACTERIA_SPAWN_MAX_FROM_EXIT &&
        fromSpawn >= BACTERIA_SPAWN_MIN_FROM_PLAYER &&
        farFromAvoids
      ) {
        candidates.push({ ...center, score: fromExit + Math.random() * CELL_SIZE });
      }
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  return candidates;
}

export function pickBacteriaSpawnPositions({
  cols,
  rows,
  isCellOpen,
  getCellCenter,
  targetPosition,
  spawnPosition,
  count,
}) {
  const ranked = chooseBacteriaSpawn({
    cols,
    rows,
    isCellOpen,
    getCellCenter,
    targetPosition,
    spawnPosition,
  });
  const picked = [];
  for (const candidate of ranked) {
    if (picked.length >= count) break;
    const farFromPicked = picked.every(
      (used) => Math.hypot(candidate.x - used.x, candidate.z - used.z) >= CELL_SIZE * 6,
    );
    if (farFromPicked) picked.push(candidate);
  }
  while (picked.length < count && ranked.length > 0) {
    picked.push(ranked[picked.length % ranked.length]);
  }
  return picked;
}

export function resolveEntityStep(position, deltaX, deltaZ, isWalkable) {
  const nextX = position.x + deltaX;
  const nextZ = position.z + deltaZ;
  if (isWalkable(nextX, nextZ, 0.32)) return { x: nextX, z: nextZ };
  if (Math.abs(deltaX) > Math.abs(deltaZ)) {
    if (isWalkable(nextX, position.z, 0.32)) return { x: nextX, z: position.z };
    if (isWalkable(position.x, nextZ, 0.32)) return { x: position.x, z: nextZ };
  } else {
    if (isWalkable(position.x, nextZ, 0.32)) return { x: position.x, z: nextZ };
    if (isWalkable(nextX, position.z, 0.32)) return { x: nextX, z: position.z };
  }
  return { x: position.x, z: position.z };
}

