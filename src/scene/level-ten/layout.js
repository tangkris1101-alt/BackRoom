import { CELL_SIZE } from "../constants.js";

export const LEVEL_TEN_COLS = 56;
export const LEVEL_TEN_ROWS = 42;
export const LEVEL_TEN_START_CELL = { col: 28, row: 39, yaw: 0 };
export const LEVEL_TEN_TARGET_CELL = { col: 28, row: 2 };
export const LEVEL_TEN_ORIGIN_X = -(LEVEL_TEN_COLS * CELL_SIZE) / 2;
export const LEVEL_TEN_ORIGIN_Z = -(LEVEL_TEN_ROWS * CELL_SIZE) / 2;

export function isLevelTenOpenCell(col, row) {
  return row > 0 && row < LEVEL_TEN_ROWS - 1 && col > 0 && col < LEVEL_TEN_COLS - 1;
}

export function isLevelTenRoadCell(col, row) {
  return isLevelTenOpenCell(col, row) && col >= 27 && col <= 29;
}

export function levelTenCellCenter(col, row) {
  return {
    x: LEVEL_TEN_ORIGIN_X + col * CELL_SIZE + CELL_SIZE / 2,
    z: LEVEL_TEN_ORIGIN_Z + row * CELL_SIZE + CELL_SIZE / 2,
  };
}

export function levelTenWorldToCell(x, z) {
  return {
    col: Math.floor((x - LEVEL_TEN_ORIGIN_X) / CELL_SIZE),
    row: Math.floor((z - LEVEL_TEN_ORIGIN_Z) / CELL_SIZE),
  };
}

export const LEVEL_TEN_WHEAT_PLOTS = Object.freeze([
  { minCol: 3, maxCol: 10, minRow: 3, maxRow: 13 },
  { minCol: 12, maxCol: 19, minRow: 3, maxRow: 13 },
  { minCol: 21, maxCol: 25, minRow: 3, maxRow: 13 },
  { minCol: 31, maxCol: 38, minRow: 3, maxRow: 13 },
  { minCol: 40, maxCol: 47, minRow: 3, maxRow: 13 },
  { minCol: 49, maxCol: 52, minRow: 3, maxRow: 13 },
  { minCol: 3, maxCol: 10, minRow: 16, maxRow: 27 },
  { minCol: 20, maxCol: 25, minRow: 16, maxRow: 27 },
  { minCol: 31, maxCol: 38, minRow: 16, maxRow: 27 },
  { minCol: 40, maxCol: 47, minRow: 16, maxRow: 27 },
  { minCol: 3, maxCol: 14, minRow: 30, maxRow: 38 },
  { minCol: 31, maxCol: 52, minRow: 30, maxRow: 38 },
]);
