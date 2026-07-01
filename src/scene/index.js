import { createLevelZeroScene } from "./level-zero/index.js";
import { createLevelOneScene } from "./level-one/index.js";
import { createLevelTwoScene } from "./level-two/index.js";
import { createLevelThreeScene } from "./level-three/index.js";
import { createLevelFourScene } from "./level-four/index.js";
import { getBackroomsLevelInfo } from "./constants.js";

export function createBackroomsScene(level = 0) {
  const levelInfo = getBackroomsLevelInfo(level);
  if (levelInfo.level === 1) return createLevelOneScene();
  if (levelInfo.level === 2) return createLevelTwoScene();
  if (levelInfo.level === 3) return createLevelThreeScene();
  if (levelInfo.level === 4) return createLevelFourScene();
  return createLevelZeroScene();
}

export { getBackroomsLevelInfo } from "./constants.js";