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
  LEVEL_TWO_COLS,
  LEVEL_TWO_ROWS,
  LEVEL_TWO_EXIT_TRIGGER_RADIUS,
  LEVEL_TWO_START_CELL,
  LEVEL_TWO_TARGET_CELL,
  isLevelTwoOpenCell,
  levelTwoCellCenter,
  levelTwoWorldToCell,
} from "../level-two/layout.js";
import { collectLevelTwoTransforms, createLevelTwoLights, addLevelTwoDarkPockets } from "../level-two/props.js";
import { createLevelThreeFloorTexture, createLevelThreeCeilingTexture, createLevelThreeBrickTexture } from "./textures.js";
import { addLevelThreeElectricalDetails, addLevelThreeBreakerDoor } from "./props.js";
import {
  createAlmondWaterPickup,
  createFlashlightPickup,
  createDetectorPickup,




} from "../items/index.js";
import {
  createBacteriaEntity,
  createHoundEntity,
  chooseBacteriaSpawn,
  pickBacteriaSpawnPositions,
  createInteractionSpot,
  tryPickupItems,
  getFocusedEntity,
  getFocusedInteraction,
  getFocusedItem,
  tryInteractWithSpots,
} from "../entities/index.js";

export function createLevelThreeScene() {
  const scene = new THREE.Scene();
  const FOG_COLOR = 0x242620;
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.017);

  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 78);
  const spawnCell = levelTwoCellCenter(3, 3);
  const targetPosition = levelTwoCellCenter(36, 20);
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

  const { northSouth, eastWest, fixturePositions } = collectLevelTwoTransforms();
  fixturePositions.forEach((fixture, index) => {
    fixture.color = index % 5 === 0 ? 0xff4d36 : 0xffd68a;
    fixture.baseIntensity *= index % 4 === 0 ? 0.72 : 0.92;
    fixture.range *= index % 4 === 0 ? 0.78 : 0.9;
  });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(LEVEL_TWO_COLS * CELL_SIZE, LEVEL_TWO_ROWS * CELL_SIZE),
    new THREE.MeshStandardMaterial({
      map: createLevelThreeFloorTexture(),
      color: 0xffffff,
      roughness: 0.92,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0);
  scene.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(LEVEL_TWO_COLS * CELL_SIZE, LEVEL_TWO_ROWS * CELL_SIZE),
    new THREE.MeshStandardMaterial({
      map: createLevelThreeCeilingTexture(),
      color: 0xffffff,
      roughness: 0.82,
    }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, CEILING_Y, 0);
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

  const fixtures = createLevelTwoLights(scene, fixturePositions);
  const updateLightState = createStableLightState("VOLT", {
    dimBelow: 0.32,
    normalAbove: 0.5,
    dimDelay: 0.45,
    normalDelay: 0.8,
  });
  addLevelThreeBreakerDoor(scene, targetPosition);
  addLevelTwoDarkPockets(scene);
  const propColliders = addLevelThreeElectricalDetails(scene);
  const almondWater = createAlmondWaterPickup(scene, {
    cols: LEVEL_TWO_COLS,
    rows: LEVEL_TWO_ROWS,
    isCellOpen: isLevelTwoOpenCell,
    getCellCenter: levelTwoCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
  });
  const superAlmondWater = createAlmondWaterPickup(scene, {
    cols: LEVEL_TWO_COLS,
    rows: LEVEL_TWO_ROWS,
    isCellOpen: isLevelTwoOpenCell,
    getCellCenter: levelTwoCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    variant: "super",
    respawnMin: SUPER_ALMOND_WATER_RESPAWN_MIN,
    respawnVariance: SUPER_ALMOND_WATER_RESPAWN_VARIANCE,
    initialSpawnChance: SUPER_ALMOND_WATER_INITIAL_SPAWN_CHANCE,
    respawnChance: SUPER_ALMOND_WATER_RESPAWN_CHANCE,
  });
  const flashlight = createFlashlightPickup(scene, {
    cols: LEVEL_TWO_COLS,
    rows: LEVEL_TWO_ROWS,
    isCellOpen: isLevelTwoOpenCell,
    getCellCenter: levelTwoCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
  });
  const detector = createDetectorPickup(scene, {
    cols: LEVEL_TWO_COLS,
    rows: LEVEL_TWO_ROWS,
    isCellOpen: isLevelTwoOpenCell,
    getCellCenter: levelTwoCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
  });
  const interactions = [
    createInteractionSpot({
      id: "level-three-breaker",
      position: targetPosition,
      inspectHeight: 1.72,
      inspectRadius: 0.86,
      responseKey: "levelThreeBreakerResponse",
    }),
    createInteractionSpot({
      id: "level-three-generator",
      position: levelTwoCellCenter(14, 12),
      inspectHeight: 0.78,
      inspectRadius: 0.9,
      responseKey: "levelThreeGeneratorResponse",
    }),
  ];
  const bacteriaSpawns = pickBacteriaSpawnPositions({
    cols: LEVEL_TWO_COLS,
    rows: LEVEL_TWO_ROWS,
    isCellOpen: isLevelTwoOpenCell,
    getCellCenter: levelTwoCellCenter,
    targetPosition,
    spawnPosition: spawnCell,
    count: 2,
  });
  const bacteria = bacteriaSpawns.map((spawnPosition) =>
    createBacteriaEntity(scene, {
      spawnPosition,
      isWalkable,
      speed: 1.48,
      id: "super-bacteria",
    }),
  );
  const hound = createHoundEntity(scene, {
    spawnPosition:
      chooseBacteriaSpawn({
        cols: LEVEL_TWO_COLS,
        rows: LEVEL_TWO_ROWS,
        isCellOpen: isLevelTwoOpenCell,
        getCellCenter: levelTwoCellCenter,
        targetPosition,
        spawnPosition: spawnCell,
        avoidPositions: bacteriaSpawns,
        minSeparation: CELL_SIZE * 7,
      })[0] ?? targetPosition,
    isWalkable,
    speed: 1.62,
  });

  let objectiveReached = false;

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
      const cell = levelTwoWorldToCell(x + offsetX, z + offsetZ);
      return isLevelTwoOpenCell(cell.col, cell.row);
    });
    if (!isInOpenCells) return false;
    return !propColliders.some((collider) => circleIntersectsAabb(x, z, radius, collider));
  }

  function update(delta, elapsed, playerPosition) {
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
    const exitDistance = Math.hypot(
      playerPosition.x - targetPosition.x,
      playerPosition.z - targetPosition.z,
    );
    if (exitDistance < LEVEL_TWO_EXIT_TRIGGER_RADIUS) objectiveReached = true;
    scene.fog.density = 0.017 + (1 - flicker) * 0.012;
    updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition);
    const almondWaterState = almondWater.update(delta, elapsed, playerPosition);
    const superAlmondWaterState = superAlmondWater.update(delta, elapsed, playerPosition);
    const flashlightState = flashlight.update(delta, elapsed, playerPosition);
    const detectorState = detector.update(delta, elapsed, playerPosition);
    const bacteriaStates = bacteria.map((b) => b.update(delta, elapsed, playerPosition));
    const houndState = hound.update(delta, elapsed, playerPosition);
    const entities = [...bacteriaStates, houndState];
    const entityContact = entities.some((state) => state.contact);

    return {
      exitDistance: Math.round(exitDistance),
      exitReached: objectiveReached,
      entityContact,
      flicker,
      almondWater: almondWaterState,
      superAlmondWater: superAlmondWaterState,
      flashlight: flashlightState,
      detector: detectorState,
      entities,
      focusEntity: getFocusedEntity(camera, entities),
      focusInteraction: getFocusedInteraction(camera, playerPosition, interactions),
      focusItem: getFocusedItem(
        almondWater.inspect(camera),
        superAlmondWater.inspect(camera),
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
    viewModelName: getViewModelName(viewModel),
    colliderCount: propColliders.length,
    nextLevel: 4,
    scene,
    camera,
    spawn,
    isWalkable,
    update,
    tryPickup: (playerPosition) =>
      tryPickupItems(playerPosition, detector, superAlmondWater, flashlight, almondWater),
    interact: (playerPosition) => tryInteractWithSpots(playerPosition, ...interactions),
  };
}



