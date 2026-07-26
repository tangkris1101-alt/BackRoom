import * as THREE from "three";
import { CELL_SIZE } from "../constants.js";
import { createStableLightState } from "../common/lighting.js";
import {
  createGridWalkability,
  createStandardPickupSet,
} from "../common/grid-world.js";
import { attachFirstPersonViewModel, getViewModelName, updateFirstPersonHazmatViewModel } from "../common/view-model.js";
import { createExitNetwork } from "../common/exit-network.js";
import { createHoundEntity, createSmilerEntity, getFocusedEntity } from "../entities/index.js";
import { snapEntityStates } from "../common/snap.js";
import {
  LEVEL_NINE_COLS,
  LEVEL_NINE_ROWS,
  LEVEL_NINE_START_CELL,
  LEVEL_NINE_TARGET_CELL,
  isLevelNineOpenCell,
  isLevelNineRoadCell,
  levelNineCellCenter,
  levelNineWorldToCell,
} from "./layout.js";
import { createLevelNineGrassTexture, createLevelNineRoadTexture } from "./textures.js";
import { addLevelNineDetails } from "./props.js";
import { enableAoUv } from "../common/texture-utils.js";

export function createLevelNineScene({ initialState = null } = {}) {
  const scene = new THREE.Scene();
  const FOG_COLOR = 0x101720;
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0125);
  const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 285);
  const viewModel = attachFirstPersonViewModel(camera);
  scene.add(camera);
  const spawnCell = levelNineCellCenter(LEVEL_NINE_START_CELL.col, LEVEL_NINE_START_CELL.row);
  const targetPosition = levelNineCellCenter(LEVEL_NINE_TARGET_CELL.col, LEVEL_NINE_TARGET_CELL.row);
  const spawn = { ...spawnCell, yaw: LEVEL_NINE_START_CELL.yaw };
  const coarse = window.matchMedia?.("(pointer: coarse), (max-width: 800px)").matches;

  const grassMaterial = new THREE.MeshStandardMaterial({
    map: createLevelNineGrassTexture(), color: 0x496b51, emissive: 0x08120c, emissiveIntensity: 0.34, roughness: 0.95,
  });
  const roadMaterial = new THREE.MeshStandardMaterial({
    map: createLevelNineRoadTexture(), color: 0x74808d, emissive: 0x0b111a, emissiveIntensity: 0.42, roughness: 0.36, metalness: 0.08,
  });
  const floor = new THREE.Mesh(enableAoUv(new THREE.PlaneGeometry(LEVEL_NINE_COLS * CELL_SIZE, LEVEL_NINE_ROWS * CELL_SIZE)), grassMaterial);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const roadGeometry = new THREE.PlaneGeometry(CELL_SIZE + 0.025, CELL_SIZE + 0.025);
  const roadCells = [];
  for (let row = 0; row < LEVEL_NINE_ROWS; row += 1) {
    for (let col = 0; col < LEVEL_NINE_COLS; col += 1) {
      if (!isLevelNineRoadCell(col, row)) continue;
      const center = levelNineCellCenter(col, row);
      roadCells.push(center);
    }
  }
  const roads = new THREE.InstancedMesh(roadGeometry, roadMaterial, roadCells.length);
  const roadTransform = new THREE.Object3D();
  roadTransform.rotation.x = -Math.PI / 2;
  roadCells.forEach((center, index) => {
    roadTransform.position.set(center.x, 0.012, center.z);
    roadTransform.updateMatrix();
    roads.setMatrixAt(index, roadTransform.matrix);
  });
  roads.instanceMatrix.needsUpdate = true;
  roads.name = "level-nine-asphalt-roads";
  scene.add(roads);
  scene.add(new THREE.HemisphereLight(0x5e7695, 0x020407, 0.74));
  const moonlight = new THREE.DirectionalLight(0x7795c4, 0.18);
  moonlight.position.set(-42, 32, -28);
  scene.add(moonlight);
  const cameraMistLight = new THREE.PointLight(0x9ab4d4, 0.28, 7.2, 2.15);
  cameraMistLight.position.set(0, 0.12, -0.42);
  camera.add(cameraMistLight);

  const details = addLevelNineDetails(scene, levelNineCellCenter, { coarse });
  const isWalkable = createGridWalkability({
    worldToCell: levelNineWorldToCell,
    isOpen: isLevelNineOpenCell,
    colliders: details.colliders,
  });
  const routes = [
    {
      id: "level-nine-arrow-route",
      targetLevel: null,
      targetLabel: "LEVEL 11",
      label: "ARROW ROUTE",
      kind: "door",
      position: targetPosition,
      rotation: 0,
    },
  ];
  const exitNetwork = createExitNetwork(scene, camera, routes, initialState?.interactions ?? {});
  const pickupSet = createStandardPickupSet(scene, {
    cols: LEVEL_NINE_COLS,
    rows: LEVEL_NINE_ROWS,
    isCellOpen: isLevelNineOpenCell,
    getCellCenter: levelNineCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: details.colliders,
    initialState: initialState?.pickups ?? {},
    includeFiresalt: true,
    firesaltSpawnChance: 0.72,
  });
  const savedEntities = snapEntityStates(initialState?.entities ?? [], isWalkable);
  const hound = createHoundEntity(scene, {
    id: "hound-level-nine",
    spawnPosition: levelNineCellCenter(32, 20),
    isWalkable,
    speed: 1.83,
    dormant: true,
    dormantArmRadius: 18,
    initialState: savedEntities.find((entity) => entity.id === "hound-level-nine") ?? null,
    cols: LEVEL_NINE_COLS,
    rows: LEVEL_NINE_ROWS,
    isCellOpen: isLevelNineOpenCell,
    worldToCell: levelNineWorldToCell,
    cellCenter: levelNineCellCenter,
  });
  const smilers = coarse ? [] : [createSmilerEntity(scene, {
    id: "smiler-level-nine",
    spawnPosition: levelNineCellCenter(41, 12),
    isWalkable,
    camera,
    initialState: savedEntities.find((entity) => entity.id === "smiler-level-nine") ?? null,
    cols: LEVEL_NINE_COLS,
    rows: LEVEL_NINE_ROWS,
    isCellOpen: isLevelNineOpenCell,
    worldToCell: levelNineWorldToCell,
    cellCenter: levelNineCellCenter,
  })];
  const updateLightState = createStableLightState("FOG", { dimBelow: 0.28, normalAbove: 0.5, dimDelay: 0.5, normalDelay: 0.9 });
  let objectiveReached = false;

  function update(delta, elapsed, playerPosition, effects = {}) {
    const fogSurge = Math.sin(elapsed * 0.19 + 1.8) > 0.68;
    details.update(elapsed, fogSurge);
    const entered = exitNetwork.update(delta, playerPosition);
    if (entered) objectiveReached = true;
    const pickupStates = pickupSet.update(delta, elapsed, playerPosition);
    const houndState = hound.update(delta, elapsed, playerPosition, effects);
    const smilerStates = smilers.map((smiler) => smiler.update(delta, elapsed, playerPosition, effects));
    const entities = [houndState, ...smilerStates];
    const exitDistance = Math.hypot(playerPosition.x - targetPosition.x, playerPosition.z - targetPosition.z);
    const flicker = fogSurge ? 0.3 : 0.64 + Math.sin(elapsed * 0.55) * 0.08;
    scene.fog.density = fogSurge ? 0.021 : 0.012 + Math.sin(elapsed * 0.22) * 0.0008;
    cameraMistLight.intensity = fogSurge ? 0.18 : 0.3;
    updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition);

    return {
      exitDistance: Math.round(exitDistance),
      exitReached: Boolean(entered),
      nextLevel: entered?.targetLevel,
      entityContact: entities.some((entity) => entity.contact),
      flicker,
      pickups: Object.values(pickupStates),
      entities,
      focusEntity: getFocusedEntity(camera, entities),
      focusInteraction: exitNetwork.inspect(playerPosition),
      focusItem: pickupSet.inspect(camera),
      lightState: updateLightState(delta, flicker),
      statusText: objectiveReached
        ? "LEVEL 11 ROUTE"
        : exitDistance < 14
          ? "FOLLOW THE ARROWS"
          : fogSurge
            ? "FOG ROLLING IN"
            : "THE SUBURBS",
    };
  }

  return {
    level: 9,
    levelLabel: "LEVEL 9",
    levelName: "THE SUBURBS",
    get viewModelName() { return getViewModelName(viewModel); },
    nextLevel: null,
    exitMode: "network",
    scene,
    camera,
    spawn,
    targetPosition,
    isWalkable,
    flashlightEffectiveness: 1.12,
    decorativeItemSpawns: [
      { id: "empty-can", position: { ...levelNineCellCenter(14, 33), y: 0.15 }, rotation: 0.42, tiltX: 0.08 },
      { id: "crumpled-note", position: { ...levelNineCellCenter(34, 20), y: 0.07 }, rotation: -0.22, tiltZ: 0.04 },
    ],
    update,
    getPickupTarget: (playerPosition) => pickupSet.getPickupTarget(playerPosition),
    tryPickup: (playerPosition) => pickupSet.tryPickup(playerPosition),
    interact: (playerPosition, access) => exitNetwork.interact(playerPosition, access),
    getSnapshot: () => ({
      pickups: pickupSet.getState(),
      interactions: exitNetwork.getState(),
      objectives: { reached: objectiveReached },
      entities: [hound.getState(), ...smilers.map((smiler) => smiler.getState())],
    }),
  };
}
