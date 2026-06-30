import * as THREE from "three";
import "./styles.css";
import { createAmbientHum } from "./ambient-audio.js";
import { createBackroomsScene, getBackroomsLevelInfo } from "./scene.js";
import { FirstPersonControls } from "./first-person-controls.js";

const canvas = document.querySelector("#scene");
const joystick = document.querySelector("#joystick");
const jumpButton = document.querySelector("#jump-button");
const useButton = document.querySelector("#use-button");
const actionButton = document.querySelector("#action-button");
const flashlightButton = document.querySelector("#flashlight-button");
const detectorButton = document.querySelector("#detector-button");
const pauseButton = document.querySelector("#pause-button");
const statusText = document.querySelector("#status-text");
const levelSelect = document.querySelector("#level-select");
const languageSelect = document.querySelector("#language-select");
const distanceReadout = document.querySelector("#distance-readout");
const lightReadout = document.querySelector("#light-readout");
const fpsReadout = document.querySelector("#fps-readout");
const hud = document.querySelector(".hud");
const staminaMeter = document.querySelector(".stamina-meter");
const staminaFill = document.querySelector("#stamina-fill");
const staminaReadout = document.querySelector("#stamina-readout");
const flashlightMeter = document.querySelector("#flashlight-meter");
const flashlightFill = document.querySelector("#flashlight-fill");
const flashlightReadout = document.querySelector("#flashlight-readout");
const detectorMeter = document.querySelector("#detector-meter");
const detectorFill = document.querySelector("#detector-fill");
const detectorReadout = document.querySelector("#detector-readout");
const drinkingMeter = document.querySelector("#drinking-meter");
const drinkingFill = document.querySelector("#drinking-fill");
const drinkingReadout = document.querySelector("#drinking-readout");
const loadingOverlay = document.querySelector("#loading-overlay");
const loadingFill = document.querySelector("#loading-fill");
const loadingStatus = document.querySelector("#loading-status");
const exitOverlay = document.querySelector("#exit-overlay");
const exitOverlayTitle = exitOverlay?.querySelector("strong");
const exitOverlaySubtitle = exitOverlay?.querySelector("span");
const loadingLevelLabel = loadingOverlay?.querySelector(".loading-overlay__panel span");
const itemInfo = document.querySelector("#item-info");
const itemInfoName = document.querySelector("#item-info-name");
const itemInfoEffect = document.querySelector("#item-info-effect");
const itemInfoAction = document.querySelector("#item-info-action");
const buffList = document.querySelector("#buff-list");
const entityMarkers = document.querySelector("#entity-markers");
const pauseOverlay = document.querySelector("#pause-overlay");
const pauseTitle = document.querySelector("#pause-title");
const pauseSubtitle = document.querySelector("#pause-subtitle");
const inventoryBar = document.querySelector("#inventory-bar");
const inventorySlots = document.querySelector("#inventory-slots");
const inventoryPrev = document.querySelector("#inventory-prev");
const inventoryNext = document.querySelector("#inventory-next");

const MAX_PIXEL_RATIO = 1.25;
const MIN_PIXEL_RATIO = 0.75;
const FPS_SAMPLE_INTERVAL = 0.75;
const FPS_LOW_THRESHOLD = 48;
const FPS_HIGH_THRESHOLD = 58;
const OVERLAY_FADE_MS = 460;
const LEVEL_TRANSITION_MS = 1250;
const FLASHLIGHT_BATTERY_MAX = 100;
const FLASHLIGHT_DRAIN_RATE = 4.2;
const DETECTOR_SCAN_DURATION = 5;
const DETECTOR_COOLDOWN_DURATION = 60;
const DETECTOR_RANGE = 72;
const LANGUAGE_STORAGE_KEY = "backrooms-language";
const ALMOND_WATER_DURATION = 45;
const SUPER_ALMOND_WATER_DURATION = 25;
const ALMOND_WATER_STAMINA_BONUS = 50;
const ALMOND_WATER_DRINK_DURATION = 1.0;

const ITEM_TEXT = {
  "zh-CN": {
    "almond-water": {
      name: "杏仁水",
      effect: "+50 疾跑上限 / 45秒",
      action: "F / 按钮拾取并饮用",
    },
    "super-almond-water": {
      name: "超级杏仁水",
      effect: "体力上限 250 / 恢复速度 x2",
      action: "F / 按钮拾取并饮用",
    },
    flashlight: {
      name: "手电筒",
      effect: "照亮前方 / 电量有限",
      action: "F / 按钮拾取 · 拾取后按 E 开关",
    },
    detector: {
      name: "实体探测仪",
      effect: "标记大范围实体 / 5秒扫描",
      action: "F / 按钮拾取 · 拾取后按 R 扫描",
    },
  },
  en: {
    "almond-water": {
      name: "ALMOND WATER",
      effect: "+50 STAMINA CAPACITY / 45s",
      action: "F / BUTTON PICK UP",
    },
    "super-almond-water": {
      name: "SUPER ALMOND WATER",
      effect: "250 STAMINA CAP / RECOVERY x2",
      action: "F / BUTTON DRINK",
    },
    flashlight: {
      name: "FLASHLIGHT",
      effect: "FORWARD BEAM / LIMITED BATTERY",
      action: "F / BUTTON PICK UP · E TO TOGGLE AFTER PICKUP",
    },
    detector: {
      name: "ENTITY DETECTOR",
      effect: "WIDE ENTITY PING / 5s SCAN",
      action: "F / BUTTON PICK UP · R TO SCAN AFTER PICKUP",
    },
  },
};

const BUFF_TEXT = {
  "zh-CN": {
    "almond-water": {
      name: "杏仁水",
      detail: "+50 体力上限",
    },
    "super-almond-water": {
      name: "超级杏仁水",
      detail: "体力上限 250 · 恢复 x2",
    },
  },
  en: {
    "almond-water": {
      name: "ALMOND WATER",
      detail: "+50 STAMINA CAP",
    },
    "super-almond-water": {
      name: "SUPER ALMOND WATER",
      detail: "250 STAMINA CAP · RECOVERY x2",
    },
  },
};

const STATUS_TEXT = {
  "zh-CN": {
    "almond-water": "杏仁水",
    "super-almond-water": "超级杏仁水",
    flashlight: "手电筒",
    detector: "探测仪",
    flashlightAcquired: "已获得手电筒",
    flashlightRefilled: "手电筒电量已满",
    detectorAcquired: "探测仪已激活",
    detectorReady: "就绪",
    detectorReadyHint: "按 E 使用",
    detectorScan: "扫描 {seconds}秒",
    detectorCharge: "充能 {seconds}秒",
    bacteriaMarker: "细菌实体",
    bacteriaFailTitle: "失联",
    bacteriaFailSubtitle: "接触细菌实体",
    superBacteriaMarker: "超级细菌",
    superBacteriaFailSubtitle: "接触超级细菌实体",
    almondWaterUsed: "杏仁水 {seconds}秒",
    superAlmondWaterUsed: "超级杏仁水 {seconds}秒",
    almondWaterDrinking: "饮用中",
    almondWaterCancelled: "饮用取消",
    pauseTitle: "已暂停",
    pauseSubtitle: "按 ESC 或点击继续",
    inventoryHint: "← → 切换 / E 使用",
    inventoryEmpty: "背包为空",
    pickupEmpty: "无物品可拾取",
  },
  en: {
    "almond-water": "ALMOND WATER",
    "super-almond-water": "SUPER ALMOND WATER",
    flashlight: "FLASHLIGHT",
    detector: "DETECTOR",
    flashlightAcquired: "FLASHLIGHT ACQUIRED",
    flashlightRefilled: "FLASHLIGHT BATTERY FULL",
    detectorAcquired: "DETECTOR ONLINE",
    detectorReady: "READY",
    detectorReadyHint: "PRESS E TO USE",
    detectorScan: "SCAN {seconds}s",
    detectorCharge: "CHARGE {seconds}s",
    bacteriaMarker: "BACTERIA",
    bacteriaFailTitle: "SIGNAL LOST",
    bacteriaFailSubtitle: "BACTERIA CONTACT",
    superBacteriaMarker: "SUPER BACTERIA",
    superBacteriaFailSubtitle: "SUPER BACTERIA CONTACT",
    almondWaterUsed: "ALMOND WATER {seconds}s",
    superAlmondWaterUsed: "SUPER ALMOND WATER {seconds}s",
    almondWaterDrinking: "DRINKING",
    almondWaterCancelled: "DRINK CANCELLED",
    pauseTitle: "PAUSED",
    pauseSubtitle: "ESC / TAP TO RESUME",
    inventoryHint: "← → SWITCH / E USE",
    inventoryEmpty: "INVENTORY EMPTY",
    pickupEmpty: "NO ITEM IN RANGE",
  },
};

[hud, joystick, jumpButton, useButton, actionButton, flashlightButton, detectorButton, pauseButton, loadingOverlay].forEach((element) => {
  element?.removeAttribute("hidden");
});
exitOverlay?.setAttribute("hidden", "");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
let renderPixelRatio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
renderer.setPixelRatio(renderPixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;

const flashlightLight = new THREE.SpotLight(0xfff2c5, 0, 46, 0.5, 0.72, 1.68);
flashlightLight.position.set(0.18, -0.12, -0.16);
flashlightLight.name = "player-flashlight";
const flashlightTarget = new THREE.Object3D();
flashlightTarget.position.set(0, -0.16, -1);

function getInitialLevel() {
  const level = Number(new URLSearchParams(window.location.search).get("level"));
  return getBackroomsLevelInfo(level).level;
}

let world = createBackroomsScene(getInitialLevel());
function attachFlashlightToCamera(camera) {
  camera.add(flashlightLight);
  camera.add(flashlightTarget);
  flashlightLight.target = flashlightTarget;
}

attachFlashlightToCamera(world.camera);
const controls = new FirstPersonControls({
  camera: world.camera,
  canvas,
  joystick,
  jumpButton,
  isWalkable: world.isWalkable,
  spawn: world.spawn,
});
const ambientHum = createAmbientHum();

const clock = new THREE.Clock();

controls.notifyDrinkComplete = (itemId) => {
  if (itemId === "almond-water" || itemId === "super-almond-water") {
    removeInventory(itemId);
    renderInventoryBar();
  }
};
let frameCount = 0;
let sampleFrameCount = 0;
let sampleElapsed = 0;
let displayedFps = 0;
let loadingComplete = false;
let exitComplete = false;
let gameFailed = false;
let levelTransition = null;
let pickupFlashUntil = 0;
let pickupFlashText = "";
let flashlightOwned = false;
let flashlightOn = false;
let flashlightBattery = 0;
let detectorOwned = false;
let detectorActiveTimer = 0;
let detectorCooldownTimer = 0;
let currentLanguage = "zh-CN";
const detectorProjection = new THREE.Vector3();

const INVENTORY_DEFS = {
  flashlight: { id: "flashlight", type: "toggle", unique: true, stackable: false },
  detector: { id: "detector", type: "scan", unique: true, stackable: false },
  "almond-water": { id: "almond-water", type: "consumable", unique: false, stackable: true },
  "super-almond-water": {
    id: "super-almond-water",
    type: "consumable",
    unique: false,
    stackable: true,
  },
};
const inventory = [];
let equippedIndex = -1;
let lastDrinkCancelled = false;
let lastDrinkCompletedItemId = null;
let isPaused = false;
let pauseAccumulatedDelta = 0;

try {
  const savedLanguage = window.localStorage?.getItem(LANGUAGE_STORAGE_KEY);
  if (savedLanguage === "zh-CN" || savedLanguage === "en") currentLanguage = savedLanguage;
} catch {
  currentLanguage = "zh-CN";
}

if (languageSelect) languageSelect.value = currentLanguage;
document.documentElement.lang = currentLanguage;
canvas.dataset.language = currentLanguage;

function getLocalizedText(collection, id) {
  return collection[currentLanguage]?.[id] ?? collection.en?.[id] ?? collection["zh-CN"]?.[id] ?? {};
}

function findInventoryIndex(id) {
  return inventory.findIndex((entry) => entry.id === id);
}

function getInventoryCount(id) {
  const entry = inventory[findInventoryIndex(id)];
  return entry ? entry.count : 0;
}

function addInventory(id, { silent = false } = {}) {
  const def = INVENTORY_DEFS[id];
  if (!def) return false;
  const existing = inventory[findInventoryIndex(id)];
  if (existing) {
    if (def.stackable) existing.count += 1;
    return true;
  }
  inventory.push({ id, count: def.unique ? 1 : 1, type: def.type });
  equippedIndex = inventory.length - 1;
  return true;
}

function removeInventory(id) {
  const index = findInventoryIndex(id);
  if (index === -1) return false;
  inventory[index].count -= 1;
  if (inventory[index].count <= 0) {
    inventory.splice(index, 1);
    if (inventory.length === 0) {
      equippedIndex = -1;
    } else if (equippedIndex >= inventory.length) {
      equippedIndex = inventory.length - 1;
    } else if (equippedIndex > index) {
      equippedIndex -= 1;
    }
  }
  return true;
}

function cycleInventory(direction) {
  if (inventory.length === 0) {
    equippedIndex = -1;
    return;
  }
  equippedIndex = (equippedIndex + direction + inventory.length) % inventory.length;
}

function getEquipped() {
  return equippedIndex >= 0 ? inventory[equippedIndex] : null;
}

function formatLocalizedStatus(id, values = {}) {
  const template = getLocalizedText(STATUS_TEXT, id);
  if (typeof template !== "string") return String(id);
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}

function syncLevelHud() {
  if (levelSelect) levelSelect.value = String(world.level);
  if (loadingLevelLabel) loadingLevelLabel.textContent = world.levelLabel;
  canvas.dataset.level = String(world.level);
  canvas.dataset.levelName = world.levelName;
  canvas.dataset.viewModel = world.viewModelName ?? "NONE";
  canvas.dataset.colliderCount = String(world.colliderCount ?? 0);
}

function disposeMaterial(material) {
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }
  Object.values(material).forEach((value) => {
    if (value?.isTexture) value.dispose();
  });
  material.dispose();
}

function disposeWorld(previousWorld) {
  previousWorld.scene.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) disposeMaterial(object.material);
  });
}

function updateLevelUrl(level) {
  const url = new URL(window.location.href);
  url.searchParams.set("level", String(level));
  window.history.replaceState(null, "", url);
}

function loadLevel(level, { updateUrl = false } = {}) {
  const previousWorld = world;
  world = createBackroomsScene(level);
  attachFlashlightToCamera(world.camera);
  controls.setWorld({
    camera: world.camera,
    isWalkable: world.isWalkable,
    spawn: world.spawn,
  });
  exitComplete = false;
  gameFailed = false;
  canvas.dataset.exitReached = "false";
  canvas.dataset.gameFailed = "false";
  entityMarkers?.replaceChildren();
  syncLevelHud();
  if (updateUrl) updateLevelUrl(world.level);
  resize();
  disposeWorld(previousWorld);
}

function setExitOverlayText(title, subtitle) {
  if (exitOverlayTitle) exitOverlayTitle.textContent = title;
  if (exitOverlaySubtitle) exitOverlaySubtitle.textContent = subtitle;
}

function showExitOverlay(title, subtitle) {
  setExitOverlayText(title, subtitle);
  exitOverlay?.removeAttribute("hidden");
  exitOverlay?.classList.add("is-visible");
}

function hideExitOverlay() {
  exitOverlay?.classList.remove("is-visible");
  window.setTimeout(() => exitOverlay?.setAttribute("hidden", ""), OVERLAY_FADE_MS);
}

function beginLevelTransition(nextLevel) {
  const nextLevelInfo = getBackroomsLevelInfo(nextLevel);
  levelTransition = {
    nextLevel: nextLevelInfo.level,
    elapsed: 0,
  };
  canvas.dataset.transitioning = "true";
  canvas.dataset.exitReached = "true";
  showExitOverlay(nextLevelInfo.levelLabel, nextLevelInfo.levelName);
}

function updateLevelTransition(delta) {
  if (!levelTransition) return;
  levelTransition.elapsed += delta * 1000;
  if (levelTransition.elapsed < LEVEL_TRANSITION_MS) return;

  const nextLevel = levelTransition.nextLevel;
  levelTransition = null;
  loadLevel(nextLevel, { updateUrl: true });
  canvas.dataset.transitioning = "false";
  canvas.dataset.exitReached = "false";
  hideExitOverlay();
}

levelSelect?.addEventListener("change", () => {
  const nextLevel = Number(levelSelect.value);
  if (nextLevel === world.level) return;
  levelTransition = null;
  exitComplete = false;
  gameFailed = false;
  canvas.dataset.transitioning = "false";
  canvas.dataset.exitReached = "false";
  canvas.dataset.gameFailed = "false";
  hideExitOverlay();
  loadLevel(nextLevel, { updateUrl: true });
});

languageSelect?.addEventListener("change", () => {
  const nextLanguage = languageSelect.value === "en" ? "en" : "zh-CN";
  currentLanguage = nextLanguage;
  document.documentElement.lang = nextLanguage;
  canvas.dataset.language = nextLanguage;
  updateBuffCards(controls.getState());
  updateDetectorHud();
  if (isPaused) {
    if (pauseTitle) pauseTitle.textContent = formatLocalizedStatus("pauseTitle");
    if (pauseSubtitle) pauseSubtitle.textContent = formatLocalizedStatus("pauseSubtitle");
  }
  try {
    window.localStorage?.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  } catch {
    // Language fallback is non-critical.
  }
});

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  world.camera.aspect = width / height;
  world.camera.updateProjectionMatrix();
}

function setRenderPixelRatio(nextPixelRatio) {
  const clamped = Math.max(
    MIN_PIXEL_RATIO,
    Math.min(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO), nextPixelRatio),
  );
  if (Math.abs(clamped - renderPixelRatio) < 0.01) return;
  renderPixelRatio = clamped;
  renderer.setPixelRatio(renderPixelRatio);
  resize();
}

function updatePerformanceReadout(delta) {
  sampleFrameCount += 1;
  sampleElapsed += delta;
  if (sampleElapsed < FPS_SAMPLE_INTERVAL) return;

  displayedFps = Math.round(sampleFrameCount / sampleElapsed);
  if (displayedFps < FPS_LOW_THRESHOLD) {
    setRenderPixelRatio(renderPixelRatio - 0.1);
  } else if (displayedFps > FPS_HIGH_THRESHOLD) {
    setRenderPixelRatio(renderPixelRatio + 0.05);
  }

  fpsReadout.textContent = `${displayedFps} FPS`;
  fpsReadout.dataset.quality = renderPixelRatio < 1 ? "LOW" : "HIGH";
  canvas.dataset.fps = String(displayedFps);
  canvas.dataset.pixelRatio = renderPixelRatio.toFixed(2);
  sampleFrameCount = 0;
  sampleElapsed = 0;
}

function updateLoadingOverlay() {
  if (loadingComplete) return;
  const progress = Math.min(1, 0.18 + frameCount / 42);
  if (loadingFill) loadingFill.style.transform = `scaleX(${progress.toFixed(3)})`;
  if (loadingStatus) {
    loadingStatus.textContent = progress > 0.7 ? "SIGNAL LOCK" : "NOCLIP SYNC";
  }
  if (progress >= 1 && canvas.dataset.sceneReady === "true") {
    loadingComplete = true;
    loadingOverlay?.classList.add("is-hidden");
    window.setTimeout(() => loadingOverlay?.setAttribute("hidden", ""), OVERLAY_FADE_MS);
  }
}

function updateStaminaHud(controlState) {
  if (!controlState) return;
  const staminaRatio = Math.max(0, Math.min(1, controlState.stamina / controlState.staminaMax));
  const activeBuffs = controlState.activeBuffs ?? [];
  const staminaBuff = activeBuffs.find((buff) =>
    buff.id === "almond-water" || buff.id === "super-almond-water"
  );
  const boostRemaining = Math.max(0, staminaBuff?.remaining ?? 0);
  const hasBoost = Boolean(staminaBuff);
  if (staminaFill) staminaFill.style.transform = `scaleX(${staminaRatio.toFixed(3)})`;
  if (staminaReadout) {
    const valueText = `${Math.round(controlState.stamina)}/${Math.round(controlState.staminaMax)}`;
    staminaReadout.textContent = hasBoost ? `${valueText} ${Math.ceil(boostRemaining)}s` : valueText;
  }
  staminaMeter?.dataset &&
    (staminaMeter.dataset.state = staminaRatio < 0.24 ? "low" : hasBoost ? "boosted" : "ready");
  canvas.dataset.stamina = String(Math.round(staminaRatio * 100));
  canvas.dataset.staminaValue = String(Math.round(controlState.stamina));
  canvas.dataset.staminaMax = String(Math.round(controlState.staminaMax));
  canvas.dataset.staminaBaseMax = String(Math.round(controlState.staminaBaseMax));
  canvas.dataset.almondWaterActive = String(hasBoost);
  canvas.dataset.almondWaterRemaining = boostRemaining.toFixed(1);
  canvas.dataset.superAlmondWaterActive = String(controlState.superAlmondWaterActive);
  canvas.dataset.superAlmondWaterRemaining = (controlState.superAlmondWaterRemaining ?? 0).toFixed(1);
  canvas.dataset.staminaRecoveryMultiplier = String(controlState.staminaRecoveryMultiplier ?? 1);
  canvas.dataset.activeBuffs = activeBuffs.map((buff) => buff.id).join(",");
  canvas.dataset.sprinting = String(controlState.sprinting);
}

function updateBuffCards(controlState) {
  if (!buffList) return;
  const buffs = controlState?.activeBuffs ?? [];
  buffList.hidden = buffs.length === 0;
  buffList.replaceChildren(
    ...buffs.map((buff) => {
      const localized = getLocalizedText(BUFF_TEXT, buff.id);
      const card = document.createElement("div");
      card.className = "buff-card";
      card.dataset.buff = buff.id;

      const top = document.createElement("div");
      top.className = "buff-card__top";
      const name = document.createElement("span");
      name.className = "buff-card__name";
      name.textContent = localized.name ?? buff.id;
      const time = document.createElement("span");
      time.className = "buff-card__time";
      time.textContent = `${Math.ceil(Math.max(0, buff.remaining))}s`;
      top.append(name, time);

      const detail = document.createElement("strong");
      detail.className = "buff-card__detail";
      detail.textContent = localized.detail ?? "";

      const bar = document.createElement("div");
      bar.className = "buff-card__bar";
      const fill = document.createElement("div");
      fill.className = "buff-card__fill";
      const ratio = buff.duration > 0 ? Math.max(0, Math.min(1, buff.remaining / buff.duration)) : 0;
      fill.style.transform = `scaleX(${ratio.toFixed(3)})`;
      bar.append(fill);

      card.append(top, detail, bar);
      return card;
    }),
  );
}

function updateFlashlightHud() {
  const ratio = FLASHLIGHT_BATTERY_MAX > 0 ? flashlightBattery / FLASHLIGHT_BATTERY_MAX : 0;
  if (flashlightMeter) {
    flashlightMeter.hidden = !flashlightOwned;
    flashlightMeter.dataset.state = ratio < 0.18 ? "low" : flashlightOn ? "on" : "ready";
  }
  if (flashlightFill) flashlightFill.style.transform = `scaleX(${Math.max(0, ratio).toFixed(3)})`;
  if (flashlightReadout) flashlightReadout.textContent = flashlightOwned ? `${Math.round(flashlightBattery)}%` : "--";
  if (flashlightButton) {
    flashlightButton.classList.toggle("is-visible", flashlightOwned);
    flashlightButton.classList.toggle("is-active", flashlightOn);
    flashlightButton.disabled = !flashlightOwned || flashlightBattery <= 0;
  }
  canvas.dataset.flashlightOwned = String(flashlightOwned);
  canvas.dataset.flashlightOn = String(flashlightOn);
  canvas.dataset.flashlightBattery = String(Math.round(flashlightBattery));
}

function updateFlashlight(delta) {
  if (flashlightOn) {
    flashlightBattery = Math.max(0, flashlightBattery - FLASHLIGHT_DRAIN_RATE * delta);
    if (flashlightBattery <= 0) flashlightOn = false;
  }

  const ratio = FLASHLIGHT_BATTERY_MAX > 0 ? flashlightBattery / FLASHLIGHT_BATTERY_MAX : 0;
  flashlightLight.intensity = flashlightOwned && flashlightOn && flashlightBattery > 0 ? 22.8 * Math.max(0.46, ratio) : 0;
  flashlightLight.distance = 28 + ratio * 24;
  updateFlashlightHud();
}

function toggleFlashlight() {
  if (!flashlightOwned || flashlightBattery <= 0) return;
  flashlightOn = !flashlightOn;
  updateFlashlightHud();
}

function updateDetectorHud() {
  if (detectorMeter) {
    detectorMeter.hidden = !detectorOwned;
    detectorMeter.dataset.state =
      detectorActiveTimer > 0 ? "active" : detectorCooldownTimer > 0 ? "cooldown" : "ready";
  }

  let ratio = 1;
  if (detectorActiveTimer > 0) {
    ratio = detectorActiveTimer / DETECTOR_SCAN_DURATION;
  } else if (detectorCooldownTimer > 0) {
    ratio = 1 - detectorCooldownTimer / DETECTOR_COOLDOWN_DURATION;
  }
  if (detectorFill) detectorFill.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio)).toFixed(3)})`;

  if (detectorReadout) {
    if (!detectorOwned) {
      detectorReadout.textContent = "--";
    } else if (detectorActiveTimer > 0) {
      detectorReadout.textContent = formatLocalizedStatus("detectorScan", {
        seconds: Math.ceil(detectorActiveTimer),
      });
    } else if (detectorCooldownTimer > 0) {
      detectorReadout.textContent = formatLocalizedStatus("detectorCharge", {
        seconds: Math.ceil(detectorCooldownTimer),
      });
    } else {
      detectorReadout.textContent = formatLocalizedStatus("detectorReady");
    }
  }

  if (detectorButton) {
    detectorButton.classList.toggle("is-visible", detectorOwned);
    detectorButton.classList.toggle("is-active", detectorActiveTimer > 0);
    detectorButton.disabled = !detectorOwned || detectorActiveTimer > 0 || detectorCooldownTimer > 0;
  }

  canvas.dataset.detectorOwned = String(detectorOwned);
  canvas.dataset.detectorActive = String(detectorActiveTimer > 0);
  canvas.dataset.detectorActiveRemaining = detectorActiveTimer.toFixed(1);
  canvas.dataset.detectorCooldown = detectorCooldownTimer.toFixed(1);
}

function clearEntityMarkers() {
  entityMarkers?.replaceChildren();
}

function updateEntityMarkers(metrics) {
  const entityList = metrics.entities ?? [];
  const nearestDistance = entityList
    .map((entity) => entity.distance)
    .filter(Number.isFinite)
    .sort((a, b) => a - b)[0];
  canvas.dataset.entityCount = String(entityList.length);
  canvas.dataset.nearestEntityDistance = Number.isFinite(nearestDistance)
    ? String(Math.round(nearestDistance * 10) / 10)
    : "";
  canvas.dataset.entityContact = String(Boolean(metrics.entityContact));

  if (!entityMarkers || !detectorOwned || detectorActiveTimer <= 0) {
    clearEntityMarkers();
    return;
  }

  const entities = entityList.filter(
    (entity) => entity?.active && Number.isFinite(entity.distance) && entity.distance <= DETECTOR_RANGE,
  );
  entityMarkers.replaceChildren(
    ...entities
      .map((entity) => {
        detectorProjection.set(entity.x, entity.y ?? 1.5, entity.z).project(world.camera);
        if (detectorProjection.z < -1 || detectorProjection.z > 1) return null;
        const x = (detectorProjection.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-detectorProjection.y * 0.5 + 0.5) * window.innerHeight;
        if (x < -80 || x > window.innerWidth + 80 || y < -80 || y > window.innerHeight + 80) return null;

        const marker = document.createElement("div");
        marker.className = "entity-marker";
        if (entity.id === "super-bacteria") marker.classList.add("entity-marker--super");
        const name = document.createElement("strong");
        name.textContent = formatLocalizedStatus(
          entity.id === "super-bacteria" ? "superBacteriaMarker" : "bacteriaMarker",
        );
        const distance = document.createElement("span");
        distance.textContent = `${Math.round(entity.distance)}m`;
        marker.style.left = `${x}px`;
        marker.style.top = `${y}px`;
        marker.append(name, distance);
        return marker;
      })
      .filter(Boolean),
  );
}

function startDetectorScan() {
  if (!detectorOwned || detectorActiveTimer > 0 || detectorCooldownTimer > 0) return;
  detectorActiveTimer = DETECTOR_SCAN_DURATION;
  detectorCooldownTimer = 0;
  updateDetectorHud();
}

function updateDetector(delta, metrics) {
  const wasActive = detectorActiveTimer > 0;
  if (detectorActiveTimer > 0) {
    detectorActiveTimer = Math.max(0, detectorActiveTimer - delta);
  } else if (detectorCooldownTimer > 0) {
    detectorCooldownTimer = Math.max(0, detectorCooldownTimer - delta);
  }
  if (wasActive && detectorActiveTimer === 0) {
    detectorCooldownTimer = DETECTOR_COOLDOWN_DURATION;
  }
  updateDetectorHud();
  updateEntityMarkers(metrics);
}

function renderInventoryBar() {
  if (!inventoryBar || !inventorySlots) return;
  const hasItems = inventory.length > 0;
  inventoryBar.classList.toggle("is-visible", true);
  inventoryBar.classList.toggle("is-empty", !hasItems);
  if (inventorySlots) {
    inventorySlots.dataset.emptyText = formatLocalizedStatus("inventoryEmpty");
  }
  if (!hasItems) {
    inventorySlots.replaceChildren();
    inventoryPrev?.setAttribute("hidden", "");
    inventoryNext?.setAttribute("hidden", "");
    updateActionButtonState();
    return;
  }
  inventoryPrev?.removeAttribute("hidden");
  inventoryNext?.removeAttribute("hidden");

  const fragment = document.createDocumentFragment();
  inventory.forEach((entry, index) => {
    const def = INVENTORY_DEFS[entry.id];
    const slot = document.createElement("div");
    slot.className = "inventory-slot";
    slot.dataset.type = entry.id;
    if (index === equippedIndex) slot.classList.add("is-equipped");

    const icon = document.createElement("div");
    icon.className = "inventory-slot__icon";
    slot.append(icon);

    if (def?.stackable && entry.count > 1) {
      const count = document.createElement("span");
      count.className = "inventory-slot__count";
      count.textContent = String(entry.count);
      slot.append(count);
    }

    fragment.append(slot);
  });
  inventorySlots.replaceChildren(fragment);
  updateActionButtonState();
}

function updateActionButtonState() {
  if (!actionButton) return;
  const equipped = getEquipped();
  const hasUsable = Boolean(equipped);
  actionButton.classList.toggle("is-visible", hasUsable);
  actionButton.disabled = !hasUsable;
}

function updateDrinkingMeter(controlState) {
  if (!drinkingMeter) return;
  const isDrinking = Boolean(controlState?.isDrinking);
  drinkingMeter.hidden = !isDrinking && !lastDrinkCancelled;
  drinkingMeter.dataset.state = isDrinking ? "active" : "cancelled";
  const progress = Math.max(0, Math.min(1, controlState?.drinkProgress ?? 0));
  if (drinkingFill) {
    drinkingFill.style.transform = isDrinking ? `scaleX(${progress.toFixed(3)})` : "scaleX(0)";
  }
  if (drinkingReadout) {
    if (isDrinking) {
      const remaining = Math.max(0, ALMOND_WATER_DRINK_DURATION - progress * ALMOND_WATER_DRINK_DURATION);
      drinkingReadout.textContent = `${remaining.toFixed(1)}s`;
    } else if (lastDrinkCancelled) {
      drinkingReadout.textContent = formatLocalizedStatus("almondWaterCancelled");
    } else {
      drinkingReadout.textContent = "--";
    }
  }
  if (lastDrinkCancelled && !isDrinking && clock.elapsedTime > lastDrinkCancelledUntil) {
    lastDrinkCancelled = false;
    drinkingMeter.hidden = true;
  }
}

let lastDrinkCancelledUntil = 0;

function setPauseState(next) {
  if (isPaused === next) return;
  isPaused = next;
  canvas.dataset.paused = String(isPaused);
  if (pauseOverlay) {
    pauseOverlay.classList.toggle("is-visible", isPaused);
    if (isPaused) pauseOverlay.removeAttribute("hidden");
  }
  if (pauseTitle) pauseTitle.textContent = formatLocalizedStatus("pauseTitle");
  if (pauseSubtitle) pauseSubtitle.textContent = formatLocalizedStatus("pauseSubtitle");
  if (isPaused) {
    pauseAccumulatedDelta = clock.getDelta();
    if (document.pointerLockElement === canvas && document.exitPointerLock) {
      try {
        document.exitPointerLock();
      } catch {
        // ignore
      }
    }
  } else {
    clock.getDelta();
  }
}

function acquireFlashlight(count) {
  const wasOwned = flashlightOwned;
  addInventory("flashlight");
  flashlightOwned = true;
  flashlightOn = false;
  flashlightBattery = FLASHLIGHT_BATTERY_MAX;
  pickupFlashText = formatLocalizedStatus(wasOwned ? "flashlightRefilled" : "flashlightAcquired");
  pickupFlashUntil = clock.elapsedTime + 1.7;
  canvas.dataset.flashlightPickups = String(count ?? 1);
  updateFlashlightHud();
  renderInventoryBar();
}

function acquireDetector(count) {
  const wasFirst = !detectorOwned;
  addInventory("detector");
  detectorOwned = true;
  pickupFlashText = formatLocalizedStatus(wasFirst ? "detectorAcquired" : "detectorReadyHint");
  pickupFlashUntil = clock.elapsedTime + 1.7;
  canvas.dataset.detectorPickups = String(count ?? 1);
  updateDetectorHud();
  renderInventoryBar();
}

function updatePickupHud(metrics) {
  const almondWater = metrics.almondWater;
  const superAlmondWater = metrics.superAlmondWater;
  const flashlight = metrics.flashlight;
  const detector = metrics.detector;
  const canDrink = Boolean(almondWater?.available);
  const canDrinkSuper = Boolean(superAlmondWater?.available);
  const canTakeFlashlight = Boolean(flashlight?.available);
  const canTakeDetector = Boolean(detector?.available);
  const canUse = canDrink || canDrinkSuper || canTakeFlashlight || canTakeDetector;
  useButton?.classList.toggle("is-visible", canUse);
  if (useButton) useButton.disabled = !canUse;
  canvas.dataset.almondWaterVisible = String(Boolean(almondWater?.visible));
  canvas.dataset.almondWaterAvailable = String(canDrink);
  canvas.dataset.almondWaterDistance = Number.isFinite(almondWater?.distance)
    ? String(Math.round(almondWater.distance))
    : "";
  canvas.dataset.superAlmondWaterVisible = String(Boolean(superAlmondWater?.visible));
  canvas.dataset.superAlmondWaterAvailable = String(canDrinkSuper);
  canvas.dataset.superAlmondWaterDistance = Number.isFinite(superAlmondWater?.distance)
    ? String(Math.round(superAlmondWater.distance))
    : "";
  canvas.dataset.flashlightVisible = String(Boolean(flashlight?.visible));
  canvas.dataset.flashlightAvailable = String(canTakeFlashlight);
  canvas.dataset.flashlightDistance = Number.isFinite(flashlight?.distance)
    ? String(Math.round(flashlight.distance))
    : "";
  canvas.dataset.detectorVisible = String(Boolean(detector?.visible));
  canvas.dataset.detectorAvailable = String(canTakeDetector);
  canvas.dataset.detectorDistance = Number.isFinite(detector?.distance)
    ? String(Math.round(detector.distance))
    : "";
}

function findNearestPickupable(metrics) {
  const candidates = [
    metrics.almondWater,
    metrics.superAlmondWater,
    metrics.flashlight,
    metrics.detector,
  ].filter((item) => item && Number.isFinite(item.distance) && item.available);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0];
}

function updateItemInfo(metrics) {
  const item = metrics.focusItem;
  const pickupable = findNearestPickupable(metrics);
  const hasFocus = Boolean(item);
  const canPickup = Boolean(pickupable);
  if (itemInfo) {
    if (hasFocus) itemInfo.hidden = false;
    itemInfo.classList.toggle("is-visible", hasFocus);
    itemInfo.classList.toggle("is-pickup-ready", canPickup);
    if (!hasFocus) itemInfo.hidden = true;
  }
  if (hasFocus) {
    const localized = getLocalizedText(ITEM_TEXT, item.id) ?? item;
    if (itemInfoName) itemInfoName.textContent = localized.name ?? item.name;
    if (itemInfoEffect) itemInfoEffect.textContent = localized.effect ?? item.effect;
    if (itemInfoAction) itemInfoAction.textContent = localized.action ?? item.action;
  }
  canvas.dataset.focusItem = hasFocus ? item.id : "";
  canvas.dataset.focusItemDistance = Number.isFinite(item?.distance)
    ? String(Math.round(item.distance * 10) / 10)
    : "";
  canvas.dataset.pickupAvailable = String(canPickup);
}

function showItemInfoPickupKey(show) {
  if (!itemInfo) return;
  const existing = itemInfo.querySelector(".item-info__pickup-key");
  if (!show) {
    existing?.remove();
    return;
  }
  if (existing) return;
  const key = document.createElement("span");
  key.className = "item-info__pickup-key";
  key.textContent = currentLanguage === "en" ? "F" : "F";
  itemInfo.prepend(key);
}

function flashPickupHint(textKey, durationMs = 1100) {
  pickupFlashText = formatLocalizedStatus(textKey);
  pickupFlashUntil = clock.elapsedTime + durationMs / 1000;
}

function usePickup() {
  if (exitComplete || levelTransition || isPaused) return;
  const pickup = world.tryPickup?.(world.camera.position);
  if (!pickup?.pickedUp) {
    flashPickupHint("pickupEmpty", 900);
    return;
  }

  if (pickup.itemId === "flashlight") {
    acquireFlashlight(pickup.count);
  } else if (pickup.itemId === "detector") {
    acquireDetector(pickup.count);
  } else if (pickup.itemId === "super-almond-water") {
    addInventory("super-almond-water");
    pickupFlashText = formatLocalizedStatus("superAlmondWaterUsed", {
      seconds: SUPER_ALMOND_WATER_DURATION,
    });
    pickupFlashUntil = clock.elapsedTime + 1.9;
    canvas.dataset.superAlmondWaterDrinks = String(pickup.count);
  } else if (pickup.itemId === "almond-water") {
    addInventory("almond-water");
    pickupFlashText = formatLocalizedStatus("almondWaterUsed", {
      seconds: ALMOND_WATER_DURATION,
    });
    pickupFlashUntil = clock.elapsedTime + 1.7;
    canvas.dataset.almondWaterDrinks = String(pickup.count);
  }

  useButton?.classList.add("is-active");
  window.setTimeout(() => useButton?.classList.remove("is-active"), 140);
  renderInventoryBar();
}

function useEquipped() {
  if (exitComplete || levelTransition || isPaused) return;
  const equipped = getEquipped();
  if (!equipped) return;

  if (equipped.id === "flashlight") {
    toggleFlashlight();
  } else if (equipped.id === "detector") {
    startDetectorScan();
  } else if (equipped.id === "almond-water") {
    const started = controls.startDrink("almond-water", { staminaBonus: ALMOND_WATER_STAMINA_BONUS });
    if (started) {
      actionButton?.classList.add("is-active");
      window.setTimeout(() => actionButton?.classList.remove("is-active"), 140);
    }
  } else if (equipped.id === "super-almond-water") {
    const started = controls.startDrink("super-almond-water");
    if (started) {
      actionButton?.classList.add("is-active");
      window.setTimeout(() => actionButton?.classList.remove("is-active"), 140);
    }
  }
}

function updateHud(metrics, controlState, elapsed) {
  distanceReadout.textContent = `${metrics.exitDistance}m`;
  lightReadout.textContent = metrics.lightState ?? (metrics.flicker < 0.62 ? "DIM" : "HUM");
  statusText.textContent =
    elapsed < pickupFlashUntil
      ? pickupFlashText
      : metrics.superAlmondWater?.available
        ? formatLocalizedStatus("super-almond-water")
        : metrics.detector?.available
        ? formatLocalizedStatus("detector")
        : metrics.flashlight?.available
        ? formatLocalizedStatus("flashlight")
        : metrics.almondWater?.available
        ? formatLocalizedStatus("almond-water")
        : metrics.statusText ??
          (metrics.exitReached
            ? "EXIT STABILIZED"
            : metrics.exitDistance < 7
              ? "SIGNAL FOUND"
              : "NO SIGNAL");
  updatePickupHud(metrics);
  updateItemInfo(metrics);
  showItemInfoPickupKey(Boolean(metrics.focusItem) && Boolean(findNearestPickupable(metrics)));
  updateStaminaHud(controlState);
  updateBuffCards(controlState);
}

function animate() {
  const rawDelta = clock.getDelta();
  if (isPaused) {
    requestAnimationFrame(animate);
    return;
  }
  const delta = Math.min(rawDelta, 0.05);
  const elapsed = clock.elapsedTime;

  updateLevelTransition(delta);
  if (!exitComplete && !gameFailed && !levelTransition) controls.update(delta);
  const controlState = controls.getState();
  if (controlState.drinkCancelled && !controlState.isDrinking) {
    lastDrinkCancelled = true;
    lastDrinkCancelledUntil = clock.elapsedTime + 1.4;
    pickupFlashText = formatLocalizedStatus("almondWaterCancelled");
    pickupFlashUntil = clock.elapsedTime + 1.2;
    controls.clearDrinkCancelled();
  } else if (lastDrinkCancelled && !controlState.isDrinking) {
    pickupFlashText = formatLocalizedStatus("almondWaterCancelled");
    pickupFlashUntil = clock.elapsedTime + 1.2;
    lastDrinkCancelledUntil = clock.elapsedTime + 1.4;
  }
  const metrics = world.update(delta, elapsed, world.camera.position);
  updateFlashlight(delta);
  updateDetector(delta, metrics);
  if (metrics.entityContact && !gameFailed && !exitComplete && !levelTransition) {
    const contactEntity = (metrics.entities ?? []).find((entity) => entity?.contact);
    const isSuper = contactEntity?.id === "super-bacteria";
    gameFailed = true;
    canvas.dataset.gameFailed = "true";
    showExitOverlay(
      formatLocalizedStatus("bacteriaFailTitle"),
      formatLocalizedStatus(isSuper ? "superBacteriaFailSubtitle" : "bacteriaFailSubtitle"),
    );
  }
  if (metrics.exitReached && !gameFailed && !exitComplete && !levelTransition) {
    if (world.nextLevel !== null && world.nextLevel !== undefined) {
      beginLevelTransition(world.nextLevel);
    } else {
      exitComplete = true;
      showExitOverlay("EXIT STABILIZED", `${world.levelLabel} SIGNAL LOST`);
      canvas.dataset.exitReached = "true";
    }
  }
  ambientHum.update(metrics.flicker, controlState);
  updateHud(metrics, controlState, elapsed);
  updatePerformanceReadout(delta);
  updateLoadingOverlay();
  updateDrinkingMeter(controlState);

  renderer.render(world.scene, world.camera);
  frameCount += 1;
  canvas.dataset.sceneReady = "true";
  canvas.dataset.frameCount = String(frameCount);
  requestAnimationFrame(animate);
}

function startAudioOnce() {
  ambientHum.start();
  window.removeEventListener("pointerdown", startAudioOnce);
  window.removeEventListener("keydown", startAudioOnce);
}

function onUseKeyDown(event) {
  if (isPaused) {
    if (event.code === "Escape") {
      event.preventDefault();
      setPauseState(false);
    }
    return;
  }
  const tagName = event.target?.tagName;
  if (tagName === "INPUT" || tagName === "SELECT" || tagName === "TEXTAREA") return;
  if (event.code === "KeyF") {
    event.preventDefault();
    usePickup();
    return;
  }
  if (event.code === "KeyE") {
    event.preventDefault();
    useEquipped();
    return;
  }
  if (event.code === "ArrowLeft") {
    event.preventDefault();
    cycleInventory(-1);
    renderInventoryBar();
    return;
  }
  if (event.code === "ArrowRight") {
    event.preventDefault();
    cycleInventory(1);
    renderInventoryBar();
    return;
  }
  if (event.code === "Escape") {
    event.preventDefault();
    setPauseState(true);
  }
}

useButton?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  usePickup();
});
actionButton?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  useEquipped();
});
inventoryPrev?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  cycleInventory(-1);
  inventoryPrev.classList.add("is-active");
  window.setTimeout(() => inventoryPrev?.classList.remove("is-active"), 140);
  renderInventoryBar();
});
inventoryNext?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  cycleInventory(1);
  inventoryNext.classList.add("is-active");
  window.setTimeout(() => inventoryNext?.classList.remove("is-active"), 140);
  renderInventoryBar();
});
pauseButton?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  setPauseState(!isPaused);
});
pauseOverlay?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  setPauseState(false);
});
flashlightButton?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  toggleFlashlight();
});
detectorButton?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  startDetectorScan();
});
window.addEventListener("resize", resize);
window.addEventListener("pointerdown", startAudioOnce, { passive: true });
window.addEventListener("keydown", startAudioOnce);
window.addEventListener("keydown", onUseKeyDown);
window.addEventListener("blur", () => setPauseState(true));

syncLevelHud();
resize();
renderInventoryBar();
animate();
