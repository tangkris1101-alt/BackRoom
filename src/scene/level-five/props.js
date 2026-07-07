import * as THREE from "three";
import { CELL_SIZE, CEILING_Y, WALL_HEIGHT } from "../constants.js";
import { createFixturePointLight } from "../common/lighting.js";
import { createWideSignTexture } from "../common/textures.js";
import { createInteractionSpot } from "../entities/interactions.js";
import {
  LEVEL_FIVE_COLS,
  LEVEL_FIVE_ROWS,
  LEVEL_FIVE_MIN_FIXTURE_DISTANCE,
  LEVEL_FIVE_MAX_POINT_LIGHTS,
  LEVEL_FIVE_START_CELL,
  LEVEL_FIVE_TARGET_CELL,
  LEVEL_FIVE_DARK_ZONES,
  LEVEL_FIVE_BOILER_ROOM,
  isLevelFiveOpenCell,
  levelFiveCellCenter,
  levelFiveCellType,
  countLevelFiveOpenNeighbors,
  getLevelFiveTargetMount,
  CELL_BALLROOM,
  CELL_BOILER,
  CELL_STAFF,
} from "./layout.js";

const S = CELL_SIZE;

function isInAnyZone(col, row, zones) {
  return zones.some(
    (zone) =>
      col >= zone.col &&
      col < zone.col + zone.width &&
      row >= zone.row &&
      row < zone.row + zone.height,
  );
}

function createPortraitTexture(seed = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 384;
  const context = canvas.getContext("2d");
  context.fillStyle = "#25130d";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#8a6a31";
  context.fillRect(16, 16, canvas.width - 32, canvas.height - 32);
  context.fillStyle = "#160908";
  context.fillRect(28, 28, canvas.width - 56, canvas.height - 56);
  context.fillStyle = "#6f4d35";
  context.beginPath();
  context.ellipse(128, 164, 44, 62, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#110706";
  context.beginPath();
  context.arc(112, 155, 6 + (seed % 3), 0, Math.PI * 2);
  context.arc(145, 155, 5 + (seed % 2), 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(230,190,98,0.28)";
  context.lineWidth = 3;
  for (let i = 0; i < 8; i += 1) {
    context.beginPath();
    context.moveTo(62 + i * 16, 250);
    context.lineTo(92 + i * 8, 330);
    context.stroke();
  }
  context.fillStyle = "rgba(0,0,0,0.24)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function collectLevelFiveTransforms() {
  const northSouth = [];
  const eastWest = [];
  const fixtureCandidates = [];

  for (let row = 0; row < LEVEL_FIVE_ROWS; row += 1) {
    for (let col = 0; col < LEVEL_FIVE_COLS; col += 1) {
      if (!isLevelFiveOpenCell(col, row)) continue;
      const center = levelFiveCellCenter(col, row);
      const type = levelFiveCellType(col, row);

      if (!isLevelFiveOpenCell(col, row - 1)) {
        northSouth.push(new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z - S / 2));
      }
      if (!isLevelFiveOpenCell(col, row + 1)) {
        northSouth.push(new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z + S / 2));
      }
      if (!isLevelFiveOpenCell(col - 1, row)) {
        eastWest.push(new THREE.Vector3(center.x - S / 2, WALL_HEIGHT / 2, center.z));
      }
      if (!isLevelFiveOpenCell(col + 1, row)) {
        eastWest.push(new THREE.Vector3(center.x + S / 2, WALL_HEIGHT / 2, center.z));
      }

      const isDark = isInAnyZone(col, row, LEVEL_FIVE_DARK_ZONES);
      const isStart = col === LEVEL_FIVE_START_CELL.col && row === LEVEL_FIVE_START_CELL.row;
      const isTarget = col === LEVEL_FIVE_TARGET_CELL.col && row === LEVEL_FIVE_TARGET_CELL.row;
      const isBallroomCenter = type === CELL_BALLROOM && col % 5 === 0 && row % 4 === 0;
      const isBoiler = type === CELL_BOILER || type === CELL_STAFF;
      const neighbors = countLevelFiveOpenNeighbors(col, row);
      const fixtureGrid = (col * 13 + row * 7) % (isBoiler ? 9 : 14) === 0;
      const isDarkFixture = isDark && !isStart && !isTarget && !isBoiler;
      if (isStart || isTarget || isBallroomCenter || (neighbors <= 3 && fixtureGrid) || isDarkFixture) {
        const eastWestOpen = isLevelFiveOpenCell(col - 1, row) || isLevelFiveOpenCell(col + 1, row);
        fixtureCandidates.push({
          x: center.x,
          z: center.z,
          rotation: eastWestOpen ? 0 : Math.PI / 2,
          phase: col * 0.47 + row * 0.93,
          speed: 1.8 + ((col + row) % 5) * 0.28,
          weak: isBoiler ? 0.34 : isDark ? 0.42 : 0.12,
          range: isStart || isTarget ? 15.5 : isBallroomCenter ? 14.2 : isBoiler ? 10.5 : isDarkFixture ? 7.2 : 11.8,
          baseIntensity: isStart || isTarget ? 1.65 : isBallroomCenter ? 1.45 : isBoiler ? 1.0 : isDarkFixture ? 0.48 : 1.18,
          color: isBoiler ? 0xff7a36 : 0xffd38a,
          priority: isStart || isTarget ? 9 : isBallroomCenter ? 6 : isBoiler ? 4 : isDarkFixture ? 0 : 2,
        });
      }
    }
  }

  const fixturePositions = [];
  fixtureCandidates
    .sort((a, b) => b.priority - a.priority)
    .forEach((candidate) => {
      const tooClose = fixturePositions.some(
        (fixture) => Math.hypot(fixture.x - candidate.x, fixture.z - candidate.z) < LEVEL_FIVE_MIN_FIXTURE_DISTANCE,
      );
      if (!tooClose) fixturePositions.push(candidate);
    });

  return { northSouth, eastWest, fixturePositions };
}

export function createLevelFiveLights(scene, fixturePositions) {
  const fixtures = [];
  const pointLightIndexes = new Set(
    fixturePositions
      .map((fixture, index) => ({ index, priority: fixture.priority }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, LEVEL_FIVE_MAX_POINT_LIGHTS)
      .map(({ index }) => index),
  );

  const canopyGeometry = new THREE.CylinderGeometry(0.18, 0.28, 0.08, 12);
  const bulbGeometry = new THREE.SphereGeometry(0.11, 12, 8);
  const brassMaterial = new THREE.MeshStandardMaterial({
    color: 0x7a5420,
    emissive: 0x1a0f03,
    emissiveIntensity: 0.22,
    roughness: 0.46,
    metalness: 0.55,
  });

  fixturePositions.forEach((fixture, index) => {
    const canopy = new THREE.Mesh(canopyGeometry, brassMaterial);
    canopy.position.set(fixture.x, CEILING_Y - 0.08, fixture.z);
    scene.add(canopy);

    const bulbMaterial = new THREE.MeshStandardMaterial({
      color: fixture.color,
      emissive: fixture.color,
      emissiveIntensity: fixture.baseIntensity,
      roughness: 0.22,
    });
    const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
    bulb.position.set(fixture.x, CEILING_Y - 0.28, fixture.z);
    scene.add(bulb);

    let light = null;
    if (pointLightIndexes.has(index)) {
      light = createFixturePointLight(fixture, CEILING_Y - 0.42, {
        rangeScale: 1.72,
        intensityScale: 1.34,
        decay: 2.1,
      });
      scene.add(light);
    }

    fixtures.push({
      material: bulbMaterial,
      light,
      phase: fixture.phase,
      speed: fixture.speed,
      weak: fixture.weak,
      baseIntensity: fixture.baseIntensity,
    });
  });

  return fixtures;
}

export function addLevelFiveExitDoor(scene, position) {
  const mount = getLevelFiveTargetMount(position);
  const doorMaterial = new THREE.MeshStandardMaterial({
    color: 0x2b2019,
    emissive: 0x120704,
    emissiveIntensity: 0.18,
    roughness: 0.72,
    metalness: 0.08,
  });
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.74, 2.5, 0.1), doorMaterial);
  door.position.set(mount.x, 1.25, mount.z);
  door.rotation.y = mount.rotation;
  scene.add(door);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.35, 0.54),
    new THREE.MeshStandardMaterial({
      map: createWideSignTexture("BOILER EXIT", "#2a1209", "#ffd78a"),
      color: 0xffffff,
      emissive: 0xff8a3d,
      emissiveIntensity: 0.22,
      roughness: 0.42,
      side: THREE.DoubleSide,
    }),
  );
  sign.position.set(mount.x, 2.58, mount.z);
  sign.rotation.y = mount.rotation;
  scene.add(sign);
}

export function addLevelFiveHotelDetails(scene, interactionInitial = {}) {
  const colliders = [];
  const interactions = [];

  const addCollider = (x, z, halfX, halfZ) => {
    colliders.push({ minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ });
  };

  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0x3d1e13,
    emissive: 0x100503,
    emissiveIntensity: 0.1,
    roughness: 0.64,
    metalness: 0.06,
  });
  const darkWoodMaterial = new THREE.MeshStandardMaterial({
    color: 0x1d100b,
    emissive: 0x070302,
    emissiveIntensity: 0.12,
    roughness: 0.72,
  });
  const brassMaterial = new THREE.MeshStandardMaterial({
    color: 0x9b6d25,
    emissive: 0x241202,
    emissiveIntensity: 0.18,
    roughness: 0.36,
    metalness: 0.62,
  });
  const fabricMaterial = new THREE.MeshStandardMaterial({
    color: 0x6c1f1a,
    emissive: 0x160504,
    emissiveIntensity: 0.08,
    roughness: 0.82,
  });
  const boilerMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a312b,
    emissive: 0x160805,
    emissiveIntensity: 0.14,
    roughness: 0.78,
    metalness: 0.48,
  });
  const glassMaterial = new THREE.MeshBasicMaterial({
    color: 0x030202,
    transparent: true,
    opacity: 0.84,
    depthWrite: false,
  });

  function addBox({ col, row, width = 1, depth = 1, height = 1, y = height / 2, material, offsetX = 0, offsetZ = 0, collider = true }) {
    const center = levelFiveCellCenter(col, row);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(center.x + offsetX, y, center.z + offsetZ);
    scene.add(mesh);
    if (collider) addCollider(center.x + offsetX, center.z + offsetZ, width / 2, depth / 2);
    return mesh;
  }

  [
    { col: 6, row: 14 },
    { col: 18, row: 14 },
    { col: 26, row: 14 },
    { col: 8, row: 20 },
    { col: 29, row: 19 },
  ].forEach((spot) => {
    addBox({ ...spot, width: 1.52, depth: 0.62, height: 0.52, y: 0.34, material: fabricMaterial });
    addBox({ ...spot, width: 1.42, depth: 0.16, height: 0.78, y: 0.78, offsetZ: 0.31, material: fabricMaterial, collider: false });
  });

  [
    { col: 10, row: 7 },
    { col: 18, row: 6 },
    { col: 25, row: 7 },
    { col: 38, row: 7 },
    { col: 21, row: 20 },
  ].forEach((spot) => {
    addBox({ ...spot, width: 1.2, depth: 0.42, height: 1.82, y: 0.91, material: darkWoodMaterial });
  });

  const tableCenter = levelFiveCellCenter(21, 13);
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.02, 0.22, 18), woodMaterial);
  table.position.set(tableCenter.x, 0.62, tableCenter.z);
  scene.add(table);
  addCollider(tableCenter.x, tableCenter.z, 0.98, 0.98);
  for (let i = 0; i < 9; i += 1) {
    const tile = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.26), brassMaterial);
    const angle = (i / 9) * Math.PI * 2;
    tile.position.set(tableCenter.x + Math.cos(angle) * 0.46, 0.75, tableCenter.z + Math.sin(angle) * 0.32);
    tile.rotation.y = angle;
    scene.add(tile);
  }

  const chandelierBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.9, 12), brassMaterial);
  chandelierBase.position.set(tableCenter.x, CEILING_Y - 0.68, tableCenter.z);
  scene.add(chandelierBase);
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.045, 0.045), brassMaterial);
    arm.position.set(tableCenter.x + Math.cos(angle) * 0.34, CEILING_Y - 0.78, tableCenter.z + Math.sin(angle) * 0.34);
    arm.rotation.y = -angle;
    scene.add(arm);
  }

  interactions.push(
    createInteractionSpot({
      id: "level-five-beverly-table",
      position: tableCenter,
      inspectHeight: 0.78,
      inspectRadius: 0.98,
      responseKey: "levelFiveBeverlyTableResponse",
      initialState: interactionInitial["level-five-beverly-table"] ?? null,
    }),
  );

  [
    { col: 4, row: 13, text: "118" },
    { col: 13, row: 13, text: "009" },
    { col: 24, row: 13, text: "312" },
    { col: 34, row: 13, text: "041" },
    { col: 36, row: 17, text: "STAFF ONLY" },
  ].forEach((spot) => {
    const center = levelFiveCellCenter(spot.col, spot.row);
    const mount = getLevelFiveTargetMount(center);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 2.28), new THREE.MeshStandardMaterial({
      color: spot.text === "STAFF ONLY" ? 0x201714 : 0x362018,
      emissive: 0x0c0402,
      emissiveIntensity: 0.1,
      roughness: 0.74,
      side: THREE.DoubleSide,
    }));
    door.position.set(mount.x, 1.18, mount.z);
    door.rotation.y = mount.rotation;
    scene.add(door);

    const placard = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.24), new THREE.MeshStandardMaterial({
      map: createWideSignTexture(spot.text, "#806026", "#180b04"),
      color: 0xffffff,
      roughness: 0.5,
      side: THREE.DoubleSide,
    }));
    placard.position.set(mount.x, 1.82, mount.z);
    placard.rotation.y = mount.rotation;
    scene.add(placard);
  });

  [
    { col: 16, row: 8, id: "level-five-portrait-a", seed: 1 },
    { col: 27, row: 12, id: "level-five-portrait-b", seed: 2 },
    { col: 39, row: 14, id: "level-five-portrait-c", seed: 3 },
  ].forEach((spot) => {
    const center = levelFiveCellCenter(spot.col, spot.row);
    const mount = getLevelFiveTargetMount(center);
    const portrait = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 1.22), new THREE.MeshStandardMaterial({
      map: createPortraitTexture(spot.seed),
      color: 0xffffff,
      emissive: 0x090302,
      emissiveIntensity: 0.12,
      roughness: 0.62,
      side: THREE.DoubleSide,
    }));
    portrait.position.set(mount.x, 1.72, mount.z);
    portrait.rotation.y = mount.rotation;
    scene.add(portrait);
    interactions.push(
      createInteractionSpot({
        id: spot.id,
        position: center,
        inspectHeight: 1.62,
        inspectRadius: 0.82,
        responseKey: "levelFivePortraitResponse",
        initialState: interactionInitial[spot.id] ?? null,
      }),
    );
  });

  [
    { col: 6, row: 5 },
    { col: 28, row: 5 },
    { col: 39, row: 8 },
  ].forEach((spot) => {
    const center = levelFiveCellCenter(spot.col, spot.row);
    const mount = getLevelFiveTargetMount(center);
    const windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.05), glassMaterial);
    windowMesh.position.set(mount.x, 1.76, mount.z);
    windowMesh.rotation.y = mount.rotation;
    scene.add(windowMesh);
  });

  const boilerFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(LEVEL_FIVE_BOILER_ROOM.width * S, LEVEL_FIVE_BOILER_ROOM.height * S),
    new THREE.MeshBasicMaterial({ color: 0x1a120f, transparent: true, opacity: 0.48, depthWrite: false }),
  );
  boilerFloor.rotation.x = -Math.PI / 2;
  boilerFloor.position.set(
    levelFiveCellCenter(LEVEL_FIVE_BOILER_ROOM.col, LEVEL_FIVE_BOILER_ROOM.row).x + (LEVEL_FIVE_BOILER_ROOM.width - 1) * S / 2,
    0.035,
    levelFiveCellCenter(LEVEL_FIVE_BOILER_ROOM.col, LEVEL_FIVE_BOILER_ROOM.row).z + (LEVEL_FIVE_BOILER_ROOM.height - 1) * S / 2,
  );
  scene.add(boilerFloor);

  [
    { col: 36, row: 21, axis: "z", length: 4.2 },
    { col: 39, row: 21, axis: "z", length: 4.8 },
    { col: 37, row: 24, axis: "x", length: 5.6 },
  ].forEach((pipe) => {
    const center = levelFiveCellCenter(pipe.col, pipe.row);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, pipe.length, 12), boilerMaterial);
    mesh.position.set(center.x, 1.48, center.z);
    if (pipe.axis === "x") mesh.rotation.z = Math.PI / 2;
    if (pipe.axis === "z") mesh.rotation.x = Math.PI / 2;
    scene.add(mesh);
  });

  [
    { col: 35, row: 22 },
    { col: 41, row: 21 },
  ].forEach((tank) => {
    addBox({ ...tank, width: 1.05, depth: 1.05, height: 1.84, y: 0.92, material: boilerMaterial });
  });

  const valveCenter = levelFiveCellCenter(38, 22);
  const valve = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 18), brassMaterial);
  valve.position.set(valveCenter.x, 1.28, valveCenter.z);
  valve.rotation.y = Math.PI / 2;
  scene.add(valve);
  interactions.push(
    createInteractionSpot({
      id: "level-five-boiler-valve",
      position: valveCenter,
      inspectHeight: 1.18,
      inspectRadius: 0.78,
      responseKey: "levelFiveBoilerValveResponse",
      initialState: interactionInitial["level-five-boiler-valve"] ?? null,
    }),
  );

  [
    { col: 6, row: 21, id: "level-five-dining-cart", responseKey: "levelFiveDiningCartResponse" },
    { col: 36, row: 17, id: "level-five-staff-door", responseKey: "levelFiveStaffDoorResponse" },
  ].forEach((spot) => {
    const center = levelFiveCellCenter(spot.col, spot.row);
    if (spot.id.includes("cart")) {
      addBox({ ...spot, width: 1.1, depth: 0.58, height: 0.74, y: 0.37, material: brassMaterial });
    }
    interactions.push(
      createInteractionSpot({
        id: spot.id,
        position: center,
        inspectHeight: spot.id.includes("door") ? 1.54 : 0.76,
        inspectRadius: 0.82,
        responseKey: spot.responseKey,
        initialState: interactionInitial[spot.id] ?? null,
      }),
    );
  });

  return { colliders, interactions };
}
