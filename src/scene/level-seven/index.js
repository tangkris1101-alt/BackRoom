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
} from "../constants.js";
import { addInstancedBoxes, updateFixturePointLight, createStableLightState } from "../common/lighting.js";
import { attachFirstPersonViewModel, getViewModelName, updateFirstPersonHazmatViewModel } from "../common/view-model.js";
import { createWideSignTexture } from "../common/textures.js";
import { createExitNetwork } from "../common/exit-network.js";
import { snapEntityStates } from "../common/snap.js";
import { createInteractionSpot, getPickupTarget, tryPickupItems, getFocusedEntity, getFocusedInteraction, getFocusedItem, tryInteractWithSpots } from "../entities/index.js";
import {
  createAlmondWaterPickup,
  createCompassPickup,
  createDetectorPickup,
  createFlashlightPickup,
  createSilenceLiquidPickup,
} from "../items/index.js";
import {
  LEVEL_SEVEN_COLS,
  LEVEL_SEVEN_ROWS,
  LEVEL_SEVEN_START_CELL,
  LEVEL_SEVEN_TARGET_CELL,
  LEVEL_SEVEN_DARK_WATER_ZONES,
  isLevelSevenOpenCell,
  isLevelSevenWaterCell,
  levelSevenCellCenter,
  levelSevenWorldToCell,
  getLevelSevenTargetMount,
} from "./layout.js";
import {
  createLevelSevenRoomFloorTexture,
  createLevelSevenWallpaperTexture,
  createLevelSevenCeilingTexture,
  createLevelSevenWaterTexture,
} from "./textures.js";
import { createLevelSevenThingEntity } from "./thing.js";

function collectLevelSevenTransforms() {
  const northSouth = [];
  const eastWest = [];
  const fixturePositions = [];
  for (let row = 0; row < LEVEL_SEVEN_ROWS; row += 1) {
    for (let col = 0; col < LEVEL_SEVEN_COLS; col += 1) {
      if (!isLevelSevenOpenCell(col, row)) continue;
      const center = levelSevenCellCenter(col, row);
      if (!isLevelSevenOpenCell(col, row - 1)) {
        northSouth.push(new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z - CELL_SIZE / 2));
      }
      if (!isLevelSevenOpenCell(col, row + 1)) {
        northSouth.push(new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z + CELL_SIZE / 2));
      }
      if (!isLevelSevenOpenCell(col - 1, row)) {
        eastWest.push(new THREE.Vector3(center.x - CELL_SIZE / 2, WALL_HEIGHT / 2, center.z));
      }
      if (!isLevelSevenOpenCell(col + 1, row)) {
        eastWest.push(new THREE.Vector3(center.x + CELL_SIZE / 2, WALL_HEIGHT / 2, center.z));
      }

      const isStart = col === LEVEL_SEVEN_START_CELL.col && row === LEVEL_SEVEN_START_CELL.row;
      const isExit = col === LEVEL_SEVEN_TARGET_CELL.col && row === LEVEL_SEVEN_TARGET_CELL.row;
      const sparseBulb = isLevelSevenWaterCell(col, row) && (col * 7 + row * 11) % 29 === 0;
      if (isStart || isExit || sparseBulb) {
        fixturePositions.push({
          x: center.x,
          z: center.z,
          rotation: isLevelSevenOpenCell(col - 1, row) || isLevelSevenOpenCell(col + 1, row) ? 0 : Math.PI / 2,
          phase: col * 0.7 + row * 0.43,
          speed: 1.4 + ((col + row) % 4) * 0.2,
          weak: sparseBulb ? 0.55 : 0.18,
          range: isStart || isExit ? 14 : 7.2,
          baseIntensity: isStart || isExit ? 0.92 : 0.34,
          panelWidth: isStart || isExit ? 1.0 : 0.42,
          color: isExit ? 0x9ce9ff : 0xffd4a2,
          hasPointLight: true,
          priority: isStart || isExit ? 8 : 1,
        });
      }
    }
  }
  return { northSouth, eastWest, fixturePositions };
}

function createLevelSevenLights(scene, fixturePositions) {
  const fixtures = [];
  const pointLightIndexes = new Set(
    fixturePositions
      .map((fixture, index) => ({ index, priority: fixture.priority }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 10)
      .map(({ index }) => index),
  );
  const bulbGeometry = new THREE.SphereGeometry(0.11, 14, 10);
  const socketGeometry = new THREE.CylinderGeometry(0.12, 0.16, 0.16, 12);
  const socketMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1410,
    emissive: 0x080403,
    emissiveIntensity: 0.16,
    roughness: 0.72,
    metalness: 0.18,
  });

  fixturePositions.forEach((fixture, index) => {
    const socket = new THREE.Mesh(socketGeometry, socketMaterial);
    socket.position.set(fixture.x, CEILING_Y - 0.12, fixture.z);
    scene.add(socket);

    const bulbMaterial = new THREE.MeshStandardMaterial({
      color: fixture.color,
      emissive: fixture.color,
      emissiveIntensity: fixture.baseIntensity,
      roughness: 0.34,
    });
    const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
    bulb.position.set(fixture.x, CEILING_Y - 0.24, fixture.z);
    scene.add(bulb);

    let light = null;
    if (pointLightIndexes.has(index)) {
      light = new THREE.PointLight(fixture.color, fixture.baseIntensity * 1.6, fixture.range, 2.1);
      light.position.set(fixture.x, CEILING_Y - 0.35, fixture.z);
      light.userData.intensityScale = 1.6;
      scene.add(light);
    }
    fixtures.push({ ...fixture, material: bulbMaterial, light });
  });
  return fixtures;
}

function addLevelSevenWater(scene) {
  const waterMaterial = new THREE.MeshPhysicalMaterial({
    map: createLevelSevenWaterTexture(),
    color: 0x7eb7bd,
    emissive: 0x071b20,
    emissiveIntensity: 0.32,
    transparent: true,
    opacity: 0.82,
    roughness: 0.22,
    metalness: 0.02,
    transmission: 0.08,
    thickness: 0.08,
  });
  [
    { col: 10, row: 7, width: 30, height: 20 },
    { col: 6, row: 17, width: 8, height: 6 },
    { col: 16, row: 4, width: 7, height: 5 },
  ].forEach((zone) => {
    const x = -(LEVEL_SEVEN_COLS * CELL_SIZE) / 2 + zone.col * CELL_SIZE + (zone.width * CELL_SIZE) / 2;
    const z = -(LEVEL_SEVEN_ROWS * CELL_SIZE) / 2 + zone.row * CELL_SIZE + (zone.height * CELL_SIZE) / 2;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(zone.width * CELL_SIZE, zone.height * CELL_SIZE), waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.set(x, 0.035, z);
    scene.add(water);
  });
}

function addLevelSevenExit(scene, targetPosition) {
  const hatchMaterial = new THREE.MeshStandardMaterial({
    color: 0x172a2e,
    emissive: 0x03191d,
    emissiveIntensity: 0.34,
    roughness: 0.7,
    metalness: 0.28,
  });
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.72, 0.16, 28), hatchMaterial);
  hatch.position.set(targetPosition.x, 0.18, targetPosition.z);
  scene.add(hatch);

  const postMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9e7c8,
    emissive: 0x334a36,
    emissiveIntensity: 0.22,
    roughness: 0.48,
  });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.7, 12), postMaterial);
  post.position.set(targetPosition.x - 0.54, 0.92, targetPosition.z + 0.34);
  scene.add(post);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.72, 0.5),
    new THREE.MeshStandardMaterial({
      map: createWideSignTexture("SURFACE", "#06191c", "#a8f6ff"),
      color: 0xffffff,
      emissive: 0x54d8ff,
      emissiveIntensity: 0.32,
      roughness: 0.52,
      side: THREE.DoubleSide,
    }),
  );
  sign.position.set(targetPosition.x - 0.54, 1.78, targetPosition.z + 0.34);
  sign.rotation.y = Math.PI * 0.16;
  scene.add(sign);

  const glow = new THREE.PointLight(0x88e7ff, 0.75, 9, 2.2);
  glow.position.set(targetPosition.x, 1.0, targetPosition.z);
  scene.add(glow);
}

function addLevelSevenDetails(scene, interactionInitial = {}) {
  const colliders = [];
  const interactions = [];
  const addCollider = (x, z, halfX, halfZ) => {
    colliders.push({ minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ });
  };

  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a2619,
    emissive: 0x0b0502,
    emissiveIntensity: 0.16,
    roughness: 0.82,
  });
  const buoyMaterial = new THREE.MeshStandardMaterial({
    color: 0xb33124,
    emissive: 0x230604,
    emissiveIntensity: 0.28,
    roughness: 0.58,
  });
  const darkPatchMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });

  LEVEL_SEVEN_DARK_WATER_ZONES.forEach((zone) => {
    const x = -(LEVEL_SEVEN_COLS * CELL_SIZE) / 2 + zone.col * CELL_SIZE + (zone.width * CELL_SIZE) / 2;
    const z = -(LEVEL_SEVEN_ROWS * CELL_SIZE) / 2 + zone.row * CELL_SIZE + (zone.height * CELL_SIZE) / 2;
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(zone.width * CELL_SIZE, zone.height * CELL_SIZE), darkPatchMaterial);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(x, 0.06, z);
    scene.add(patch);
  });

  [
    { col: 15, row: 13, rot: 0.18 },
    { col: 26, row: 16, rot: -0.4 },
    { col: 9, row: 20, rot: 0.7 },
  ].forEach((spot) => {
    const center = levelSevenCellCenter(spot.col, spot.row);
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.42), woodMaterial);
    plank.position.set(center.x, 0.13, center.z);
    plank.rotation.y = spot.rot;
    plank.rotation.z = (Math.random() - 0.5) * 0.1;
    scene.add(plank);
    addCollider(center.x, center.z, 0.9, 0.24);
  });

  [
    { col: 18, row: 9 },
    { col: 32, row: 23 },
  ].forEach((spot) => {
    const center = levelSevenCellCenter(spot.col, spot.row);
    const buoy = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.55, 16), buoyMaterial);
    buoy.position.set(center.x, 0.32, center.z);
    buoy.rotation.x = (Math.random() - 0.5) * 0.28;
    buoy.rotation.z = (Math.random() - 0.5) * 0.28;
    scene.add(buoy);
  });

  [
    { col: 4, row: 3, id: "level-seven-room" },
    { col: 13, row: 8, id: "level-seven-waterline" },
    { col: 32, row: 23, id: "level-seven-buoy" },
  ].forEach((spot) => {
    const center = levelSevenCellCenter(spot.col, spot.row);
    interactions.push(
      createInteractionSpot({
        id: spot.id,
        position: center,
        inspectHeight: spot.id === "level-seven-buoy" ? 0.6 : 1.25,
        inspectRadius: 0.8,
        responseKey: `${spot.id}Response`,
        initialState: interactionInitial[spot.id] ?? null,
      }),
    );
  });

  return { colliders, interactions };
}

export function createLevelSevenScene({ initialState = null } = {}) {
  const scene = new THREE.Scene();
  const FOG_COLOR = 0x07161a;
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0105);

  const cameraFar = Math.hypot(LEVEL_SEVEN_COLS * CELL_SIZE, LEVEL_SEVEN_ROWS * CELL_SIZE) + CELL_SIZE * 2;
  const camera = new THREE.PerspectiveCamera(74, 1, 0.05, cameraFar);
  const viewModel = attachFirstPersonViewModel(camera);
  scene.add(camera);

  const spawnCell = levelSevenCellCenter(LEVEL_SEVEN_START_CELL.col, LEVEL_SEVEN_START_CELL.row);
  const spawn = { x: spawnCell.x, z: spawnCell.z, yaw: LEVEL_SEVEN_START_CELL.yaw };
  const targetPosition = levelSevenCellCenter(LEVEL_SEVEN_TARGET_CELL.col, LEVEL_SEVEN_TARGET_CELL.row);
  const pickupInitial = initialState?.pickups ?? {};
  const interactionInitial = initialState?.interactions ?? {};
  const objectiveInitial = initialState?.objectives ?? {};

  const { colliders: propColliders, interactions: propInteractions } = addLevelSevenDetails(scene, interactionInitial);
  const entityInitial = snapEntityStates(
    Array.isArray(initialState?.entities) ? initialState.entities : [],
    isWalkable,
  );
  addLevelSevenWater(scene);

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: createLevelSevenRoomFloorTexture(),
    color: 0xffffff,
    emissive: 0x17110d,
    emissiveIntensity: 0.42,
    roughness: 0.94,
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: createLevelSevenWallpaperTexture(),
    color: 0xffffff,
    emissive: 0x18100f,
    emissiveIntensity: 0.38,
    roughness: 0.9,
  });
  const ceilingMaterial = new THREE.MeshStandardMaterial({
    map: createLevelSevenCeilingTexture(),
    color: 0xffffff,
    emissive: 0x0e0907,
    emissiveIntensity: 0.28,
    roughness: 0.88,
  });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(LEVEL_SEVEN_COLS * CELL_SIZE, LEVEL_SEVEN_ROWS * CELL_SIZE),
    floorMaterial,
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(LEVEL_SEVEN_COLS * CELL_SIZE, LEVEL_SEVEN_ROWS * CELL_SIZE),
    ceilingMaterial,
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, CEILING_Y, 0);
  scene.add(ceiling);

  const { northSouth, eastWest, fixturePositions } = collectLevelSevenTransforms();
  addInstancedBoxes(
    scene,
    new THREE.BoxGeometry(CELL_SIZE + WALL_THICKNESS, WALL_HEIGHT, WALL_THICKNESS),
    wallMaterial,
    northSouth,
  );
  addInstancedBoxes(
    scene,
    new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, CELL_SIZE + WALL_THICKNESS),
    wallMaterial,
    eastWest,
  );

  scene.add(new THREE.HemisphereLight(0x5b7780, 0x071316, 0.92));
  const cameraMistLight = new THREE.PointLight(0xa7e4ec, 0.42, 7.4, 2.05);
  cameraMistLight.position.set(0, 0.1, -0.5);
  camera.add(cameraMistLight);
  const fixtures = createLevelSevenLights(scene, fixturePositions);
  const updateLightState = createStableLightState("WATER", {
    dimBelow: 0.34,
    normalAbove: 0.52,
    dimDelay: 0.64,
    normalDelay: 1.1,
  });

  const interactions = [...propInteractions];
  const routes = [
    { id: "level-seven-terminal-exit", targetLevel: null, targetLabel: "EXIT", label: "EXIT", kind: "door", position: targetPosition, rotation: 0 },
    { id: "level-seven-hidden-hub-door", targetLevel: 8, targetLabel: "THE HUB", kind: "door", hidden: true, position: levelSevenCellCenter(8, 3), rotation: Math.PI },
  ];
  const exitNetwork = createExitNetwork(scene, camera, routes, interactionInitial);

  const almondWater = createAlmondWaterPickup(scene, {
    cols: LEVEL_SEVEN_COLS,
    rows: LEVEL_SEVEN_ROWS,
    isCellOpen: isLevelSevenOpenCell,
    getCellCenter: levelSevenCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial["almond-water"] ?? null,
  });
  const superAlmondWater = createAlmondWaterPickup(scene, {
    cols: LEVEL_SEVEN_COLS,
    rows: LEVEL_SEVEN_ROWS,
    isCellOpen: isLevelSevenOpenCell,
    getCellCenter: levelSevenCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    variant: "super",
    respawnMin: SUPER_ALMOND_WATER_RESPAWN_MIN,
    respawnVariance: SUPER_ALMOND_WATER_RESPAWN_VARIANCE,
    initialSpawnChance: SUPER_ALMOND_WATER_INITIAL_SPAWN_CHANCE * 0.52,
    respawnChance: SUPER_ALMOND_WATER_RESPAWN_CHANCE * 0.58,
    initialState: pickupInitial["super-almond-water"] ?? null,
  });
  const flashlight = createFlashlightPickup(scene, {
    cols: LEVEL_SEVEN_COLS,
    rows: LEVEL_SEVEN_ROWS,
    isCellOpen: isLevelSevenOpenCell,
    getCellCenter: levelSevenCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial.flashlight ?? null,
  });
  const detector = createDetectorPickup(scene, {
    cols: LEVEL_SEVEN_COLS,
    rows: LEVEL_SEVEN_ROWS,
    isCellOpen: isLevelSevenOpenCell,
    getCellCenter: levelSevenCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial.detector ?? null,
  });
  const compass = createCompassPickup(scene, {
    cols: LEVEL_SEVEN_COLS,
    rows: LEVEL_SEVEN_ROWS,
    isCellOpen: isLevelSevenOpenCell,
    getCellCenter: levelSevenCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial.compass ?? null,
  });
  const silenceLiquid = createSilenceLiquidPickup(scene, {
    cols: LEVEL_SEVEN_COLS,
    rows: LEVEL_SEVEN_ROWS,
    isCellOpen: isLevelSevenOpenCell,
    getCellCenter: levelSevenCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial["silence-liquid"] ?? null,
  });

  const thingSpawn = levelSevenCellCenter(33, 23);
  const thing = createLevelSevenThingEntity(scene, {
    spawnPosition: thingSpawn,
    isWalkable,
    speed: 1.0,
    initialState: entityInitial.find((entity) => entity.id === "level-seven-thing") ?? null,
    cols: LEVEL_SEVEN_COLS,
    rows: LEVEL_SEVEN_ROWS,
    isCellOpen: isLevelSevenOpenCell,
    worldToCell: levelSevenWorldToCell,
    cellCenter: levelSevenCellCenter,
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
    const isInOpenCells = samples.every(([offsetX, offsetZ]) => {
      const cell = levelSevenWorldToCell(x + offsetX, z + offsetZ);
      return isLevelSevenOpenCell(cell.col, cell.row);
    });
    if (!isInOpenCells) return false;
    return !propColliders.some((collider) => circleIntersectsAabb(x, z, radius, collider));
  }

  function update(delta, elapsed, playerPosition, effects = {}) {
    let lightTotal = 0;
    fixtures.forEach((fixture, index) => {
      const wave = 0.76 + Math.sin(elapsed * fixture.speed + fixture.phase) * 0.09;
      const drowned = index % 4 === 0 && Math.sin(elapsed * 0.92 + fixture.phase) > 0.88 ? 0.45 : 1;
      const pulse = Math.max(0.18, wave * drowned - fixture.weak);
      fixture.material.emissiveIntensity = pulse * fixture.baseIntensity * 1.1;
      updateFixturePointLight(fixture, pulse, 1.0);
      lightTotal += pulse;
    });

    const flicker = fixtures.length > 0 ? lightTotal / fixtures.length : 0.38;
    const enteredExit = exitNetwork.update(delta, playerPosition);
    const exitDistance = Math.min(...routes.map((route) => Math.hypot(playerPosition.x - route.position.x, playerPosition.z - route.position.z)));
    if (enteredExit) objectiveReached = true;
    scene.fog.density = 0.0105 + (1 - flicker) * 0.005 + (exitDistance > 80 ? 0.0015 : 0);
    cameraMistLight.intensity = 0.36 + Math.sin(elapsed * 0.58) * 0.055;
    updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition);

    const almondWaterState = almondWater.update(delta, elapsed, playerPosition);
    const superAlmondWaterState = superAlmondWater.update(delta, elapsed, playerPosition);
    const flashlightState = flashlight.update(delta, elapsed, playerPosition);
    const detectorState = detector.update(delta, elapsed, playerPosition);
    const compassState = compass.update(delta, elapsed, playerPosition);
    const silenceLiquidState = silenceLiquid.update(delta, elapsed, playerPosition);
    const thingState = thing.update(delta, elapsed, playerPosition, effects);
    const entities = [thingState];
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
        ? "SURFACE SIGNAL"
        : exitDistance < 12
          ? "WATERLINE TRACE"
          : "THALASSOPHOBIA",
    };
  }

  return {
    level: 7,
    levelLabel: "LEVEL 7",
    levelName: "THALASSOPHOBIA",
    get viewModelName() {
      return getViewModelName(viewModel);
    },
    colliderCount: propColliders.length,
    nextLevel: null,
    exitMode: "network",
    scene,
    camera,
    spawn,
    targetPosition,
    isWalkable,
    decorativeItemSpawns: [
      { id: "seashell", position: { ...levelSevenCellCenter(12, 12), y: 0.18 }, rotation: -0.4, tiltZ: 0.16 },
    ],
    flashlightEffectiveness: 1.08,
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
        entities: [thing.getState()],
      };
    },
  };
}
