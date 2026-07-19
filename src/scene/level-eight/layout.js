import { CELL_SIZE } from "../constants.js";

export const LEVEL_EIGHT_COLS = 52;
export const LEVEL_EIGHT_ROWS = 40;
export const LEVEL_EIGHT_START_CELL = { col: 4, row: 34, yaw: -Math.PI * 0.2 };
export const LEVEL_EIGHT_TARGET_CELL = { col: 47, row: 4 };
export const LEVEL_EIGHT_ORIGIN_X = -(LEVEL_EIGHT_COLS * CELL_SIZE) / 2;
export const LEVEL_EIGHT_ORIGIN_Z = -(LEVEL_EIGHT_ROWS * CELL_SIZE) / 2;

function buildLayout() {
  const grid = Array.from({ length: LEVEL_EIGHT_ROWS }, () => Array(LEVEL_EIGHT_COLS).fill("#"));
  const carveRoom = (col, row, width, height) => {
    for (let z = row; z < row + height; z += 1) for (let x = col; x < col + width; x += 1) {
      if (z > 0 && z < LEVEL_EIGHT_ROWS - 1 && x > 0 && x < LEVEL_EIGHT_COLS - 1) grid[z][x] = ".";
    }
  };
  const carveH = (row, from, to, width = 2) => carveRoom(Math.min(from, to), row, Math.abs(to - from) + 1, width);
  const carveV = (col, from, to, width = 2) => carveRoom(col, Math.min(from, to), width, Math.abs(to - from) + 1);
  carveRoom(2, 31, 8, 7);
  carveH(33, 8, 19, 3);
  carveRoom(17, 27, 10, 9);
  carveV(23, 18, 30, 3);
  carveRoom(20, 15, 12, 7);
  carveH(16, 29, 40, 3);
  carveRoom(37, 12, 9, 8);
  carveV(43, 5, 15, 3);
  carveRoom(41, 2, 9, 7);
  carveH(24, 26, 44, 2);
  carveV(43, 18, 25, 2);
  carveRoom(37, 24, 10, 8);
  carveH(29, 29, 39, 2);
  carveV(29, 29, 36, 2);
  carveRoom(27, 34, 9, 4);
  carveH(36, 9, 28, 2);
  carveV(8, 23, 36, 2);
  carveRoom(5, 20, 8, 6);
  carveH(20, 11, 22, 2);
  grid[LEVEL_EIGHT_TARGET_CELL.row][LEVEL_EIGHT_TARGET_CELL.col] = "E";
  return grid.map((row) => row.join(""));
}

export const LEVEL_EIGHT_MAP = buildLayout();
export function isLevelEightOpenCell(col, row) {
  return row >= 0 && row < LEVEL_EIGHT_ROWS && col >= 0 && col < LEVEL_EIGHT_COLS && LEVEL_EIGHT_MAP[row][col] !== "#";
}
export function levelEightCellCenter(col, row) {
  return { x: LEVEL_EIGHT_ORIGIN_X + col * CELL_SIZE + CELL_SIZE / 2, z: LEVEL_EIGHT_ORIGIN_Z + row * CELL_SIZE + CELL_SIZE / 2 };
}
export function levelEightWorldToCell(x, z) {
  return { col: Math.floor((x - LEVEL_EIGHT_ORIGIN_X) / CELL_SIZE), row: Math.floor((z - LEVEL_EIGHT_ORIGIN_Z) / CELL_SIZE) };
}
