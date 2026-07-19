import { CELL_SIZE, WALL_THICKNESS } from "../constants.js";

const LEVEL_SIX_LEGACY_COLS = 36;
const LEVEL_SIX_LEGACY_ROWS = 27;
export const LEVEL_SIX_COLS = 46;
export const LEVEL_SIX_ROWS = 35;
export const LEVEL_SIX_START_CELL = { col: 2, row: 13, yaw: Math.PI / 2 };
export const LEVEL_SIX_TARGET_CELL = { col: 33, row: 20 };
export const LEVEL_SIX_EXIT_TRIGGER_RADIUS = CELL_SIZE * 0.72;

export const CELL_WALL = "#";
export const CELL_OPEN = ".";
export const CELL_VOID = "V";
export const CELL_EXIT = "E";

export const LEVEL_SIX_DARK_ZONES = [
  { col: 3, row: 5, width: 7, height: 5 },
  { col: 17, row: 3, width: 8, height: 4 },
  { col: 23, row: 15, width: 7, height: 6 },
  { col: 9, row: 19, width: 6, height: 4 },
  { col: 35, row: 4, width: 8, height: 8 },
  { col: 27, row: 27, width: 13, height: 6 },
];

function createGrid() {
  return Array.from({ length: LEVEL_SIX_ROWS }, () =>
    Array.from({ length: LEVEL_SIX_COLS }, () => CELL_WALL),
  );
}

function inBounds(col, row) {
  return row >= 0 && row < LEVEL_SIX_ROWS && col >= 0 && col < LEVEL_SIX_COLS;
}

function carveCell(grid, col, row, type = CELL_OPEN) {
  if (inBounds(col, row)) grid[row][col] = type;
}

function carveHorizontal(grid, row, colStart, colEnd, width = 1, type = CELL_OPEN) {
  const start = Math.min(colStart, colEnd);
  const end = Math.max(colStart, colEnd);
  for (let col = start; col <= end; col += 1) {
    for (let offset = 0; offset < width; offset += 1) carveCell(grid, col, row + offset, type);
  }
}

function carveVertical(grid, col, rowStart, rowEnd, width = 1, type = CELL_OPEN) {
  const start = Math.min(rowStart, rowEnd);
  const end = Math.max(rowStart, rowEnd);
  for (let row = start; row <= end; row += 1) {
    for (let offset = 0; offset < width; offset += 1) carveCell(grid, col + offset, row, type);
  }
}

function carveRoom(grid, col, row, width, height, type = CELL_OPEN) {
  for (let y = row; y < row + height; y += 1) {
    for (let x = col; x < col + width; x += 1) carveCell(grid, x, y, type);
  }
}

function buildLayout() {
  const grid = createGrid();

  carveHorizontal(grid, 13, 2, 10, 1);
  carveVertical(grid, 10, 7, 13, 1);
  carveHorizontal(grid, 7, 6, 20, 1);
  carveVertical(grid, 20, 7, 18, 1);
  carveHorizontal(grid, 18, 12, 27, 1);
  carveVertical(grid, 27, 12, 22, 1);
  carveHorizontal(grid, 22, 19, 33, 1);
  carveVertical(grid, 33, 20, 22, 1);

  carveHorizontal(grid, 15, 4, 18, 1);
  carveVertical(grid, 5, 15, 22, 1);
  carveHorizontal(grid, 22, 5, 14, 1);
  carveVertical(grid, 14, 16, 22, 1);

  carveHorizontal(grid, 5, 15, 30, 1);
  carveVertical(grid, 30, 5, 14, 1);
  carveHorizontal(grid, 14, 22, 30, 1);
  carveHorizontal(grid, 9, 30, 43, 2);
  carveVertical(grid, 42, 9, 29, 2);
  carveHorizontal(grid, 29, 27, 43, 2);
  carveVertical(grid, 27, 22, 30, 2);
  carveRoom(grid, 34, 4, 9, 7);
  carveRoom(grid, 28, 27, 12, 6);

  carveRoom(grid, 2, 12, 3, 3);
  carveRoom(grid, 16, 6, 4, 3, CELL_VOID);
  carveRoom(grid, 28, 19, 5, 4);
  carveCell(grid, LEVEL_SIX_TARGET_CELL.col, LEVEL_SIX_TARGET_CELL.row, CELL_EXIT);

  return grid.map((row) => row.join(""));
}

export const LEVEL_SIX_MAP = buildLayout();
export const LEVEL_SIX_ORIGIN_X = -(LEVEL_SIX_LEGACY_COLS * CELL_SIZE) / 2;
export const LEVEL_SIX_ORIGIN_Z = -(LEVEL_SIX_LEGACY_ROWS * CELL_SIZE) / 2;
export const LEVEL_SIX_CENTER_X = LEVEL_SIX_ORIGIN_X + (LEVEL_SIX_COLS * CELL_SIZE) / 2;
export const LEVEL_SIX_CENTER_Z = LEVEL_SIX_ORIGIN_Z + (LEVEL_SIX_ROWS * CELL_SIZE) / 2;

export function isLevelSixOpenCell(col, row) {
  return inBounds(col, row) && LEVEL_SIX_MAP[row][col] !== CELL_WALL;
}

export function levelSixCellType(col, row) {
  if (!inBounds(col, row)) return CELL_WALL;
  return LEVEL_SIX_MAP[row][col];
}

export function countLevelSixOpenNeighbors(col, row) {
  let count = 0;
  if (isLevelSixOpenCell(col - 1, row)) count += 1;
  if (isLevelSixOpenCell(col + 1, row)) count += 1;
  if (isLevelSixOpenCell(col, row - 1)) count += 1;
  if (isLevelSixOpenCell(col, row + 1)) count += 1;
  return count;
}

export function levelSixCellCenter(col, row) {
  return {
    x: LEVEL_SIX_ORIGIN_X + col * CELL_SIZE + CELL_SIZE / 2,
    z: LEVEL_SIX_ORIGIN_Z + row * CELL_SIZE + CELL_SIZE / 2,
  };
}

export function levelSixWorldToCell(x, z) {
  return {
    col: Math.floor((x - LEVEL_SIX_ORIGIN_X) / CELL_SIZE),
    row: Math.floor((z - LEVEL_SIX_ORIGIN_Z) / CELL_SIZE),
  };
}

export function getLevelSixTargetMount({ x, z }) {
  const cell = levelSixWorldToCell(x, z);
  const options = [
    {
      col: cell.col,
      row: cell.row - 1,
      x,
      z: z - CELL_SIZE / 2 + WALL_THICKNESS * 0.7,
      rotation: 0,
    },
    {
      col: cell.col,
      row: cell.row + 1,
      x,
      z: z + CELL_SIZE / 2 - WALL_THICKNESS * 0.7,
      rotation: Math.PI,
    },
    {
      col: cell.col - 1,
      row: cell.row,
      x: x - CELL_SIZE / 2 + WALL_THICKNESS * 0.7,
      z,
      rotation: Math.PI / 2,
    },
    {
      col: cell.col + 1,
      row: cell.row,
      x: x + CELL_SIZE / 2 - WALL_THICKNESS * 0.7,
      z,
      rotation: -Math.PI / 2,
    },
  ];
  return options.find((option) => !isLevelSixOpenCell(option.col, option.row)) ?? options[0];
}
