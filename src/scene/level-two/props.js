import * as THREE from "three";
import {
  CELL_SIZE,
  CEILING_Y,
  WALL_HEIGHT,
} from "../constants.js";
import { createFixturePointLight } from "../common/lighting.js";
import { createWideSignTexture } from "../common/textures.js";
import { isInAnyZone } from "../common/layout.js";
import {
  LEVEL_TWO_COLS,
  LEVEL_TWO_ROWS,
  LEVEL_TWO_MIN_FIXTURE_DISTANCE,
  LEVEL_TWO_DARK_ZONES,
  LEVEL_TWO_START_CELL,
  LEVEL_TWO_TARGET_CELL,
  LEVEL_TWO_MAX_POINT_LIGHTS,
  LEVEL_TWO_ORIGIN_X,
  LEVEL_TWO_ORIGIN_Z,
  LEVEL_TWO_CELL_META,
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
  levelTwoCellCenter,
  countLevelTwoOpenNeighbors,
  getLevelTwoTargetMount,
  getLevelTwoMachineRect,
  levelTwoDiagonalCenterWorld,
} from "./layout.js";

const S = CELL_SIZE;
const MACHINE_FRACTION = 0; // corridor is fully open; machinery is purely visual decoration now
// Visual-only constants for tank decoration (tanks block only their own footprint).
const TANK_DEPTH_NS = 1.2; // depth of horizontal-tank decoration (north/south face)
const TANK_DEPTH_EW = 1.0; // depth of vertical-tank decoration (east/west face)
const TANK_EDGE_GAP = 0.08; // gap between tank and cell wall

export function buildLevelTwoMachineryColliders() {
  const colliders = [];
  for (let row = 0; row < LEVEL_TWO_ROWS; row += 1) {
    for (let col = 0; col < LEVEL_TWO_COLS; col += 1) {
      const ch = LEVEL_TWO_MAP[row][col];
      const meta = LEVEL_TWO_CELL_META[row][col];

      if (ch !== CELL_OPEN) continue;
      const rect = getLevelTwoMachineRect(col, row);
      if (!rect) continue;
      colliders.push({
        minX: rect.minX,
        maxX: rect.maxX,
        minZ: rect.minZ,
        maxZ: rect.maxZ,
      });
    }
  }
  return colliders;
}

export function collectLevelTwoTransforms() {
  return collectLevelTransforms({
    cols: LEVEL_TWO_COLS,
    rows: LEVEL_TWO_ROWS,
    isCellOpen: isLevelTwoOpenCell,
    getCellCenter: levelTwoCellCenter,
    countOpenNeighbors: countLevelTwoOpenNeighbors,
    darkZones: LEVEL_TWO_DARK_ZONES,
    startCell: LEVEL_TWO_START_CELL,
    targetCell: LEVEL_TWO_TARGET_CELL,
    minFixtureDistance: LEVEL_TWO_MIN_FIXTURE_DISTANCE,
  });
}

export function collectLevelTransforms({
  cols,
  rows,
  isCellOpen,
  getCellCenter,
  countOpenNeighbors,
  darkZones,
  startCell,
  targetCell,
  minFixtureDistance,
  isBarCell = () => false,
}) {
  const northSouth = [];
  const eastWest = [];
  const fixtureCandidates = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!isCellOpen(col, row)) continue;

      const center = getCellCenter(col, row);
      const isDarkPocket = isInAnyZone(col, row, darkZones);

      if (DIAGONAL_TYPES.has(LEVEL_TWO_MAP[row][col])) {
        // Diagonal cells don't contribute rectangular walls (handled separately in merged geometry).
      } else {
        if (!isCellOpen(col, row - 1)) {
          northSouth.push(new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z - CELL_SIZE / 2));
        }
        if (!isCellOpen(col, row + 1)) {
          northSouth.push(new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z + CELL_SIZE / 2));
        }
        if (!isCellOpen(col - 1, row)) {
          eastWest.push(new THREE.Vector3(center.x - CELL_SIZE / 2, WALL_HEIGHT / 2, center.z));
        }
        if (!isCellOpen(col + 1, row)) {
          eastWest.push(new THREE.Vector3(center.x + CELL_SIZE / 2, WALL_HEIGHT / 2, center.z));
        }
      }

      const neighbors = countOpenNeighbors(col, row);
      const eastWestOpen = isCellOpen(col - 1, row) || isCellOpen(col + 1, row);
      const isCorridor = neighbors <= 2;
      const fixtureGrid = (col * 11 + row * 7) % 17 === 0;
      const isStart = col === startCell.col && row === startCell.row;
      const isTarget = col === targetCell.col && row === targetCell.row;
      const isCriticalFixture = isStart || isTarget;
      if (isDarkPocket && !isCriticalFixture) continue;
      if (DIAGONAL_TYPES.has(LEVEL_TWO_MAP[row][col])) continue; // skip lights in diagonals
      if ((isCorridor && fixtureGrid) || isCriticalFixture) {
        fixtureCandidates.push({
          x: center.x,
          z: center.z,
          rotation: eastWestOpen ? 0 : Math.PI / 2,
          phase: col * 0.57 + row * 1.17,
          speed: 3.8 + ((col + row) % 5) * 0.62,
          weak: 0.2 + ((col + row) % 3) * 0.04,
          range: isStart || isTarget ? 12.6 : 9.6,
          baseIntensity: isStart || isTarget ? 1.36 : 0.95,
          panelWidth: 3.0 + ((col + row) % 2) * 0.6,
          color: (col + row) % 4 === 0 ? 0xff9a55 : 0xffc080,
          hasPointLight: true,
          priority: isStart || isTarget ? 8 : isCorridor ? 3 : 1,
        });
      }
    }
  }

  const fixturePositions = [];
  fixtureCandidates
    .sort((a, b) => b.priority - a.priority)
    .forEach((candidate) => {
      const tooClose = fixturePositions.some(
        (fixture) =>
          Math.hypot(fixture.x - candidate.x, fixture.z - candidate.z) <
          minFixtureDistance,
      );
      if (!tooClose) fixturePositions.push(candidate);
    });

  return { northSouth, eastWest, fixturePositions };
}

export function createLevelTwoLights(scene, fixturePositions) {
  return createLayoutLights(scene, fixturePositions, {
    maxPointLights: LEVEL_TWO_MAX_POINT_LIGHTS,
  });
}

export function createLayoutLights(scene, fixturePositions, { maxPointLights }) {
  const fixtures = [];
  const pointLightIndexes = new Set(
    fixturePositions
      .map((fixture, index) => ({ index, priority: fixture.priority }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxPointLights)
      .map(({ index }) => index),
  );

  const tubeGeometry = new THREE.BoxGeometry(1, 0.05, 0.16);
  const cageGeometry = new THREE.BoxGeometry(1, 0.04, 0.32);
  const cageMaterial = new THREE.MeshStandardMaterial({
    color: 0x2b2218,
    emissive: 0x140b05,
    emissiveIntensity: 0.2,
    roughness: 0.82,
    metalness: 0.36,
  });

  fixturePositions.forEach((fixture, index) => {
    const cage = new THREE.Mesh(cageGeometry, cageMaterial);
    cage.position.set(fixture.x, CEILING_Y - 0.07, fixture.z);
    cage.rotation.y = fixture.rotation;
    cage.scale.x = fixture.panelWidth + 0.25;
    scene.add(cage);

    const panelMaterial = new THREE.MeshStandardMaterial({
      color: fixture.color,
      emissive: fixture.color,
      emissiveIntensity: fixture.baseIntensity,
      roughness: 0.34,
    });
    const panel = new THREE.Mesh(tubeGeometry, panelMaterial);
    panel.position.set(fixture.x, CEILING_Y - 0.13, fixture.z);
    panel.rotation.y = fixture.rotation;
    panel.scale.x = fixture.panelWidth;
    scene.add(panel);

    let light = null;
    if (pointLightIndexes.has(index)) {
      light = createFixturePointLight(fixture, CEILING_Y - 0.36, {
        rangeScale: 1.62,
        intensityScale: 1.32,
        decay: 2.05,
      });
      scene.add(light);
    }

    fixtures.push({
      material: panelMaterial,
      light,
      phase: fixture.phase,
      speed: fixture.speed,
      weak: fixture.weak,
      baseIntensity: fixture.baseIntensity,
    });
  });

  return fixtures;
}

function makePipeMaterial(color, emissive, intensity) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: intensity,
    roughness: 0.72,
    metalness: 0.34,
  });
}

export function addLevelTwoPipes(scene) {
  const coldMat = makePipeMaterial(0x4a3f33, 0x100a05, 0.1);
  const hotMat = makePipeMaterial(0x6e3a1d, 0x341005, 0.18);
  const ductMat = makePipeMaterial(0x322821, 0x080604, 0.06);

  function addSegment({ from, to, radius, material, axis }) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.05) return;
    const geometry = new THREE.CylinderGeometry(radius, radius, length, 12);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set((from.x + to.x) / 2, from.y, (from.z + to.z) / 2);
    if (axis === "x") mesh.rotation.z = Math.PI / 2;
    if (axis === "z") mesh.rotation.x = Math.PI / 2;
    scene.add(mesh);
  }

  // Main overhead pipe running along Tunnel A (row 6, N side)
  const aStart = levelTwoCellCenter(3, 6);
  const aEnd = levelTwoCellCenter(28, 6);
  addSegment({
    from: { x: aStart.x, y: CEILING_Y - 0.32, z: aStart.z - S / 2 + 0.12 },
    to: { x: aEnd.x, y: CEILING_Y - 0.32, z: aEnd.z - S / 2 + 0.12 },
    radius: 0.14,
    material: coldMat,
    axis: "x",
  });

  // Hot pipe along Tunnel B (col 29, W side - machine side)
  const bStart = levelTwoCellCenter(29, 7);
  const bEnd = levelTwoCellCenter(29, 21);
  addSegment({
    from: { x: bStart.x - S / 2 + 0.18, y: 2.45, z: bStart.z },
    to: { x: bEnd.x - S / 2 + 0.18, y: 2.45, z: bEnd.z },
    radius: 0.18,
    material: hotMat,
    axis: "z",
  });

  // Main overhead pipe along Tunnel C (row 22, N side)
  const cStart = levelTwoCellCenter(30, 22);
  const cEnd = levelTwoCellCenter(40, 22);
  addSegment({
    from: { x: cStart.x, y: CEILING_Y - 0.32, z: cStart.z - S / 2 + 0.12 },
    to: { x: cEnd.x, y: CEILING_Y - 0.32, z: cEnd.z - S / 2 + 0.12 },
    radius: 0.13,
    material: coldMat,
    axis: "x",
  });

  // Cable tray along Tunnel A (N side, ceiling)
  addSegment({
    from: { x: aStart.x, y: CEILING_Y - 0.16, z: aStart.z - S / 2 + 0.05 },
    to: { x: aEnd.x, y: CEILING_Y - 0.16, z: aEnd.z - S / 2 + 0.05 },
    radius: 0.06,
    material: ductMat,
    axis: "x",
  });

  // Cable tray along Tunnel B (W side, ceiling)
  addSegment({
    from: { x: bStart.x - S / 2 + 0.05, y: CEILING_Y - 0.16, z: bStart.z },
    to: { x: bEnd.x - S / 2 + 0.05, y: CEILING_Y - 0.16, z: bEnd.z },
    radius: 0.06,
    material: ductMat,
    axis: "z",
  });

  // Branch A1 short pipe
  const a1Top = levelTwoCellCenter(12, 4);
  const a1Bot = levelTwoCellCenter(12, 3);
  addSegment({
    from: { x: a1Top.x, y: CEILING_Y - 0.28, z: a1Top.z + S / 2 - 0.1 },
    to: { x: a1Bot.x, y: CEILING_Y - 0.28, z: a1Bot.z + S / 2 - 0.1 },
    radius: 0.08,
    material: coldMat,
    axis: "z",
  });

  // Joint spheres at corners
  const jointMat = coldMat;
  function addJoint(x, y, z, r = 0.16) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), jointMat);
    m.position.set(x, y, z);
    scene.add(m);
  }
  addJoint(aEnd.x, CEILING_Y - 0.32, aEnd.z - S / 2 + 0.12, 0.18);
  addJoint(bStart.x - S / 2 + 0.18, 2.45, bStart.z, 0.22);
  addJoint(bEnd.x - S / 2 + 0.18, 2.45, bEnd.z, 0.22);
  addJoint(cStart.x, CEILING_Y - 0.32, cStart.z - S / 2 + 0.12, 0.16);
}

export function addLevelTwoMachinery(scene, machineryColliders) {
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x2b2820,
    emissive: 0x0a0806,
    emissiveIntensity: 0.12,
    roughness: 0.82,
    metalness: 0.28,
  });
  const rustMaterial = new THREE.MeshStandardMaterial({
    color: 0x5a3621,
    emissive: 0x160804,
    emissiveIntensity: 0.1,
    roughness: 0.88,
    metalness: 0.2,
  });
  const meterMaterial = new THREE.MeshBasicMaterial({ color: 0xffa05a });

  function pushBoxAabb(cx, cz, w, d) {
    if (w <= 0 || d <= 0) return;
    machineryColliders.push({
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2,
    });
  }

  // Tank stacks along Tunnel A (every ~6 cells, pinned to the NORTH wall edge)
  const tunnelACells = [];
  for (let c = 4; c <= 27; c += 1) {
    tunnelACells.push({ col: c, row: 6, side: "N" });
  }
  tunnelACells.forEach((cell, i) => {
    if (i % 4 !== 0) return; // every 4th cell
    const center = levelTwoCellCenter(cell.col, cell.row);
    const tankW = 1.4;
    const tankH = 1.8 + ((cell.col * 7) % 5) * 0.18;
    const tankD = TANK_DEPTH_NS;
    const tankX = center.x;
    const tankZ = center.z - S / 2 + TANK_EDGE_GAP + tankD / 2;
    const mat = (cell.col + cell.row) % 3 === 0 ? rustMaterial : bodyMaterial;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(tankW, tankH, tankD), mat);
    mesh.position.set(tankX, tankH / 2, tankZ);
    scene.add(mesh);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(tankW * 0.92, 0.06, tankD * 0.92),
      rustMaterial,
    );
    stripe.position.set(tankX, tankH * 0.42, tankZ);
    scene.add(stripe);
    pushBoxAabb(tankX, tankZ, tankW, tankD);
  });

  // Vertical tank along Tunnel B (pinned to the EAST wall edge)
  for (let r = 8; r <= 20; r += 1) {
    if (r % 3 !== 0) continue;
    const center = levelTwoCellCenter(29, r);
    const tankW = TANK_DEPTH_EW;
    const tankD = 1.2;
    const tankH = 2.2;
    const tankX = center.x + S / 2 - TANK_EDGE_GAP - tankW / 2;
    const tankZ = center.z;
    const mat = r % 2 === 0 ? bodyMaterial : rustMaterial;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(tankW, tankH, tankD), mat);
    mesh.position.set(tankX, tankH / 2, tankZ);
    scene.add(mesh);
    // gauge panel
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.18), meterMaterial);
    panel.position.set(tankX + tankW / 2 + 0.025, tankH * 0.6, tankZ);
    scene.add(panel);
    pushBoxAabb(tankX, tankZ, tankW, tankD);
  }

  // Tunnel C: shorter tanks along N side
  for (let c = 32; c <= 39; c += 1) {
    if (c % 3 !== 0) continue;
    const center = levelTwoCellCenter(c, 22);
    const tankW = 1.2;
    const tankH = 1.4 + ((c * 5) % 4) * 0.2;
    const tankD = TANK_DEPTH_NS;
    const tankX = center.x;
    const tankZ = center.z - S / 2 + TANK_EDGE_GAP + tankD / 2;
    const mat = c % 2 === 0 ? rustMaterial : bodyMaterial;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(tankW, tankH, tankD), mat);
    mesh.position.set(tankX, tankH / 2, tankZ);
    scene.add(mesh);
    pushBoxAabb(tankX, tankZ, tankW, tankD);
  }

  return machineryColliders;
}

export function addLevelTwoSteam(scene) {
  const puffs = [];
  const geometry = new THREE.SphereGeometry(0.34, 12, 8);
  const vents = [
    { col: 8, row: 6, x: -1.5, z: -0.3, phase: 0.2 },
    { col: 16, row: 6, x: -1.5, z: -0.3, phase: 1.2 },
    { col: 24, row: 6, x: -1.5, z: -0.3, phase: 2.4 },
    { col: 29, row: 11, x: -1.5, z: 0.0, phase: 1.8 },
    { col: 29, row: 17, x: -1.5, z: 0.0, phase: 0.7 },
    { col: 35, row: 22, x: -1.5, z: -0.3, phase: 2.9 },
  ];

  vents.forEach((vent) => {
    const center = levelTwoCellCenter(vent.col, vent.row);
    const material = new THREE.MeshBasicMaterial({
      color: 0xd8cdb6,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
    });
    const puff = new THREE.Mesh(geometry, material);
    puff.position.set(center.x + vent.x, 1.22, center.z + vent.z);
    puff.scale.set(1, 0.8, 1);
    puff.userData.phase = vent.phase;
    scene.add(puff);
    puffs.push(puff);
  });

  return puffs;
}

export function addLevelTwoServiceDoor(scene, position) {
  const mount = getLevelTwoTargetMount(position);
  const doorMaterial = new THREE.MeshStandardMaterial({
    color: 0x2b2520,
    emissive: 0x120804,
    emissiveIntensity: 0.18,
    roughness: 0.72,
    metalness: 0.34,
  });
  const signMaterial = new THREE.MeshStandardMaterial({
    map: createWideSignTexture("PIPE EXIT", "#241108", "#ffbc73"),
    color: 0xffffff,
    emissive: 0x7a2d0b,
    emissiveIntensity: 0.55,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });

  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 2.35), doorMaterial);
  door.position.set(mount.x, 1.28, mount.z);
  door.rotation.y = mount.rotation;
  scene.add(door);

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.22, 0.62), signMaterial);
  sign.position.set(mount.x, 2.62, mount.z);
  sign.rotation.y = mount.rotation;
  scene.add(sign);

  const floorMarker = new THREE.Mesh(
    new THREE.RingGeometry(CELL_SIZE * 0.32, CELL_SIZE * 0.52, 32),
    new THREE.MeshBasicMaterial({
      color: 0xff8b3d,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  floorMarker.rotation.x = -Math.PI / 2;
  floorMarker.position.set(position.x, 0.035, position.z);
  scene.add(floorMarker);

  const glow = new THREE.PointLight(0xff8b3d, 0.52, 6.8, 2.2);
  glow.position.set(position.x, 1.6, position.z);
  scene.add(glow);
}

export function addLevelTwoFloorHeat(scene) {
  const material = new THREE.MeshBasicMaterial({
    color: 0xff7a30,
    transparent: true,
    opacity: 0.045,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const zones = [
    { col: 29, row: 13, width: 1.8, height: 8.0, rot: 0.0 },
    { col: 22, row: 22, width: 4.0, height: 2.0, rot: 0.02 },
    { col: 12, row: 6, width: 8.0, height: 1.8, rot: 0.0 },
  ];

  zones.forEach((zone) => {
    const center = levelTwoCellCenter(zone.col, zone.row);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(zone.width, zone.height), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = zone.rot;
    mesh.position.set(center.x, 0.028, center.z);
    scene.add(mesh);
  });
}

export function addLevelTwoDarkPockets(scene) {
  return addLayoutDarkPockets(scene, {
    darkZones: LEVEL_TWO_DARK_ZONES,
    originX: LEVEL_TWO_ORIGIN_X,
    originZ: LEVEL_TWO_ORIGIN_Z,
  });
}

export function addLayoutDarkPockets(scene, { darkZones, originX, originZ }) {
  const floorMaterial = new THREE.MeshBasicMaterial({
    color: 0x050403,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ceilingMaterial = new THREE.MeshBasicMaterial({
    color: 0x050403,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  darkZones.forEach((zone) => {
    const width = zone.width * CELL_SIZE;
    const height = zone.height * CELL_SIZE;
    const x = originX + zone.col * CELL_SIZE + width / 2;
    const z = originZ + zone.row * CELL_SIZE + height / 2;

    const floorShade = new THREE.Mesh(new THREE.PlaneGeometry(width, height), floorMaterial);
    floorShade.rotation.x = -Math.PI / 2;
    floorShade.position.set(x, 0.04, z);
    scene.add(floorShade);

    const ceilingShade = new THREE.Mesh(new THREE.PlaneGeometry(width, height), ceilingMaterial);
    ceilingShade.rotation.x = Math.PI / 2;
    ceilingShade.position.set(x, CEILING_Y - 0.035, z);
    scene.add(ceilingShade);
  });
}

// Glowing floor strip that traces the walkable corridor path. Goes through the
// walkable triangle of each diagonal cell so the player can see the corner from
// a distance and follow the line around the bend.
// (Function removed; the floor guide was visually distracting and the player
// can navigate the diagonal cells via the polygon-collision isWalkable path.)

export function addLevelTwoIndustrialDetails(scene) {
  const cableMaterial = new THREE.MeshStandardMaterial({
    color: 0x050606,
    emissive: 0x010202,
    emissiveIntensity: 0.12,
    roughness: 0.7,
    metalness: 0.2,
  });
  const cableGeometry = new THREE.CylinderGeometry(0.028, 0.028, 1, 8);

  function addCable({ col, row, axis, length, y, offsetX = 0, offsetZ = 0 }) {
    const center = levelTwoCellCenter(col, row);
    const mesh = new THREE.Mesh(cableGeometry, cableMaterial);
    mesh.scale.y = length;
    mesh.position.set(
      center.x + offsetX,
      y,
      center.z + offsetZ,
    );
    if (axis === "x") mesh.rotation.z = Math.PI / 2;
    if (axis === "z") mesh.rotation.x = Math.PI / 2;
    scene.add(mesh);
  }

  addCable({ col: 3, row: 6, axis: "x", length: S * 24, y: CEILING_Y - 0.2, offsetZ: -S / 2 + 0.32 });
  addCable({ col: 30, row: 22, axis: "x", length: S * 10, y: CEILING_Y - 0.2, offsetZ: -S / 2 + 0.32 });
  addCable({ col: 29, row: 7, axis: "z", length: S * 14, y: CEILING_Y - 0.2, offsetX: -S / 2 + 0.32 });

  // Door props on door cells
  const doorMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a3a2a,
    emissive: 0x1a0d04,
    emissiveIntensity: 0.18,
    roughness: 0.7,
    metalness: 0.32,
  });
  const doorCells = [];
  for (let r = 0; r < LEVEL_TWO_ROWS; r += 1) {
    for (let c = 0; c < LEVEL_TWO_COLS; c += 1) {
      if (LEVEL_TWO_MAP[r][c] === CELL_DOOR) {
        doorCells.push({ col: c, row: r });
      }
    }
  }
  doorCells.forEach(({ col, row }) => {
    const center = levelTwoCellCenter(col, row);
    // door faces south (toward corridor)
    const doorMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.3), doorMaterial);
    doorMesh.position.set(center.x, 1.15, center.z + S / 2 + 0.005);
    scene.add(doorMesh);
    // door frame
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x252018,
      emissive: 0x080503,
      emissiveIntensity: 0.1,
      roughness: 0.78,
      metalness: 0.28,
    });
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.1), frameMat);
    top.position.set(center.x, 2.32, center.z + S / 2 + 0.04);
    scene.add(top);
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.1), frameMat);
    left.position.set(center.x - 0.94, 1.2, center.z + S / 2 + 0.04);
    scene.add(left);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.1), frameMat);
    right.position.set(center.x + 0.94, 1.2, center.z + S / 2 + 0.04);
    scene.add(right);
  });

  // Valve props on valve cells (wall-mounted valves)
  const valveMaterial = new THREE.MeshStandardMaterial({
    color: 0x7a3e22,
    emissive: 0x1a0703,
    emissiveIntensity: 0.16,
    roughness: 0.72,
    metalness: 0.24,
  });
  const valveCells = [];
  for (let r = 0; r < LEVEL_TWO_ROWS; r += 1) {
    for (let c = 0; c < LEVEL_TWO_COLS; c += 1) {
      if (LEVEL_TWO_MAP[r][c] === CELL_VALVE) {
        valveCells.push({ col: c, row: r });
      }
    }
  }
  valveCells.forEach(({ col, row }) => {
    const center = levelTwoCellCenter(col, row);
    const valve = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.026, 8, 24), valveMaterial);
    valve.position.set(center.x, 1.44, center.z + S / 2 + 0.08);
    valve.rotation.y = 0;
    scene.add(valve);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 12), valveMaterial);
    hub.position.set(center.x, 1.44, center.z + S / 2 + 0.1);
    hub.rotation.x = Math.PI / 2;
    scene.add(hub);
  });

  // Wall signs
  const signs = [
    { col: 10, row: 5, text: "LOW PRESSURE", bg: "#251308", fg: "#ffbd73" },
    { col: 22, row: 5, text: "MAINTENANCE", bg: "#17130d", fg: "#ffd78a" },
    { col: 28, row: 21, text: "PIPE DREAMS", bg: "#211006", fg: "#ff945c" },
    { col: 38, row: 21, text: "KEEP MOVING", bg: "#1b1109", fg: "#ffca8f" },
  ];
  signs.forEach((sign) => {
    const center = levelTwoCellCenter(sign.col, sign.row);
    const material = new THREE.MeshStandardMaterial({
      map: createWideSignTexture(sign.text, sign.bg, sign.fg),
      color: 0xffffff,
      emissive: 0x4c1d0a,
      emissiveIntensity: 0.28,
      roughness: 0.64,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.5), material);
    mesh.position.set(center.x, 1.62, center.z - S / 2 + 0.04);
    scene.add(mesh);
  });

  // Floor grates in a few spots
  const grateMaterial = new THREE.MeshBasicMaterial({
    color: 0x050504,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const grates = [
    { col: 14, row: 6, width: 1.0, height: 0.8 },
    { col: 23, row: 6, width: 0.8, height: 0.9 },
    { col: 29, row: 12, width: 0.7, height: 0.9 },
    { col: 35, row: 22, width: 1.1, height: 0.8 },
  ];
  grates.forEach((grate) => {
    const center = levelTwoCellCenter(grate.col, grate.row);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(grate.width, grate.height), grateMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(center.x, 0.036, center.z);
    scene.add(mesh);
  });
}

export function addLevelTwoUtilityProps(scene) {
  const barrelMaterial = new THREE.MeshStandardMaterial({
    color: 0x4f3122,
    emissive: 0x140704,
    emissiveIntensity: 0.12,
    roughness: 0.78,
    metalness: 0.24,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x1b1b17,
    emissive: 0x050504,
    emissiveIntensity: 0.1,
    roughness: 0.82,
    metalness: 0.26,
  });
  const hazardMaterial = new THREE.MeshStandardMaterial({
    color: 0x7a4a23,
    emissive: 0x210c04,
    emissiveIntensity: 0.14,
    roughness: 0.72,
    metalness: 0.12,
  });
  const colliders = [];

  // Barrels scattered along tunnels
  const barrels = [
    { col: 6, row: 6, x: -1.5, z: 0.3 },
    { col: 19, row: 6, x: -1.5, z: 0.2 },
    { col: 26, row: 6, x: -1.5, z: -0.4 },
    { col: 29, row: 9, x: -1.5, z: -0.2 },
    { col: 29, row: 19, x: -1.5, z: 0.3 },
    { col: 33, row: 22, x: -1.5, z: 0.2 },
    { col: 38, row: 22, x: -1.5, z: -0.4 },
  ];

  barrels.forEach((barrel, index) => {
    const center = levelTwoCellCenter(barrel.col, barrel.row);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.32, 0.82, 18),
      index % 2 === 0 ? barrelMaterial : darkMaterial,
    );
    mesh.position.set(center.x + barrel.x, 0.41, center.z + barrel.z);
    mesh.rotation.y = index * 0.28;
    scene.add(mesh);

    for (let y = 0.17; y <= 0.67; y += 0.25) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.012, 6, 18), darkMaterial);
      band.position.set(mesh.position.x, y, mesh.position.z);
      band.rotation.x = Math.PI / 2;
      scene.add(band);
    }
  });

  // Hazard barriers at branch junctions
  const barriers = [
    { col: 12, row: 5, x: 0.6, z: -0.55, rot: -0.6 },
    { col: 25, row: 7, x: -0.6, z: 0.5, rot: 0.55 },
    { col: 31, row: 12, x: 0.55, z: -0.5, rot: -0.55 },
    { col: 37, row: 23, x: -0.55, z: 0.55, rot: 0.6 },
  ];
  barriers.forEach((barrier) => {
    const center = levelTwoCellCenter(barrier.col, barrier.row);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.68, 0.16), hazardMaterial);
    mesh.position.set(center.x + barrier.x, 0.38, center.z + barrier.z);
    mesh.rotation.y = barrier.rot;
    scene.add(mesh);
    colliders.push({
      minX: mesh.position.x - 0.88,
      maxX: mesh.position.x + 0.88,
      minZ: mesh.position.z - 0.52,
      maxZ: mesh.position.z + 0.52,
    });
  });

  return colliders;
}
