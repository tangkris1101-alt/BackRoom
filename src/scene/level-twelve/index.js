import * as THREE from "three";
import { attachFirstPersonViewModel, getViewModelName, updateFirstPersonHazmatViewModel } from "../common/view-model.js";
import { createGameMaterial, isLowQuality } from "../common/materials.js";
import { createExitNetwork } from "../common/exit-network.js";
import { createLocalRelocationNetwork } from "../common/local-relocation.js";
import { createInteractionSpot, getFocusedInteraction } from "../entities/interactions.js";
import { circleIntersectsAabb } from "../constants.js";
import {
  LEVEL_TWELVE_COLS,
  LEVEL_TWELVE_ROWS,
  LEVEL_TWELVE_START_CELL,
  isLevelTwelveOpenCell,
  levelTwelveCellCenter,
  levelTwelveWorldToCell,
} from "./layout.js";
import { createLevelTwelveFloorMaps } from "./textures.js";
import { addLevelTwelveProps } from "./props.js";
import { createMatrixProgression } from "./matrix-progression.js";

const text = (nameZh, effectZh, actionZh, responseZh, nameEn, effectEn, actionEn, responseEn) => ({
  "zh-CN": { name: nameZh, effect: effectZh, action: actionZh, response: responseZh },
  en: { name: nameEn, effect: effectEn, action: actionEn, response: responseEn },
});

function closestInteraction(...interactions) {
  return interactions.filter(Boolean).sort((a, b) => a.distance - b.distance)[0] ?? null;
}

export function createLevelTwelveScene({ initialState = null } = {}) {
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(0xf4f4f1);
  scene.background = fogColor;
  scene.fog = new THREE.FogExp2(fogColor, 0.0068);
  const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 260);
  const viewModel = attachFirstPersonViewModel(camera);
  scene.add(camera);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xbebeb8, 1.7));
  const fill = new THREE.DirectionalLight(0xffffff, 0.72);
  fill.position.set(-20, 42, 16);
  scene.add(fill);

  const spawnCell = levelTwelveCellCenter(LEVEL_TWELVE_START_CELL.col, LEVEL_TWELVE_START_CELL.row);
  const spawn = { ...spawnCell, yaw: LEVEL_TWELVE_START_CELL.yaw };
  const low = isLowQuality();
  const floorMaterial = createGameMaterial({
    ...createLevelTwelveFloorMaps(28, 24, !low),
    color: 0xffffff,
    emissive: 0xf7f7f2,
    emissiveIntensity: 0.48,
    roughness: 0.96,
    normalScale: new THREE.Vector2(0.16, 0.16),
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(LEVEL_TWELVE_COLS * 4, LEVEL_TWELVE_ROWS * 4), floorMaterial);
  floor.name = "level-twelve-white-void-floor";
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const props = addLevelTwelveProps(scene);
  function isWalkable(x, z, radius = 0.36) {
    const samples = [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]];
    if (!samples.every(([dx, dz]) => {
      const cell = levelTwelveWorldToCell(x + dx, z + dz);
      return isLevelTwelveOpenCell(cell.col, cell.row);
    })) return false;
    return !props.colliders.some((bounds) => bounds.active !== false && circleIntersectsAabb(x, z, radius, bounds));
  }

  const savedInteractions = initialState?.interactions ?? {};
  const progression = createMatrixProgression(savedInteractions);
  let objectiveReached = Boolean(initialState?.objectives?.reached);
  let relocationFlash = 0;

  const doorI18n = text(
    "原始锁门", "门把手没有任何温度", "F / 按钮尝试", "门仍然锁着",
    "THE ORIGINAL DOOR", "THE HANDLE HAS NO TEMPERATURE", "F / BUTTON TRY", "THE DOOR REMAINS LOCKED",
  );
  const chairI18n = text(
    "原始椅子", "保持靠近并观察八秒", "F / 按钮开始观察", "记忆校准开始",
    "THE ORIGINAL CHAIR", "REMAIN CLOSE AND OBSERVE FOR EIGHT SECONDS", "F / BUTTON BEGIN", "MEMORY CALIBRATION STARTED",
  );
  const copycatI18n = text(
    "复制门", "门后应该返回原始房间", "F / 按钮进入", "白色空间折回了自身",
    "COPYCAT DOOR", "THE DOOR SHOULD LOOP BACK TO THE ORIGINAL ROOM", "F / BUTTON ENTER", "THE WHITE SPACE FOLDS BACK ON ITSELF",
  );

  const doorSpot = createInteractionSpot({
    id: "level-twelve-original-door",
    position: props.exitPosition,
    radius: 3,
    initialState: savedInteractions["level-twelve-original-door"],
    getInteractionState: () => progression.getInteractionState()["level-twelve-original-door"],
    getInspectState: () => ({
      i18n: progression.doorOpened
        ? text("已开启的白门", "门后连接Level 10", "向前进入", "出口已经开启", "OPEN WHITE DOOR", "THE DOOR LEADS TO LEVEL 10", "WALK FORWARD", "THE EXIT IS OPEN")
        : doorI18n,
      opened: doorOpened,
      position: { ...props.exitPosition, y: 1.4 },
    }),
    onInteract: () => {
      if (progression.tryDoor()) {
        props.doorCollider.active = false;
        return { i18n: text("原始门", "锁舌已经消失", "向前进入", "门无声地滑开", "THE ORIGINAL DOOR", "THE LOCK HAS VANISHED", "WALK FORWARD", "THE DOOR SLIDES OPEN WITHOUT SOUND") };
      }
      return { i18n: doorI18n };
    },
  });
  const chairSpot = createInteractionSpot({
    id: "level-twelve-chair",
    position: props.chairPosition,
    radius: 2.8,
    initialState: savedInteractions["level-twelve-chair"],
    getInteractionState: () => progression.getInteractionState()["level-twelve-chair"],
    getInspectState: () => ({ i18n: chairI18n }),
    onInteract: () => {
      progression.beginChairObservation();
      return {
        i18n: progression.doorAttempted
          ? chairI18n
          : text("原始椅子", "先检查锁门", "F / 按钮检查", "你还没有尝试那扇门", "THE ORIGINAL CHAIR", "CHECK THE LOCKED DOOR FIRST", "F / BUTTON CHECK", "YOU HAVE NOT TRIED THE DOOR YET"),
      };
    },
  });

  const localRelocations = createLocalRelocationNetwork(camera, [{
    id: "level-twelve-copycat-door",
    activation: "interact",
    position: props.copycatPosition,
    radius: 3,
    destination: { x: spawn.x, z: spawn.z - 1.2, yaw: 0 },
    i18n: copycatI18n,
  }], savedInteractions);
  const stairExit = createExitNetwork(scene, camera, [{
    id: "level-twelve-white-stair-thirteen",
    targetLevel: 13,
    targetLabel: "LEVEL 13",
    label: "WHITE STAIR",
    kind: "threshold",
    position: props.stairPosition,
    enterRadius: 2.6,
  }], savedInteractions);

  if (progression.doorOpened) {
    props.doorCollider.active = false;
    props.originalDoor.position.y = 5.2;
  }

  function update(delta, elapsed, playerPosition) {
    if (progression.chairWatching && !progression.chairCompleted) {
      const distance = Math.hypot(playerPosition.x - props.chairPosition.x, playerPosition.z - props.chairPosition.z);
      progression.updateChairObservation(delta, distance <= 2.25);
    }
    props.originalDoor.position.y += ((progression.doorOpened ? 5.2 : 1.525) - props.originalDoor.position.y) * Math.min(1, delta * 4.5);
    const relocation = localRelocations.update(playerPosition);
    if (relocation) {
      progression.completeCopycat();
      relocationFlash = 0.72;
    }
    relocationFlash = Math.max(0, relocationFlash - delta);
    const enteredStair = stairExit.update(delta, playerPosition);
    const doorDistance = Math.hypot(playerPosition.x - props.exitPosition.x, playerPosition.z - props.exitPosition.z);
    const stairDistance = Math.hypot(playerPosition.x - props.stairPosition.x, playerPosition.z - props.stairPosition.z);
    const copycatDistance = Math.hypot(playerPosition.x - props.copycatPosition.x, playerPosition.z - props.copycatPosition.z);
    const coreDistance = Math.hypot(playerPosition.x - props.core.x, playerPosition.z - props.core.z);
    const censor = THREE.MathUtils.clamp((coreDistance - 10) / 68, 0, 1);
    const doorEntered = progression.doorOpened && doorDistance <= 1.55;
    if (doorEntered || enteredStair) objectiveReached = true;
    updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition);
    return {
      exitDistance: Math.round(Math.min(doorDistance, stairDistance)),
      exitReached: Boolean(doorEntered || enteredStair),
      nextLevel: doorEntered ? 10 : enteredStair?.targetLevel,
      exitId: doorEntered ? "level-twelve-original-door" : enteredStair?.id ?? null,
      relocation,
      flicker: 0.94 + Math.sin(elapsed * 0.7) * 0.015,
      lightState: "OVEREXPOSED",
      pickups: [],
      entities: [],
      focusInteraction: closestInteraction(
        getFocusedInteraction(camera, playerPosition, [doorSpot, chairSpot]),
        progression.chairCompleted ? localRelocations.inspect(playerPosition) : null,
        stairExit.inspect(playerPosition),
      ),
      screenEffects: {
        static: Math.max(censor * 0.62, relocationFlash > 0 ? 0.9 : 0),
        whiteout: Math.max(censor * 0.18, relocationFlash),
        desaturation: Math.min(1, censor * 0.9 + (relocationFlash > 0 ? 0.6 : 0)),
        testCard: relocationFlash > 0.38,
      },
      statusText: progression.doorOpened
        ? "THE ORIGINAL DOOR IS OPEN"
        : progression.chairWatching ? `MEMORY CALIBRATION ${Math.round((progression.chairTimer / 8) * 100)}%`
          : progression.chairCompleted && !progression.copycatCompleted ? "FIND THE COPYCAT DOOR"
            : progression.copycatCompleted ? "RETURN TO THE ORIGINAL DOOR"
              : copycatDistance < 12 ? "THE DOOR DOES NOT REMEMBER YOU" : "MATRIX",
    };
  }

  function interact(playerPosition) {
    const candidates = [
      { id: doorSpot.id, distance: Math.hypot(playerPosition.x - props.exitPosition.x, playerPosition.z - props.exitPosition.z), run: () => doorSpot.interact(playerPosition) },
      { id: chairSpot.id, distance: Math.hypot(playerPosition.x - props.chairPosition.x, playerPosition.z - props.chairPosition.z), run: () => chairSpot.interact(playerPosition) },
      ...(progression.chairCompleted ? [{ id: "level-twelve-copycat-door", distance: Math.hypot(playerPosition.x - props.copycatPosition.x, playerPosition.z - props.copycatPosition.z), run: () => localRelocations.interact(playerPosition) }] : []),
    ].sort((a, b) => a.distance - b.distance);
    return candidates.find((candidate) => candidate.distance <= 3)?.run() ?? { interacted: false };
  }

  return {
    level: 12,
    levelLabel: "LEVEL 12",
    levelName: "MATRIX",
    scene,
    camera,
    spawn,
    targetPosition: props.stairPosition,
    nextLevel: null,
    exitMode: "network",
    isWalkable,
    getFootstepSurface: () => "concrete",
    get viewModelName() { return getViewModelName(viewModel); },
    update,
    interact,
    getSnapshot: () => ({
      pickups: {},
      interactions: {
        ...stairExit.getState(),
        ...localRelocations.getState(),
        [doorSpot.id]: doorSpot.getState(),
        [chairSpot.id]: chairSpot.getState(),
      },
      objectives: { reached: objectiveReached },
      entities: [],
    }),
  };
}
