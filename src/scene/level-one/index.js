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
  LEVEL_ONE_EXIT_TRIGGER_RADIUS,
  LEVEL_ONE_START_CELL,
  LEVEL_ONE_TARGET_CELL,
  isLevelOneOpenCell,
  levelOneCellCenter,
  levelOneWorldToCell,
} from "./layout.js";
import {
  createLevelOneFloorTexture,
  createLevelOneWallTexture,
  createLevelOneCeilingTexture,
} from "./textures.js";
import {
  createLevelOneLights,
  addLevelOneElevator,
  addLevelOnePipes,
  addLevelOneCrates,
  addLevelOnePuddles,
  addLevelOneFloorZones,
  addLevelOneParkingMarks,
  addLevelOneWallSigns,
  addLevelOneSupplyShelves,
  collectLevelOneTransforms,
} from "./props.js";
import {
  createAlmondWaterPickup,
  createFlashlightPickup,
  createDetectorPickup,
  createCompassPickup,
  createSilenceLiquidPickup,




} from "../items/index.js";
import {
  createBacteriaEntity,
  chooseBacteriaSpawn,
  createInteractionSpot,
  getPickupTarget,
  tryPickupItems,
  getFocusedEntity,
  getFocusedInteraction,
  getFocusedItem,
  tryInteractWithSpots,
} from "../entities/index.js";
import { snapEntityStates } from "../common/snap.js";

export function createLevelOneScene({ initialState = null } = {}) {
  const scene = new THREE.Scene();
  const FOG_COLOR = 0x8c988e;
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0115);

  const cameraFar =
    Math.hypot(LEVEL_ONE_COLS * CELL_SIZE, LEVEL_ONE_ROWS * CELL_SIZE) + CELL_SIZE * 2;
  const camera = new THREE.PerspectiveCamera(76, 1, 0.05, cameraFar);
  const viewModel = attachFirstPersonViewModel(camera);
  scene.add(camera);
  const spawnCell = levelOneCellCenter(LEVEL_ONE_START_CELL.col, LEVEL_ONE_START_CELL.row);
  const spawn = { x: spawnCell.x, z: spawnCell.z, yaw: LEVEL_ONE_START_CELL.yaw };
  const targetPosition = levelOneCellCenter(LEVEL_ONE_TARGET_CELL.col, LEVEL_ONE_TARGET_CELL.row);

  let propColliders = addLevelOneCrates(scene);
  propColliders = propColliders.concat(addLevelOneSupplyShelves(scene));

  const pickupInitial = initialState?.pickups ?? {};
  const interactionInitial = initialState?.interactions ?? {};
  const objectiveInitial = initialState?.objectives ?? {};
  const entityInitial = snapEntityStates(
    Array.isArray(initialState?.entities) ? initialState.entities : [],
    isWalkable,
  );

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: createLevelOneFloorTexture(),
    color: 0xd5dccc,
    emissive: 0x3b463d,
    emissiveIntensity: 0.32,
    roughness: 0.96,
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: createLevelOneWallTexture(),
    color: 0xd7ddd4,
    emissive: 0x354036,
    emissiveIntensity: 0.27,
    roughness: 0.94,
  });
  const ceilingMaterial = new THREE.MeshStandardMaterial({
    map: createLevelOneCeilingTexture(),
    color: 0xcbd2c8,
    emissive: 0x414e45,
    emissiveIntensity: 0.34,
    roughness: 0.9,
  });
  const wallCapMaterial = new THREE.MeshStandardMaterial({
    color: 0x777f76,
    emissive: 0x252d28,
    emissiveIntensity: 0.12,
    roughness: 0.96,
  });
  const wallMaterials = [
    wallMaterial,
    wallMaterial,
    wallCapMaterial,
    wallCapMaterial,
    wallMaterial,
    wallMaterial,
  ];

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

  scene.add(new THREE.HemisphereLight(0xe3eadf, 0x6c766b, 1.68));
  const ceilingFill = new THREE.DirectionalLight(0xd8e4d4, 0.22);
  ceilingFill.position.set(18, CEILING_Y - 0.55, -10);
  scene.add(ceilingFill);

  const fixtures = createLevelOneLights(scene, fixturePositions);
  const updateLightState = createStableLightState("HUM", {
    dimBelow: 0.48,
    normalAbove: 0.62,
  });
  addLevelOneElevator(scene, targetPosition);
  addLevelOnePipes(scene);
  addLevelOnePuddles(scene);
  addLevelOneFloorZones(scene);
  addLevelOneParkingMarks(scene);
  addLevelOneWallSigns(scene);
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
  const interactions = [
    createInteractionSpot({
      id: "level-one-elevator-panel",
      position: targetPosition,
      inspectHeight: 1.6,
      inspectRadius: 0.75,
      responseKey: "levelOneElevatorResponse",
      initialState: interactionInitial["level-one-elevator-panel"] ?? null,
    }),
  ];
  const bacteria = createBacteriaEntity(scene, {
    spawnPosition: chooseBacteriaSpawn({
      cols: LEVEL_ONE_COLS,
      rows: LEVEL_ONE_ROWS,
      isCellOpen: isLevelOneOpenCell,
      getCellCenter: levelOneCellCenter,
      targetPosition,
      spawnPosition: spawnCell,
    })[0] ?? spawnCell,
    isWalkable,
    speed: 1.16,
    initialState: entityInitial.find((entity) => entity.type === "bacteria") ?? null,
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
    fixtures.forEach((fixture) => {
      const hum = 0.84 + Math.sin(elapsed * 1.18 + fixture.phase) * 0.055;
      const brokenCut = fixture.broken && Math.sin(elapsed * fixture.speed + fixture.phase) > 0.93 ? 0.52 : 1;
      const pulse = Math.max(0.38, hum * brokenCut - fixture.weak);
      fixture.material.emissiveIntensity = pulse * fixture.baseIntensity * 1.55;
      updateFixturePointLight(fixture, pulse, 1.05);
      lightTotal += pulse;
    });

    const flicker = fixtures.length > 0 ? lightTotal / fixtures.length : 0.76;
    const exitDistance = Math.hypot(
      playerPosition.x - targetPosition.x,
      playerPosition.z - targetPosition.z,
    );
    if (exitDistance < LEVEL_ONE_EXIT_TRIGGER_RADIUS) objectiveReached = true;
    scene.fog.density = 0.012 + (1 - flicker) * 0.009;
    updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition);
    const almondWaterState = almondWater.update(delta, elapsed, playerPosition);
    const superAlmondWaterState = superAlmondWater.update(delta, elapsed, playerPosition);
    const flashlightState = flashlight.update(delta, elapsed, playerPosition);
    const detectorState = detector.update(delta, elapsed, playerPosition);
    const compassState = compass.update(delta, elapsed, playerPosition);
    const silenceLiquidState = silenceLiquid.update(delta, elapsed, playerPosition);
    const bacteriaState = bacteria.update(delta, elapsed, playerPosition, effects);
    const entities = [bacteriaState];
    const pickups = [almondWaterState, superAlmondWaterState, silenceLiquidState, compassState, detectorState, flashlightState];

    return {
      exitDistance: Math.round(exitDistance),
      exitReached: objectiveReached,
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
        ? "ELEVATOR ONLINE"
        : exitDistance < 9
          ? "ELEVATOR TRACE"
          : "HABITABLE ZONE",
    };
  }

  return {
    level: 1,
    levelLabel: "LEVEL 1",
    levelName: "HABITABLE ZONE",
    get viewModelName() {
      return getViewModelName(viewModel);
    },
    colliderCount: propColliders.length,
    nextLevel: 2,
    scene,
    camera,
    spawn,
    targetPosition,
    isWalkable,
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
        entities: [bacteria.getState()],
      };
    },
  };
}



