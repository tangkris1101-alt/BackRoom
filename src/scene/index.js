import { getBackroomsLevelInfo, HUB_LEVEL } from "./constants.js";

export async function createBackroomsScene(level = 0, { initialState = null } = {}) {
  const levelInfo = getBackroomsLevelInfo(level);
  const options = { initialState };
  if (levelInfo.level === 1) return (await import("./level-one/index.js")).createLevelOneScene(options);
  if (levelInfo.level === 2) return (await import("./level-two/index.js")).createLevelTwoScene(options);
  if (levelInfo.level === 3) return (await import("./level-three/index.js")).createLevelThreeScene(options);
  if (levelInfo.level === 4) return (await import("./level-four/index.js")).createLevelFourScene(options);
  if (levelInfo.level === 5) return (await import("./level-five/index.js")).createLevelFiveScene(options);
  if (levelInfo.level === 6) return (await import("./level-six/index.js")).createLevelSixScene(options);
  if (levelInfo.level === 7) return (await import("./level-seven/index.js")).createLevelSevenScene(options);
  if (levelInfo.level === 8) return (await import("./level-eight/index.js")).createLevelEightScene(options);
  if (levelInfo.level === 37) return (await import("./level-thirty-seven/index.js")).createLevelThirtySevenScene(options);
  if (levelInfo.level === HUB_LEVEL) return (await import("./hub/index.js")).createHubScene(options);
  return (await import("./level-zero/index.js")).createLevelZeroScene(options);
}

export { getBackroomsLevelInfo } from "./constants.js";
