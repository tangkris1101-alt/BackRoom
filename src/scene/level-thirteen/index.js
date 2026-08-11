import * as THREE from "three";
import { attachFirstPersonViewModel, getViewModelName, updateFirstPersonHazmatViewModel } from "../common/view-model.js";
import { createExitNetwork } from "../common/exit-network.js";
import { createLocalRelocationNetwork } from "../common/local-relocation.js";
import { isLowQuality } from "../common/materials.js";
import { circleIntersectsAabb } from "../constants.js";
import { createInteractionSpot, getFocusedEntity, getFocusedItem, getPickupTarget, tryPickupItems } from "../entities/index.js";
import { createSmilerEntity } from "../entities/index.js";
import { createAlmondWaterPickup, createFiresaltPickup } from "../items/index.js";
import { snapEntityStates } from "../common/snap.js";
import {
  LEVEL_THIRTEEN_COLS,
  LEVEL_THIRTEEN_ROWS,
  LEVEL_THIRTEEN_FLOORS,
  getLevelThirteenApartment,
  getLevelThirteenFloor,
  getLevelThirteenSpawnFloor,
  isLevelThirteenOpenCell,
  levelThirteenCellCenter,
  levelThirteenWorldToCell,
  updateLevelThirteenLethargy,
} from "./layout.js";
import { addLevelThirteenProps } from "./props.js";

const facelingText = {
  "zh-CN": {
    name: "前台无面人",
    effect: "它在等待有人申请一套公寓",
    action: "F / 按钮申请Apartment 71304",
    response: "无面人推来一把标有71304的钥匙",
  },
  en: {
    name: "DESK FACELING",
    effect: "IT IS WAITING FOR SOMEONE TO CLAIM AN APARTMENT",
    action: "F / BUTTON REQUEST APARTMENT 71304",
    response: "THE FACELING SLIDES OVER A KEY MARKED 71304",
  },
};

function chooseSpawn(entryContext) {
  const floor = getLevelThirteenSpawnFloor(entryContext?.sourceLevel);
  return { ...levelThirteenCellCenter(floor.spawn.col, floor.spawn.row), yaw: floor.spawn.yaw };
}

export function createLevelThirteenScene({ initialState = null, entryContext = null } = {}) {
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(0x77746d);
  scene.background = fogColor;
  scene.fog = new THREE.FogExp2(fogColor, 0.0125);
  const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 220);
  const viewModel = attachFirstPersonViewModel(camera);
  scene.add(camera);
  scene.add(new THREE.HemisphereLight(0xe6dec8, 0x302d29, 1.16));
  const lightRows = isLowQuality() ? [12, 30] : [7, 16, 25, 34];
  for (const floor of LEVEL_THIRTEEN_FLOORS) {
    for (const row of lightRows) {
      const center = levelThirteenCellCenter(floor.centerCol, row);
      const light = new THREE.PointLight(
        floor.id === 71 ? 0xd9c795 : 0xffe7ba,
        floor.id === 71 ? 1.12 : 1.48,
        34,
        2.05,
      );
      light.position.set(center.x, 3.18, center.z);
      scene.add(light);
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.06, 0.46),
        new THREE.MeshBasicMaterial({ color: floor.id === 71 ? 0xd9c795 : 0xffedcf, toneMapped: false }),
      );
      panel.position.set(center.x, 3.62, center.z);
      scene.add(panel);
    }
  }

  const spawn = chooseSpawn(entryContext);
  const props = addLevelThirteenProps(scene);
  function isWalkable(x, z, radius = 0.36) {
    const corner = radius * 0.72;
    const samples = [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius], [corner, corner], [-corner, corner], [corner, -corner], [-corner, -corner]];
    if (!samples.every(([dx, dz]) => {
      const cell = levelThirteenWorldToCell(x + dx, z + dz);
      return isLevelThirteenOpenCell(cell.col, cell.row);
    })) return false;
    return !props.colliders.some((bounds) => bounds.active !== false && circleIntersectsAabb(x, z, radius, bounds));
  }

  const savedInteractions = initialState?.interactions ?? {};
  let apartmentClaimed = Boolean(savedInteractions["level-thirteen-desk-faceling"]?.count);
  let objectiveReached = Boolean(initialState?.objectives?.reached);
  let lethargy = 0;
  let relocationFlash = 0;

  const facelingSpot = createInteractionSpot({
    id: "level-thirteen-desk-faceling",
    position: props.facelingPosition,
    radius: 3.4,
    initialState: savedInteractions["level-thirteen-desk-faceling"],
    getInteractionState: () => ({ count: apartmentClaimed ? 1 : 0 }),
    getInspectState: () => ({ i18n: facelingText }),
    onInteract: () => {
      apartmentClaimed = true;
      return { i18n: facelingText };
    },
  });

  const localRoutes = [
    { id: "level-thirteen-stair-0-to-71", position: levelThirteenCellCenter(11, 37), destination: { ...levelThirteenCellCenter(35, 33), yaw: 0 } },
    { id: "level-thirteen-stair-71-to-0", position: levelThirteenCellCenter(35, 37), destination: { ...levelThirteenCellCenter(11, 33), yaw: 0 } },
    { id: "level-thirteen-stair-71-to-283", position: levelThirteenCellCenter(35, 4), destination: { ...levelThirteenCellCenter(59, 8), yaw: Math.PI } },
    { id: "level-thirteen-stair-283-to-71", position: levelThirteenCellCenter(59, 4), destination: { ...levelThirteenCellCenter(35, 8), yaw: Math.PI } },
    ...LEVEL_THIRTEEN_FLOORS.flatMap((floor) => [
      { id: `level-thirteen-loop-${floor.id}-north`, position: levelThirteenCellCenter(floor.centerCol, 3), destination: { ...levelThirteenCellCenter(floor.centerCol, 34), yaw: 0 } },
      { id: `level-thirteen-loop-${floor.id}-south`, position: levelThirteenCellCenter(floor.centerCol, 38), destination: { ...levelThirteenCellCenter(floor.centerCol, 7), yaw: Math.PI } },
    ]),
  ].map((route) => ({ ...route, activation: "threshold", radius: 1.25 }));
  const localRelocations = createLocalRelocationNetwork(camera, localRoutes, savedInteractions);
  const exitNetwork = createExitNetwork(scene, camera, [{
    id: "level-thirteen-rusty-pipe-three",
    targetLevel: 3,
    targetLabel: "LEVEL 3",
    label: "RUSTED PIPE",
    kind: "threshold",
    position: props.pipeExitPosition,
    enterRadius: 1.45,
  }], savedInteractions);

  const almondCell = { col: 55, row: 19 };
  const firesaltCell = { col: 41, row: 12 };
  const almondWater = createAlmondWaterPickup(scene, {
    cols: LEVEL_THIRTEEN_COLS,
    rows: LEVEL_THIRTEEN_ROWS,
    isCellOpen: (col, row) => col === almondCell.col && row === almondCell.row,
    getCellCenter: levelThirteenCellCenter,
    initialState: initialState?.pickups?.["almond-water"] ?? null,
  });
  const firesalt = createFiresaltPickup(scene, {
    cols: LEVEL_THIRTEEN_COLS,
    rows: LEVEL_THIRTEEN_ROWS,
    isCellOpen: (col, row) => col === firesaltCell.col && row === firesaltCell.row,
    getCellCenter: levelThirteenCellCenter,
    initialSpawnChance: 1,
    initialState: initialState?.pickups?.firesalt ?? null,
  });
  const pickups = [almondWater, firesalt];

  const savedEntities = snapEntityStates(initialState?.entities ?? [], isWalkable);
  const smilerSpawn = levelThirteenCellCenter(42, 12);
  const smiler = createSmilerEntity(scene, {
    id: "smiler-level-thirteen",
    spawnPosition: smilerSpawn,
    isWalkable,
    camera,
    initialState: savedEntities.find((entity) => entity.id === "smiler-level-thirteen") ?? null,
    cols: LEVEL_THIRTEEN_COLS,
    rows: LEVEL_THIRTEEN_ROWS,
    isCellOpen: isLevelThirteenOpenCell,
    worldToCell: levelThirteenWorldToCell,
    cellCenter: levelThirteenCellCenter,
    speed: 1.72,
  });

  function update(delta, elapsed, playerPosition, effects = {}) {
    const cell = levelThirteenWorldToCell(playerPosition.x, playerPosition.z);
    const apartment = getLevelThirteenApartment(cell.col, cell.row);
    lethargy = updateLevelThirteenLethargy(lethargy, Boolean(apartment), delta);
    props.update(elapsed, apartmentClaimed);
    const relocation = localRelocations.update(playerPosition);
    if (relocation) relocationFlash = 0.42;
    relocationFlash = Math.max(0, relocationFlash - delta);
    const entered = exitNetwork.update(delta, playerPosition);
    if (entered) objectiveReached = true;
    const smilerState = smiler.update(delta, elapsed, playerPosition, effects);
    const windowStates = props.windows.map((window) => {
      const distance = Math.hypot(playerPosition.x - window.position.x, playerPosition.z - window.position.z);
      return {
        id: window.id,
        type: "window-entity",
        active: true,
        contact: distance <= 1.05,
        contactRadius: 1.05,
        contactDamage: 18,
        distance,
        x: window.position.x,
        y: 1.45,
        z: window.position.z,
      };
    });
    const facelingDistance = Math.hypot(playerPosition.x - props.facelingPosition.x, playerPosition.z - props.facelingPosition.z);
    const facelingState = {
      id: "faceling-level-thirteen",
      type: "faceling",
      active: true,
      contact: false,
      contactDamage: 0,
      distance: facelingDistance,
      x: props.facelingPosition.x,
      y: 1.7,
      z: props.facelingPosition.z,
    };
    const entityStates = [facelingState, smilerState, ...windowStates];
    const pickupStates = pickups.map((pickup) => pickup.update(delta, elapsed, playerPosition));
    const pipeDistance = Math.hypot(playerPosition.x - props.pipeExitPosition.x, playerPosition.z - props.pipeExitPosition.z);
    const floorId = getLevelThirteenFloor(cell.col);
    updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition);
    return {
      exitDistance: Math.round(pipeDistance),
      exitReached: Boolean(entered),
      nextLevel: entered?.targetLevel,
      exitId: entered?.id ?? null,
      relocation,
      flicker: 0.7 + Math.sin(elapsed * 1.1 + floorId) * 0.05,
      lightState: floorId === 71 ? "UNSTABLE" : "DIM",
      pickups: pickupStates,
      entities: entityStates,
      focusEntity: getFocusedEntity(camera, entityStates),
      focusInteraction: facelingSpot.inspect(camera, playerPosition),
      focusItem: getFocusedItem(...pickups.map((pickup) => pickup.inspect(camera))),
      playerModifiers: {
        movementSpeedMultiplier: THREE.MathUtils.lerp(1, 0.78, lethargy),
        staminaRecoveryMultiplier: THREE.MathUtils.lerp(1, 0.5, lethargy),
      },
      screenEffects: {
        static: relocationFlash > 0 ? 0.35 : 0,
        whiteout: relocationFlash,
        desaturation: lethargy * 0.34,
        vignette: lethargy * 0.62,
      },
      statusText: apartment
        ? `APARTMENT ${apartment.id} · LETHARGY ${Math.round(lethargy * 100)}%`
        : floorId === 0 && facelingDistance < 14 ? "LEVEL 13 FRONT DESK"
          : floorId === 71 ? "FLOOR 71"
            : floorId === 283 ? "CLAIMED FLOOR 283" : "FLOOR 0",
    };
  }

  return {
    level: 13,
    levelLabel: "LEVEL 13",
    levelName: "THE INFINITE APARTMENTS",
    scene,
    camera,
    spawn,
    targetPosition: props.pipeExitPosition,
    nextLevel: null,
    exitMode: "network",
    isWalkable,
    getFootstepSurface(position) {
      const cell = levelThirteenWorldToCell(position.x, position.z);
      if (getLevelThirteenApartment(cell.col, cell.row)) return "wood";
      if (getLevelThirteenFloor(cell.col) === 0 && cell.col >= 15 && cell.row <= 10) return "metal";
      return "carpet";
    },
    get viewModelName() { return getViewModelName(viewModel); },
    update,
    getPickupTarget: (playerPosition) => getPickupTarget(playerPosition, ...pickups),
    tryPickup: (playerPosition) => tryPickupItems(playerPosition, ...pickups),
    interact: (playerPosition) => facelingSpot.interact(playerPosition),
    getSnapshot: () => ({
      pickups: {
        "almond-water": almondWater.getState(),
        firesalt: firesalt.getState(),
      },
      interactions: {
        ...exitNetwork.getState(),
        ...localRelocations.getState(),
        [facelingSpot.id]: facelingSpot.getState(),
      },
      objectives: { reached: objectiveReached },
      entities: [smiler.getState()],
    }),
  };
}
