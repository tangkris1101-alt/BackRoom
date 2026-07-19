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
  HUB_LEVEL,
} from "../constants.js";
import { addInstancedBoxes, updateFixturePointLight, createStableLightState } from "../common/lighting.js";
import { attachFirstPersonViewModel, getViewModelName, updateFirstPersonHazmatViewModel } from "../common/view-model.js";
import {
  LEVEL_ONE_COLS,
  LEVEL_ONE_ROWS,
  LEVEL_ONE_START_CELL,
  LEVEL_ONE_TARGET_CELL,
  LEVEL_ONE_ORIGIN_X,
  LEVEL_ONE_ORIGIN_Z,
  isLevelOneOpenCell,
  levelOneCellCenter,
  levelOneWorldToCell,
  getLevelOneTargetMount,
} from "./layout.js";
import {
  createLevelOneFloorTexture,
} from "./textures.js";
import {
  createLevelOneLights,
  addLevelOnePipes,
  addLevelOneCrates,
  addLevelOnePuddles,
  addLevelOneWallSigns,
  addLevelOneSupplyShelves,
  addLevelOneCorridorDetails,
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
  getPickupTarget,
  tryPickupItems,
  getFocusedEntity,
  getFocusedItem,
} from "../entities/index.js";
import { snapEntityStates } from "../common/snap.js";
import { createExitNetwork } from "../common/exit-network.js";

const LEVEL_ONE_DOORWAY_WIDTH = 2.7;
const LEVEL_ONE_DOORWAY_HEIGHT = 2.56;
const LEVEL_ONE_EXIT_ACTIVITY_RADIUS = CELL_SIZE * 6;

function createLevelOneLightField(fixturePositions) {
  const size = 512;
  const width = LEVEL_ONE_COLS * CELL_SIZE;
  const height = LEVEL_ONE_ROWS * CELL_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.fillStyle = "#000000";
  context.fillRect(0, 0, size, size);
  context.globalCompositeOperation = "lighter";

  fixturePositions.forEach((fixture) => {
    const x = ((fixture.x - LEVEL_ONE_ORIGIN_X) / width) * size;
    const z = ((fixture.z - LEVEL_ONE_ORIGIN_Z) / height) * size;
    const radius = Math.max(24, (fixture.range / width) * size * 1.32);
    const strength = THREE.MathUtils.clamp(fixture.baseIntensity / 1.8, 0.42, 1);
    const gradient = context.createRadialGradient(x, z, 0, x, z, radius);
    gradient.addColorStop(0, `rgba(232, 237, 232, ${0.82 * strength})`);
    gradient.addColorStop(0.36, `rgba(193, 202, 196, ${0.48 * strength})`);
    gradient.addColorStop(0.78, `rgba(128, 138, 132, ${0.15 * strength})`);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = gradient;
    context.fillRect(x - radius, z - radius, radius * 2, radius * 2);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return { texture, width, height };
}

function applyLevelOneLightField(material, lightField, intensity) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.levelOneLightField = { value: lightField.texture };
    shader.uniforms.levelOneLightFieldBounds = {
      value: new THREE.Vector4(LEVEL_ONE_ORIGIN_X, LEVEL_ONE_ORIGIN_Z, lightField.width, lightField.height),
    };
    shader.uniforms.levelOneLightFieldIntensity = { value: intensity };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 levelOneWorldPosition;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec4 levelOnePosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          levelOnePosition = instanceMatrix * levelOnePosition;
        #endif
        levelOneWorldPosition = (modelMatrix * levelOnePosition).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 levelOneWorldPosition;
        uniform sampler2D levelOneLightField;
        uniform vec4 levelOneLightFieldBounds;
        uniform float levelOneLightFieldIntensity;`,
      )
      .replace(
        "#include <opaque_fragment>",
        `vec2 levelOneLightUv = vec2(
          (levelOneWorldPosition.x - levelOneLightFieldBounds.x) / levelOneLightFieldBounds.z,
          1.0 - (levelOneWorldPosition.z - levelOneLightFieldBounds.y) / levelOneLightFieldBounds.w
        );
        vec3 levelOneBakedLight = texture2D(levelOneLightField, levelOneLightUv).rgb;
        outgoingLight += levelOneBakedLight * diffuseColor.rgb * levelOneLightFieldIntensity;
        #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => `level-one-light-field-${intensity}`;
}

function addLevelOneDoorwayWall(scene, mount, material) {
  const sideWidth = (CELL_SIZE - LEVEL_ONE_DOORWAY_WIDTH) / 2;
  const isNorthSouth = Math.abs(Math.sin(mount.rotation ?? 0)) < 0.5;
  const sideGeometry = new THREE.BoxGeometry(
    isNorthSouth ? sideWidth : WALL_THICKNESS,
    WALL_HEIGHT,
    isNorthSouth ? WALL_THICKNESS : sideWidth,
  );
  const lintelGeometry = new THREE.BoxGeometry(
    isNorthSouth ? LEVEL_ONE_DOORWAY_WIDTH : WALL_THICKNESS,
    WALL_HEIGHT - LEVEL_ONE_DOORWAY_HEIGHT,
    isNorthSouth ? WALL_THICKNESS : LEVEL_ONE_DOORWAY_WIDTH,
  );
  const offset = LEVEL_ONE_DOORWAY_WIDTH / 2 + sideWidth / 2;
  for (const direction of [-1, 1]) {
    const side = new THREE.Mesh(sideGeometry, material);
    side.position.set(
      mount.x + (isNorthSouth ? direction * offset : 0),
      WALL_HEIGHT / 2,
      mount.z + (isNorthSouth ? 0 : direction * offset),
    );
    scene.add(side);
  }
  const lintel = new THREE.Mesh(lintelGeometry, material);
  lintel.position.set(mount.x, LEVEL_ONE_DOORWAY_HEIGHT + (WALL_HEIGHT - LEVEL_ONE_DOORWAY_HEIGHT) / 2, mount.z);
  scene.add(lintel);
}

function getEntryPosition(mount) {
  const rotation = mount.rotation ?? 0;
  return {
    x: mount.x + Math.sin(rotation) * 1.05,
    z: mount.z + Math.cos(rotation) * 1.05,
  };
}

export function createLevelOneScene({ initialState = null } = {}) {
  const scene = new THREE.Scene();
  const FOG_COLOR = 0x555b57;
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
  const hubCell = levelOneCellCenter(33, 23);
  const elevatorMount = getLevelOneTargetMount(targetPosition);
  const hubMount = getLevelOneTargetMount(hubCell);

  let propColliders = addLevelOneCrates(scene);
  propColliders = propColliders.concat(addLevelOneSupplyShelves(scene));

  const pickupInitial = initialState?.pickups ?? {};
  const interactionInitial = initialState?.interactions ?? {};
  const objectiveInitial = initialState?.objectives ?? {};
  const entityInitial = snapEntityStates(
    Array.isArray(initialState?.entities) ? initialState.entities : [],
    isWalkable,
  );
  const { northSouth, eastWest, corridorNorthSouth, corridorEastWest, fixturePositions } = collectLevelOneTransforms({
    openings: [elevatorMount, hubMount],
  });
  const lightField = createLevelOneLightField(fixturePositions);

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: createLevelOneFloorTexture(),
    color: 0xe1e3de,
    emissive: 0x303130,
    emissiveIntensity: 0.13,
    roughness: 0.88,
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0xd5d7d2,
    emissive: 0x000000,
    emissiveIntensity: 0,
    roughness: 0.94,
  });
  const ceilingMaterial = new THREE.MeshStandardMaterial({
    color: 0xcfd1cc,
    emissive: 0x000000,
    emissiveIntensity: 0,
    roughness: 0.9,
  });
  const wallCapMaterial = new THREE.MeshStandardMaterial({
    color: 0x747976,
    emissive: 0x000000,
    emissiveIntensity: 0,
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
  applyLevelOneLightField(floorMaterial, lightField, 3.05);
  applyLevelOneLightField(wallMaterial, lightField, 2.35);
  applyLevelOneLightField(ceilingMaterial, lightField, 2.1);
  applyLevelOneLightField(wallCapMaterial, lightField, 2.15);

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
  addInstancedBoxes(
    scene,
    new THREE.BoxGeometry(CELL_SIZE + WALL_THICKNESS, WALL_HEIGHT, WALL_THICKNESS),
    wallMaterials,
    corridorNorthSouth,
  );
  addInstancedBoxes(
    scene,
    new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, CELL_SIZE + WALL_THICKNESS),
    wallMaterials,
    corridorEastWest,
  );
  addLevelOneDoorwayWall(scene, elevatorMount, wallMaterials);
  addLevelOneDoorwayWall(scene, hubMount, wallMaterials);

  const fixtures = createLevelOneLights(scene, fixturePositions);
  const updateLightState = createStableLightState("HUM", {
    dimBelow: 0.48,
    normalAbove: 0.62,
  });
  addLevelOnePipes(scene);
  addLevelOnePuddles(scene);
  addLevelOneWallSigns(scene);
  propColliders = propColliders.concat(addLevelOneCorridorDetails(scene));
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
  const routes = [
    {
      id: "level-one-elevator-level-two",
      targetLevel: 2,
      targetLabel: "LEVEL 2",
      label: "ELEVATOR",
      kind: "elevator",
      position: elevatorMount,
      entryPosition: getEntryPosition(elevatorMount),
      rotation: elevatorMount.rotation,
    },
    {
      id: "level-one-hidden-hub-door",
      targetLevel: HUB_LEVEL,
      targetLabel: "THE HUB",
      kind: "cabinet",
      noSign: true,
      position: hubMount,
      entryPosition: getEntryPosition(hubMount),
      rotation: hubMount.rotation,
    },
  ];
  const exitNetwork = createExitNetwork(scene, camera, routes, interactionInitial);
  const bacteriaSpawn = chooseBacteriaSpawn({
    cols: LEVEL_ONE_COLS,
    rows: LEVEL_ONE_ROWS,
    isCellOpen: isLevelOneOpenCell,
    getCellCenter: levelOneCellCenter,
    targetPosition,
    spawnPosition: spawnCell,
  }).find((candidate) =>
    Math.hypot(candidate.x - targetPosition.x, candidate.z - targetPosition.z) <= LEVEL_ONE_EXIT_ACTIVITY_RADIUS,
  ) ?? targetPosition;
  const savedBacteria = entityInitial.find((entity) => entity.type === "bacteria") ?? null;
  const bacteriaInitial = savedBacteria &&
    Math.hypot(savedBacteria.position.x - targetPosition.x, savedBacteria.position.z - targetPosition.z) <= LEVEL_ONE_EXIT_ACTIVITY_RADIUS
    ? savedBacteria
    : null;
  const bacteria = createBacteriaEntity(scene, {
    spawnPosition: bacteriaSpawn,
    isWalkable,
    speed: 1.16,
    initialState: bacteriaInitial,
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
    const enteredExit = exitNetwork.update(delta, playerPosition);
    const exitDistance = Math.min(...routes.map((route) => Math.hypot(
      playerPosition.x - route.position.x,
      playerPosition.z - route.position.z,
    )));
    if (enteredExit) objectiveReached = true;
    scene.fog.density = 0.012 + (1 - flicker) * 0.009;
    updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition);
    const almondWaterState = almondWater.update(delta, elapsed, playerPosition);
    const superAlmondWaterState = superAlmondWater.update(delta, elapsed, playerPosition);
    const flashlightState = flashlight.update(delta, elapsed, playerPosition);
    const detectorState = detector.update(delta, elapsed, playerPosition);
    const compassState = compass.update(delta, elapsed, playerPosition);
    const silenceLiquidState = silenceLiquid.update(delta, elapsed, playerPosition);
    const playerNearExit = Math.hypot(
      playerPosition.x - targetPosition.x,
      playerPosition.z - targetPosition.z,
    ) <= LEVEL_ONE_EXIT_ACTIVITY_RADIUS;
    const bacteriaMoveTarget = playerNearExit ? playerPosition : targetPosition;
    const bacteriaMoveState = bacteria.update(delta, elapsed, bacteriaMoveTarget, effects);
    const bacteriaDistance = Math.hypot(
      playerPosition.x - bacteriaMoveState.x,
      playerPosition.z - bacteriaMoveState.z,
    );
    const bacteriaState = {
      ...bacteriaMoveState,
      distance: bacteriaDistance,
      contact: playerNearExit && bacteriaMoveState.contact,
    };
    const entities = [bacteriaState];
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
      focusInteraction: exitNetwork.inspect(playerPosition),
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
    exitMode: "network",
    scene,
    camera,
    spawn,
    targetPosition,
    isWalkable,
    decorativeItemSpawns: [
      { id: "empty-can", position: { ...levelOneCellCenter(10, 20), y: 0.2 }, rotation: 0.7, tiltZ: 0.12 },
      { id: "crumpled-note", position: { ...levelOneCellCenter(27, 18), y: 0.08 }, rotation: -0.35, tiltX: 0.04 },
      {
        id: "level-one-file",
        position: { ...levelOneCellCenter(12, 8), y: 0.08 },
        rotation: -0.18,
        tiltX: 0.025,
        ensureOnExistingSave: true,
      },
    ],
    update,
    getPickupTarget: (playerPosition) =>
      getPickupTarget(playerPosition, detector, silenceLiquid, superAlmondWater, compass, flashlight, almondWater),
    tryPickup: (playerPosition) =>
      tryPickupItems(playerPosition, detector, silenceLiquid, superAlmondWater, compass, flashlight, almondWater),
    interact: (playerPosition) => exitNetwork.interact(playerPosition),
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
        interactions: exitNetwork.getState(),
        objectives: { reached: objectiveReached },
        entities: [bacteria.getState()],
      };
    },
  };
}
