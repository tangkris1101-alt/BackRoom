import * as THREE from "three";
import {
  CELL_SIZE,
  WALL_HEIGHT,
  WALL_THICKNESS,
  CEILING_Y,
  circleIntersectsAabb,
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
} from "../level-one/layout.js";
import { createLevelOneLights, collectLevelOneTransforms } from "../level-one/props.js";
import { createLevelFourCarpetTexture, createLevelFourWallTexture, createLevelFourCeilingTexture } from "./textures.js";
import { addLevelFourStairDoor, addLevelFourOfficeDetails } from "./props.js";
import {
  createAlmondWaterPickup,
  createFlashlightPickup,
  createDetectorPickup,




} from "../items/index.js";
import {
  createHoundEntity,
  chooseBacteriaSpawn,
  tryPickupItems,
  getFocusedEntity,
  getFocusedInteraction,
  getFocusedItem,
  tryInteractWithSpots,
} from "../entities/index.js";

export function createLevelFourScene() {
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
  addLevelFourStairDoor(scene, targetPosition);
  const { colliders: propColliders, interactions: propInteractions } = addLevelFourOfficeDetails(scene);
  const interactions = [
    ...propInteractions,
    createInteractionSpot({
      id: "level-four-stair-door",
      position: targetPosition,
      inspectHeight: 1.58,
      inspectRadius: 0.82,
      responseKey: "levelFourStairDoorResponse",
    }),
  ];

  const almondWater = createAlmondWaterPickup(scene, {
    cols: LEVEL_ONE_COLS,
    rows: LEVEL_ONE_ROWS,
    isCellOpen: isLevelOneOpenCell,
    getCellCenter: levelOneCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
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
  });
  const flashlight = createFlashlightPickup(scene, {
    cols: LEVEL_ONE_COLS,
    rows: LEVEL_ONE_ROWS,
    isCellOpen: isLevelOneOpenCell,
    getCellCenter: levelOneCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
  });
  const detector = createDetectorPickup(scene, {
    cols: LEVEL_ONE_COLS,
    rows: LEVEL_ONE_ROWS,
    isCellOpen: isLevelOneOpenCell,
    getCellCenter: levelOneCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
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
    speed: 1.06,
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
      const cell = levelOneWorldToCell(x + offsetX, z + offsetZ);
      return isLevelOneOpenCell(cell.col, cell.row);
    });
    if (!isInOpenCells) return false;
    return !propColliders.some((collider) => circleIntersectsAabb(x, z, radius, collider));
  }

  function update(delta, elapsed, playerPosition) {
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
    const exitDistance = Math.hypot(
      playerPosition.x - targetPosition.x,
      playerPosition.z - targetPosition.z,
    );
    if (exitDistance < LEVEL_ONE_EXIT_TRIGGER_RADIUS) objectiveReached = true;
    scene.fog.density = 0.0086 + (1 - flicker) * 0.006;
    updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition);
    const almondWaterState = almondWater.update(delta, elapsed, playerPosition);
    const superAlmondWaterState = superAlmondWater.update(delta, elapsed, playerPosition);
    const flashlightState = flashlight.update(delta, elapsed, playerPosition);
    const detectorState = detector.update(delta, elapsed, playerPosition);
    const houndState = hound.update(delta, elapsed, playerPosition);
    const entities = [houndState];

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
        ? "STAIRWELL CLEAR"
        : exitDistance < 8
          ? "STAIR TRACE"
          : "ABANDONED OFFICE",
    };
  }

  return {
    level: 4,
    levelLabel: "LEVEL 4",
    levelName: "ABANDONED OFFICE",
    viewModelName: getViewModelName(viewModel),
    colliderCount: propColliders.length,
    nextLevel: null,
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



