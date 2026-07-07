import { CELL_SIZE, WALL_THICKNESS } from "../constants.js";
import { isInRect } from "../common/layout.js";

export const LEVEL_FIVE_COLS = 44;
export const LEVEL_FIVE_ROWS = 27;
export const LEVEL_FIVE_START_CELL = { col: 3, row: 14, yaw: -Math.PI / 2 };
export const LEVEL_FIVE_TARGET_CELL = { col: 40, row: 24 };
export const LEVEL_FIVE_EXIT_TRIGGER_RADIUS = CELL_SIZE * 0.76;
export const LEVEL_FIVE_MAX_POINT_LIGHTS = 12;
export const LEVEL_FIVE_MIN_FIXTURE_DISTANCE = CELL_SIZE * 3.6;

export const CELL_WALL = "#";
export const CELL_OPEN = ".";
export const CELL_BALLROOM = "R";
export const CELL_BOILER = "B";
export const CELL_DOOR = "D";
export const CELL_STAFF = "S";

export const LEVEL_FIVE_DARK_ZONES = [
  { col: 6, row: 5, width: 5, height: 4 },
  { col: 25, row: 5, width: 5, height: 4 },
  { col: 35, row: 20, width: 8, height: 5 },
  { col: 31, row: 15, width: 4, height: 4 },
];

export const LEVEL_FIVE_SUPPLY_ZONES = [
  { col: 15, row: 10, width: 12, height: 8 },
  { col: 5, row: 18, width: 6, height: 4 },
];

export const LEVEL_FIVE_BEVERLY_ROOM = { col: 15, row: 8, width: 13, height: 11 };
export const LEVEL_FIVE_BOILER_ROOM = { col: 34, row: 20, width: 9, height: 5 };

function createGrid() {
  return Array.from({ length: LEVEL_FIVE_ROWS }, () =>
    Array.from({ length: LEVEL_FIVE_COLS }, () => CELL_WALL),
  );
}

function inBounds(col, row) {
  return row >= 0 && row < LEVEL_FIVE_ROWS && col >= 0 && col < LEVEL_FIVE_COLS;
}

function carveCell(grid, col, row, type = CELL_OPEN) {
  if (inBounds(col, row)) grid[row][col] = type;
}

function carveRoom(grid, col, row, width, height, type = CELL_OPEN) {
  for (let y = row; y < row + height; y += 1) {
    for (let x = col; x < col + width; x += 1) carveCell(grid, x, y, type);
  }
}

function carveHorizontal(grid, row, colStart, colEnd, width = 1, type = CELL_OPEN) {
  const start = Math.min(colStart, colEnd);
  const end = Math.max(colStart, colEnd);
  for (let x = start; x <= end; x += 1) {
    for (let offset = 0; offset < width; offset += 1) carveCell(grid, x, row + offset, type);
  }
}

function carveVertical(grid, col, rowStart, rowEnd, width = 1, type = CELL_OPEN) {
  const start = Math.min(rowStart, rowEnd);
  const end = Math.max(rowStart, rowEnd);
  for (let y = start; y <= end; y += 1) {
    for (let offset = 0; offset < width; offset += 1) carveCell(grid, col + offset, y, type);
  }
}

function buildLayout() {
  const grid = createGrid();

  // Main Hall: readable east-west spine.
  carveHorizontal(grid, 13, 2, 41, 3, CELL_OPEN);

  // The Beverly Room / Eternal Ballroom, connected through the spine.
  carveRoom(grid, LEVEL_FIVE_BEVERLY_ROOM.col, LEVEL_FIVE_BEVERLY_ROOM.row, LEVEL_FIVE_BEVERLY_ROOM.width, LEVEL_FIVE_BEVERLY_ROOM.height, CELL_BALLROOM);

  // Guest rooms and empty lounges branching from the main hall.
  carveRoom(grid, 4, 5, 7, 5, CELL_OPEN);
  carveRoom(grid, 13, 4, 6, 4, CELL_OPEN);
  carveRoom(grid, 23, 5, 8, 5, CELL_OPEN);
  carveRoom(grid, 34, 5, 6, 5, CELL_OPEN);
  carveRoom(grid, 5, 18, 7, 5, CELL_OPEN);
  carveRoom(grid, 17, 18, 6, 4, CELL_OPEN);
  carveRoom(grid, 28, 18, 5, 4, CELL_OPEN);

  // Short hotel corridors into the rooms.
  carveVertical(grid, 7, 9, 13, 2, CELL_OPEN);
  carveVertical(grid, 15, 7, 13, 2, CELL_OPEN);
  carveVertical(grid, 27, 9, 13, 2, CELL_OPEN);
  carveVertical(grid, 37, 9, 13, 2, CELL_OPEN);
  carveVertical(grid, 8, 15, 18, 2, CELL_OPEN);
  carveVertical(grid, 19, 15, 18, 2, CELL_OPEN);
  carveVertical(grid, 30, 15, 18, 2, CELL_OPEN);

  // Staff-only route into the boiler rooms.
  carveHorizontal(grid, 17, 31, 37, 2, CELL_STAFF);
  carveVertical(grid, 36, 18, 24, 2, CELL_STAFF);
  carveRoom(grid, LEVEL_FIVE_BOILER_ROOM.col, LEVEL_FIVE_BOILER_ROOM.row, LEVEL_FIVE_BOILER_ROOM.width, LEVEL_FIVE_BOILER_ROOM.height, CELL_BOILER);
  carveCell(grid, LEVEL_FIVE_TARGET_CELL.col, LEVEL_FIVE_TARGET_CELL.row, CELL_DOOR);

  // Locked-looking door tiles are still walkable, but visually distinct.
  [
    [5, 13],
    [13, 13],
    [24, 13],
    [34, 13],
    [10, 15],
    [21, 15],
    [32, 15],
    [36, 17],
  ].forEach(([col, row]) => carveCell(grid, col, row, CELL_DOOR));

  return grid.map((row) => row.join(""));
}

export const LEVEL_FIVE_MAP = buildLayout();
export const LEVEL_FIVE_ORIGIN_X = -(LEVEL_FIVE_COLS * CELL_SIZE) / 2;
export const LEVEL_FIVE_ORIGIN_Z = -(LEVEL_FIVE_ROWS * CELL_SIZE) / 2;

export function isLevelFiveOpenCell(col, row) {
  return (
    inBounds(col, row) &&
    LEVEL_FIVE_MAP[row][col] !== CELL_WALL
  );
}

export function levelFiveCellType(col, row) {
  if (!inBounds(col, row)) return CELL_WALL;
  return LEVEL_FIVE_MAP[row][col];
}

export function levelFiveCellCenter(col, row) {
  return {
    x: LEVEL_FIVE_ORIGIN_X + col * CELL_SIZE + CELL_SIZE / 2,
    z: LEVEL_FIVE_ORIGIN_Z + row * CELL_SIZE + CELL_SIZE / 2,
  };
}

export function levelFiveWorldToCell(x, z) {
  return {
    col: Math.floor((x - LEVEL_FIVE_ORIGIN_X) / CELL_SIZE),
    row: Math.floor((z - LEVEL_FIVE_ORIGIN_Z) / CELL_SIZE),
  };
}

export function isInAnyLevelFiveZone(col, row, zones) {
  return zones.some((zone) => isInRect(col, row, zone));
}

export function countLevelFiveOpenNeighbors(col, row) {
  let count = 0;
  if (isLevelFiveOpenCell(col - 1, row)) count += 1;
  if (isLevelFiveOpenCell(col + 1, row)) count += 1;
  if (isLevelFiveOpenCell(col, row - 1)) count += 1;
  if (isLevelFiveOpenCell(col, row + 1)) count += 1;
  return count;
}

export function getLevelFiveTargetMount({ x, z }) {
  const cell = levelFiveWorldToCell(x, z);
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

  return options.find((option) => !isLevelFiveOpenCell(option.col, option.row)) ?? options[0];
}
