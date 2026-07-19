import { CELL_SIZE } from "./scene/constants.js";
import {
  MAP as L0_MAP,
  COLS as L0_COLS,
  ROWS as L0_ROWS,
  ORIGIN_X as L0_OX,
  ORIGIN_Z as L0_OZ,
  START_CELL as L0_START,
  EXIT_CELL as L0_EXIT,
  cellCenter as l0CellCenter,
  isOpenCell as l0IsOpen,
} from "./scene/level-zero/layout.js";
import { BRIGHT_ZONES, DARK_ZONES } from "./scene/level-zero/world.js";
import {
  LEVEL_ONE_MAP,
  LEVEL_ONE_COLS,
  LEVEL_ONE_ROWS,
  LEVEL_ONE_ORIGIN_X as L1_OX,
  LEVEL_ONE_ORIGIN_Z as L1_OZ,
  LEVEL_ONE_START_CELL as L1_START,
  LEVEL_ONE_TARGET_CELL as L1_TARGET,
  LEVEL_ONE_DARK_ZONES,
  LEVEL_ONE_SUPPLY_ZONES,
  levelOneCellCenter as l1CellCenter,
  isLevelOneOpenCell as l1IsOpen,
} from "./scene/level-one/layout.js";
import { collectLevelOneTransforms } from "./scene/level-one/props.js";
import {
  LEVEL_TWO_MAP,
  LEVEL_TWO_COLS,
  LEVEL_TWO_ROWS,
  LEVEL_TWO_ORIGIN_X as L2_OX,
  LEVEL_TWO_ORIGIN_Z as L2_OZ,
  LEVEL_TWO_START_CELL as L2_START,
  LEVEL_TWO_TARGET_CELL as L2_TARGET,
  LEVEL_TWO_DARK_ZONES,
  CELL_WALL,
  CELL_OPEN,
  CELL_DIAG_WN,
  CELL_DIAG_EN,
  CELL_DIAG_ES,
  CELL_DIAG_WS,
  CELL_DOOR,
  CELL_VALVE,
  CELL_BULKHEAD,
  isLevelTwoOpenCell as l2IsOpen,
  levelTwoCellCenter as l2CellCenter,
} from "./scene/level-two/layout.js";
import { collectLevelTwoTransforms } from "./scene/level-two/props.js";
import {
  LEVEL_THREE_MAP,
  LEVEL_THREE_COLS,
  LEVEL_THREE_ROWS,
  LEVEL_THREE_ORIGIN_X as L3_OX,
  LEVEL_THREE_ORIGIN_Z as L3_OZ,
  LEVEL_THREE_START_CELL as L3_START,
  LEVEL_THREE_TARGET_CELL as L3_TARGET,
  LEVEL_THREE_DARK_ZONES,
  LEVEL_THREE_BAR_POSITIONS,
  isLevelThreeOpenCell as l3IsOpen,
  levelThreeCellCenter as l3CellCenter,
  countLevelThreeOpenNeighbors,
} from "./scene/level-three/layout.js";
import { collectLevelTransforms } from "./scene/level-two/props.js";
import {
  LEVEL_FIVE_MAP,
  LEVEL_FIVE_COLS,
  LEVEL_FIVE_ROWS,
  LEVEL_FIVE_ORIGIN_X as L5_OX,
  LEVEL_FIVE_ORIGIN_Z as L5_OZ,
  LEVEL_FIVE_START_CELL as L5_START,
  LEVEL_FIVE_TARGET_CELL as L5_TARGET,
  LEVEL_FIVE_DARK_ZONES,
  LEVEL_FIVE_SUPPLY_ZONES,
  CELL_WALL as L5_WALL,
  CELL_OPEN as L5_OPEN,
  CELL_BALLROOM as L5_BALLROOM,
  CELL_BOILER as L5_BOILER,
  CELL_DOOR as L5_DOOR,
  CELL_STAFF as L5_STAFF,
  isLevelFiveOpenCell as l5IsOpen,
  levelFiveCellCenter as l5CellCenter,
  levelFiveCellType,
} from "./scene/level-five/layout.js";
import { collectLevelFiveTransforms } from "./scene/level-five/props.js";
import {
  LEVEL_EIGHT_MAP,
  LEVEL_EIGHT_COLS,
  LEVEL_EIGHT_ROWS,
  LEVEL_EIGHT_ORIGIN_X as L8_OX,
  LEVEL_EIGHT_ORIGIN_Z as L8_OZ,
  LEVEL_EIGHT_START_CELL as L8_START,
  LEVEL_EIGHT_TARGET_CELL as L8_TARGET,
  isLevelEightOpenCell as l8IsOpen,
  levelEightCellCenter as l8CellCenter,
} from "./scene/level-eight/layout.js";
import {
  LEVEL_THIRTY_SEVEN_MAP,
  LEVEL_THIRTY_SEVEN_COLS,
  LEVEL_THIRTY_SEVEN_ROWS,
  LEVEL_THIRTY_SEVEN_ORIGIN_X as L37_OX,
  LEVEL_THIRTY_SEVEN_ORIGIN_Z as L37_OZ,
  LEVEL_THIRTY_SEVEN_START_CELL as L37_START,
  LEVEL_THIRTY_SEVEN_TARGET_CELL as L37_TARGET,
  isLevelThirtySevenOpenCell as l37IsOpen,
  levelThirtySevenCellCenter as l37CellCenter,
} from "./scene/level-thirty-seven/layout.js";
import { chooseBacteriaSpawn, pickBacteriaSpawnPositions } from "./scene/entities/spawn.js";

const ITEM_AVOID_RADIUS = CELL_SIZE * 4;

const L0_PILLARS = [
  [13, 12],
  [15, 12],
  [17, 12],
  [14, 14],
  [20, 4],
  [23, 3],
  [26, 5],
  [16, 20],
  [20, 20],
  [5, 10],
].map(([col, row]) => ({ col, row }));

const L1_BLOCKS = [
  { col: 2, row: 2, width: 5, height: 3 },
  { col: 13, row: 2, width: 8, height: 2 },
  { col: 27, row: 5, width: 5, height: 3 },
  { col: 3, row: 17, width: 5, height: 3 },
  { col: 18, row: 18, width: 5, height: 3 },
  { col: 28, row: 14, width: 4, height: 4 },
];

const L1_PILLARS = (() => {
  const out = [];
  for (let row = 6; row <= 20; row += 5) {
    for (let col = 8; col <= 26; col += 6) {
      out.push({ col, row });
    }
  }
  return out;
})();

const L4_CUBICLES = [
  { col: 7, row: 19 },
  { col: 11, row: 19 },
  { col: 15, row: 18 },
  { col: 20, row: 20 },
  { col: 24, row: 18 },
  { col: 7, row: 11 },
  { col: 12, row: 10 },
  { col: 18, row: 11 },
  { col: 23, row: 9 },
  { col: 27, row: 13 },
  { col: 16, row: 6 },
  { col: 21, row: 6 },
  { col: 27, row: 21 },
];

const L4_VENDING = [
  { col: 4, row: 6, id: "level-four-vending" },
  { col: 29, row: 6, id: "level-four-water-cooler" },
];

const L4_WINDOWS = [
  { col: 2, row: 4 },
  { col: 11, row: 2 },
  { col: 21, row: 2 },
  { col: 30, row: 8 },
  { col: 30, row: 17 },
];

const L4_SIGNS = [
  { col: 5, row: 21, text: "M.E.G." },
  { col: 26, row: 15, text: "NO WIN" },
  { col: 18, row: 3, text: "WATER" },
];

const L5_FURNITURE = [
  { col: 6, row: 14, width: 1, height: 1 },
  { col: 18, row: 14, width: 1, height: 1 },
  { col: 26, row: 14, width: 1, height: 1 },
  { col: 8, row: 20, width: 1, height: 1 },
  { col: 29, row: 19, width: 1, height: 1 },
  { col: 21, row: 13, width: 1, height: 1 },
  { col: 35, row: 22, width: 1, height: 1 },
  { col: 41, row: 21, width: 1, height: 1 },
];

const L5_WINDOWS = [
  { col: 6, row: 5 },
  { col: 28, row: 5 },
  { col: 39, row: 8 },
];

const L5_SIGNS = [
  { col: 36, row: 17, text: "STAFF" },
  { col: L5_TARGET.col, row: L5_TARGET.row, text: "EXIT" },
];

const L3_BULKHEADS = [
  { col: 6, row: 7 },
  { col: 8, row: 8 },
  { col: 22, row: 6 },
  { col: 24, row: 10 },
  { col: 7, row: 14 },
  { col: 11, row: 16 },
  { col: 13, row: 14 },
  { col: 29, row: 18 },
];

const L3_BAR_SET = new Set(LEVEL_THREE_BAR_POSITIONS.map((b) => `${b.col},${b.row}`));

function buildGrid(map) {
  return map.map((row) => row.split(""));
}

function collectWallCells(grid) {
  const out = [];
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < grid[row].length; col += 1) {
      if (grid[row][col] === "#") out.push({ col, row });
    }
  }
  return out;
}

function computeItemCandidates(cols, rows, isOpen, getCellCenter, avoidPositions) {
  const out = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!isOpen(col, row)) continue;
      const center = getCellCenter(col, row);
      const far = avoidPositions.every(
        (p) => Math.hypot(center.x - p.x, center.z - p.z) > ITEM_AVOID_RADIUS,
      );
      if (far) out.push({ col, row, x: center.x, z: center.z });
    }
  }
  return out;
}

function worldPointsToCells(points, originX, originZ) {
  return points.map((p) => ({
    col: Math.round((p.x - originX) / CELL_SIZE - 0.5),
    row: Math.round((p.z - originZ) / CELL_SIZE - 0.5),
    x: p.x,
    z: p.z,
    priority: p.priority ?? 0,
  }));
}

function collectLevel0Fixtures() {
  const cols = L0_COLS;
  const rows = L0_ROWS;
  const candidates = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!l0IsOpen(col, row)) continue;
      const center = l0CellCenter(col, row);
      const isBright = isInZones(col, row, BRIGHT_ZONES);
      const isDark = isInZones(col, row, DARK_ZONES);
      const neighbors = openNeighbors(col, row, l0IsOpen);
      const isSpacious = neighbors >= 3;
      const lightSeed = (col * 37 + row * 19) % 11;
      const roomFixtureGrid = col % 6 === 3 && row % 4 === 1;
      const brightFixtureGrid = col % 5 === 2 && row % 4 === 1;
      const horizontalCorridor = l0IsOpen(col - 1, row) && l0IsOpen(col + 1, row);
      const verticalCorridor = l0IsOpen(col, row - 1) && l0IsOpen(col, row + 1);
      const corridorCenter = !isSpacious && (horizontalCorridor || verticalCorridor);
      const corridorGrid = corridorCenter && row % 5 === 2 && col % 6 === 3;
      const shouldLight =
        (isBright && brightFixtureGrid) ||
        (!isDark && isSpacious && roomFixtureGrid) ||
        (!isDark && corridorGrid) ||
        (isDark && roomFixtureGrid && (row + col) % 2 === 0);
      if (shouldLight) {
        candidates.push({
          x: center.x,
          z: center.z,
          priority: (isBright ? 4 : 0) + (isSpacious ? 2 : 0) - (isDark ? 1 : 0),
        });
      }
    }
  }
  const startCenter = l0CellCenter(L0_START.col, L0_START.row);
  const exitCenter = l0CellCenter(L0_EXIT.col, L0_EXIT.row);
  candidates.push(
    { x: startCenter.x, z: startCenter.z, priority: 8 },
    { x: exitCenter.x, z: exitCenter.z, priority: 7 },
  );
  const MIN_DIST = CELL_SIZE * 4.25;
  const placed = [];
  candidates
    .sort((a, b) => b.priority - a.priority)
    .forEach((c) => {
      const tooClose = placed.some((p) => Math.hypot(p.x - c.x, p.z - c.z) < MIN_DIST);
      if (!tooClose) placed.push(c);
    });
  return placed;
}

function isInZones(col, row, zones) {
  for (const z of zones) {
    if (col >= z.col && col < z.col + z.width && row >= z.row && row < z.row + z.height) {
      return true;
    }
  }
  return false;
}

function openNeighbors(col, row, isOpen) {
  let n = 0;
  if (isOpen(col - 1, row)) n += 1;
  if (isOpen(col + 1, row)) n += 1;
  if (isOpen(col, row - 1)) n += 1;
  if (isOpen(col, row + 1)) n += 1;
  return n;
}

function withCellCoords(candidates, originX, originZ, cellSize) {
  return candidates.map((c) => ({
    ...c,
    col: Math.round((c.x - originX) / cellSize - 0.5),
    row: Math.round((c.z - originZ) / cellSize - 0.5),
  }));
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWithSeed(candidates, rng) {
  if (candidates.length === 0) return null;
  const idx = Math.floor(rng() * candidates.length);
  return candidates[Math.min(idx, candidates.length - 1)];
}

function simulateItems(level, seed) {
  const rng = mulberry32(seed);
  const result = {};
  for (const [itemId, candidates] of Object.entries(level.itemCandidates)) {
    result[itemId] = pickWithSeed(candidates, rng);
  }
  return result;
}

const FLOOR_BASE = "#5a5a3a";
const FLOOR_BRIGHT = "#6f6a3c";
const FLOOR_DARK = "#454228";
const FLOOR_SUPPLY = "#3a5a6a";
const FLOOR_BOTH = "#5a5028";

function isInZone(col, row, zone) {
  return (
    col >= zone.col &&
    col < zone.col + zone.width &&
    row >= zone.row &&
    row < zone.row + zone.height
  );
}

function computeFloorColors(cols, rows, brightZones, darkZones, supplyZones) {
  const colors = [];
  for (let row = 0; row < rows; row += 1) {
    const rowArr = new Array(cols);
    for (let col = 0; col < cols; col += 1) {
      const inBright = brightZones.some((z) => isInZone(col, row, z));
      const inDark = darkZones.some((z) => isInZone(col, row, z));
      const inSupply = supplyZones.some((z) => isInZone(col, row, z));
      let color = FLOOR_BASE;
      if (inBright && inDark) color = FLOOR_BOTH;
      else if (inBright) color = FLOOR_BRIGHT;
      else if (inDark) color = FLOOR_DARK;
      else if (inSupply) color = FLOOR_SUPPLY;
      rowArr[col] = color;
    }
    colors.push(rowArr);
  }
  return colors;
}

function buildLevel0() {
  const grid = buildGrid(L0_MAP);
  return {
    level: 0,
    label: "LEVEL 0",
    name: "NOCLIP ZONE",
    cols: L0_COLS,
    rows: L0_ROWS,
    originX: L0_OX,
    originZ: L0_OZ,
    cellSize: CELL_SIZE,
    grid,
    floorColors: computeFloorColors(L0_COLS, L0_ROWS, BRIGHT_ZONES, DARK_ZONES, []),
    getCellType(col, row) {
      const ch = grid[row]?.[col];
      if (ch === "#") return "wall";
      return "open";
    },
    startCell: L0_START,
    targetCell: L0_EXIT,
    zones: { bright: BRIGHT_ZONES, dark: DARK_ZONES, supply: [] },
    fixedProps: { pillars: L0_PILLARS, blocks: [], bulkheads: [], cubicles: [], vending: [], windows: [], signs: [] },
    lightFixtures: worldPointsToCells(collectLevel0Fixtures(), L0_OX, L0_OZ),
    itemCandidates: {
      "almond-water": computeItemCandidates(L0_COLS, L0_ROWS, l0IsOpen, l0CellCenter, [
        l0CellCenter(L0_START.col, L0_START.row),
        l0CellCenter(L0_EXIT.col, L0_EXIT.row),
      ]),
      "super-almond-water": computeItemCandidates(L0_COLS, L0_ROWS, l0IsOpen, l0CellCenter, [
        l0CellCenter(L0_START.col, L0_START.row),
        l0CellCenter(L0_EXIT.col, L0_EXIT.row),
      ]),
      flashlight: computeItemCandidates(L0_COLS, L0_ROWS, l0IsOpen, l0CellCenter, [
        l0CellCenter(L0_START.col, L0_START.row),
        l0CellCenter(L0_EXIT.col, L0_EXIT.row),
      ]),
      detector: [],
    },
    entityCandidates: { bacteria: [], hound: [], "ambush-hound": [] },
    interactions: [],
  };
}

function buildLevel1() {
  const grid = buildGrid(LEVEL_ONE_MAP);
  const startCenter = l1CellCenter(L1_START.col, L1_START.row);
  const targetCenter = l1CellCenter(L1_TARGET.col, L1_TARGET.row);
  const { fixturePositions } = collectLevelOneTransforms();
  return {
    level: 1,
    label: "LEVEL 1",
    name: "HABITABLE ZONE",
    cols: LEVEL_ONE_COLS,
    rows: LEVEL_ONE_ROWS,
    originX: L1_OX,
    originZ: L1_OZ,
    cellSize: CELL_SIZE,
    grid,
    floorColors: computeFloorColors(LEVEL_ONE_COLS, LEVEL_ONE_ROWS, [], LEVEL_ONE_DARK_ZONES, LEVEL_ONE_SUPPLY_ZONES),
    getCellType(col, row) {
      const ch = grid[row]?.[col];
      if (ch === "#") return "wall";
      return "open";
    },
    startCell: L1_START,
    targetCell: L1_TARGET,
    zones: { bright: [], dark: LEVEL_ONE_DARK_ZONES, supply: LEVEL_ONE_SUPPLY_ZONES },
    fixedProps: { pillars: L1_PILLARS, blocks: L1_BLOCKS, bulkheads: [], cubicles: [], vending: [], windows: [], signs: [] },
    lightFixtures: worldPointsToCells(fixturePositions, L1_OX, L1_OZ),
    itemCandidates: {
      "almond-water": computeItemCandidates(LEVEL_ONE_COLS, LEVEL_ONE_ROWS, l1IsOpen, l1CellCenter, [startCenter, targetCenter]),
      "super-almond-water": computeItemCandidates(LEVEL_ONE_COLS, LEVEL_ONE_ROWS, l1IsOpen, l1CellCenter, [startCenter, targetCenter]),
      flashlight: computeItemCandidates(LEVEL_ONE_COLS, LEVEL_ONE_ROWS, l1IsOpen, l1CellCenter, [startCenter, targetCenter]),
      detector: computeItemCandidates(LEVEL_ONE_COLS, LEVEL_ONE_ROWS, l1IsOpen, l1CellCenter, [startCenter, targetCenter]),
    },
    entityCandidates: {
      bacteria: withCellCoords(chooseBacteriaSpawn({
        cols: LEVEL_ONE_COLS,
        rows: LEVEL_ONE_ROWS,
        isCellOpen: l1IsOpen,
        getCellCenter: l1CellCenter,
        targetPosition: targetCenter,
        spawnPosition: startCenter,
      }), L1_OX, L1_OZ, CELL_SIZE),
      hound: [],
      "ambush-hound": [],
    },
    interactions: [
      { id: "level-one-elevator-panel", col: L1_TARGET.col, row: L1_TARGET.row, label: "ELEVATOR" },
    ],
  };
}

function buildLevel2() {
  const grid = buildGrid(LEVEL_TWO_MAP);
  const startCenter = l2CellCenter(L2_START.col, L2_START.row);
  const targetCenter = l2CellCenter(L2_TARGET.col, L2_TARGET.row);
  const bacteriaCandidates = chooseBacteriaSpawn({
    cols: LEVEL_TWO_COLS,
    rows: LEVEL_TWO_ROWS,
    isCellOpen: l2IsOpen,
    getCellCenter: l2CellCenter,
    targetPosition: targetCenter,
    spawnPosition: startCenter,
  });
  const bacteriaTop = bacteriaCandidates[0] ?? targetCenter;
  const houndCandidates = chooseBacteriaSpawn({
    cols: LEVEL_TWO_COLS,
    rows: LEVEL_TWO_ROWS,
    isCellOpen: l2IsOpen,
    getCellCenter: l2CellCenter,
    targetPosition: targetCenter,
    spawnPosition: startCenter,
    avoidPositions: [bacteriaTop],
    minSeparation: CELL_SIZE * 7,
  });
  const { fixturePositions } = collectLevelTwoTransforms();
  return {
    level: 2,
    label: "LEVEL 2",
    name: "PIPE DREAMS",
    cols: LEVEL_TWO_COLS,
    rows: LEVEL_TWO_ROWS,
    originX: L2_OX,
    originZ: L2_OZ,
    cellSize: CELL_SIZE,
    grid,
    floorColors: computeFloorColors(LEVEL_TWO_COLS, LEVEL_TWO_ROWS, [], LEVEL_TWO_DARK_ZONES, []),
    getCellType(col, row) {
      const ch = grid[row]?.[col];
      if (ch === CELL_WALL) return "wall";
      if (ch === CELL_DOOR) return "door";
      if (ch === CELL_VALVE) return "valve";
      if (ch === CELL_BULKHEAD) return "bulkhead";
      if (ch === CELL_OPEN) return "open";
      if (ch === CELL_DIAG_WN) return "diag-wn";
      if (ch === CELL_DIAG_EN) return "diag-en";
      if (ch === CELL_DIAG_ES) return "diag-es";
      if (ch === CELL_DIAG_WS) return "diag-ws";
      return "open";
    },
    startCell: L2_START,
    targetCell: L2_TARGET,
    zones: { bright: [], dark: LEVEL_TWO_DARK_ZONES, supply: [] },
    fixedProps: { pillars: [], blocks: [], bulkheads: collectWallCells(grid), cubicles: [], vending: [], windows: [], signs: [] },
    lightFixtures: worldPointsToCells(fixturePositions, L2_OX, L2_OZ),
    itemCandidates: {
      "almond-water": computeItemCandidates(LEVEL_TWO_COLS, LEVEL_TWO_ROWS, l2IsOpen, l2CellCenter, [startCenter, targetCenter]),
      "super-almond-water": computeItemCandidates(LEVEL_TWO_COLS, LEVEL_TWO_ROWS, l2IsOpen, l2CellCenter, [startCenter, targetCenter]),
      flashlight: computeItemCandidates(LEVEL_TWO_COLS, LEVEL_TWO_ROWS, l2IsOpen, l2CellCenter, [startCenter, targetCenter]),
      detector: computeItemCandidates(LEVEL_TWO_COLS, LEVEL_TWO_ROWS, l2IsOpen, l2CellCenter, [startCenter, targetCenter]),
    },
    entityCandidates: {
      bacteria: withCellCoords(bacteriaCandidates, L2_OX, L2_OZ, CELL_SIZE),
      hound: withCellCoords(houndCandidates, L2_OX, L2_OZ, CELL_SIZE),
      "ambush-hound": [],
    },
    interactions: [
      { id: "level-two-valve", col: 30, row: 14, label: "VALVE" },
      { id: "level-two-service-door", col: L2_TARGET.col, row: L2_TARGET.row, label: "SERVICE DOOR" },
    ],
  };
}

function buildLevel3() {
  const grid = buildGrid(LEVEL_THREE_MAP);
  const startCenter = l3CellCenter(L3_START.col, L3_START.row);
  const targetCenter = l3CellCenter(L3_TARGET.col, L3_TARGET.row);
  const generatorCenter = l3CellCenter(7, 8);
  const bacteriaSpawns = pickBacteriaSpawnPositions({
    cols: LEVEL_THREE_COLS,
    rows: LEVEL_THREE_ROWS,
    isCellOpen: l3IsOpen,
    getCellCenter: l3CellCenter,
    targetPosition: targetCenter,
    spawnPosition: startCenter,
    count: 2,
  });
  const bacteriaCandidates = chooseBacteriaSpawn({
    cols: LEVEL_THREE_COLS,
    rows: LEVEL_THREE_ROWS,
    isCellOpen: l3IsOpen,
    getCellCenter: l3CellCenter,
    targetPosition: targetCenter,
    spawnPosition: startCenter,
  });
  const houndCandidates = chooseBacteriaSpawn({
    cols: LEVEL_THREE_COLS,
    rows: LEVEL_THREE_ROWS,
    isCellOpen: l3IsOpen,
    getCellCenter: l3CellCenter,
    targetPosition: targetCenter,
    spawnPosition: startCenter,
    avoidPositions: bacteriaSpawns,
    minSeparation: CELL_SIZE * 7,
  });
  const ambushCenter = l3IsOpen(24, 7) ? { col: 24, row: 7, ...l3CellCenter(24, 7) } : null;
  const { fixturePositions } = collectLevelTransforms({
    cols: LEVEL_THREE_COLS,
    rows: LEVEL_THREE_ROWS,
    isCellOpen: l3IsOpen,
    getCellCenter: l3CellCenter,
    countOpenNeighbors: countLevelThreeOpenNeighbors,
    darkZones: LEVEL_THREE_DARK_ZONES,
    startCell: L3_START,
    targetCell: L3_TARGET,
    minFixtureDistance: 5.25 * CELL_SIZE,
    isBarCell: (col, row) => L3_BAR_SET.has(`${col},${row}`),
  });
  return {
    level: 3,
    label: "LEVEL 3",
    name: "ELECTRICAL STATION",
    cols: LEVEL_THREE_COLS,
    rows: LEVEL_THREE_ROWS,
    originX: L3_OX,
    originZ: L3_OZ,
    cellSize: CELL_SIZE,
    grid,
    floorColors: computeFloorColors(LEVEL_THREE_COLS, LEVEL_THREE_ROWS, [], LEVEL_THREE_DARK_ZONES, []),
    getCellType(col, row) {
      const ch = grid[row]?.[col];
      if (ch === "#") return L3_BAR_SET.has(`${col},${row}`) ? "bar" : "wall";
      return "open";
    },
    startCell: L3_START,
    targetCell: L3_TARGET,
    zones: { bright: [], dark: LEVEL_THREE_DARK_ZONES, supply: [] },
    fixedProps: { pillars: [], blocks: [], bulkheads: L3_BULKHEADS, bars: LEVEL_THREE_BAR_POSITIONS, cubicles: [], vending: [], windows: [], signs: [] },
    lightFixtures: worldPointsToCells(fixturePositions, L3_OX, L3_OZ),
    itemCandidates: {
      "almond-water": computeItemCandidates(LEVEL_THREE_COLS, LEVEL_THREE_ROWS, l3IsOpen, l3CellCenter, [startCenter, targetCenter, generatorCenter]),
      "super-almond-water": computeItemCandidates(LEVEL_THREE_COLS, LEVEL_THREE_ROWS, l3IsOpen, l3CellCenter, [startCenter, targetCenter, generatorCenter]),
      flashlight: computeItemCandidates(LEVEL_THREE_COLS, LEVEL_THREE_ROWS, l3IsOpen, l3CellCenter, [startCenter, targetCenter, generatorCenter]),
      detector: computeItemCandidates(LEVEL_THREE_COLS, LEVEL_THREE_ROWS, l3IsOpen, l3CellCenter, [startCenter, targetCenter, generatorCenter]),
    },
    entityCandidates: {
      bacteria: withCellCoords(bacteriaCandidates, L3_OX, L3_OZ, CELL_SIZE),
      hound: withCellCoords(houndCandidates, L3_OX, L3_OZ, CELL_SIZE),
      "ambush-hound": ambushCenter ? [ambushCenter] : [],
    },
    interactions: [
      { id: "level-three-breaker", col: L3_TARGET.col, row: L3_TARGET.row, label: "BREAKER" },
      { id: "level-three-generator", col: 7, row: 8, label: "GENERATOR" },
    ],
  };
}

function buildLevel4() {
  const grid = buildGrid(LEVEL_ONE_MAP);
  const startCenter = l1CellCenter(L1_START.col, L1_START.row);
  const targetCenter = l1CellCenter(L1_TARGET.col, L1_TARGET.row);
  const bacteriaCandidates = chooseBacteriaSpawn({
    cols: LEVEL_ONE_COLS,
    rows: LEVEL_ONE_ROWS,
    isCellOpen: l1IsOpen,
    getCellCenter: l1CellCenter,
    targetPosition: targetCenter,
    spawnPosition: startCenter,
  });
  return {
    level: 4,
    label: "LEVEL 4",
    name: "ABANDONED OFFICE",
    cols: LEVEL_ONE_COLS,
    rows: LEVEL_ONE_ROWS,
    originX: L1_OX,
    originZ: L1_OZ,
    cellSize: CELL_SIZE,
    grid,
    floorColors: computeFloorColors(LEVEL_ONE_COLS, LEVEL_ONE_ROWS, [], LEVEL_ONE_DARK_ZONES, LEVEL_ONE_SUPPLY_ZONES),
    getCellType(col, row) {
      const ch = grid[row]?.[col];
      if (ch === "#") return "wall";
      return "open";
    },
    startCell: L1_START,
    targetCell: L1_TARGET,
    zones: { bright: [], dark: LEVEL_ONE_DARK_ZONES, supply: LEVEL_ONE_SUPPLY_ZONES },
    fixedProps: { pillars: [], blocks: [], bulkheads: [], cubicles: L4_CUBICLES, vending: L4_VENDING, windows: L4_WINDOWS, signs: L4_SIGNS },
    lightFixtures: [],
    itemCandidates: {
      "almond-water": computeItemCandidates(LEVEL_ONE_COLS, LEVEL_ONE_ROWS, l1IsOpen, l1CellCenter, [startCenter, targetCenter]),
      "super-almond-water": computeItemCandidates(LEVEL_ONE_COLS, LEVEL_ONE_ROWS, l1IsOpen, l1CellCenter, [startCenter, targetCenter]),
      flashlight: computeItemCandidates(LEVEL_ONE_COLS, LEVEL_ONE_ROWS, l1IsOpen, l1CellCenter, [startCenter, targetCenter]),
      detector: computeItemCandidates(LEVEL_ONE_COLS, LEVEL_ONE_ROWS, l1IsOpen, l1CellCenter, [startCenter, targetCenter]),
    },
    entityCandidates: {
      bacteria: [],
      hound: withCellCoords(bacteriaCandidates, L1_OX, L1_OZ, CELL_SIZE),
      "ambush-hound": [],
    },
    interactions: [
      { id: "level-four-stair-door", col: L1_TARGET.col, row: L1_TARGET.row, label: "STAIR DOOR" },
      { id: "level-four-terminal", col: 15, row: 18, label: "TERMINAL" },
      { id: "level-four-files", col: 27, row: 13, label: "FILES" },
      { id: "level-four-vending", col: 4, row: 6, label: "VENDING" },
      { id: "level-four-water-cooler", col: 29, row: 6, label: "WATER" },
    ],
  };
}

function buildLevel5() {
  const grid = buildGrid(LEVEL_FIVE_MAP);
  const startCenter = l5CellCenter(L5_START.col, L5_START.row);
  const targetCenter = l5CellCenter(L5_TARGET.col, L5_TARGET.row);
  const houndCandidates = chooseBacteriaSpawn({
    cols: LEVEL_FIVE_COLS,
    rows: LEVEL_FIVE_ROWS,
    isCellOpen: l5IsOpen,
    getCellCenter: l5CellCenter,
    targetPosition: targetCenter,
    spawnPosition: startCenter,
  });
  const { fixturePositions } = collectLevelFiveTransforms();
  return {
    level: 5,
    label: "LEVEL 5",
    name: "TERROR HOTEL",
    cols: LEVEL_FIVE_COLS,
    rows: LEVEL_FIVE_ROWS,
    originX: L5_OX,
    originZ: L5_OZ,
    cellSize: CELL_SIZE,
    grid,
    floorColors: computeFloorColors(LEVEL_FIVE_COLS, LEVEL_FIVE_ROWS, [], LEVEL_FIVE_DARK_ZONES, LEVEL_FIVE_SUPPLY_ZONES),
    getCellType(col, row) {
      const ch = levelFiveCellType(col, row);
      if (ch === L5_WALL) return "wall";
      if (ch === L5_DOOR) return "door";
      if (ch === L5_BOILER) return "bulkhead";
      if (ch === L5_STAFF) return "valve";
      if (ch === L5_BALLROOM || ch === L5_OPEN) return "open";
      return "open";
    },
    startCell: L5_START,
    targetCell: L5_TARGET,
    zones: { bright: [], dark: LEVEL_FIVE_DARK_ZONES, supply: LEVEL_FIVE_SUPPLY_ZONES },
    fixedProps: {
      pillars: [],
      blocks: L5_FURNITURE,
      bulkheads: [],
      cubicles: [],
      vending: [],
      windows: L5_WINDOWS,
      signs: L5_SIGNS,
    },
    lightFixtures: worldPointsToCells(fixturePositions, L5_OX, L5_OZ, CELL_SIZE),
    itemCandidates: {
      "almond-water": computeItemCandidates(LEVEL_FIVE_COLS, LEVEL_FIVE_ROWS, l5IsOpen, l5CellCenter, [startCenter, targetCenter]),
      "super-almond-water": computeItemCandidates(LEVEL_FIVE_COLS, LEVEL_FIVE_ROWS, l5IsOpen, l5CellCenter, [startCenter, targetCenter]),
      flashlight: computeItemCandidates(LEVEL_FIVE_COLS, LEVEL_FIVE_ROWS, l5IsOpen, l5CellCenter, [startCenter, targetCenter]),
      detector: computeItemCandidates(LEVEL_FIVE_COLS, LEVEL_FIVE_ROWS, l5IsOpen, l5CellCenter, [startCenter, targetCenter]),
    },
    entityCandidates: {
      bacteria: [],
      hound: withCellCoords(houndCandidates, L5_OX, L5_OZ, CELL_SIZE),
      "ambush-hound": [],
    },
    interactions: [
      { id: "level-five-beverly-table", col: 21, row: 13, label: "TABLE" },
      { id: "level-five-dining-cart", col: 6, row: 21, label: "CART" },
      { id: "level-five-staff-door", col: 36, row: 17, label: "STAFF" },
      { id: "level-five-boiler-valve", col: 38, row: 22, label: "VALVE" },
      { id: "level-five-boiler-exit", col: L5_TARGET.col, row: L5_TARGET.row, label: "BOILER EXIT" },
    ],
  };
}

function buildSimpleLevel({ level, label, name, map, cols, rows, originX, originZ, startCell, targetCell, isOpen, cellCenter, smilers = [] }) {
  const grid = buildGrid(map);
  const startCenter = cellCenter(startCell.col, startCell.row);
  const targetCenter = cellCenter(targetCell.col, targetCell.row);
  return {
    level, label, name, cols, rows, originX, originZ, cellSize: CELL_SIZE, grid,
    floorColors: computeFloorColors(cols, rows, [], [], []),
    getCellType(col, row) { return grid[row]?.[col] === "#" ? "wall" : "open"; },
    startCell, targetCell, zones: { bright: [], dark: [], supply: [] },
    fixedProps: { pillars: [], blocks: [], bulkheads: [], cubicles: [], vending: [], windows: [], signs: [] },
    lightFixtures: [],
    itemCandidates: {
      "almond-water": computeItemCandidates(cols, rows, isOpen, cellCenter, [startCenter, targetCenter]),
      flashlight: computeItemCandidates(cols, rows, isOpen, cellCenter, [startCenter, targetCenter]),
      firesalt: level === 8 ? computeItemCandidates(cols, rows, isOpen, cellCenter, [startCenter, targetCenter]) : [],
    },
    entityCandidates: { bacteria: [], hound: [], "ambush-hound": [], smiler: smilers },
    interactions: [],
  };
}

const LEVELS = [
  buildLevel0(), buildLevel1(), buildLevel2(), buildLevel3(), buildLevel4(), buildLevel5(),
  buildSimpleLevel({ level: 8, label: "LEVEL 8", name: "CAVE SYSTEMS", map: LEVEL_EIGHT_MAP, cols: LEVEL_EIGHT_COLS, rows: LEVEL_EIGHT_ROWS, originX: L8_OX, originZ: L8_OZ, startCell: L8_START, targetCell: L8_TARGET, isOpen: l8IsOpen, cellCenter: l8CellCenter, smilers: [{ col: 38, row: 27 }, { col: 29, row: 17 }] }),
  buildSimpleLevel({ level: 37, label: "LEVEL 37", name: "SUBLIMITY", map: LEVEL_THIRTY_SEVEN_MAP, cols: LEVEL_THIRTY_SEVEN_COLS, rows: LEVEL_THIRTY_SEVEN_ROWS, originX: L37_OX, originZ: L37_OZ, startCell: L37_START, targetCell: L37_TARGET, isOpen: l37IsOpen, cellCenter: l37CellCenter }),
];

const ITEM_COLORS = {
  "almond-water": "#9be5b6",
  "super-almond-water": "#ffd863",
  flashlight: "#fff0a6",
  detector: "#9fd6ff",
  firesalt: "#ff7135",
};

const ENTITY_COLORS = {
  bacteria: "#ff5252",
  hound: "#ff8a3d",
  "ambush-hound": "#c44dff",
  smiler: "#eaffd5",
};

const PALETTE = {
  bg: "#0a0908",
  cellWall: "#3a322a",
  cellOpen: "#5a5a3a",
  cellDoor: "#3aa6c9",
  cellValve: "#e2873a",
  cellBulkhead: "#5a3a1f",
  cellBar: "#5a3a3a",
  diagFill: "#5a5a45",
  pillar: "#0a0a08",
  block: "#1a1a12",
  darkZone: "rgba(20,12,40,0.2)",
  brightZone: "rgba(255,220,120,0.18)",
  supplyZone: "rgba(120,200,255,0.18)",
  fixture: "#fff0a6",
  start: "#5dff8e",
  exit: "#ff5d5d",
  interaction: "#5ad1ff",
  pin: "#ff79c6",
};

const state = {
  currentLevelIndex: 0,
  seed: 1,
  showSeedPlacement: false,
  flags: {
    lights: false,
    itemCandidates: false,
    entityHeatmap: false,
    zones: true,
    fixedProps: true,
    interactions: true,
    startExit: true,
  },
  itemTint: { "almond-water": 0, "super-almond-water": 0, flashlight: 0, detector: 0 },
  entityTint: { bacteria: 0, hound: 0, "ambush-hound": 0 },
  view: { offsetX: 0, offsetY: 0, scale: 1 },
  hover: null,
  pins: [],
  dragging: null,
  press: null,
  minLightPriority: 0,
};

const DRAG_THRESHOLD_PX = 4;

const canvas = document.getElementById("map");
const ctx = canvas.getContext("2d");
let currentLevel = LEVELS[0];

function worldToScreen(x, z) {
  const cellX = (x - currentLevel.originX) / currentLevel.cellSize;
  const cellY = (z - currentLevel.originZ) / currentLevel.cellSize;
  return {
    x: cellX * state.view.scale + state.view.offsetX,
    y: cellY * state.view.scale + state.view.offsetY,
  };
}

function screenToWorld(sx, sy) {
  const cellX = (sx - state.view.offsetX) / state.view.scale;
  const cellY = (sy - state.view.offsetY) / state.view.scale;
  return {
    x: cellX * currentLevel.cellSize + currentLevel.originX,
    z: cellY * currentLevel.cellSize + currentLevel.originZ,
  };
}

function cellToScreen(col, row) {
  const cx = currentLevel.originX + col * currentLevel.cellSize + currentLevel.cellSize / 2;
  const cz = currentLevel.originZ + row * currentLevel.cellSize + currentLevel.cellSize / 2;
  return worldToScreen(cx, cz);
}

function drawZone(zone, color) {
  const { col, row, width, height } = zone;
  const px = currentLevel.cellSize * state.view.scale;
  const center = cellToScreen(col, row);
  const w = width * px;
  const h = height * px;
  ctx.fillStyle = color;
  ctx.fillRect(center.x - px / 2, center.y - px / 2, w, h);
}

function getMapBounds() {
  const px = currentLevel.cellSize * state.view.scale;
  return {
    x: state.view.offsetX,
    y: state.view.offsetY,
    w: currentLevel.cols * px,
    h: currentLevel.rows * px,
  };
}

function drawZones() {
  if (!state.flags.zones) return;
  const bounds = getMapBounds();
  ctx.save();
  ctx.beginPath();
  ctx.rect(bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.clip();
  currentLevel.zones.bright.forEach((z) => drawZone(z, PALETTE.brightZone));
  currentLevel.zones.supply.forEach((z) => drawZone(z, PALETTE.supplyZone));
  currentLevel.zones.dark.forEach((z) => drawZone(z, PALETTE.darkZone));
  ctx.restore();
}

function drawMapBoundary() {
  const bounds = getMapBounds();
  ctx.strokeStyle = "rgba(255,200,100,0.6)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(bounds.x + 0.5, bounds.y + 0.5, bounds.w - 1, bounds.h - 1);
  ctx.setLineDash([]);
}

function drawGrid() {
  const { cols, rows, cellSize, getCellType, floorColors } = currentLevel;
  const px = cellSize * state.view.scale;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const type = getCellType(col, row);
      const center = cellToScreen(col, row);
      if (type === "open" || type.startsWith("diag-")) {
        ctx.fillStyle = floorColors[row][col];
        ctx.fillRect(center.x - px / 2, center.y - px / 2, px, px);
        if (type.startsWith("diag-")) {
          ctx.strokeStyle = PALETTE.diagFill;
          ctx.lineWidth = Math.max(1, px * 0.12);
          const dirs = {
            "diag-wn": [
              [0, 0],
              [1, 0],
            ],
            "diag-en": [
              [0, 0],
              [1, 1],
            ],
            "diag-es": [
              [0, 1],
              [1, 1],
            ],
            "diag-ws": [
              [0, 0],
              [0, 1],
            ],
          };
          const d = dirs[type];
          ctx.beginPath();
          ctx.moveTo(center.x - px / 2 + d[0][0] * px, center.y - px / 2 + d[0][1] * px);
          ctx.lineTo(center.x - px / 2 + d[1][0] * px, center.y - px / 2 + d[1][1] * px);
          ctx.stroke();
        }
      } else if (type === "wall") {
        ctx.fillStyle = PALETTE.cellWall;
        ctx.fillRect(center.x - px / 2, center.y - px / 2, px, px);
      } else if (type === "door") {
        ctx.fillStyle = floorColors[row][col];
        ctx.fillRect(center.x - px / 2, center.y - px / 2, px, px);
        ctx.fillStyle = PALETTE.cellDoor;
        ctx.fillRect(center.x - px / 2, center.y - px / 2, px, px * 0.5);
      } else if (type === "valve") {
        ctx.fillStyle = floorColors[row][col];
        ctx.fillRect(center.x - px / 2, center.y - px / 2, px, px);
        ctx.fillStyle = PALETTE.cellValve;
        ctx.beginPath();
        ctx.arc(center.x, center.y, px * 0.32, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === "bulkhead") {
        ctx.fillStyle = PALETTE.cellBulkhead;
        ctx.fillRect(center.x - px / 2, center.y - px / 2, px, px);
      } else if (type === "bar") {
        ctx.fillStyle = floorColors[row][col];
        ctx.fillRect(center.x - px / 2, center.y - px / 2, px, px);
        ctx.fillStyle = PALETTE.cellBar;
        for (let i = 0; i < 4; i += 1) {
          ctx.fillRect(
            center.x - px / 2 + (i * px) / 4 + px * 0.05,
            center.y - px / 2,
            px * 0.12,
            px,
          );
        }
      }
    }
  }
}

function drawFixedProps() {
  if (!state.flags.fixedProps) return;
  const px = currentLevel.cellSize * state.view.scale;
  const fp = currentLevel.fixedProps;
  fp.pillars.forEach(({ col, row }) => {
    const c = cellToScreen(col, row);
    ctx.fillStyle = PALETTE.pillar;
    ctx.fillRect(c.x - px / 2, c.y - px / 2, px, px);
  });
  fp.blocks.forEach((b) => {
    const c = cellToScreen(b.col, b.row);
    ctx.fillStyle = PALETTE.block;
    ctx.fillRect(
      c.x - (b.width * px) / 2,
      c.y - (b.height * px) / 2,
      b.width * px,
      b.height * px,
    );
  });
  fp.bulkheads.forEach(({ col, row }) => {
    const c = cellToScreen(col, row);
    ctx.fillStyle = PALETTE.cellBulkhead;
    ctx.fillRect(c.x - px / 2, c.y - px / 2, px, px);
  });
  fp.bars?.forEach(({ col, row }) => {
    const c = cellToScreen(col, row);
    ctx.fillStyle = PALETTE.cellOpen;
    ctx.fillRect(c.x - px / 2, c.y - px / 2, px, px);
    ctx.fillStyle = PALETTE.cellBar;
    for (let i = 0; i < 4; i += 1) {
      ctx.fillRect(
        c.x - px / 2 + (i * px) / 4 + px * 0.05,
        c.y - px / 2,
        px * 0.12,
        px,
      );
    }
  });
  fp.cubicles.forEach(({ col, row }) => {
    const c = cellToScreen(col, row);
    ctx.fillStyle = "rgba(150,160,170,0.55)";
    ctx.fillRect(c.x - px, c.y - px * 0.6, px * 2, px * 1.2);
  });
  fp.vending.forEach((v) => {
    const c = cellToScreen(v.col, v.row);
    ctx.fillStyle = v.id.includes("water") ? "#7fcce0" : "#3aa6c9";
    ctx.fillRect(c.x - px * 0.3, c.y - px * 0.3, px * 0.6, px * 0.6);
  });
  fp.windows.forEach(({ col, row }) => {
    const c = cellToScreen(col, row);
    ctx.strokeStyle = "#aaccff";
    ctx.lineWidth = Math.max(1, px * 0.12);
    ctx.strokeRect(c.x - px * 0.4, c.y - px * 0.4, px * 0.8, px * 0.8);
  });
  fp.signs.forEach(({ col, row, text }) => {
    const c = cellToScreen(col, row);
    ctx.fillStyle = "#fff0a6";
    ctx.font = `${Math.max(9, px * 0.32)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, c.x, c.y);
  });
}

function drawLightFixtures() {
  if (!state.flags.lights) return;
  const px = currentLevel.cellSize * state.view.scale;
  const minPriority = state.minLightPriority ?? 0;
  const baseR = Math.max(0.4, px * 0.05);
  currentLevel.lightFixtures.forEach((f) => {
    if ((f.priority ?? 0) < minPriority) return;
    const c = cellToScreen(f.col, f.row);
    if (px >= 18) {
      const glowR = Math.max(2, px * 0.18);
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, glowR);
      g.addColorStop(0, "rgba(255,240,166,0.3)");
      g.addColorStop(1, "rgba(255,240,166,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c.x, c.y, glowR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.fixture;
    ctx.beginPath();
    ctx.arc(c.x, c.y, baseR, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawItemCandidates() {
  if (!state.flags.itemCandidates) return;
  const { cols, rows, cellSize, getCellType } = currentLevel;
  const px = cellSize * state.view.scale;
  const tint = state.itemTint;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (getCellType(col, row) !== "open") continue;
      const tints = [];
      if (tint["almond-water"] && currentLevel.itemCandidates["almond-water"].some((c) => c.col === col && c.row === row)) {
        tints.push(ITEM_COLORS["almond-water"]);
      }
      if (tint["super-almond-water"] && currentLevel.itemCandidates["super-almond-water"].some((c) => c.col === col && c.row === row)) {
        tints.push(ITEM_COLORS["super-almond-water"]);
      }
      if (tint.flashlight && currentLevel.itemCandidates.flashlight.some((c) => c.col === col && c.row === row)) {
        tints.push(ITEM_COLORS.flashlight);
      }
      if (tint.detector && currentLevel.itemCandidates.detector.some((c) => c.col === col && c.row === row)) {
        tints.push(ITEM_COLORS.detector);
      }
      if (tints.length === 0) continue;
      const c = cellToScreen(col, row);
      if (tints.length === 1) {
        ctx.fillStyle = hexToRgba(tints[0], 0.18);
      } else {
        const grad = ctx.createLinearGradient(c.x - px / 2, c.y - px / 2, c.x + px / 2, c.y + px / 2);
        tints.forEach((color, i) => {
          grad.addColorStop(i / tints.length, hexToRgba(color, 0.18));
          grad.addColorStop((i + 1) / tints.length, hexToRgba(color, 0.18));
        });
        ctx.fillStyle = grad;
      }
      ctx.fillRect(c.x - px / 2, c.y - px / 2, px, px);
    }
  }
}

function drawItemPlacement() {
  if (!state.showSeedPlacement) return;
  const px = currentLevel.cellSize * state.view.scale;
  const placements = simulateItems(currentLevel, state.seed);
  for (const [itemId, placement] of Object.entries(placements)) {
    if (!placement) continue;
    const color = ITEM_COLORS[itemId];
    const c = cellToScreen(placement.col, placement.row);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(c.x, c.y, px * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawEntityHeatmap() {
  const { cols, rows, cellSize, getCellType } = currentLevel;
  const px = cellSize * state.view.scale;
  const tint = state.entityTint;
  const entries = [
    { id: "bacteria", color: ENTITY_COLORS.bacteria, list: currentLevel.entityCandidates.bacteria },
    { id: "hound", color: ENTITY_COLORS.hound, list: currentLevel.entityCandidates.hound },
    { id: "ambush-hound", color: ENTITY_COLORS["ambush-hound"], list: currentLevel.entityCandidates["ambush-hound"] },
  ].filter((e) => tint[e.id] && e.list.length > 0);
  if (entries.length === 0) return;

  const scoreByCell = new Map();
  for (const e of entries) {
    e.list.forEach((cand, i) => {
      if (i >= 30) return;
      const factor = 1 - i / 30;
      const alpha = 0.1 + 0.18 * factor;
      const key = `${cand.col},${cand.row}`;
      const existing = scoreByCell.get(key) || { colors: [], maxAlpha: 0 };
      existing.colors.push({ color: e.color, alpha });
      existing.maxAlpha = Math.max(existing.maxAlpha, alpha);
      scoreByCell.set(key, existing);
    });
  }
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (getCellType(col, row) !== "open") continue;
      const data = scoreByCell.get(`${col},${row}`);
      if (!data) continue;
      const c = cellToScreen(col, row);
      if (data.colors.length === 1) {
        ctx.fillStyle = hexToRgba(data.colors[0].color, data.colors[0].alpha);
        ctx.fillRect(c.x - px / 2, c.y - px / 2, px, px);
      } else {
        const grad = ctx.createLinearGradient(c.x - px / 2, c.y - px / 2, c.x + px / 2, c.y + px / 2);
        data.colors.forEach((entry, i) => {
          grad.addColorStop(i / data.colors.length, hexToRgba(entry.color, entry.alpha));
          grad.addColorStop((i + 1) / data.colors.length, hexToRgba(entry.color, entry.alpha));
        });
        ctx.fillStyle = grad;
        ctx.fillRect(c.x - px / 2, c.y - px / 2, px, px);
      }
    }
  }
  for (const e of entries) {
    const top = e.list[0];
    if (!top) continue;
    const c = cellToScreen(top.col, top.row);
    ctx.strokeStyle = e.color;
    ctx.lineWidth = Math.max(1.5, px * 0.1);
    ctx.beginPath();
    ctx.arc(c.x, c.y, Math.max(3, px * 0.35), 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawInteractions() {
  if (!state.flags.interactions) return;
  const px = currentLevel.cellSize * state.view.scale;
  currentLevel.interactions.forEach((it) => {
    const c = cellToScreen(it.col, it.row);
    ctx.fillStyle = PALETTE.interaction;
    ctx.beginPath();
    const r = px * 0.36;
    ctx.moveTo(c.x, c.y - r);
    ctx.lineTo(c.x + r, c.y);
    ctx.lineTo(c.x, c.y + r);
    ctx.lineTo(c.x - r, c.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.font = `bold ${Math.max(9, px * 0.3)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("E", c.x, c.y);
  });
}

function drawStartExit() {
  if (!state.flags.startExit) return;
  const px = currentLevel.cellSize * state.view.scale;
  const s = cellToScreen(currentLevel.startCell.col, currentLevel.startCell.row);
  ctx.fillStyle = PALETTE.start;
  ctx.beginPath();
  ctx.arc(s.x, s.y, px * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.font = `bold ${Math.max(10, px * 0.36)}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("S", s.x, s.y);

  const t = cellToScreen(currentLevel.targetCell.col, currentLevel.targetCell.row);
  ctx.fillStyle = PALETTE.exit;
  ctx.beginPath();
  ctx.arc(t.x, t.y, px * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.fillText("E", t.x, t.y);
}

function drawPins() {
  const px = currentLevel.cellSize * state.view.scale;
  state.pins.forEach((pin, i) => {
    if (pin.level !== state.currentLevelIndex) return;
    const c = cellToScreen(pin.col, pin.row);
    ctx.fillStyle = PALETTE.pin;
    ctx.beginPath();
    ctx.arc(c.x, c.y, px * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.font = `bold ${Math.max(9, px * 0.28)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), c.x, c.y);
  });
}

function drawHover() {
  if (!state.hover) return;
  const px = currentLevel.cellSize * state.view.scale;
  const c = cellToScreen(state.hover.col, state.hover.row);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(c.x - px / 2, c.y - px / 2, px, px);
}

function drawGridLines() {
  if (state.view.scale < 4) return;
  const px = currentLevel.cellSize * state.view.scale;
  ctx.strokeStyle = state.view.scale < 8 ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let col = 0; col <= currentLevel.cols; col += 1) {
    const c = cellToScreen(col, 0);
    const z = cellToScreen(col, currentLevel.rows);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - px / 2);
    ctx.lineTo(z.x, z.y + px / 2);
    ctx.stroke();
  }
  for (let row = 0; row <= currentLevel.rows; row += 1) {
    const c = cellToScreen(0, row);
    const z = cellToScreen(currentLevel.cols, row);
    ctx.beginPath();
    ctx.moveTo(c.x - px / 2, c.y);
    ctx.lineTo(z.x + px / 2, z.y);
    ctx.stroke();
  }
}

function drawCompass() {
  const margin = 16;
  const size = 50;
  const cx = canvas.clientWidth - margin - size / 2;
  const cy = margin + size / 2;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
  ctx.strokeStyle = "#7d7868";
  ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);
  ctx.fillStyle = "#d8d4c2";
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("+Z", cx, cy - 14);
  ctx.fillText("-Z", cx, cy + 14);
  ctx.fillText("-X", cx - 14, cy);
  ctx.fillText("+X", cx + 14, cy);
}

function render() {
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  drawGrid();
  drawEntityHeatmap();
  drawStartExit();
  drawPins();
  drawHover();
}

function hexToRgba(hex, alpha) {
  const m = hex.replace("#", "").match(/.{1,2}/g);
  if (!m) return `rgba(255,255,255,${alpha})`;
  const [r, g, b] = m.map((x) => parseInt(x, 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

function fitView() {
  const drawW = currentLevel.cols * currentLevel.cellSize;
  const drawH = currentLevel.rows * currentLevel.cellSize;
  const targetScale = Math.min(
    (canvas.clientWidth - 40) / drawW,
    (canvas.clientHeight - 40) / drawH,
  );
  state.view.scale = Math.max(2, targetScale);
  const actualW = drawW * state.view.scale;
  const actualH = drawH * state.view.scale;
  state.view.offsetX = (canvas.clientWidth - actualW) / 2;
  state.view.offsetY = (canvas.clientHeight - actualH) / 2;
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fitView();
  render();
}

function getCellAtPointer(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const w = screenToWorld(sx, sy);
  const col = Math.floor((w.x - currentLevel.originX) / currentLevel.cellSize);
  const row = Math.floor((w.z - currentLevel.originZ) / currentLevel.cellSize);
  if (col < 0 || col >= currentLevel.cols || row < 0 || row >= currentLevel.rows) return null;
  return { col, row, x: w.x, z: w.z };
}

canvas.addEventListener("mousemove", (e) => {
  if (state.dragging) {
    state.view.offsetX += e.clientX - state.dragging.lastX;
    state.view.offsetY += e.clientY - state.dragging.lastY;
    state.dragging.lastX = e.clientX;
    state.dragging.lastY = e.clientY;
    render();
    return;
  }
  if (state.press && !state.press.isDragging) {
    const dx = e.clientX - state.press.startX;
    const dy = e.clientY - state.press.startY;
    if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
      state.press.isDragging = true;
      state.dragging = { lastX: e.clientX, lastY: e.clientY };
      canvas.style.cursor = "grabbing";
    }
  }
  const cell = getCellAtPointer(e);
  state.hover = cell;
  if (cell) {
    const type = currentLevel.getCellType(cell.col, cell.row);
    document.getElementById("hover-info").textContent =
      `col=${cell.col}  row=${cell.row}  type=${type}  x=${cell.x.toFixed(2)}  z=${cell.z.toFixed(2)}`;
  } else {
    document.getElementById("hover-info").textContent = "—";
  }
  render();
});

canvas.addEventListener("mouseleave", () => {
  state.hover = null;
  document.getElementById("hover-info").textContent = "—";
  render();
});

canvas.addEventListener("mousedown", (e) => {
  if (e.button === 1 || e.button === 2) {
    state.press = {
      startX: e.clientX,
      startY: e.clientY,
      isLeft: false,
      isDragging: true,
      cell: getCellAtPointer(e),
    };
    state.dragging = { lastX: e.clientX, lastY: e.clientY };
    canvas.style.cursor = "grabbing";
    e.preventDefault();
  } else if (e.button === 0) {
    state.press = {
      startX: e.clientX,
      startY: e.clientY,
      isLeft: true,
      isDragging: false,
      cell: getCellAtPointer(e),
    };
  }
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener("mouseup", (e) => {
  const wasDragging = !!state.dragging;
  const wasPress = state.press;
  state.dragging = null;
  state.press = null;
  canvas.style.cursor = "crosshair";
  if (wasDragging) return;
  if (wasPress && wasPress.isLeft && !wasPress.isDragging && e.button === 0 && wasPress.cell) {
    const cell = wasPress.cell;
    const note = window.prompt(`Pin at (${cell.col}, ${cell.row})? Enter note (optional):`);
    if (note !== null) {
      state.pins.push({
        level: state.currentLevelIndex,
        col: cell.col,
        row: cell.row,
        note: note || "",
      });
      render();
    }
  }
});

canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newScale = Math.max(2, Math.min(60, state.view.scale * factor));
    const cellX = (sx - state.view.offsetX) / state.view.scale;
    const cellY = (sy - state.view.offsetY) / state.view.scale;
    state.view.scale = newScale;
    state.view.offsetX = sx - cellX * newScale;
    state.view.offsetY = sy - cellY * newScale;
    render();
  },
  { passive: false },
);

function switchLevel(index) {
  state.currentLevelIndex = index;
  currentLevel = LEVELS[index];
  document.querySelectorAll(".tab").forEach((t, i) => {
    t.classList.toggle("is-active", i === index);
  });
  document.getElementById("level-title").textContent = `${currentLevel.label} — ${currentLevel.name}`;
  document.getElementById("level-meta").textContent =
    `cols × rows = ${currentLevel.cols} × ${currentLevel.rows}  ·  cell = ${currentLevel.cellSize}m  ·  start (${currentLevel.startCell.col},${currentLevel.startCell.row})  ·  target (${currentLevel.targetCell.col},${currentLevel.targetCell.row})`;
  state.entityTint = { bacteria: 0, hound: 0, "ambush-hound": 0 };
  buildEntityTints();
  fitView();
  render();
}

function buildTabs() {
  const tabs = document.getElementById("tabs");
  LEVELS.forEach((lv, i) => {
    const btn = document.createElement("button");
    btn.className = "tab" + (i === 0 ? " is-active" : "");
    btn.textContent = lv.label;
    btn.title = lv.name;
    btn.addEventListener("click", () => switchLevel(i));
    tabs.appendChild(btn);
  });
}

function buildCheckboxes() {
  const flagsEl = document.getElementById("flags");
  const labels = {
    lights: "灯位 (lights)",
    itemCandidates: "道具候选格 · 勾子,再选下面要看的道具",
    entityHeatmap: "实体热力图 · 勾子,再选下面要看的实体",
    zones: "区域叠加 (zones)",
    fixedProps: "固定道具 (fixed props)",
    interactions: "交互点 (interactions)",
    startExit: "起始/出口 (start/exit)",
  };
  for (const [key, label] of Object.entries(labels)) {
    const wrap = document.createElement("label");
    wrap.className = "flag";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = state.flags[key];
    cb.addEventListener("change", () => {
      state.flags[key] = cb.checked;
      render();
    });
    wrap.appendChild(cb);
    const span = document.createElement("span");
    span.textContent = label;
    wrap.appendChild(span);
    flagsEl.appendChild(wrap);
  }
}

function buildEntityTints() {
  const entityEl = document.getElementById("entity-tints");
  if (!entityEl) return;
  entityEl.innerHTML = "";
  const entityDefs = [
    { id: "bacteria", label: "Bacteria" },
    { id: "hound", label: "Hound" },
    { id: "ambush-hound", label: "Ambush hound" },
    { id: "smiler", label: "Smiler" },
  ];
  for (const def of entityDefs) {
    const count = currentLevel.entityCandidates[def.id]?.length ?? 0;
    const wrap = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.disabled = count === 0;
    cb.addEventListener("change", () => {
      state.entityTint[def.id] = cb.checked ? 1 : 0;
      render();
    });
    wrap.appendChild(cb);
    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = ENTITY_COLORS[def.id];
    sw.style.opacity = count === 0 ? "0.25" : "1";
    wrap.appendChild(sw);
    const text = document.createElement("span");
    text.textContent = `${def.label} (${count})`;
    text.style.opacity = count === 0 ? "0.4" : "1";
    wrap.appendChild(text);
    entityEl.appendChild(wrap);
  }
}

function buildSeedControls() {
  const seedInput = document.getElementById("seed-input");
  seedInput.value = String(state.seed);
  document.getElementById("seed-apply").addEventListener("click", () => {
    const v = parseInt(seedInput.value, 10);
    if (Number.isFinite(v)) {
      state.seed = v;
      document.getElementById("seed-info").textContent = `seed = ${v}`;
      if (state.showSeedPlacement) render();
    }
  });
  const toggleBtn = document.getElementById("seed-toggle");
  toggleBtn.addEventListener("click", () => {
    state.showSeedPlacement = !state.showSeedPlacement;
    toggleBtn.classList.toggle("is-on", state.showSeedPlacement);
    toggleBtn.textContent = state.showSeedPlacement ? "已开启 (ON)" : "已关闭 (OFF)";
    render();
  });
}

function buildLegend() {
  const items = [
    { color: PALETTE.cellWall, label: "Wall" },
    { color: FLOOR_BASE, label: "Floor (normal)" },
    { color: FLOOR_BRIGHT, label: "Floor (bright zone)" },
    { color: FLOOR_DARK, label: "Floor (dark zone)" },
    { color: FLOOR_SUPPLY, label: "Floor (supply zone)" },
    { color: PALETTE.cellDoor, label: "Door" },
    { color: PALETTE.cellValve, label: "Valve" },
    { color: PALETTE.cellBulkhead, label: "Bulkhead" },
    { color: PALETTE.cellBar, label: "Indestructible bar" },
    { color: ENTITY_COLORS.bacteria, label: "Bacteria spawn" },
    { color: ENTITY_COLORS.hound, label: "Hound spawn" },
    { color: ENTITY_COLORS["ambush-hound"], label: "Ambush hound" },
    { color: ENTITY_COLORS.smiler, label: "Smiler" },
    { color: PALETTE.start, label: "Start" },
    { color: PALETTE.exit, label: "Target / Exit" },
    { color: PALETTE.pin, label: "Pin" },
  ];
  const el = document.getElementById("legend");
  items.forEach((it) => {
    const wrap = document.createElement("div");
    wrap.className = "legend-item";
    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = it.color;
    wrap.appendChild(sw);
    const text = document.createElement("span");
    text.textContent = it.label;
    wrap.appendChild(text);
    el.appendChild(wrap);
  });
}

function bindReset() {
  document.getElementById("reset-view").addEventListener("click", () => {
    fitView();
    render();
  });
  document.getElementById("clear-pins").addEventListener("click", () => {
    state.pins = state.pins.filter((p) => p.level !== state.currentLevelIndex);
    render();
  });
  document.getElementById("export-svg").addEventListener("click", () => {
    const cell = 20;
    const w = currentLevel.cols * cell;
    const h = currentLevel.rows * cell;
    const lines = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
      `<rect width="100%" height="100%" fill="${PALETTE.bg}"/>`,
    ];
    for (let row = 0; row < currentLevel.rows; row += 1) {
      for (let col = 0; col < currentLevel.cols; col += 1) {
        const t = currentLevel.getCellType(col, row);
        const x = col * cell;
        const y = row * cell;
        if (t === "open" || t.startsWith("diag-")) {
          lines.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${PALETTE.cellOpen}"/>`);
        } else if (t === "wall") {
          lines.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${PALETTE.cellWall}"/>`);
        } else if (t === "door") {
          lines.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${PALETTE.cellOpen}"/>`);
          lines.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell / 2}" fill="${PALETTE.cellDoor}"/>`);
        } else if (t === "valve") {
          lines.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${PALETTE.cellOpen}"/>`);
          lines.push(`<circle cx="${x + cell / 2}" cy="${y + cell / 2}" r="${cell * 0.32}" fill="${PALETTE.cellValve}"/>`);
        } else if (t === "bulkhead") {
          lines.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${PALETTE.cellBulkhead}"/>`);
        } else if (t === "bar") {
          lines.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${PALETTE.cellOpen}"/>`);
          for (let i = 0; i < 4; i += 1) {
            lines.push(
              `<rect x="${x + (i * cell) / 4 + cell * 0.05}" y="${y}" width="${cell * 0.12}" height="${cell}" fill="${PALETTE.cellBar}"/>`,
            );
          }
        }
      }
    }
    lines.push("</svg>");
    const blob = new Blob([lines.join("")], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentLevel.label.replace(/\s+/g, "_")}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function init() {
  buildTabs();
  buildEntityTints();
  buildLegend();
  bindReset();
  switchLevel(0);
  window.addEventListener("resize", resize);
  resize();
}

init();
