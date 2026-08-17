import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { colliderBlocksAtFeetHeight, getPlatformFloorHeight, resolvePlatformOverlap } from "../common/platform-collision.js";
import {
  CELL_SIZE,
  WALL_HEIGHT,
  WALL_THICKNESS,
  CEILING_Y,
  SUPER_ALMOND_WATER_RESPAWN_MIN,
  SUPER_ALMOND_WATER_RESPAWN_VARIANCE,
  SUPER_ALMOND_WATER_INITIAL_SPAWN_CHANCE,
  SUPER_ALMOND_WATER_RESPAWN_CHANCE,
} from "../constants.js";
import { createGameMaterial, applyFixtureLightFieldIfNeeded, isLowQuality } from "../common/materials.js";
import { addInstancedBoxes, createStableLightState } from "../common/lighting.js";
import { attachFirstPersonViewModel, getViewModelName, updateFirstPersonHazmatViewModel } from "../common/view-model.js";
import {
  createLevelZeroWallpaperTexture,
  createLevelZeroWallpaperDetailMaps,
  createLevelZeroCarpetTexture,
  createLevelZeroCarpetDetailMaps,
  createLevelZeroCeilingTexture,
} from "./textures.js";
import { createManilaRoom } from "./manila-room.js";
import {
  createLights,
  addExitSign,
  addExitHole,
  addMoodZones,
  addRoomTables,
  BRIGHT_ZONES,
  DARK_ZONES,
  collectWallTransforms,
  createFloorGeometryWithHole,
} from "./world.js";
import {
  cellCenter,
  isOpenCell,
  worldToCell,
  START_CELL,
  EXIT_CELL,
  EXIT_HOLE_RADIUS,
  EXIT_FALL_TRIGGER_Y,
  COLS,
  ROWS,
  MAP_CENTER,
  MANILA_ROOM,
} from "./layout.js";
import { createAlmondWaterPickup, createFlashlightPickup, createCompassPickup } from "../items/index.js";
import {
  createInteractionSpot,
  getFocusedInteraction,
  getPickupTarget,
  tryInteractWithSpots,
  tryPickupItems,
  getFocusedItem,
} from "../entities/index.js";

function collectReachableLightCells(fixture) {
  const origin = worldToCell(fixture.x, fixture.z);
  const maxSteps = Math.max(1, Math.ceil((fixture.range / CELL_SIZE) * 1.15));
  const maxDistance = fixture.range * 1.18 + CELL_SIZE * 0.5;
  const queue = [{ col: origin.col, row: origin.row, steps: 0 }];
  const visited = new Set();
  const cells = [];

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const cell = queue[cursor];
    const key = `${cell.col}:${cell.row}`;
    if (visited.has(key) || !isOpenCell(cell.col, cell.row)) continue;
    visited.add(key);

    const center = cellCenter(cell.col, cell.row);
    if (Math.hypot(center.x - fixture.x, center.z - fixture.z) > maxDistance) continue;
    cells.push(cell);
    if (cell.steps >= maxSteps) continue;

    queue.push(
      { col: cell.col - 1, row: cell.row, steps: cell.steps + 1 },
      { col: cell.col + 1, row: cell.row, steps: cell.steps + 1 },
      { col: cell.col, row: cell.row - 1, steps: cell.steps + 1 },
      { col: cell.col, row: cell.row + 1, steps: cell.steps + 1 },
    );
  }
  return cells;
}

function createFixtureLightField(fixturePositions) {
  const size = 512;
  const width = COLS * CELL_SIZE;
  const height = ROWS * CELL_SIZE;
  const minX = MAP_CENTER.x - width / 2;
  const minZ = MAP_CENTER.z - height / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.fillStyle = "#000000";
  context.fillRect(0, 0, size, size);
  context.globalCompositeOperation = "lighter";

  fixturePositions.forEach((fixture) => {
    const x = ((fixture.x - minX) / width) * size;
    const z = ((fixture.z - minZ) / height) * size;
    const radius = Math.max(16, (fixture.range / width) * size * 1.22);
    const strength = THREE.MathUtils.clamp(fixture.baseIntensity / 1.78, 0.34, 1);
    const gradient = context.createRadialGradient(x, z, 0, x, z, radius);
    gradient.addColorStop(0, `rgba(255, 246, 207, ${0.28 * strength})`);
    gradient.addColorStop(0.25, `rgba(252, 236, 180, ${0.225 * strength})`);
    gradient.addColorStop(0.55, `rgba(240, 210, 130, ${0.13 * strength})`);
    gradient.addColorStop(0.85, `rgba(187, 151, 77, ${0.05 * strength})`);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    context.save();
    context.beginPath();
    const cellWidth = (CELL_SIZE / width) * size;
    const cellHeight = (CELL_SIZE / height) * size;
    collectReachableLightCells(fixture).forEach((cell) => {
      context.rect(
        cell.col * cellWidth - 0.75,
        cell.row * cellHeight - 0.75,
        cellWidth + 1.5,
        cellHeight + 1.5,
      );
    });
    context.clip();
    context.fillStyle = gradient;
    context.fillRect(x - radius, z - radius, radius * 2, radius * 2);
    context.restore();

    // Indirect bounce wash: a wider, dimmer, warmer halo with no cell clip, so
    // light appears to spill off the carpet/wallpaper onto neighbouring
    // surfaces and softens the transition into unlit distance.
    const bounceRadius = radius * 1.7;
    const bounce = context.createRadialGradient(x, z, 0, x, z, bounceRadius);
    bounce.addColorStop(0, `rgba(255, 214, 150, ${0.075 * strength})`);
    bounce.addColorStop(0.5, `rgba(214, 168, 96, ${0.04 * strength})`);
    bounce.addColorStop(1, "rgba(140, 96, 40, 0)");
    context.fillStyle = bounce;
    context.fillRect(x - bounceRadius, z - bounceRadius, bounceRadius * 2, bounceRadius * 2);
  });

  context.globalCompositeOperation = "source-over";
  context.fillStyle = "rgba(0, 0, 0, 0.06)";
  DARK_ZONES.forEach((zone) => {
    context.fillRect(
      (zone.col / COLS) * size,
      (zone.row / ROWS) * size,
      (zone.width / COLS) * size,
      (zone.height / ROWS) * size,
    );
  });
  context.fillStyle = "rgba(255, 238, 176, 0.02)";
  BRIGHT_ZONES.forEach((zone) => {
    context.fillRect(
      (zone.col / COLS) * size,
      (zone.row / ROWS) * size,
      (zone.width / COLS) * size,
      (zone.height / ROWS) * size,
    );
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return { texture, minX, minZ, width, height };
}

function applyFixtureLightField(material, lightField, intensity) {
  material.levelZeroLightFieldTexture = lightField.texture;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.levelZeroLightField = { value: lightField.texture };
    shader.uniforms.levelZeroLightBounds = {
      value: new THREE.Vector4(lightField.minX, lightField.minZ, lightField.width, lightField.height),
    };
    shader.uniforms.levelZeroLightIntensity = { value: intensity };
    shader.uniforms.levelZeroCeilingY = { value: CEILING_Y };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 levelZeroWorldPosition;",
      )
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec4 levelZeroPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          levelZeroPosition = instanceMatrix * levelZeroPosition;
        #endif
        levelZeroWorldPosition = (modelMatrix * levelZeroPosition).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 levelZeroWorldPosition;
        uniform sampler2D levelZeroLightField;
        uniform vec4 levelZeroLightBounds;
        uniform float levelZeroLightIntensity;
        uniform float levelZeroCeilingY;`,
      )
      .replace(
        "#include <opaque_fragment>",
        `vec2 levelZeroLightUv = vec2(
          (levelZeroWorldPosition.x - levelZeroLightBounds.x) / levelZeroLightBounds.z,
          1.0 - (levelZeroWorldPosition.z - levelZeroLightBounds.y) / levelZeroLightBounds.w
        );
        vec3 levelZeroBakedLight = texture2D(levelZeroLightField, levelZeroLightUv).rgb;
        float levelZeroBounceBoost = 1.0 + max(0.0, 1.0 - levelZeroWorldPosition.y / levelZeroCeilingY) * 0.12;
        outgoingLight += levelZeroBakedLight * diffuseColor.rgb * levelZeroLightIntensity * levelZeroBounceBoost;
        #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => `level-zero-light-field-${intensity}`;
}

export function createLevelZeroScene({ initialState = null } = {}) {
  const scene = new THREE.Scene();
  // The background MUST match the fog colour, otherwise corridor ends, the
  // far-clip plane and plane edges render as black voids instead of dissolving
  // into the warm Backrooms haze.
  const HAZE_COLOR = 0x6c603b;
  scene.background = new THREE.Color(HAZE_COLOR);
  scene.fog = new THREE.FogExp2(HAZE_COLOR, 0.0082);
  // Keep the distant maze readable between fluorescent fixtures. This is a
  // single, shadowless fill light, so it fixes the black-wall problem without
  // adding the cost of more dynamic lights or shadow maps.
  scene.add(new THREE.HemisphereLight(0xffe8ad, 0x6a552d, 0.92));

  const cameraFar = Math.hypot(COLS * CELL_SIZE, ROWS * CELL_SIZE) + CELL_SIZE * 2;
  const camera = new THREE.PerspectiveCamera(72, 1, 0.05, cameraFar);
  const viewModel = attachFirstPersonViewModel(camera);
  scene.add(camera);
  const spawnCell = cellCenter(START_CELL.col, START_CELL.row);
  const spawn = { x: spawnCell.x, z: spawnCell.z, yaw: START_CELL.yaw };
  const exitPosition = cellCenter(EXIT_CELL.col, EXIT_CELL.row);

  const pickupInitial = initialState?.pickups ?? {};
  const interactionInitial = initialState?.interactions ?? {};
  const objectiveInitial = initialState?.objectives ?? {};
  const { northSouth, eastWest, fixturePositions } = collectWallTransforms();
  const fixtureLightField = isLowQuality() ? null : createFixtureLightField(fixturePositions);

  const carpetTexture = createLevelZeroCarpetTexture();
  const wallpaperTexture = createLevelZeroWallpaperTexture();
  const ceilingTexture = createLevelZeroCeilingTexture();

  const floorMaterial = createGameMaterial(({ lowQuality }) => ({
    map: carpetTexture,
    color: 0xf6e9c6,
    emissive: 0x8a7449,
    emissiveIntensity: 0,
    roughness: 0.98,
    ...(lowQuality ? {} : { ...createLevelZeroCarpetDetailMaps(), bumpScale: 0.08 }),
  }));
  const wallMaterial = createGameMaterial({
    map: wallpaperTexture,
    color: 0xfffce3,
    emissive: 0x655b34,
    emissiveIntensity: 0.045,
    roughness: 0.92,
    ...(isLowQuality() ? {} : { ...createLevelZeroWallpaperDetailMaps(), bumpScale: 0.02 }),
    metalness: 0,
  });
  const ceilingMaterial = createGameMaterial({
    map: ceilingTexture,
    color: 0xfff7df,
    emissive: 0xc0b07a,
    emissiveIntensity: 0,
    roughness: 0.86,
  });
  const wallCapMaterial = createGameMaterial({
    color: 0xc7b778,
    emissive: 0x584c24,
    emissiveIntensity: 0,
    roughness: 0.98,
    metalness: 0,
  });
  applyFixtureLightFieldIfNeeded(floorMaterial, applyFixtureLightField, fixtureLightField, 1.28);
  applyFixtureLightFieldIfNeeded(wallMaterial, applyFixtureLightField, fixtureLightField, 0.94);
  applyFixtureLightFieldIfNeeded(ceilingMaterial, applyFixtureLightField, fixtureLightField, 0.8);
  applyFixtureLightFieldIfNeeded(wallCapMaterial, applyFixtureLightField, fixtureLightField, 0.78);
  const wallMaterials = [
    wallMaterial,
    wallMaterial,
    wallCapMaterial,
    wallCapMaterial,
    wallMaterial,
    wallMaterial,
  ];

  const floor = new THREE.Mesh(
    createFloorGeometryWithHole(
      COLS * CELL_SIZE,
      ROWS * CELL_SIZE,
      {
        x: exitPosition.x - MAP_CENTER.x,
        z: exitPosition.z - MAP_CENTER.z,
      },
      EXIT_HOLE_RADIUS,
    ),
    floorMaterial,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(MAP_CENTER.x, 0, MAP_CENTER.z);
  scene.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(COLS * CELL_SIZE, ROWS * CELL_SIZE),
    ceilingMaterial,
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(MAP_CENTER.x, CEILING_Y, MAP_CENTER.z);
  scene.add(ceiling);

  // Slight 2.8cm edge chamfer: wall/floor and wall/ceiling junctions and
  // pilaster corners catch light instead of reading as sharp CG right angles.
  const WALL_EDGE_RADIUS = 0.028;

  addInstancedBoxes(
    scene,
    new RoundedBoxGeometry(CELL_SIZE, WALL_HEIGHT, WALL_THICKNESS, 2, WALL_EDGE_RADIUS),
    wallMaterials,
    northSouth,
  );
  addInstancedBoxes(
    scene,
    new RoundedBoxGeometry(WALL_THICKNESS, WALL_HEIGHT, CELL_SIZE, 2, WALL_EDGE_RADIUS),
    wallMaterials,
    eastWest,
  );
  const { fixtures, updateFixtureVisuals, updatePointLights } = createLights(scene, fixturePositions);
  const updateLightState = createStableLightState("HUM", {
    dimBelow: 0.5,
    normalAbove: 0.66,
  });
  addExitHole(scene, exitPosition, EXIT_HOLE_RADIUS);
  addExitSign(scene, exitPosition);
  addMoodZones(scene);
  const manilaRoom = createManilaRoom(scene, MANILA_ROOM, cellCenter);
  const propColliders = [...manilaRoom.colliders, ...addRoomTables(scene, cellCenter)];
  const interactions = [
    createInteractionSpot({
      id: "level-zero-meg-file",
      position: manilaRoom.documentationPosition,
      radius: 2.8,
      inspectDistance: 7,
      inspectHeight: 0,
      inspectRadius: 0.62,
      initialState: interactionInitial["level-zero-meg-file"] ?? null,
      onInteract: () => ({ documentId: "level-zero-meg-file" }),
    }),
  ];
  const almondWater = createAlmondWaterPickup(scene, {
    cols: COLS,
    rows: ROWS,
    isCellOpen: isOpenCell,
    getCellCenter: cellCenter,
    avoidPositions: [spawnCell, exitPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial["almond-water"] ?? null,
  });
  const superAlmondWater = createAlmondWaterPickup(scene, {
    cols: COLS,
    rows: ROWS,
    isCellOpen: isOpenCell,
    getCellCenter: cellCenter,
    avoidPositions: [spawnCell, exitPosition],
    blockedAabbs: propColliders,
    variant: "super",
    respawnMin: SUPER_ALMOND_WATER_RESPAWN_MIN,
    respawnVariance: SUPER_ALMOND_WATER_RESPAWN_VARIANCE,
    initialSpawnChance: SUPER_ALMOND_WATER_INITIAL_SPAWN_CHANCE,
    respawnChance: SUPER_ALMOND_WATER_RESPAWN_CHANCE,
    initialState: pickupInitial["super-almond-water"] ?? null,
  });
  const flashlight = createFlashlightPickup(scene, {
    cols: COLS,
    rows: ROWS,
    isCellOpen: isOpenCell,
    getCellCenter: cellCenter,
    avoidPositions: [spawnCell, exitPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial.flashlight ?? null,
  });
  const compass = createCompassPickup(scene, {
    cols: COLS,
    rows: ROWS,
    isCellOpen: isOpenCell,
    getCellCenter: cellCenter,
    avoidPositions: [spawnCell, exitPosition],
    blockedAabbs: propColliders,
    initialState: pickupInitial.compass ?? null,
  });
  let exitReached = Boolean(objectiveInitial.reached);

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

    const insideLevelGeometry = samples.every(([offsetX, offsetZ]) => {
      const cell = worldToCell(x + offsetX, z + offsetZ);
      return isOpenCell(cell.col, cell.row);
    });
    return insideLevelGeometry && !propColliders.some((collider) =>
      colliderBlocksAtFeetHeight(collider, feetY) &&
      x + radius > collider.minX &&
      x - radius < collider.maxX &&
      z + radius > collider.minZ &&
      z - radius < collider.maxZ,
    );
  }

  function getFloorHeight(x, z, feetY) {
    const exitDistance = Math.hypot(x - exitPosition.x, z - exitPosition.z);
    if (exitDistance < EXIT_HOLE_RADIUS - 0.12) return null;
    return getPlatformFloorHeight({ colliders: propColliders, x, z, feetY });
  }

  function resolvePosition(x, z, radius, feetY, maxCorrection) {
    return resolvePlatformOverlap({ colliders: propColliders, x, z, radius, feetY, maxCorrection });
  }

  // Smoothed by the rendering pipeline into a subtle exposure breathing
  // (presentation.post.exposureDrift controls the amplitude).
  let exposureBias = 0;

  function update(delta, elapsed, playerPosition) {
    let lightTotal = 0;
    fixtures.forEach((fixture) => {
      const hum = 0.92 + Math.sin(elapsed * 1.45 + fixture.phase) * 0.035;
      const twitch = Math.sin(elapsed * fixture.speed + fixture.phase * 2.4) > 0.965 ? 0.72 : 1;
      const pulse = Math.max(0.58, hum * twitch - fixture.weak);
      fixture.pulse = pulse;
      lightTotal += pulse;
    });
    updateFixtureVisuals();
    updatePointLights(delta, playerPosition);
    const flicker = fixtures.length > 0 ? lightTotal / fixtures.length : 0.9;
    exposureBias = THREE.MathUtils.clamp((flicker - 0.9) * 6, -1, 1);
    const manilaBlackout = manilaRoom.update(elapsed);

    const exitDistance = Math.hypot(
      playerPosition.x - exitPosition.x,
      playerPosition.z - exitPosition.z,
    );
    const fallingIntoExit =
      exitDistance < EXIT_HOLE_RADIUS - 0.06 &&
      playerPosition.y < EXIT_FALL_TRIGGER_Y;
    if (fallingIntoExit) {
      exitReached = true;
    }
    scene.fog.density = 0.0095 + (1 - flicker) * 0.004;
    updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition);
    const almondWaterState = almondWater.update(delta, elapsed, playerPosition);
    const superAlmondWaterState = superAlmondWater.update(delta, elapsed, playerPosition);
    const flashlightState = flashlight.update(delta, elapsed, playerPosition);
    const compassState = compass.update(delta, elapsed, playerPosition);
    const pickups = [almondWaterState, superAlmondWaterState, compassState, flashlightState];

    return {
      exitDistance: Math.round(exitDistance),
      exitReached,
      fallingIntoExit,
      flicker,
      manilaBlackout,
      lightState: updateLightState(delta, flicker),
      focusInteraction: getFocusedInteraction(camera, playerPosition, interactions),
      focusItem: getFocusedItem(
        almondWater.inspect(camera),
        superAlmondWater.inspect(camera),
        compass.inspect(camera),
        flashlight.inspect(camera),
      ),
      almondWater: almondWaterState,
      superAlmondWater: superAlmondWaterState,
      flashlight: flashlightState,
      compass: compassState,
      pickups,
    };
  }

  return {
    level: 0,
    levelLabel: "LEVEL 0",
    levelName: "NOCLIP ZONE",
    get viewModelName() {
      return getViewModelName(viewModel);
    },
    get exposureBias() {
      return exposureBias;
    },
    nextLevel: 1,
    exitMode: "fall",
    // Nudges GTAO contact darkening at wall/floor and wall/ceiling junctions
    // a touch past this level's presentation preset of 0.55 (presentation.js).
    presentation: { post: { aoIntensity: 0.66 } },
    scene,
    camera,
    disposableTextures: fixtureLightField?.texture ? [fixtureLightField.texture] : [],
    spawn,
    targetPosition: exitPosition,
    isWalkable,
    getFloorHeight,
    resolvePosition,
    decorativeItemSpawns: [
      { id: "rusted-key", position: { ...cellCenter(3, 18), y: 0.08 }, rotation: 0.6, tiltZ: 0.05 },
      { id: "crumpled-note", position: { ...cellCenter(10, 21), y: 0.07 }, rotation: -0.35, tiltX: 0.04 },
    ],
    update,
    getPickupTarget: (playerPosition) =>
      getPickupTarget(playerPosition, superAlmondWater, compass, flashlight, almondWater),
    tryPickup: (playerPosition) => tryPickupItems(playerPosition, superAlmondWater, compass, flashlight, almondWater),
    interact: (playerPosition) => tryInteractWithSpots(playerPosition, ...interactions),
    getSnapshot() {
      return {
        pickups: {
          flashlight: flashlight.getState(),
          detector: null,
          compass: compass.getState(),
          "almond-water": almondWater.getState(),
          "super-almond-water": superAlmondWater.getState(),
        },
        interactions: Object.fromEntries(interactions.map((interaction) => [interaction.id, interaction.getState()])),
        objectives: { reached: exitReached },
        entities: [],
      };
    },
  };
}
