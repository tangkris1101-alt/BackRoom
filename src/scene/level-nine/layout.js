import { CELL_SIZE } from "../constants.js";

export const LEVEL_NINE_COLS = 52;
export const LEVEL_NINE_ROWS = 40;
export const LEVEL_NINE_START_CELL = { col: 4, row: 34, yaw: -Math.PI / 2 };
export const LEVEL_NINE_TARGET_CELL = { col: 46, row: 4 };
export const LEVEL_NINE_ORIGIN_X = -(LEVEL_NINE_COLS * CELL_SIZE) / 2;
export const LEVEL_NINE_ORIGIN_Z = -(LEVEL_NINE_ROWS * CELL_SIZE) / 2;

function buildLayout() {
  // This is an outdoor space: every interior cell is grass or asphalt, rather
  // than an enclosed maze. The one-cell rim remains a soft play boundary only.
  const grid = Array.from({ length: LEVEL_NINE_ROWS }, (_, row) => Array.from(
    { length: LEVEL_NINE_COLS }, (_, col) => (row === 0 || row === LEVEL_NINE_ROWS - 1 || col === 0 || col === LEVEL_NINE_COLS - 1 ? "#" : "."),
  ));
  const roads = Array.from({ length: LEVEL_NINE_ROWS }, () => Array(LEVEL_NINE_COLS).fill(false));
  const carveRoad = (col, row, width, height) => {
    for (let z = row; z < row + height; z += 1) {
      for (let x = col; x < col + width; x += 1) {
        if (z > 0 && z < LEVEL_NINE_ROWS - 1 && x > 0 && x < LEVEL_NINE_COLS - 1) roads[z][x] = true;
      }
    }
  };
  const carveRoadH = (row, from, to, width = 3) => carveRoad(Math.min(from, to), row, Math.abs(to - from) + 1, width);
  const carveRoadV = (col, from, to, width = 3) => carveRoad(col, Math.min(from, to), width, Math.abs(to - from) + 1);

  // The primary arrow-sign route runs from the southern street to the north-east exit.
  carveRoadH(32, 2, 47);
  carveRoadV(44, 4, 34);
  carveRoadH(19, 7, 46);
  carveRoadV(24, 19, 34);
  carveRoadH(7, 24, 47);

  grid[LEVEL_NINE_TARGET_CELL.row][LEVEL_NINE_TARGET_CELL.col] = "E";
  return { map: grid.map((row) => row.join("")), roads };
}

const layout = buildLayout();
export const LEVEL_NINE_MAP = layout.map;
export const LEVEL_NINE_ROADS = layout.roads;

export function isLevelNineOpenCell(col, row) {
  return row >= 0 && row < LEVEL_NINE_ROWS && col >= 0 && col < LEVEL_NINE_COLS && LEVEL_NINE_MAP[row][col] !== "#";
}

export function isLevelNineRoadCell(col, row) {
  return row >= 0 && row < LEVEL_NINE_ROWS && col >= 0 && col < LEVEL_NINE_COLS && LEVEL_NINE_ROADS[row][col];
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
