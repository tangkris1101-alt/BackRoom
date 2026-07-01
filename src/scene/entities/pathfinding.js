import { CELL_SIZE } from "../constants.js";

const NEIGHBOR_OFFSETS = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

export function createNavGrid({ cols, rows, isCellOpen }) {
  const cellCount = cols * rows;
  const neighbors = new Int32Array(cellCount * 4);
  neighbors.fill(-1);
  const open = new Uint8Array(cellCount);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col;
      if (!isCellOpen(col, row)) continue;
      open[index] = 1;
      for (let n = 0; n < 4; n += 1) {
        const [dCol, dRow] = NEIGHBOR_OFFSETS[n];
        const nCol = col + dCol;
        const nRow = row + dRow;
        if (nCol < 0 || nCol >= cols || nRow < 0 || nRow >= rows) continue;
        if (!isCellOpen(nCol, nRow)) continue;
        neighbors[index * 4 + n] = nRow * cols + nCol;
      }
    }
  }

  return {
    cols,
    rows,
    cellCount,
    isCellOpen,
    open,
    neighbors,
    cellIndex(col, row) {
      return row * cols + col;
    },
    cellColRow(index) {
      return { col: index % cols, row: Math.floor(index / cols) };
    },
  };
}

function manhattan(nav, a, b) {
  const aCol = a % nav.cols;
  const aRow = (a - aCol) / nav.cols;
  const bCol = b % nav.cols;
  const bRow = (b - bCol) / nav.cols;
  return Math.abs(aCol - bCol) + Math.abs(aRow - bRow);
}

class MinHeap {
  constructor() {
    this.keys = [];
    this.values = [];
  }
  push(key, value) {
    const { keys, values } = this;
    keys.push(key);
    values.push(value);
    let i = keys.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (keys[parent] <= keys[i]) break;
      [keys[parent], keys[i]] = [keys[i], keys[parent]];
      [values[parent], values[i]] = [values[i], values[parent]];
      i = parent;
    }
  }
  pop() {
    const { keys, values } = this;
    if (keys.length === 0) return undefined;
    const key = keys[0];
    const value = values[0];
    const last = keys.pop();
    const lastValue = values.pop();
    if (keys.length > 0) {
      keys[0] = last;
      values[0] = lastValue;
      let i = 0;
      const n = keys.length;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < n && keys[left] < keys[smallest]) smallest = left;
        if (right < n && keys[right] < keys[smallest]) smallest = right;
        if (smallest === i) break;
        [keys[smallest], keys[i]] = [keys[i], keys[smallest]];
        [values[smallest], values[i]] = [values[i], values[smallest]];
        i = smallest;
      }
    }
    return { key, value };
  }
  get size() {
    return this.keys.length;
  }
}

export function aStar(navGrid, startCell, goalCell) {
  const { cols, rows, open, neighbors } = navGrid;
  const startCol = Math.floor(startCell.col);
  const startRow = Math.floor(startCell.row);
  const goalCol = Math.floor(goalCell.col);
  const goalRow = Math.floor(goalCell.row);
  if (
    startCol < 0 ||
    startCol >= cols ||
    startRow < 0 ||
    startRow >= rows ||
    goalCol < 0 ||
    goalCol >= cols ||
    goalRow < 0 ||
    goalRow >= rows
  ) {
    return null;
  }
  const startIndex = startRow * cols + startCol;
  const goalIndex = goalRow * cols + goalCol;
  if (!open[startIndex] || !open[goalIndex]) return null;
  if (startIndex === goalIndex) return [{ col: startCol, row: startRow }];

  const closed = new Uint8Array(cols * rows);
  const gScore = new Float32Array(cols * rows);
  const cameFrom = new Int32Array(cols * rows);
  cameFrom.fill(-1);
  gScore.fill(Infinity);
  gScore[startIndex] = 0;

  const heap = new MinHeap();
  heap.push(manhattan(navGrid, startIndex, goalIndex), startIndex);

  while (heap.size > 0) {
    const top = heap.pop();
    const current = top.value;
    if (current === goalIndex) {
      const path = [];
      let cursor = goalIndex;
      while (cursor !== -1) {
        const c = cursor % cols;
        const r = (cursor - c) / cols;
        path.push({ col: c, row: r });
        if (cursor === startIndex) break;
        cursor = cameFrom[cursor];
      }
      path.reverse();
      return path;
    }
    if (closed[current]) continue;
    closed[current] = 1;
    const baseG = gScore[current];
    for (let n = 0; n < 4; n += 1) {
      const neighbor = neighbors[current * 4 + n];
      if (neighbor === -1) continue;
      if (closed[neighbor]) continue;
      const tentative = baseG + 1;
      if (tentative < gScore[neighbor]) {
        gScore[neighbor] = tentative;
        cameFrom[neighbor] = current;
        const f = tentative + manhattan(navGrid, neighbor, goalIndex);
        heap.push(f, neighbor);
      }
    }
  }
  return null;
}

export function pathContainsCell(path, cell, fromIndex = 0) {
  if (!path) return false;
  for (let i = fromIndex; i < path.length; i += 1) {
    if (path[i].col === cell.col && path[i].row === cell.row) return true;
  }
  return false;
}

export function followPath({
  entityPos,
  waypoints,
  indexRef,
  cellCenter,
  speed,
  delta,
  isWalkable,
  waypointArriveRadius = CELL_SIZE * 0.5,
}) {
  if (!waypoints || waypoints.length === 0 || indexRef.index >= waypoints.length) {
    return { x: entityPos.x, z: entityPos.z, advanced: false, reachedEnd: true };
  }
  while (indexRef.index < waypoints.length) {
    const target = cellCenter(waypoints[indexRef.index].col, waypoints[indexRef.index].row);
    const dx = target.x - entityPos.x;
    const dz = target.z - entityPos.z;
    const distance = Math.hypot(dx, dz);
    if (distance > waypointArriveRadius) {
      const step = Math.min(distance, speed * delta);
      const dirX = (dx / distance) * step;
      const dirZ = (dz / distance) * step;
      const resolved = isWalkable(entityPos.x + dirX, entityPos.z + dirZ)
        ? { x: entityPos.x + dirX, z: entityPos.z + dirZ }
        : isWalkable(entityPos.x + dirX, entityPos.z)
          ? { x: entityPos.x + dirX, z: entityPos.z }
          : isWalkable(entityPos.x, entityPos.z + dirZ)
            ? { x: entityPos.x, z: entityPos.z + dirZ }
            : { x: entityPos.x, z: entityPos.z };
      const moved = Math.hypot(resolved.x - entityPos.x, resolved.z - entityPos.z);
      return {
        x: resolved.x,
        z: resolved.z,
        advanced: moved > 0,
        reachedEnd: false,
      };
    }
    indexRef.index += 1;
  }
  return { x: entityPos.x, z: entityPos.z, advanced: false, reachedEnd: true };
}