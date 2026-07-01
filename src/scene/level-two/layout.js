import { CELL_SIZE, WALL_THICKNESS } from "../constants.js";

export const LEVEL_TWO_COLS = 39;
export const LEVEL_TWO_ROWS = 23;
export const LEVEL_TWO_START_CELL = { col: 3, row: 3, yaw: -Math.PI * 0.44 };
export const LEVEL_TWO_TARGET_CELL = { col: 36, row: 20 };
export const LEVEL_TWO_EXIT_TRIGGER_RADIUS = CELL_SIZE * 0.74;
export const LEVEL_TWO_MAX_POINT_LIGHTS = 8;
export const LEVEL_TWO_MIN_FIXTURE_DISTANCE = CELL_SIZE * 5.25;
export const LEVEL_TWO_DARK_ZONES = [
  { col: 4, row: 7, width: 4, height: 3 },
  { col: 12, row: 13, width: 5, height: 4 },
  { col: 24, row: 14, width: 4, height: 4 },
  { col: 31, row: 17, width: 4, height: 3 },
  { col: 18, row: 5, width: 5, height: 5 },
  { col: 7, row: 17, width: 5, height: 4 },
];

export function createLevelTwoLayout() {
  const grid = Array.from({ length: LEVEL_TWO_ROWS }, () =>
    Array.from({ length: LEVEL_TWO_COLS }, () => "#"),
  );

  const carveCell = (col, row) => {
    if (row > 0 && row < LEVEL_TWO_ROWS - 1 && col > 0 && col < LEVEL_TWO_COLS - 1) {
      grid[row][col] = ".";
    }
  };

  const carveRoom = (col, row, width, height) => {
    for (let y = row; y < row + height; y += 1) {
      for (let x = col; x < col + width; x += 1) carveCell(x, y);
    }
  };

  const carveHorizontal = (fromCol, toCol, row, width = 1) => {
    const start = Math.min(fromCol, toCol);
    const end = Math.max(fromCol, toCol);
    for (let x = start; x <= end; x += 1) {
      for (let offset = 0; offset < width; offset += 1) carveCell(x, row + offset);
    }
  };

  const carveVertical = (col, fromRow, toRow, width = 1) => {
    const start = Math.min(fromRow, toRow);
    const end = Math.max(fromRow, toRow);
    for (let y = start; y <= end; y += 1) {
      for (let offset = 0; offset < width; offset += 1) carveCell(col + offset, y);
    }
  };

  carveHorizontal(2, 15, 3, 2);
  carveVertical(14, 3, 11, 2);
  carveHorizontal(8, 28, 10, 2);
  carveVertical(8, 10, 20, 2);
  carveHorizontal(8, 36, 19, 2);
  carveVertical(30, 11, 20, 2);
  carveHorizontal(24, 34, 11, 2);

  carveRoom(3, 6, 5, 4);
  carveRoom(18, 5, 6, 5);
  carveRoom(12, 13, 5, 4);
  carveRoom(25, 14, 6, 4);
  carveRoom(31, 17, 6, 4);

  const bulkheads = [
    { col: 20, row: 7 },
    { col: 22, row: 7 },
    { col: 12, row: 15 },
    { col: 28, row: 16 },
    { col: 33, row: 18 },
  ];
  bulkheads.forEach(({ col, row }) => {
    if (
      !(col === LEVEL_TWO_START_CELL.col && row === LEVEL_TWO_START_CELL.row) &&
      !(col === LEVEL_TWO_TARGET_CELL.col && row === LEVEL_TWO_TARGET_CELL.row)
    ) {
      grid[row][col] = "#";
    }
  });

  return grid.map((row) => row.join(""));
}

export const LEVEL_TWO_MAP = createLevelTwoLayout();
export const LEVEL_TWO_ORIGIN_X = -(LEVEL_TWO_COLS * CELL_SIZE) / 2;
export const LEVEL_TWO_ORIGIN_Z = -(LEVEL_TWO_ROWS * CELL_SIZE) / 2;

export function isLevelTwoOpenCell(col, row) {
  return (
    row >= 0 &&
    row < LEVEL_TWO_ROWS &&
    col >= 0 &&
    col < LEVEL_TWO_COLS &&
    LEVEL_TWO_MAP[row][col] === "."
  );
}

export function levelTwoCellCenter(col, row) {
  return {
    x: LEVEL_TWO_ORIGIN_X + col * CELL_SIZE + CELL_SIZE / 2,
    z: LEVEL_TWO_ORIGIN_Z + row * CELL_SIZE + CELL_SIZE / 2,
  };
}

export function levelTwoWorldToCell(x, z) {
  return {
    col: Math.floor((x - LEVEL_TWO_ORIGIN_X) / CELL_SIZE),
    row: Math.floor((z - LEVEL_TWO_ORIGIN_Z) / CELL_SIZE),
  };
}

export function countLevelTwoOpenNeighbors(col, row) {
  return [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ].filter(([offsetCol, offsetRow]) => isLevelTwoOpenCell(col + offsetCol, row + offsetRow)).length;
}

export function getLevelTwoTargetMount(position) {
  const cell = levelTwoWorldToCell(position.x, position.z);
  const options = [
    {
      col: cell.col,
      row: cell.row - 1,
      x: position.x,
      z: position.z - CELL_SIZE / 2 + WALL_THICKNESS * 0.7,
      rotation: 0,
    },
    {
      col: cell.col,
      row: cell.row + 1,
      x: position.x,
      z: position.z + CELL_SIZE / 2 - WALL_THICKNESS * 0.7,
      rotation: Math.PI,
    },
    {
      col: cell.col - 1,
      row: cell.row,
      x: position.x - CELL_SIZE / 2 + WALL_THICKNESS * 0.7,
      z: position.z,
      rotation: Math.PI / 2,
    },
    {
      col: cell.col + 1,
      row: cell.row,
      x: position.x + CELL_SIZE / 2 - WALL_THICKNESS * 0.7,
      z: position.z,
      rotation: -Math.PI / 2,
    },
  ];

  return options.find((option) => !isLevelTwoOpenCell(option.col, option.row)) ?? options[0];
}


