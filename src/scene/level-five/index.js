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
import { snapEntityStates } from "../common/snap.js";
import { addLayoutDarkPockets } from "../level-two/props.js";
import {
  LEVEL_FIVE_COLS,
  LEVEL_FIVE_ROWS,
  LEVEL_FIVE_START_CELL,
  LEVEL_FIVE_TARGET_CELL,
  LEVEL_FIVE_DARK_ZONES,
  isLevelFiveOpenCell,
  levelFiveCellCenter,
  levelFiveWorldToCell,
} from "./layout.js";
import {
  createLevelFiveCarpetTexture,
  createLevelFiveWallpaperTexture,
  createLevelFiveCeilingTexture,
} from "./textures.js";
import {
  collectLevelFiveTransforms,
  createLevelFiveLights,
  addLevelFiveHotelDetails,
} from "./props.js";
import {
  createAlmondWaterPickup,
  createCompassPickup,
  createFlashlightPickup,
  createDetectorPickup,
  createSilenceLiquidPickup,
} from "../items/index.js";
import {
  createHoundEntity,
  chooseBacteriaSpawn,
  getPickupTarget,
  tryPickupItems,
  getFocusedEntity,
  getFocusedInteraction,
  getFocusedItem,
  tryInteractWithSpots,
} from "../entities/index.js";
import { createExitNetwork } from "../common/exit-network.js";

export function createLevelFiveScene({ initialState = null } = {}) {
  const scene = new THREE.Scene();
  const FOG_COLOR = 0x60301f;
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0074);

  const cameraFar =
    Math.hypot(LEVEL_FIVE_COLS * CELL_SIZE, LEVEL_FIVE_ROWS * CELL_SIZE) + CELL_SIZE * 2;
  const camera = new THREE.PerspectiveCamera(74, 1, 0.05, cameraFar);
  const viewModel = attachFirstPersonViewModel(camera);
  scene.add(camera);

  const spawnCell = levelFiveCellCenter(LEVEL_FIVE_START_CELL.col, LEVEL_FIVE_START_CELL.row);
  const spawn = { x: spawnCell.x, z: spawnCell.z, yaw: LEVEL_FIVE_START_CELL.yaw };
  const targetPosition = levelFiveCellCenter(LEVEL_FIVE_TARGET_CELL.col, LEVEL_FIVE_TARGET_CELL.row);

  const pickupInitial = initialState?.pickups ?? {};
  const interactionInitial = initialState?.interactions ?? {};
  const objectiveInitial = initialState?.objectives ?? {};
  const { colliders: propColliders, interactions: propInteractions } = addLevelFiveHotelDetails(
    scene,
    interactionInitial,
  );
  const entityInitial = snapEntityStates(
    Array.isArray(initialState?.entities) ? initialState.entities : [],
    isWalkable,
  );

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: createLevelFiveCarpetTexture(),
    color: 0xffffff,
    emissive: 0x3c170c,
    emissiveIntensity: 0.58,
    roughness: 0.94,
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: createLevelFiveWallpaperTexture(),
    color: 0xffffff,
    emissive: 0x45190d,
    emissiveIntensity: 0.56,
    roughness: 0.88,
  });
  const ceilingMaterial = new THREE.MeshStandardMaterial({
    map: createLevelFiveCeilingTexture(),
    color: 0xffffff,
    emissive: 0x4a2a14,
    emissiveIntensity: 0.58,
    roughness: 0.84,
  });
  const wallCapMaterial = new THREE.MeshStandardMaterial({
    color: 0x5a3923,
    emissive: 0x140704,
    emissiveIntensity: 0.22,
    roughness: 0.88,
  });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(LEVEL_FIVE_COLS * CELL_SIZE, LEVEL_FIVE_ROWS * CELL_SIZE),
    floorMaterial,
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(LEVEL_FIVE_COLS * CELL_SIZE, LEVEL_FIVE_ROWS * CELL_SIZE),
    ceilingMaterial,
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, CEILING_Y, 0);
  scene.add(ceiling);

  const { northSouth, eastWest, fixturePositions } = collectLevelFiveTransforms();
  const wallMaterials = [
    wallMaterial,
    wallMaterial,
    wallCapMaterial,
    wallCapMaterial,
    wallMaterial,
    wallMaterial,
  ];
  addInstancedBoxes(
    scene,
    new THREE.BoxGeometry(CELL_SIZE + WALL_THICKNESS, WALL_HEIGHT, WALL_THICKNESS),
    wallMaterials,
    northSouth,
  );
  addInstancedBoxes(
    scene,
    new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, CELL_SIZE + WALL_THICKNESS),
    wallMaterials,
    eastWest,
  );

  scene.add(new THREE.HemisphereLight(0xffe0b2, 0x3a160c, 1.9));
  const warmFill = new THREE.DirectionalLight(0xffb06a, 0.62);
  warmFill.position.set(-10, CEILING_Y - 0.4, 12);
  scene.add(warmFill);
  const playerAmbient = new THREE.PointLight(0xffd9a8, 0.72, 12.5, 1.72);
  playerAmbient.position.set(0, CEILING_Y - 0.6, 0);
  camera.add(playerAmbient);

  const fixtures = createLevelFiveLights(scene, fixturePositions);
  const updateLightState = createStableLightState("JAZZ", {
    dimBelow: 0.38,
    normalAbove: 0.58,
    dimDelay: 0.7,
    normalDelay: 1.1,
  });
  addLayoutDarkPockets(scene, {
    darkZones: LEVEL_FIVE_DARK_ZONES,
    originX: -(LEVEL_FIVE_COLS * CELL_SIZE) / 2,
    originZ: -(LEVEL_FIVE_ROWS * CELL_SIZE) / 2,
  });

  const almondWater = createAlmondWaterPickup(scene, {
    cols: LEVEL_FIVE_COLS,
    rows: LEVEL_FIVE_ROWS,
    isCellOpen: isLevelFiveOpenCell,
    getCellCenter: levelFiveCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial["almond-water"] ?? null,
  });
  const superAlmondWater = createAlmondWaterPickup(scene, {
    cols: LEVEL_FIVE_COLS,
    rows: LEVEL_FIVE_ROWS,
    isCellOpen: isLevelFiveOpenCell,
    getCellCenter: levelFiveCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    variant: "super",
    respawnMin: SUPER_ALMOND_WATER_RESPAWN_MIN,
    respawnVariance: SUPER_ALMOND_WATER_RESPAWN_VARIANCE,
    initialSpawnChance: SUPER_ALMOND_WATER_INITIAL_SPAWN_CHANCE * 0.7,
    respawnChance: SUPER_ALMOND_WATER_RESPAWN_CHANCE * 0.75,
    initialState: pickupInitial["super-almond-water"] ?? null,
  });
  const flashlight = createFlashlightPickup(scene, {
    cols: LEVEL_FIVE_COLS,
    rows: LEVEL_FIVE_ROWS,
    isCellOpen: isLevelFiveOpenCell,
    getCellCenter: levelFiveCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial.flashlight ?? null,
  });
  const detector = createDetectorPickup(scene, {
    cols: LEVEL_FIVE_COLS,
    rows: LEVEL_FIVE_ROWS,
    isCellOpen: isLevelFiveOpenCell,
    getCellCenter: levelFiveCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial.detector ?? null,
  });
  const compass = createCompassPickup(scene, {
    cols: LEVEL_FIVE_COLS,
    rows: LEVEL_FIVE_ROWS,
    isCellOpen: isLevelFiveOpenCell,
    getCellCenter: levelFiveCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial.compass ?? null,
  });
  const silenceLiquid = createSilenceLiquidPickup(scene, {
    cols: LEVEL_FIVE_COLS,
    rows: LEVEL_FIVE_ROWS,
    isCellOpen: isLevelFiveOpenCell,
    getCellCenter: levelFiveCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial["silence-liquid"] ?? null,
  });

  const interactions = [...propInteractions];
  const routes = [
    { id: "level-five-boiler-level-six", targetLevel: 6, targetLabel: "LEVEL 6", label: "BOILER", kind: "door", position: targetPosition, rotation: 0 },
    { id: "level-five-elevator-level-three", targetLevel: 3, targetLabel: "LEVEL 3", label: "SERVICE", kind: "elevator", position: levelFiveCellCenter(37, 5), rotation: Math.PI },
    { id: "level-five-stairs-level-four", targetLevel: 4, targetLabel: "LEVEL 4", label: "STAIRS", kind: "stair", position: levelFiveCellCenter(7, 5), rotation: 0 },
  ];
  const exitNetwork = createExitNetwork(scene, camera, routes, interactionInitial);

  const houndSpawn =
    chooseBacteriaSpawn({
      cols: LEVEL_FIVE_COLS,
      rows: LEVEL_FIVE_ROWS,
      isCellOpen: isLevelFiveOpenCell,
      getCellCenter: levelFiveCellCenter,
      targetPosition,
      spawnPosition: spawnCell,
    })[0] ?? targetPosition;
  const hound = createHoundEntity(scene, {
    spawnPosition: houndSpawn,
    isWalkable,
    speed: 1.28,
    initialState: entityInitial.find((entity) => entity.type === "hound") ?? null,
    cols: LEVEL_FIVE_COLS,
    rows: LEVEL_FIVE_ROWS,
    isCellOpen: isLevelFiveOpenCell,
    worldToCell: levelFiveWorldToCell,
    cellCenter: levelFiveCellCenter,
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
      const cell = levelFiveWorldToCell(x + offsetX, z + offsetZ);
      return isLevelFiveOpenCell(cell.col, cell.row);
    });
    if (!isInOpenCells) return false;
    return !propColliders.some((collider) => circleIntersectsAabb(x, z, radius, collider));
  }

  function update(delta, elapsed, playerPosition, effects = {}) {
    let lightTotal = 0;
    fixtures.forEach((fixture, index) => {
      const hum = 0.76 + Math.sin(elapsed * fixture.speed + fixture.phase) * 0.055;
      const boilerBrownout = index % 4 === 0 && Math.sin(elapsed * 1.7 + fixture.phase) > 0.9 ? 0.52 : 1;
      const pulse = Math.max(0.28, hum * boilerBrownout - fixture.weak);
      fixture.material.emissiveIntensity = pulse * fixture.baseIntensity * 1.82;
      updateFixturePointLight(fixture, pulse, 1.0);
      lightTotal += pulse;
    });

    const flicker = fixtures.length > 0 ? lightTotal / fixtures.length : 0.5;
    const enteredExit = exitNetwork.update(delta, playerPosition);
    const exitDistance = Math.min(...routes.map((route) => Math.hypot(playerPosition.x - route.position.x, playerPosition.z - route.position.z)));
    if (enteredExit) objectiveReached = true;
    scene.fog.density = 0.0076 + (1 - flicker) * 0.0055 + (exitDistance < 24 ? 0.0014 : 0);
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
        ? "HOTEL ROUTE STABLE"
        : exitDistance < 10
          ? "BOILER TRACE"
          : "TERROR HOTEL",
    };
  }

  return {
    level: 5,
    levelLabel: "LEVEL 5",
    levelName: "TERROR HOTEL",
    get viewModelName() {
      return getViewModelName(viewModel);
    },
    colliderCount: propColliders.length,
    nextLevel: 6,
    exitMode: "network",
    scene,
    camera,
    spawn,
    targetPosition,
    isWalkable,
    decorativeItemSpawns: [
      { id: "hotel-token", position: { ...levelFiveCellCenter(20, 12), y: 0.1 }, rotation: 0.45, tiltZ: 0.08 },
      { id: "crumpled-note", position: { ...levelFiveCellCenter(28, 14), y: 0.08 }, rotation: -0.3, tiltX: 0.05 },
    ],
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
