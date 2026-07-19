import { createLevelZeroScene } from "./level-zero/index.js";
import { createLevelOneScene } from "./level-one/index.js";
import { createLevelTwoScene } from "./level-two/index.js";
import { createLevelThreeScene } from "./level-three/index.js";
import { createLevelFourScene } from "./level-four/index.js";
import { createLevelFiveScene } from "./level-five/index.js";
import { createLevelSixScene } from "./level-six/index.js";
import { createLevelSevenScene } from "./level-seven/index.js";
import { createLevelEightScene } from "./level-eight/index.js";
import { createLevelThirtySevenScene } from "./level-thirty-seven/index.js";
import { createHubScene } from "./hub/index.js";
import { getBackroomsLevelInfo, HUB_LEVEL } from "./constants.js";

export function createBackroomsScene(level = 0, { initialState = null } = {}) {
  const levelInfo = getBackroomsLevelInfo(level);
  const options = { initialState };
  if (levelInfo.level === 1) return createLevelOneScene(options);
  if (levelInfo.level === 2) return createLevelTwoScene(options);
  if (levelInfo.level === 3) return createLevelThreeScene(options);
  if (levelInfo.level === 4) return createLevelFourScene(options);
  if (levelInfo.level === 5) return createLevelFiveScene(options);
  if (levelInfo.level === 6) return createLevelSixScene(options);
  if (levelInfo.level === 7) return createLevelSevenScene(options);
  if (levelInfo.level === 8) return createLevelEightScene(options);
  if (levelInfo.level === 37) return createLevelThirtySevenScene(options);
  if (levelInfo.level === HUB_LEVEL) return createHubScene(options);
  return createLevelZeroScene(options);
}

export { getBackroomsLevelInfo } from "./constants.js";
