import * as THREE from "three";
import { createGameMaterial, isLowQuality } from "../common/materials.js";
import { createStableLightState } from "../common/lighting.js";
import { createGridWalkability, createStandardPickupSet } from "../common/grid-world.js";
import { attachFirstPersonViewModel, getViewModelName, updateFirstPersonHazmatViewModel } from "../common/view-model.js";
import { createExitNetwork } from "../common/exit-network.js";
import { createHoundEntity, getFocusedEntity } from "../entities/index.js";
import { snapEntityStates } from "../common/snap.js";
import { enableAoUv } from "../common/texture-utils.js";
import { CELL_SIZE } from "../constants.js";
import {
  LEVEL_ELEVEN_COLS,
  LEVEL_ELEVEN_ROWS,
  LEVEL_ELEVEN_START_CELL,
  LEVEL_ELEVEN_BACKROAD_CELL,
  LEVEL_ELEVEN_POOL_EXIT_CELL,
  LEVEL_ELEVEN_HOUND_PATROL_CELLS,
  isLevelElevenOpenCell,
  isLevelElevenRoadCell,
  levelElevenCellCenter,
  levelElevenWorldToCell,
} from "./layout.js";
import { createLevelElevenAsphaltMaps, createLevelElevenPavementMaps } from "./textures.js";
import { addLevelElevenDetails } from "./props.js";

export function createLevelElevenScene({ initialState = null } = {}) {
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(0xb7c0c3);
  scene.background = fogColor;
  scene.fog = new THREE.FogExp2(fogColor, 0.0048);
  const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 330);
  const viewModel = attachFirstPersonViewModel(camera);
  scene.add(camera);
  const spawnCell = levelElevenCellCenter(LEVEL_ELEVEN_START_CELL.col, LEVEL_ELEVEN_START_CELL.row);
  const backroadPosition = levelElevenCellCenter(LEVEL_ELEVEN_BACKROAD_CELL.col, LEVEL_ELEVEN_BACKROAD_CELL.row);
  const poolExitPosition = levelElevenCellCenter(LEVEL_ELEVEN_POOL_EXIT_CELL.col, LEVEL_ELEVEN_POOL_EXIT_CELL.row);
  const spawn = { ...spawnCell, yaw: LEVEL_ELEVEN_START_CELL.yaw };
  const coarse = window.matchMedia?.("(pointer: coarse), (max-width: 800px)").matches;
  const low = isLowQuality();

  const pavementMaterial = createGameMaterial({ ...createLevelElevenPavementMaps(28, 22, !low), color: 0xa4a6a2, roughness: 0.94, normalScale: new THREE.Vector2(0.38, 0.38) });
  const base = new THREE.Mesh(enableAoUv(new THREE.PlaneGeometry(LEVEL_ELEVEN_COLS * CELL_SIZE, LEVEL_ELEVEN_ROWS * CELL_SIZE)), pavementMaterial);
  base.name = "level-eleven-pavement-base";
  base.rotation.x = -Math.PI / 2;
  scene.add(base);
  const asphaltMaterial = createGameMaterial({ ...createLevelElevenAsphaltMaps(1.6, 1.6, !low), color: 0x696d70, roughness: 0.92, normalScale: new THREE.Vector2(0.34, 0.34) });
  const roadGeometry = enableAoUv(new THREE.PlaneGeometry(CELL_SIZE + 0.025, CELL_SIZE + 0.025));
  const roadCells = [];
  for (let row = 0; row < LEVEL_ELEVEN_ROWS; row += 1) {
    for (let col = 0; col < LEVEL_ELEVEN_COLS; col += 1) {
      if (isLevelElevenRoadCell(col, row)) roadCells.push(levelElevenCellCenter(col, row));
    }
  }
  const roads = new THREE.InstancedMesh(roadGeometry, asphaltMaterial, roadCells.length);
  roads.name = "level-eleven-asphalt-roads";
  const transform = new THREE.Object3D();
  transform.rotation.x = -Math.PI / 2;
  roadCells.forEach((center, index) => {
    transform.position.set(center.x, 0.024, center.z);
    transform.updateMatrix();
    roads.setMatrixAt(index, transform.matrix);
  });
  roads.instanceMatrix.needsUpdate = true;
  scene.add(roads);
  const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xd6b94f, transparent: true, opacity: 0.72 });
  for (let row = 3; row < LEVEL_ELEVEN_ROWS - 2; row += 4) {
    const center = levelElevenCellCenter(28.5, row);
    const marker = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 2.1), lineMaterial);
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(center.x, 0.042, center.z);
    scene.add(marker);
  }
  scene.add(new THREE.HemisphereLight(0xe6edf0, 0x363a3b, 1.25));
  const sun = new THREE.DirectionalLight(0xfff1d2, 1.14);
  sun.position.set(-45, 78, 36);
  scene.add(sun);
  const details = addLevelElevenDetails(scene, { coarse });
  const isWalkable = createGridWalkability({ worldToCell: levelElevenWorldToCell, isOpen: isLevelElevenOpenCell, colliders: details.colliders });
  const routes = [
    { id: "level-eleven-backroad-ten", targetLevel: 10, targetLabel: "LEVEL 10", label: "BACK ROAD", kind: "threshold", position: backroadPosition, enterRadius: 5.2 },
    { id: "level-eleven-public-pool-0037", targetLevel: 37, targetLabel: "LEVEL 37", label: "PUBLIC POOL #0037", kind: "door", position: poolExitPosition, rotation: Math.PI / 2, singleDoor: true, canClose: false },
  ];
  const exitNetwork = createExitNetwork(scene, camera, routes, initialState?.interactions ?? {});
  const pickupSet = createStandardPickupSet(scene, {
    cols: LEVEL_ELEVEN_COLS,
    rows: LEVEL_ELEVEN_ROWS,
    isCellOpen: isLevelElevenOpenCell,
    getCellCenter: levelElevenCellCenter,
    avoidPositions: [spawnCell, backroadPosition, poolExitPosition],
    blockedAabbs: details.colliders,
    initialState: initialState?.pickups ?? {},
    includeFiresalt: true,
    firesaltSpawnChance: 1,
  });
  const savedEntities = snapEntityStates(initialState?.entities ?? [], isWalkable);
  const patrolPoints = LEVEL_ELEVEN_HOUND_PATROL_CELLS.map(({ col, row }) => levelElevenCellCenter(col, row));
  const hound = createHoundEntity(scene, {
    id: "hound-level-eleven",
    spawnPosition: patrolPoints[0],
    isWalkable,
    speed: 1.55,
    passivePatrol: { points: patrolPoints, provokeDuration: 12 },
    initialState: savedEntities.find((entity) => entity.id === "hound-level-eleven") ?? null,
    cols: LEVEL_ELEVEN_COLS,
    rows: LEVEL_ELEVEN_ROWS,
    isCellOpen: isLevelElevenOpenCell,
    worldToCell: levelElevenWorldToCell,
    cellCenter: levelElevenCellCenter,
  });
  const updateLightState = createStableLightState("DAYLIGHT", { dimBelow: 0.58, normalAbove: 0.75, dimDelay: 0.8, normalDelay: 1.1 });
  let objectiveReached = Boolean(initialState?.objectives?.reached);

  function update(delta, elapsed, playerPosition, effects = {}) {
    details.update(elapsed);
    const entered = exitNetwork.update(delta, playerPosition);
    if (entered) objectiveReached = true;
    const pickupStates = pickupSet.update(delta, elapsed, playerPosition);
    const houndState = hound.update(delta, elapsed, playerPosition, effects);
    updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition);
    const backroadDistance = Math.hypot(playerPosition.x - backroadPosition.x, playerPosition.z - backroadPosition.z);
    const poolDistance = Math.hypot(playerPosition.x - poolExitPosition.x, playerPosition.z - poolExitPosition.z);
    const exitDistance = Math.min(backroadDistance, poolDistance);
    const flicker = 0.82 + Math.sin(elapsed * 0.21) * 0.025;
    return {
      exitDistance: Math.round(exitDistance),
      exitReached: Boolean(entered),
      nextLevel: entered?.targetLevel,
      entityContact: houndState.contact,
      flicker,
      pickups: Object.values(pickupStates),
      entities: [houndState],
      focusEntity: getFocusedEntity(camera, [houndState]),
      focusInteraction: exitNetwork.inspect(playerPosition),
      focusItem: pickupSet.inspect(camera),
      lightState: updateLightState(delta, flicker),
      statusText: houndState.provoked ? "THE 11 EFFECT IS BROKEN" : poolDistance < 18 ? "PUBLIC POOL #0037" : backroadDistance < 18 ? "BACK ROAD" : "THE ENDLESS CITY",
    };
  }

  return {
    level: 11,
    levelLabel: "LEVEL 11",
    levelName: "THE ENDLESS CITY",
    scene,
    camera,
    spawn,
    targetPosition: poolExitPosition,
    nextLevel: null,
    exitMode: "network",
    isWalkable,
    colliderCount: details.colliders.length,
    flashlightEffectiveness: 0.92,
    get viewModelName() { return getViewModelName(viewModel); },
    decorativeItemSpawns: [
      { id: "empty-can", position: { ...levelElevenCellCenter(31, 37), y: 0.15 }, rotation: 0.62 },
      { id: "crumpled-note", position: { ...levelElevenCellCenter(51, 9), y: 0.08 }, rotation: -0.18 },
    ],
    update,
    getPickupTarget: (playerPosition) => pickupSet.getPickupTarget(playerPosition),
    tryPickup: (playerPosition) => pickupSet.tryPickup(playerPosition),
    interact: (playerPosition, access) => exitNetwork.interact(playerPosition, access),
    getSnapshot: () => ({
      pickups: pickupSet.getState(),
      interactions: exitNetwork.getState(),
      objectives: { reached: objectiveReached },
      entities: [hound.getState()],
    }),
  };
}
