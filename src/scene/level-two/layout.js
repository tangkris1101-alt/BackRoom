import { CELL_SIZE, WALL_THICKNESS } from "../constants.js";

export const LEVEL_TWO_COLS = 50;
export const LEVEL_TWO_ROWS = 28;
export const LEVEL_TWO_START_CELL = { col: 3, row: 6, yaw: -Math.PI / 2 };
export const LEVEL_TWO_TARGET_CELL = { col: 40, row: 22 };
export const LEVEL_TWO_EXIT_TRIGGER_RADIUS = CELL_SIZE * 0.74;
export const LEVEL_TWO_MAX_POINT_LIGHTS = 18;
export const LEVEL_TWO_MIN_FIXTURE_DISTANCE = CELL_SIZE * 3.2;

export const CELL_WALL = "#";
export const CELL_OPEN = ".";
export const CELL_DIAG_WN = "1";
export const CELL_DIAG_EN = "2";
export const CELL_DIAG_ES = "3";
export const CELL_DIAG_WS = "4";
export const CELL_DOOR = "D";
export const CELL_VALVE = "V";
export const CELL_BULKHEAD = "B";
export const DIAGONAL_TYPES = new Set([
  CELL_DIAG_WN,
  CELL_DIAG_EN,
  CELL_DIAG_ES,
  CELL_DIAG_WS,
]);

export const LEVEL_TWO_DARK_ZONES = [
  { col: 12, row: 8, width: 4, height: 3 },
  { col: 32, row: 16, width: 3, height: 4 },
  { col: 24, row: 21, width: 4, height: 2 },
];

const SIDE_NONE = "N";
const SIDE_NORTH = "N";
const SIDE_SOUTH = "S";
const SIDE_WEST = "W";
const SIDE_EAST = "E";
const MACHINE_FRACTION_DEFAULT = 0;

function createGrid() {
  return Array.from({ length: LEVEL_TWO_ROWS }, () =>
    Array.from({ length: LEVEL_TWO_COLS }, () => CELL_WALL),
  );
}

function createMeta() {
  return Array.from({ length: LEVEL_TWO_ROWS }, () =>
    Array.from({ length: LEVEL_TWO_COLS }, () => ({
      side: SIDE_NONE,
      diagPorts: null,
      diagonalAxis: null,
    })),
  );
}

function inBounds(col, row) {
  return row >= 0 && row < LEVEL_TWO_ROWS && col >= 0 && col < LEVEL_TWO_COLS;
}

function carve(grid, meta, col, row, type, side = SIDE_NONE, ports = null, axis = null) {
  if (!inBounds(col, row)) return;
  grid[row][col] = type;
  meta[row][col].side = side;
  meta[row][col].diagPorts = ports;
  meta[row][col].diagonalAxis = axis;
}

function carveHorizontal(grid, meta, row, colStart, colEnd, side) {
  const start = Math.min(colStart, colEnd);
  const end = Math.max(colStart, colEnd);
  for (let c = start; c <= end; c += 1) carve(grid, meta, c, row, CELL_OPEN, side);
}

function carveVertical(grid, meta, col, rowStart, rowEnd, side) {
  const start = Math.min(rowStart, rowEnd);
  const end = Math.max(rowStart, rowEnd);
  for (let r = start; r <= end; r += 1) carve(grid, meta, col, r, CELL_OPEN, side);
}

function carveDiagWN(grid, meta, col, row) {
  carve(grid, meta, col, row, CELL_DIAG_WN, SIDE_SOUTH, { a: "W", b: "N" }, "sw-ne");
}
function carveDiagEN(grid, meta, col, row) {
  carve(grid, meta, col, row, CELL_DIAG_EN, SIDE_WEST, { a: "E", b: "N" }, "nw-se");
}
function carveDiagES(grid, meta, col, row) {
  carve(grid, meta, col, row, CELL_DIAG_ES, SIDE_NORTH, { a: "E", b: "S" }, "sw-ne");
}
function carveDiagWS(grid, meta, col, row) {
  carve(grid, meta, col, row, CELL_DIAG_WS, SIDE_EAST, { a: "W", b: "S" }, "nw-se");
}

function carveDoor(grid, meta, col, row, side = SIDE_NORTH) {
  carve(grid, meta, col, row, CELL_DOOR, side);
}

function carveValve(grid, meta, col, row, side = SIDE_NORTH) {
  carve(grid, meta, col, row, CELL_VALVE, side);
}

function carveBulkhead(grid, meta, col, row, side = SIDE_NORTH) {
  carve(grid, meta, col, row, CELL_BULKHEAD, side);
}

function buildLayout() {
  const grid = createGrid();
  const meta = createMeta();

  // ===== MAIN PATH =====
  // Tunnel A: long horizontal utility tunnel (east-bound)
  carveHorizontal(grid, meta, 6, 3, 28, SIDE_NORTH);
  // Diagonal at (29, 6): W->S, turn east-bound into south-bound
  carveDiagWS(grid, meta, 29, 6);
  // Tunnel B: long vertical utility tunnel (south-bound)
  carveVertical(grid, meta, 29, 7, 21, SIDE_EAST);
  // Diagonal at (29, 22): N->E, turn south-bound into east-bound
  carveDiagEN(grid, meta, 29, 22);
  // Tunnel C: long horizontal utility tunnel (east-bound to target)
  carveHorizontal(grid, meta, 22, 30, 41, SIDE_NORTH);

  // ===== SIDE BRANCHES WITH 45° TURNS =====

  // Branch A1: from Tunnel A at col 12, going N (dead end with door alcove)
  carveHorizontal(grid, meta, 5, 11, 12, SIDE_SOUTH);
  carveDiagWN(grid, meta, 12, 5);
  carveVertical(grid, meta, 12, 4, 3, SIDE_EAST);
  carveDoor(grid, meta, 12, 2, SIDE_SOUTH);

  // Branch A2: from Tunnel A at col 18, going N
  carveHorizontal(grid, meta, 5, 17, 18, SIDE_SOUTH);
  carveDiagWN(grid, meta, 18, 5);
  carveVertical(grid, meta, 18, 4, 3, SIDE_EAST);
  carveDoor(grid, meta, 18, 2, SIDE_SOUTH);

  // Branch A3: from Tunnel A at col 24, going S (dead end with door alcove)
  carveHorizontal(grid, meta, 7, 24, 25, SIDE_NORTH);
  carveDiagWS(grid, meta, 25, 7);
  carveVertical(grid, meta, 25, 8, 10, SIDE_WEST);
  carveDoor(grid, meta, 25, 11, SIDE_NORTH);

  // Branch B1: from Tunnel B at row 12, going E then N (mechanical alcove)
  carveHorizontal(grid, meta, 12, 30, 31, SIDE_SOUTH);
  carveDiagWN(grid, meta, 31, 12);
  carveVertical(grid, meta, 31, 11, 10, SIDE_EAST);
  carveDoor(grid, meta, 31, 9, SIDE_SOUTH);

  // Branch B2: from Tunnel B at row 16, going W (dead end with door)
  carveHorizontal(grid, meta, 16, 25, 28, SIDE_NORTH);
  carveDoor(grid, meta, 24, 16, SIDE_SOUTH);

  // Branch C1: from Tunnel C at col 36, going S (dead end)
  carveHorizontal(grid, meta, 23, 36, 37, SIDE_NORTH);
  carveDiagWS(grid, meta, 37, 23);
  carveVertical(grid, meta, 37, 24, 25, SIDE_WEST);
  carveDoor(grid, meta, 37, 26, SIDE_NORTH);

  // ===== VALVES / BULKHEADS / DETAILS =====
  carveValve(grid, meta, 9, 5, SIDE_SOUTH);
  carveValve(grid, meta, 15, 5, SIDE_SOUTH);
  carveValve(grid, meta, 21, 5, SIDE_SOUTH);
  carveValve(grid, meta, 30, 14, SIDE_SOUTH);
  carveValve(grid, meta, 34, 21, SIDE_NORTH);
  carveValve(grid, meta, 38, 21, SIDE_NORTH);

  return { grid, meta };
}

const LAYOUT = buildLayout();

export const LEVEL_TWO_MAP = LAYOUT.grid.map((row) => row.join(""));
export const LEVEL_TWO_CELL_META = LAYOUT.meta;

export const LEVEL_TWO_ORIGIN_X = -(LEVEL_TWO_COLS * CELL_SIZE) / 2;
export const LEVEL_TWO_ORIGIN_Z = -(LEVEL_TWO_ROWS * CELL_SIZE) / 2;

export function isLevelTwoOpenCell(col, row) {
  if (!inBounds(col, row)) return false;
  const ch = LEVEL_TWO_MAP[row][col];
  return ch === CELL_OPEN || ch === CELL_DOOR || DIAGONAL_TYPES.has(ch);
}

export function isLevelTwoWalkableCell(col, row) {
  if (!inBounds(col, row)) return false;
  const ch = LEVEL_TWO_MAP[row][col];
  return ch === CELL_OPEN || ch === CELL_DOOR || DIAGONAL_TYPES.has(ch);
}

export function levelTwoCellCenter(col, row) {
  return {
    x: LEVEL_TWO_ORIGIN_X + col * CELL_SIZE + CELL_SIZE / 2,
    z: LEVEL_TWO_ORIGIN_Z + row * CELL_SIZE + CELL_SIZE / 2,
  };
}

export function levelTwoCellWalkableCenter(col, row) {
  const center = levelTwoCellCenter(col, row);
  if (!inBounds(col, row)) return center;
  const meta = LEVEL_TWO_CELL_META[row][col];
  const walkableWidth = CELL_SIZE * (1 - MACHINE_FRACTION_DEFAULT);
  const offset = CELL_SIZE / 2 - walkableWidth / 2;
  switch (meta.side) {
    case SIDE_NORTH: return { x: center.x, z: center.z + offset };
    case SIDE_SOUTH: return { x: center.x, z: center.z - offset };
    case SIDE_WEST:  return { x: center.x + offset, z: center.z };
    case SIDE_EAST:  return { x: center.x - offset, z: center.z };
    default: return center;
  }
}

export function levelTwoWorldToCell(x, z) {
  return {
    col: Math.floor((x - LEVEL_TWO_ORIGIN_X) / CELL_SIZE),
    row: Math.floor((z - LEVEL_TWO_ORIGIN_Z) / CELL_SIZE),
  };
}

export function levelTwoCellMeta(col, row) {
  if (!inBounds(col, row)) return null;
  return LEVEL_TWO_CELL_META[row][col];
}

export function isLevelTwoDiagonalCell(col, row) {
  if (!inBounds(col, row)) return false;
  return DIAGONAL_TYPES.has(LEVEL_TWO_MAP[row][col]);
}

// For diagonal cells, return the two open ports ("N"/"S"/"E"/"W")
export function getLevelTwoDiagonalPorts(col, row) {
  if (!isLevelTwoDiagonalCell(col, row)) return null;
  return LEVEL_TWO_CELL_META[row][col].diagPorts;
}

// Point-in-polygon for the diagonal cell walkable half.
// Returns true if the point (px, pz) in world coords is inside the walkable polygon
// for the diagonal cell at (col, row).
export function pointInLevelTwoDiagonalCell(col, row, px, pz, radius = 0) {
  const ch = LEVEL_TWO_MAP[row][col];
  const cellMinX = LEVEL_TWO_ORIGIN_X + col * CELL_SIZE;
  const cellMinZ = LEVEL_TWO_ORIGIN_Z + row * CELL_SIZE;
  const localX = px - cellMinX;
  const localZ = pz - cellMinZ;

  // Build the walkable polygon (4 vertices of the half-cell).
  // For type 1 (W->N, SW-NE wall, NW half walkable):
  //   polygon: NW corner (0,0), W midpoint (0, half), N midpoint (half, 0) — actually 3 vertices triangle.
  // We treat the walkable region as the half-cell rectangle bounded by the diagonal wall.
  // The walkable polygon is a triangle with vertices: cell-corner-A, edge-midpoint-1, edge-midpoint-2.
  // Cell corners: NW=(0,0), NE=(s,0), SE=(s,s), SW=(0,s) where s=CELL_SIZE.
  // Edge midpoints: N=(s/2,0), E=(s,s/2), S=(s/2,s), W=(0,s/2).
  const s = CELL_SIZE;

  let poly;
  if (ch === CELL_DIAG_WN) {
    // NW half (x + z < s): triangle NW, W, N
    poly = [
      { x: 0, z: 0 },
      { x: 0, z: s / 2 },
      { x: s / 2, z: 0 },
    ];
  } else if (ch === CELL_DIAG_ES) {
    // SE half (x + z > s): triangle SE, E, S
    poly = [
      { x: s, z: s },
      { x: s, z: s / 2 },
      { x: s / 2, z: s },
    ];
  } else if (ch === CELL_DIAG_EN) {
    // NE half (x > z, in cell-local where z increases downward): triangle NE, E, N
    poly = [
      { x: s, z: 0 },
      { x: s, z: s / 2 },
      { x: s / 2, z: 0 },
    ];
  } else if (ch === CELL_DIAG_WS) {
    // SW half (x < z): triangle SW, W, S
    poly = [
      { x: 0, z: s },
      { x: 0, z: s / 2 },
      { x: s / 2, z: s },
    ];
  } else {
    return false;
  }

  // Point-in-triangle test (with radius inflation for collision).
  // Inflate triangle by moving each edge outward by `radius` (approx).
  const inflated = inflatePolygon(poly, radius);
  return pointInPolygon(localX, localZ, inflated);
}

function pointInPolygon(px, pz, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, zi = poly[i].z;
    const xj = poly[j].x, zj = poly[j].z;
    const intersect =
      zi > pz !== zj > pz &&
      px < ((xj - xi) * (pz - zi)) / (zj - zi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function inflatePolygon(poly, radius) {
  if (radius <= 0) return poly;
  const cx = poly.reduce((a, p) => a + p.x, 0) / poly.length;
  const cz = poly.reduce((a, p) => a + p.z, 0) / poly.length;
  return poly.map((p) => {
    const dx = p.x - cx;
    const dz = p.z - cz;
    const len = Math.hypot(dx, dz) || 1;
    return { x: p.x + (dx / len) * radius, z: p.z + (dz / len) * radius };
  });
}

// Sample a point in the walkable area of a diagonal cell — the centroid of
// the walkable triangle, which always lies inside it. (cellMinX + offsetX,
// cellMinZ + offsetZ) for placing props and BFS starts.
export function levelTwoDiagonalCenterWorld(col, row) {
  const s = CELL_SIZE;
  const cellMinX = LEVEL_TWO_ORIGIN_X + col * CELL_SIZE;
  const cellMinZ = LEVEL_TWO_ORIGIN_Z + row * CELL_SIZE;
  const ch = LEVEL_TWO_MAP[row][col];
  // Each diagonal's walkable triangle is in a different corner; use that
  // corner's centroid so the result is always inside the walkable polygon.
  let lx, lz;
  if (ch === CELL_DIAG_WN) {
    // NW triangle (0,0)–(0,s/2)–(s/2,0), centroid (s/6, s/6)
    lx = s * (1 / 6);
    lz = s * (1 / 6);
  } else if (ch === CELL_DIAG_EN) {
    // NE triangle (s,0)–(s,s/2)–(s/2,0), centroid (5s/6, s/6)
    lx = s * (5 / 6);
    lz = s * (1 / 6);
  } else if (ch === CELL_DIAG_ES) {
    // SE triangle (s,s)–(s,s/2)–(s/2,s), centroid (5s/6, 5s/6)
    lx = s * (5 / 6);
    lz = s * (5 / 6);
  } else {
    // DIAG_WS: SW triangle (0,s)–(0,s/2)–(s/2,s), centroid (s/6, 5s/6)
    lx = s * (1 / 6);
    lz = s * (5 / 6);
  }
  return { x: cellMinX + lx, z: cellMinZ + lz };
}

// For an orthogonal corridor cell, return the world-space "machine side" rectangle
// (the half of the cell where machinery/pipes should be placed + blocked).
export function getLevelTwoMachineRect(col, row) {
  if (!inBounds(col, row)) return null;
  const ch = LEVEL_TWO_MAP[row][col];
  const meta = LEVEL_TWO_CELL_META[row][col];
  if (ch === CELL_WALL || ch === CELL_DOOR || ch === CELL_VALVE) return null;
  if (DIAGONAL_TYPES.has(ch) || ch === CELL_BULKHEAD) return null;

  const cellMinX = LEVEL_TWO_ORIGIN_X + col * CELL_SIZE;
  const cellMinZ = LEVEL_TWO_ORIGIN_Z + row * CELL_SIZE;
  const s = CELL_SIZE;
  const machineWidth = s * MACHINE_FRACTION_DEFAULT;
  if (machineWidth <= 0) return null;

  switch (meta.side) {
    case SIDE_NORTH:
      return {
        minX: cellMinX,
        maxX: cellMinX + s,
        minZ: cellMinZ,
        maxZ: cellMinZ + machineWidth,
      };
    case SIDE_SOUTH:
      return {
        minX: cellMinX,
        maxX: cellMinX + s,
        minZ: cellMinZ + s - machineWidth,
        maxZ: cellMinZ + s,
      };
    case SIDE_WEST:
      return {
        minX: cellMinX,
        maxX: cellMinX + machineWidth,
        minZ: cellMinZ,
        maxZ: cellMinZ + s,
      };
    case SIDE_EAST:
      return {
        minX: cellMinX + s - machineWidth,
        maxX: cellMinX + s,
        minZ: cellMinZ,
        maxZ: cellMinZ + s,
      };
    default:
      return null;
  }
}

export function countLevelTwoOpenNeighbors(col, row) {
  return [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ].filter(([dc, dr]) => isLevelTwoOpenCell(col + dc, row + dr)).length;
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
