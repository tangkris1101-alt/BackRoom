import * as THREE from "three";
import { colliderBlocksAtFeetHeight, getPlatformFloorHeight, resolvePlatformOverlap } from "../common/platform-collision.js";
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
import { createGameMaterial, applyFixtureLightFieldIfNeeded, isLowQuality } from "../common/materials.js";
import { attachFirstPersonViewModel, getViewModelName, setFirstPersonViewModelKeyLight, setFirstPersonViewModelLighting, updateFirstPersonHazmatViewModel } from "../common/view-model.js";
import {
  LEVEL_ONE_COLS,
  LEVEL_ONE_ROWS,
  LEVEL_ONE_START_CELL,
  LEVEL_ONE_TARGET_CELL,
  LEVEL_ONE_ORIGIN_X,
  LEVEL_ONE_ORIGIN_Z,
  LEVEL_ONE_CENTER_X,
  LEVEL_ONE_CENTER_Z,
  LEVEL_ONE_CORRIDOR_BOUNDS,
  LEVEL_ONE_ARRIVAL_LOBBY_CELL,
  LEVEL_ONE_ARRIVAL_SHAFT_CELL,
  isLevelOneOpenCell,
  levelOneCellCenter,
  levelOneWorldToCell,
  getLevelOneTargetMount,
} from "./layout.js";
import {
  createLevelOneFloorPbrMaps,
  createLevelOneWallPbrMaps,
  createLevelOneCeilingTexture,
} from "./textures.js";
import { enableAoUv } from "../common/texture-utils.js";
import { collapseWallRuns, createWorldMappedWallGeometry } from "./wall-geometry.js";
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
  createFiresaltPickup,




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
import { createElevatorCab, getElevatorCabOrigin } from "../level-zero/elevator.js";

const LEVEL_ONE_DOORWAY_WIDTH = 2.7;
const LEVEL_ONE_DOORWAY_HEIGHT = 2.56;
const LEVEL_ONE_EXIT_ACTIVITY_RADIUS = CELL_SIZE * 6;
const LEVEL_ONE_ARRIVAL_ELEVATOR_ID = "level-one-arrival-elevator";
// Painting a wider stretch of wall between repeats keeps the damp pattern from
// reading as a regular stripe down the long halls.
const LEVEL_ONE_WALL_TILE_METERS = 6.4;

// Deterministic per-fixture variation. Rows of identical blobs would light the
// slab and walls in even bands that read as printed seams; varying reach and
// strength per fixture keeps the grid from being legible.
function getFixtureVariation(fixture) {
  const seedValue = Math.abs(Math.sin((fixture.x * 12.9898 + fixture.z * 78.233) * 0.017));
  return {
    radius: 0.82 + (seedValue % 0.37),
    strength: 0.86 + ((seedValue * 7.31) % 0.28),
  };
}

function createLevelOneLightField(fixturePositions, { includeTexture = true } = {}) {
  const size = 512;
  const width = LEVEL_ONE_COLS * CELL_SIZE;
  const height = LEVEL_ONE_ROWS * CELL_SIZE;
  const sample = (worldX, worldZ) => THREE.MathUtils.clamp(
    fixturePositions.reduce((total, fixture) => {
      const variation = getFixtureVariation(fixture);
      const radius = Math.max((24 / size) * width, fixture.range * 1.42 * variation.radius);
      const distance = Math.hypot(fixture.x - worldX, fixture.z - worldZ);
      const falloff = THREE.MathUtils.clamp(1 - distance / radius, 0, 1);
      const strength = THREE.MathUtils.clamp(fixture.baseIntensity / 1.8, 0.42, 1) * variation.strength;
      return total + falloff * falloff * strength;
    }, 0),
    0,
    1,
  );
  if (!includeTexture) return { texture: null, width, height, sample };
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
    const variation = getFixtureVariation(fixture);
    const radius = Math.max(24, (fixture.range / width) * size * 1.42 * variation.radius);
    const strength = THREE.MathUtils.clamp(fixture.baseIntensity / 1.8, 0.42, 1) * variation.strength;
    const gradient = context.createRadialGradient(x, z, 0, x, z, radius);
    // Sampled smooth falloff instead of a few hard stops: the old profile left
    // a visible ring where the gradient knee sat, which banded every fixture
    // row across the slab.
    for (let stop = 0; stop <= 1.0001; stop += 0.125) {
      const falloff = Math.pow(1 - stop, 1.9);
      const tone = Math.round(128 + 104 * (1 - stop));
      gradient.addColorStop(stop, `rgba(${tone}, ${tone + 5}, ${tone}, ${(1.2 * falloff * strength).toFixed(4)})`);
    }
    context.fillStyle = gradient;
    context.fillRect(x - radius, z - radius, radius * 2, radius * 2);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return { texture, width, height, sample };
}

function applyLevelOneLightField(material, lightField, intensity) {
  if (!material?.isMeshStandardMaterial || material.userData.levelOneLightFieldIntensity != null) return;
  material.userData.levelOneLightFieldIntensity = intensity;
  material.onBeforeCompile = (shader) => {
    // Kept on the material so the debug layer switch can dim the baked field.
    material.userData.levelOneLightFieldUniforms = shader.uniforms;
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
  // The injected GLSL is identical for every intensity - only the uniform value
  // differs, and uniforms live on the material. Baking the intensity into the
  // cache key instead made three.js compile the same shader once per intensity.
  material.customProgramCacheKey = () => "level-one-light-field";
}

function isFirstPersonViewModelMesh(object) {
  for (let current = object; current; current = current.parent) {
    if (typeof current.name === "string" && current.name.startsWith("first-person-")) return true;
  }
  return false;
}

function applyLevelOneLightFieldSafe(material, lightField, intensity) {
  if (!lightField?.texture) return;
  applyFixtureLightFieldIfNeeded(material, applyLevelOneLightField, lightField, intensity);
}

function applyLevelOnePropLightField(scene, lightField) {
  scene.traverse((object) => {
    if (!object.isMesh || isFirstPersonViewModelMesh(object)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => {
      if (material.emissiveIntensity > 0.5) return;
      applyLevelOneLightFieldSafe(material, lightField, 0.72);
    });
  });
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

function addLevelOneWorldMappedWalls(scene, northSouth, eastWest, materials) {
  const geometry = createWorldMappedWallGeometry([
    ...collapseWallRuns(northSouth, "x", CELL_SIZE, WALL_THICKNESS),
    ...collapseWallRuns(eastWest, "z", CELL_SIZE, WALL_THICKNESS),
  ], WALL_HEIGHT, { horizontalTileMeters: LEVEL_ONE_WALL_TILE_METERS });
  scene.add(new THREE.Mesh(geometry.wall, materials[0]));
  scene.add(new THREE.Mesh(geometry.caps, materials[2]));
}

function getEntryPosition(mount) {
  const rotation = mount.rotation ?? 0;
  return {
    x: mount.x + Math.sin(rotation) * 1.05,
    z: mount.z + Math.cos(rotation) * 1.05,
  };
}

export function createLevelOneScene({ initialState = null, entryContext = null } = {}) {
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
  const targetPosition = levelOneCellCenter(LEVEL_ONE_TARGET_CELL.col, LEVEL_ONE_TARGET_CELL.row);
  const elevatorMount = getLevelOneTargetMount(targetPosition);
  const arrivalLobbyCenter = levelOneCellCenter(LEVEL_ONE_ARRIVAL_LOBBY_CELL.col, LEVEL_ONE_ARRIVAL_LOBBY_CELL.row);
  const arrivalDoorPlane = { x: arrivalLobbyCenter.x, z: arrivalLobbyCenter.z - CELL_SIZE / 2 };
  const arrivalMount = { ...arrivalDoorPlane, rotation: 0 };
  const arrivalCabOrigin = getElevatorCabOrigin(arrivalDoorPlane, arrivalMount.rotation);
  const arrivedFromLevelZero = entryContext?.type === "route" && entryContext.sourceLevel === 0;
  const spawn = arrivedFromLevelZero
    ? { x: arrivalCabOrigin.x, z: arrivalCabOrigin.z, yaw: Math.PI }
    : { x: spawnCell.x, z: spawnCell.z, yaw: LEVEL_ONE_START_CELL.yaw };

  let propColliders = addLevelOneCrates(scene);
  propColliders = propColliders.concat(addLevelOneSupplyShelves(scene));

  const pickupInitial = initialState?.pickups ?? {};
  const interactionInitial = initialState?.interactions ?? {};
  const objectiveInitial = initialState?.objectives ?? {};
  const { northSouth, eastWest, corridorNorthSouth, corridorEastWest, fixturePositions } = collectLevelOneTransforms({
    openings: [elevatorMount, arrivalMount],
  });
  const lowQuality = isLowQuality();
  const lightField = createLevelOneLightField(fixturePositions, { includeTexture: !lowQuality });
  if (lowQuality) {
    // Low mode skips the baked fixture light-field shader. Keep enough soft
    // reflected light to read the dry concrete without changing high mode.
    scene.add(new THREE.HemisphereLight(0xc7d4c9, 0x364138, 0.65));
    const lowFloorFill = new THREE.DirectionalLight(0xb8c5b9, 0.7);
    lowFloorFill.position.set(0, 12, 0);
    scene.add(lowFloorFill);
  }

  const floorMaterial = createGameMaterial(({ lowQuality: useLowQuality }) => ({
    ...createLevelOneFloorPbrMaps({ includeDetailMaps: !useLowQuality }),
    color: 0xd5dccc,
    emissive: 0x3b463d,
    emissiveIntensity: 0.32,
    roughness: 0.96,
    normalScale: new THREE.Vector2(0.56, 0.56),
    aoMapIntensity: 0.72,
  }));
  const wallMaterial = createGameMaterial(({ lowQuality: useLowQuality }) => ({
    ...createLevelOneWallPbrMaps({ includeDetailMaps: !useLowQuality }),
    color: 0xffffff,
    emissive: 0x000000,
    emissiveIntensity: 0,
    roughness: 0.91,
    normalScale: new THREE.Vector2(0.42, 0.42),
  }));
  const corridorWallMaterial = createGameMaterial(({ lowQuality: useLowQuality }) => ({
    ...createLevelOneWallPbrMaps({ corridor: true, includeDetailMaps: !useLowQuality }),
    color: 0xffffff,
    emissive: 0x000000,
    emissiveIntensity: 0,
    roughness: 0.87,
    normalScale: new THREE.Vector2(0.36, 0.36),
  }));
  const ceilingMaterial = createGameMaterial({
    // The slab carries the same damp staining as the walls; without it the
    // untextured plane reads as an empty white void overhead.
    map: createLevelOneCeilingTexture(),
    color: 0xffffff,
    emissive: 0x000000,
    emissiveIntensity: 0,
    roughness: 0.92,
  });
  const wallCapMaterial = createGameMaterial({
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
  const corridorWallMaterials = [
    corridorWallMaterial,
    corridorWallMaterial,
    wallCapMaterial,
    wallCapMaterial,
    corridorWallMaterial,
    corridorWallMaterial,
  ];
  applyLevelOneLightFieldSafe(floorMaterial, lightField, 3.05);
  // Level 1 keeps its bright fixtures, but the wall and slab gains stay low
  // enough that the stained texture is not washed back to flat white.
  applyLevelOneLightFieldSafe(wallMaterial, lightField, 1.95);
  applyLevelOneLightFieldSafe(corridorWallMaterial, lightField, 1.85);
  applyLevelOneLightFieldSafe(ceilingMaterial, lightField, 1.65);
  applyLevelOneLightFieldSafe(wallCapMaterial, lightField, 1.85);

  const floor = new THREE.Mesh(
    enableAoUv(new THREE.PlaneGeometry(LEVEL_ONE_COLS * CELL_SIZE, LEVEL_ONE_ROWS * CELL_SIZE)),
    floorMaterial,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(LEVEL_ONE_CENTER_X, 0, LEVEL_ONE_CENTER_Z);
  scene.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(LEVEL_ONE_COLS * CELL_SIZE, LEVEL_ONE_ROWS * CELL_SIZE),
    ceilingMaterial,
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(LEVEL_ONE_CENTER_X, CEILING_Y, LEVEL_ONE_CENTER_Z);
  scene.add(ceiling);

  addLevelOneWorldMappedWalls(scene, northSouth, eastWest, wallMaterials);
  addLevelOneWorldMappedWalls(scene, corridorNorthSouth, corridorEastWest, corridorWallMaterials);
  // A low concrete kick plate gives the maintained wall a readable ground
  // junction without adding stains or broadly brightening the warehouse.
  const skirtingMaterial = createGameMaterial({
    color: 0x7a857d,
    emissive: 0x253028,
    emissiveIntensity: 0.18,
    roughness: 0.94,
  });
  applyLevelOneLightFieldSafe(skirtingMaterial, lightField, 1.5);
  // Corner-extended ends arrive as { position, scale }. The skirt has to carry
  // the same stretch: a module-length skirt stops at the wall's old end, which
  // leaves a notch at every convex corner and a bare strip at every wall end.
  const atFloor = (transforms) => transforms.map((transform) => {
    const position = transform.position ?? transform;
    const scale = transform.scale;
    if (!scale) return new THREE.Vector3(position.x, 0.075, position.z);
    return {
      position: new THREE.Vector3(position.x, 0.075, position.z),
      scale: new THREE.Vector3(scale.x, 1, scale.z),
    };
  });
  const northSouthSkirting = new THREE.BoxGeometry(CELL_SIZE, 0.15, WALL_THICKNESS + 0.035);
  const eastWestSkirting = new THREE.BoxGeometry(WALL_THICKNESS + 0.035, 0.15, CELL_SIZE);
  addInstancedBoxes(scene, northSouthSkirting, skirtingMaterial, atFloor(northSouth));
  addInstancedBoxes(scene, eastWestSkirting, skirtingMaterial, atFloor(eastWest));
  addInstancedBoxes(scene, northSouthSkirting, skirtingMaterial, atFloor(corridorNorthSouth));
  addInstancedBoxes(scene, eastWestSkirting, skirtingMaterial, atFloor(corridorEastWest));
  addLevelOneDoorwayWall(scene, elevatorMount, wallMaterials);
  addLevelOneDoorwayWall(scene, arrivalMount, wallMaterials);

  const fixtures = createLevelOneLights(scene, fixturePositions, { dynamicPointLights: true });
  const updateLightState = createStableLightState("HUM", {
    dimBelow: 0.48,
    normalAbove: 0.62,
  });
  addLevelOnePipes(scene);
  addLevelOnePuddles(scene);
  addLevelOneWallSigns(scene);
  const corridorProps = addLevelOneCorridorDetails(scene, interactionInitial);
  propColliders = propColliders.concat(corridorProps.colliders);
  const workbenches = corridorProps.workbenches;
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
  const firesalt = createFiresaltPickup(scene, {
    cols: LEVEL_ONE_COLS,
    rows: LEVEL_ONE_ROWS,
    isCellOpen: isLevelOneOpenCell,
    getCellCenter: levelOneCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial.firesalt ?? null,
    initialSpawnChance: 0.61,
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
  ];
  // Door colliders join the prop list that isWalkable / getFloorHeight /
  // resolvePosition already walk. Every pickup above was placed before this
  // call, so item candidate cells and saved positions are untouched.
  const exitNetwork = createExitNetwork(scene, camera, routes, interactionInitial, { colliders: propColliders });
  const arrivalElevator = createElevatorCab(scene, arrivalCabOrigin, interactionInitial[LEVEL_ONE_ARRIVAL_ELEVATOR_ID] ?? null, {
    id: LEVEL_ONE_ARRIVAL_ELEVATOR_ID,
    name: "level-one-arrival-elevator",
    rotation: 0,
    signText: "LEVEL 1",
    registerExitRoute: false,
    arrival: true,
    arriveOpen: arrivedFromLevelZero,
  });
  // Snapping a saved entity position runs isWalkable, which samples the arrival
  // cabin, so it has to wait until the cabin above exists.
  const entityInitial = snapEntityStates(
    Array.isArray(initialState?.entities) ? initialState.entities : [],
    isWalkable,
  );
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
    speed: 1.48,
    initialState: bacteriaInitial,
    cols: LEVEL_ONE_COLS,
    rows: LEVEL_ONE_ROWS,
    isCellOpen: isLevelOneOpenCell,
    worldToCell: levelOneWorldToCell,
    cellCenter: levelOneCellCenter,
  });
  applyLevelOnePropLightField(scene, lightField);

  let objectiveReached = Boolean(objectiveInitial.reached);

  function isWalkable(x, z, radius = 0.36, feetY = 0) {
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
      const inArrivalShaft =
        cell.col === LEVEL_ONE_ARRIVAL_SHAFT_CELL.col && cell.row === LEVEL_ONE_ARRIVAL_SHAFT_CELL.row;
      return (
        (isLevelOneOpenCell(cell.col, cell.row) || inArrivalShaft) &&
        !arrivalElevator.blocksMovement(x + offsetX, z + offsetZ)
      );
    });
    if (!isInOpenCells) return false;

    return !propColliders.some((collider) =>
      colliderBlocksAtFeetHeight(collider, feetY) && circleIntersectsAabb(x, z, radius, collider),
    );
  }

  function getFloorHeight(x, z, feetY) {
    return getPlatformFloorHeight({ colliders: propColliders, x, z, feetY });
  }

  function resolvePosition(x, z, radius, feetY, maxCorrection) {
    return resolvePlatformOverlap({ colliders: propColliders, x, z, radius, feetY, maxCorrection });
  }

  // Bench drawers and the exit network both offer interactions: whichever the
  // camera is aimed at wins, and a door wins a near-tie.
  function resolveInteractionFocus(playerPosition) {
    const door = exitNetwork.inspect(playerPosition);
    const drawer = workbenches.inspect(camera, playerPosition);
    if (drawer && (!door || drawer.score > (door.score ?? 0) + 0.03)) return drawer;
    return door;
  }

  function update(delta, elapsed, playerPosition, effects = {}) {
    let lightTotal = 0;
    fixtures.forEach((fixture) => {
      const hum = 0.84 + Math.sin(elapsed * 1.18 + fixture.phase) * 0.055;
      const brokenCut = fixture.broken && Math.sin(elapsed * fixture.speed + fixture.phase) > 0.93 ? 0.52 : 1;
      const pulse = Math.max(0.38, hum * brokenCut - fixture.weak);
      fixture.material.emissiveIntensity = pulse * fixture.baseIntensity * 1.55;
      fixture.pulse = pulse;
      updateFixturePointLight(fixture, pulse, 1.05);
      lightTotal += pulse;
    });

    const flicker = fixtures.length > 0 ? lightTotal / fixtures.length : 0.76;
    const enteredExit = exitNetwork.update(delta, playerPosition);
    arrivalElevator.update(delta, playerPosition);
    workbenches.update(delta);
    const exitDistance = Math.min(...routes.map((route) => Math.hypot(
      playerPosition.x - route.position.x,
      playerPosition.z - route.position.z,
    )));
    if (enteredExit) objectiveReached = true;
    scene.fog.density = 0.012 + (1 - flicker) * 0.009;
    fixtures.updatePointLights?.(playerPosition, delta, elapsed);
    const localExposure = lightField.sample(playerPosition.x, playerPosition.z);
    setFirstPersonViewModelLighting(viewModel, {
      intensity: (0.075 + localExposure * 0.3) * (0.74 + flicker * 0.26),
      skyColor: 0xe6efdf,
      groundColor: 0x31463c,
    });
    // High quality avoids a global ambient light. Its baked light field makes
    // the warehouse readable but cannot illuminate camera-child hands, so
    // give only the view model a soft, fixture-driven key light.
    setFirstPersonViewModelKeyLight(viewModel, {
      intensity: (3.2 + localExposure * 1.2) * (0.78 + flicker * 0.22),
      color: 0xe7f1df,
    });
    updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition);
    const almondWaterState = almondWater.update(delta, elapsed, playerPosition);
    const superAlmondWaterState = superAlmondWater.update(delta, elapsed, playerPosition);
    const flashlightState = flashlight.update(delta, elapsed, playerPosition);
    const detectorState = detector.update(delta, elapsed, playerPosition);
    const compassState = compass.update(delta, elapsed, playerPosition);
    const silenceLiquidState = silenceLiquid.update(delta, elapsed, playerPosition);
    const firesaltState = firesalt.update(delta, elapsed, playerPosition);
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
    const pickups = [almondWaterState, superAlmondWaterState, firesaltState, silenceLiquidState, compassState, detectorState, flashlightState];

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
      focusInteraction: resolveInteractionFocus(playerPosition),
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
        ? "ELEVATOR ONLINE"
        : exitDistance < 9
          ? "ELEVATOR TRACE"
          : "HABITABLE ZONE",
    };
  }

  // Debug layer switch (?debug=true): dim the baked fixture light field so the
  // wall/ceiling shading can be compared against the lit result.
  const lightFieldMaterials = [];
  scene.traverse((object) => {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (material?.userData?.levelOneLightFieldIntensity != null && !lightFieldMaterials.includes(material)) {
        lightFieldMaterials.push(material);
      }
    });
  });
  let lightFieldEnabled = true;
  const debugToggles = lightField.texture ? [{
    id: "light-field",
    label: "烘焙光场",
    get: () => lightFieldEnabled,
    set: (enabled) => {
      lightFieldEnabled = enabled;
      lightFieldMaterials.forEach((material) => {
        const uniforms = material.userData.levelOneLightFieldUniforms;
        if (uniforms) {
          uniforms.levelOneLightFieldIntensity.value = enabled
            ? material.userData.levelOneLightFieldIntensity
            : 0;
        }
      });
    },
  }] : [];

  return {
    level: 1,
    levelLabel: "LEVEL 1",
    levelName: "HABITABLE ZONE",
    get viewModelName() {
      return getViewModelName(viewModel);
    },
    debugToggles,
    colliderCount: propColliders.length,
    nextLevel: 2,
    exitMode: "network",
    scene,
    camera,
    disposableTextures: lightField.texture ? [lightField.texture] : [],
    spawn,
    targetPosition,
    isWalkable,
    getFloorHeight,
    resolvePosition,
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
      getPickupTarget(playerPosition, firesalt, detector, silenceLiquid, superAlmondWater, compass, flashlight, almondWater),
    tryPickup: (playerPosition) =>
      tryPickupItems(playerPosition, firesalt, detector, silenceLiquid, superAlmondWater, compass, flashlight, almondWater),
    interact: (playerPosition, access) => {
      const focus = resolveInteractionFocus(playerPosition);
      if (focus?.workbenchDrawer) return workbenches.interact(playerPosition, focus.id);
      return exitNetwork.interact(playerPosition, access);
    },
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
          ...workbenches.getState(),
          [LEVEL_ONE_ARRIVAL_ELEVATOR_ID]: arrivalElevator.getState(),
        },
        objectives: { reached: objectiveReached },
        entities: [bacteria.getState()],
      };
    },
  };
}
