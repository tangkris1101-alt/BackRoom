import { CELL_SIZE } from "../constants.js";

export const LEVEL_ELEVEN_COLS = 60;
export const LEVEL_ELEVEN_ROWS = 48;
export const LEVEL_ELEVEN_START_CELL = { col: 29, row: 44, yaw: 0 };
export const LEVEL_ELEVEN_BACKROAD_CELL = { col: 2, row: 37 };
export const LEVEL_ELEVEN_POOL_EXIT_CELL = { col: 55, row: 9 };
export const LEVEL_ELEVEN_ORIGIN_X = -(LEVEL_ELEVEN_COLS * CELL_SIZE) / 2;
export const LEVEL_ELEVEN_ORIGIN_Z = -(LEVEL_ELEVEN_ROWS * CELL_SIZE) / 2;

function isRoadBand(col, row) {
  return (col >= 9 && col <= 12) || (col >= 27 && col <= 30) || (col >= 45 && col <= 48)
    || (row >= 8 && row <= 11) || (row >= 22 && row <= 25) || (row >= 36 && row <= 39);
}

function isSidewalkBand(col, row) {
  return (col >= 8 && col <= 13) || (col >= 26 && col <= 31) || (col >= 44 && col <= 49)
    || (row >= 7 && row <= 12) || (row >= 21 && row <= 26) || (row >= 35 && row <= 40);
}

function isPoolLobby(col, row) {
  return col >= 49 && col <= 56 && row >= 5 && row <= 12;
}

function isPlaza(col, row) {
  return col >= 32 && col <= 42 && row >= 13 && row <= 21;
}

export function isLevelElevenOpenCell(col, row) {
  if (row <= 0 || row >= LEVEL_ELEVEN_ROWS - 1 || col <= 0 || col >= LEVEL_ELEVEN_COLS - 1) return false;
  return isSidewalkBand(col, row) || isPoolLobby(col, row) || isPlaza(col, row);
}

export function isLevelElevenRoadCell(col, row) {
  return isLevelElevenOpenCell(col, row) && isRoadBand(col, row) && !isPoolLobby(col, row);
}

export function levelElevenCellCenter(col, row) {
  return {
    x: LEVEL_ELEVEN_ORIGIN_X + col * CELL_SIZE + CELL_SIZE / 2,
    z: LEVEL_ELEVEN_ORIGIN_Z + row * CELL_SIZE + CELL_SIZE / 2,
  };
}

export function levelElevenWorldToCell(x, z) {
  return {
    col: Math.floor((x - LEVEL_ELEVEN_ORIGIN_X) / CELL_SIZE),
    row: Math.floor((z - LEVEL_ELEVEN_ORIGIN_Z) / CELL_SIZE),
  };
}

export const LEVEL_ELEVEN_HOUND_PATROL_CELLS = Object.freeze([
  { col: 29, row: 34 },
  { col: 45, row: 37 },
  { col: 46, row: 23 },
  { col: 29, row: 23 },
]);
