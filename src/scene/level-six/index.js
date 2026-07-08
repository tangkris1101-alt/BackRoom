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
import { addInstancedBoxes, createStableLightState } from "../common/lighting.js";
import { attachFirstPersonViewModel, getViewModelName, updateFirstPersonHazmatViewModel } from "../common/view-model.js";
import { createWideSignTexture } from "../common/textures.js";
import { createInteractionSpot, getPickupTarget, tryPickupItems, getFocusedEntity, getFocusedInteraction, getFocusedItem, tryInteractWithSpots } from "../entities/index.js";
import {
  createAlmondWaterPickup,
  createCompassPickup,
  createDetectorPickup,
  createFlashlightPickup,
  createSilenceLiquidPickup,
} from "../items/index.js";
import {
  LEVEL_SIX_COLS,
  LEVEL_SIX_ROWS,
  LEVEL_SIX_START_CELL,
  LEVEL_SIX_TARGET_CELL,
  LEVEL_SIX_EXIT_TRIGGER_RADIUS,
  LEVEL_SIX_DARK_ZONES,
  isLevelSixOpenCell,
  levelSixCellCenter,
  levelSixWorldToCell,
  getLevelSixTargetMount,
} from "./layout.js";
import {
  createLevelSixFloorTexture,
  createLevelSixWallTexture,
  createLevelSixCeilingTexture,
} from "./textures.js";

function collectLevelSixWallTransforms() {
  const northSouth = [];
  const eastWest = [];
  for (let row = 0; row < LEVEL_SIX_ROWS; row += 1) {
    for (let col = 0; col < LEVEL_SIX_COLS; col += 1) {
      if (!isLevelSixOpenCell(col, row)) continue;
      const center = levelSixCellCenter(col, row);
      if (!isLevelSixOpenCell(col, row - 1)) {
        northSouth.push(new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z - CELL_SIZE / 2));
      }
      if (!isLevelSixOpenCell(col, row + 1)) {
        northSouth.push(new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z + CELL_SIZE / 2));
      }
      if (!isLevelSixOpenCell(col - 1, row)) {
        eastWest.push(new THREE.Vector3(center.x - CELL_SIZE / 2, WALL_HEIGHT / 2, center.z));
      }
      if (!isLevelSixOpenCell(col + 1, row)) {
        eastWest.push(new THREE.Vector3(center.x + CELL_SIZE / 2, WALL_HEIGHT / 2, center.z));
      }
    }
  }
  return { northSouth, eastWest };
}

function addLevelSixExit(scene, targetPosition) {
  const mount = getLevelSixTargetMount(targetPosition);
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 2.18, 0.08),
    new THREE.MeshStandardMaterial({
      color: 0x080b0c,
      emissive: 0x001609,
      emissiveIntensity: 0.18,
      roughness: 0.78,
      metalness: 0.12,
    }),
  );
  door.position.set(mount.x, 1.12, mount.z);
  door.rotation.y = mount.rotation;
  scene.add(door);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.82, 0.48),
    new THREE.MeshStandardMaterial({
      map: createWideSignTexture("NO LIGHT", "#020604", "#7aff9c"),
      color: 0xffffff,
      emissive: 0x1cff72,
      emissiveIntensity: 0.08,
      roughness: 0.62,
      side: THREE.DoubleSide,
    }),
  );
  sign.position.set(mount.x, 2.42, mount.z);
  sign.rotation.y = mount.rotation;
  scene.add(sign);

  const glow = new THREE.PointLight(0x6aff98, 0.22, 5.5, 2.6);
  glow.position.set(targetPosition.x, 1.5, targetPosition.z);
  scene.add(glow);
}

function addLevelSixDetails(scene, interactionInitial = {}) {
  const colliders = [];
  const interactions = [];
  const cableMaterial = new THREE.MeshStandardMaterial({
    color: 0x010101,
    roughness: 0.9,
    metalness: 0.15,
  });
  const scratchMaterial = new THREE.MeshBasicMaterial({
    color: 0xaeb2a3,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });

  LEVEL_SIX_DARK_ZONES.forEach((zone) => {
    const x = -(LEVEL_SIX_COLS * CELL_SIZE) / 2 + zone.col * CELL_SIZE + (zone.width * CELL_SIZE) / 2;
    const z = -(LEVEL_SIX_ROWS * CELL_SIZE) / 2 + zone.row * CELL_SIZE + (zone.height * CELL_SIZE) / 2;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(zone.width * CELL_SIZE, zone.height * CELL_SIZE),
      shadowMaterial,
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.04, z);
    scene.add(mesh);
  });

  const cableGeometry = new THREE.CylinderGeometry(0.045, 0.045, CELL_SIZE * 5.6, 10);
  [
    { col: 7, row: 13, axis: "x" },
    { col: 20, row: 8, axis: "z" },
    { col: 25, row: 22, axis: "x" },
    { col: 30, row: 9, axis: "z" },
    { col: 11, row: 21, axis: "x" },
  ].forEach((cable) => {
    const center = levelSixCellCenter(cable.col, cable.row);
    const mesh = new THREE.Mesh(cableGeometry, cableMaterial);
    mesh.position.set(center.x, CEILING_Y - 0.26, center.z);
    if (cable.axis === "x") mesh.rotation.z = Math.PI / 2;
    if (cable.axis === "z") mesh.rotation.x = Math.PI / 2;
    scene.add(mesh);
  });

  [
    { col: 10, row: 7, id: "level-six-scratch" },
    { col: 28, row: 22, id: "level-six-cold-wall" },
  ].forEach((spot, index) => {
    const center = levelSixCellCenter(spot.col, spot.row);
    const mount = getLevelSixTargetMount(center);
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.8), scratchMaterial);
    mark.position.set(mount.x, 1.45, mount.z);
    mark.rotation.y = mount.rotation;
    mark.rotation.z = index === 0 ? 0.12 : -0.08;
    scene.add(mark);
    interactions.push(
      createInteractionSpot({
        id: spot.id,
        position: center,
        inspectHeight: 1.2,
        inspectRadius: 0.72,
        responseKey: `${spot.id}Response`,
        initialState: interactionInitial[spot.id] ?? null,
      }),
    );
  });

  return { colliders, interactions };
}

export function createLevelSixScene({ initialState = null } = {}) {
  const scene = new THREE.Scene();
  const FOG_COLOR = 0x080b0d;
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.019);

  const cameraFar = Math.hypot(LEVEL_SIX_COLS * CELL_SIZE, LEVEL_SIX_ROWS * CELL_SIZE) + CELL_SIZE * 2;
  const camera = new THREE.PerspectiveCamera(74, 1, 0.05, cameraFar);
  const viewModel = attachFirstPersonViewModel(camera);
  scene.add(camera);

  const spawnCell = levelSixCellCenter(LEVEL_SIX_START_CELL.col, LEVEL_SIX_START_CELL.row);
  const spawn = { x: spawnCell.x, z: spawnCell.z, yaw: LEVEL_SIX_START_CELL.yaw };
  const targetPosition = levelSixCellCenter(LEVEL_SIX_TARGET_CELL.col, LEVEL_SIX_TARGET_CELL.row);
  const pickupInitial = initialState?.pickups ?? {};
  const interactionInitial = initialState?.interactions ?? {};
  const objectiveInitial = initialState?.objectives ?? {};

  const { colliders: propColliders, interactions: propInteractions } = addLevelSixDetails(scene, interactionInitial);
  addLevelSixExit(scene, targetPosition);

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: createLevelSixFloorTexture(),
    color: 0xb9c2c0,
    emissive: 0x10171a,
    emissiveIntensity: 0.52,
    roughness: 0.98,
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: createLevelSixWallTexture(),
    color: 0xb0b9b6,
    emissive: 0x0d1214,
    emissiveIntensity: 0.42,
    roughness: 0.96,
  });
  const ceilingMaterial = new THREE.MeshStandardMaterial({
    map: createLevelSixCeilingTexture(),
    color: 0x8f9692,
    emissive: 0x070a0b,
    emissiveIntensity: 0.28,
    roughness: 0.98,
  });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(LEVEL_SIX_COLS * CELL_SIZE, LEVEL_SIX_ROWS * CELL_SIZE),
    floorMaterial,
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(LEVEL_SIX_COLS * CELL_SIZE, LEVEL_SIX_ROWS * CELL_SIZE),
    ceilingMaterial,
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, CEILING_Y, 0);
  scene.add(ceiling);

  const { northSouth, eastWest } = collectLevelSixWallTransforms();
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

  scene.add(new THREE.HemisphereLight(0x52646a, 0x020303, 0.72));
  const cameraDimLight = new THREE.PointLight(0xb9d6dc, 0.72, 8.4, 2.15);
  cameraDimLight.position.set(0, 0.2, -0.4);
  camera.add(cameraDimLight);
  const updateLightState = createStableLightState("DARK", {
    dimBelow: 0.2,
    normalAbove: 0.34,
    dimDelay: 0.1,
    normalDelay: 1.2,
  });

  const interactions = [
    ...propInteractions,
    createInteractionSpot({
      id: "level-six-exit",
      position: targetPosition,
      inspectHeight: 1.35,
      inspectRadius: 0.72,
      responseKey: "levelSixExitResponse",
      initialState: interactionInitial["level-six-exit"] ?? null,
    }),
  ];

  const almondWater = createAlmondWaterPickup(scene, {
    cols: LEVEL_SIX_COLS,
    rows: LEVEL_SIX_ROWS,
    isCellOpen: isLevelSixOpenCell,
    getCellCenter: levelSixCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial["almond-water"] ?? null,
  });
  const superAlmondWater = createAlmondWaterPickup(scene, {
    cols: LEVEL_SIX_COLS,
    rows: LEVEL_SIX_ROWS,
    isCellOpen: isLevelSixOpenCell,
    getCellCenter: levelSixCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    variant: "super",
    respawnMin: SUPER_ALMOND_WATER_RESPAWN_MIN,
    respawnVariance: SUPER_ALMOND_WATER_RESPAWN_VARIANCE,
    initialSpawnChance: SUPER_ALMOND_WATER_INITIAL_SPAWN_CHANCE * 0.58,
    respawnChance: SUPER_ALMOND_WATER_RESPAWN_CHANCE * 0.62,
    initialState: pickupInitial["super-almond-water"] ?? null,
  });
  const flashlight = createFlashlightPickup(scene, {
    cols: LEVEL_SIX_COLS,
    rows: LEVEL_SIX_ROWS,
    isCellOpen: isLevelSixOpenCell,
    getCellCenter: levelSixCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial.flashlight ?? null,
  });
  const detector = createDetectorPickup(scene, {
    cols: LEVEL_SIX_COLS,
    rows: LEVEL_SIX_ROWS,
    isCellOpen: isLevelSixOpenCell,
    getCellCenter: levelSixCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial.detector ?? null,
  });
  const compass = createCompassPickup(scene, {
    cols: LEVEL_SIX_COLS,
    rows: LEVEL_SIX_ROWS,
    isCellOpen: isLevelSixOpenCell,
    getCellCenter: levelSixCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial.compass ?? null,
  });
  const silenceLiquid = createSilenceLiquidPickup(scene, {
    cols: LEVEL_SIX_COLS,
    rows: LEVEL_SIX_ROWS,
    isCellOpen: isLevelSixOpenCell,
    getCellCenter: levelSixCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial["silence-liquid"] ?? null,
  });

  let objectiveReached = Boolean(objectiveInitial.reached);

  function isWalkable(x, z, radius = 0.34) {
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
      const cell = levelSixWorldToCell(x + offsetX, z + offsetZ);
      return isLevelSixOpenCell(cell.col, cell.row);
    });
    if (!isInOpenCells) return false;
    return !propColliders.some((collider) => circleIntersectsAabb(x, z, radius, collider));
  }

  function update(delta, elapsed, playerPosition) {
    const exitDistance = Math.hypot(playerPosition.x - targetPosition.x, playerPosition.z - targetPosition.z);
    if (exitDistance < LEVEL_SIX_EXIT_TRIGGER_RADIUS) objectiveReached = true;
    const flicker = 0.22 + Math.sin(elapsed * 0.73) * 0.035;
    scene.fog.density = 0.019 + (1 - flicker) * 0.009;
    cameraDimLight.intensity = 0.62 + Math.sin(elapsed * 0.41) * 0.06;
    updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition);

    const almondWaterState = almondWater.update(delta, elapsed, playerPosition);
    const superAlmondWaterState = superAlmondWater.update(delta, elapsed, playerPosition);
    const flashlightState = flashlight.update(delta, elapsed, playerPosition);
    const detectorState = detector.update(delta, elapsed, playerPosition);
    const compassState = compass.update(delta, elapsed, playerPosition);
    const silenceLiquidState = silenceLiquid.update(delta, elapsed, playerPosition);
    const entities = [];
    const pickups = [almondWaterState, superAlmondWaterState, silenceLiquidState, compassState, detectorState, flashlightState];

    return {
      exitDistance: Math.round(exitDistance),
      exitReached: objectiveReached,
      entityContact: false,
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
      focusInteraction: getFocusedInteraction(camera, playerPosition, interactions),
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
        ? "DARKNESS THINS"
        : exitDistance < 8
          ? "COLD AIRFLOW"
          : "LIGHTS OUT",
    };
  }

  return {
    level: 6,
    levelLabel: "LEVEL 6",
    levelName: "LIGHTS OUT",
    viewModelName: getViewModelName(viewModel),
    colliderCount: propColliders.length,
    nextLevel: 7,
    scene,
    camera,
    spawn,
    targetPosition,
    isWalkable,
    flashlightEffectiveness: 1.24,
    update,
    getPickupTarget: (playerPosition) =>
      getPickupTarget(playerPosition, detector, silenceLiquid, superAlmondWater, compass, flashlight, almondWater),
    tryPickup: (playerPosition) =>
      tryPickupItems(playerPosition, detector, silenceLiquid, superAlmondWater, compass, flashlight, almondWater),
    interact: (playerPosition) => tryInteractWithSpots(playerPosition, ...interactions),
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
        interactions: Object.fromEntries(
          interactions.map((spot) => [spot.id, spot.getState()]),
        ),
        objectives: { reached: objectiveReached },
        entities: [],
      };
    },
  };
}
