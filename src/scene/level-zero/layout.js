import { CELL_SIZE, LAYOUT_COLS, LAYOUT_ROWS } from "../constants.js";

const LEGACY_COLS = 31;
const LEGACY_ROWS = 27;

export const CELL_OPEN = ".";
export const CELL_WALL = "#";
// Level 0 is a lattice of square bays, and every wall used to run along the
// same two axes. A diagonal bay keeps one corner of the bay walkable and fills
// the rest with an angled pier, so a 45° face cuts across the lattice instead
// of another right angle. The name is the walkable corner, which is also the
// pair of sides that stay open (WN = west + north).
export const CELL_DIAG_WN = "1";
export const CELL_DIAG_EN = "2";
export const CELL_DIAG_ES = "3";
export const CELL_DIAG_WS = "4";
export const DIAGONAL_TYPES = new Set([
  CELL_DIAG_WN,
  CELL_DIAG_EN,
  CELL_DIAG_ES,
  CELL_DIAG_WS,
]);

const DIAGONAL_PORTS = {
  [CELL_DIAG_WN]: ["W", "N"],
  [CELL_DIAG_EN]: ["E", "N"],
  [CELL_DIAG_ES]: ["E", "S"],
  [CELL_DIAG_WS]: ["W", "S"],
};

// Walkable corner of each bay as a fraction of the cell: the point the level
// uses whenever it needs a spot inside walkable space (pickups, the baked light
// field's distance test).
const DIAGONAL_CENTER = {
  [CELL_DIAG_WN]: { x: 1 / 6, z: 1 / 6 },
  [CELL_DIAG_EN]: { x: 5 / 6, z: 1 / 6 },
  [CELL_DIAG_ES]: { x: 5 / 6, z: 5 / 6 },
  [CELL_DIAG_WS]: { x: 1 / 6, z: 5 / 6 },
};

// Walkable span of each bay side: the part of the edge the walkable corner
// covers, measured from the west along the north/south sides and from the
// north along the east/west sides. Everything outside the span is the bay's
// own mass, which is why every diagonal bay needs walls on the sides where the
// neighbouring bay is open.
const DIAGONAL_SIDE_SPANS = {
  [CELL_DIAG_WN]: { N: [0, 0.5], W: [0, 0.5] },
  [CELL_DIAG_EN]: { N: [0.5, 1], E: [0, 0.5] },
  [CELL_DIAG_ES]: { E: [0.5, 1], S: [0.5, 1] },
  [CELL_DIAG_WS]: { W: [0.5, 1], S: [0, 0.5] },
};

// The walkable corner seen as a convex polygon: one unit outward normal per
// edge plus the distance the corner extends along it. A point is inside when
// every `nx * x + nz * z <= distance`, and inside for a body of `radius` when
// each distance shrinks by that radius.
const INV_SQRT2 = 1 / Math.SQRT2;
const DIAGONAL_EDGES = {
  [CELL_DIAG_WN]: [
    { nx: -1, nz: 0, distance: 0 },
    { nx: 0, nz: -1, distance: 0 },
    { nx: INV_SQRT2, nz: INV_SQRT2, distance: (CELL_SIZE / 2) * INV_SQRT2 },
  ],
  [CELL_DIAG_EN]: [
    { nx: 1, nz: 0, distance: CELL_SIZE },
    { nx: 0, nz: -1, distance: 0 },
    { nx: -INV_SQRT2, nz: INV_SQRT2, distance: -(CELL_SIZE / 2) * INV_SQRT2 },
  ],
  [CELL_DIAG_ES]: [
    { nx: 1, nz: 0, distance: CELL_SIZE },
    { nx: 0, nz: 1, distance: CELL_SIZE },
    { nx: -INV_SQRT2, nz: -INV_SQRT2, distance: -1.5 * CELL_SIZE * INV_SQRT2 },
  ],
  [CELL_DIAG_WS]: [
    { nx: -1, nz: 0, distance: 0 },
    { nx: 0, nz: 1, distance: CELL_SIZE },
    { nx: INV_SQRT2, nz: -INV_SQRT2, distance: -(CELL_SIZE / 2) * INV_SQRT2 },
  ],
};

// The 45° face, as a midpoint plus a yaw. A box built for the wall axis maps
// its +x axis onto (cos yaw, 0, -sin yaw), so a face sits at exactly ±45°,
// halfway between the two axis-aligned walls it joins.
const DIAGONAL_WALL = {
  [CELL_DIAG_WN]: { offsetX: 0.25, offsetZ: 0.25, yaw: Math.PI / 4 },
  [CELL_DIAG_EN]: { offsetX: 0.75, offsetZ: 0.25, yaw: -Math.PI / 4 },
  [CELL_DIAG_ES]: { offsetX: 0.75, offsetZ: 0.75, yaw: Math.PI / 4 },
  [CELL_DIAG_WS]: { offsetX: 0.25, offsetZ: 0.75, yaw: -Math.PI / 4 },
};

// The 45° face spans the two bay-edge midpoints the walkable corner leaves
// behind, which is one cell breadth across the diagonal (4 m / √2), not the
// bay's full diagonal.
export const DIAGONAL_WALL_LENGTH = CELL_SIZE / Math.SQRT2;

export const MANILA_ROOM = { col: 34, row: 26, width: 5, height: 5 };
export const MANILA_ROOM_ENTRANCE = { col: MANILA_ROOM.col, row: MANILA_ROOM.row + 2 };

export function createLayout() {
  const grid = Array.from({ length: LAYOUT_ROWS }, () =>
    Array.from({ length: LAYOUT_COLS }, () => "#"),
  );

  const carveCell = (col, row) => {
    if (row > 0 && row < LAYOUT_ROWS - 1 && col > 0 && col < LAYOUT_COLS - 1) {
      grid[row][col] = ".";
    }
  };

  const carveRoom = (col, row, width, height) => {
    for (let y = row; y < row + height; y += 1) {
      for (let x = col; x < col + width; x += 1) {
        carveCell(x, y);
      }
    }
  };

  const carveHorizontal = (fromCol, toCol, row, width = 1) => {
    const start = Math.min(fromCol, toCol);
    const end = Math.max(fromCol, toCol);
    for (let x = start; x <= end; x += 1) {
      for (let offset = 0; offset < width; offset += 1) {
        carveCell(x, row + offset);
      }
    }
  };

  const carveVertical = (col, fromRow, toRow, width = 1) => {
    const start = Math.min(fromRow, toRow);
    const end = Math.max(fromRow, toRow);
    for (let y = start; y <= end; y += 1) {
      for (let offset = 0; offset < width; offset += 1) {
        carveCell(col + offset, y);
      }
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
    { col: 31, row: 17, width: 8, height: 6 },
    MANILA_ROOM,
    { col: 39, row: 9, width: 5, height: 7 },
    { col: 39, row: 19, width: 4, height: 5 },
    { col: 29, row: 31, width: 8, height: 5 },
    { col: 13, row: 28, width: 10, height: 7 },
    { col: 5, row: 30, width: 6, height: 5 },
  ];
  rooms.forEach((room) => carveRoom(room.col, room.row, room.width, room.height));

  // One concealed cell behind the east wall holds the Level 1 lift cabin.
  // The doorway is framed in that wall; it is not a freestanding box.
  carveCell(29, 3);

  carveVertical(3, 15, 22, 1);
  carveHorizontal(3, 14, 15, 1);
  carveVertical(14, 7, 15, 1);
  carveHorizontal(14, 23, 7, 2);
  carveVertical(23, 5, 8, 1);
  carveHorizontal(23, 28, 5, 1);

  carveHorizontal(5, 13, 21, 2);
  carveVertical(13, 15, 21, 2);
  carveHorizontal(18, 24, 14, 1);
  carveVertical(24, 14, 22, 1);
  carveHorizontal(5, 11, 10, 1);
  carveVertical(11, 5, 10, 1);
  carveHorizontal(8, 12, 4, 1);
  carveHorizontal(17, 22, 4, 1);

  // The newer southern/eastern wing makes Level 0 substantially larger while
  // leaving the original layout coordinates untouched for existing saves.
  carveHorizontal(28, 34, 21, 1);
  carveVertical(34, 21, 28, 1);
  carveHorizontal(31, MANILA_ROOM_ENTRANCE.col, MANILA_ROOM_ENTRANCE.row, 1);
  carveHorizontal(34, 40, 21, 1);
  carveVertical(40, 14, 21, 1);
  carveVertical(34, 30, 32, 1);
  carveHorizontal(21, 34, 32, 1);
  carveVertical(6, 24, 32, 1);
  carveHorizontal(6, 13, 32, 1);

  // Grid-aligned piers. Five more used to stand here and are now diagonal bays
  // below, so the level does not answer every corner with the same square
  // block: the remaining squares read as the rule and the angled ones as the
  // exception.
  const pillars = [
    [13, 12],
    [15, 12],
    [17, 12],
    [20, 4],
    [23, 3],
    [35, 20],
    [32, 32],
    [18, 31],
  ];
  pillars.forEach(([col, row]) => {
    grid[row][col] = "#";
  });

  return grid.map((row) => row.join(""));
}

// The angled bays, cut in after the rooms and piers above so they can replace
// either an open corner or a whole pier. A chamfer sits where a corridor or a
// room turns a right angle and cuts the inside of the turn short; a converted
// pier keeps the same footprint but trades half of it for a 45° face, which
// opens a corner passage where the old block only ever presented one flat side.
export const LEVEL_ZERO_ANGLED_CELLS = Object.freeze([
  // Chamfers on the walked route: the spawn room takes two, then the two left
  // turns on the way up to the lift, so the first minutes of the level already
  // show walls that are not on the lattice.
  { col: 1, row: 24, type: CELL_DIAG_EN, note: "spawn room, south-west corner" },
  { col: 6, row: 20, type: CELL_DIAG_WS, note: "spawn room, north-east corner" },
  { col: 13, row: 13, type: CELL_DIAG_ES, note: "central corridor jog" },
  { col: 23, row: 8, type: CELL_DIAG_WN, note: "long corridor, north turn" },
  { col: 28, row: 7, type: CELL_DIAG_WN, note: "final turn before the lift" },
  // Room corners around the level: each is a room's own corner, so the bay only
  // trades a right angle for a 45° face and no passage closes.
  { col: 11, row: 3, type: CELL_DIAG_ES, note: "north room, west corner" },
  { col: 17, row: 3, type: CELL_DIAG_WS, note: "north room, east corner" },
  { col: 18, row: 15, type: CELL_DIAG_WN, note: "central room, south-east corner" },
  { col: 7, row: 12, type: CELL_DIAG_WN, note: "west room, south-east corner" },
  { col: 13, row: 28, type: CELL_DIAG_ES, note: "south wing room, north-west corner" },
  { col: 24, row: 23, type: CELL_DIAG_EN, note: "east room, south-west corner" },
  { col: 28, row: 20, type: CELL_DIAG_WS, note: "east wing corridor corner" },
  { col: 31, row: 22, type: CELL_DIAG_EN, note: "east wing room, south-west corner" },
  // Piers. Each keeps its bay but only half of it: the rest becomes the angled
  // face and the notch beside it.
  { col: 14, row: 14, type: CELL_DIAG_WN, note: "pier beside the central corridor jog" },
  { col: 16, row: 20, type: CELL_DIAG_WN, note: "pier in the south hall" },
  { col: 20, row: 20, type: CELL_DIAG_WS, note: "pier in the south hall" },
  { col: 26, row: 5, type: CELL_DIAG_ES, note: "pier beside the lift approach" },
  { col: 5, row: 10, type: CELL_DIAG_WS, note: "pier in the west hall" },
]);

export const MAP = (() => {
  const grid = createLayout().map((row) => row.split(""));
  LEVEL_ZERO_ANGLED_CELLS.forEach(({ col, row, type }) => {
    grid[row][col] = type;
  });
  return grid.map((row) => row.join(""));
})();

export const ROWS = MAP.length;
export const COLS = MAP[0].length;
// Preserve the old 31 x 27 origin so previously saved player and item
// positions continue to point into the same rooms after the map expands.
export const ORIGIN_X = -(LEGACY_COLS * CELL_SIZE) / 2;
export const ORIGIN_Z = -(LEGACY_ROWS * CELL_SIZE) / 2;
export const MAP_CENTER = {
  x: ORIGIN_X + (COLS * CELL_SIZE) / 2,
  z: ORIGIN_Z + (ROWS * CELL_SIZE) / 2,
};

export const START_CELL = { col: 3, row: 23, yaw: -Math.PI * 0.48 };
// The lift is installed in the eastern wall of this open cell.
export const EXIT_CELL = { col: 28, row: 3 };

export function isDiagonalCell(col, row) {
  return (
    row >= 0 &&
    row < ROWS &&
    col >= 0 &&
    col < COLS &&
    DIAGONAL_TYPES.has(MAP[row][col])
  );
}

export function isOpenCell(col, row) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
  const ch = MAP[row][col];
  return ch === CELL_OPEN || DIAGONAL_TYPES.has(ch);
}

// Sides of a diagonal bay that lead into the walkable corner, and the sides the
// bay's own mass closes.
export function getDiagonalPorts(col, row) {
  const type = MAP[row]?.[col];
  return DIAGONAL_PORTS[type] ?? null;
}

// Fraction of a bay side the walkable corner covers, or null when the whole
// side is mass. Used to cut the bay's walls back to the part that is exposed.
export function diagonalSideSpan(col, row, side) {
  const spans = DIAGONAL_SIDE_SPANS[MAP[row]?.[col]];
  return spans?.[side] ?? null;
}

// A point inside walkable space for this bay. Rooms and corridors put it at the
// bay centre; a diagonal bay puts it at the centroid of its walkable corner,
// which is the one place in the bay that is never inside the angled pier.
export function walkableCenter(col, row) {
  const center = cellCenter(col, row);
  const offset = DIAGONAL_CENTER[MAP[row]?.[col]];
  if (!offset) return center;
  return {
    x: center.x + (offset.x - 0.5) * CELL_SIZE,
    z: center.z + (offset.z - 0.5) * CELL_SIZE,
  };
}

// Point-in-bay test for a diagonal cell, in bay-local coordinates. The walkable
// corner is convex, so eroding it by `radius` (the body the caller wants to fit)
// is exactly the same three half-planes pulled in by that radius. Walkers pass
// radius 0 here: their own ring of samples already carries the radius.
export function pointInDiagonalCell(col, row, x, z, radius = 0) {
  const edges = DIAGONAL_EDGES[MAP[row]?.[col]];
  if (!edges) return false;
  const localX = x - (ORIGIN_X + col * CELL_SIZE);
  const localZ = z - (ORIGIN_Z + row * CELL_SIZE);
  for (const { nx, nz, distance } of edges) {
    if (nx * localX + nz * localZ > distance - radius) return false;
  }
  return true;
}

// The 45° wall itself: midpoint in world space plus the yaw that lays a wall
// box along it, for `DIAGONAL_WALL_LENGTH` before the corner extensions.
export function diagonalWallTransform(col, row) {
  const wall = DIAGONAL_WALL[MAP[row]?.[col]];
  if (!wall) return null;
  const minX = ORIGIN_X + col * CELL_SIZE;
  const minZ = ORIGIN_Z + row * CELL_SIZE;
  return {
    x: minX + wall.offsetX * CELL_SIZE,
    z: minZ + wall.offsetZ * CELL_SIZE,
    yaw: wall.yaw,
  };
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


