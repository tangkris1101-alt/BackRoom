import * as THREE from "three";
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
import { addInstancedBoxes, updateFixturePointLight, createStableLightState } from "../common/lighting.js";
import { attachFirstPersonViewModel, getViewModelName, updateFirstPersonHazmatViewModel } from "../common/view-model.js";
import {
  createLevelZeroWallpaperTexture,
  createLevelZeroCarpetTexture,
  createLevelZeroCeilingTexture,
} from "./textures.js";
import { createLights, addExitSign, addMoodZones, collectWallTransforms } from "./world.js";
import {
  cellCenter,
  isOpenCell,
  worldToCell,
  START_CELL,
  EXIT_CELL,
  EXIT_TRIGGER_RADIUS,
  COLS,
  ROWS,
} from "./layout.js";
import { createAlmondWaterPickup, createFlashlightPickup } from "../items/index.js";
import { tryPickupItems, getFocusedItem } from "../entities/index.js";

export function createLevelZeroScene() {
  const scene = new THREE.Scene();
  // The background MUST match the fog colour, otherwise corridor ends, the
  // far-clip plane and plane edges render as black voids instead of dissolving
  // into the warm Backrooms haze.
  const HAZE_COLOR = 0xd8d0a0;
  scene.background = new THREE.Color(HAZE_COLOR);
  scene.fog = new THREE.FogExp2(HAZE_COLOR, 0.0095);

  const cameraFar = Math.hypot(COLS * CELL_SIZE, ROWS * CELL_SIZE) + CELL_SIZE * 2;
  const camera = new THREE.PerspectiveCamera(72, 1, 0.05, cameraFar);
  const viewModel = attachFirstPersonViewModel(camera);
  scene.add(camera);
  const spawnCell = cellCenter(START_CELL.col, START_CELL.row);
  const spawn = { x: spawnCell.x, z: spawnCell.z, yaw: START_CELL.yaw };
  const exitPosition = cellCenter(EXIT_CELL.col, EXIT_CELL.row);

  const carpetTexture = createLevelZeroCarpetTexture();
  const wallpaperTexture = createLevelZeroWallpaperTexture();
  const ceilingTexture = createLevelZeroCeilingTexture();

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: carpetTexture,
    color: 0xf6e9c6,
    emissive: 0x8a7449,
    emissiveIntensity: 0.2,
    roughness: 0.98,
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: wallpaperTexture,
    color: 0xfffce3,
    emissive: 0x655b34,
    emissiveIntensity: 0.11,
    roughness: 0.92,
    metalness: 0,
  });
  const ceilingMaterial = new THREE.MeshStandardMaterial({
    map: ceilingTexture,
    color: 0xfff7df,
    emissive: 0xc0b07a,
    emissiveIntensity: 0.4,
    roughness: 0.86,
  });
  const wallCapMaterial = new THREE.MeshStandardMaterial({
    color: 0xc7b778,
    emissive: 0x584c24,
    emissiveIntensity: 0.1,
    roughness: 0.98,
    metalness: 0,
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
    new THREE.PlaneGeometry(COLS * CELL_SIZE, ROWS * CELL_SIZE),
    floorMaterial,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0);
  scene.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(COLS * CELL_SIZE, ROWS * CELL_SIZE),
    ceilingMaterial,
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, CEILING_Y, 0);
  scene.add(ceiling);

  const { northSouth, eastWest, fixturePositions } = collectWallTransforms();
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
  const ambientLight = new THREE.HemisphereLight(0xfff8dc, 0xb99d68, 1.44);
  scene.add(ambientLight);

  const ceilingFill = new THREE.DirectionalLight(0xfff8d8, 0.32);
  ceilingFill.position.set(-18, CEILING_Y - 0.45, 12);
  scene.add(ceilingFill);

  const fixtures = createLights(scene, fixturePositions);
  const updateLightState = createStableLightState("HUM", {
    dimBelow: 0.5,
    normalAbove: 0.66,
  });
  addExitSign(scene, exitPosition);
  addMoodZones(scene);
  const almondWater = createAlmondWaterPickup(scene, {
    cols: COLS,
    rows: ROWS,
    isCellOpen: isOpenCell,
    getCellCenter: cellCenter,
    avoidPositions: [spawnCell, exitPosition],
  });
  const superAlmondWater = createAlmondWaterPickup(scene, {
    cols: COLS,
    rows: ROWS,
    isCellOpen: isOpenCell,
    getCellCenter: cellCenter,
    avoidPositions: [spawnCell, exitPosition],
    variant: "super",
    respawnMin: SUPER_ALMOND_WATER_RESPAWN_MIN,
    respawnVariance: SUPER_ALMOND_WATER_RESPAWN_VARIANCE,
    initialSpawnChance: SUPER_ALMOND_WATER_INITIAL_SPAWN_CHANCE,
    respawnChance: SUPER_ALMOND_WATER_RESPAWN_CHANCE,
  });
  const flashlight = createFlashlightPickup(scene, {
    cols: COLS,
    rows: ROWS,
    isCellOpen: isOpenCell,
    getCellCenter: cellCenter,
    avoidPositions: [spawnCell, exitPosition],
  });
  let exitReached = false;

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

    return samples.every(([offsetX, offsetZ]) => {
      const cell = worldToCell(x + offsetX, z + offsetZ);
      return isOpenCell(cell.col, cell.row);
    });
  }

  function update(delta, elapsed, playerPosition) {
    let lightTotal = 0;
    fixtures.forEach((fixture) => {
      const hum = 0.92 + Math.sin(elapsed * 1.45 + fixture.phase) * 0.035;
      const twitch = Math.sin(elapsed * fixture.speed + fixture.phase * 2.4) > 0.965 ? 0.72 : 1;
      const pulse = Math.max(0.58, hum * twitch - fixture.weak);
      fixture.material.emissiveIntensity = pulse * fixture.baseIntensity * 1.56;
      updateFixturePointLight(fixture, pulse, 1.1);
      lightTotal += pulse;
    });
    const flicker = fixtures.length > 0 ? lightTotal / fixtures.length : 0.9;

    const exitDistance = Math.hypot(
      playerPosition.x - exitPosition.x,
      playerPosition.z - exitPosition.z,
    );
    if (exitDistance < EXIT_TRIGGER_RADIUS) {
      exitReached = true;
    }
    scene.fog.density = 0.0095 + (1 - flicker) * 0.004;
    updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition);
    const almondWaterState = almondWater.update(delta, elapsed, playerPosition);
    const superAlmondWaterState = superAlmondWater.update(delta, elapsed, playerPosition);
    const flashlightState = flashlight.update(delta, elapsed, playerPosition);

    return {
      exitDistance: Math.round(exitDistance),
      exitReached,
      flicker,
      lightState: updateLightState(delta, flicker),
      focusItem: getFocusedItem(
        almondWater.inspect(camera),
        superAlmondWater.inspect(camera),
        flashlight.inspect(camera),
      ),
      almondWater: almondWaterState,
      superAlmondWater: superAlmondWaterState,
      flashlight: flashlightState,
    };
  }

  return {
    level: 0,
    levelLabel: "LEVEL 0",
    levelName: "NOCLIP ZONE",
    viewModelName: getViewModelName(viewModel),
    nextLevel: 1,
    scene,
    camera,
    spawn,
    isWalkable,
    update,
    tryPickup: (playerPosition) => tryPickupItems(playerPosition, superAlmondWater, flashlight, almondWater),
  };
}



