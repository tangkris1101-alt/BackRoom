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
  LEVEL_THREE_COLS,
  LEVEL_THREE_ROWS,
  LEVEL_THREE_START_CELL,
  LEVEL_THREE_TARGET_CELL,
  LEVEL_THREE_CENTER_X,
  LEVEL_THREE_CENTER_Z,
  LEVEL_THREE_MAX_POINT_LIGHTS,
  LEVEL_THREE_MIN_FIXTURE_DISTANCE,
  LEVEL_THREE_ORIGIN_X,
  LEVEL_THREE_ORIGIN_Z,
  LEVEL_THREE_DARK_ZONES,
  LEVEL_THREE_BAR_POSITIONS,
  isLevelThreeOpenCell,
  levelThreeCellCenter,
  levelThreeWorldToCell,
  countLevelThreeOpenNeighbors,
  getLevelThreeTargetMount,
} from "./layout.js";
import { collectLevelTransforms, createLayoutLights, addLayoutDarkPockets } from "../level-two/props.js";
import { createLevelThreeFloorTexture, createLevelThreeCeilingTexture, createLevelThreeBrickTexture } from "./textures.js";
import {
  addLevelThreeElectricalDetails,
  addLevelThreeBlackSludgePipes,
  addLevelThreeIndestructibleBars,
  addLevelThreeSanctumStatue,
  addLevelThreeNotebookPapers,
  addLevelThreeMural,
  addLevelThreePurpificationSpots,
  addLevelThreeAssemblyLineEquipment,
  addLevelThreeBoilerRoomPipe,
} from "./props.js";
import { snapEntityStates } from "../common/snap.js";
import { createExitNetwork } from "../common/exit-network.js";
import {
  createAlmondWaterPickup,
  createFlashlightPickup,
  createDetectorPickup,
  createCompassPickup,
  createSilenceLiquidPickup,
  createFiresaltPickup,




} from "../items/index.js";
import {
  createBacteriaEntity,
  createHoundEntity,
  chooseBacteriaSpawn,
  pickBacteriaSpawnPositions,
  createInteractionSpot,
  getPickupTarget,
  tryPickupItems,
  getFocusedEntity,
  getFocusedInteraction,
  getFocusedItem,
  tryInteractWithSpots,
} from "../entities/index.js";

// Entity movement is multiplied by two globally. These produce roughly
// 3.6–4.6 world units/s while chasing: just ahead of normal walking (3.05),
// but safely below the player's sprint speed (5.64).
const LEVEL_THREE_HOUND_SPEED = 1.68;
const LEVEL_THREE_AMBUSH_HOUND_SPEED = 1.75;

export function createLevelThreeScene({ initialState = null } = {}) {
  const scene = new THREE.Scene();
  const FOG_COLOR = 0x242620;
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.017);

  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 78);
  const spawnCell = levelThreeCellCenter(3, 3);
  const targetPosition = levelThreeCellCenter(36, 20);
  const spawn = {
    x: spawnCell.x,
    z: spawnCell.z,
    yaw: -Math.PI * 0.34,
  };
  camera.position.set(spawn.x, 1.62, spawn.z);
  camera.rotation.order = "YXZ";
  camera.rotation.y = spawn.yaw;
  const viewModel = attachFirstPersonViewModel(camera);
  scene.add(camera);

  let propColliders = addLevelThreeElectricalDetails(scene);
  propColliders = propColliders.concat(addLevelThreeSanctumStatue(scene));

  const pickupInitial = initialState?.pickups ?? {};
  const interactionInitial = initialState?.interactions ?? {};
  const objectiveInitial = initialState?.objectives ?? {};
  const entityInitial = snapEntityStates(
    Array.isArray(initialState?.entities) ? initialState.entities : [],
    isWalkable,
  );
  const savedBacteriaStates = entityInitial.filter((entity) => entity.type === "bacteria");

  const { northSouth, eastWest, fixturePositions } = collectLevelTransforms({
    cols: LEVEL_THREE_COLS,
    rows: LEVEL_THREE_ROWS,
    isCellOpen: isLevelThreeOpenCell,
    getCellCenter: levelThreeCellCenter,
    countOpenNeighbors: countLevelThreeOpenNeighbors,
    darkZones: LEVEL_THREE_DARK_ZONES,
    startCell: LEVEL_THREE_START_CELL,
    targetCell: LEVEL_THREE_TARGET_CELL,
    minFixtureDistance: LEVEL_THREE_MIN_FIXTURE_DISTANCE,
    // Level 3 has no diagonal cells. This prevents the shared builder from
    // indexing Level 2's smaller map while Level 3 is loading.
    isDiagonalCell: () => false,
    isBarCell: (col, row) => LEVEL_THREE_BAR_POSITIONS.some((b) => b.col === col && b.row === row),
  });
  fixturePositions.forEach((fixture, index) => {
    fixture.color = index % 5 === 0 ? 0xff4d36 : 0xffd68a;
    fixture.baseIntensity *= index % 4 === 0 ? 0.72 : 0.92;
    fixture.range *= index % 4 === 0 ? 0.78 : 0.9;
  });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(LEVEL_THREE_COLS * CELL_SIZE, LEVEL_THREE_ROWS * CELL_SIZE),
    new THREE.MeshStandardMaterial({
      map: createLevelThreeFloorTexture(),
      color: 0xffffff,
      roughness: 0.92,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(LEVEL_THREE_CENTER_X, 0, LEVEL_THREE_CENTER_Z);
  floor.position.set(0, 0, 0);
  scene.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(LEVEL_THREE_COLS * CELL_SIZE, LEVEL_THREE_ROWS * CELL_SIZE),
    new THREE.MeshStandardMaterial({
      map: createLevelThreeCeilingTexture(),
      color: 0xffffff,
      roughness: 0.82,
    }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(LEVEL_THREE_CENTER_X, CEILING_Y, LEVEL_THREE_CENTER_Z);
  scene.add(ceiling);

  const wallMaterial = new THREE.MeshStandardMaterial({
    map: createLevelThreeBrickTexture(),
    color: 0xffffff,
    roughness: 0.88,
  });
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

  scene.add(new THREE.HemisphereLight(0xffe0aa, 0x20251f, 0.72));
  const fill = new THREE.DirectionalLight(0xffb86e, 0.12);
  fill.position.set(-8, CEILING_Y - 0.4, 12);
  scene.add(fill);

  const fixtures = createLayoutLights(scene, fixturePositions, {
    maxPointLights: LEVEL_THREE_MAX_POINT_LIGHTS,
  });
  const updateLightState = createStableLightState("VOLT", {
    dimBelow: 0.32,
    normalAbove: 0.5,
    dimDelay: 0.45,
    normalDelay: 0.8,
  });
  addLayoutDarkPockets(scene, {
    darkZones: LEVEL_THREE_DARK_ZONES,
    originX: LEVEL_THREE_ORIGIN_X,
    originZ: LEVEL_THREE_ORIGIN_Z,
  });
  addLevelThreeBlackSludgePipes(scene);
  addLevelThreeIndestructibleBars(scene);
  addLevelThreeAssemblyLineEquipment(scene);
  addLevelThreeBoilerRoomPipe(scene);
  addLevelThreeNotebookPapers(scene);
  addLevelThreeMural(scene);
  addLevelThreePurpificationSpots(scene);
  const almondWater = createAlmondWaterPickup(scene, {
    cols: LEVEL_THREE_COLS,
    rows: LEVEL_THREE_ROWS,
    isCellOpen: isLevelThreeOpenCell,
    getCellCenter: levelThreeCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial["almond-water"] ?? null,
  });
  const superAlmondWater = createAlmondWaterPickup(scene, {
    cols: LEVEL_THREE_COLS,
    rows: LEVEL_THREE_ROWS,
    isCellOpen: isLevelThreeOpenCell,
    getCellCenter: levelThreeCellCenter,
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
    cols: LEVEL_THREE_COLS,
    rows: LEVEL_THREE_ROWS,
    isCellOpen: isLevelThreeOpenCell,
    getCellCenter: levelThreeCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial.flashlight ?? null,
  });
  const detector = createDetectorPickup(scene, {
    cols: LEVEL_THREE_COLS,
    rows: LEVEL_THREE_ROWS,
    isCellOpen: isLevelThreeOpenCell,
    getCellCenter: levelThreeCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial.detector ?? null,
  });
  const compass = createCompassPickup(scene, {
    cols: LEVEL_THREE_COLS,
    rows: LEVEL_THREE_ROWS,
    isCellOpen: isLevelThreeOpenCell,
    getCellCenter: levelThreeCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial.compass ?? null,
  });
  const silenceLiquid = createSilenceLiquidPickup(scene, {
    cols: LEVEL_THREE_COLS,
    rows: LEVEL_THREE_ROWS,
    isCellOpen: isLevelThreeOpenCell,
    getCellCenter: levelThreeCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial["silence-liquid"] ?? null,
  });
  const firesalt = createFiresaltPickup(scene, {
    cols: LEVEL_THREE_COLS,
    rows: LEVEL_THREE_ROWS,
    isCellOpen: isLevelThreeOpenCell,
    getCellCenter: levelThreeCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial.firesalt ?? null,
    initialSpawnChance: 0.68,
  });
  const interactions = [
    createInteractionSpot({
      id: "level-three-generator",
      position: levelThreeCellCenter(7, 8),
      inspectHeight: 0.78,
      inspectRadius: 0.9,
      responseKey: "levelThreeGeneratorResponse",
      initialState: interactionInitial["level-three-generator"] ?? null,
    }),
  ];
  const routes = [
    { id: "level-three-elevator-level-four", targetLevel: 4, targetLabel: "LEVEL 4", label: "OFFICE", kind: "elevator", position: targetPosition, rotation: 0 },
    { id: "level-three-elevator-level-five", targetLevel: 5, targetLabel: "LEVEL 5", label: "HOTEL", kind: "elevator", position: levelThreeCellCenter(15, 18), rotation: Math.PI },
  ];
  const exitNetwork = createExitNetwork(scene, camera, routes, interactionInitial);
  const bacteriaSpawns = pickBacteriaSpawnPositions({
    cols: LEVEL_THREE_COLS,
    rows: LEVEL_THREE_ROWS,
    isCellOpen: isLevelThreeOpenCell,
    getCellCenter: levelThreeCellCenter,
    targetPosition,
    spawnPosition: spawnCell,
    count: 2,
  });
  const bacteria = bacteriaSpawns.map((spawnPosition, index) =>
    createBacteriaEntity(scene, {
      spawnPosition,
      isWalkable,
      speed: 1.48,
      id: "super-bacteria",
      initialState: savedBacteriaStates[index] ?? null,
      cols: LEVEL_THREE_COLS,
      rows: LEVEL_THREE_ROWS,
      isCellOpen: isLevelThreeOpenCell,
      worldToCell: levelThreeWorldToCell,
      cellCenter: levelThreeCellCenter,
    }),
  );
  const hound = createHoundEntity(scene, {
    spawnPosition:
      chooseBacteriaSpawn({
        cols: LEVEL_THREE_COLS,
        rows: LEVEL_THREE_ROWS,
        isCellOpen: isLevelThreeOpenCell,
        getCellCenter: levelThreeCellCenter,
        targetPosition,
        spawnPosition: spawnCell,
        avoidPositions: bacteriaSpawns,
        minSeparation: CELL_SIZE * 7,
      })[0] ?? targetPosition,
    isWalkable,
    speed: LEVEL_THREE_HOUND_SPEED,
    initialState: entityInitial.find((entity) => entity.type === "hound") ?? null,
    cols: LEVEL_THREE_COLS,
    rows: LEVEL_THREE_ROWS,
    isCellOpen: isLevelThreeOpenCell,
    worldToCell: levelThreeWorldToCell,
    cellCenter: levelThreeCellCenter,
  });
  const ambushPosition = isLevelThreeOpenCell(24, 7)
    ? levelThreeCellCenter(24, 7)
    : null;
  const ambushHound = ambushPosition
    ? createHoundEntity(scene, {
        spawnPosition: ambushPosition,
        isWalkable,
        speed: LEVEL_THREE_AMBUSH_HOUND_SPEED,
        id: "ambush-hound",
        type: "ambush-hound",
        dormant: true,
        dormantArmRadius: CELL_SIZE * 2.4,
        initialState: entityInitial.find((entity) => entity.type === "ambush-hound") ?? null,
        cols: LEVEL_THREE_COLS,
        rows: LEVEL_THREE_ROWS,
        isCellOpen: isLevelThreeOpenCell,
        worldToCell: levelThreeWorldToCell,
        cellCenter: levelThreeCellCenter,
      })
    : null;

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
      const cell = levelThreeWorldToCell(x + offsetX, z + offsetZ);
      return isLevelThreeOpenCell(cell.col, cell.row);
    });
    if (!isInOpenCells) return false;
    return !propColliders.some((collider) => circleIntersectsAabb(x, z, radius, collider));
  }

  function update(delta, elapsed, playerPosition, effects = {}) {
    let lightTotal = 0;
    fixtures.forEach((fixture, index) => {
      const hum = 0.74 + Math.sin(elapsed * 1.42 + fixture.phase) * 0.08;
      const surge = Math.sin(elapsed * fixture.speed + fixture.phase * 1.3) > 0.94 ? 1.32 : 1;
      const brownout = index % 4 === 0 && Math.sin(elapsed * 2.1 + fixture.phase) > 0.72 ? 0.44 : 1;
      const pulse = Math.max(0.18, hum * surge * brownout - fixture.weak);
      fixture.material.emissiveIntensity = pulse * fixture.baseIntensity * 1.7;
      updateFixturePointLight(fixture, pulse, 1.02);
      lightTotal += pulse;
    });

    const flicker = fixtures.length > 0 ? lightTotal / fixtures.length : 0.42;
    const enteredExit = exitNetwork.update(delta, playerPosition);
    const exitDistance = Math.min(...routes.map((route) => Math.hypot(playerPosition.x - route.position.x, playerPosition.z - route.position.z)));
    if (enteredExit) objectiveReached = true;
    scene.fog.density = 0.017 + (1 - flicker) * 0.012;
    updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition);
    const almondWaterState = almondWater.update(delta, elapsed, playerPosition);
    const superAlmondWaterState = superAlmondWater.update(delta, elapsed, playerPosition);
    const flashlightState = flashlight.update(delta, elapsed, playerPosition);
    const detectorState = detector.update(delta, elapsed, playerPosition);
    const compassState = compass.update(delta, elapsed, playerPosition);
    const silenceLiquidState = silenceLiquid.update(delta, elapsed, playerPosition);
    const firesaltState = firesalt.update(delta, elapsed, playerPosition);
    const bacteriaStates = bacteria.map((b) => b.update(delta, elapsed, playerPosition, effects));
    const houndState = hound.update(delta, elapsed, playerPosition, effects);
    const ambushHoundState = ambushHound ? ambushHound.update(delta, elapsed, playerPosition, effects) : null;
    const entities = ambushHoundState
      ? [...bacteriaStates, houndState, ambushHoundState]
      : [...bacteriaStates, houndState];
    const entityContact = entities.some((state) => state.contact);
    const pickups = [almondWaterState, superAlmondWaterState, firesaltState, silenceLiquidState, compassState, detectorState, flashlightState];

    return {
      exitDistance: Math.round(exitDistance),
      exitReached: Boolean(enteredExit),
      nextLevel: enteredExit?.targetLevel,
      entityContact,
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
        firesalt.inspect(camera),
        superAlmondWater.inspect(camera),
        silenceLiquid.inspect(camera),
        compass.inspect(camera),
        detector.inspect(camera),
        flashlight.inspect(camera),
      ),
      lightState: updateLightState(delta, flicker),
      statusText: objectiveReached
        ? "BREAKER OPEN"
        : exitDistance < 8
          ? "BREAKER TRACE"
          : "ELECTRICAL STATION",
    };
  }

  return {
    level: 3,
    levelLabel: "LEVEL 3",
    levelName: "ELECTRICAL STATION",
    get viewModelName() {
      return getViewModelName(viewModel);
    },
    colliderCount: propColliders.length,
    nextLevel: 4,
    exitMode: "network",
    scene,
    camera,
    spawn,
    targetPosition,
    isWalkable,
    decorativeItemSpawns: [
      { id: "wire-spool", position: { ...levelThreeCellCenter(8, 9), y: 0.2 }, rotation: 0.9, tiltZ: 0.18 },
    ],
    update,
    getPickupTarget: (playerPosition) =>
      getPickupTarget(playerPosition, firesalt, detector, silenceLiquid, superAlmondWater, compass, flashlight, almondWater),
    tryPickup: (playerPosition) =>
      tryPickupItems(playerPosition, firesalt, detector, silenceLiquid, superAlmondWater, compass, flashlight, almondWater),
    interact: (playerPosition, access) => exitNetwork.interact(playerPosition, access) ?? tryInteractWithSpots(playerPosition, ...interactions),
    getSnapshot() {
      return {
        pickups: {
          flashlight: flashlight.getState(),
          detector: detector.getState(),
          compass: compass.getState(),
          "silence-liquid": silenceLiquid.getState(),
          firesalt: firesalt.getState(),
          "almond-water": almondWater.getState(),
          "super-almond-water": superAlmondWater.getState(),
        },
        interactions: {
          ...exitNetwork.getState(),
          ...Object.fromEntries(interactions.map((spot) => [spot.id, spot.getState()])),
        },
        objectives: { reached: objectiveReached },
        entities: [
          ...bacteria.map((b) => b.getState()),
          hound.getState(),
          ...(ambushHound ? [ambushHound.getState()] : []),
        ],
      };
    },
  };
}



