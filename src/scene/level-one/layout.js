import { CELL_SIZE, WALL_THICKNESS } from "../constants.js";
import { isInRect } from "../common/layout.js";

export const LEVEL_ONE_COLS = 35;
export const LEVEL_ONE_ROWS = 25;
export const LEVEL_ONE_EXIT_TRIGGER_RADIUS = CELL_SIZE * 0.86;
export const LEVEL_ONE_START_CELL = { col: 4, row: 22, yaw: -Math.PI * 0.18 };
export const LEVEL_ONE_TARGET_CELL = { col: 31, row: 1 };
export const LEVEL_ONE_MAX_POINT_LIGHTS = 10;
export const LEVEL_ONE_MIN_FIXTURE_DISTANCE = CELL_SIZE * 4.15;
export const LEVEL_ONE_CORRIDOR_BOUNDS = { col: 2, row: 6, width: 10, height: 9 };
export const LEVEL_ONE_CORRIDOR_FIXTURES = [
  { col: 3, row: 8, rotation: Math.PI / 2 },
  { col: 8, row: 8, rotation: Math.PI / 2 },
  { col: 6, row: 12, rotation: 0 },
];

export const LEVEL_ONE_DARK_ZONES = [
  { col: 1, row: 16, width: 8, height: 5 },
  { col: 2, row: 6, width: 10, height: 9 },
  { col: 23, row: 11, width: 10, height: 6 },
  { col: 9, row: 19, width: 8, height: 4 },
  { col: 18, row: 4, width: 6, height: 5 },
];

export const LEVEL_ONE_SUPPLY_ZONES = [
  { col: 11, row: 7, width: 6, height: 4 },
  { col: 25, row: 17, width: 6, height: 4 },
];

export function createLevelOneLayout() {
  const grid = Array.from({ length: LEVEL_ONE_ROWS }, () =>
    Array.from({ length: LEVEL_ONE_COLS }, () => "#"),
  );

  const carveCell = (col, row) => {
    if (row > 0 && row < LEVEL_ONE_ROWS - 1 && col > 0 && col < LEVEL_ONE_COLS - 1) {
      grid[row][col] = ".";
    }
  };

  const carveRoom = (col, row, width, height) => {
    for (let y = row; y < row + height; y += 1) {
      for (let x = col; x < col + width; x += 1) carveCell(x, y);
    }
  };

  const blockRoom = (col, row, width, height) => {
    for (let y = row; y < row + height; y += 1) {
      for (let x = col; x < col + width; x += 1) {
        if (y > 0 && y < LEVEL_ONE_ROWS - 1 && x > 0 && x < LEVEL_ONE_COLS - 1) {
          grid[y][x] = "#";
        }
      }
    }
  };

  const carveHorizontal = (fromCol, toCol, row, width = 1) => {
    for (let col = Math.min(fromCol, toCol); col <= Math.max(fromCol, toCol); col += 1) {
      for (let offset = 0; offset < width; offset += 1) carveCell(col, row + offset);
    }
  };

  const carveVertical = (col, fromRow, toRow, width = 1) => {
    for (let row = Math.min(fromRow, toRow); row <= Math.max(fromRow, toRow); row += 1) {
      for (let offset = 0; offset < width; offset += 1) carveCell(col + offset, row);
    }
  };

  carveRoom(1, 1, LEVEL_ONE_COLS - 2, LEVEL_ONE_ROWS - 2);

  const blocks = [
    { col: 2, row: 2, width: 5, height: 3 },
    { col: 13, row: 2, width: 8, height: 2 },
    { col: 27, row: 5, width: 5, height: 3 },
    { col: 3, row: 17, width: 5, height: 3 },
    { col: 18, row: 18, width: 5, height: 3 },
    { col: 28, row: 14, width: 4, height: 4 },
  ];

  const pillars = [];
  for (let row = 6; row <= 20; row += 5) {
    for (let col = 8; col <= 26; col += 6) {
      pillars.push({ col, row, width: 1, height: 1 });
    }
  }

  [...blocks, ...pillars].forEach((block) => {
    for (let row = block.row; row < block.row + block.height; row += 1) {
      for (let col = block.col; col < block.col + block.width; col += 1) {
        if (
          row > 0 &&
          row < LEVEL_ONE_ROWS - 1 &&
          col > 0 &&
          col < LEVEL_ONE_COLS - 1 &&
          !(col === LEVEL_ONE_START_CELL.col && row === LEVEL_ONE_START_CELL.row) &&
          !(col === LEVEL_ONE_TARGET_CELL.col && row === LEVEL_ONE_TARGET_CELL.row)
        ) {
          grid[row][col] = "#";
        }
      }
    }
  });

  // A concrete service wing branches from the main hall. Its narrow route
  // opens into two small rooms before reconnecting, so it remains explorable.
  blockRoom(
    LEVEL_ONE_CORRIDOR_BOUNDS.col,
    LEVEL_ONE_CORRIDOR_BOUNDS.row,
    LEVEL_ONE_CORRIDOR_BOUNDS.width,
    LEVEL_ONE_CORRIDOR_BOUNDS.height,
  );
  carveVertical(3, 7, 13, 2);
  carveHorizontal(3, 8, 7, 2);
  carveHorizontal(4, 9, 11, 2);
  carveVertical(8, 7, 13, 2);
  carveHorizontal(8, 11, 10, 1);
  carveRoom(5, 12, 3, 2);

  return grid.map((row) => row.join(""));
}

export const LEVEL_ONE_MAP = createLevelOneLayout();
export const LEVEL_ONE_ORIGIN_X = -(LEVEL_ONE_COLS * CELL_SIZE) / 2;
export const LEVEL_ONE_ORIGIN_Z = -(LEVEL_ONE_ROWS * CELL_SIZE) / 2;

export function isLevelOneOpenCell(col, row) {
  return (
    row >= 0 &&
    row < LEVEL_ONE_ROWS &&
    col >= 0 &&
    col < LEVEL_ONE_COLS &&
    LEVEL_ONE_MAP[row][col] === "."
  );
}

export function isLevelOneCorridorCell(col, row) {
  return isLevelOneOpenCell(col, row) && isInRect(col, row, LEVEL_ONE_CORRIDOR_BOUNDS);
}

export function levelOneCellCenter(col, row) {
  return {
    x: LEVEL_ONE_ORIGIN_X + col * CELL_SIZE + CELL_SIZE / 2,
    z: LEVEL_ONE_ORIGIN_Z + row * CELL_SIZE + CELL_SIZE / 2,
  };
}

export function levelOneWorldToCell(x, z) {
  return {
    col: Math.floor((x - LEVEL_ONE_ORIGIN_X) / CELL_SIZE),
    row: Math.floor((z - LEVEL_ONE_ORIGIN_Z) / CELL_SIZE),
  };
}

export function isInAnyLevelOneZone(col, row, zones) {
  return zones.some((zone) => isInRect(col, row, zone));
}

export function countLevelOneOpenNeighbors(col, row) {
  return [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
].filter(([offsetCol, offsetRow]) => isLevelOneOpenCell(col + offsetCol, row + offsetRow)).length;
}

export function getLevelOneTargetMount(position) {
  const cell = levelOneWorldToCell(position.x, position.z);
  const options = [
    {
      col: cell.col,
      row: cell.row - 1,
      x: position.x,
      z: position.z - CELL_SIZE / 2,
      rotation: 0,
    },
    {
      col: cell.col,
      row: cell.row + 1,
      x: position.x,
      z: position.z + CELL_SIZE / 2,
      rotation: Math.PI,
    },
    {
      col: cell.col - 1,
      row: cell.row,
      x: position.x - CELL_SIZE / 2,
      z: position.z,
      rotation: Math.PI / 2,
    },
    {
      col: cell.col + 1,
      row: cell.row,
      x: position.x + CELL_SIZE / 2,
      z: position.z,
      rotation: -Math.PI / 2,
    },
  ];

  return options.find((option) => !isLevelOneOpenCell(option.col, option.row)) ?? options[0];
}

