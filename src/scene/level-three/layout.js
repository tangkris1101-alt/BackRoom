import { CELL_SIZE } from "../constants.js";

export const LEVEL_THREE_COLS = 39;
export const LEVEL_THREE_ROWS = 23;
export const LEVEL_THREE_START_CELL = { col: 3, row: 3, yaw: -Math.PI * 0.44 };
export const LEVEL_THREE_TARGET_CELL = { col: 36, row: 20 };
export const LEVEL_THREE_EXIT_TRIGGER_RADIUS = CELL_SIZE * 0.74;
export const LEVEL_THREE_MAX_POINT_LIGHTS = 8;
export const LEVEL_THREE_MIN_FIXTURE_DISTANCE = CELL_SIZE * 5.25;

// Indestructible bars: actual blockers. These cells are NOT walkable and
// are rendered with bar geometry instead of solid walls. Wiki describes
// Level 3 as "riddled with various sets of indestructible bars that
// render the majority of the level inaccessible". These four cells
// block specific alternate routes so the player has to walk the
// intended path through all four special rooms.
export const LEVEL_THREE_BAR_POSITIONS = [
  { col: 12, row: 7 },
  { col: 16, row: 7 },
  { col: 28, row: 14 },
  { col: 32, row: 7 },
];

// Industrial-feeling dark zones: bigger, fewer, clustered near the special
// rooms. Generator gets an NW shadow pocket; Assembly Line gets a SW
// cluster; Boiler Room gets an NW pocket; the empty top-right corner
// (above Sanctum, east of the map) gets one large pocket to give the
// dead-end area a sense of dread.
export const LEVEL_THREE_DARK_ZONES = [
  { col: 4, row: 5, width: 4, height: 3 },
  { col: 4, row: 14, width: 5, height: 4 },
  { col: 27, row: 16, width: 5, height: 4 },
  { col: 30, row: 5, width: 5, height: 5 },
];

export function createLevelThreeLayout() {
  const grid = Array.from({ length: LEVEL_THREE_ROWS }, () =>
    Array.from({ length: LEVEL_THREE_COLS }, () => "#"),
  );

  const carveCell = (col, row) => {
    if (row >= 0 && row < LEVEL_THREE_ROWS && col >= 0 && col < LEVEL_THREE_COLS) {
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

  // === 4 special rooms (sized per wiki) ===
  // Generator Room: 7 cols × 6 rows. Wiki: "large rooms that are riddled
  // with lots of electrical equipment".
  carveRoom(4, 5, 7, 6);
  // Sanctum: 6 cols × 6 rows. Wiki: "cathedral interior with Greco-Roman
  // architecture" — small intimate space, not a sprawling room.
  carveRoom(19, 5, 6, 6);
  // Assembly Line: 12 cols × 6 rows. Wiki: "extremely open and large,
  // factory-like facilities" — the longest room.
  carveRoom(4, 13, 12, 6);
  // Boiler Room: 6 cols × 4 rows. Wiki: "fairly straightforward".
  carveRoom(28, 17, 6, 4);

  // === Connecting corridors ===
  // Spawn crawlway: 1-cell-wide vertical (3 cells). Wiki: "extremely thin
  // and/or low ceilings that require wanderers to bend, hunch, crawl".
  carveVertical(3, 3, 5, 1);
  // Spine: rows 11-12 cols 2-36 (width 2). Wide main east-west corridor
  // that the Generator and Sanctum sit on top of. Player exits the rooms
  // south into this corridor.
  carveHorizontal(2, 36, 11, 2);
  // Lower corridor: rows 19-20 cols 2-36 (width 2). Connects Assembly
  // Line south to Boiler Room and on to the exit at (36, 20).
  carveHorizontal(2, 36, 19, 2);
  // Assembly Line south connector: col 7 rows 18-19 width 1. The room
  // already extends to row 18, the corridor already starts at row 19, so
  // this is just one extra cell carved to confirm the path.
  carveVertical(7, 18, 19, 1);
  // Boiler north connector: col 28 rows 12-17 width 1. Connects the spine
  // down to the Boiler Room north wall at (28, 17).
  carveVertical(28, 12, 17, 1);
  // Upper-east alt corridor: row 7 cols 25-35 width 1. Carved so the
  // indestructible bar at (32, 7) has an actual corridor to bisect
  // (otherwise the bar is meaningless — the cell would already be wall).
  carveHorizontal(25, 35, 7, 1);
  // Mid-east alt corridor: row 7 cols 11-17 width 1. Carved so the two
  // indestructible bars at (12, 7) and (16, 7) have a corridor to bisect.
  carveHorizontal(11, 17, 7, 1);

  // === Bulkheads (visual only — wall cells inside open rooms) ===
  const bulkheads = [
    { col: 6, row: 7 },
    { col: 8, row: 8 },
    { col: 22, row: 6 },
    { col: 24, row: 10 },
    { col: 7, row: 14 },
    { col: 11, row: 16 },
    { col: 13, row: 14 },
    { col: 29, row: 18 },
  ];
  bulkheads.forEach(({ col, row }) => {
    if (
      !(col === LEVEL_THREE_START_CELL.col && row === LEVEL_THREE_START_CELL.row) &&
      !(col === LEVEL_THREE_TARGET_CELL.col && row === LEVEL_THREE_TARGET_CELL.row)
    ) {
      grid[row][col] = "#";
    }
  });

  // === Indestructible bars ===
  // Override the carved alt-corridor cells back to wall. The renderer
  // distinguishes these via LEVEL_THREE_BAR_POSITIONS and paints bar
  // geometry instead of solid wall instances at these cells.
  LEVEL_THREE_BAR_POSITIONS.forEach(({ col, row }) => {
    grid[row][col] = "#";
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