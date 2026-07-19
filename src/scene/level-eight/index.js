import * as THREE from "three";
import { CELL_SIZE, CEILING_Y, WALL_HEIGHT } from "../constants.js";
import { addInstancedBoxes, createStableLightState } from "../common/lighting.js";
import {
  collectGridWallTransforms,
  createGridWalkability,
  createStandardPickupSet,
  eastWestWallGeometry,
  northSouthWallGeometry,
} from "../common/grid-world.js";
import { attachFirstPersonViewModel, getViewModelName, updateFirstPersonHazmatViewModel } from "../common/view-model.js";
import { createExitNetwork } from "../common/exit-network.js";
import { createSmilerEntity, getFocusedEntity } from "../entities/index.js";
import { snapEntityStates } from "../common/snap.js";
import {
  LEVEL_EIGHT_COLS,
  LEVEL_EIGHT_ROWS,
  LEVEL_EIGHT_START_CELL,
  LEVEL_EIGHT_TARGET_CELL,
  isLevelEightOpenCell,
  levelEightCellCenter,
  levelEightWorldToCell,
} from "./layout.js";
import { createLevelEightCeilingTexture, createLevelEightPbrMaps } from "./textures.js";
import { enableAoUv } from "../common/texture-utils.js";

function addCaveDetails(scene) {
  const rock = new THREE.MeshStandardMaterial({ color: 0x303733, roughness: 0.98, metalness: 0.02 });
  const wetRock = new THREE.MeshStandardMaterial({ color: 0x263532, emissive: 0x06231d, emissiveIntensity: 0.24, roughness: 0.72 });
  const mineral = new THREE.MeshStandardMaterial({ color: 0x8c5124, emissive: 0xff4b16, emissiveIntensity: 0.45, roughness: 0.42 });
  const spikeGeometry = new THREE.ConeGeometry(0.32, 1.45, 7);
  const transforms = [];
  for (let row = 2; row < LEVEL_EIGHT_ROWS - 2; row += 2) {
    for (let col = 2; col < LEVEL_EIGHT_COLS - 2; col += 2) {
      if (!isLevelEightOpenCell(col, row)) continue;
      if ((col * 17 + row * 29) % 7 > 1) continue;
      const center = levelEightCellCenter(col, row);
      transforms.push(new THREE.Vector3(center.x + ((col % 3) - 1) * 0.7, 0.72, center.z + ((row % 3) - 1) * 0.62));
    }
  }
  if (transforms.length) addInstancedBoxes(scene, spikeGeometry, rock, transforms);
  const ceilingSpikes = new THREE.InstancedMesh(spikeGeometry, wetRock, Math.min(48, transforms.length));
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI));
  transforms.slice(0, 48).forEach((position, index) => {
    matrix.compose(new THREE.Vector3(position.x + 0.8, CEILING_Y - 0.72, position.z - 0.55), quaternion, new THREE.Vector3(1, 1, 1));
    ceilingSpikes.setMatrixAt(index, matrix);
  });
  scene.add(ceilingSpikes);

  const poolMaterial = new THREE.MeshPhysicalMaterial({ color: 0x244f50, emissive: 0x06393a, emissiveIntensity: 0.34, roughness: 0.2, transparent: true, opacity: 0.72 });
  for (const cell of [{ col: 24, row: 18 }, { col: 41, row: 27 }, { col: 8, row: 22 }]) {
    const center = levelEightCellCenter(cell.col, cell.row);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(2.6, 28), poolMaterial);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(center.x, 0.035, center.z);
    scene.add(pool);
  }
  for (const cell of [{ col: 18, row: 31 }, { col: 30, row: 17 }, { col: 43, row: 14 }]) {
    const center = levelEightCellCenter(cell.col, cell.row);
    const vein = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38, 1), mineral);
    vein.scale.set(1.8, 0.72, 0.55);
    vein.position.set(center.x, 0.38, center.z);
    vein.rotation.y = cell.col * 0.17;
    scene.add(vein);
  }

  const roadMaterial = new THREE.MeshBasicMaterial({ color: 0xe3b85f, transparent: true, opacity: 0.72 });
  for (let index = 0; index < 11; index += 1) {
    const t = index / 10;
    const start = levelEightCellCenter(5, 34);
    const end = levelEightCellCenter(46, 5);
    const marker = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.025, 0.12), roadMaterial);
    marker.position.set(THREE.MathUtils.lerp(start.x, end.x, t), 0.055, THREE.MathUtils.lerp(start.z, end.z, t));
    marker.rotation.y = -0.95;
    scene.add(marker);
  }
}

export function createLevelEightScene({ initialState = null } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07100e);
  scene.fog = new THREE.FogExp2(0x07100e, 0.0135);
  const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 270);
  const viewModel = attachFirstPersonViewModel(camera);
  scene.add(camera);
  const spawnCell = levelEightCellCenter(LEVEL_EIGHT_START_CELL.col, LEVEL_EIGHT_START_CELL.row);
  const targetPosition = levelEightCellCenter(LEVEL_EIGHT_TARGET_CELL.col, LEVEL_EIGHT_TARGET_CELL.row);
  const spawn = { ...spawnCell, yaw: LEVEL_EIGHT_START_CELL.yaw };

  const floorMaterial = new THREE.MeshStandardMaterial({ ...createLevelEightPbrMaps(18, 14), color: 0xa7b4aa, emissive: 0x0c1814, emissiveIntensity: 0.28, roughness: 0.94, normalScale: new THREE.Vector2(0.55, 0.55), aoMapIntensity: 0.62 });
  const wallMaterial = new THREE.MeshStandardMaterial({ ...createLevelEightPbrMaps(22, 8), color: 0x98a39a, emissive: 0x0c1714, emissiveIntensity: 0.2, roughness: 0.96, normalScale: new THREE.Vector2(0.72, 0.72), aoMapIntensity: 0.7 });
  const ceilingMaterial = new THREE.MeshStandardMaterial({ map: createLevelEightCeilingTexture(), color: 0x77817a, emissive: 0x07100e, emissiveIntensity: 0.18, roughness: 0.98 });
  const floor = new THREE.Mesh(enableAoUv(new THREE.PlaneGeometry(LEVEL_EIGHT_COLS * CELL_SIZE, LEVEL_EIGHT_ROWS * CELL_SIZE)), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(LEVEL_EIGHT_COLS * CELL_SIZE, LEVEL_EIGHT_ROWS * CELL_SIZE), ceilingMaterial);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = CEILING_Y;
  scene.add(ceiling);
  const walls = collectGridWallTransforms({ cols: LEVEL_EIGHT_COLS, rows: LEVEL_EIGHT_ROWS, isOpen: isLevelEightOpenCell, cellCenter: levelEightCellCenter });
  addInstancedBoxes(scene, northSouthWallGeometry, wallMaterial, walls.northSouth);
  addInstancedBoxes(scene, eastWestWallGeometry, wallMaterial, walls.eastWest);
  addCaveDetails(scene);
  scene.add(new THREE.HemisphereLight(0x71928a, 0x020504, 0.62));
  const guideCells = [{ col: 5, row: 34 }, { col: 19, row: 31 }, { col: 25, row: 18 }, { col: 40, row: 16 }, { col: 45, row: 6 }];
  guideCells.forEach((cell, index) => {
    const center = levelEightCellCenter(cell.col, cell.row);
    const light = new THREE.PointLight(index % 2 ? 0x6bf0ce : 0xffb45c, 1.0, 18, 2.1);
    light.position.set(center.x, 2.5, center.z);
    scene.add(light);
  });
  const cameraFill = new THREE.PointLight(0xb8ddd0, 0.34, 6.5, 2.2);
  cameraFill.position.set(0, 0.1, -0.35);
  camera.add(cameraFill);
  const updateLightState = createStableLightState("CAVE", { dimBelow: 0.35, normalAbove: 0.56, dimDelay: 0.7, normalDelay: 1.1 });

  const colliders = [];
  const isWalkable = createGridWalkability({ worldToCell: levelEightWorldToCell, isOpen: isLevelEightOpenCell, colliders });
  const interactionInitial = initialState?.interactions ?? {};
  const routes = [
    { id: "level-eight-road-end", targetLevel: null, targetLabel: "9TH ROAD", label: "9TH ROAD", kind: "door", position: targetPosition, rotation: 0 },
    { id: "level-eight-vent-level-two", targetLevel: 2, targetLabel: "LEVEL 2", label: "VENT", kind: "door", position: levelEightCellCenter(7, 22), rotation: Math.PI / 2 },
    { id: "level-eight-pool-level-seven", targetLevel: 7, targetLabel: "LEVEL 7", label: "DISTILLED POOL", kind: "stair", position: levelEightCellCenter(41, 27), rotation: Math.PI },
  ];
  const exitNetwork = createExitNetwork(scene, camera, routes, interactionInitial);
  const pickupSet = createStandardPickupSet(scene, {
    cols: LEVEL_EIGHT_COLS, rows: LEVEL_EIGHT_ROWS, isCellOpen: isLevelEightOpenCell, getCellCenter: levelEightCellCenter,
    avoidPositions: [spawnCell, targetPosition], blockedAabbs: colliders, initialState: initialState?.pickups ?? {}, includeFiresalt: true, firesaltSpawnChance: 0.86,
  });
  const savedEntities = snapEntityStates(initialState?.entities ?? [], isWalkable);
  const smilerSpawns = [levelEightCellCenter(38, 27), levelEightCellCenter(29, 17)];
  const smilerCount = window.matchMedia?.("(pointer: coarse), (max-width: 800px)").matches ? 1 : 2;
  const smilers = smilerSpawns.slice(0, smilerCount).map((position, index) => createSmilerEntity(scene, {
    id: `smiler-${index + 1}`, spawnPosition: position, isWalkable, camera,
    initialState: savedEntities.find((entity) => entity.id === `smiler-${index + 1}`) ?? null,
    cols: LEVEL_EIGHT_COLS, rows: LEVEL_EIGHT_ROWS, isCellOpen: isLevelEightOpenCell, worldToCell: levelEightWorldToCell, cellCenter: levelEightCellCenter,
  }));
  let objectiveReached = Boolean(initialState?.objectives?.reached);

  function update(delta, elapsed, playerPosition, effects = {}) {
    const entered = exitNetwork.update(delta, playerPosition);
    if (entered) objectiveReached = true;
    const pickupStates = pickupSet.update(delta, elapsed, playerPosition);
    const entities = smilers.map((smiler) => smiler.update(delta, elapsed, playerPosition, effects));
    const flicker = 0.52 + Math.sin(elapsed * 0.54) * 0.09;
    scene.fog.density = 0.0135 + (1 - flicker) * 0.004;
    cameraFill.intensity = 0.3 + Math.sin(elapsed * 0.42) * 0.04;
    updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition);
    const exitDistance = Math.min(...routes.map((route) => Math.hypot(playerPosition.x - route.position.x, playerPosition.z - route.position.z)));
    return {
      exitDistance: Math.round(exitDistance), exitReached: Boolean(entered), nextLevel: entered?.targetLevel,
      entityContact: entities.some((entity) => entity.contact), flicker, pickups: Object.values(pickupStates), entities,
      focusEntity: getFocusedEntity(camera, entities), focusInteraction: exitNetwork.inspect(playerPosition), focusItem: pickupSet.inspect(camera),
      lightState: updateLightState(delta, flicker), statusText: exitDistance < 14 ? "9TH ROAD" : "CAVE SYSTEMS",
    };
  }
  return {
    level: 8, levelLabel: "LEVEL 8", levelName: "CAVE SYSTEMS", scene, camera, spawn, targetPosition,
    nextLevel: null, exitMode: "network", isWalkable, flashlightEffectiveness: 1.35,
    get viewModelName() { return getViewModelName(viewModel); },
    decorativeItemSpawns: [{ id: "concrete-chip", position: { ...levelEightCellCenter(20, 31), y: 0.18 }, rotation: 0.4, tiltX: 0.1 }],
    update,
    getPickupTarget: (playerPosition) => pickupSet.getPickupTarget(playerPosition),
    tryPickup: (playerPosition) => pickupSet.tryPickup(playerPosition),
    interact: (playerPosition, access) => exitNetwork.interact(playerPosition, access),
    getSnapshot: () => ({ pickups: pickupSet.getState(), interactions: exitNetwork.getState(), objectives: { reached: objectiveReached }, entities: smilers.map((smiler) => smiler.getState()) }),
  };
}
