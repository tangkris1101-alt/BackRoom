import { CELL_SIZE, WALL_THICKNESS } from "../constants.js";

export const LEVEL_SEVEN_COLS = 42;
export const LEVEL_SEVEN_ROWS = 30;
export const LEVEL_SEVEN_START_CELL = { col: 4, row: 4, yaw: Math.PI / 2 };
export const LEVEL_SEVEN_TARGET_CELL = { col: 38, row: 25 };
export const LEVEL_SEVEN_EXIT_TRIGGER_RADIUS = CELL_SIZE * 0.86;

export const CELL_WALL = "#";
export const CELL_ROOM = "R";
export const CELL_WATER = "W";
export const CELL_PLATFORM = ".";
export const CELL_EXIT = "E";

export const LEVEL_SEVEN_DARK_WATER_ZONES = [
  { col: 11, row: 12, width: 8, height: 6 },
  { col: 24, row: 9, width: 10, height: 7 },
  { col: 30, row: 20, width: 7, height: 6 },
];

function createGrid() {
  return Array.from({ length: LEVEL_SEVEN_ROWS }, () =>
    Array.from({ length: LEVEL_SEVEN_COLS }, () => CELL_WALL),
  );
}

function inBounds(col, row) {
  return row >= 0 && row < LEVEL_SEVEN_ROWS && col >= 0 && col < LEVEL_SEVEN_COLS;
}

function carveCell(grid, col, row, type = CELL_WATER) {
  if (inBounds(col, row)) grid[row][col] = type;
}

function carveRoom(grid, col, row, width, height, type = CELL_WATER) {
  for (let y = row; y < row + height; y += 1) {
    for (let x = col; x < col + width; x += 1) carveCell(grid, x, y, type);
  }
}

function carveHorizontal(grid, row, colStart, colEnd, width = 1, type = CELL_WATER) {
  const start = Math.min(colStart, colEnd);
  const end = Math.max(colStart, colEnd);
  for (let col = start; col <= end; col += 1) {
    for (let offset = 0; offset < width; offset += 1) carveCell(grid, col, row + offset, type);
  }
}

function carveVertical(grid, col, rowStart, rowEnd, width = 1, type = CELL_WATER) {
  const start = Math.min(rowStart, rowEnd);
  const end = Math.max(rowStart, rowEnd);
  for (let row = start; row <= end; row += 1) {
    for (let offset = 0; offset < width; offset += 1) carveCell(grid, col + offset, row, type);
  }
}

function buildLayout() {
  const grid = createGrid();

  carveRoom(grid, 2, 2, 8, 6, CELL_ROOM);
  carveHorizontal(grid, 5, 8, 14, 2, CELL_PLATFORM);
  carveRoom(grid, 11, 7, 29, 20, CELL_WATER);
  carveRoom(grid, 16, 4, 7, 5, CELL_WATER);
  carveRoom(grid, 29, 5, 7, 4, CELL_WATER);
  carveRoom(grid, 6, 17, 8, 6, CELL_WATER);

  carveHorizontal(grid, 12, 6, 30, 2, CELL_WATER);
  carveVertical(grid, 20, 8, 24, 2, CELL_WATER);
  carveHorizontal(grid, 24, 20, 38, 2, CELL_WATER);
  carveRoom(grid, 35, 22, 5, 5, CELL_PLATFORM);
  carveCell(grid, LEVEL_SEVEN_TARGET_CELL.col, LEVEL_SEVEN_TARGET_CELL.row, CELL_EXIT);

  [
    [15, 13],
    [16, 13],
    [17, 13],
    [25, 16],
    [26, 16],
    [31, 11],
    [9, 20],
    [10, 20],
  ].forEach(([col, row]) => carveCell(grid, col, row, CELL_PLATFORM));

  return grid.map((row) => row.join(""));
}

export const LEVEL_SEVEN_MAP = buildLayout();
export const LEVEL_SEVEN_ORIGIN_X = -(LEVEL_SEVEN_COLS * CELL_SIZE) / 2;
export const LEVEL_SEVEN_ORIGIN_Z = -(LEVEL_SEVEN_ROWS * CELL_SIZE) / 2;

export function isLevelSevenOpenCell(col, row) {
  return inBounds(col, row) && LEVEL_SEVEN_MAP[row][col] !== CELL_WALL;
}

export function levelSevenCellType(col, row) {
  if (!inBounds(col, row)) return CELL_WALL;
  return LEVEL_SEVEN_MAP[row][col];
}

export function isLevelSevenWaterCell(col, row) {
  const type = levelSevenCellType(col, row);
  return type === CELL_WATER || type === CELL_EXIT;
}

export function countLevelSevenOpenNeighbors(col, row) {
  let count = 0;
  if (isLevelSevenOpenCell(col - 1, row)) count += 1;
  if (isLevelSevenOpenCell(col + 1, row)) count += 1;
  if (isLevelSevenOpenCell(col, row - 1)) count += 1;
  if (isLevelSevenOpenCell(col, row + 1)) count += 1;
  return count;
}

export function levelSevenCellCenter(col, row) {
  return {
    x: LEVEL_SEVEN_ORIGIN_X + col * CELL_SIZE + CELL_SIZE / 2,
    z: LEVEL_SEVEN_ORIGIN_Z + row * CELL_SIZE + CELL_SIZE / 2,
  };
}

export function levelSevenWorldToCell(x, z) {
  return {
    col: Math.floor((x - LEVEL_SEVEN_ORIGIN_X) / CELL_SIZE),
    row: Math.floor((z - LEVEL_SEVEN_ORIGIN_Z) / CELL_SIZE),
  };
}

export function getLevelSevenTargetMount({ x, z }) {
  const cell = levelSevenWorldToCell(x, z);
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
  return options.find((option) => !isLevelSevenOpenCell(option.col, option.row)) ?? options[0];
}
