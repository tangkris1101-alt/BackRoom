import { LAYOUT_COLS, LAYOUT_ROWS, CELL_SIZE } from "../constants.js";

const COLS = LAYOUT_COLS;
const ROWS = LAYOUT_ROWS;
const MAP = createLayout();

export const START_CELL = { col: 1, row: 1, yaw: -Math.PI * 0.42 };
export const EXIT_CELL = { col: COLS - 2, row: ROWS - 2 };
export const EXIT_TRIGGER_RADIUS = CELL_SIZE * 0.92;

function createLayout() {
  const grid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => "#"));

  const carveCell = (col, row) => {
    if (row > 0 && row < ROWS - 1 && col > 0 && col < COLS - 1) {
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

  const rooms = [
    { col: 1, row: 20, width: 6, height: 5 },
    { col: 2, row: 13, width: 4, height: 3 },
    { col: 3, row: 8, width: 5, height: 5 },
    { col: 1, row: 1, width: 8, height: 6 },
    { col: 11, row: 3, width: 7, height: 5 },
    { col: 10, row: 10, width: 9, height: 6 },
    { col: 13, row: 18, width: 12, height: 5 },
    { col: 22, row: 12, width: 6, height: 4 },
    { col: 19, row: 1, width: 10, height: 7 },
    { col: 24, row: 20, width: 5, height: 4 },
  ];
  rooms.forEach((room) => carveRoom(room.col, room.row, room.width, room.height));

  carveVertical(3, 15, 22, 1);
  carveHorizontal(3, 14, 15, 1);
  carveVertical(14, 7, 15, 1);
  carveHorizontal(14, 23, 7, 2);
  carveVertical(23, 5, 8, 1);
  carveHorizontal(23, 28, 5, 1);

  carveHorizontal(5, 13, 21, 2);
  carveVertical(13, 15, 21, 2);
  carveHorizontal(18, 24, 14, 1);
  carveVertical(24, 11, 15, 1);
  carveHorizontal(20, 30, 11, 2);
  carveVertical(30, 11, 21, 1);
  carveHorizontal(11, 24, 6, 2);
  carveVertical(11, 6, 10, 1);
  carveHorizontal(11, 30, 9, 2);

  return grid.map((row) => row.join(""));
}

const ORIGIN_X = -(COLS * CELL_SIZE) / 2;
const ORIGIN_Z = -(ROWS * CELL_SIZE) / 2;

export function isOpenCell(col, row) {
  return (
    row >= 0 && row < ROWS && col >= 0 && col < COLS && MAP[row][col] === "."
  );
}

export function countOpenNeighbors(col, row) {
  return [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ].filter(([offsetCol, offsetRow]) => isOpenCell(col + offsetCol, row + offsetRow)).length;
}

export function cellCenter(col, row) {
  return {
    x: ORIGIN_X + col * CELL_SIZE + CELL_SIZE / 2,
    z: ORIGIN_Z + row * CELL_SIZE + CELL_SIZE / 2,
  };
}

export function worldToCell(x, z) {
  return {
    col: Math.floor((x - ORIGIN_X) / CELL_SIZE),
    row: Math.floor((z - ORIGIN_Z) / CELL_SIZE),
  };
}

export function getOrigin() {
  return { x: ORIGIN_X, z: ORIGIN_Z };
}

export function getDimensions() {
  return { cols: COLS, rows: ROWS };
}