import { CELL_SIZE } from "../constants.js";

export const LEVEL_NINE_COLS = 52;
export const LEVEL_NINE_ROWS = 40;
export const LEVEL_NINE_START_CELL = { col: 4, row: 34, yaw: -Math.PI / 2 };
export const LEVEL_NINE_TARGET_CELL = { col: 46, row: 4 };
export const LEVEL_NINE_ORIGIN_X = -(LEVEL_NINE_COLS * CELL_SIZE) / 2;
export const LEVEL_NINE_ORIGIN_Z = -(LEVEL_NINE_ROWS * CELL_SIZE) / 2;

function buildLayout() {
  const grid = Array.from({ length: LEVEL_NINE_ROWS }, () => Array(LEVEL_NINE_COLS).fill("#"));
  const carveRoom = (col, row, width, height) => {
    for (let z = row; z < row + height; z += 1) {
      for (let x = col; x < col + width; x += 1) {
        if (z > 0 && z < LEVEL_NINE_ROWS - 1 && x > 0 && x < LEVEL_NINE_COLS - 1) grid[z][x] = ".";
      }
    }
  };
  const carveRoadH = (row, from, to, width = 3) => carveRoom(Math.min(from, to), row, Math.abs(to - from) + 1, width);
  const carveRoadV = (col, from, to, width = 3) => carveRoom(col, Math.min(from, to), width, Math.abs(to - from) + 1);

  // The primary arrow-sign route runs from the southern street to the north-east exit.
  carveRoadH(32, 2, 47);
  carveRoadV(44, 4, 34);
  carveRoadH(19, 7, 46);
  carveRoadV(24, 19, 34);
  carveRoadH(7, 24, 47);

  // House lots branch off the streets; only some carry a porch opening.
  carveRoom(4, 24, 8, 6);
  carveRoadV(8, 28, 33, 2);
  carveRoom(14, 24, 7, 6);
  carveRoadV(17, 28, 33, 2);
  carveRoom(29, 24, 8, 6);
  carveRoadV(33, 28, 33, 2);
  carveRoom(6, 11, 8, 6);
  carveRoadV(10, 16, 20, 2);
  carveRoom(16, 11, 7, 6);
  carveRoadV(19, 16, 20, 2);
  carveRoom(29, 11, 8, 6);
  carveRoadV(33, 16, 20, 2);
  carveRoom(38, 11, 7, 6);
  carveRoadV(41, 16, 20, 2);
  carveRoom(29, 2, 8, 4);
  carveRoadV(33, 5, 8, 2);
  carveRoom(38, 2, 8, 4);
  carveRoadV(41, 5, 8, 2);

  grid[LEVEL_NINE_TARGET_CELL.row][LEVEL_NINE_TARGET_CELL.col] = "E";
  return grid.map((row) => row.join(""));
}

export const LEVEL_NINE_MAP = buildLayout();

export function isLevelNineOpenCell(col, row) {
  return row >= 0 && row < LEVEL_NINE_ROWS && col >= 0 && col < LEVEL_NINE_COLS && LEVEL_NINE_MAP[row][col] !== "#";
}

export function levelNineCellCenter(col, row) {
  return {
    x: LEVEL_NINE_ORIGIN_X + col * CELL_SIZE + CELL_SIZE / 2,
    z: LEVEL_NINE_ORIGIN_Z + row * CELL_SIZE + CELL_SIZE / 2,
  };
}

export function levelNineWorldToCell(x, z) {
  return {
    col: Math.floor((x - LEVEL_NINE_ORIGIN_X) / CELL_SIZE),
    row: Math.floor((z - LEVEL_NINE_ORIGIN_Z) / CELL_SIZE),
  };
}
