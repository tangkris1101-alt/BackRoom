import * as THREE from "three";
import {
  CELL_SIZE,
  CEILING_Y,
  WALL_HEIGHT,
  WALL_THICKNESS,
  MAX_POINT_LIGHTS,
  MIN_FIXTURE_DISTANCE,
} from "../constants.js";
import { createFixturePointLight } from "../common/lighting.js";
import { createWideSignTexture } from "../common/textures.js";
import { isInAnyZone } from "../common/layout.js";
import {
  isOpenCell,
  cellCenter,
  worldToCell,
  countOpenNeighbors,
  ORIGIN_X,
  ORIGIN_Z,
  START_CELL,
  EXIT_CELL,
  COLS,
  ROWS,
} from "./layout.js";

export const BRIGHT_ZONES = [
  { col: 19, row: 1, width: 10, height: 7 },
  { col: 11, row: 3, width: 7, height: 5 },
  { col: 10, row: 10, width: 9, height: 6 },
];

export const DARK_ZONES = [
  { col: 1, row: 20, width: 6, height: 5 },
  { col: 22, row: 12, width: 6, height: 4 },
  { col: 3, row: 8, width: 5, height: 5 },
  { col: 13, row: 18, width: 12, height: 5 },
  { col: 2, row: 13, width: 4, height: 3 },
  { col: 24, row: 20, width: 5, height: 4 },
];





export function createLights(scene, fixturePositions) {
  const fixtures = [];
  const pointLightIndexes = new Set(
    fixturePositions
      .map((fixture, index) => ({ index, priority: fixture.priority }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, MAX_POINT_LIGHTS)
      .map(({ index }) => index),
  );
  const panelGeometry = new THREE.BoxGeometry(1, 0.035, 0.36);
  const trimGeometry = new THREE.BoxGeometry(1, 0.03, 0.52);
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x9d9258,
    emissive: 0x4a4020,
    emissiveIntensity: 0.12,
    roughness: 0.88,
    metalness: 0.02,
  });

  fixturePositions.forEach((fixture, index) => {
    const glowMaterial = new THREE.MeshStandardMaterial({
      color: fixture.color,
      emissive: fixture.color,
      emissiveIntensity: fixture.baseIntensity,
      roughness: 0.28,
    });
    const trim = new THREE.Mesh(trimGeometry, trimMaterial);
    trim.position.set(fixture.x, CEILING_Y - 0.055, fixture.z);
    trim.rotation.y = fixture.rotation;
    trim.scale.x = fixture.panelWidth + 0.24;
    scene.add(trim);

    const panel = new THREE.Mesh(panelGeometry, glowMaterial);
    panel.position.set(fixture.x, CEILING_Y - 0.09, fixture.z);
    panel.rotation.y = fixture.rotation;
    panel.scale.x = fixture.panelWidth;
    scene.add(panel);

    let light = null;
    if (fixture.hasPointLight && pointLightIndexes.has(index)) {
      light = createFixturePointLight(fixture, CEILING_Y - 0.25, {
        rangeScale: 1.48,
        intensityScale: 1.22,
      });
      scene.add(light);
    }

    fixtures.push({
      panel,
      material: glowMaterial,
      light,
      phase: fixture.phase,
      speed: fixture.speed,
      baseIntensity: fixture.baseIntensity,
      weak: fixture.weak,
    });
  });

  return fixtures;
}

export function getExitMount(position) {
  const cell = worldToCell(position.x, position.z);
  const options = [
    {
      col: cell.col,
      row: cell.row - 1,
      x: position.x,
      z: position.z - CELL_SIZE / 2 + WALL_THICKNESS * 0.62,
      rotation: 0,
    },
    {
      col: cell.col,
      row: cell.row + 1,
      x: position.x,
      z: position.z + CELL_SIZE / 2 - WALL_THICKNESS * 0.62,
      rotation: Math.PI,
    },
    {
      col: cell.col - 1,
      row: cell.row,
      x: position.x - CELL_SIZE / 2 + WALL_THICKNESS * 0.62,
      z: position.z,
      rotation: Math.PI / 2,
    },
    {
      col: cell.col + 1,
      row: cell.row,
      x: position.x + CELL_SIZE / 2 - WALL_THICKNESS * 0.62,
      z: position.z,
      rotation: -Math.PI / 2,
    },
  ];

  return options.find((option) => !isOpenCell(option.col, option.row)) ?? options[1];
}

export function addExitSign(scene, position) {
  const signMap = createWideSignTexture("EXIT", "#172d1d", "#a5ffba");
  const signMaterial = new THREE.MeshStandardMaterial({
    map: signMap,
    color: 0xffffff,
    emissive: 0x3fff72,
    emissiveIntensity: 0.55,
    roughness: 0.42,
    side: THREE.DoubleSide,
  });
  const mount = getExitMount(position);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 0.78), signMaterial);
  sign.position.set(mount.x, 1.72, mount.z);
  sign.rotation.y = mount.rotation;
  scene.add(sign);

  const padMaterial = new THREE.MeshBasicMaterial({
    color: 0x7dff91,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(CELL_SIZE * 0.82, CELL_SIZE * 0.82), padMaterial);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(position.x, 0.034, position.z);
  scene.add(pad);

  const glow = new THREE.PointLight(0x6dff8f, 1.15, 8.4, 2.1);
  glow.position.set(position.x, 1.35, position.z);
  scene.add(glow);
}


export function addMoodZones(scene) {
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x4a3a16,
    transparent: true,
    opacity: 0.035,
    depthWrite: false,
  });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffed9a,
    transparent: true,
    opacity: 0.055,
    depthWrite: false,
  });

  const addFloorTint = (zone, material, yOffset) => {
    const width = zone.width * CELL_SIZE;
    const height = zone.height * CELL_SIZE;
    const geometry = new THREE.PlaneGeometry(width, height);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(
      ORIGIN_X + zone.col * CELL_SIZE + width / 2,
      yOffset,
      ORIGIN_Z + zone.row * CELL_SIZE + height / 2,
    );
    scene.add(mesh);
  };

  DARK_ZONES.forEach((zone) => addFloorTint(zone, shadowMaterial, 0.018));
  BRIGHT_ZONES.forEach((zone) => addFloorTint(zone, glowMaterial, 0.022));
}

export function collectWallTransforms() {
  const northSouth = [];
  const eastWest = [];
  const fixtureCandidates = [];

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (!isOpenCell(col, row)) continue;

      const center = cellCenter(col, row);
      const isBrightZone = isInAnyZone(col, row, BRIGHT_ZONES);
      const isDarkZone = isInAnyZone(col, row, DARK_ZONES);
      const openNeighborCount = countOpenNeighbors(col, row);
      const isSpacious = openNeighborCount >= 3;
      if (!isOpenCell(col, row - 1)) {
        const position = new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z - CELL_SIZE / 2);
        northSouth.push(position);
      }
      if (!isOpenCell(col, row + 1)) {
        const position = new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z + CELL_SIZE / 2);
        northSouth.push(position);
      }
      if (!isOpenCell(col - 1, row)) {
        const position = new THREE.Vector3(center.x - CELL_SIZE / 2, WALL_HEIGHT / 2, center.z);
        eastWest.push(position);
      }
      if (!isOpenCell(col + 1, row)) {
        const position = new THREE.Vector3(center.x + CELL_SIZE / 2, WALL_HEIGHT / 2, center.z);
        eastWest.push(position);
      }

      const lightSeed = (col * 37 + row * 19) % 11;
      const roomFixtureGrid = col % 6 === 3 && row % 4 === 1;
      const brightFixtureGrid = col % 5 === 2 && row % 4 === 1;
      const horizontalCorridor = isOpenCell(col - 1, row) && isOpenCell(col + 1, row);
      const verticalCorridor = isOpenCell(col, row - 1) && isOpenCell(col, row + 1);
      const corridorCenter = !isSpacious && (horizontalCorridor || verticalCorridor);
      const corridorGrid = corridorCenter && row % 5 === 2 && col % 6 === 3;
      const shouldLight =
        (isBrightZone && brightFixtureGrid) ||
        (!isDarkZone && isSpacious && roomFixtureGrid) ||
        (!isDarkZone && corridorGrid) ||
        (isDarkZone && roomFixtureGrid && (row + col) % 2 === 0);

      if (shouldLight) {
        fixtureCandidates.push({
          x: center.x,
          z: center.z,
          rotation: 0,
          phase: col * 0.83 + row * 1.17,
          speed: isDarkZone ? 5 + ((col * row) % 5) : 2.6 + ((col * row) % 4) * 0.45,
          weak: isDarkZone ? 0.18 : isBrightZone ? 0 : isSpacious ? 0.04 : 0.08,
          range: isBrightZone ? 14.8 : isDarkZone ? 8.6 : 11.4,
          baseIntensity: isBrightZone ? 1.78 : isDarkZone ? 0.74 : 1.24,
          panelWidth: isBrightZone ? 2.95 : isSpacious ? 2.58 : 2.08,
          color: isDarkZone ? 0xe7d79f : 0xfff9df,
          hasPointLight: isBrightZone || isSpacious || (corridorGrid && lightSeed <= 2),
          priority: (isBrightZone ? 4 : 0) + (isSpacious ? 2 : 0) - (isDarkZone ? 1 : 0),
        });
      }
    }
  }

  const fixturePositions = [];
  const startCenter = cellCenter(START_CELL.col, START_CELL.row);
  const exitCenter = cellCenter(EXIT_CELL.col, EXIT_CELL.row);
  fixtureCandidates.push(
    {
      x: startCenter.x,
      z: startCenter.z,
      rotation: 0,
      phase: 0.2,
      speed: 2.2,
      weak: 0.02,
      range: 13.6,
      baseIntensity: 1.46,
      panelWidth: 2.72,
      color: 0xfff9df,
      hasPointLight: true,
      priority: 8,
    },
    {
      x: exitCenter.x,
      z: exitCenter.z,
      rotation: 0,
      phase: 1.4,
      speed: 2.4,
      weak: 0.02,
      range: 13.2,
      baseIntensity: 1.42,
      panelWidth: 2.72,
      color: 0xfff9df,
      hasPointLight: true,
      priority: 7,
    },
  );

  fixtureCandidates
    .sort((a, b) => b.priority - a.priority)
    .forEach((candidate) => {
      const tooClose = fixturePositions.some(
        (fixture) => Math.hypot(fixture.x - candidate.x, fixture.z - candidate.z) < MIN_FIXTURE_DISTANCE,
      );
      if (!tooClose) fixturePositions.push(candidate);
    });

  return { northSouth, eastWest, fixturePositions };
}

