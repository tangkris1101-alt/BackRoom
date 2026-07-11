import * as THREE from "three";
import {
  CELL_SIZE,
  WALL_HEIGHT,
  WALL_THICKNESS,
  CEILING_Y,
  circleIntersectsAabb,
  SUPER_ALMOND_WATER_RESPAWN_MIN,
  SUPER_ALMOND_WATER_RESPAWN_VARIANCE,
  SUPER_ALMOND_WATER_INITIAL_SPAWN_CHANCE,
  SUPER_ALMOND_WATER_RESPAWN_CHANCE,
  HUB_LEVEL,
} from "../constants.js";
import { updateFixturePointLight, createStableLightState } from "../common/lighting.js";
import { attachFirstPersonViewModel, getViewModelName, updateFirstPersonHazmatViewModel } from "../common/view-model.js";
import {
  LEVEL_TWO_COLS,
  LEVEL_TWO_ROWS,
  LEVEL_TWO_START_CELL,
  LEVEL_TWO_TARGET_CELL,
  LEVEL_TWO_CELL_META,
  LEVEL_TWO_DARK_ZONES,
  LEVEL_TWO_MAP,
  CELL_OPEN,
  CELL_WALL,
  CELL_DOOR,
  CELL_VALVE,
  DIAGONAL_TYPES,
  CELL_DIAG_WN,
  CELL_DIAG_EN,
  CELL_DIAG_ES,
  CELL_DIAG_WS,
  isLevelTwoOpenCell,
  isLevelTwoWalkableCell,
  isLevelTwoDiagonalCell,
  getLevelTwoDiagonalPorts,
  levelTwoCellCenter,
  levelTwoCellWalkableCenter,
  levelTwoWorldToCell,
  getLevelTwoMachineRect,
  levelTwoDiagonalCenterWorld,
  pointInLevelTwoDiagonalCell,
} from "./layout.js";
import {
  createLevelTwoFloorTexture,
  createLevelTwoWallTexture,
  createLevelTwoCeilingTexture,
} from "./textures.js";
import {
  collectLevelTwoTransforms,
  createLevelTwoLights,
  addLevelTwoPipes,
  addLevelTwoMachinery,
  addLevelTwoSteam,
  addLevelTwoFloorHeat,
  addLevelTwoDarkPockets,
  addLevelTwoIndustrialDetails,
  addLevelTwoUtilityProps,
  buildLevelTwoMachineryColliders,
} from "./props.js";
import {
  createAlmondWaterPickup,
  createFlashlightPickup,
  createDetectorPickup,
  createCompassPickup,
  createSilenceLiquidPickup,
} from "../items/index.js";
import {
  createHoundEntity,
  chooseBacteriaSpawn,
  createInteractionSpot,
  getPickupTarget,
  tryPickupItems,
  getFocusedEntity,
  getFocusedInteraction,
  getFocusedItem,
  tryInteractWithSpots,
} from "../entities/index.js";
import { createExitNetwork } from "../common/exit-network.js";

const S = CELL_SIZE;
const H = WALL_HEIGHT;
const T = WALL_THICKNESS;
const MACHINE_FRACTION = 0;

function diagonalWalkableVerts(type, cellMinX, cellMinZ) {
  switch (type) {
    case CELL_DIAG_WN:
      return [
        { x: cellMinX, z: cellMinZ },
        { x: cellMinX, z: cellMinZ + S / 2 },
        { x: cellMinX + S / 2, z: cellMinZ },
      ];
    case CELL_DIAG_EN:
      return [
        { x: cellMinX + S, z: cellMinZ },
        { x: cellMinX + S / 2, z: cellMinZ },
        { x: cellMinX + S, z: cellMinZ + S / 2 },
      ];
    case CELL_DIAG_ES:
      return [
        { x: cellMinX + S, z: cellMinZ + S },
        { x: cellMinX + S, z: cellMinZ + S / 2 },
        { x: cellMinX + S / 2, z: cellMinZ + S },
      ];
    case CELL_DIAG_WS:
      return [
        { x: cellMinX, z: cellMinZ + S },
        { x: cellMinX + S / 2, z: cellMinZ + S },
        { x: cellMinX, z: cellMinZ + S / 2 },
      ];
    default:
      return null;
  }
}

function diagonalFillVerts(type, cellMinX, cellMinZ) {
  // Wall-fill is the cell minus the walkable triangle. The hypotenuse of the
  // fill polygon is the SAME line as the walkable's hypotenuse (just traversed
  // in the opposite direction), so the two regions share an edge.
  switch (type) {
    case CELL_DIAG_WN:
      return [
        { x: cellMinX + S / 2, z: cellMinZ },
        { x: cellMinX + S, z: cellMinZ },
        { x: cellMinX + S, z: cellMinZ + S },
        { x: cellMinX, z: cellMinZ + S },
        { x: cellMinX, z: cellMinZ + S / 2 },
      ];
    case CELL_DIAG_WS:
      return [
        { x: cellMinX, z: cellMinZ },
        { x: cellMinX + S, z: cellMinZ },
        { x: cellMinX + S, z: cellMinZ + S },
        { x: cellMinX + S / 2, z: cellMinZ + S },
        { x: cellMinX, z: cellMinZ + S / 2 },
      ];
    case CELL_DIAG_EN:
      return [
        { x: cellMinX, z: cellMinZ },
        { x: cellMinX + S / 2, z: cellMinZ },
        { x: cellMinX + S, z: cellMinZ + S / 2 },
        { x: cellMinX + S, z: cellMinZ + S },
        { x: cellMinX, z: cellMinZ + S },
      ];
    case CELL_DIAG_ES:
      return [
        { x: cellMinX, z: cellMinZ },
        { x: cellMinX + S, z: cellMinZ },
        { x: cellMinX + S, z: cellMinZ + S / 2 },
        { x: cellMinX + S / 2, z: cellMinZ + S },
        { x: cellMinX, z: cellMinZ + S },
      ];
    default:
      return null;
  }
}

// Triangulate a polygon (assumes convex, no holes). Returns array of triangle index triples.
function triangulateConvex(poly) {
  const tris = [];
  for (let i = 1; i < poly.length - 1; i += 1) {
    tris.push([0, i, i + 1]);
  }
  return tris;
}

function buildLevelTwoMergedGeometry(map, meta, cols, rows, originX, originZ) {
  const floorPositions = [];
  const floorNormals = [];
  const floorUvs = [];
  const floorIndices = [];

  const ceilingPositions = [];
  const ceilingNormals = [];
  const ceilingUvs = [];
  const ceilingIndices = [];

  const wallPositions = [];
  const wallNormals = [];
  const wallIndices = [];
  const wallMaterials = [];

  const diagWallPositions = [];
  const diagWallNormals = [];
  const diagWallIndices = [];

  const fillPositions = [];
  const fillNormals = [];
  const fillIndices = [];

  let floorIdx = 0;
  let ceilingIdx = 0;
  let wallIdx = 0;
  let diagWallIdx = 0;
  let fillIdx = 0;

  function pushQuad(positions, normals, uvs, indices, v0, v1, v2, v3, uv0, uv1, uv2, uv3, normal) {
    const base = positions.length / 3;
    positions.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z);
    normals.push(normal.x, normal.y, normal.z, normal.x, normal.y, normal.z, normal.x, normal.y, normal.z, normal.x, normal.y, normal.z);
    uvs.push(uv0.x, uv0.y, uv1.x, uv1.y, uv2.x, uv2.y, uv3.x, uv3.y);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  function pushTri(positions, normals, indices, v0, v1, v2, normal) {
    const base = positions.length / 3;
    positions.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
    normals.push(normal.x, normal.y, normal.z, normal.x, normal.y, normal.z, normal.x, normal.y, normal.z);
    indices.push(base, base + 1, base + 2);
  }

  function pushPolyPrism(positions, normals, indices, poly, y0, y1) {
    // Sides of a prism from y0 to y1.
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const nx = dz;
      const nz = -dx;
      const len = Math.hypot(nx, nz) || 1;
      const normal = { x: nx / len, y: 0, z: nz / len };

      const v0 = { x: a.x, y: y0, z: a.z };
      const v1 = { x: b.x, y: y0, z: b.z };
      const v2 = { x: b.x, y: y1, z: b.z };
      const v3 = { x: a.x, y: y1, z: a.z };
      pushQuad(positions, normals, [], indices, v0, v1, v2, v3, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, normal);
    }
  }

  function pushPolyFloor(poly, y, normalY) {
    const tris = triangulateConvex(poly);
    const normal = { x: 0, y: normalY, z: 0 };
    for (const [i, j, k] of tris) {
      const v0 = { x: poly[i].x, y, z: poly[i].z };
      const v1 = { x: poly[j].x, y, z: poly[j].z };
      const v2 = { x: poly[k].x, y, z: poly[k].z };
      if (normalY > 0) {
        pushTri(floorPositions, floorNormals, floorIndices, v0, v1, v2, normal);
      } else {
        pushTri(ceilingPositions, ceilingNormals, ceilingIndices, v0, v1, v2, normal);
      }
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const ch = map[row][col];
      const cellMinX = originX + col * S;
      const cellMinZ = originZ + row * S;

      if (ch === CELL_WALL || ch === CELL_VALVE) continue;

      const isRenderable = ch === CELL_OPEN || ch === CELL_DOOR;

      if (isRenderable) {
        // Full-cell floor
        const v0 = { x: cellMinX, y: 0, z: cellMinZ };
        const v1 = { x: cellMinX + S, y: 0, z: cellMinZ };
        const v2 = { x: cellMinX + S, y: 0, z: cellMinZ + S };
        const v3 = { x: cellMinX, y: 0, z: cellMinZ + S };
        const v0c = { x: cellMinX, y: CEILING_Y, z: cellMinZ };
        const v1c = { x: cellMinX + S, y: CEILING_Y, z: cellMinZ };
        const v2c = { x: cellMinX + S, y: CEILING_Y, z: cellMinZ + S };
        const v3c = { x: cellMinX, y: CEILING_Y, z: cellMinZ + S };
        const normalUp = { x: 0, y: 1, z: 0 };
        const normalDown = { x: 0, y: -1, z: 0 };
        pushTri(floorPositions, floorNormals, floorIndices, v0, v1, v2, normalUp);
        pushTri(floorPositions, floorNormals, floorIndices, v0, v2, v3, normalUp);
        pushTri(ceilingPositions, ceilingNormals, ceilingIndices, v0c, v3c, v2c, normalDown);
        pushTri(ceilingPositions, ceilingNormals, ceilingIndices, v0c, v2c, v1c, normalDown);

        // Cell-edge walls where neighbor is not walkable
        const northOpen = isLevelTwoWalkableCell(col, row - 1);
        const southOpen = isLevelTwoWalkableCell(col, row + 1);
        const westOpen = isLevelTwoWalkableCell(col - 1, row);
        const eastOpen = isLevelTwoWalkableCell(col + 1, row);

        if (!northOpen) {
          const w0 = { x: cellMinX, y: 0, z: cellMinZ };
          const w1 = { x: cellMinX + S, y: 0, z: cellMinZ };
          const w2 = { x: cellMinX + S, y: H, z: cellMinZ };
          const w3 = { x: cellMinX, y: H, z: cellMinZ };
          const normal = { x: 0, y: 0, z: -1 };
          pushQuad(wallPositions, wallNormals, [], wallIndices, w0, w1, w2, w3, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, normal);
          wallMaterials.push(0);
        }
        if (!southOpen) {
          const w0 = { x: cellMinX + S, y: 0, z: cellMinZ + S };
          const w1 = { x: cellMinX, y: 0, z: cellMinZ + S };
          const w2 = { x: cellMinX, y: H, z: cellMinZ + S };
          const w3 = { x: cellMinX + S, y: H, z: cellMinZ + S };
          const normal = { x: 0, y: 0, z: 1 };
          pushQuad(wallPositions, wallNormals, [], wallIndices, w0, w1, w2, w3, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, normal);
          wallMaterials.push(0);
        }
        if (!westOpen) {
          const w0 = { x: cellMinX, y: 0, z: cellMinZ + S };
          const w1 = { x: cellMinX, y: 0, z: cellMinZ };
          const w2 = { x: cellMinX, y: H, z: cellMinZ };
          const w3 = { x: cellMinX, y: H, z: cellMinZ + S };
          const normal = { x: -1, y: 0, z: 0 };
          pushQuad(wallPositions, wallNormals, [], wallIndices, w0, w1, w2, w3, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, normal);
          wallMaterials.push(0);
        }
        if (!eastOpen) {
          const w0 = { x: cellMinX + S, y: 0, z: cellMinZ };
          const w1 = { x: cellMinX + S, y: 0, z: cellMinZ + S };
          const w2 = { x: cellMinX + S, y: H, z: cellMinZ + S };
          const w3 = { x: cellMinX + S, y: H, z: cellMinZ };
          const normal = { x: 1, y: 0, z: 0 };
          pushQuad(wallPositions, wallNormals, [], wallIndices, w0, w1, w2, w3, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, normal);
          wallMaterials.push(0);
        }
      } else if (DIAGONAL_TYPES.has(ch)) {
        // Diagonal cell
        const walkablePoly = diagonalWalkableVerts(ch, cellMinX, cellMinZ);
        const fillPoly = diagonalFillVerts(ch, cellMinX, cellMinZ);

        // Floor and ceiling (walkable triangle)
        if (walkablePoly) {
          pushPolyFloor(walkablePoly, 0, 1);
          // Mirror for ceiling
          const mirrored = walkablePoly.map((v) => ({ x: v.x, z: v.z }));
          pushPolyFloor(mirrored, CEILING_Y, -1);
        }

        // Wall-fill (non-walkable half) as a filled prism. The hypotenuse
        // is shared with the walkable triangle; the outer edges are sealed.
        if (fillPoly) {
          const tris = triangulateConvex(fillPoly);
          const normalUp = { x: 0, y: 1, z: 0 };
          for (const [i, j, k] of tris) {
            const v0 = { x: fillPoly[i].x, y: CEILING_Y, z: fillPoly[i].z };
            const v1 = { x: fillPoly[j].x, y: CEILING_Y, z: fillPoly[j].z };
            const v2 = { x: fillPoly[k].x, y: CEILING_Y, z: fillPoly[k].z };
            pushTri(fillPositions, fillNormals, fillIndices, v0, v1, v2, normalUp);
          }
          pushPolyPrism(fillPositions, fillNormals, fillIndices, fillPoly, 0, H);
        }

        // Inner diagonal wall (separating walkable from fill) - 2 sides
        const ports = getLevelTwoDiagonalPorts(col, row);
        const innerStart = walkablePoly[1]; // The "shared" edge midpoint
        const innerEnd = walkablePoly[2]; // The other shared edge midpoint
        // For all diagonal types, the divider is the line from walkablePoly[1] to walkablePoly[2]
        // The divider runs along this line in 3D from y=0 to y=H.
        // Inner wall has two sides: one facing walkable, one facing fill.
        const dx = innerEnd.x - innerStart.x;
        const dz = innerEnd.z - innerStart.z;
        const len = Math.hypot(dx, dz) || 1;
        const perpX = dz / len;
        const perpZ = -dx / len;
        // Two sides of the wall: walkable-side (negative perp) and fill-side (positive perp)
        // We'll merge both into the wall geometry.

        // Walkable-side face
        {
          const w0 = { x: innerStart.x, y: 0, z: innerStart.z };
          const w1 = { x: innerEnd.x, y: 0, z: innerEnd.z };
          const w2 = { x: innerEnd.x, y: H, z: innerEnd.z };
          const w3 = { x: innerStart.x, y: H, z: innerStart.z };
          const normal = { x: -perpX, y: 0, z: -perpZ };
          pushQuad(diagWallPositions, diagWallNormals, [], diagWallIndices, w0, w1, w2, w3, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, normal);
        }
        // Fill-side face
        {
          const w0 = { x: innerEnd.x, y: 0, z: innerEnd.z };
          const w1 = { x: innerStart.x, y: 0, z: innerStart.z };
          const w2 = { x: innerStart.x, y: H, z: innerStart.z };
          const w3 = { x: innerEnd.x, y: H, z: innerEnd.z };
          const normal = { x: perpX, y: 0, z: perpZ };
          pushQuad(diagWallPositions, diagWallNormals, [], diagWallIndices, w0, w1, w2, w3, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, normal);
        }

        // Cell-edge walls on walkable side only
        if (ports) {
          // For type 1 (W→N): walkable has W and N edges
          // For type 2 (E→N): walkable has E and N edges
          // For type 3 (E→S): walkable has E and S edges
          // For type 4 (W→S): walkable has W and S edges
          const walkableEdges = [];
          if (ports.a === "W" || ports.b === "W") {
            // W edge from NW(0,0) to W(0, s/2) for type 1, or W(0, s/2) to SW(0,s) for type 4
            if (ch === CELL_DIAG_WN) walkableEdges.push({ from: { x: cellMinX, z: cellMinZ }, to: { x: cellMinX, z: cellMinZ + S / 2 } });
            else if (ch === CELL_DIAG_WS) walkableEdges.push({ from: { x: cellMinX, z: cellMinZ + S / 2 }, to: { x: cellMinX, z: cellMinZ + S } });
          }
          if (ports.a === "E" || ports.b === "E") {
            if (ch === CELL_DIAG_EN) walkableEdges.push({ from: { x: cellMinX + S, z: cellMinZ }, to: { x: cellMinX + S, z: cellMinZ + S / 2 } });
            else if (ch === CELL_DIAG_ES) walkableEdges.push({ from: { x: cellMinX + S, z: cellMinZ + S / 2 }, to: { x: cellMinX + S, z: cellMinZ + S } });
          }
          if (ports.a === "N" || ports.b === "N") {
            if (ch === CELL_DIAG_WN) walkableEdges.push({ from: { x: cellMinX, z: cellMinZ }, to: { x: cellMinX + S / 2, z: cellMinZ } });
            else if (ch === CELL_DIAG_EN) walkableEdges.push({ from: { x: cellMinX + S / 2, z: cellMinZ }, to: { x: cellMinX + S, z: cellMinZ } });
          }
          if (ports.a === "S" || ports.b === "S") {
            if (ch === CELL_DIAG_WS) walkableEdges.push({ from: { x: cellMinX, z: cellMinZ + S }, to: { x: cellMinX + S / 2, z: cellMinZ + S } });
            else if (ch === CELL_DIAG_ES) walkableEdges.push({ from: { x: cellMinX + S / 2, z: cellMinZ + S }, to: { x: cellMinX + S, z: cellMinZ + S } });
          }
          for (const edge of walkableEdges) {
            // Determine the neighbor cell from the edge's direction.
            const dx = edge.to.x - edge.from.x;
            const dz = edge.to.z - edge.from.z;
            let neighborCol = col;
            let neighborRow = row;
            if (Math.abs(dx) < 0.01) {
              if (Math.abs(edge.from.x - cellMinX) < 0.01) neighborCol -= 1;
              else if (Math.abs(edge.from.x - (cellMinX + S)) < 0.01) neighborCol += 1;
            } else if (Math.abs(dz) < 0.01) {
              if (Math.abs(edge.from.z - cellMinZ) < 0.01) neighborRow -= 1;
              else if (Math.abs(edge.from.z - (cellMinZ + S)) < 0.01) neighborRow += 1;
            }
            const neighborWalkable = isLevelTwoWalkableCell(neighborCol, neighborRow);
            if (neighborWalkable) continue;
            // Add wall along this edge
            const len = Math.hypot(dx, dz) || 1;
            const nx = dz / len;
            const nz = -dx / len;
            const normal = { x: nx, y: 0, z: nz };
            const w0 = { x: edge.from.x, y: 0, z: edge.from.z };
            const w1 = { x: edge.to.x, y: 0, z: edge.to.z };
            const w2 = { x: edge.to.x, y: H, z: edge.to.z };
            const w3 = { x: edge.from.x, y: H, z: edge.from.z };
            pushQuad(wallPositions, wallNormals, [], wallIndices, w0, w1, w2, w3, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, normal);
            wallMaterials.push(0);
          }

          // Cell-edge walls on the wall-fill side so the cell is fully
          // enclosed. The hypotenuse is already handled by the diagonal
          // divider wall above; these cover the remaining outer edges of
          // the wall-fill polygon.
          if (fillPoly) {
            for (let i = 0; i < fillPoly.length; i += 1) {
              const a = fillPoly[i];
              const b = fillPoly[(i + 1) % fillPoly.length];
              // Skip the hypotenuse (shared edge with the walkable triangle)
              const isHyp =
                (Math.abs(a.x - innerStart.x) < 0.01 && Math.abs(a.z - innerStart.z) < 0.01 &&
                 Math.abs(b.x - innerEnd.x) < 0.01 && Math.abs(b.z - innerEnd.z) < 0.01) ||
                (Math.abs(a.x - innerEnd.x) < 0.01 && Math.abs(a.z - innerEnd.z) < 0.01 &&
                 Math.abs(b.x - innerStart.x) < 0.01 && Math.abs(b.z - innerStart.z) < 0.01);
              if (isHyp) continue;
              // Determine the neighbor cell from the edge's direction.
              // Vertical edge (dx=0): neighbor is east or west of the edge.
              // Horizontal edge (dz=0): neighbor is north or south of the edge.
              const dx = b.x - a.x;
              const dz = b.z - a.z;
              let neighborCol = col;
              let neighborRow = row;
              if (Math.abs(dx) < 0.01) {
                // Vertical edge: use the x coordinate to find the side
                if (Math.abs(a.x - cellMinX) < 0.01) neighborCol -= 1;
                else if (Math.abs(a.x - (cellMinX + S)) < 0.01) neighborCol += 1;
              } else if (Math.abs(dz) < 0.01) {
                // Horizontal edge: use the z coordinate to find the side
                if (Math.abs(a.z - cellMinZ) < 0.01) neighborRow -= 1;
                else if (Math.abs(a.z - (cellMinZ + S)) < 0.01) neighborRow += 1;
              } else {
                // Diagonal half-edge (e.g. (cellMinX, cellMinZ + S/2) to (cellMinX, cellMinZ))
                // — fall back to the original vertex-based detection
                if (a.x === cellMinX) neighborCol -= 1;
                else if (a.x === cellMinX + S) neighborCol += 1;
                if (a.z === cellMinZ) neighborRow -= 1;
                else if (a.z === cellMinZ + S) neighborRow += 1;
              }
              if (isLevelTwoWalkableCell(neighborCol, neighborRow)) continue;
              const len = Math.hypot(dx, dz) || 1;
              const nx = dz / len;
              const nz = -dx / len;
              const normal = { x: nx, y: 0, z: nz };
              const w0 = { x: a.x, y: 0, z: a.z };
              const w1 = { x: b.x, y: 0, z: b.z };
              const w2 = { x: b.x, y: H, z: b.z };
              const w3 = { x: a.x, y: H, z: a.z };
              pushQuad(wallPositions, wallNormals, [], wallIndices, w0, w1, w2, w3, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, normal);
              wallMaterials.push(0);
            }
          }
        }
      }
    }
  }

  function makeBuffer(pos, norm, idx) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(norm, 3));
    geo.setIndex(idx);
    return geo;
  }

  return {
    floor: makeBuffer(floorPositions, floorNormals, floorIndices),
    ceiling: makeBuffer(ceilingPositions, ceilingNormals, ceilingIndices),
    wall: makeBuffer(wallPositions, wallNormals, wallIndices),
    diagWall: makeBuffer(diagWallPositions, diagWallNormals, diagWallIndices),
    fill: makeBuffer(fillPositions, fillNormals, fillIndices),
    wallMaterials,
  };
}

export function createLevelTwoScene({ initialState = null } = {}) {
  const scene = new THREE.Scene();
  const FOG_COLOR = 0x3d2e22;
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.014);

  const cameraFar =
    Math.hypot(LEVEL_TWO_COLS * CELL_SIZE, LEVEL_TWO_ROWS * CELL_SIZE) + CELL_SIZE * 2;
  const camera = new THREE.PerspectiveCamera(76, 1, 0.05, cameraFar);
  const viewModel = attachFirstPersonViewModel(camera);
  scene.add(camera);

  const spawnCell = levelTwoCellCenter(LEVEL_TWO_START_CELL.col, LEVEL_TWO_START_CELL.row);
  const spawnWalkable = levelTwoCellWalkableCenter(LEVEL_TWO_START_CELL.col, LEVEL_TWO_START_CELL.row);
  const spawn = { x: spawnWalkable.x, z: spawnWalkable.z, yaw: LEVEL_TWO_START_CELL.yaw };
  const targetPosition = levelTwoCellWalkableCenter(LEVEL_TWO_TARGET_CELL.col, LEVEL_TWO_TARGET_CELL.row);

  const pickupInitial = initialState?.pickups ?? {};
  const interactionInitial = initialState?.interactions ?? {};
  const objectiveInitial = initialState?.objectives ?? {};
  const entityInitial = Array.isArray(initialState?.entities) ? initialState.entities : [];

  // Keep the pipe-room surfaces dimmer than the ceiling fixtures so the player
  // flashlight has visible lighting headroom on nearby floors and walls.
  const floorMaterial = new THREE.MeshStandardMaterial({
    map: createLevelTwoFloorTexture(),
    color: 0xa58d6c,
    emissive: 0x24150b,
    emissiveIntensity: 0.12,
    roughness: 0.91,
    metalness: 0.02,
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: createLevelTwoWallTexture(),
    color: 0xae997b,
    emissive: 0x1d1108,
    emissiveIntensity: 0.08,
    roughness: 0.91,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const ceilingMaterial = new THREE.MeshStandardMaterial({
    map: createLevelTwoCeilingTexture(),
    color: 0x8d8068,
    emissive: 0x21160c,
    emissiveIntensity: 0.18,
    roughness: 0.9,
    metalness: 0.05,
  });
  const wallCapMaterial = new THREE.MeshStandardMaterial({
    color: 0x443729,
    emissive: 0x0e0704,
    emissiveIntensity: 0.05,
    roughness: 0.94,
    metalness: 0.04,
  });
  const diagWallMaterial = new THREE.MeshStandardMaterial({
    color: 0x5f503d,
    emissive: 0x170c05,
    emissiveIntensity: 0.08,
    roughness: 0.91,
    metalness: 0.06,
    side: THREE.DoubleSide,
  });
  const fillMaterial = new THREE.MeshStandardMaterial({
    color: 0x4d4133,
    emissive: 0x100905,
    emissiveIntensity: 0.06,
    roughness: 0.92,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });

  const merged = buildLevelTwoMergedGeometry(
    LEVEL_TWO_MAP,
    LEVEL_TWO_CELL_META,
    LEVEL_TWO_COLS,
    LEVEL_TWO_ROWS,
    -((LEVEL_TWO_COLS * CELL_SIZE) / 2),
    -((LEVEL_TWO_ROWS * CELL_SIZE) / 2),
  );

  const floor = new THREE.Mesh(merged.floor, floorMaterial);
  scene.add(floor);

  const ceiling = new THREE.Mesh(merged.ceiling, ceilingMaterial);
  scene.add(ceiling);

  const wallMesh = new THREE.Mesh(merged.wall, wallMaterial);
  scene.add(wallMesh);

  const diagWallMesh = new THREE.Mesh(merged.diagWall, diagWallMaterial);
  scene.add(diagWallMesh);

  const fillMesh = new THREE.Mesh(merged.fill, fillMaterial);
  scene.add(fillMesh);

  scene.add(new THREE.HemisphereLight(0xffb778, 0x3a2818, 0.86));
  const heatFill = new THREE.DirectionalLight(0xff9a55, 0.22);
  heatFill.position.set(-12, CEILING_Y - 0.4, 22);
  scene.add(heatFill);
  const playerAmbient = new THREE.PointLight(0xffd9a8, 0.1, 6.4, 1.9);
  playerAmbient.position.set(0, CEILING_Y - 0.6, 0);
  scene.add(playerAmbient);

  const { fixturePositions } = collectLevelTwoTransforms();
  const fixtures = createLevelTwoLights(scene, fixturePositions);
  const updateLightState = createStableLightState("HEAT", {
    dimBelow: 0.34,
    normalAbove: 0.52,
    dimDelay: 0.5,
    normalDelay: 0.78,
  });
  const machineryColliders = buildLevelTwoMachineryColliders();
  addLevelTwoPipes(scene);
  let propColliders = addLevelTwoMachinery(scene, machineryColliders);
  propColliders = propColliders.concat(addLevelTwoUtilityProps(scene));
  const steamPuffs = addLevelTwoSteam(scene);
  addLevelTwoFloorHeat(scene);
  addLevelTwoDarkPockets(scene);
  addLevelTwoIndustrialDetails(scene);

  const almondWater = createAlmondWaterPickup(scene, {
    cols: LEVEL_TWO_COLS,
    rows: LEVEL_TWO_ROWS,
    isCellOpen: isLevelTwoOpenCell,
    getCellCenter: levelTwoCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial["almond-water"] ?? null,
  });
  const superAlmondWater = createAlmondWaterPickup(scene, {
    cols: LEVEL_TWO_COLS,
    rows: LEVEL_TWO_ROWS,
    isCellOpen: isLevelTwoOpenCell,
    getCellCenter: levelTwoCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    variant: "super",
    respawnMin: SUPER_ALMOND_WATER_RESPAWN_MIN,
    respawnVariance: SUPER_ALMOND_WATER_RESPAWN_VARIANCE,
    initialSpawnChance: SUPER_ALMOND_WATER_INITIAL_SPAWN_CHANCE,
    respawnChance: SUPER_ALMOND_WATER_RESPAWN_CHANCE,
    initialState: pickupInitial["super-almond-water"] ?? null,
  });
  const flashlight = createFlashlightPickup(scene, {
    cols: LEVEL_TWO_COLS,
    rows: LEVEL_TWO_ROWS,
    isCellOpen: isLevelTwoOpenCell,
    getCellCenter: levelTwoCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial.flashlight ?? null,
  });
  const detector = createDetectorPickup(scene, {
    cols: LEVEL_TWO_COLS,
    rows: LEVEL_TWO_ROWS,
    isCellOpen: isLevelTwoOpenCell,
    getCellCenter: levelTwoCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial.detector ?? null,
  });
  const compass = createCompassPickup(scene, {
    cols: LEVEL_TWO_COLS,
    rows: LEVEL_TWO_ROWS,
    isCellOpen: isLevelTwoOpenCell,
    getCellCenter: levelTwoCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial.compass ?? null,
  });
  const silenceLiquid = createSilenceLiquidPickup(scene, {
    cols: LEVEL_TWO_COLS,
    rows: LEVEL_TWO_ROWS,
    isCellOpen: isLevelTwoOpenCell,
    getCellCenter: levelTwoCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial["silence-liquid"] ?? null,
  });

  const interactions = [
    createInteractionSpot({
      id: "level-two-valve",
      position: levelTwoCellCenter(30, 14),
      inspectHeight: 1.45,
      inspectRadius: 0.72,
      responseKey: "levelTwoValveResponse",
      initialState: interactionInitial["level-two-valve"] ?? null,
    }),
  ];
  const routes = [
    { id: "level-two-door-level-three", targetLevel: 3, targetLabel: "LEVEL 3", label: "UNLOCKED", kind: "door", position: targetPosition, rotation: 0 },
    { id: "level-two-door-level-one", targetLevel: 1, targetLabel: "LEVEL 1", label: "RETURN", kind: "door", position: levelTwoCellCenter(12, 2), rotation: 0 },
    { id: "level-two-door-level-four", targetLevel: 4, targetLabel: "LEVEL 4", label: "OFFICE", kind: "door", position: levelTwoCellCenter(37, 26), rotation: Math.PI },
    { id: "level-two-hidden-hub-door", targetLevel: HUB_LEVEL, targetLabel: "THE HUB", kind: "door", hidden: true, position: levelTwoCellCenter(31, 9), rotation: Math.PI / 2 },
  ];
  const exitNetwork = createExitNetwork(scene, camera, routes, interactionInitial);
  const hound = createHoundEntity(scene, {
    spawnPosition:
      chooseBacteriaSpawn({
        cols: LEVEL_TWO_COLS,
        rows: LEVEL_TWO_ROWS,
        isCellOpen: isLevelTwoOpenCell,
        getCellCenter: levelTwoCellCenter,
        targetPosition,
        spawnPosition: spawnCell,
      })[0] ?? targetPosition,
    isWalkable,
    speed: 1.83,
    initialState: entityInitial.find((entity) => entity.type === "hound") ?? null,
    cols: LEVEL_TWO_COLS,
    rows: LEVEL_TWO_ROWS,
    isCellOpen: isLevelTwoOpenCell,
    worldToCell: levelTwoWorldToCell,
    cellCenter: levelTwoCellCenter,
  });

  let objectiveReached = Boolean(objectiveInitial.reached);

  function isWalkable(x, z, radius = 0.36) {
    const corner = radius * 0.72;
    const samples = [
      [0, 0],
      [radius, 0],
      [-radius, 0],
      [0, radius],
      [0, -radius],
      [corner, corner],
      [-corner, corner],
      [corner, -corner],
      [-corner, -corner],
    ];

    for (const [offsetX, offsetZ] of samples) {
      const px = x + offsetX;
      const pz = z + offsetZ;
      const cell = levelTwoWorldToCell(px, pz);
      if (!inBoundsCheck(cell.col, cell.row)) return false;
      const ch = LEVEL_TWO_MAP[cell.row][cell.col];
      if (ch === CELL_WALL) return false;
      if (ch === CELL_OPEN || ch === CELL_DOOR) continue;
      if (DIAGONAL_TYPES.has(ch)) {
        // Use polygon-based walkable-triangle test (precise, no AABB approximation).
        if (!pointInLevelTwoDiagonalCell(cell.col, cell.row, px, pz, 0)) return false;
        continue;
      }
      return false;
    }

    return !propColliders.some((collider) => circleIntersectsAabb(x, z, radius, collider));
  }

  function inBoundsCheck(col, row) {
    return col >= 0 && col < LEVEL_TWO_COLS && row >= 0 && row < LEVEL_TWO_ROWS;
  }

  function update(delta, elapsed, playerPosition, effects = {}) {
    let lightTotal = 0;
    fixtures.forEach((fixture) => {
      const hum = 0.78 + Math.sin(elapsed * 1.7 + fixture.phase) * 0.07;
      const brownout = Math.sin(elapsed * fixture.speed + fixture.phase * 1.7) > 0.91 ? 0.48 : 1;
      const pulse = Math.max(0.24, hum * brownout - fixture.weak);
      fixture.material.emissiveIntensity = pulse * fixture.baseIntensity * 1.6;
      updateFixturePointLight(fixture, pulse, 1.08);
      lightTotal += pulse;
    });

    if (playerAmbient) {
      playerAmbient.position.set(playerPosition.x, Math.min(playerPosition.y + 1.4, CEILING_Y - 0.5), playerPosition.z);
    }

    steamPuffs.forEach((puff) => {
      const phase = puff.userData.phase ?? 0;
      const wave = 0.5 + Math.sin(elapsed * 1.8 + phase) * 0.5;
      const scale = 0.8 + wave * 0.9;
      puff.scale.set(scale * 0.78, 0.65 + wave * 0.9, scale);
      puff.position.y = 1.12 + wave * 0.18;
      puff.material.opacity = 0.035 + wave * 0.07;
    });

    const flicker = fixtures.length > 0 ? lightTotal / fixtures.length : 0.56;
    const enteredExit = exitNetwork.update(delta, playerPosition);
    const exitDistance = Math.min(...routes.map((route) => Math.hypot(
      playerPosition.x - route.position.x,
      playerPosition.z - route.position.z,
    )));
    if (enteredExit) objectiveReached = true;
    scene.fog.density = 0.011 + (1 - flicker) * 0.008;
    updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition);
    const almondWaterState = almondWater.update(delta, elapsed, playerPosition);
    const superAlmondWaterState = superAlmondWater.update(delta, elapsed, playerPosition);
    const flashlightState = flashlight.update(delta, elapsed, playerPosition);
    const detectorState = detector.update(delta, elapsed, playerPosition);
    const compassState = compass.update(delta, elapsed, playerPosition);
    const silenceLiquidState = silenceLiquid.update(delta, elapsed, playerPosition);
    const houndState = hound.update(delta, elapsed, playerPosition, effects);
    const entities = [houndState];
    const pickups = [almondWaterState, superAlmondWaterState, silenceLiquidState, compassState, detectorState, flashlightState];

    return {
      exitDistance: Math.round(exitDistance),
      exitReached: Boolean(enteredExit),
      nextLevel: enteredExit?.targetLevel,
      entityContact: entities.some((entity) => entity.contact),
      flicker,
      almondWater: almondWaterState,
      superAlmondWater: superAlmondWaterState,
      flashlight: flashlightState,
      detector: detectorState,
      silenceLiquid: silenceLiquidState,
      compass: compassState,
      pickups,
      entities,
      focusEntity: getFocusedEntity(camera, entities),
      focusInteraction: exitNetwork.inspect(playerPosition) ?? getFocusedInteraction(camera, playerPosition, interactions),
      focusItem: getFocusedItem(
        almondWater.inspect(camera),
        superAlmondWater.inspect(camera),
        silenceLiquid.inspect(camera),
        compass.inspect(camera),
        detector.inspect(camera),
        flashlight.inspect(camera),
      ),
      lightState: updateLightState(delta, flicker),
      statusText: objectiveReached
        ? "SERVICE LOCKED"
        : exitDistance < 8
          ? "PIPE EXIT TRACE"
          : "PIPE DREAMS",
    };
  }

  return {
    level: 2,
    levelLabel: "LEVEL 2",
    levelName: "PIPE DREAMS",
    get viewModelName() {
      return getViewModelName(viewModel);
    },
    colliderCount: propColliders.length,
    nextLevel: 3,
    exitMode: "network",
    scene,
    camera,
    spawn,
    targetPosition,
    isWalkable,
    decorativeItemSpawns: [
      { id: "wire-spool", position: { ...levelTwoCellCenter(24, 16), y: 0.2 }, rotation: 1.1, tiltZ: 0.16 },
      { id: "rusted-key", position: { ...levelTwoCellCenter(14, 6), y: 0.08 }, rotation: -0.8, tiltX: 0.06 },
    ],
    flashlightEffectiveness: 1.82,
    update,
    getPickupTarget: (playerPosition) =>
      getPickupTarget(playerPosition, detector, silenceLiquid, superAlmondWater, compass, flashlight, almondWater),
    tryPickup: (playerPosition) =>
      tryPickupItems(playerPosition, detector, silenceLiquid, superAlmondWater, compass, flashlight, almondWater),
    interact: (playerPosition) => exitNetwork.interact(playerPosition) ?? tryInteractWithSpots(playerPosition, ...interactions),
    getSnapshot() {
      return {
        pickups: {
          flashlight: flashlight.getState(),
          detector: detector.getState(),
          compass: compass.getState(),
          "silence-liquid": silenceLiquid.getState(),
          "almond-water": almondWater.getState(),
          "super-almond-water": superAlmondWater.getState(),
        },
        interactions: {
          ...exitNetwork.getState(),
          ...Object.fromEntries(interactions.map((spot) => [spot.id, spot.getState()])),
        },
        objectives: { reached: objectiveReached },
        entities: [hound.getState()],
      };
    },
  };
}
