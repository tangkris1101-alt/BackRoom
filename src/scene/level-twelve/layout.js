import { CELL_SIZE } from "../constants.js";

export const LEVEL_TWELVE_COLS = 40;
export const LEVEL_TWELVE_ROWS = 34;
export const LEVEL_TWELVE_START_CELL = { col: 20, row: 29, yaw: 0 };
export const LEVEL_TWELVE_COPYCAT_CELL = { col: 8, row: 11 };
export const LEVEL_TWELVE_STAIR_CELL = { col: 32, row: 6 };
export const LEVEL_TWELVE_EXIT_CELL = { col: 20, row: 27 };
export const LEVEL_TWELVE_ORIGIN_X = -(LEVEL_TWELVE_COLS * CELL_SIZE) / 2;
export const LEVEL_TWELVE_ORIGIN_Z = -(LEVEL_TWELVE_ROWS * CELL_SIZE) / 2;

export function isLevelTwelveOpenCell(col, row) {
  return col > 0 && row > 0 && col < LEVEL_TWELVE_COLS - 1 && row < LEVEL_TWELVE_ROWS - 1;
}

export function levelTwelveCellCenter(col, row) {
  return {
    x: LEVEL_TWELVE_ORIGIN_X + col * CELL_SIZE + CELL_SIZE / 2,
    z: LEVEL_TWELVE_ORIGIN_Z + row * CELL_SIZE + CELL_SIZE / 2,
  };
}

export function levelTwelveWorldToCell(x, z) {
  return {
    col: Math.floor((x - LEVEL_TWELVE_ORIGIN_X) / CELL_SIZE),
    row: Math.floor((z - LEVEL_TWELVE_ORIGIN_Z) / CELL_SIZE),
  };
}
