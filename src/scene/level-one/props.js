import * as THREE from "three";
import {
  CELL_SIZE,
  CEILING_Y,
} from "../constants.js";
import { createFixturePointLight } from "../common/lighting.js";
import { createWideSignTexture } from "../common/textures.js";
import { isInAnyZone } from "../common/layout.js";
import {
  LEVEL_ONE_COLS,
  LEVEL_ONE_ROWS,
  LEVEL_ONE_MIN_FIXTURE_DISTANCE,
  LEVEL_ONE_DARK_ZONES,
  LEVEL_ONE_SUPPLY_ZONES,
  LEVEL_ONE_START_CELL,
  LEVEL_ONE_TARGET_CELL,
} from "./layout.js";
import {
  isLevelOneOpenCell,
  levelOneCellCenter,
  isInAnyLevelOneZone,
  countLevelOneOpenNeighbors,
  getLevelOneTargetMount,
} from "./layout.js";

export function createLevelOneLights(scene, fixturePositions) {
  const fixtures = [];
  const pointLightIndexes = new Set(
    fixturePositions
      .map((fixture, index) => ({ index, priority: fixture.priority }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, LEVEL_ONE_MAX_POINT_LIGHTS)
      .map(({ index }) => index),
  );
  const tubeGeometry = new THREE.BoxGeometry(1, 0.04, 0.34);
  const mountGeometry = new THREE.BoxGeometry(1, 0.04, 0.48);
  const mountMaterial = new THREE.MeshStandardMaterial({
    color: 0x56605b,
    emissive: 0x1d2421,
    emissiveIntensity: 0.16,
    roughness: 0.72,
    metalness: 0.22,
  });

  fixturePositions.forEach((fixture, index) => {
    const mount = new THREE.Mesh(mountGeometry, mountMaterial);
    mount.position.set(fixture.x, CEILING_Y - 0.075, fixture.z);
    mount.rotation.y = fixture.rotation;
    mount.scale.x = fixture.panelWidth + 0.32;
    scene.add(mount);

    const tubeMaterial = new THREE.MeshStandardMaterial({
      color: fixture.color,
      emissive: fixture.color,
      emissiveIntensity: fixture.baseIntensity,
      roughness: 0.22,
    });
    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    tube.position.set(fixture.x, CEILING_Y - 0.12, fixture.z);
    tube.rotation.y = fixture.rotation;
    tube.scale.x = fixture.panelWidth;
    scene.add(tube);

    let light = null;
    if (fixture.hasPointLight && pointLightIndexes.has(index)) {
      light = createFixturePointLight(fixture, CEILING_Y - 0.32, {
        rangeScale: 1.52,
        intensityScale: 1.2,
      });
      scene.add(light);
    }

    fixtures.push({
      material: tubeMaterial,
      light,
      phase: fixture.phase,
      speed: fixture.speed,
      baseIntensity: fixture.baseIntensity,
      weak: fixture.weak,
      broken: fixture.broken,
    });
  });

  return fixtures;
}






export function addLevelOneElevator(scene, position) {
  const mount = getLevelOneTargetMount(position);
  const doorMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a5350,
    emissive: 0x111615,
    emissiveIntensity: 0.16,
    roughness: 0.58,
    metalness: 0.18,
  });
  const signMaterial = new THREE.MeshStandardMaterial({
    map: createWideSignTexture("ELEVATOR", "#15231f", "#c9ffd5"),
    color: 0xffffff,
    emissive: 0x214f37,
    emissiveIntensity: 0.42,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.28), doorMaterial);
  door.position.set(mount.x, 1.24, mount.z);
  door.rotation.y = mount.rotation;
  scene.add(door);

  const seam = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, 2.16, 0.022),
    new THREE.MeshStandardMaterial({ color: 0x202624, roughness: 0.7, metalness: 0.26 }),
  );
  seam.position.set(position.x, 1.24, mount.z + (mount.rotation === 0 ? 0.014 : -0.014));
  seam.rotation.y = mount.rotation;
  scene.add(seam);

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 0.72), signMaterial);
  sign.position.set(mount.x, 2.67, mount.z);
  sign.rotation.y = mount.rotation;
  scene.add(sign);

  const padMaterial = new THREE.MeshBasicMaterial({
    color: 0xa2ffd1,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(CELL_SIZE * 0.9, CELL_SIZE * 0.9), padMaterial);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(position.x, 0.032, position.z);
  scene.add(pad);

  const glow = new THREE.PointLight(0x94ffc8, 0.65, 7.2, 2.25);
  glow.position.set(position.x, 1.55, position.z);
  scene.add(glow);
}

export function addLevelOnePipes(scene) {
  const pipeMaterial = new THREE.MeshStandardMaterial({
    color: 0x26322e,
    roughness: 0.7,
    metalness: 0.28,
  });
  const pipeGeometry = new THREE.CylinderGeometry(0.07, 0.07, CELL_SIZE * 9.5, 14);
  const pipes = [
    { col: 9, row: 4, axis: "x" },
    { col: 18, row: 10, axis: "z" },
    { col: 27, row: 20, axis: "x" },
    { col: 6, row: 18, axis: "z" },
  ];

  pipes.forEach((pipe) => {
    const center = levelOneCellCenter(pipe.col, pipe.row);
    const mesh = new THREE.Mesh(pipeGeometry, pipeMaterial);
    mesh.position.set(center.x, CEILING_Y - 0.42, center.z);
    if (pipe.axis === "x") mesh.rotation.z = Math.PI / 2;
    if (pipe.axis === "z") mesh.rotation.x = Math.PI / 2;
    scene.add(mesh);
  });
}

export function addLevelOneCrates(scene) {
  const crateMaterial = new THREE.MeshStandardMaterial({
    color: 0x6a5840,
    emissive: 0x21180f,
    emissiveIntensity: 0.08,
    roughness: 0.86,
  });
  const darkCrateMaterial = new THREE.MeshStandardMaterial({
    color: 0x3c413a,
    emissive: 0x111511,
    emissiveIntensity: 0.06,
    roughness: 0.82,
  });
  const geometry = new THREE.BoxGeometry(1.25, 0.86, 1.15);
  const colliders = [];
  const crates = [
    { col: 12, row: 8, x: -0.72, z: -0.5, rot: 0.18, dark: false },
    { col: 14, row: 8, x: 0.45, z: 0.45, rot: -0.12, dark: true },
    { col: 16, row: 10, x: -0.3, z: 0.65, rot: 0.08, dark: false },
    { col: 25, row: 18, x: -0.54, z: -0.52, rot: 0.2, dark: true },
    { col: 27, row: 19, x: 0.58, z: 0.1, rot: -0.26, dark: false },
    { col: 29, row: 18, x: -0.2, z: 0.4, rot: 0.08, dark: true },
  ];

  crates.forEach((crate) => {
    const center = levelOneCellCenter(crate.col, crate.row);
    const mesh = new THREE.Mesh(geometry, crate.dark ? darkCrateMaterial : crateMaterial);
    mesh.position.set(center.x + crate.x, 0.43, center.z + crate.z);
    mesh.rotation.y = crate.rot;
    scene.add(mesh);

    const collider = {
      minX: mesh.position.x - 0.86,
      maxX: mesh.position.x + 0.86,
      minZ: mesh.position.z - 0.82,
      maxZ: mesh.position.z + 0.82,
    };
    mesh.userData.collider = collider;
    colliders.push(collider);
  });

  return colliders;
}

function circleIntersectsAabb(x, z, radius, bounds) {
  const closestX = Math.max(bounds.minX, Math.min(x, bounds.maxX));
  const closestZ = Math.max(bounds.minZ, Math.min(z, bounds.maxZ));
  return (x - closestX) ** 2 + (z - closestZ) ** 2 < radius ** 2;
}

export function addLevelOnePuddles(scene) {
  const puddleMaterial = new THREE.MeshBasicMaterial({
    color: 0x101816,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const puddles = [
    { col: 7, row: 18, width: 5.4, height: 2.1, rot: -0.18 },
    { col: 20, row: 12, width: 4.5, height: 1.7, rot: 0.14 },
    { col: 29, row: 9, width: 3.9, height: 1.35, rot: -0.06 },
  ];

  puddles.forEach((puddle) => {
    const center = levelOneCellCenter(puddle.col, puddle.row);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(puddle.width, puddle.height), puddleMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = puddle.rot;
    mesh.position.set(center.x, 0.026, center.z);
    scene.add(mesh);
  });
}

export function addLevelOneFloorZones(scene) {
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x1d2320,
    transparent: true,
    opacity: 0.11,
    depthWrite: false,
  });
  const supplyMaterial = new THREE.MeshBasicMaterial({
    color: 0xc7d1b3,
    transparent: true,
    opacity: 0.055,
    depthWrite: false,
  });

  const addTint = (zone, material, yOffset) => {
    const width = zone.width * CELL_SIZE;
    const height = zone.height * CELL_SIZE;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(
      LEVEL_ONE_ORIGIN_X + zone.col * CELL_SIZE + width / 2,
      yOffset,
      LEVEL_ONE_ORIGIN_Z + zone.row * CELL_SIZE + height / 2,
    );
    scene.add(mesh);
  };

  LEVEL_ONE_DARK_ZONES.forEach((zone) => addTint(zone, shadowMaterial, 0.018));
  LEVEL_ONE_SUPPLY_ZONES.forEach((zone) => addTint(zone, supplyMaterial, 0.02));
}

export function addLevelOneParkingMarks(scene) {
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: 0xd7dec8,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const hazardMaterial = new THREE.MeshBasicMaterial({
    color: 0xd6c95a,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const marks = [
    { col: 5, row: 21, width: 9.4, height: 0.09, rot: 0, hazard: false },
    { col: 5, row: 23, width: 7.8, height: 0.08, rot: 0, hazard: false },
    { col: 13, row: 8, width: 6.4, height: 0.1, rot: Math.PI / 2, hazard: true },
    { col: 16, row: 9, width: 5.2, height: 0.08, rot: 0, hazard: false },
    { col: 27, row: 18, width: 7.2, height: 0.1, rot: 0, hazard: true },
    { col: 30, row: 19, width: 5.8, height: 0.08, rot: Math.PI / 2, hazard: false },
  ];

  marks.forEach((mark) => {
    const center = levelOneCellCenter(mark.col, mark.row);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(mark.width, mark.height),
      mark.hazard ? hazardMaterial : lineMaterial,
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = mark.rot;
    mesh.position.set(center.x, 0.033, center.z);
    scene.add(mesh);
  });
}

export function addLevelOneWallSigns(scene) {
  const signs = [
    { col: 12, row: 7, text: "M.E.G. BASE", bg: "#101f1a", fg: "#c9ffd5" },
    { col: 25, row: 17, text: "SUPPLY", bg: "#263022", fg: "#e9ffbd" },
    { col: 30, row: 4, text: "ELEVATOR AHEAD", bg: "#101f1a", fg: "#9dffbe" },
    { col: 7, row: 18, text: "NO ENTRY", bg: "#221814", fg: "#ffd1a1" },
  ];

  signs.forEach((sign) => {
    const center = levelOneCellCenter(sign.col, sign.row);
    const mount = getLevelOneTargetMount(center);
    const material = new THREE.MeshStandardMaterial({
      map: createWideSignTexture(sign.text, sign.bg, sign.fg),
      color: 0xffffff,
      emissive: 0x1b3328,
      emissiveIntensity: 0.24,
      roughness: 0.55,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.54), material);
    mesh.position.set(mount.x, 1.74, mount.z);
    mesh.rotation.y = mount.rotation;
    scene.add(mesh);
  });
}

export function addLevelOneSupplyShelves(scene) {
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x2f3935,
    emissive: 0x0d1411,
    emissiveIntensity: 0.08,
    roughness: 0.68,
    metalness: 0.28,
  });
  const palletMaterial = new THREE.MeshStandardMaterial({
    color: 0x6b5637,
    emissive: 0x1d1308,
    emissiveIntensity: 0.08,
    roughness: 0.88,
  });
  const boxMaterial = new THREE.MeshStandardMaterial({
    color: 0x756248,
    emissive: 0x22180e,
    emissiveIntensity: 0.06,
    roughness: 0.86,
  });
  const colliders = [];
  const shelves = [
    { col: 12, row: 9, rot: 0.04 },
    { col: 15, row: 8, rot: -0.05 },
    { col: 26, row: 18, rot: Math.PI / 2 + 0.06 },
    { col: 29, row: 18, rot: Math.PI / 2 - 0.04 },
  ];

  shelves.forEach((shelf) => {
    const center = levelOneCellCenter(shelf.col, shelf.row);
    const group = new THREE.Group();
    group.position.set(center.x, 0, center.z);
    group.rotation.y = shelf.rot;

    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.38, 0.08), frameMaterial);
    back.position.set(0, 0.78, 0.32);
    group.add(back);

    for (let level = 0; level < 3; level += 1) {
      const shelfBoard = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 0.72), frameMaterial);
      shelfBoard.position.set(0, 0.34 + level * 0.47, 0);
      group.add(shelfBoard);
    }

    for (let i = -1; i <= 1; i += 2) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.45, 0.08), frameMaterial);
      post.position.set(i * 1.12, 0.72, -0.32);
      group.add(post);
    }

    const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.18, 0.72), palletMaterial);
    pallet.position.set(0, 0.09, -0.72);
    group.add(pallet);

    const box = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.42, 0.46), boxMaterial);
    box.position.set(-0.42, 0.59, -0.06);
    box.rotation.y = 0.08;
    group.add(box);

    scene.add(group);
    const collider = {
      minX: center.x - 1.42,
      maxX: center.x + 1.42,
      minZ: center.z - 1.05,
      maxZ: center.z + 1.05,
    };
    group.userData.collider = collider;
    colliders.push(collider);
  });

  return colliders;
}

export function collectLevelOneTransforms() {
  const northSouth = [];
  const eastWest = [];
  const fixtureCandidates = [];

  for (let row = 0; row < LEVEL_ONE_ROWS; row += 1) {
    for (let col = 0; col < LEVEL_ONE_COLS; col += 1) {
      if (!isLevelOneOpenCell(col, row)) continue;

      const center = levelOneCellCenter(col, row);
      const isDarkZone = isInAnyLevelOneZone(col, row, LEVEL_ONE_DARK_ZONES);
      const isSupplyZone = isInAnyLevelOneZone(col, row, LEVEL_ONE_SUPPLY_ZONES);
      const openNeighborCount = countLevelOneOpenNeighbors(col, row);
      const isOpenHall = openNeighborCount >= 3;

      if (!isLevelOneOpenCell(col, row - 1)) {
        northSouth.push(new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z - CELL_SIZE / 2));
      }
      if (!isLevelOneOpenCell(col, row + 1)) {
        northSouth.push(new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z + CELL_SIZE / 2));
      }
      if (!isLevelOneOpenCell(col - 1, row)) {
        eastWest.push(new THREE.Vector3(center.x - CELL_SIZE / 2, WALL_HEIGHT / 2, center.z));
      }
      if (!isLevelOneOpenCell(col + 1, row)) {
        eastWest.push(new THREE.Vector3(center.x + CELL_SIZE / 2, WALL_HEIGHT / 2, center.z));
      }

      const fixtureGrid = col % 7 === 3 && row % 5 === 2;
      const corridorGrid = col % 9 === 5 && row % 6 === 4;
      if ((fixtureGrid && !isDarkZone) || (corridorGrid && isOpenHall)) {
        fixtureCandidates.push({
          x: center.x,
          z: center.z,
          rotation: 0,
          phase: col * 0.74 + row * 1.31,
          speed: isDarkZone ? 6.2 : 3.1 + ((col + row) % 5) * 0.34,
          weak: isDarkZone ? 0.28 : isSupplyZone ? 0.06 : 0.14,
          broken: isDarkZone || (col + row) % 13 === 0,
          range: isSupplyZone ? 15 : isOpenHall ? 12.8 : 9.8,
          baseIntensity: isSupplyZone ? 1.8 : isOpenHall ? 1.22 : 0.92,
          panelWidth: isSupplyZone ? 2.95 : 2.35,
          color: isSupplyZone ? 0xeef7dc : 0xdce7d6,
          hasPointLight: isSupplyZone || isOpenHall,
          priority: (isSupplyZone ? 3 : 0) + (isOpenHall ? 2 : 0) - (isDarkZone ? 2 : 0),
        });
      }
    }
  }

  const fixturePositions = [];
  const spawnCenter = levelOneCellCenter(LEVEL_ONE_START_CELL.col, LEVEL_ONE_START_CELL.row);
  const targetCenter = levelOneCellCenter(LEVEL_ONE_TARGET_CELL.col, LEVEL_ONE_TARGET_CELL.row);
  fixtureCandidates.push(
    {
      x: spawnCenter.x,
      z: spawnCenter.z,
      rotation: 0,
      phase: 0.4,
      speed: 2.6,
      weak: 0.03,
      broken: false,
      range: 15.8,
      baseIntensity: 1.72,
      panelWidth: 2.7,
      color: 0xeef7df,
      hasPointLight: true,
      priority: 8,
    },
    {
      x: targetCenter.x,
      z: targetCenter.z,
      rotation: 0,
      phase: 1.7,
      speed: 2.9,
      weak: 0.04,
      broken: false,
      range: 15.2,
      baseIntensity: 1.66,
      panelWidth: 2.8,
      color: 0xdff5dc,
      hasPointLight: true,
      priority: 7,
    },
  );

  fixtureCandidates
    .sort((a, b) => b.priority - a.priority)
    .forEach((candidate) => {
      const tooClose = fixturePositions.some(
        (fixture) =>
          Math.hypot(fixture.x - candidate.x, fixture.z - candidate.z) <
          LEVEL_ONE_MIN_FIXTURE_DISTANCE,
      );
      if (!tooClose) fixturePositions.push(candidate);
    });

  return { northSouth, eastWest, fixturePositions };
}

