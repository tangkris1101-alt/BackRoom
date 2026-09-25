import { CELL_SIZE, WALL_THICKNESS } from "../constants.js";

const LEVEL_THREE_LEGACY_COLS = 39;
const LEVEL_THREE_LEGACY_ROWS = 23;
export const LEVEL_THREE_COLS = 49;
export const LEVEL_THREE_ROWS = 31;
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
  { col: 39, row: 4, width: 8, height: 7 },
  { col: 34, row: 23, width: 12, height: 6 },
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
  carveHorizontal(34, 46, 11, 2);
  carveRoom(39, 4, 8, 7);
  carveVertical(44, 11, 25, 2);
  carveRoom(34, 23, 12, 6);
  carveHorizontal(16, 44, 27, 2);
  carveVertical(18, 20, 27, 2);
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
export const LEVEL_THREE_ORIGIN_X = -(LEVEL_THREE_LEGACY_COLS * CELL_SIZE) / 2;
export const LEVEL_THREE_ORIGIN_Z = -(LEVEL_THREE_LEGACY_ROWS * CELL_SIZE) / 2;
export const LEVEL_THREE_CENTER_X = LEVEL_THREE_ORIGIN_X + (LEVEL_THREE_COLS * CELL_SIZE) / 2;
export const LEVEL_THREE_CENTER_Z = LEVEL_THREE_ORIGIN_Z + (LEVEL_THREE_ROWS * CELL_SIZE) / 2;

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

// Wall panels are CELL_SIZE-wide boxes of WALL_THICKNESS centred on the cell
// border, so a wall's inner face lies CELL_SIZE / 2 - WALL_THICKNESS / 2
// (= 1.890) from the cell centre. Stopping at WALL_THICKNESS * 0.7 (= 1.846)
// instead buries the mounting plane 0.044 into that face: a thin prop
// (0.12 deep) then sits 0.016 inside the wall, so it can never show a gap
// against the brick while its front still stands clear. Level two uses the
// same formula.
const LEVEL_THREE_MOUNT_OFFSET = CELL_SIZE / 2 - WALL_THICKNESS * 0.7;

// Fallback search budget, in cells. Expanding the ring-R cells checks walls
// R + 1 cells out, so rings 0..RADIUS-1 cover every wall within RADIUS cells.
// For reference, no prop on the current map needs more than one step.
const LEVEL_THREE_MOUNT_SEARCH_RADIUS = 3;

// One entry per cardinal wall, tested north -> south -> west -> east.
// dCol/dRow point at the wall cell, dx/dz move the prop from the cell centre
// to that wall, and rotation is the yaw that leaves the prop's local +Z (the
// face a viewer sees) looking back into the room: N = 0, S = PI, W = PI/2,
// E = -PI/2.
const LEVEL_THREE_MOUNT_WALLS = [
  { dCol: 0, dRow: -1, dx: 0, dz: -LEVEL_THREE_MOUNT_OFFSET, rotation: 0 },
  { dCol: 0, dRow: 1, dx: 0, dz: LEVEL_THREE_MOUNT_OFFSET, rotation: Math.PI },
  { dCol: -1, dRow: 0, dx: -LEVEL_THREE_MOUNT_OFFSET, dz: 0, rotation: Math.PI / 2 },
  { dCol: 1, dRow: 0, dx: LEVEL_THREE_MOUNT_OFFSET, dz: 0, rotation: -Math.PI / 2 },
];

// Which way a wall prop faces is decided by the cells around it, never by the
// point that was passed in. Callers hand over a cell centre (props.js mounts
// every instance from levelThreeCellCenter), so an offset along the passed-in
// point would be zero: the old Math.sign(0) * 1.68 put all 13 props in the
// middle of their cell or room, including five solid switchgear cabinets.
function findLevelThreeMountWall(col, row) {
  for (const wall of LEVEL_THREE_MOUNT_WALLS) {
    // Fence cells (LEVEL_THREE_BAR_POSITIONS) are stored as "#", so they rank
    // as walls here too — correct, since they block the cell just like one.
    if (!isLevelThreeOpenCell(col + wall.dCol, row + wall.dRow)) {
      return { col, row, ...wall };
    }
  }

  // All four neighbours are open (a prop dropped in the middle of a room).
  // Walk outward over open cells, breadth first so the first hit is the
  // nearest wall, and mount on the last open cell before that wall: the prop
  // lands flush against real geometry instead of floating on an interior cell
  // border.
  const queue = [{ col, row, ring: 0 }];
  const visited = new Set([`${col},${row}`]);
  while (queue.length > 0) {
    const cell = queue.shift();
    if (cell.ring >= LEVEL_THREE_MOUNT_SEARCH_RADIUS) continue;
    for (const wall of LEVEL_THREE_MOUNT_WALLS) {
      const nextCol = cell.col + wall.dCol;
      const nextRow = cell.row + wall.dRow;
      if (!isLevelThreeOpenCell(nextCol, nextRow)) {
        return { col: cell.col, row: cell.row, ...wall };
      }
      const key = `${nextCol},${nextRow}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ col: nextCol, row: nextRow, ring: cell.ring + 1 });
      }
    }
  }

  // No wall inside the search radius. Kept deterministic on purpose: face
  // north, like level two's fallback. Unreached on the current map.
  return { col, row, ...LEVEL_THREE_MOUNT_WALLS[0] };
}

export function getLevelThreeTargetMount({ x, z }) {
  const col = Math.round((x - LEVEL_THREE_ORIGIN_X - CELL_SIZE / 2) / CELL_SIZE);
  const row = Math.round((z - LEVEL_THREE_ORIGIN_Z - CELL_SIZE / 2) / CELL_SIZE);
  const wall = findLevelThreeMountWall(col, row);
  const center = levelThreeCellCenter(wall.col, wall.row);
  return {
    x: center.x + wall.dx,
    z: center.z + wall.dz,
    rotation: wall.rotation,
  };
}
