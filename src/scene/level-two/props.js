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
isLevelTwoOpenCell,
  levelTwoCellCenter,
  countLevelTwoOpenNeighbors,
  getLevelTwoTargetMount,
} from "./layout.js";

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
}) {
  const northSouth = [];
  const eastWest = [];
  const fixtureCandidates = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!isCellOpen(col, row)) continue;

      const center = getCellCenter(col, row);
      const isDarkPocket = isInAnyZone(col, row, darkZones);
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

      const neighbors = countOpenNeighbors(col, row);
      const eastWestOpen = isCellOpen(col - 1, row) || isCellOpen(col + 1, row);
      const isCorridor = neighbors <= 2;
      const fixtureGrid = (col * 11 + row * 7) % 17 === 0;
      const isStart = col === startCell.col && row === startCell.row;
      const isTarget = col === targetCell.col && row === targetCell.row;
      const isCriticalFixture = isStart || isTarget;
      if (isDarkPocket && !isCriticalFixture) continue;
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
          panelWidth: 1.35 + ((col + row) % 2) * 0.38,
          color: (col + row) % 4 === 0 ? 0xff7a3d : 0xffb05c,
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
  const panelGeometry = new THREE.BoxGeometry(1, 0.045, 0.34);
  const cageGeometry = new THREE.BoxGeometry(1, 0.05, 0.48);
  const cageMaterial = new THREE.MeshStandardMaterial({
    color: 0x2b2218,
    emissive: 0x140b05,
    emissiveIntensity: 0.24,
    roughness: 0.82,
    metalness: 0.36,
  });

  fixturePositions.forEach((fixture, index) => {
    const cage = new THREE.Mesh(cageGeometry, cageMaterial);
    cage.position.set(fixture.x, CEILING_Y - 0.095, fixture.z);
    cage.rotation.y = fixture.rotation;
    cage.scale.x = fixture.panelWidth + 0.2;
    scene.add(cage);

    const panelMaterial = new THREE.MeshStandardMaterial({
      color: fixture.color,
      emissive: fixture.color,
      emissiveIntensity: fixture.baseIntensity,
      roughness: 0.34,
    });
    const panel = new THREE.Mesh(panelGeometry, panelMaterial);
    panel.position.set(fixture.x, CEILING_Y - 0.145, fixture.z);
    panel.rotation.y = fixture.rotation;
    panel.scale.x = fixture.panelWidth;
    scene.add(panel);

    let light = null;
    if (pointLightIndexes.has(index)) {
      light = createFixturePointLight(fixture, CEILING_Y - 0.44, {
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

export function addLevelTwoPipe(scene, pipeMaterial, pipe) {
  const center = levelTwoCellCenter(pipe.col, pipe.row);
  const geometry = new THREE.CylinderGeometry(pipe.radius, pipe.radius, pipe.length, 14);
  const mesh = new THREE.Mesh(geometry, pipeMaterial);
  mesh.position.set(center.x + (pipe.offsetX ?? 0), pipe.y, center.z + (pipe.offsetZ ?? 0));
  if (pipe.axis === "x") mesh.rotation.z = Math.PI / 2;
  if (pipe.axis === "z") mesh.rotation.x = Math.PI / 2;
  scene.add(mesh);

  if (pipe.joint) {
    const joint = new THREE.Mesh(new THREE.SphereGeometry(pipe.radius * 1.35, 12, 8), pipeMaterial);
    joint.position.copy(mesh.position);
    scene.add(joint);
  }
}

export function addLevelTwoPipes(scene) {
  const pipeMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a322a,
    emissive: 0x100a05,
    emissiveIntensity: 0.12,
    roughness: 0.76,
    metalness: 0.36,
  });
  const hotPipeMaterial = new THREE.MeshStandardMaterial({
    color: 0x57301c,
    emissive: 0x2b0d04,
    emissiveIntensity: 0.2,
    roughness: 0.7,
    metalness: 0.32,
  });
  const pipes = [
    { col: 8, row: 3, axis: "x", length: CELL_SIZE * 11, radius: 0.08, y: CEILING_Y - 0.48, offsetZ: -0.9 },
    { col: 14, row: 8, axis: "z", length: CELL_SIZE * 8.5, radius: 0.11, y: CEILING_Y - 0.36, offsetX: -0.95, hot: true, joint: true },
    { col: 20, row: 10, axis: "x", length: CELL_SIZE * 9, radius: 0.07, y: 2.55, offsetZ: 1.0 },
    { col: 8, row: 16, axis: "z", length: CELL_SIZE * 7, radius: 0.1, y: 2.8, offsetX: 0.88, hot: true },
    { col: 22, row: 19, axis: "x", length: CELL_SIZE * 17, radius: 0.09, y: CEILING_Y - 0.52, offsetZ: -1.05 },
    { col: 30, row: 15, axis: "z", length: CELL_SIZE * 9, radius: 0.12, y: 2.38, offsetX: 1.05, joint: true },
    { col: 32, row: 11, axis: "x", length: CELL_SIZE * 8, radius: 0.065, y: CEILING_Y - 0.68, offsetZ: 0.82 },
  ];

  pipes.forEach((pipe) => addLevelTwoPipe(scene, pipe.hot ? hotPipeMaterial : pipeMaterial, pipe));
}

export function addLevelTwoMachinery(scene) {
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x27251f,
    emissive: 0x090704,
    emissiveIntensity: 0.1,
    roughness: 0.8,
    metalness: 0.26,
  });
  const rustMaterial = new THREE.MeshStandardMaterial({
    color: 0x5a3621,
    emissive: 0x160804,
    emissiveIntensity: 0.1,
    roughness: 0.88,
    metalness: 0.18,
  });
  const meterMaterial = new THREE.MeshBasicMaterial({ color: 0xffa05a });
  const colliders = [];
  const machines = [
    { col: 5, row: 7, width: 1.35, height: 1.15, depth: 1.0, x: 0.6, z: -0.5, rot: 0.05 },
    { col: 20, row: 7, width: 1.65, height: 1.35, depth: 0.85, x: -0.4, z: 0.5, rot: -0.12, rust: true },
    { col: 13, row: 15, width: 1.2, height: 1.0, depth: 1.25, x: 0.45, z: -0.35, rot: 0.16 },
    { col: 27, row: 15, width: 1.6, height: 1.55, depth: 1.15, x: -0.55, z: 0.42, rot: -0.06, rust: true },
    { col: 33, row: 19, width: 1.28, height: 1.08, depth: 1.0, x: 0.2, z: 0.3, rot: 0.18 },
  ];

  machines.forEach((machine) => {
    const center = levelTwoCellCenter(machine.col, machine.row);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(machine.width, machine.height, machine.depth),
      machine.rust ? rustMaterial : bodyMaterial,
    );
    mesh.position.set(center.x + machine.x, machine.height / 2, center.z + machine.z);
    mesh.rotation.y = machine.rot;
    scene.add(mesh);

    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.018), meterMaterial);
    panel.position.set(mesh.position.x, mesh.position.y + machine.height * 0.18, mesh.position.z - machine.depth / 2 - 0.012);
    panel.rotation.y = machine.rot;
    scene.add(panel);

    colliders.push({
      minX: mesh.position.x - machine.width * 0.62,
      maxX: mesh.position.x + machine.width * 0.62,
      minZ: mesh.position.z - machine.depth * 0.62,
      maxZ: mesh.position.z + machine.depth * 0.62,
    });
  });

  return colliders;
}

export function addLevelTwoSteam(scene) {
  const puffs = [];
  const geometry = new THREE.SphereGeometry(0.34, 12, 8);
  const vents = [
    { col: 14, row: 8, x: -1.05, z: 0.48, phase: 0.2 },
    { col: 8, row: 16, x: 0.9, z: -0.35, phase: 1.6 },
    { col: 30, row: 15, x: 1.0, z: 0.42, phase: 2.7 },
    { col: 23, row: 19, x: -0.4, z: -1.0, phase: 3.3 },
  ];

  vents.forEach((vent) => {
    const center = levelTwoCellCenter(vent.col, vent.row);
    const material = new THREE.MeshBasicMaterial({
      color: 0xd8cdb6,
      transparent: true,
      opacity: 0.08,
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
    opacity: 0.055,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const zones = [
    { col: 13, row: 9, width: 3.2, height: 5.8, rot: 0.08 },
    { col: 29, row: 16, width: 3.6, height: 4.8, rot: -0.11 },
    { col: 21, row: 19, width: 6.4, height: 2.0, rot: 0.02 },
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
    opacity: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ceilingMaterial = new THREE.MeshBasicMaterial({
    color: 0x050403,
    transparent: true,
    opacity: 0.1,
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

export function addLevelTwoIndustrialDetails(scene) {
  const cableMaterial = new THREE.MeshStandardMaterial({
    color: 0x050606,
    emissive: 0x010202,
    emissiveIntensity: 0.12,
    roughness: 0.7,
    metalness: 0.2,
  });
  const cableGeometry = new THREE.CylinderGeometry(0.028, 0.028, 1, 8);
  const cables = [
    { col: 4, row: 3, axis: "x", length: CELL_SIZE * 9.5, y: CEILING_Y - 0.18, offsetZ: 0.86 },
    { col: 14, row: 10, axis: "z", length: CELL_SIZE * 8, y: CEILING_Y - 0.2, offsetX: 0.78 },
    { col: 21, row: 19, axis: "x", length: CELL_SIZE * 14, y: CEILING_Y - 0.16, offsetZ: -0.9 },
    { col: 30, row: 14, axis: "z", length: CELL_SIZE * 6.5, y: CEILING_Y - 0.2, offsetX: -0.82 },
  ];
  cables.forEach((cable) => {
    const center = levelTwoCellCenter(cable.col, cable.row);
    const mesh = new THREE.Mesh(cableGeometry, cableMaterial);
    mesh.scale.y = cable.length;
    mesh.position.set(center.x + (cable.offsetX ?? 0), cable.y, center.z + (cable.offsetZ ?? 0));
    if (cable.axis === "x") mesh.rotation.z = Math.PI / 2;
    if (cable.axis === "z") mesh.rotation.x = Math.PI / 2;
    scene.add(mesh);
  });

  const signs = [
    { col: 14, row: 4, text: "LOW PRESSURE", bg: "#251308", fg: "#ffbd73" },
    { col: 20, row: 10, text: "MAINTENANCE", bg: "#17130d", fg: "#ffd78a" },
    { col: 29, row: 18, text: "PIPE DREAMS", bg: "#211006", fg: "#ff945c" },
    { col: 34, row: 19, text: "KEEP MOVING", bg: "#1b1109", fg: "#ffca8f" },
  ];
  signs.forEach((sign) => {
    const center = levelTwoCellCenter(sign.col, sign.row);
    const mount = getLevelTwoTargetMount(center);
    const material = new THREE.MeshStandardMaterial({
      map: createWideSignTexture(sign.text, sign.bg, sign.fg),
      color: 0xffffff,
      emissive: 0x4c1d0a,
      emissiveIntensity: 0.28,
      roughness: 0.64,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.5), material);
    mesh.position.set(mount.x, 1.62, mount.z);
    mesh.rotation.y = mount.rotation;
    scene.add(mesh);
  });

  const valveMaterial = new THREE.MeshStandardMaterial({
    color: 0x6b3520,
    emissive: 0x1a0703,
    emissiveIntensity: 0.16,
    roughness: 0.72,
    metalness: 0.22,
  });
  const valveLocations = [
    { col: 14, row: 8 },
    { col: 8, row: 16 },
    { col: 30, row: 15 },
    { col: 23, row: 19 },
  ];
  valveLocations.forEach((location) => {
    const center = levelTwoCellCenter(location.col, location.row);
    const mount = getLevelTwoTargetMount(center);
    const valve = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.026, 8, 24), valveMaterial);
    valve.position.set(mount.x, 1.44, mount.z);
    valve.rotation.y = mount.rotation;
    scene.add(valve);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 12), valveMaterial);
    hub.position.copy(valve.position);
    hub.rotation.x = Math.PI / 2;
    hub.rotation.y = mount.rotation;
    scene.add(hub);
  });

  const grateMaterial = new THREE.MeshBasicMaterial({
    color: 0x050504,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const grates = [
    { col: 14, row: 10, width: 2.6, height: 1.1, rot: 0 },
    { col: 8, row: 19, width: 2.2, height: 1.2, rot: Math.PI / 2 },
    { col: 30, row: 12, width: 2.7, height: 1.15, rot: 0 },
  ];
  grates.forEach((grate) => {
    const center = levelTwoCellCenter(grate.col, grate.row);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(grate.width, grate.height), grateMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = grate.rot;
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
  const barrels = [
    { col: 5, row: 7, x: -0.65, z: 0.5 },
    { col: 19, row: 6, x: 0.54, z: -0.62 },
    { col: 26, row: 14, x: -0.48, z: 0.56 },
    { col: 32, row: 18, x: 0.58, z: -0.48 },
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

    colliders.push({
      minX: mesh.position.x - 0.42,
      maxX: mesh.position.x + 0.42,
      minZ: mesh.position.z - 0.42,
      maxZ: mesh.position.z + 0.42,
    });
  });

  const barriers = [
    { col: 13, row: 15, x: 0.24, z: 0.6, rot: 0.22 },
    { col: 28, row: 16, x: -0.36, z: -0.48, rot: -0.2 },
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



