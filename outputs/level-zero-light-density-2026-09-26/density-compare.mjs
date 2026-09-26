// 对比 ed387ba 前后两套灯具布点规则的产出密度（不渲染，仅复算规则）
import { COLS, ROWS, isOpenCell, cellCenter } from "../../src/scene/level-zero/layout.js";
import { BRIGHT_ZONES, DARK_ZONES } from "../../src/scene/level-zero/world.js";
import { isInAnyZone } from "../../src/scene/common/layout.js";
import { CELL_SIZE } from "../../src/scene/constants.js";
import { countOpenNeighbors } from "../../src/scene/level-zero/layout.js";

const cells = [];
let open = 0;
for (let row = 0; row < ROWS; row += 1) {
  for (let col = 0; col < COLS; col += 1) {
    if (!isOpenCell(col, row)) continue;
    open += 1;
    cells.push({
      col, row, center: cellCenter(col, row),
      bright: isInAnyZone(col, row, BRIGHT_ZONES),
      dark: isInAnyZone(col, row, DARK_ZONES),
      spacious: countOpenNeighbors(col, row) >= 3,
      horizontal: isOpenCell(col - 1, row) && isOpenCell(col + 1, row),
      vertical: isOpenCell(col, row - 1) && isOpenCell(col, row + 1),
    });
  }
}

function current(cell) {
  const corridorCenter = !cell.spacious && (cell.horizontal || cell.vertical);
  const fixtureGrid = cell.spacious
    ? cell.col % 2 === 1 && cell.row % 2 === 1
    : cell.horizontal ? cell.col % 2 === 1 : cell.row % 2 === 1;
  return fixtureGrid && ((cell.dark && (Math.floor(cell.col / 5) + Math.floor(cell.row / 5)) % 2 === 0)
    || (!cell.dark && (cell.spacious || corridorCenter)));
}

function legacy(cell) {
  const roomFixtureGrid = cell.col % 6 === 3 && cell.row % 4 === 1;
  const brightFixtureGrid = cell.col % 5 === 2 && cell.row % 4 === 1;
  const corridorGrid = cell.spacious ? false : (cell.row % 5 === 2 && cell.col % 6 === 3
    && (cell.horizontal || cell.vertical));
  return (cell.bright && brightFixtureGrid)
    || (!cell.dark && cell.spacious && roomFixtureGrid)
    || (!cell.dark && corridorGrid)
    || (cell.dark && roomFixtureGrid && (cell.row + cell.col) % 2 === 0);
}

function cull(candidates, minDistance) {
  const kept = [];
  for (const candidate of candidates) {
    if (kept.some((f) => Math.hypot(f.center.x - candidate.center.x, f.center.z - candidate.center.z) < minDistance)) continue;
    kept.push(candidate);
  }
  return kept;
}

const area = open * CELL_SIZE * CELL_SIZE;
for (const [name, rule, minDistance] of [["legacy (ed387ba 之前)", legacy, 10.5], ["current (HEAD)", current, CELL_SIZE * 1.86]]) {
  const candidates = cells.filter(rule).map((cell) => ({ ...cell, priority: 0 }));
  const kept = cull(candidates, minDistance);
  console.log(`${name}: candidates=${candidates.length} kept=${kept.length} per100m2=${(kept.length / area * 100).toFixed(2)} meanPitchM=${Math.sqrt(area / kept.length).toFixed(1)}`);
}
