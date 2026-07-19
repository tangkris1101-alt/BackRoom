import * as THREE from "three";
import {
  CELL_SIZE,
  CEILING_Y,
  WALL_HEIGHT,
  WALL_THICKNESS,
} from "../constants.js";
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





const ACTIVE_FIXTURE_LIGHTS = 8;
const LEVEL_ZERO_MIN_FIXTURE_DISTANCE = CELL_SIZE * 1.86;

export function createLights(scene, fixturePositions) {
  const fixtures = [];
  const activeLights = [];
  const activeLightCount = Math.min(ACTIVE_FIXTURE_LIGHTS, fixturePositions.length);
  let refreshTimer = 0;
  let lastLightAnchor = null;
  const panelSize = 1.42;
  const panelGeometry = new THREE.BoxGeometry(1, 0.035, 1);
  const trimGeometry = new THREE.BoxGeometry(1, 0.03, 1);
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x9d9258,
    emissive: 0x4a4020,
    emissiveIntensity: 0.12,
    roughness: 0.88,
    metalness: 0.02,
  });

  fixturePositions.forEach((fixture) => {
    const glowMaterial = new THREE.MeshStandardMaterial({
      color: fixture.color,
      emissive: fixture.color,
      emissiveIntensity: fixture.baseIntensity,
      roughness: 0.28,
    });
    const trim = new THREE.Mesh(trimGeometry, trimMaterial);
    trim.position.set(fixture.x, CEILING_Y - 0.055, fixture.z);
    trim.scale.set(panelSize + 0.24, 1, panelSize + 0.24);
    scene.add(trim);

    const panel = new THREE.Mesh(panelGeometry, glowMaterial);
    panel.position.set(fixture.x, CEILING_Y - 0.09, fixture.z);
    panel.scale.set(panelSize, 1, panelSize);
    scene.add(panel);

    fixtures.push({
      panel,
      material: glowMaterial,
      x: fixture.x,
      z: fixture.z,
      color: fixture.color,
      range: fixture.range,
      phase: fixture.phase,
      speed: fixture.speed,
      baseIntensity: fixture.baseIntensity,
      weak: fixture.weak,
      pulse: fixture.baseIntensity,
    });
  });

  for (let index = 0; index < activeLightCount; index += 1) {
    const light = new THREE.PointLight(0xfff9df, 0, 10, 2.05);
    light.visible = false;
    scene.add(light);
    activeLights.push(light);
  }

  function refreshActiveLights(playerPosition) {
    const closestFixtures = [...fixtures].sort(
      (first, second) =>
        (first.x - playerPosition.x) ** 2 + (first.z - playerPosition.z) ** 2 -
        ((second.x - playerPosition.x) ** 2 + (second.z - playerPosition.z) ** 2),
    );

    activeLights.forEach((light, index) => {
      const fixture = closestFixtures[index] ?? null;
      light.userData.fixture = fixture;
      light.visible = fixture !== null;
      if (!fixture) return;
      light.color.setHex(fixture.color);
      light.distance = fixture.range * 1.2;
      light.position.set(fixture.x, CEILING_Y - 0.24, fixture.z);
    });
  }

  function updatePointLights(delta, playerPosition) {
    refreshTimer += delta;
    const movedSinceRefresh =
      !lastLightAnchor ||
      Math.hypot(playerPosition.x - lastLightAnchor.x, playerPosition.z - lastLightAnchor.z) > 1.15;
    if (movedSinceRefresh || refreshTimer >= 0.22) {
      refreshActiveLights(playerPosition);
      lastLightAnchor = { x: playerPosition.x, z: playerPosition.z };
      refreshTimer = 0;
    }

    activeLights.forEach((light) => {
      const fixture = light.userData.fixture;
      if (!fixture) return;
      light.intensity = fixture.pulse * fixture.baseIntensity * 2.25;
    });
  }

  return { fixtures, updatePointLights };
}

export function getExitMount(position) {
  const cell = worldToCell(position.x, position.z);
  const directions = [
    { col: 0, row: -1, x: 0, z: -1 },
    { col: 0, row: 1, x: 0, z: 1 },
    { col: -1, row: 0, x: -1, z: 0 },
    { col: 1, row: 0, x: 1, z: 0 },
  ];
  const scoreDirection = (direction) => {
    let score = 0;
    for (let distance = 1; distance <= 8; distance += 1) {
      if (!isOpenCell(
        cell.col + direction.col * distance,
        cell.row + direction.row * distance,
      )) break;
      score += 2;
      const sideCol = direction.row;
      const sideRow = -direction.col;
      if (isOpenCell(
        cell.col + direction.col * distance + sideCol,
        cell.row + direction.row * distance + sideRow,
      )) score += 0.5;
      if (isOpenCell(
        cell.col + direction.col * distance - sideCol,
        cell.row + direction.row * distance - sideRow,
      )) score += 0.5;
    }
    return score;
  };
  const openDirection = directions
    .map((direction) => ({ ...direction, score: scoreDirection(direction) }))
    .sort((a, b) => b.score - a.score)[0];
  const offset = CELL_SIZE * 0.49;

  return {
    x: position.x - openDirection.x * offset,
    z: position.z - openDirection.z * offset,
    rotation: Math.atan2(openDirection.x, openDirection.z),
    direction: openDirection,
  };
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

  const postMaterial = new THREE.MeshStandardMaterial({
    color: 0x25271d,
    roughness: 0.82,
    metalness: 0.18,
  });
  const tangentX = mount.direction.z;
  const tangentZ = -mount.direction.x;
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1.38, 0.075), postMaterial);
    post.position.set(
      mount.x + tangentX * side * 0.78,
      0.71,
      mount.z + tangentZ * side * 0.78,
    );
    scene.add(post);
  }

  const glow = new THREE.PointLight(0x6dff8f, 0.62, 5.2, 2.1);
  glow.position.set(mount.x, 1.55, mount.z);
  scene.add(glow);
}

export function createFloorGeometryWithHole(width, height, holePosition, holeRadius) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -height / 2);
  shape.lineTo(width / 2, -height / 2);
  shape.lineTo(width / 2, height / 2);
  shape.lineTo(-width / 2, height / 2);
  shape.closePath();

  const hole = new THREE.Path();
  hole.absarc(holePosition.x, -holePosition.z, holeRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const geometry = new THREE.ShapeGeometry(shape, 48);
  const positions = geometry.getAttribute("position");
  const uvs = geometry.getAttribute("uv");
  for (let index = 0; index < positions.count; index += 1) {
    uvs.setXY(
      index,
      (positions.getX(index) + width / 2) / width,
      (positions.getY(index) + height / 2) / height,
    );
  }
  uvs.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

export function addExitHole(scene, position, radius) {
  const voidMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.FrontSide,
  });
  const shaftMaterial = new THREE.MeshBasicMaterial({
    color: 0x020301,
    side: THREE.BackSide,
  });
  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0x252115,
    emissive: 0x050500,
    emissiveIntensity: 0.08,
    roughness: 1,
  });

  const voidSurface = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.965, 56), voidMaterial);
  voidSurface.rotation.x = -Math.PI / 2;
  voidSurface.position.set(position.x, 0.036, position.z);
  voidSurface.renderOrder = 3;
  scene.add(voidSurface);

  const rim = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.105, 56), rimMaterial);
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(position.x, 0.041, position.z);
  scene.add(rim);

  const shaftDepth = 10;
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.82, shaftDepth, 56, 1, true),
    shaftMaterial,
  );
  shaft.position.set(position.x, -shaftDepth / 2 - 0.02, position.z);
  scene.add(shaft);

  const bottom = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.82, 48), voidMaterial);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.set(position.x, -shaftDepth, position.z);
  scene.add(bottom);
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

      const roomFixtureGrid = col % 2 === 1 && row % 2 === 1;
      const horizontalCorridor = isOpenCell(col - 1, row) && isOpenCell(col + 1, row);
      const verticalCorridor = isOpenCell(col, row - 1) && isOpenCell(col, row + 1);
      const corridorCenter = !isSpacious && (horizontalCorridor || verticalCorridor);
      const corridorFixtureGrid = horizontalCorridor ? col % 2 === 1 : row % 2 === 1;
      const fixtureGrid = isSpacious ? roomFixtureGrid : corridorFixtureGrid;
      const shouldLight =
        fixtureGrid &&
        ((isDarkZone && (Math.floor(col / 5) + Math.floor(row / 5)) % 2 === 0) ||
          (!isDarkZone && (isSpacious || corridorCenter)));

      if (shouldLight) {
        fixtureCandidates.push({
          x: center.x,
          z: center.z,
          phase: col * 0.83 + row * 1.17,
          speed: isDarkZone ? 5 + ((col * row) % 5) : 2.6 + ((col * row) % 4) * 0.45,
          weak: isDarkZone ? 0.18 : isBrightZone ? 0 : isSpacious ? 0.04 : 0.08,
          range: isBrightZone ? 10.8 : isDarkZone ? 6.8 : 8.8,
          baseIntensity: isBrightZone ? 1.78 : isDarkZone ? 0.74 : 1.24,
          color: isDarkZone ? 0xe7d79f : 0xfff9df,
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
      phase: 0.2,
      speed: 2.2,
      weak: 0.02,
      range: 13.6,
      baseIntensity: 1.46,
      color: 0xfff9df,
      priority: 8,
    },
    {
      x: exitCenter.x,
      z: exitCenter.z,
      phase: 1.4,
      speed: 2.4,
      weak: 0.02,
      range: 13.2,
      baseIntensity: 1.42,
      color: 0xfff9df,
      priority: 7,
    },
  );

  fixtureCandidates
    .sort((a, b) => b.priority - a.priority)
    .forEach((candidate) => {
      const tooClose = fixturePositions.some(
        (fixture) =>
          Math.hypot(fixture.x - candidate.x, fixture.z - candidate.z) <
          LEVEL_ZERO_MIN_FIXTURE_DISTANCE,
      );
      if (!tooClose) fixturePositions.push(candidate);
    });

  return { northSouth, eastWest, fixturePositions };
}
