import { createLevelZeroScene } from "./level-zero/index.js";
import { createLevelOneScene } from "./level-one/index.js";
import { createLevelTwoScene } from "./level-two/index.js";
import { createLevelThreeScene } from "./level-three/index.js";
import { createLevelFourScene } from "./level-four/index.js";

export function createBackroomsScene(level = 0) {
  if (level === 1) return createLevelOneScene();
  if (level === 2) return createLevelTwoScene();
  if (level === 3) return createLevelThreeScene();
  if (level === 4) return createLevelFourScene();
  return createLevelZeroScene();
}

export { getBackroomsLevelInfo } from "./constants.js";