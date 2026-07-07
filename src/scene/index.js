import { createLevelZeroScene } from "./level-zero/index.js";
import { createLevelOneScene } from "./level-one/index.js";
import { createLevelTwoScene } from "./level-two/index.js";
import { createLevelThreeScene } from "./level-three/index.js";
import { createLevelFourScene } from "./level-four/index.js";
import { createLevelFiveScene } from "./level-five/index.js";
import { getBackroomsLevelInfo } from "./constants.js";

export function createBackroomsScene(level = 0, { initialState = null } = {}) {
  const levelInfo = getBackroomsLevelInfo(level);
  const options = { initialState };
  if (levelInfo.level === 1) return createLevelOneScene(options);
  if (levelInfo.level === 2) return createLevelTwoScene(options);
  if (levelInfo.level === 3) return createLevelThreeScene(options);
  if (levelInfo.level === 4) return createLevelFourScene(options);
  if (levelInfo.level === 5) return createLevelFiveScene(options);
  return createLevelZeroScene(options);
}

export { getBackroomsLevelInfo } from "./constants.js";
