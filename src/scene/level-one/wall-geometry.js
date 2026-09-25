import * as THREE from "three";

/** Coalesce touching modules so their coplanar faces do not leave raster seams. */
export function collapseWallRuns(transforms, along, cellSize, thickness) {
  const fixed = along === "x" ? "z" : "x";
  const sorted = [...transforms].sort((left, right) =>
    left[fixed] - right[fixed] || left[along] - right[along]);
  const runs = [];
  for (const position of sorted) {
    const last = runs.at(-1);
    if (last
      && Math.abs(last.fixed - position[fixed]) < 1e-4
      && Math.abs(last.y - position.y) < 1e-4
      && Math.abs(last.end + cellSize - position[along]) < 1e-4) {
      last.end = position[along];
      last.count += 1;
    } else {
      runs.push({ fixed: position[fixed], y: position.y, start: position[along], end: position[along], count: 1 });
    }
  }
  return runs.map((run) => ({
    width: along === "x" ? run.count * cellSize : thickness,
    depth: along === "z" ? run.count * cellSize : thickness,
    transforms: [along === "x"
      ? new THREE.Vector3((run.start + run.end) / 2, run.y, run.fixed)
      : new THREE.Vector3(run.fixed, run.y, (run.start + run.end) / 2)],
  }));
}

/**
 * Merge Level 1 wall sections with UVs derived from their world positions.
 * Instanced boxes restart UVs at every cell and expose the non-integer paint
 * repeat as a vertical seam, even when the source canvas itself is tileable.
 */
export function createWorldMappedWallGeometry(
  segments,
  height,
  { horizontalTileMeters = 3.2, verticalTileMeters = height } = {},
) {
  const wall = { positions: [], normals: [], uvs: [] };
  const caps = { positions: [], normals: [], uvs: [] };

  for (const { width, depth, transforms } of segments) {
    const template = new THREE.BoxGeometry(width, height, depth).toNonIndexed();
    const positions = template.getAttribute("position");
    const normals = template.getAttribute("normal");
    for (const transform of transforms) {
      for (let index = 0; index < positions.count; index += 1) {
        const x = positions.getX(index) + transform.x;
        const y = positions.getY(index) + transform.y;
        const z = positions.getZ(index) + transform.z;
        const nx = normals.getX(index);
        const ny = normals.getY(index);
        const nz = normals.getZ(index);
        const target = Math.abs(ny) > 0.5 ? caps : wall;
        target.positions.push(x, y, z);
        target.normals.push(nx, ny, nz);
        target.uvs.push(
          Math.abs(ny) > 0.5 ? x / horizontalTileMeters
            : Math.abs(nx) > 0.5 ? z / horizontalTileMeters
              : x / horizontalTileMeters,
          Math.abs(ny) > 0.5 ? z / horizontalTileMeters : y / verticalTileMeters,
        );
      }
    }
    template.dispose();
  }

  const build = ({ positions, normals, uvs }) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeBoundingSphere();
    return geometry;
  };
  return { wall: build(wall), caps: build(caps) };
}
