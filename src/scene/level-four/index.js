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
import {
  LEVEL_ONE_COLS,
  LEVEL_ONE_ROWS,
  LEVEL_ONE_START_CELL,
  LEVEL_ONE_TARGET_CELL,
  isLevelOneOpenCell,
  levelOneCellCenter,
  levelOneWorldToCell,
} from "../level-one/layout.js";
import { createLevelOneLights, collectLevelOneTransforms } from "../level-one/props.js";
import { createLevelFourCarpetTexture, createLevelFourWallTexture, createLevelFourCeilingTexture } from "./textures.js";
import { addLevelFourOfficeDetails } from "./props.js";
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
import { snapEntityStates } from "../common/snap.js";
import { createExitNetwork } from "../common/exit-network.js";

export function createLevelFourScene({ initialState = null } = {}) {
  const scene = new THREE.Scene();
  const FOG_COLOR = 0xb8b9a7;
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0088);

  const cameraFar =
    Math.hypot(LEVEL_ONE_COLS * CELL_SIZE, LEVEL_ONE_ROWS * CELL_SIZE) + CELL_SIZE * 2;
  const camera = new THREE.PerspectiveCamera(74, 1, 0.05, cameraFar);
  const viewModel = attachFirstPersonViewModel(camera);
  scene.add(camera);

  const spawnCell = levelOneCellCenter(LEVEL_ONE_START_CELL.col, LEVEL_ONE_START_CELL.row);
  const spawn = { x: spawnCell.x, z: spawnCell.z, yaw: -Math.PI * 0.12 };
  const targetPosition = levelOneCellCenter(LEVEL_ONE_TARGET_CELL.col, LEVEL_ONE_TARGET_CELL.row);

  const { colliders: propColliders, interactions: propInteractions } = addLevelFourOfficeDetails(
    scene,
    initialState?.interactions ?? {},
  );

  const pickupInitial = initialState?.pickups ?? {};
  const interactionInitial = initialState?.interactions ?? {};
  const objectiveInitial = initialState?.objectives ?? {};
  const entityInitial = snapEntityStates(
    Array.isArray(initialState?.entities) ? initialState.entities : [],
    isWalkable,
  );

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: createLevelFourCarpetTexture(),
    color: 0xdfe4d7,
    emissive: 0x596454,
    emissiveIntensity: 0.18,
    roughness: 0.97,
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: createLevelFourWallTexture(),
    color: 0xf1ecd9,
    emissive: 0x545046,
    emissiveIntensity: 0.16,
    roughness: 0.92,
  });
  const ceilingMaterial = new THREE.MeshStandardMaterial({
    map: createLevelFourCeilingTexture(),
    color: 0xf4f0d9,
    emissive: 0x807a60,
    emissiveIntensity: 0.32,
    roughness: 0.86,
  });
  const wallCapMaterial = new THREE.MeshStandardMaterial({
    color: 0xaaa189,
    emissive: 0x332f26,
    emissiveIntensity: 0.08,
    roughness: 0.96,
  });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(LEVEL_ONE_COLS * CELL_SIZE, LEVEL_ONE_ROWS * CELL_SIZE),
    floorMaterial,
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(LEVEL_ONE_COLS * CELL_SIZE, LEVEL_ONE_ROWS * CELL_SIZE),
    ceilingMaterial,
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, CEILING_Y, 0);
  scene.add(ceiling);

  const { northSouth, eastWest, fixturePositions } = collectLevelOneTransforms();
  fixturePositions.forEach((fixture, index) => {
    fixture.color = index % 6 === 0 ? 0xd8fff0 : 0xfff7da;
    fixture.baseIntensity *= index % 5 === 0 ? 0.66 : 0.9;
    fixture.range *= 0.92;
    fixture.weak = Math.max(fixture.weak, index % 5 === 0 ? 0.18 : 0.05);
  });

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

  scene.add(new THREE.HemisphereLight(0xffffee, 0x8d9b8a, 1.28));
  const fill = new THREE.DirectionalLight(0xf3ffe4, 0.18);
  fill.position.set(12, CEILING_Y - 0.3, -14);
  scene.add(fill);

  const fixtures = createLevelOneLights(scene, fixturePositions);
  const updateLightState = createStableLightState("QUIET", {
    dimBelow: 0.46,
    normalAbove: 0.62,
    dimDelay: 0.62,
    normalDelay: 0.86,
  });
  const interactions = [...propInteractions];
  const routes = [
    { id: "level-four-stairs-level-five", targetLevel: 5, targetLabel: "LEVEL 5", label: "HOTEL", kind: "stair", position: targetPosition, rotation: 0 },
    { id: "level-four-stairs-level-six", targetLevel: 6, targetLabel: "LEVEL 6", label: "DARKNESS", kind: "stair", position: levelOneCellCenter(2, 22), rotation: Math.PI },
    { id: "level-four-elevator-level-three", targetLevel: 3, targetLabel: "LEVEL 3", label: "MAINTENANCE", kind: "elevator", position: levelOneCellCenter(1, 1), rotation: Math.PI / 2 },
  ];
  const exitNetwork = createExitNetwork(scene, camera, routes, interactionInitial);

  const almondWater = createAlmondWaterPickup(scene, {
    cols: LEVEL_ONE_COLS,
    rows: LEVEL_ONE_ROWS,
    isCellOpen: isLevelOneOpenCell,
    getCellCenter: levelOneCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial["almond-water"] ?? null,
  });
  const superAlmondWater = createAlmondWaterPickup(scene, {
    cols: LEVEL_ONE_COLS,
    rows: LEVEL_ONE_ROWS,
    isCellOpen: isLevelOneOpenCell,
    getCellCenter: levelOneCellCenter,
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
    cols: LEVEL_ONE_COLS,
    rows: LEVEL_ONE_ROWS,
    isCellOpen: isLevelOneOpenCell,
    getCellCenter: levelOneCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial.flashlight ?? null,
  });
  const detector = createDetectorPickup(scene, {
    cols: LEVEL_ONE_COLS,
    rows: LEVEL_ONE_ROWS,
    isCellOpen: isLevelOneOpenCell,
    getCellCenter: levelOneCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial.detector ?? null,
  });
  const compass = createCompassPickup(scene, {
    cols: LEVEL_ONE_COLS,
    rows: LEVEL_ONE_ROWS,
    isCellOpen: isLevelOneOpenCell,
    getCellCenter: levelOneCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial.compass ?? null,
  });
  const silenceLiquid = createSilenceLiquidPickup(scene, {
    cols: LEVEL_ONE_COLS,
    rows: LEVEL_ONE_ROWS,
    isCellOpen: isLevelOneOpenCell,
    getCellCenter: levelOneCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial["silence-liquid"] ?? null,
  });
  const hound = createHoundEntity(scene, {
    spawnPosition:
      chooseBacteriaSpawn({
        cols: LEVEL_ONE_COLS,
        rows: LEVEL_ONE_ROWS,
        isCellOpen: isLevelOneOpenCell,
        getCellCenter: levelOneCellCenter,
        targetPosition,
        spawnPosition: spawnCell,
      })[0] ?? targetPosition,
    isWalkable,
    speed: 0.92,
    initialState: entityInitial.find((entity) => entity.type === "hound") ?? null,
    cols: LEVEL_ONE_COLS,
    rows: LEVEL_ONE_ROWS,
    isCellOpen: isLevelOneOpenCell,
    worldToCell: levelOneWorldToCell,
    cellCenter: levelOneCellCenter,
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
      const cell = levelOneWorldToCell(x + offsetX, z + offsetZ);
      return isLevelOneOpenCell(cell.col, cell.row);
    });
    if (!isInOpenCells) return false;
    return !propColliders.some((collider) => circleIntersectsAabb(x, z, radius, collider));
  }

  function update(delta, elapsed, playerPosition, effects = {}) {
    let lightTotal = 0;
    fixtures.forEach((fixture, index) => {
      const hum = 0.88 + Math.sin(elapsed * 1.05 + fixture.phase) * 0.035;
      const staleTube = index % 5 === 0 && Math.sin(elapsed * fixture.speed + fixture.phase) > 0.94 ? 0.55 : 1;
      const pulse = Math.max(0.42, hum * staleTube - fixture.weak);
      fixture.material.emissiveIntensity = pulse * fixture.baseIntensity * 1.4;
      updateFixturePointLight(fixture, pulse, 0.96);
      lightTotal += pulse;
    });
    const flicker = fixtures.length > 0 ? lightTotal / fixtures.length : 0.82;
    const enteredExit = exitNetwork.update(delta, playerPosition);
    const exitDistance = Math.min(...routes.map((route) => Math.hypot(playerPosition.x - route.position.x, playerPosition.z - route.position.z)));
    if (enteredExit) objectiveReached = true;
    scene.fog.density = 0.0086 + (1 - flicker) * 0.006;
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
        ? "STAIRWAY TO HOTEL"
        : exitDistance < 8
          ? "STAIR TRACE"
          : "ABANDONED OFFICE",
    };
  }

  return {
    level: 4,
    levelLabel: "LEVEL 4",
    levelName: "ABANDONED OFFICE",
    get viewModelName() {
      return getViewModelName(viewModel);
    },
    colliderCount: propColliders.length,
    nextLevel: 5,
    exitMode: "network",
    scene,
    camera,
    spawn,
    targetPosition,
    isWalkable,
    decorativeItemSpawns: [
      { id: "office-badge", position: { ...levelOneCellCenter(18, 12), y: 0.08 }, rotation: 0.2, tiltX: 0.04 },
      { id: "empty-can", position: { ...levelOneCellCenter(28, 19), y: 0.2 }, rotation: 1.2, tiltZ: -0.15 },
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



