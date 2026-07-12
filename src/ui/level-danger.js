import { LEVEL_DANGER_TEXT } from "./text.js";

export function getLevelDangerInfo(levelOrInfo, language, getLevelInfo) {
  const info = typeof levelOrInfo === "object" ? levelOrInfo : getLevelInfo?.(levelOrInfo);
  const danger = info?.danger ?? "minimal";
  return {
    danger,
    text: LEVEL_DANGER_TEXT[language]?.[danger] ?? LEVEL_DANGER_TEXT.en[danger],
  };
}

export function setLevelDangerIndicator(
  element,
  levelOrInfo,
  { hidden = false, language = "en", getLevelInfo } = {},
) {
  if (!element) return;
  const { danger, text } = getLevelDangerInfo(levelOrInfo, language, getLevelInfo);
  element.textContent = text;
  element.dataset.danger = danger;
  element.toggleAttribute("hidden", hidden);
}
