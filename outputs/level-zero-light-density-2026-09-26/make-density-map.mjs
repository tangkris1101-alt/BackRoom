// 用真实运行时布点（collectWallTransforms）出图，并与旧规则叠加对比。
import { writeFile } from "node:fs/promises";
import { COLS, ROWS, isOpenCell, cellCenter, countOpenNeighbors } from "../../src/scene/level-zero/layout.js";
import { BRIGHT_ZONES, DARK_ZONES, collectWallTransforms } from "../../src/scene/level-zero/world.js";
import { isInAnyZone } from "../../src/scene/common/layout.js";
import { CELL_SIZE } from "../../src/scene/constants.js";

const cells = [];
for (let row = 0; row < ROWS; row += 1) {
  for (let col = 0; col < COLS; col += 1) {
    if (!isOpenCell(col, row)) continue;
    cells.push({
      col, row,
      x: cellCenter(col, row).x,
      z: cellCenter(col, row).z,
      bright: isInAnyZone(col, row, BRIGHT_ZONES),
      dark: isInAnyZone(col, row, DARK_ZONES),
      spacious: countOpenNeighbors(col, row) >= 3,
      horizontal: isOpenCell(col - 1, row) && isOpenCell(col + 1, row),
      vertical: isOpenCell(col, row - 1) && isOpenCell(col, row + 1),
    });
  }
}

const legacyRule = (cell) => {
  const roomFixtureGrid = cell.col % 6 === 3 && cell.row % 4 === 1;
  const brightFixtureGrid = cell.col % 5 === 2 && cell.row % 4 === 1;
  const corridorGrid = !cell.spacious && cell.row % 5 === 2 && cell.col % 6 === 3
    && (cell.horizontal || cell.vertical);
  return (cell.bright && brightFixtureGrid)
    || (!cell.dark && cell.spacious && roomFixtureGrid)
    || (!cell.dark && corridorGrid)
    || (cell.dark && roomFixtureGrid && (cell.row + cell.col) % 2 === 0);
};

const legacyKept = [];
for (const candidate of cells.filter(legacyRule)) {
  if (legacyKept.some((f) => Math.hypot(f.x - candidate.x, f.z - candidate.z) < CELL_SIZE * 4.25)) continue;
  legacyKept.push(candidate);
}

// 真实布点：直接取游戏运行时的灯具位置，按世界坐标换算回格子
const { fixturePositions } = collectWallTransforms();
const originX = cellCenter(0, 0).x - CELL_SIZE / 2 + CELL_SIZE / 2;
const toCell = (fixture) => ({
  col: Math.round((fixture.x - cellCenter(0, 0).x) / CELL_SIZE),
  row: Math.round((fixture.z - cellCenter(0, 0).z) / CELL_SIZE),
  panelLength: fixture.panelLength,
  orientation: fixture.orientation,
});
const current = fixturePositions.map((fixture) => ({ ...toCell(fixture), c: toCell(fixture).col, r: toCell(fixture).row }));

const data = {
  cols: COLS, rows: ROWS, cellSize: CELL_SIZE,
  cells: cells.map((cell) => ({
    c: cell.col, r: cell.row,
    dark: cell.dark, bright: cell.bright,
    legacy: legacyRule(cell),
  })),
  legacyKept: legacyKept.map((cell) => ({ c: cell.col, r: cell.row })),
  current,
  originX,
};

const area = cells.length * CELL_SIZE * CELL_SIZE;
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>Level 0 灯具布点对比</title>
<style>
  body { margin: 0; background: #14161a; color: #e8e4d8; font: 13px/1.5 system-ui, sans-serif; }
  .wrap { display: flex; gap: 24px; padding: 20px 24px 28px; }
  h2 { font-size: 15px; margin: 0 0 8px; font-weight: 600; }
  .meta { color: #9aa09a; margin: 0 0 10px; font-size: 12px; }
  canvas { background: #1b1e23; border: 1px solid #2c3138; }
</style></head>
<body><div class="wrap">
  <section><h2>旧规则（ed387ba 之前，长灯管）</h2><p class="meta" id="legacy-meta"></p><canvas id="legacy"></canvas></section>
  <section><h2>修复后（现行代码实际布点，线型灯管）</h2><p class="meta" id="current-meta"></p><canvas id="current"></canvas></section>
</div>
<script>
const data = ${JSON.stringify(data).replace(/</g, "\\u003c")};
const scale = 9;
const area = ${area};

function base(canvas, context) {
  canvas.width = data.cols * scale;
  canvas.height = data.rows * scale;
  for (const cell of data.cells) {
    context.fillStyle = cell.dark ? "#232a2c" : cell.bright ? "#2b2a20" : "#22262b";
    context.fillRect(cell.c * scale, cell.r * scale, scale, scale);
  }
}

function label(id, count, extra) {
  const open = data.cells.length;
  document.getElementById(id + "-meta").textContent =
    \`开放格数 \${open} / 面积 \${(area / 10000).toFixed(2)} 万 m² · 灯具 \${count} 个 · \`
    + \`\${(count / area * 100).toFixed(2)} 个/100 m² · 平均间距 ≈ \${Math.sqrt(area / count).toFixed(1)} m\` + (extra ?? "");
}

{
  const canvas = document.getElementById("legacy");
  const context = canvas.getContext("2d");
  base(canvas, context);
  context.fillStyle = "#ffe9a8";
  for (const cell of data.legacyKept) {
    // 旧版：细长灯管（2.08–2.95 m × 0.36 m）
    context.fillRect(cell.c * scale - scale * 0.3, cell.r * scale + scale * 0.34, scale * 1.6, scale * 0.3);
  }
  label("legacy", data.legacyKept.length);
}

{
  const canvas = document.getElementById("current");
  const context = canvas.getContext("2d");
  base(canvas, context);
  context.fillStyle = "#ffe9a8";
  for (const fixture of data.current) {
    const length = fixture.panelLength ?? 2.1;
    const half = (length / data.cellSize) * scale / 2;
    const thickness = Math.max(0.42 / data.cellSize * scale, 1.8);
    if (fixture.orientation) {
      context.fillRect(fixture.c * scale + scale / 2 - thickness / 2, fixture.r * scale + scale / 2 - half, thickness, half * 2);
    } else {
      context.fillRect(fixture.c * scale + scale / 2 - half, fixture.r * scale + scale / 2 - thickness / 2, half * 2, thickness);
    }
  }
  label("current", data.current.length);
}
document.title = "Level 0 fixture density map";
</script></body></html>`;

await writeFile(new URL("./fixture-density-map.html", import.meta.url), html, "utf8");
console.log("wrote fixture-density-map.html", { legacy: legacyKept.length, current: current.length });
