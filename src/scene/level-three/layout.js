import { CELL_SIZE } from "../constants.js";

export const LEVEL_THREE_COLS = 39;
export const LEVEL_THREE_ROWS = 23;
export const LEVEL_THREE_START_CELL = { col: 3, row: 3, yaw: -Math.PI * 0.44 };
export const LEVEL_THREE_TARGET_CELL = { col: 36, row: 20 };
export const LEVEL_THREE_EXIT_TRIGGER_RADIUS = CELL_SIZE * 0.74;
export const LEVEL_THREE_MAX_POINT_LIGHTS = 8;
export const LEVEL_THREE_MIN_FIXTURE_DISTANCE = CELL_SIZE * 5.25;

// Industrial-feeling dark zones: bigger, fewer, clustered near the central power
// station so the back half of the level reads as a dim utility basement.
export const LEVEL_THREE_DARK_ZONES = [
  { col: 14, row: 12, width: 7, height: 6 },
  { col: 24, row: 14, width: 5, height: 4 },
  { col: 4, row: 14, width: 5, height: 4 },
  { col: 31, row: 5, width: 4, height: 4 },
];

export function createLevelThreeLayout() {
  const grid = Array.from({ length: LEVEL_THREE_ROWS }, () =>
    Array.from({ length: LEVEL_THREE_COLS }, () => "#"),
  );

  const carveCell = (col, row) => {
    if (row > 0 && row < LEVEL_THREE_ROWS - 1 && col > 0 && col < LEVEL_THREE_COLS - 1) {
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

  // Top entry (from L2 exit) — small landing corridor
  carveHorizontal(2, 12, 3, 2);
  carveVertical(3, 3, 6, 2);

  // Upper mid corridor — different from L2 (which has its spine at row 10).
  carveHorizontal(8, 28, 8, 2);

  // Central industrial spine (row 11) and lower exit corridor (row 20).
  carveHorizontal(2, 36, 11, 2);
  carveHorizontal(2, 36, 20, 2);

  // Vertical feeders — denser in the back half to create industrial grid feel.
  carveVertical(8, 3, 20, 2);
  carveVertical(20, 3, 20, 2);
  carveVertical(36, 3, 20, 2);

  carveVertical(14, 7, 20, 2);
  carveVertical(28, 8, 20, 2);

  // Auxiliary feeders for prop positions not on a main corridor.
  carveVertical(12, 11, 20, 2);
  carveVertical(26, 11, 20, 2);
  carveVertical(30, 14, 20, 2);
  carveVertical(34, 14, 20, 2);

  // Single-cell connector for cable at (19, 19).
  carveCell(19, 19);

  // Central power station — large room housing the breaker panel + generator.
  carveRoom(15, 13, 8, 6);

  // Equipment annex rooms around the spine.
  carveRoom(3, 6, 4, 4);     // upper-left utility closet
  carveRoom(22, 6, 5, 4);    // upper-right storage
  carveRoom(3, 14, 5, 5);    // lower-left machinery bay
  carveRoom(31, 14, 5, 5);   // lower-right switchgear room

  // Bulkheads subdivide corridors into industrial compartments. Each one
  // closes a single previously-carved corridor cell.
  const bulkheads = [
    { col: 6, row: 9 },
    { col: 10, row: 9 },
    { col: 18, row: 9 },
    { col: 24, row: 9 },
    { col: 32, row: 9 },
    { col: 10, row: 12 },
    { col: 22, row: 12 },
    { col: 26, row: 12 },
    { col: 10, row: 14 },
    { col: 18, row: 14 },
    { col: 22, row: 14 },
    { col: 16, row: 18 },
    { col: 26, row: 18 },
    { col: 32, row: 18 },
  ];
  bulkheads.forEach(({ col, row }) => {
    if (
      !(col === LEVEL_THREE_START_CELL.col && row === LEVEL_THREE_START_CELL.row) &&
      !(col === LEVEL_THREE_TARGET_CELL.col && row === LEVEL_THREE_TARGET_CELL.row)
    ) {
      grid[row][col] = "#";
    }
  });

  return grid.map((row) => row.join(""));
}

export const LEVEL_THREE_MAP = createLevelThreeLayout();
export const LEVEL_THREE_ORIGIN_X = -(LEVEL_THREE_COLS * CELL_SIZE) / 2;
export const LEVEL_THREE_ORIGIN_Z = -(LEVEL_THREE_ROWS * CELL_SIZE) / 2;

export function isLevelThreeOpenCell(col, row) {
  return (
    row >= 0 &&
    row < LEVEL_THREE_ROWS &&
    col >= 0 &&
    col < LEVEL_THREE_COLS &&
    LEVEL_THREE_MAP[row][col] === "."
  );
}

export function levelThreeCellCenter(col, row) {
  return {
    x: LEVEL_THREE_ORIGIN_X + col * CELL_SIZE + CELL_SIZE / 2,
    z: LEVEL_THREE_ORIGIN_Z + row * CELL_SIZE + CELL_SIZE / 2,
  };
}

export function levelThreeWorldToCell(x, z) {
  return {
    col: Math.floor((x - LEVEL_THREE_ORIGIN_X) / CELL_SIZE),
    row: Math.floor((z - LEVEL_THREE_ORIGIN_Z) / CELL_SIZE),
  };
}

export function countLevelThreeOpenNeighbors(col, row) {
  let count = 0;
  if (isLevelThreeOpenCell(col - 1, row)) count += 1;
  if (isLevelThreeOpenCell(col + 1, row)) count += 1;
  if (isLevelThreeOpenCell(col, row - 1)) count += 1;
  if (isLevelThreeOpenCell(col, row + 1)) count += 1;
  return count;
}

export function getLevelThreeTargetMount({ x, z }) {
  const col = Math.round((x - LEVEL_THREE_ORIGIN_X - CELL_SIZE / 2) / CELL_SIZE);
  const row = Math.round((z - LEVEL_THREE_ORIGIN_Z - CELL_SIZE / 2) / CELL_SIZE);
  const center = levelThreeCellCenter(col, row);
  const offset = CELL_SIZE * 0.42;
  const dx = x - center.x;
  const dz = z - center.z;
  if (Math.abs(dx) > Math.abs(dz)) {
    return { x: center.x + Math.sign(dx) * offset, z: center.z, rotation: dx > 0 ? -Math.PI / 2 : Math.PI / 2 };
  }
  return { x: center.x, z: center.z + Math.sign(dz) * offset, rotation: dz > 0 ? Math.PI : 0 };
}