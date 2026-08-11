import { CELL_SIZE } from "../constants.js";

export const LEVEL_THIRTEEN_COLS = 72;
export const LEVEL_THIRTEEN_ROWS = 42;
export const LEVEL_THIRTEEN_ORIGIN_X = -(LEVEL_THIRTEEN_COLS * CELL_SIZE) / 2;
export const LEVEL_THIRTEEN_ORIGIN_Z = -(LEVEL_THIRTEEN_ROWS * CELL_SIZE) / 2;

export const LEVEL_THIRTEEN_FLOORS = Object.freeze([
  { id: 0, minCol: 2, maxCol: 21, centerCol: 11, spawn: { col: 11, row: 35, yaw: 0 } },
  { id: 71, minCol: 26, maxCol: 45, centerCol: 35, spawn: { col: 35, row: 35, yaw: 0 } },
  { id: 283, minCol: 50, maxCol: 69, centerCol: 59, spawn: { col: 59, row: 35, yaw: 0 } },
]);

export const LEVEL_THIRTEEN_APARTMENTS = Object.freeze([
  { id: "00004", floor: 0, minCol: 3, maxCol: 8, minRow: 16, maxRow: 22, door: { col: 9, row: 19 } },
  { id: "71304", floor: 71, minCol: 27, maxCol: 33, minRow: 16, maxRow: 23, door: { col: 34, row: 19 }, claimed: true },
  { id: "71318", floor: 71, minCol: 37, maxCol: 44, minRow: 29, maxRow: 36, door: { col: 37, row: 32 } },
  { id: "28312", floor: 283, minCol: 51, maxCol: 57, minRow: 16, maxRow: 23, door: { col: 58, row: 19 } },
  { id: "28327", floor: 283, minCol: 61, maxCol: 68, minRow: 29, maxRow: 36, door: { col: 60, row: 32 } },
]);

export function getLevelThirteenSpawnFloor(sourceLevel = null) {
  if (Number(sourceLevel) === 11) return LEVEL_THIRTEEN_FLOORS[0];
  if (Number(sourceLevel) === 12) return LEVEL_THIRTEEN_FLOORS[2];
  return LEVEL_THIRTEEN_FLOORS[1];
}

export function updateLevelThirteenLethargy(value, insideApartment, delta) {
  const current = Math.max(0, Math.min(1, Number(value) || 0));
  const elapsed = Math.max(0, Number(delta) || 0);
  return insideApartment
    ? Math.min(1, current + elapsed / 45)
    : Math.max(0, current - elapsed / 12);
}

function moduleForCell(col) {
  return LEVEL_THIRTEEN_FLOORS.find((floor) => col >= floor.minCol && col <= floor.maxCol) ?? null;
}

export function isLevelThirteenApartmentCell(col, row) {
  return LEVEL_THIRTEEN_APARTMENTS.some((room) =>
    (col >= room.minCol && col <= room.maxCol && row >= room.minRow && row <= room.maxRow)
    || (col === room.door.col && row === room.door.row));
}

export function isLevelThirteenOpenCell(col, row) {
  const floor = moduleForCell(col);
  if (!floor || row <= 1 || row >= LEVEL_THIRTEEN_ROWS - 2) return false;
  if (col >= floor.centerCol - 1 && col <= floor.centerCol + 1 && row >= 3 && row <= 38) return true;
  if ((row >= 11 && row <= 13) || (row >= 26 && row <= 28)) return true;
  if (floor.id === 0 && col >= 6 && col <= 16 && row >= 32 && row <= 38) return true;
  if (floor.id === 0 && col >= 15 && col <= 20 && row >= 5 && row <= 10) return true;
  if (floor.id === 0 && col >= 17 && col <= 19 && row >= 9 && row <= 13) return true;
  return isLevelThirteenApartmentCell(col, row);
}

export function levelThirteenCellCenter(col, row) {
  return {
    x: LEVEL_THIRTEEN_ORIGIN_X + col * CELL_SIZE + CELL_SIZE / 2,
    z: LEVEL_THIRTEEN_ORIGIN_Z + row * CELL_SIZE + CELL_SIZE / 2,
  };
}

export function levelThirteenWorldToCell(x, z) {
  return {
    col: Math.floor((x - LEVEL_THIRTEEN_ORIGIN_X) / CELL_SIZE),
    row: Math.floor((z - LEVEL_THIRTEEN_ORIGIN_Z) / CELL_SIZE),
  };
}

export function getLevelThirteenFloor(col) {
  return moduleForCell(col)?.id ?? null;
}

export function getLevelThirteenApartment(col, row) {
  return LEVEL_THIRTEEN_APARTMENTS.find((room) =>
    col >= room.minCol && col <= room.maxCol && row >= room.minRow && row <= room.maxRow) ?? null;
}
