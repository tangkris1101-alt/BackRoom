import { getBackroomsLevelInfo, HUB_LEVEL } from "./constants.js";

const LEVEL_SCENE_LOADERS = new Map([
  [0, [() => import("./level-zero/index.js"), "createLevelZeroScene"]],
  [1, [() => import("./level-one/index.js"), "createLevelOneScene"]],
  [2, [() => import("./level-two/index.js"), "createLevelTwoScene"]],
  [3, [() => import("./level-three/index.js"), "createLevelThreeScene"]],
  [4, [() => import("./level-four/index.js"), "createLevelFourScene"]],
  [5, [() => import("./level-five/index.js"), "createLevelFiveScene"]],
  [6, [() => import("./level-six/index.js"), "createLevelSixScene"]],
  [7, [() => import("./level-seven/index.js"), "createLevelSevenScene"]],
  [8, [() => import("./level-eight/index.js"), "createLevelEightScene"]],
  [9, [() => import("./level-nine/index.js"), "createLevelNineScene"]],
  [37, [() => import("./level-thirty-seven/index.js"), "createLevelThirtySevenScene"]],
  [HUB_LEVEL, [() => import("./hub/index.js"), "createHubScene"]],
]);

function getLevelSceneLoader(level) {
  return LEVEL_SCENE_LOADERS.get(level) ?? LEVEL_SCENE_LOADERS.get(0);
}

export async function createBackroomsScene(level = 0, { initialState = null, entryContext = null } = {}) {
  const levelInfo = getBackroomsLevelInfo(level);
  const [importScene, factoryName] = getLevelSceneLoader(levelInfo.level);
  const sceneModule = await importScene();
  return sceneModule[factoryName]({ initialState, entryContext });
}

export function preloadLevelScene(level = 0) {
  const levelInfo = getBackroomsLevelInfo(level);
  const [importScene] = getLevelSceneLoader(levelInfo.level);
  return importScene().catch(() => {});
}

export { getBackroomsLevelInfo } from "./constants.js";
