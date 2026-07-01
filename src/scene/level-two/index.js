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
} from "./layout.js";
import {
  createLevelTwoFloorTexture,
  createLevelTwoWallTexture,
  createLevelTwoCeilingTexture,
} from "./textures.js";
import {
  collectLevelTwoTransforms,
  createLevelTwoLights,
  addLevelTwoPipes,
  addLevelTwoMachinery,
  addLevelTwoSteam,
  addLevelTwoServiceDoor,
  addLevelTwoFloorHeat,
  addLevelTwoDarkPockets,
  addLevelTwoIndustrialDetails,
  addLevelTwoUtilityProps,
} from "./props.js";
import {
  createAlmondWaterPickup,
  createFlashlightPickup,
  createDetectorPickup,




} from "../items/index.js";
import {
  createBacteriaEntity,
  createHoundEntity,
  chooseBacteriaSpawn,
  createInteractionSpot,
  tryPickupItems,
  getFocusedEntity,
  getFocusedInteraction,
  getFocusedItem,
  tryInteractWithSpots,
} from "../entities/index.js";

export function createLevelTwoScene() {
  const scene = new THREE.Scene();
  const FOG_COLOR = 0x554537;
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0165);

  const cameraFar =
    Math.hypot(LEVEL_TWO_COLS * CELL_SIZE, LEVEL_TWO_ROWS * CELL_SIZE) + CELL_SIZE * 2;
  const camera = new THREE.PerspectiveCamera(76, 1, 0.05, cameraFar);
  const viewModel = attachFirstPersonViewModel(camera);
  scene.add(camera);

  const spawnCell = levelTwoCellCenter(LEVEL_TWO_START_CELL.col, LEVEL_TWO_START_CELL.row);
  const spawn = { x: spawnCell.x, z: spawnCell.z, yaw: LEVEL_TWO_START_CELL.yaw };
  const targetPosition = levelTwoCellCenter(LEVEL_TWO_TARGET_CELL.col, LEVEL_TWO_TARGET_CELL.row);

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: createLevelTwoFloorTexture(),
    color: 0xc9b990,
    emissive: 0x2e2112,
    emissiveIntensity: 0.4,
    roughness: 0.94,
    metalness: 0.08,
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: createLevelTwoWallTexture(),
    color: 0xd0c29b,
    emissive: 0x2c1d0f,
    emissiveIntensity: 0.32,
    roughness: 0.94,
    metalness: 0.04,
  });
  const ceilingMaterial = new THREE.MeshStandardMaterial({
    map: createLevelTwoCeilingTexture(),
    color: 0x8b8170,
    emissive: 0x281c12,
    emissiveIntensity: 0.36,
    roughness: 0.9,
    metalness: 0.08,
  });
  const wallCapMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b4335,
    emissive: 0x130e08,
    emissiveIntensity: 0.16,
    roughness: 0.92,
    metalness: 0.08,
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
    new THREE.PlaneGeometry(LEVEL_TWO_COLS * CELL_SIZE, LEVEL_TWO_ROWS * CELL_SIZE),
    floorMaterial,
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(LEVEL_TWO_COLS * CELL_SIZE, LEVEL_TWO_ROWS * CELL_SIZE),
    ceilingMaterial,
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, CEILING_Y, 0);
  scene.add(ceiling);

  const { northSouth, eastWest, fixturePositions } = collectLevelTwoTransforms();
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

  scene.add(new THREE.HemisphereLight(0xffbd82, 0x332216, 0.96));
  const heatFill = new THREE.DirectionalLight(0xff9b54, 0.16);
  heatFill.position.set(-8, CEILING_Y - 0.3, 18);
  scene.add(heatFill);

  const fixtures = createLevelTwoLights(scene, fixturePositions);
  const updateLightState = createStableLightState("HEAT", {
    dimBelow: 0.34,
    normalAbove: 0.52,
    dimDelay: 0.5,
    normalDelay: 0.78,
  });
  addLevelTwoServiceDoor(scene, targetPosition);
  addLevelTwoPipes(scene);
  let propColliders = addLevelTwoMachinery(scene);
  propColliders = propColliders.concat(addLevelTwoUtilityProps(scene));
  const steamPuffs = addLevelTwoSteam(scene);
  addLevelTwoFloorHeat(scene);
  addLevelTwoDarkPockets(scene);
  addLevelTwoIndustrialDetails(scene);
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
      id: "level-two-valve",
      position: levelTwoCellCenter(28, 5),
      inspectHeight: 1.45,
      inspectRadius: 0.72,
      responseKey: "levelTwoValveResponse",
    }),
    createInteractionSpot({
      id: "level-two-service-door",
      position: targetPosition,
      inspectHeight: 1.65,
      inspectRadius: 0.8,
      responseKey: "levelTwoServiceDoorResponse",
    }),
  ];
  const bacteriaSpawn =
    chooseBacteriaSpawn({
      cols: LEVEL_TWO_COLS,
      rows: LEVEL_TWO_ROWS,
      isCellOpen: isLevelTwoOpenCell,
      getCellCenter: levelTwoCellCenter,
      targetPosition,
      spawnPosition: spawnCell,
    })[0] ?? targetPosition;
  const bacteria = createBacteriaEntity(scene, {
    spawnPosition: bacteriaSpawn,
    isWalkable,
    speed: 1.22,
  });
  const hound = createHoundEntity(scene, {
    spawnPosition:
      chooseBacteriaSpawn({
      cols: LEVEL_TWO_COLS,
      rows: LEVEL_TWO_ROWS,
      isCellOpen: isLevelTwoOpenCell,
      getCellCenter: levelTwoCellCenter,
      targetPosition,
      spawnPosition: spawnCell,
        avoidPositions: [bacteriaSpawn],
        minSeparation: CELL_SIZE * 7,
      })[0] ?? targetPosition,
    isWalkable,
    speed: 1.34,
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
    fixtures.forEach((fixture) => {
      const hum = 0.78 + Math.sin(elapsed * 1.7 + fixture.phase) * 0.07;
      const brownout = Math.sin(elapsed * fixture.speed + fixture.phase * 1.7) > 0.91 ? 0.48 : 1;
      const pulse = Math.max(0.24, hum * brownout - fixture.weak);
      fixture.material.emissiveIntensity = pulse * fixture.baseIntensity * 1.8;
      updateFixturePointLight(fixture, pulse, 1.08);
      lightTotal += pulse;
    });

    steamPuffs.forEach((puff) => {
      const phase = puff.userData.phase ?? 0;
      const wave = 0.5 + Math.sin(elapsed * 1.8 + phase) * 0.5;
      const scale = 0.8 + wave * 0.9;
      puff.scale.set(scale * 0.78, 0.65 + wave * 0.9, scale);
      puff.position.y = 1.12 + wave * 0.18;
      puff.material.opacity = 0.035 + wave * 0.07;
    });

    const flicker = fixtures.length > 0 ? lightTotal / fixtures.length : 0.56;
    const exitDistance = Math.hypot(
      playerPosition.x - targetPosition.x,
      playerPosition.z - targetPosition.z,
    );
    if (exitDistance < LEVEL_TWO_EXIT_TRIGGER_RADIUS) objectiveReached = true;
    scene.fog.density = 0.016 + (1 - flicker) * 0.01;
    updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition);
    const almondWaterState = almondWater.update(delta, elapsed, playerPosition);
    const superAlmondWaterState = superAlmondWater.update(delta, elapsed, playerPosition);
    const flashlightState = flashlight.update(delta, elapsed, playerPosition);
    const detectorState = detector.update(delta, elapsed, playerPosition);
    const bacteriaState = bacteria.update(delta, elapsed, playerPosition);
    const houndState = hound.update(delta, elapsed, playerPosition);
    const entities = [bacteriaState, houndState];

    return {
      exitDistance: Math.round(exitDistance),
      exitReached: objectiveReached,
      entityContact: entities.some((entity) => entity.contact),
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
        ? "SERVICE LOCKED"
        : exitDistance < 8
          ? "PIPE EXIT TRACE"
          : "PIPE DREAMS",
    };
  }

  return {
    level: 2,
    levelLabel: "LEVEL 2",
    levelName: "PIPE DREAMS",
    viewModelName: getViewModelName(viewModel),
    colliderCount: propColliders.length,
    nextLevel: 3,
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



