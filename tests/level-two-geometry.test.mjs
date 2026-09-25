import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";

test("Level 2 merged surfaces retain UVs and face their intended side", async () => {
  // Vite loads the view-model's baked .b64 asset imported by this scene.
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  try {
    const { buildLevelTwoMergedGeometry } = await vite.ssrLoadModule("/src/scene/level-two/index.js");
    const layout = await vite.ssrLoadModule("/src/scene/level-two/layout.js");
    const surfaces = buildLevelTwoMergedGeometry(
      layout.LEVEL_TWO_MAP,
      layout.LEVEL_TWO_CELL_META,
      layout.LEVEL_TWO_COLS,
      layout.LEVEL_TWO_ROWS,
      layout.LEVEL_TWO_ORIGIN_X,
      layout.LEVEL_TWO_ORIGIN_Z,
    );

    for (const name of ["floor", "ceiling", "wall", "diagWall", "fill"]) {
      const geometry = surfaces[name];
      const position = geometry.getAttribute("position");
      const normal = geometry.getAttribute("normal");
      const uv = geometry.getAttribute("uv");
      assert.ok(position.count > 0, `${name} has triangles`);
      assert.equal(uv.count, position.count, `${name} has one UV per vertex`);
      assert.equal(normal.count, position.count, `${name} has one normal per vertex`);
      for (let i = 0; i < uv.count; i += 1) {
        assert.ok(Number.isFinite(uv.getX(i)) && Number.isFinite(uv.getY(i)), `${name} UV ${i} is finite`);
      }

      const indices = geometry.getIndex();
      for (let i = 0; i < indices.count; i += 3) {
        const a = indices.getX(i);
        const b = indices.getX(i + 1);
        const c = indices.getX(i + 2);
        const abx = position.getX(b) - position.getX(a);
        const aby = position.getY(b) - position.getY(a);
        const abz = position.getZ(b) - position.getZ(a);
        const acx = position.getX(c) - position.getX(a);
        const acy = position.getY(c) - position.getY(a);
        const acz = position.getZ(c) - position.getZ(a);
        const nx = aby * acz - abz * acy;
        const ny = abz * acx - abx * acz;
        const nz = abx * acy - aby * acx;
        const dot = nx * normal.getX(a) + ny * normal.getY(a) + nz * normal.getZ(a);
        assert.ok(dot > 0, `${name} triangle ${i / 3} faces its normal`);
      }
    }
  } finally {
    await vite.close();
  }
});
