import { CELL_SIZE } from "../constants.js";

export const LEVEL_THIRTY_SEVEN_COLS = 48;
export const LEVEL_THIRTY_SEVEN_ROWS = 36;
export const LEVEL_THIRTY_SEVEN_START_CELL = { col: 4, row: 31, yaw: -Math.PI * 0.18 };
export const LEVEL_THIRTY_SEVEN_TARGET_CELL = { col: 43, row: 3 };
export const LEVEL_THIRTY_SEVEN_ORIGIN_X = -(LEVEL_THIRTY_SEVEN_COLS * CELL_SIZE) / 2;
export const LEVEL_THIRTY_SEVEN_ORIGIN_Z = -(LEVEL_THIRTY_SEVEN_ROWS * CELL_SIZE) / 2;

function buildLayout() {
  const grid = Array.from({ length: LEVEL_THIRTY_SEVEN_ROWS }, () => Array(LEVEL_THIRTY_SEVEN_COLS).fill("#"));
  const room = (col, row, width, height, type = ".") => {
    for (let z = row; z < row + height; z += 1) for (let x = col; x < col + width; x += 1) {
      if (z > 0 && z < LEVEL_THIRTY_SEVEN_ROWS - 1 && x > 0 && x < LEVEL_THIRTY_SEVEN_COLS - 1) grid[z][x] = type;
    }
  };
  room(2, 27, 12, 7);
  room(11, 23, 4, 7);
  room(11, 19, 12, 7);
  room(20, 15, 5, 8);
  room(22, 12, 13, 7);
  room(32, 9, 5, 7);
  room(34, 5, 11, 8);
  room(40, 2, 6, 6);
  room(6, 21, 8, 3);
  room(5, 12, 4, 11);
  room(5, 9, 14, 5);
  room(17, 8, 7, 4);
  room(11, 28, 20, 3);
  room(28, 25, 12, 7);
  room(37, 18, 6, 9);
  room(33, 17, 7, 4);
  grid[LEVEL_THIRTY_SEVEN_TARGET_CELL.row][LEVEL_THIRTY_SEVEN_TARGET_CELL.col] = "E";
  return grid.map((row) => row.join(""));
}

export const LEVEL_THIRTY_SEVEN_MAP = buildLayout();
export function isLevelThirtySevenOpenCell(col, row) {
  return row >= 0 && row < LEVEL_THIRTY_SEVEN_ROWS && col >= 0 && col < LEVEL_THIRTY_SEVEN_COLS && LEVEL_THIRTY_SEVEN_MAP[row][col] !== "#";
}
export function levelThirtySevenCellCenter(col, row) {
  return { x: LEVEL_THIRTY_SEVEN_ORIGIN_X + col * CELL_SIZE + CELL_SIZE / 2, z: LEVEL_THIRTY_SEVEN_ORIGIN_Z + row * CELL_SIZE + CELL_SIZE / 2 };
}
export function levelThirtySevenWorldToCell(x, z) {
  return { col: Math.floor((x - LEVEL_THIRTY_SEVEN_ORIGIN_X) / CELL_SIZE), row: Math.floor((z - LEVEL_THIRTY_SEVEN_ORIGIN_Z) / CELL_SIZE) };
}
