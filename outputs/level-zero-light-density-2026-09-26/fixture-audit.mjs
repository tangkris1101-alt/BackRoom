import { COLS, ROWS, isOpenCell, cellCenter } from "../../src/scene/level-zero/layout.js";
import { collectWallTransforms } from "../../src/scene/level-zero/world.js";
import { CELL_SIZE } from "../../src/scene/constants.js";

const { fixturePositions } = collectWallTransforms();
let open = 0;
for (let row = 0; row < ROWS; row += 1) {
  for (let col = 0; col < COLS; col += 1) if (isOpenCell(col, row)) open += 1;
}

// nearest-neighbour distance for every fixture
const nearest = fixturePositions.map((fixture, index) => {
  let best = Infinity;
  fixturePositions.forEach((other, otherIndex) => {
    if (otherIndex === index) return;
    best = Math.min(best, Math.hypot(fixture.x - other.x, fixture.z - other.z));
  });
  return best;
}).sort((a, b) => a - b);

const quantile = (values, q) => values[Math.min(values.length - 1, Math.floor(values.length * q))];
const areaM2 = open * CELL_SIZE * CELL_SIZE;
console.log(JSON.stringify({
  grid: { COLS, ROWS, openCells: open, cellSize: CELL_SIZE },
  levelAreaM2: Math.round(areaM2),
  fixtures: fixturePositions.length,
  fixturesPer100m2: Number((fixturePositions.length / areaM2 * 100).toFixed(2)),
  openCellsPerFixture: Number((open / fixturePositions.length).toFixed(2)),
  meanSpacingIfUniformM: Number(Math.sqrt(areaM2 / fixturePositions.length).toFixed(2)),
  nearest: {
    min: Number(nearest[0].toFixed(2)),
    p10: Number(quantile(nearest, 0.1).toFixed(2)),
    median: Number(quantile(nearest, 0.5).toFixed(2)),
    p90: Number(quantile(nearest, 0.9).toFixed(2)),
    max: Number(nearest[nearest.length - 1].toFixed(2)),
  },
  within6m: nearest.filter((d) => d < 6).length,
  within8m: nearest.filter((d) => d < 8).length,
}, null, 1));

// ASCII map: F = fixture cell, . = open, # = wall
const fixtureCells = new Set(fixturePositions.map((f) => {
  const col = Math.round((f.x - cellCenter(0, 0).x) / CELL_SIZE);
  const row = Math.round((f.z - cellCenter(0, 0).z) / CELL_SIZE);
  return `${col},${row}`;
}));
const lines = [];
for (let row = 0; row < ROWS; row += 1) {
  let line = "";
  for (let col = 0; col < COLS; col += 1) {
    if (!isOpenCell(col, row)) line += "#";
    else line += fixtureCells.has(`${col},${row}`) ? "F" : ".";
  }
  lines.push(line);
}
console.log(lines.join("\n"));

// 覆盖度：每个开放格到最近灯具的距离（判断有没有"完全没灯"的区域）
const coverage = [];
for (let row = 0; row < ROWS; row += 1) {
  for (let col = 0; col < COLS; col += 1) {
    if (!isOpenCell(col, row)) continue;
    const center = cellCenter(col, row);
    let best = Infinity;
    for (const fixture of fixturePositions) {
      best = Math.min(best, Math.hypot(fixture.x - center.x, fixture.z - center.z));
    }
    coverage.push(best);
  }
}
coverage.sort((a, b) => a - b);
const cov = (q) => Number(quantile(coverage, q).toFixed(1));
console.log("coverage(open cell -> nearest fixture) m:", JSON.stringify({
  median: cov(0.5), p90: cov(0.9), p99: cov(0.99), max: cov(1),
  cellsOver16m: coverage.filter((d) => d > 16).length,
  cellsOver20m: coverage.filter((d) => d > 20).length,
}));
