import * as THREE from "three";
import { createGameMaterial, isLowQuality } from "../common/materials.js";
import { createStableLightState } from "../common/lighting.js";
import { createGridWalkability, createStandardPickupSet } from "../common/grid-world.js";
import { attachFirstPersonViewModel, getViewModelName, updateFirstPersonHazmatViewModel } from "../common/view-model.js";
import { createExitNetwork } from "../common/exit-network.js";
import { enableAoUv } from "../common/texture-utils.js";
import { CELL_SIZE } from "../constants.js";
import {
  LEVEL_TEN_COLS,
  LEVEL_TEN_ROWS,
  LEVEL_TEN_START_CELL,
  LEVEL_TEN_TARGET_CELL,
  isLevelTenOpenCell,
  levelTenCellCenter,
  levelTenWorldToCell,
} from "./layout.js";
import { createLevelTenGroundMaps } from "./textures.js";
import { addLevelTenDetails } from "./props.js";

export function createLevelTenScene({ initialState = null } = {}) {
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(0x889087);
  scene.background = fogColor;
  scene.fog = new THREE.FogExp2(fogColor, 0.0042);
  const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 310);
  const viewModel = attachFirstPersonViewModel(camera);
  scene.add(camera);
  const spawnCell = levelTenCellCenter(LEVEL_TEN_START_CELL.col, LEVEL_TEN_START_CELL.row);
  const targetPosition = levelTenCellCenter(LEVEL_TEN_TARGET_CELL.col, LEVEL_TEN_TARGET_CELL.row);
  const spawn = { ...spawnCell, yaw: LEVEL_TEN_START_CELL.yaw };
  const coarse = window.matchMedia?.("(pointer: coarse), (max-width: 800px)").matches;
  const lowQuality = isLowQuality();

  const groundMaterial = createGameMaterial({
    ...createLevelTenGroundMaps(26, 20, { detail: !lowQuality }),
    color: 0xb2a46f,
    roughness: 0.96,
    normalScale: new THREE.Vector2(0.42, 0.42),
    aoMapIntensity: 0.58,
  });
  const floor = new THREE.Mesh(enableAoUv(new THREE.PlaneGeometry(LEVEL_TEN_COLS * CELL_SIZE, LEVEL_TEN_ROWS * CELL_SIZE)), groundMaterial);
  floor.name = "level-ten-field-ground";
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const roadMaterial = createGameMaterial({ ...createLevelTenGroundMaps(2.4, 22, { detail: !lowQuality }), color: 0x806d4d, roughness: 1 });
  const road = new THREE.Mesh(enableAoUv(new THREE.PlaneGeometry(CELL_SIZE * 3, CELL_SIZE * (LEVEL_TEN_ROWS - 2))), roadMaterial);
  road.name = "level-ten-dirt-road";
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.018;
  scene.add(road);

  scene.add(new THREE.HemisphereLight(0xdde0cf, 0x363823, 1.12));
  const daylight = new THREE.DirectionalLight(0xe6e5d2, 1.05);
  daylight.position.set(-52, 66, 24);
  scene.add(daylight);
  const details = addLevelTenDetails(scene, { coarse });
  const isWalkable = createGridWalkability({ worldToCell: levelTenWorldToCell, isOpen: isLevelTenOpenCell, colliders: details.colliders });
  const routes = [{
    id: "level-ten-road-to-eleven",
    targetLevel: 11,
    targetLabel: "LEVEL 11",
    label: "CITY ROAD",
    kind: "threshold",
    position: targetPosition,
    enterRadius: 5.4,
  }];
  const exitNetwork = createExitNetwork(scene, camera, routes, initialState?.interactions ?? {});
  const pickupInitial = { ...(initialState?.pickups ?? {}) };
  if (!pickupInitial["almond-water"]) {
    pickupInitial["almond-water"] = {
      active: true,
      respawnTimer: 0,
      position: details.barnPickupPosition,
      rotation: 0.22,
    };
  }
  const pickupSet = createStandardPickupSet(scene, {
    cols: LEVEL_TEN_COLS,
    rows: LEVEL_TEN_ROWS,
    isCellOpen: isLevelTenOpenCell,
    getCellCenter: levelTenCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: details.colliders,
    initialState: pickupInitial,
  });
  const updateLightState = createStableLightState("OVERCAST", { dimBelow: 0.52, normalAbove: 0.72, dimDelay: 1, normalDelay: 1.4 });
  let objectiveReached = Boolean(initialState?.objectives?.reached);

  function update(delta, elapsed, playerPosition) {
    const raining = Math.sin(elapsed * 0.055 - 1.2) > 0.86;
    details.update(delta, elapsed, raining);
    scene.fog.density += ((raining ? 0.007 : 0.0042) - scene.fog.density) * Math.min(1, delta * 0.45);
    daylight.intensity += ((raining ? 0.72 : 1.05) - daylight.intensity) * Math.min(1, delta * 0.7);
    const entered = exitNetwork.update(delta, playerPosition);
    if (entered) objectiveReached = true;
    const pickupStates = pickupSet.update(delta, elapsed, playerPosition);
    updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition);
    const exitDistance = Math.hypot(playerPosition.x - targetPosition.x, playerPosition.z - targetPosition.z);
    const flicker = raining ? 0.68 : 0.86;
    return {
      exitDistance: Math.round(exitDistance),
      exitReached: Boolean(entered),
      nextLevel: entered?.targetLevel,
      entityContact: false,
      flicker,
      pickups: Object.values(pickupStates),
      entities: [],
      focusEntity: null,
      focusInteraction: null,
      focusItem: pickupSet.inspect(camera),
      lightState: updateLightState(delta, flicker),
      statusText: exitDistance < 18 ? "THE CITY ROAD" : raining ? "LIGHT RAIN" : "FIELD OF WHEAT",
    };
  }

  return {
    level: 10,
    levelLabel: "LEVEL 10",
    levelName: "FIELD OF WHEAT",
    scene,
    camera,
    spawn,
    targetPosition,
    nextLevel: null,
    exitMode: "network",
    isWalkable,
    colliderCount: details.colliders.length,
    flashlightEffectiveness: 0.72,
    get viewModelName() { return getViewModelName(viewModel); },
    decorativeItemSpawns: [
      { id: "crumpled-note", position: { ...levelTenCellCenter(16, 22), y: 0.08 }, rotation: -0.32 },
      { id: "rusted-key", position: { ...levelTenCellCenter(13, 24), y: 0.13 }, rotation: 0.4 },
    ],
    update,
    getPickupTarget: (playerPosition) => pickupSet.getPickupTarget(playerPosition),
    tryPickup: (playerPosition) => pickupSet.tryPickup(playerPosition),
    interact: (playerPosition, access) => exitNetwork.interact(playerPosition, access),
    getSnapshot: () => ({
      pickups: pickupSet.getState(),
      interactions: exitNetwork.getState(),
      objectives: { reached: objectiveReached },
      entities: [],
    }),
  };
}
