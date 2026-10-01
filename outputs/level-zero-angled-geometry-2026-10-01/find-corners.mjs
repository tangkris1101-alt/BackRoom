import { MAP, COLS, ROWS, START_CELL, EXIT_CELL, isOpenCell } from "../../src/scene/level-zero/layout.js";

const KEY = (c, r) => `${c},${r}`;

function neighbors(col, row) {
  return {
    N: isOpenCell(col, row - 1),
    S: isOpenCell(col, row + 1),
    W: isOpenCell(col - 1, row),
    E: isOpenCell(col + 1, row),
  };
}

function bfs(start, isStep) {
  const dist = new Map([[KEY(start.col, start.row), 0]]);
  const queue = [[start.col, start.row]];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const [col, row] = queue[cursor];
    const d = dist.get(KEY(col, row));
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = [col + dc, row + dr];
      if (!isStep(next[0], next[1])) continue;
      if (dist.has(KEY(next[0], next[1]))) continue;
      dist.set(KEY(next[0], next[1]), d + 1);
      queue.push(next);
    }
  }
  return dist;
}

const routeDistance = bfs(START_CELL, isOpenCell);
console.log("route reach:", routeDistance.get(KEY(EXIT_CELL.col, EXIT_CELL.row)));

const corners = [];
const straights = [];
const junctions = [];
for (let row = 1; row < ROWS - 1; row += 1) {
  for (let col = 1; col < COLS - 1; col += 1) {
    if (!isOpenCell(col, row)) continue;
    const n = neighbors(col, row);
    const open = Object.entries(n).filter(([, v]) => v).map(([k]) => k);
    if (open.length === 2 && n.N + n.S !== 2 && n.E + n.W !== 2) {
      corners.push({ col, row, open, d: routeDistance.get(KEY(col, row)) ?? Infinity });
    } else if (open.length === 2) {
      straights.push({ col, row, open, d: routeDistance.get(KEY(col, row)) ?? Infinity });
    } else if (open.length >= 3) {
      junctions.push({ col, row, open, d: routeDistance.get(KEY(col, row)) ?? Infinity });
    }
  }
}

console.log("\n== L-corners (2 perpendicular open neighbours), nearest to route ==");
corners
  .sort((a, b) => a.d - b.d)
  .forEach((c) => console.log(`(${c.col},${c.row}) ports ${c.open.join("")} routeDist ${c.d}`));

console.log("\n== junction cells (3+) near route ==");
junctions
  .sort((a, b) => a.d - b.d)
  .slice(0, 40)
  .forEach((c) => console.log(`(${c.col},${c.row}) ports ${c.open.join("")} routeDist ${c.d}`));

console.log("\n== straight cells (corridor) near route ==");
straights
  .sort((a, b) => a.d - b.d)
  .slice(0, 30)
  .forEach((c) => console.log(`(${c.col},${c.row}) ports ${c.open.join("")} routeDist ${c.d}`));

// isolated pillar cells: solid cells with all four neighbours open
console.log("\n== free-standing pillar cells (solid, 4 open neighbours) ==");
for (let row = 1; row < ROWS - 1; row += 1) {
  for (let col = 1; col < COLS - 1; col += 1) {
    if (isOpenCell(col, row)) continue;
    const openCount = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dc, dr]) => isOpenCell(col + dc, row + dr)).length;
    if (openCount === 4) console.log(`(${col},${row}) routeDist ${routeDistance.get(KEY(col, row)) ?? "-"}`);
  }
}
