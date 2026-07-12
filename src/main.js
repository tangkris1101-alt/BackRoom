import * as THREE from "three";
import "./styles.css";
import { createAmbientHum } from "./ambient-audio.js";
import { DebugMode, DEBUG_PLAYABLE_LEVELS } from "./debug-mode.js";
import { createBackroomsScene, getBackroomsLevelInfo } from "./scene.js";
import { FirstPersonControls } from "./first-person-controls.js";
import { syncFirstPersonHeldItem } from "./scene/common/view-model.js";
import {
  BACTERIA_CONTACT_RADIUS,
  HOUND_CONTACT_RADIUS,
  HUB_LEVEL,
  SILENCE_LIQUID_DURATION,
  SILENCE_LIQUID_REPEL_RADIUS,
  SILENCE_LIQUID_REPEL_SPEED_MULTIPLIER,
} from "./scene/constants.js";
import {
  hasSavedGame,
  loadSave,
  writeSave,
  clearSave,
  getInitialLevelFromSave,
} from "./save.js";
import {
  BUFF_TEXT,
  ENTITY_TEXT,
  INTERACTION_TEXT,
  ITEM_TEXT,
  LEVEL_DOCUMENTS,
  MAIN_MENU_TEXT,
  STATUS_TEXT,
} from "./ui/text.js";
import {
  getLevelDangerInfo as resolveLevelDangerInfo,
  setLevelDangerIndicator as renderLevelDangerIndicator,
} from "./ui/level-danger.js";
import {
  createWorldItemManager,
  DECORATIVE_ITEM_DEFS,
  getLevelKeyTarget,
  getWorldItemDefinition,
  isLevelKeyId,
  LEVEL_KEY_IDS,
} from "./scene/common/world-items.js";

const canvas = document.querySelector("#scene");
const appRoot = canvas?.closest("#app") ?? document.body;
const mainMenu = document.querySelector("#main-menu");
const mainMenuEyebrow = document.querySelector("#main-menu-eyebrow");
const mainMenuSubtitle = document.querySelector("#main-menu-subtitle");
const mainMenuStart = document.querySelector("#main-menu-start");
const mainMenuStartLabel = document.querySelector("#main-menu-start-label");
const mainMenuStartHint = document.querySelector("#main-menu-start-hint");
const mainMenuSettings = document.querySelector("#main-menu-settings");
const mainMenuSettingsLabel = document.querySelector("#main-menu-settings-label");
const mainMenuSettingsHint = document.querySelector("#main-menu-settings-hint");
const mainMenuSettingsPanel = document.querySelector("#main-menu-settings-panel");
const mainMenuSettingsTitle = document.querySelector("#main-menu-settings-title");
const mainMenuSettingsClose = document.querySelector("#main-menu-settings-close");
const mainMenuLanguageZh = document.querySelector("#main-menu-language-zh");
const mainMenuLanguageEn = document.querySelector("#main-menu-language-en");
const joystick = document.querySelector("#joystick");
const jumpButton = document.querySelector("#jump-button");
const useButton = document.querySelector("#use-button");
const actionButton = document.querySelector("#action-button");
const flashlightButton = document.querySelector("#flashlight-button");
const detectorButton = document.querySelector("#detector-button");
const pauseButton = document.querySelector("#pause-button");
const statusText = document.querySelector("#status-text");
const levelPicker = document.querySelector("#level-picker");
const levelPickerButton = document.querySelector("#level-picker-button");
const levelPickerLabel = document.querySelector("#level-picker-label");
const levelPickerMenu = document.querySelector("#level-picker-menu");
const distanceReadout = document.querySelector("#distance-readout");
const lightReadout = document.querySelector("#light-readout");
const fpsReadout = document.querySelector("#fps-readout");
const staminaMeter = document.querySelector(".stamina-meter");
const staminaFill = document.querySelector("#stamina-fill");
const staminaReadout = document.querySelector("#stamina-readout");
const healthMeter = document.querySelector(".health-meter");
const healthFill = document.querySelector("#health-fill");
const healthReadout = document.querySelector("#health-readout");
const damageFlash = document.querySelector("#damage-flash");
const flashlightMeter = document.querySelector(".flashlight-meter");
const flashlightFill = document.querySelector("#flashlight-fill");
const flashlightReadout = document.querySelector("#flashlight-readout");
const detectorMeter = document.querySelector("#detector-meter");
const detectorFill = document.querySelector("#detector-fill");
const detectorReadout = document.querySelector("#detector-readout");
const compassMeter = document.querySelector("#compass-meter");
const compassArrow = document.querySelector("#compass-arrow");
const compassReadout = document.querySelector("#compass-readout");
const drinkingMeter = document.querySelector("#drinking-meter");
const drinkingFill = document.querySelector("#drinking-fill");
const drinkingReadout = document.querySelector("#drinking-readout");
const loadingOverlay = document.querySelector("#loading-overlay");
const loadingFill = document.querySelector("#loading-fill");
const loadingStatus = document.querySelector("#loading-status");
const exitOverlay = document.querySelector("#exit-overlay");
const exitOverlayTitle = exitOverlay?.querySelector("strong");
const exitOverlaySubtitle = exitOverlay?.querySelector("span");
const exitOverlayTime = document.querySelector("#exit-overlay-time");
const exitOverlayRestart = document.querySelector("#exit-overlay-restart");
const exitOverlayRestartLabel = document.querySelector("#exit-overlay-restart-label");
const exitOverlayRestartHint = document.querySelector("#exit-overlay-restart-hint");
const exitOverlayContinue = document.querySelector("#exit-overlay-continue");
const exitOverlayContinueLabel = document.querySelector("#exit-overlay-continue-label");
const exitOverlayContinueHint = document.querySelector("#exit-overlay-continue-hint");
const exitOverlayDanger = document.querySelector("#exit-overlay-danger");
const loadingLevelLabel = loadingOverlay?.querySelector(".loading-overlay__panel span");
const loadingDanger = document.querySelector("#loading-danger");
const timerReadout = document.querySelector("#timer-readout");
const timerReadoutValue = timerReadout?.querySelector(".timer-readout__value");
const itemInfo = document.querySelector("#item-info");
const itemInfoName = document.querySelector("#item-info-name");
const itemInfoEffect = document.querySelector("#item-info-effect");
const itemInfoAction = document.querySelector("#item-info-action");
const documentReader = document.querySelector("#document-reader");
const documentReaderEyebrow = document.querySelector("#document-reader-eyebrow");
const documentReaderTitle = document.querySelector("#document-reader-title");
const documentReaderBody = document.querySelector("#document-reader-body");
const documentReaderHint = document.querySelector("#document-reader-hint");
const documentReaderClose = document.querySelector("#document-reader-close");
let documentReaderId = null;
const buffList = document.querySelector("#buff-list");
const entityMarkers = document.querySelector("#entity-markers");
const debugExitMarkers = document.querySelector("#debug-exit-markers");
const pauseOverlay = document.querySelector("#pause-overlay");
const pauseTitle = document.querySelector("#pause-title");
const pauseSubtitle = document.querySelector("#pause-subtitle");
const pauseResumeArea = document.querySelector("#pause-resume-area");
const pauseTutorialButton = document.querySelector("#pause-tutorial");
const pauseTutorialLabel = document.querySelector("#pause-tutorial-label");
const pauseTutorialHint = document.querySelector("#pause-tutorial-hint");
const pauseTimeLabel = document.querySelector("#pause-time-label");
const pauseTimeReadout = document.querySelector("#pause-time-readout");
const pauseSettingsButton = document.querySelector("#pause-settings");
const pauseSettingsLabel = document.querySelector("#pause-settings-label");
const pauseSettingsHint = document.querySelector("#pause-settings-hint");
const pauseSettingsPanel = document.querySelector("#pause-settings-panel");
const pauseSettingsTitle = document.querySelector("#pause-settings-title");
const pauseSettingsClose = document.querySelector("#pause-settings-close");
const pauseLanguageZh = document.querySelector("#pause-language-zh");
const pauseLanguageEn = document.querySelector("#pause-language-en");
const pauseResetButton = document.querySelector("#pause-reset");
const pauseResetLabel = document.querySelector("#pause-reset-label");
const pauseResetHint = document.querySelector("#pause-reset-hint");
const inventoryBar = document.querySelector("#inventory-bar");
const inventorySlots = document.querySelector("#inventory-slots");
const inventoryPrev = document.querySelector("#inventory-prev");
const inventoryNext = document.querySelector("#inventory-next");
const savePromptOverlay = document.querySelector("#save-prompt");
const savePromptEyebrow = document.querySelector("#save-prompt-eyebrow");
const savePromptTitle = document.querySelector("#save-prompt-title");
const savePromptDesc = document.querySelector("#save-prompt-desc");
const savePromptMain = document.querySelector(".save-prompt__main");
const savePromptLevels = document.querySelector(".save-prompt__levels");
const savePromptLevelsBack = document.querySelector("#save-prompt-levels-back");
const savePromptLevelsTitle = document.querySelector("#save-prompt-levels-title");
const savePromptLevelsList = document.querySelector("#save-prompt-levels-list");
const savePromptContinue = document.querySelector("#save-prompt-continue");
const savePromptContinueLabel = document.querySelector("#save-prompt-continue-label");
const savePromptContinueHint = document.querySelector("#save-prompt-continue-hint");
const savePromptRestart = document.querySelector("#save-prompt-restart");
const savePromptRestartLabel = document.querySelector("#save-prompt-restart-label");
const savePromptRestartHint = document.querySelector("#save-prompt-restart-hint");
const savePromptJump = document.querySelector("#save-prompt-jump");
const savePromptJumpLabel = document.querySelector("#save-prompt-jump-label");
const savePromptJumpHint = document.querySelector("#save-prompt-jump-hint");
const savePromptLevel = document.querySelector("#save-prompt-level");
const savePromptStamina = document.querySelector("#save-prompt-stamina");
const savePromptRunTime = document.querySelector("#save-prompt-runtime");
const savePromptItems = document.querySelector("#save-prompt-items");
const tutorialOverlay = document.querySelector("#tutorial-overlay");
const tutorialSkip = document.querySelector("#tutorial-skip");
const tutorialPrev = document.querySelector("#tutorial-prev");
const tutorialNext = document.querySelector("#tutorial-next");
const tutorialPages = document.querySelector(".tutorial-pages");
const tutorialDots = document.querySelectorAll(".tutorial-pagination__dot");
const TUTORIAL_SEEN_KEY = "backrooms-tutorial-seen";
const TUTORIAL_TOTAL_PAGES = 4;
const REACHED_KEY = "backrooms-levels-reached";
const COMPLETED_KEY = "backrooms-levels-completed";
const PICKED_UP_KEY = "backrooms-picked-up-items";
let tutorialPage = 0;
let tutorialActive = false;

const MAX_PIXEL_RATIO = 1.25;
const MIN_PIXEL_RATIO = 0.75;
const FPS_SAMPLE_INTERVAL = 0.75;
const FPS_LOW_THRESHOLD = 48;
const FPS_HIGH_THRESHOLD = 58;
const OVERLAY_FADE_MS = 460;
const LEVEL_TRANSITION_FADE_IN_MS = 720;
const LEVEL_TRANSITION_HOLD_MS = 360;
const LEVEL_TRANSITION_FADE_OUT_MS = 760;
const LEVEL_TRANSITION_LOAD_AT_MS = LEVEL_TRANSITION_FADE_IN_MS + LEVEL_TRANSITION_HOLD_MS;
const LEVEL_TRANSITION_MS = LEVEL_TRANSITION_LOAD_AT_MS + LEVEL_TRANSITION_FADE_OUT_MS;
const FLASHLIGHT_BATTERY_MAX = 100;
const FLASHLIGHT_DRAIN_RATE = 4.2;
const FLASHLIGHT_MAX_STACK = 3;
const DETECTOR_SCAN_DURATION = 5;
const DETECTOR_COOLDOWN_DURATION = 60;
const DETECTOR_RANGE = 112;
const LANGUAGE_STORAGE_KEY = "backrooms-language";
const ALMOND_WATER_DURATION = 45;
const SUPER_ALMOND_WATER_DURATION = 25;
const ALMOND_WATER_STAMINA_BONUS = 50;
const ALMOND_WATER_DRINK_DURATION = 1.0;
const WATER_LONG_PRESS_MS = 600;
const SAVE_AUTOSAVE_INTERVAL_MS = 5000;
const SAVE_DEBOUNCE_MS = 250;
const PAUSE_RESET_ARM_TIMEOUT_MS = 3000;
const PAUSE_TUTORIAL_RETURN_DELAY_MS = 220;
const HEALTH_MAX = 100;
const BACTERIA_DAMAGE = 50;
const SUPER_BACTERIA_DAMAGE = 60;
const HOUND_DAMAGE = 30;
const LEVEL_SEVEN_THING_DAMAGE = 68;
const DAMAGE_COOLDOWN_S = 1.0;
const ALMOND_WATER_HEAL = 30;
const SUPER_ALMOND_WATER_HEAL = 80;
const DAMAGE_FLASH_MS = 600;
const EXIT_DOOR_INTERACT_RADIUS = 4.2;
const EXIT_ELEVATOR_ENTER_RADIUS = 1.65;
const ALMOND_WATER_HEAL_DURATION = 5;
const gameplayUiElements = [
  document.querySelector(".hud"),
  joystick,
  jumpButton,
  useButton,
  actionButton,
  flashlightButton,
  detectorButton,
  pauseButton,
  loadingOverlay,
  inventoryBar,
];

function showGameplayUi() {
  gameplayUiElements.forEach((element) => element?.removeAttribute("hidden"));
  exitOverlay?.setAttribute("hidden", "");
}

function hideGameplayUi() {
  gameplayUiElements.forEach((element) => element?.setAttribute("hidden", ""));
  exitOverlay?.setAttribute("hidden", "");
  closeDocumentReader();
}

hideGameplayUi();

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

const flashlightLight = new THREE.SpotLight(0xfff2c5, 0, 86, 0.56, 0.74, 1.42);
flashlightLight.position.set(0.18, -0.12, -0.16);
flashlightLight.name = "player-flashlight";
const flashlightTarget = new THREE.Object3D();
flashlightTarget.position.set(0, -0.16, -1);
const debugMode = new DebugMode({
  canvas,
  onSync(active) {
    controls?.setDebugUnlimitedStamina?.(active);
    if (!active) clearDebugExitMarkers();
  },
});

function isDebugFeaturesActive() {
  return debugMode.isActive();
}

function syncDebugState() {
  debugMode.sync();
}

function toggleDebugFeatures() {
  const active = debugMode.toggle();
  pickupFlashText = formatLocalizedStatus(active ? "debugEnabled" : "debugDisabled");
  pickupFlashUntil = clock.elapsedTime + 1.4;
}

function getInitialLevel() {
  const level = Number(new URLSearchParams(window.location.search).get("level"));
  const requested = getBackroomsLevelInfo(level).level;
  if (debugMode.queryEnabled && DEBUG_PLAYABLE_LEVELS.has(requested)) return requested;
  if (requested === 0) return 0;
  try {
    const reached = JSON.parse(window.localStorage?.getItem(REACHED_KEY) ?? "[]");
    if (!Array.isArray(reached)) return 0;
    if (level === 8 && reached.includes(8)) return HUB_LEVEL;
    return reached.includes(requested) ? requested : 0;
  } catch {
    return 0;
  }
}

let world = null;
let worldItems = null;
let controls = null;
let animationFrameStarted = false;
let saveDirtyTimer = 0;
let gameStarted = false;

function attachFlashlightToCamera(camera) {
  camera.add(flashlightLight);
  camera.add(flashlightTarget);
  flashlightLight.target = flashlightTarget;
}

function attachDebugAreaLightToCamera(camera) {
  debugMode.attachAreaLight(camera);
}
const ambientHum = createAmbientHum();

class GameTimer extends THREE.Timer {
  get elapsedTime() {
    return this.getElapsed();
  }
}

const clock = new GameTimer();
clock.connect(document);

function handleDrinkComplete(itemId) {
  if (itemId === "almond-water") {
    removeInventory(itemId);
    renderInventoryBar();
    controls?.startDrinkRecovery(ALMOND_WATER_HEAL, {
      duration: ALMOND_WATER_HEAL_DURATION,
    });
    markDirty();
  } else if (itemId === "super-almond-water") {
    removeInventory(itemId);
    renderInventoryBar();
    controls?.startDrinkRecovery(SUPER_ALMOND_WATER_HEAL, {
      duration: SUPER_ALMOND_WATER_HEAL_DURATION,
    });
    markDirty();
  }
}
let frameCount = 0;
let sampleFrameCount = 0;
let sampleElapsed = 0;
let displayedFps = 0;
let loadingComplete = false;
let exitComplete = false;
let gameFailed = false;
let levelTransition = null;
let levelBriefingTimer = 0;
let exitDoorOpen = false;
let exitOverlayHideTimer = 0;
let runTime = 0;
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
const compassToExit = new THREE.Vector3();
const debugExitProjection = new THREE.Vector3();
let lastMetrics = null;

const INVENTORY_ORDER = [
  "flashlight",
  "detector",
  "silence-liquid",
  "compass",
  "level-one-file",
  ...LEVEL_KEY_IDS,
  "almond-water",
  "super-almond-water",
  ...Object.keys(DECORATIVE_ITEM_DEFS),
];

const INVENTORY_DEFS = {
  flashlight: {
    id: "flashlight",
    type: "toggle",
    unique: false,
    stackable: true,
    maxStack: FLASHLIGHT_MAX_STACK,
  },
  detector: { id: "detector", type: "scan", unique: true, stackable: false },
  "silence-liquid": { id: "silence-liquid", type: "consumable", unique: false, stackable: true },
  compass: { id: "compass", type: "passive", unique: true, stackable: false },
  ...Object.fromEntries(
    LEVEL_KEY_IDS.map((id) => [id, { id, type: "key", unique: true, stackable: false }]),
  ),
  "almond-water": { id: "almond-water", type: "consumable", unique: false, stackable: true },
  "super-almond-water": {
    id: "super-almond-water",
    type: "consumable",
    unique: false,
    stackable: true,
  },
  ...Object.fromEntries(
    Object.keys(DECORATIVE_ITEM_DEFS).map((id) => [
      id,
      { id, type: "decorative", unique: false, stackable: true, maxStack: 9 },
    ]),
  ),
  "level-one-file": { id: "level-one-file", type: "document", unique: true, stackable: false },
};

const ITEM_ICON_SVG = {
  flashlight: `<defs>
      <linearGradient id="fl-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8a9088"/><stop offset="0.35" stop-color="#3a4038"/>
        <stop offset="0.65" stop-color="#3a4038"/><stop offset="1" stop-color="#5a6058"/>
      </linearGradient>
      <radialGradient id="fl-lens" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#fffbe0"/><stop offset="0.3" stop-color="#ffd870"/>
        <stop offset="0.7" stop-color="#c87020"/><stop offset="1" stop-color="#804000"/>
      </radialGradient>
    </defs>
    <rect x="6" y="42" width="14" height="16" rx="2" fill="#3a3530" stroke="#1a1410" stroke-width="0.6"/>
    <rect x="20" y="38" width="60" height="24" rx="3" fill="url(#fl-body)" stroke="#1a1410" stroke-width="0.7"/>
    <rect x="48" y="32" width="14" height="6" rx="1" fill="#1a1410"/>
    <circle cx="55" cy="35" r="1.6" fill="#ff8060"/>
    <line x1="22" y1="42" x2="78" y2="42" stroke="#1a1410" stroke-width="0.4" opacity="0.5"/>
    <line x1="22" y1="58" x2="78" y2="58" stroke="#1a1410" stroke-width="0.4" opacity="0.5"/>
    <circle cx="82" cy="50" r="14" fill="url(#fl-lens)" stroke="#804000" stroke-width="0.7"/>
    <circle cx="82" cy="50" r="9" fill="none" stroke="#ffe8a0" stroke-width="0.6" opacity="0.6"/>
    <circle cx="82" cy="50" r="4" fill="#fffbe0"/>
    <path d="M 92 38 L 100 30 M 92 50 L 100 50 M 92 62 L 100 70" stroke="#fffbe0" stroke-width="0.8" opacity="0.35" fill="none"/>`,

  "almond-water": `<defs>
      <linearGradient id="aw-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#dcf2a8"/><stop offset="0.4" stop-color="#a8d878"/>
        <stop offset="1" stop-color="#7aa848"/>
      </linearGradient>
    </defs>
    <rect x="38" y="6" width="24" height="10" rx="1.5" fill="#4a6a3c" stroke="#2c4a1c" stroke-width="0.7"/>
    <rect x="40" y="9" width="20" height="1.6" fill="#2c4a1c"/>
    <rect x="40" y="16" width="20" height="8" fill="#88b858" stroke="#5a8050" stroke-width="0.6"/>
    <path d="M 30 24 L 70 24 L 70 86 Q 70 92 64 92 L 36 92 Q 30 92 30 86 Z" fill="url(#aw-body)" stroke="#5a8050" stroke-width="1"/>
    <rect x="30" y="44" width="40" height="26" fill="#f8f4dc" stroke="#5a8050" stroke-width="0.6"/>
    <text x="50" y="54" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="6" font-weight="900" fill="#2c4a1c">ALMOND</text>
    <text x="50" y="62" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="6" font-weight="900" fill="#2c4a1c">WATER</text>
    <text x="50" y="68" text-anchor="middle" font-family="Arial, sans-serif" font-size="2.6" font-weight="700" fill="#5a8050">+50 STAMINA</text>
    <rect x="34" y="28" width="3" height="58" fill="#fff" opacity="0.35"/>
    <rect x="62" y="28" width="2" height="58" fill="#000" opacity="0.15"/>`,

  "super-almond-water": `<defs>
      <linearGradient id="saw-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff8d0"/><stop offset="0.4" stop-color="#ffd570"/>
        <stop offset="1" stop-color="#c89020"/>
      </linearGradient>
    </defs>
    <rect x="38" y="6" width="24" height="10" rx="1.5" fill="#9a6714" stroke="#704000" stroke-width="0.7"/>
    <rect x="40" y="9" width="20" height="1.6" fill="#704000"/>
    <rect x="40" y="16" width="20" height="8" fill="#d8a030" stroke="#9a6714" stroke-width="0.6"/>
    <path d="M 30 24 L 70 24 L 70 86 Q 70 92 64 92 L 36 92 Q 30 92 30 86 Z" fill="url(#saw-body)" stroke="#9a6714" stroke-width="1"/>
    <rect x="30" y="42" width="40" height="28" fill="#fff8d0" stroke="#9a6714" stroke-width="0.6"/>
    <text x="50" y="51" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="5.2" font-weight="900" fill="#704000">SUPER</text>
    <text x="50" y="59" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="6" font-weight="900" fill="#704000">ALMOND</text>
    <text x="50" y="67" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="5.2" font-weight="900" fill="#704000">WATER</text>
    <text x="50" y="71.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="2.4" font-weight="700" fill="#9a6714">250 CAP ×2</text>
    <rect x="34" y="28" width="3" height="58" fill="#fff" opacity="0.4"/>
    <rect x="62" y="28" width="2" height="58" fill="#000" opacity="0.15"/>`,

  detector: `<defs>
      <linearGradient id="det-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5a5550"/><stop offset="1" stop-color="#252220"/>
      </linearGradient>
      <linearGradient id="det-screen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5a1818"/><stop offset="0.5" stop-color="#3a0808"/>
        <stop offset="1" stop-color="#1a0404"/>
      </linearGradient>
      <radialGradient id="det-glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#ff8060" stop-opacity="0.5"/>
        <stop offset="1" stop-color="#ff8060" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect x="36" y="3" width="2.5" height="13" fill="#5a5048"/>
    <circle cx="37.25" cy="3" r="3" fill="#ff8060"/>
    <circle cx="37.25" cy="3" r="4.5" fill="#ff8060" opacity="0.35"/>
    <rect x="28" y="14" width="18" height="4" rx="1" fill="#3a3530" stroke="#1a1410" stroke-width="0.4"/>
    <rect x="12" y="22" width="76" height="68" rx="6" fill="url(#det-body)" stroke="#1a1410" stroke-width="1"/>
    <rect x="14" y="24" width="72" height="3" fill="#3a3530" opacity="0.6"/>
    <rect x="18" y="32" width="64" height="32" rx="3" fill="url(#det-screen)" stroke="#1a0808" stroke-width="0.7"/>
    <rect x="20" y="34" width="60" height="28" fill="url(#det-glow)"/>
    <line x1="18" y1="48" x2="82" y2="48" stroke="#ff8060" stroke-width="1" opacity="0.85"/>
    <line x1="50" y1="32" x2="50" y2="64" stroke="#ff8060" stroke-width="1" opacity="0.85"/>
    <circle cx="50" cy="48" r="7" fill="none" stroke="#ff8060" stroke-width="1.4"/>
    <circle cx="50" cy="48" r="2.5" fill="#ff8060"/>
    <rect x="18" y="70" width="9" height="9" rx="1.5" fill="#1a1410" stroke="#3a3530" stroke-width="0.5"/>
    <rect x="20" y="72" width="5" height="3" rx="0.5" fill="#5a5048"/>
    <rect x="30" y="70" width="9" height="9" rx="1.5" fill="#1a1410" stroke="#3a3530" stroke-width="0.5"/>
    <rect x="32" y="72" width="5" height="3" rx="0.5" fill="#5a5048"/>
    <rect x="42" y="70" width="9" height="9" rx="1.5" fill="#1a1410" stroke="#3a3530" stroke-width="0.5"/>
    <rect x="44" y="72" width="5" height="3" rx="0.5" fill="#5a5048"/>
    <rect x="54" y="70" width="9" height="9" rx="1.5" fill="#1a1410" stroke="#3a3530" stroke-width="0.5"/>
    <rect x="56" y="72" width="5" height="3" rx="0.5" fill="#5a5048"/>
    <rect x="66" y="70" width="9" height="9" rx="1.5" fill="#1a1410" stroke="#3a3530" stroke-width="0.5"/>
    <rect x="68" y="72" width="5" height="3" rx="0.5" fill="#5a5048"/>
    <circle cx="78" cy="27" r="2" fill="#80ff60"/>
    <circle cx="78" cy="27" r="4" fill="#80ff60" opacity="0.35"/>
    <rect x="14" y="84" width="72" height="4" rx="2" fill="#1a1410"/>`,

  "silence-liquid": `<defs>
      <linearGradient id="sl-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#d8e7ff"/><stop offset="0.45" stop-color="#8274ff"/>
        <stop offset="1" stop-color="#2b205f"/>
      </linearGradient>
      <radialGradient id="sl-glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#c9f6ff" stop-opacity="0.75"/>
        <stop offset="1" stop-color="#7d6cff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <ellipse cx="50" cy="54" rx="30" ry="30" fill="url(#sl-glow)" opacity="0.42"/>
    <rect x="42" y="7" width="16" height="12" rx="2" fill="#171426" stroke="#070611" stroke-width="0.8"/>
    <rect x="40" y="17" width="20" height="9" rx="2" fill="#342d64" stroke="#16122c" stroke-width="0.7"/>
    <path d="M 31 26 Q 50 18 69 26 L 64 88 Q 63 94 57 94 L 43 94 Q 37 94 36 88 Z" fill="url(#sl-body)" stroke="#18122e" stroke-width="1.2"/>
    <path d="M 35 33 Q 50 27 65 33 L 61 78 Q 50 85 39 78 Z" fill="#6a5cff" opacity="0.56"/>
    <rect x="35" y="46" width="30" height="20" rx="2" fill="#211a4f" stroke="#a99dff" stroke-width="0.7"/>
    <line x1="41" y1="61" x2="59" y2="51" stroke="#e7e0ff" stroke-width="2.4" stroke-linecap="round"/>
    <text x="50" y="43" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="5.2" font-weight="900" fill="#e6e0ff">SILENCE</text>
    <rect x="39" y="30" width="3" height="54" fill="#fff" opacity="0.28"/>
    <rect x="58" y="30" width="2" height="54" fill="#000" opacity="0.16"/>`,

  "wire-spool": `
    <ellipse cx="50" cy="50" rx="31" ry="17" fill="#9d4e2b" stroke="#32140c" stroke-width="3"/>
    <ellipse cx="50" cy="50" rx="21" ry="11" fill="#2e2824" stroke="#d07a42" stroke-width="2"/>
    <ellipse cx="50" cy="50" rx="7" ry="4" fill="#161312" stroke="#d4b28a" stroke-width="1.5"/>
    <path d="M22 50 C34 27 66 27 78 50 C66 73 34 73 22 50 Z" fill="none" stroke="#d9a16d" stroke-width="2" opacity="0.75"/>
    <path d="M27 42 C40 34 60 34 73 42 M27 58 C40 66 60 66 73 58" fill="none" stroke="#f0c28d" stroke-width="1.5" opacity="0.65"/>
    <path d="M79 49 C89 42 91 58 83 61" fill="none" stroke="#30393a" stroke-width="4" stroke-linecap="round"/>`,

  compass: `
    <circle cx="50" cy="50" r="34" fill="#b2873f" stroke="#3a2410" stroke-width="2"/>
    <circle cx="50" cy="50" r="27" fill="#efe2b5" stroke="#5d3a16" stroke-width="1.2"/>
    <circle cx="50" cy="50" r="21" fill="none" stroke="#9b7335" stroke-width="0.8" opacity="0.75"/>
    <path d="M50 17 L54 29 L50 25 L46 29 Z" fill="#332719"/>
    <path d="M50 83 L46 71 L50 75 L54 71 Z" fill="#332719" opacity="0.7"/>
    <path d="M17 50 L29 46 L25 50 L29 54 Z" fill="#332719" opacity="0.7"/>
    <path d="M83 50 L71 54 L75 50 L71 46 Z" fill="#332719" opacity="0.7"/>
    <path d="M50 24 L57 51 L50 47 L43 51 Z" fill="#ff4b35" stroke="#5b1008" stroke-width="0.7"/>
    <path d="M50 76 L43 49 L50 53 L57 49 Z" fill="#202020" stroke="#0a0806" stroke-width="0.7"/>
    <circle cx="50" cy="50" r="4.5" fill="#392414"/>
    <path d="M30 18 Q50 7 70 18" fill="none" stroke="#f5c86e" stroke-width="2" opacity="0.55"/>
    <path d="M36 38 Q50 28 64 38" fill="none" stroke="#fff6cf" stroke-width="1.4" opacity="0.32"/>`,

  "crumpled-note": `
    <path d="M22 20 L72 15 L82 32 L77 82 L28 87 L17 68 Z" fill="#d8cfaa" stroke="#6f664e" stroke-width="2" stroke-linejoin="round"/>
    <path d="M25 42 Q39 33 54 42 T76 40 M27 55 Q42 47 57 56 T75 54 M31 68 Q43 60 55 68" fill="none" stroke="#30384e" stroke-width="3" stroke-linecap="round" opacity="0.82"/>
    <path d="M22 20 L31 35 L17 68 M72 15 L65 33 L82 32 M77 82 L61 72 L28 87" fill="none" stroke="#8c8266" stroke-width="1.5" opacity="0.75"/>`,

  "level-one-file": `
    <path d="M24 16 L72 16 L80 28 L76 86 L24 86 L18 72 L18 28 Z" fill="#d8d2ad" stroke="#31443a" stroke-width="3" stroke-linejoin="round"/>
    <path d="M24 16 L24 30 L39 30" fill="none" stroke="#31443a" stroke-width="3" stroke-linejoin="round"/>
    <text x="50" y="49" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="15" fill="#31443a">M.E.G.</text>
    <text x="50" y="64" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#31443a">LEVEL 1</text>
    <path d="M30 72 L70 72 M30 78 L64 78" stroke="#5d725f" stroke-width="2" opacity="0.72"/>`,

  "rusted-key": `
    <circle cx="28" cy="43" r="15" fill="none" stroke="#9a7043" stroke-width="8"/>
    <circle cx="28" cy="43" r="5" fill="#2f251b"/>
    <path d="M39 54 L79 76 M60 66 L67 57 M70 72 L78 64" fill="none" stroke="#9a7043" stroke-width="8" stroke-linecap="square"/>
    <path d="M19 29 L27 36 M36 51 L43 57 M53 62 L60 68" stroke="#c19b62" stroke-width="2.6" opacity="0.68" stroke-linecap="round"/>
    <circle cx="49" cy="61" r="2.2" fill="#4a3523"/><circle cx="67" cy="70" r="2" fill="#4a3523"/>`,

  "office-badge": `
    <path d="M29 17 L71 17 L78 27 L74 84 L26 84 L22 27 Z" fill="#7fa7b4" stroke="#253d46" stroke-width="3" stroke-linejoin="round"/>
    <rect x="32" y="30" width="22" height="26" rx="2" fill="#d5ded3" stroke="#415862" stroke-width="1.5"/>
    <circle cx="43" cy="39" r="6" fill="#7b8e85"/><path d="M34 52 Q43 43 52 52" fill="#7b8e85"/>
    <path d="M59 34 L70 34 M59 42 L70 42 M33 66 L69 66 M33 73 L61 73" stroke="#e2f0dc" stroke-width="3" opacity="0.86"/>
    <circle cx="50" cy="22" r="4" fill="#e4eee2" stroke="#415862" stroke-width="1.5"/>`,

  "hotel-token": `
    <circle cx="50" cy="50" r="33" fill="#c69a45" stroke="#563916" stroke-width="4"/>
    <circle cx="50" cy="50" r="24" fill="none" stroke="#f2d77e" stroke-width="2" stroke-dasharray="3 3"/>
    <path d="M38 31 L62 31 L66 45 L62 69 L38 69 L34 45 Z" fill="#7d5421" stroke="#f3d980" stroke-width="2"/>
    <text x="50" y="56" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="16" fill="#fff0a9">404</text>
    <path d="M26 50 L32 50 M68 50 L74 50" stroke="#fff0a9" stroke-width="2" opacity="0.72"/>`,

  seashell: `
    <path d="M19 67 Q20 27 50 18 Q80 27 81 67 Q72 82 50 84 Q28 82 19 67 Z" fill="#d9c7aa" stroke="#745f4c" stroke-width="3"/>
    <path d="M50 21 L50 80 M31 30 Q40 49 38 78 M69 30 Q60 49 62 78 M23 45 Q36 57 29 73 M77 45 Q64 57 71 73" fill="none" stroke="#a89177" stroke-width="2.5"/>
    <path d="M50 27 Q57 48 50 77 Q43 48 50 27" fill="#eee1c7" opacity="0.6"/>`,

  "empty-can": `
    <path d="M31 24 Q50 16 69 24 L65 79 Q50 87 35 79 Z" fill="#7b8480" stroke="#28302d" stroke-width="3"/>
    <ellipse cx="50" cy="24" rx="19" ry="7" fill="#b7c0b8" stroke="#28302d" stroke-width="2.5"/>
    <ellipse cx="50" cy="24" rx="9" ry="3.5" fill="#333b38"/>
    <path d="M34 37 Q50 43 66 37 M34 61 Q50 54 66 61" fill="none" stroke="#cfd6ce" stroke-width="2" opacity="0.55"/>
    <path d="M39 29 L45 76 M57 29 L52 76" stroke="#4d5651" stroke-width="2" opacity="0.65"/>`,

  "concrete-chip": `
    <path d="M21 68 L31 29 L55 18 L79 37 L73 70 L52 84 L30 80 Z" fill="#83837a" stroke="#302f2a" stroke-width="3" stroke-linejoin="round"/>
    <path d="M31 29 L43 47 L55 18 M43 47 L73 70 M43 47 L30 80 M43 47 L66 38" fill="none" stroke="#b5b2a4" stroke-width="2.2" opacity="0.72"/>
    <path d="M24 67 L51 62 L75 48" fill="none" stroke="#4a4941" stroke-width="2" opacity="0.68"/>
    <circle cx="60" cy="33" r="2.5" fill="#d1c28c" opacity="0.72"/>
    <circle cx="35" cy="67" r="2" fill="#d1c28c" opacity="0.56"/>`,
};

let iconIdCounter = 0;
function createItemIcon(type) {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.classList.add("inventory-slot__svg");
  const slotId = iconIdCounter++;
  let content = ITEM_ICON_SVG[type];
  const keyTargetLevel = getLevelKeyTarget(type);
  if (!content && keyTargetLevel !== null) {
    content = `<circle cx="29" cy="38" r="16" fill="none" stroke="#d6ab58" stroke-width="9"/>
      <path d="M40 49 L78 78 M61 65 L70 56 M70 74 L79 65" fill="none" stroke="#d6ab58" stroke-width="9" stroke-linecap="square"/>
      <circle cx="29" cy="38" r="6" fill="#302513"/>
      <text x="69" y="37" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="18" fill="#ffe29a">${keyTargetLevel}</text>`;
  }
  if (!content) {
    content = `<circle cx="50" cy="50" r="27" fill="#777d72" stroke="#272b25" stroke-width="3"/>
      <path d="M35 52 L45 62 L67 38" fill="none" stroke="#e3ddbd" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  if (content) {
    content = content
      .replace(/id="(fl-body|fl-lens|aw-body|saw-body|det-body|det-screen|det-glow|sl-body|sl-glow)"/g, `id="$1-${slotId}"`)
      .replace(/url\(#(fl-body|fl-lens|aw-body|saw-body|det-body|det-screen|det-glow|sl-body|sl-glow)\)/g, `url(#$1-${slotId})`);
    svg.innerHTML = content;
  }
  return svg;
}

const inventory = [];
let equippedIndex = -1;
let lastDrinkCancelled = false;
let lastDrinkCompletedItemId = null;
let isPaused = false;
let pauseAccumulatedDelta = 0;
let pauseFromUnlock = false;
let isInPauseTransition = false;
let ePressStartTime = 0;
let ePressActive = false;
let ePressLongTriggered = false;
let pauseResetArmed = false;
let pauseResetArmedTimer = 0;
let isResettingProgress = false;
let savePromptMode = "main";

try {
  const savedLanguage = window.localStorage?.getItem(LANGUAGE_STORAGE_KEY);
  if (savedLanguage === "zh-CN" || savedLanguage === "en") currentLanguage = savedLanguage;
} catch {
  currentLanguage = "zh-CN";
}

document.documentElement.lang = currentLanguage;
canvas.dataset.language = currentLanguage;

function updateMainMenuText() {
  const text = MAIN_MENU_TEXT[currentLanguage] ?? MAIN_MENU_TEXT.en;
  if (mainMenuEyebrow) mainMenuEyebrow.textContent = text.eyebrow;
  if (mainMenuSubtitle) mainMenuSubtitle.textContent = text.subtitle;
  if (mainMenuStartLabel) mainMenuStartLabel.textContent = text.start;
  if (mainMenuStartHint) mainMenuStartHint.textContent = text.startHint;
  if (mainMenuSettingsLabel) mainMenuSettingsLabel.textContent = text.settings;
  if (mainMenuSettingsHint) mainMenuSettingsHint.textContent = text.settingsHint;
  if (mainMenuSettingsTitle) mainMenuSettingsTitle.textContent = text.language;
  if (mainMenuSettingsClose) mainMenuSettingsClose.setAttribute("aria-label", text.close);
  mainMenuLanguageZh?.setAttribute("aria-pressed", String(currentLanguage === "zh-CN"));
  mainMenuLanguageEn?.setAttribute("aria-pressed", String(currentLanguage === "en"));
}

function setMainMenuSettingsOpen(open) {
  if (!mainMenuSettingsPanel || !mainMenuSettings) return;
  const nextOpen = Boolean(open);
  mainMenuSettingsPanel.toggleAttribute("hidden", !nextOpen);
  mainMenuSettings.setAttribute("aria-expanded", String(nextOpen));
  mainMenu?.classList.toggle("is-settings-open", nextOpen);
  if (nextOpen) mainMenuSettingsClose?.focus();
}

function isMainMenuVisible() {
  return Boolean(mainMenu && !mainMenu.hasAttribute("hidden") && !mainMenu.classList.contains("is-save-prompt"));
}

function setLanguage(nextLanguage) {
  currentLanguage = nextLanguage === "en" ? "en" : "zh-CN";
  document.documentElement.lang = currentLanguage;
  canvas.dataset.language = currentLanguage;
  updateMainMenuText();
  if (controls) {
    updateBuffCards(controls.getState());
    updateDetectorHud();
    renderInventoryBar();
    updateActionButtonState();
  }
  if (world) {
    syncLevelHud();
    if (lastMetrics) updateItemInfo(lastMetrics);
  }
  if (exitOverlay && !exitOverlay.hasAttribute("hidden")) {
    if (gameFailed) updateFailureRestartButton();
    if (levelTransition) {
      updateLevelTransitionOverlayText();
    } else {
      setExitOverlayTime();
    }
  }
  if (isPaused) {
    if (pauseTitle) pauseTitle.textContent = formatLocalizedStatus("pauseTitle");
    if (pauseSubtitle) pauseSubtitle.textContent = formatLocalizedStatus("pauseSubtitle");
    updatePauseOverlay();
  }
  if (documentReaderId) renderDocumentReader();
  try {
    window.localStorage?.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
  } catch {
    // Language fallback is non-critical.
  }
}

updateMainMenuText();

function loadIntegerSet(key) {
  try {
    const raw = window.localStorage?.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed
        .filter((n) => Number.isInteger(n) && n >= HUB_LEVEL && n <= 8)
        .map((n) => n === 8 ? HUB_LEVEL : n),
    );
  } catch {
    return new Set();
  }
}

function loadStringSet(key) {
  try {
    const raw = window.localStorage?.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((s) => typeof s === "string"));
  } catch {
    return new Set();
  }
}

function saveIntegerSet(key, set) {
  try {
    window.localStorage?.setItem(key, JSON.stringify([...set].sort((a, b) => a - b)));
  } catch {
    // localStorage may be unavailable.
  }
}

function saveStringSet(key, set) {
  try {
    window.localStorage?.setItem(key, JSON.stringify([...set].sort()));
  } catch {
    // localStorage may be unavailable.
  }
}

let reachedLevels = loadIntegerSet(REACHED_KEY);
let completedLevels = loadIntegerSet(COMPLETED_KEY);
let pickedUpItems = loadStringSet(PICKED_UP_KEY);

{
  const initialLevel = getInitialLevel();
  reachedLevels.add(initialLevel);
  saveIntegerSet(REACHED_KEY, reachedLevels);
}

function getLocalizedText(collection, id) {
  return collection[currentLanguage]?.[id] ?? collection.en?.[id] ?? collection["zh-CN"]?.[id] ?? {};
}

function getLevelDangerInfo(levelOrInfo) {
  return resolveLevelDangerInfo(levelOrInfo, currentLanguage, getBackroomsLevelInfo);
}

function setLevelDangerIndicator(element, levelOrInfo, { hidden = false } = {}) {
  renderLevelDangerIndicator(element, levelOrInfo, {
    hidden,
    language: currentLanguage,
    getLevelInfo: getBackroomsLevelInfo,
  });
}

function getLevelDocument(id) {
  const documentData = LEVEL_DOCUMENTS[id];
  if (!documentData) return null;
  return documentData[currentLanguage] ?? documentData.en ?? null;
}

function renderDocumentReader() {
  const documentData = getLevelDocument(documentReaderId);
  if (!documentData || !documentReaderBody) return;
  if (documentReaderEyebrow) documentReaderEyebrow.textContent = documentData.eyebrow;
  if (documentReaderTitle) documentReaderTitle.textContent = documentData.title;
  if (documentReaderHint) documentReaderHint.textContent = documentData.hint;
  if (documentReaderClose) documentReaderClose.setAttribute("aria-label", documentData.hint);

  const fragment = document.createDocumentFragment();
  documentData.sections.forEach((section) => {
    const block = window.document.createElement("section");
    const heading = window.document.createElement("h3");
    const text = window.document.createElement("p");
    heading.textContent = section.heading;
    text.textContent = section.text;
    block.append(heading, text);
    fragment.append(block);
  });
  documentReaderBody.replaceChildren(fragment);
}

function openDocumentReader(id) {
  if (!getLevelDocument(id) || !documentReader) return false;
  documentReaderId = id;
  renderDocumentReader();
  documentReader.removeAttribute("hidden");
  canvas.dataset.documentReader = id;
  if (document.pointerLockElement === canvas && document.exitPointerLock) {
    try {
      document.exitPointerLock();
    } catch {
      // Reading remains available when pointer lock cleanup is unavailable.
    }
  }
  window.requestAnimationFrame(() => documentReader.classList.add("is-visible"));
  return true;
}

function closeDocumentReader() {
  if (!documentReaderId && documentReader?.hasAttribute("hidden")) return;
  documentReaderId = null;
  canvas.dataset.documentReader = "";
  documentReader?.classList.remove("is-visible");
  documentReader?.setAttribute("hidden", "");
}

function isDocumentReaderOpen() {
  return Boolean(documentReaderId && documentReader && !documentReader.hasAttribute("hidden"));
}

function getInventoryItemLabel(id) {
  const statusLabel = getLocalizedText(STATUS_TEXT, id);
  if (typeof statusLabel === "string" && statusLabel) return statusLabel;

  const decorativeText =
    DECORATIVE_ITEM_DEFS[id]?.i18n?.[currentLanguage] ??
    DECORATIVE_ITEM_DEFS[id]?.i18n?.en;
  if (typeof decorativeText?.name === "string" && decorativeText.name) {
    return decorativeText.name;
  }

  const worldItemText = getWorldItemDefinition(id)?.i18n?.[currentLanguage]
    ?? getWorldItemDefinition(id)?.i18n?.en;
  if (typeof worldItemText?.name === "string" && worldItemText.name) return worldItemText.name;

  return typeof id === "string" && id ? id.toUpperCase() : "UNKNOWN ITEM";
}

function isTypingTarget(target) {
  const tagName = target?.tagName;
  return Boolean(target?.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA");
}

function findInventoryIndex(id) {
  return inventory.findIndex((entry) => entry.id === id);
}

function getInventoryCount(id) {
  const entry = inventory[findInventoryIndex(id)];
  return entry ? entry.count : 0;
}

function sortInventory(preferredId = null) {
  const equippedId = preferredId ?? getEquipped()?.id ?? null;
  inventory.sort((a, b) => {
    const aOrder = INVENTORY_ORDER.indexOf(a.id);
    const bOrder = INVENTORY_ORDER.indexOf(b.id);
    return (aOrder === -1 ? 99 : aOrder) - (bOrder === -1 ? 99 : bOrder);
  });
  equippedIndex = equippedId ? findInventoryIndex(equippedId) : Math.min(equippedIndex, inventory.length - 1);
  if (inventory.length === 0) equippedIndex = -1;
  if (equippedIndex < 0 && inventory.length > 0) equippedIndex = 0;
}

function addInventory(id, { silent = false } = {}) {
  const def = INVENTORY_DEFS[id];
  if (!def) return false;
  const existing = inventory[findInventoryIndex(id)];
  if (existing) {
    if (def.stackable) {
      if (def.maxStack && existing.count >= def.maxStack) return false;
      existing.count += 1;
    }
    sortInventory(id);
    markDirty();
    return true;
  }
  inventory.push({ id, count: def.unique ? 1 : 1, type: def.type });
  sortInventory(id);
  markDirty();
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
  markDirty();
  return true;
}

function dropEquippedItem() {
  if (!world || !worldItems || exitComplete || gameFailed || levelTransition || isPaused || isDocumentReaderOpen()) return false;
  if (controls?.getState?.().isDrinking) return false;
  const equipped = getEquipped();
  const droppedState = equipped?.id === "flashlight"
    ? { battery: flashlightBattery }
    : equipped?.id === "detector"
      ? { activeTimer: detectorActiveTimer, cooldownTimer: detectorCooldownTimer }
      : null;
  if (!equipped || !removeInventory(equipped.id)) return false;
  const playerState = controls?.getPlayerState?.();
  worldItems.drop(
    equipped.id,
    world.camera.position,
    playerState?.yaw ?? world.camera.rotation.y,
    droppedState,
  );
  if (equipped.id === "flashlight" && getInventoryCount("flashlight") <= 0) {
    flashlightOwned = false;
    flashlightOn = false;
    flashlightBattery = 0;
  }
  if (equipped.id === "detector" && getInventoryCount("detector") <= 0) {
    detectorOwned = false;
    detectorActiveTimer = 0;
    detectorCooldownTimer = 0;
  }
  const definition = DECORATIVE_ITEM_DEFS[equipped.id];
  const embedded = definition?.i18n?.[currentLanguage] ?? definition?.i18n?.en;
  const itemName = getInventoryItemLabel(equipped.id) || embedded?.name;
  pickupFlashText = formatLocalizedStatus("itemDropped", { item: itemName });
  pickupFlashUntil = clock.elapsedTime + 1.4;
  renderInventoryBar();
  updateFlashlightHud();
  updateDetectorHud();
  markDirty();
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

function formatDuration(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

function resetExitDoorState() {
  exitDoorOpen = false;
  canvas.dataset.exitDoorOpen = "false";
  canvas.dataset.exitDoorReady = "false";
}

function getCurrentExitDistance(metrics = lastMetrics) {
  if (world?.targetPosition && world?.camera?.position) {
    return Math.hypot(
      world.camera.position.x - world.targetPosition.x,
      world.camera.position.z - world.targetPosition.z,
    );
  }
  return Number.isFinite(metrics?.exitDistance) ? metrics.exitDistance : Infinity;
}

function getExitDoorInteraction(metrics = lastMetrics) {
  if (!world?.targetPosition || exitComplete || gameFailed || levelTransition) return null;
  if (world.exitMode === "fall" || world.exitMode === "network") return null;
  const distance = getCurrentExitDistance(metrics);
  if (!Number.isFinite(distance)) return null;
  const promptRadius = exitDoorOpen ? EXIT_DOOR_INTERACT_RADIUS * 1.35 : EXIT_DOOR_INTERACT_RADIUS;
  const withinPrompt = distance <= promptRadius;
  if (!withinPrompt) return null;
  return {
    id: exitDoorOpen ? "exit-elevator-door-open" : "exit-elevator-door",
    type: "interaction",
    distance,
    available: !exitDoorOpen && distance <= EXIT_DOOR_INTERACT_RADIUS,
    exitDoor: true,
  };
}

function shouldEnterExit(metrics = lastMetrics) {
  if (world?.exitMode === "fall" || world?.exitMode === "network") return Boolean(metrics?.exitReached);
  return exitDoorOpen && getCurrentExitDistance(metrics) <= EXIT_ELEVATOR_ENTER_RADIUS;
}

function withExitDoorMetrics(metrics) {
  if (!metrics) return metrics;
  if (world?.exitMode === "fall" || world?.exitMode === "network") {
    canvas.dataset.exitDoorOpen = "false";
    canvas.dataset.exitDoorReady = "false";
    return { ...metrics, rawExitReached: metrics.exitReached };
  }
  const exitInteraction = getExitDoorInteraction(metrics);
  const readyToEnter = shouldEnterExit(metrics);
  canvas.dataset.exitDoorOpen = String(exitDoorOpen);
  canvas.dataset.exitDoorReady = String(readyToEnter);
  if (!exitInteraction) {
    return { ...metrics, rawExitReached: metrics.exitReached, exitReached: readyToEnter };
  }
  return {
    ...metrics,
    rawExitReached: metrics.exitReached,
    exitReached: readyToEnter,
    focusInteraction: exitInteraction,
    exitDoorOpen,
    exitInteraction,
  };
}

function expireCompassAtExit({ silent = true } = {}) {
  if (getInventoryCount("compass") <= 0) return false;
  while (removeInventory("compass")) {
    // Compass is single-use for the current level; remove all saved copies defensively.
  }
  renderInventoryBar();
  updateCompassHud(lastMetrics);
  if (!silent) {
    pickupFlashText = formatLocalizedStatus("compassExpired");
    pickupFlashUntil = clock.elapsedTime + 1.5;
  }
  return true;
}

function openExitDoor() {
  const interaction = getExitDoorInteraction(lastMetrics);
  if (!interaction?.available) return false;
  exitDoorOpen = true;
  canvas.dataset.exitDoorOpen = "true";
  canvas.dataset.lastInteraction = interaction.id;
  canvas.dataset.lastInteractionCount = "1";
  expireCompassAtExit();
  pickupFlashText = formatLocalizedStatus("exitDoorOpened");
  pickupFlashUntil = clock.elapsedTime + 1.9;
  useButton?.classList.add("is-active");
  window.setTimeout(() => useButton?.classList.remove("is-active"), 140);
  return true;
}

function getLevelPickerState(level) {
  const lv = Number(level);
  const info = getBackroomsLevelInfo(lv);
  const reached = reachedLevels.has(lv);
  const completed = completedLevels.has(lv);
  let label = info.levelLabel;
  if (completed) label += ` - ${formatLocalizedStatus("levelCleared")}`;
  else if (!reached) label += ` - ${formatLocalizedStatus("levelLocked")}`;
  return { level: lv, info, reached, completed, label };
}

function isLevelPickerOpen() {
  return levelPicker?.dataset.open === "true";
}

function renderLevelPickerMenu() {
  if (!levelPickerMenu || !world) return;
  const fragment = document.createDocumentFragment();
  for (let lv = 0; lv <= 8; lv += 1) {
    const state = getLevelPickerState(lv);
    if (!state.reached) continue;
    const option = document.createElement("button");
    option.type = "button";
    option.className = "level-picker__option";
    option.dataset.level = String(lv);
    option.dataset.reached = state.reached ? "true" : "false";
    option.dataset.completed = state.completed ? "true" : "false";
    option.dataset.current = lv === world.level ? "true" : "false";
    option.disabled = true;
    option.title = state.info.levelName;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", lv === world.level ? "true" : "false");

    const label = document.createElement("span");
    label.className = "level-picker__option-label";
    const name = document.createElement("strong");
    name.textContent = state.info.levelLabel;
    const subtitle = document.createElement("small");
    subtitle.textContent = state.info.levelName;
    label.append(name, subtitle);

    const status = document.createElement("span");
    status.className = "level-picker__option-status";
    status.textContent = lv === world.level
      ? formatLocalizedStatus("levelCurrent")
      : formatLocalizedStatus("levelVisited");

    option.append(label, status);
    fragment.append(option);
  }
  levelPickerMenu.replaceChildren(fragment);
}

function setLevelPickerOpen(open) {
  if (!levelPicker || !levelPickerButton || !levelPickerMenu) return;
  const nextOpen = Boolean(open);
  levelPicker.dataset.open = nextOpen ? "true" : "false";
  levelPickerButton.setAttribute("aria-expanded", nextOpen ? "true" : "false");
  if (nextOpen) {
    renderLevelPickerMenu();
    levelPickerMenu.removeAttribute("hidden");
  } else {
    levelPickerMenu.setAttribute("hidden", "");
  }
}

function syncLevelPicker() {
  if (!levelPicker || !levelPickerButton || !levelPickerLabel || !world) return;
  const current = getLevelPickerState(world.level);
  levelPickerLabel.textContent = current.label;
  levelPicker.dataset.currentCompleted = current.completed ? "true" : "false";
  levelPicker.dataset.currentLevel = String(world.level);
  levelPickerButton.title = world.levelName;
  renderLevelPickerMenu();
}

function chooseLevel(nextLevel) {
  if (!world) return;
  if (nextLevel === world.level) {
    setLevelPickerOpen(false);
    levelPickerButton?.focus();
    return;
  }
  if (!reachedLevels.has(nextLevel)) {
    flashPickupHint("levelLockedHint", 1400);
    syncLevelPicker();
    return;
  }
  setLevelPickerOpen(false);
  levelPickerButton?.blur();
  expireCompassAtExit({ silent: true });
  levelTransition = null;
  exitComplete = false;
  gameFailed = false;
  playerHealthCooldown = 0;
  resetExitDoorState();
  canvas.dataset.transitioning = "false";
  canvas.dataset.exitReached = "false";
  canvas.dataset.gameFailed = "false";
  hideExitOverlay();
  loadLevel(nextLevel, { updateUrl: true });
  showLevelDangerBriefing(getBackroomsLevelInfo(nextLevel));
}

let levelPickerActivationAt = -Infinity;

function recentlyHandledLevelPickerActivation() {
  return performance.now() - levelPickerActivationAt < 320;
}

function markLevelPickerActivation() {
  levelPickerActivationAt = performance.now();
}

function shouldHandleLevelPickerActivation(event) {
  event.preventDefault();
  event.stopPropagation();
  if ((event.type === "mousedown" || event.type === "click") && recentlyHandledLevelPickerActivation()) {
    return false;
  }
  markLevelPickerActivation();
  return true;
}

function getLevelPickerOptionFromEvent(event) {
  return event.target instanceof Element ? event.target.closest(".level-picker__option") : null;
}

function handleLevelPickerButtonActivation(event) {
  if (!shouldHandleLevelPickerActivation(event)) return;
  setLevelPickerOpen(!isLevelPickerOpen());
}

function handleLevelPickerOptionActivation(event) {
  const option = getLevelPickerOptionFromEvent(event);
  if (!option || option.disabled) return;
  if (!shouldHandleLevelPickerActivation(event)) return;
  chooseLevel(Number(option.dataset.level));
}

function syncLevelHud() {
  syncLevelPicker();
  if (loadingLevelLabel) loadingLevelLabel.textContent = world.levelLabel;
  setLevelDangerIndicator(loadingDanger, world.level);
  canvas.dataset.level = String(world.level);
  canvas.dataset.levelName = world.levelName;
  canvas.dataset.levelDanger = getLevelDangerInfo(world.level).danger;
  canvas.dataset.viewModel = world.viewModelName ?? "NONE";
  canvas.dataset.colliderCount = String(world.colliderCount ?? 0);
  canvas.dataset.reachedLevels = [...reachedLevels].sort((a, b) => a - b).join(",");
  canvas.dataset.completedLevels = [...completedLevels].sort((a, b) => a - b).join(",");
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

function buildLevelInitialState(level, save) {
  if (!save) return null;
  return {
    pickups: save.pickups?.[level] ?? {},
    interactions: save.interactions?.[level] ?? {},
    // Always start a level visit with objectives.reached = false. The saved
    // flag is a historical record ("this level's exit was triggered in a
    // previous run") — restoring it on re-entry would make the scene's
    // first frame report metrics.exitReached = true, which would queue
    // beginLevelTransition and, 1.25s later, auto-switch the player to
    // world.nextLevel. The authoritative "completed" state for UI and
    // dataset purposes is the separate completedLevels Set, not this flag.
    objectives: { reached: false },
    entities: save.entities?.[level] ?? [],
  };
}

function applySaveToRuntime(save) {
  if (!save) return;
  inventory.length = 0;
  const equippedId = save.inventory?.[save.equippedIndex]?.id ?? null;
  for (const entry of save.inventory) {
    inventory.push({ id: entry.id, count: entry.count, type: entry.type });
  }
  sortInventory(equippedId);
  flashlightOwned = Boolean(save.flashlight?.owned);
  flashlightOn = Boolean(save.flashlight?.on) && flashlightOwned;
  flashlightBattery = Number.isFinite(save.flashlight?.battery) ? save.flashlight.battery : 0;
  detectorOwned = Boolean(save.detector?.owned);
  detectorActiveTimer = Number.isFinite(save.detector?.activeTimer) ? save.detector.activeTimer : 0;
  detectorCooldownTimer = Number.isFinite(save.detector?.cooldownTimer)
    ? save.detector.cooldownTimer
    : 0;
  runTime = Number.isFinite(save.player?.runTime) ? save.player.runTime : 0;
}

function writeSaveSnapshot() {
  if (isResettingProgress || !world || !controls || gameFailed) return false;
  const snapshot = world.getSnapshot?.();
  const playerState = controls.getPlayerState();
  const level = world.level;
  const player = {
    level,
    position: playerState.position,
    yaw: playerState.yaw,
    pitch: playerState.pitch,
    stamina: playerState.stamina,
    staminaMax: playerState.staminaMax,
    staminaBaseMax: playerState.staminaBaseMax,
    staminaRecoveryDelay: playerState.staminaRecoveryDelay,
    almondWaterTimer: playerState.almondWaterTimer,
    superAlmondWaterTimer: playerState.superAlmondWaterTimer,
    health: playerState.health,
    healthMax: playerState.healthMax,
    healthRegenTimer: playerState.healthRegenTimer,
    healthRegenRemaining: playerState.healthRegenRemaining,
    healthRegenRate: playerState.healthRegenRate,
    silenceLiquidTimer: playerState.silenceLiquidTimer,
    isSprinting: playerState.isSprinting,
    sprintExhausted: playerState.sprintExhausted,
    isDrinking: playerState.isDrinking,
    drinkTimer: playerState.drinkTimer,
    drinkItemId: playerState.drinkItemId,
    drinkStaminaBonus: playerState.drinkStaminaBonus,
    runTime,
  };
  const payload = {
    player,
    inventory: inventory.map((entry) => ({ id: entry.id, count: entry.count, type: entry.type })),
    equippedIndex,
    flashlight: { owned: flashlightOwned, on: flashlightOn, battery: flashlightBattery },
    detector: {
      owned: detectorOwned,
      activeTimer: detectorActiveTimer,
      cooldownTimer: detectorCooldownTimer,
    },
    pickups: snapshot?.pickups ? { [level]: snapshot.pickups } : {},
    interactions: snapshot?.interactions ? { [level]: snapshot.interactions } : {},
    objectives: snapshot?.objectives ? { [level]: snapshot.objectives } : {},
    entities: snapshot?.entities ? { [level]: snapshot.entities } : {},
    worldItems: { [level]: worldItems?.getState?.() ?? [] },
  };
  return writeSave(payload);
}

function markDirty() {
  if (gameFailed || !world) return;
  if (saveDirtyTimer) {
    window.clearTimeout(saveDirtyTimer);
  }
  saveDirtyTimer = window.setTimeout(() => {
    saveDirtyTimer = 0;
    writeSaveSnapshot();
  }, SAVE_DEBOUNCE_MS);
}

function loadLevel(level, { updateUrl = false } = {}) {
  if (world && !gameFailed) {
    writeSaveSnapshot();
  }
  ambientHum.stopAllEntityAudio();
  const previousWorld = world;
  reachedLevels.add(level);
  saveIntegerSet(REACHED_KEY, reachedLevels);

  const save = loadSave();
  const initialStateForLevel = buildLevelInitialState(level, save);

  world = createBackroomsScene(level, { initialState: initialStateForLevel });
  worldItems = createWorldItemManager(
    world.scene,
    world.decorativeItemSpawns ?? [],
    save?.worldItems?.[level] ?? null,
    world.worldItemOptions,
  );
  attachFlashlightToCamera(world.camera);
  attachDebugAreaLightToCamera(world.camera);
  controls.setWorld({
    camera: world.camera,
    isWalkable: world.isWalkable,
    getFloorHeight: world.getFloorHeight,
    spawn: world.spawn,
  });
  syncDebugState();
  if (
    save &&
    save.player &&
    save.player.level === level &&
    (world.isWalkable?.(save.player.position.x, save.player.position.z) ?? true)
  ) {
    const pos = save.player.position;
    world.camera.position.set(pos.x, pos.y, pos.z);
    controls.applyState(save.player);
  }
  syncDebugState();
  exitComplete = false;
  gameFailed = false;
  playerHealthCooldown = 0;
  resetExitDoorState();
  canvas.dataset.exitReached = "false";
  canvas.dataset.gameFailed = "false";
  entityMarkers?.replaceChildren();
  syncLevelHud();
  if (updateUrl) updateLevelUrl(world.level);
  resize();
  disposeWorld(previousWorld);
}

function bootstrapWorld(level, save) {
  applySaveToRuntime(save);
  const initialState = buildLevelInitialState(level, save);
  world = createBackroomsScene(level, { initialState });
  worldItems = createWorldItemManager(
    world.scene,
    world.decorativeItemSpawns ?? [],
    save?.worldItems?.[level] ?? null,
    world.worldItemOptions,
  );
  attachFlashlightToCamera(world.camera);
  attachDebugAreaLightToCamera(world.camera);
  controls = new FirstPersonControls({
    camera: world.camera,
    canvas,
    joystick,
    jumpButton,
    isWalkable: world.isWalkable,
    getFloorHeight: world.getFloorHeight,
    spawn: world.spawn,
  });
  controls.notifyDrinkComplete = handleDrinkComplete;
  if (
    save &&
    save.player &&
    save.player.level === level &&
    (world.isWalkable?.(save.player.position.x, save.player.position.z) ?? true)
  ) {
    const pos = save.player.position;
    world.camera.position.set(pos.x, pos.y, pos.z);
    controls.applyState(save.player);
  }
  syncDebugState();
  exitComplete = false;
  gameFailed = false;
  playerHealthCooldown = 0;
  resetExitDoorState();
  canvas.dataset.exitReached = "false";
  canvas.dataset.gameFailed = "false";
  entityMarkers?.replaceChildren();
  syncLevelHud();
  updateLevelUrl(level);
  resize();
  renderInventoryBar();
  gameStarted = true;
  scheduleTutorial();
  if (!animationFrameStarted) {
    animationFrameStarted = true;
    animate();
  }
}

function showMainMenu() {
  hideGameplayUi();
  loadingComplete = false;
  mainMenu?.removeAttribute("hidden");
  mainMenu?.classList.remove("is-leaving", "is-save-prompt");
  setMainMenuSettingsOpen(false);
  updateMainMenuText();
}

function leaveMainMenu() {
  setMainMenuSettingsOpen(false);
  mainMenu?.classList.remove("is-save-prompt");
  mainMenu?.classList.add("is-leaving");
  window.setTimeout(() => {
    if (mainMenu?.classList.contains("is-leaving")) mainMenu.setAttribute("hidden", "");
  }, 300);
}

function beginGameSession(level, save) {
  leaveMainMenu();
  showGameplayUi();
  bootstrapWorld(level, save);
}

function handleMainMenuStart() {
  startAudioOnce();
  if (debugMode.queryEnabled) {
    let debugSave = null;
    try {
      debugSave = hasSavedGame() ? loadSave() : null;
    } catch {
      debugSave = null;
    }
    beginGameSession(getInitialLevel(), debugSave);
    return;
  }
  let save = null;
  try {
    save = hasSavedGame() ? loadSave() : null;
  } catch {
    save = null;
  }

  if (save) {
    pendingSaveForPrompt = save;
    mainMenu?.classList.add("is-save-prompt");
    setMainMenuSettingsOpen(false);
    showSavePrompt(save);
    return;
  }

  beginGameSession(getInitialLevel(), null);
}

function setExitOverlayText(title, subtitle) {
  if (exitOverlayTitle) exitOverlayTitle.textContent = title;
  if (exitOverlaySubtitle) exitOverlaySubtitle.textContent = subtitle;
}

function setExitOverlayDetail(text) {
  if (!exitOverlayTime) return;
  exitOverlayTime.textContent = text;
  exitOverlayTime.removeAttribute("hidden");
}

function setExitOverlayTime() {
  setExitOverlayDetail(formatLocalizedStatus("exitTotalTime", { time: formatDuration(runTime) }));
}

function hideExitOverlayTime() {
  if (!exitOverlayTime) return;
  exitOverlayTime.setAttribute("hidden", "");
}

function updateFailureRestartButton() {
  if (exitOverlayRestartLabel) {
    exitOverlayRestartLabel.textContent = formatLocalizedStatus("failureRestartLabel");
  }
  if (exitOverlayRestartHint) {
    exitOverlayRestartHint.textContent = formatLocalizedStatus("failureRestartHint");
  }
}

function updateExitOverlayContinueButton() {
  if (exitOverlayContinueLabel) {
    exitOverlayContinueLabel.textContent = formatLocalizedStatus("exitContinueLabel");
  }
  if (exitOverlayContinueHint) {
    exitOverlayContinueHint.textContent = formatLocalizedStatus("exitContinueHint");
  }
}

function setExitOverlayFailureState(failed) {
  exitOverlay?.classList.toggle("is-failed", failed);
  if (failed) {
    updateFailureRestartButton();
    exitOverlayRestart?.removeAttribute("hidden");
    if (document.pointerLockElement === canvas && document.exitPointerLock) {
      try {
        document.exitPointerLock();
      } catch {
        // ignore pointer lock cleanup failures
      }
    }
  } else {
    exitOverlayRestart?.setAttribute("hidden", "");
  }
}

function setExitOverlayCompletionState(completed) {
  exitOverlay?.classList.toggle("is-complete", completed);
  if (completed) {
    updateExitOverlayContinueButton();
    exitOverlayContinue?.removeAttribute("hidden");
    if (document.pointerLockElement === canvas && document.exitPointerLock) {
      try {
        document.exitPointerLock();
      } catch {
        // ignore pointer lock cleanup failures
      }
    }
  } else {
    exitOverlayContinue?.setAttribute("hidden", "");
  }
}

function updateTimerReadout() {
  if (!timerReadoutValue) return;
  timerReadoutValue.textContent = formatDuration(runTime);
}

function updatePauseOverlay() {
  if (pauseTitle) pauseTitle.textContent = formatLocalizedStatus("pauseTitle");
  if (pauseSubtitle) pauseSubtitle.textContent = formatLocalizedStatus("pauseSubtitle");
  if (pauseTimeLabel) pauseTimeLabel.textContent = formatLocalizedStatus("pauseElapsedLabel");
  if (pauseTimeReadout) pauseTimeReadout.textContent = formatDuration(runTime);
  if (pauseSettingsLabel) pauseSettingsLabel.textContent = formatLocalizedStatus("pauseSettingsLabel");
  if (pauseSettingsHint) pauseSettingsHint.textContent = formatLocalizedStatus("pauseSettingsHint");
  if (pauseSettingsTitle) pauseSettingsTitle.textContent = formatLocalizedStatus("pauseSettingsTitle");
  if (pauseSettingsClose) pauseSettingsClose.setAttribute("aria-label", formatLocalizedStatus("pauseSettingsClose"));
  pauseLanguageZh?.setAttribute("aria-pressed", String(currentLanguage === "zh-CN"));
  pauseLanguageEn?.setAttribute("aria-pressed", String(currentLanguage === "en"));
}

function setPauseSettingsOpen(open) {
  const nextOpen = Boolean(open) && isPaused;
  pauseSettingsPanel?.toggleAttribute("hidden", !nextOpen);
  pauseSettingsButton?.setAttribute("aria-expanded", String(nextOpen));
  pauseOverlay?.classList.toggle("is-settings-open", nextOpen);
  if (nextOpen) pauseSettingsClose?.focus();
}

function showExitOverlay(title, subtitle, { showTime = true, variantClass = "", failed = false, complete = false } = {}) {
  setExitOverlayText(title, subtitle);
  if (showTime) {
    setExitOverlayTime();
  } else {
    hideExitOverlayTime();
  }
  if (exitOverlayHideTimer) {
    window.clearTimeout(exitOverlayHideTimer);
    exitOverlayHideTimer = 0;
  }
  exitOverlay?.classList.remove("is-level-transition", "is-level-loaded", "is-failed", "is-complete");
  if (variantClass) exitOverlay?.classList.add(variantClass);
  setExitOverlayFailureState(failed);
  setExitOverlayCompletionState(complete);
  exitOverlay?.removeAttribute("hidden");
  window.requestAnimationFrame(() => exitOverlay?.classList.add("is-visible"));
}

function hideExitOverlay() {
  const hideDelay = exitOverlay?.classList.contains("is-level-transition")
    ? LEVEL_TRANSITION_FADE_OUT_MS
    : OVERLAY_FADE_MS;
  exitOverlay?.classList.remove("is-visible");
  exitOverlayDanger?.setAttribute("hidden", "");
  setExitOverlayFailureState(false);
  setExitOverlayCompletionState(false);
  if (exitOverlayHideTimer) window.clearTimeout(exitOverlayHideTimer);
  exitOverlayHideTimer = window.setTimeout(() => {
    exitOverlay?.setAttribute("hidden", "");
    exitOverlay?.classList.remove("is-level-transition", "is-level-loaded", "is-failed", "is-complete");
    hideExitOverlayTime();
    exitOverlayHideTimer = 0;
  }, hideDelay);
}

function updateLevelTransitionOverlayText(transition = levelTransition) {
  if (!transition?.nextLevelInfo) return;
  setExitOverlayText(transition.nextLevelInfo.levelLabel, transition.nextLevelInfo.levelName);
  setLevelDangerIndicator(exitOverlayDanger, transition.nextLevelInfo);
  setExitOverlayDetail(
    formatLocalizedStatus(transition.loaded ? "levelTransitionReady" : "levelTransitionHint"),
  );
}

function showLevelDangerBriefing(levelInfo) {
  if (!levelInfo) return;
  if (levelBriefingTimer) window.clearTimeout(levelBriefingTimer);
  showExitOverlay(levelInfo.levelLabel, levelInfo.levelName, {
    showTime: false,
    variantClass: "is-level-transition",
  });
  setLevelDangerIndicator(exitOverlayDanger, levelInfo);
  levelBriefingTimer = window.setTimeout(() => {
    levelBriefingTimer = 0;
    hideExitOverlay();
  }, 1100);
}

function beginLevelTransition(nextLevel) {
  const nextLevelInfo = getBackroomsLevelInfo(nextLevel);
  if (levelBriefingTimer) {
    window.clearTimeout(levelBriefingTimer);
    levelBriefingTimer = 0;
  }
  expireCompassAtExit();
  completedLevels.add(world.level);
  reachedLevels.add(nextLevelInfo.level);
  saveIntegerSet(COMPLETED_KEY, completedLevels);
  saveIntegerSet(REACHED_KEY, reachedLevels);
  levelTransition = {
    nextLevel: nextLevelInfo.level,
    nextLevelInfo,
    elapsed: 0,
    loaded: false,
  };
  canvas.dataset.transitioning = "true";
  canvas.dataset.transitionPhase = "fade-in";
  canvas.dataset.exitReached = "true";
  showExitOverlay(nextLevelInfo.levelLabel, nextLevelInfo.levelName, {
    showTime: false,
    variantClass: "is-level-transition",
  });
  updateLevelTransitionOverlayText();
}

function updateLevelTransition(delta) {
  if (!levelTransition) return;
  levelTransition.elapsed += delta * 1000;

  if (!levelTransition.loaded && levelTransition.elapsed >= LEVEL_TRANSITION_LOAD_AT_MS) {
    const nextLevel = levelTransition.nextLevel;
    levelTransition.loaded = true;
    canvas.dataset.transitionPhase = "fade-out";
    loadLevel(nextLevel, { updateUrl: true });
    exitOverlay?.classList.add("is-level-loaded");
    updateLevelTransitionOverlayText();
    hideExitOverlay();
  }

  if (levelTransition.elapsed < LEVEL_TRANSITION_MS) return;

  levelTransition = null;
  canvas.dataset.transitioning = "false";
  canvas.dataset.transitionPhase = "";
  canvas.dataset.exitReached = "false";
}

function continueExploringFromExit() {
  if (!world || !controls || !exitComplete || gameFailed || levelTransition) return;
  expireCompassAtExit({ silent: true });
  writeSaveSnapshot();
  exitComplete = false;
  canvas.dataset.exitReached = "false";
  hideExitOverlay();
  loadLevel(HUB_LEVEL, { updateUrl: true });
  writeSaveSnapshot();
}

levelPickerButton?.addEventListener("pointerdown", handleLevelPickerButtonActivation);
levelPickerButton?.addEventListener("mousedown", handleLevelPickerButtonActivation);
levelPickerButton?.addEventListener("click", handleLevelPickerButtonActivation);

levelPickerButton?.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowDown" && event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  event.stopPropagation();
  markLevelPickerActivation();
  setLevelPickerOpen(true);
  const current =
    levelPickerMenu?.querySelector('[data-current="true"]:not(:disabled)') ??
    levelPickerMenu?.querySelector(".level-picker__option:not(:disabled)");
  current?.focus();
});

levelPickerMenu?.addEventListener("pointerdown", handleLevelPickerOptionActivation);
levelPickerMenu?.addEventListener("mousedown", handleLevelPickerOptionActivation);
levelPickerMenu?.addEventListener("click", handleLevelPickerOptionActivation);

levelPickerMenu?.addEventListener("keydown", (event) => {
  const options = [...levelPickerMenu.querySelectorAll(".level-picker__option:not(:disabled)")];
  if (!options.length) return;

  if (event.key === "Escape" || event.key === "Tab") {
    setLevelPickerOpen(false);
    if (event.key === "Escape") {
      event.preventDefault();
      levelPickerButton?.focus();
    }
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    const option = getLevelPickerOptionFromEvent(event);
    if (!option || option.disabled) return;
    event.preventDefault();
    markLevelPickerActivation();
    chooseLevel(Number(option.dataset.level));
    return;
  }

  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  event.preventDefault();
  const currentIndex = Math.max(0, options.indexOf(document.activeElement));
  const direction = event.key === "ArrowDown" ? 1 : -1;
  const nextIndex = (currentIndex + direction + options.length) % options.length;
  options[nextIndex]?.focus();
});

document.addEventListener("pointerdown", (event) => {
  if (!isLevelPickerOpen() || levelPicker?.contains(event.target)) return;
  setLevelPickerOpen(false);
});

function resize() {
  if (!world) return;
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

function updateHealthHud(controlState) {
  if (!controlState) return;
  const healthMax = Math.max(1, controlState.healthMax ?? HEALTH_MAX);
  const health = Math.max(0, Math.min(healthMax, controlState.health ?? healthMax));
  const ratio = health / healthMax;
  if (healthFill) healthFill.style.transform = `scaleX(${ratio.toFixed(3)})`;
  if (healthReadout) {
    healthReadout.textContent = `${Math.round(health)}/${Math.round(healthMax)}`;
  }
  if (healthMeter) {
    const regenerating = Boolean(controlState.healthRegenerating);
    healthMeter.dataset.state = ratio <= 0.24 ? "low" : regenerating ? "regenerating" : "ready";
  }
  canvas.dataset.health = String(Math.round(health));
  canvas.dataset.healthMax = String(Math.round(healthMax));
  canvas.dataset.healthRatio = ratio.toFixed(3);
  canvas.dataset.healthRegenerating = String(Boolean(controlState.healthRegenerating));
  canvas.dataset.healthRegenRemaining = (controlState.healthRegenRemaining ?? 0).toFixed(1);
  canvas.dataset.silenceLiquidActive = String(Boolean(controlState.silenceLiquidActive));
  canvas.dataset.silenceLiquidRemaining = (controlState.silenceLiquidRemaining ?? 0).toFixed(1);
}

function triggerDamageFlash() {
  if (!appRoot || !damageFlash) return;
  appRoot.classList.remove("is-hurt");
  // Force reflow so the animation can replay on rapid hits.
  void damageFlash.offsetWidth;
  appRoot.classList.add("is-hurt");
  window.setTimeout(() => appRoot.classList.remove("is-hurt"), DAMAGE_FLASH_MS);
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
  const isEquipped = getEquipped()?.id === "flashlight";
  if (flashlightMeter) {
    flashlightMeter.hidden = !isEquipped;
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

function consumeFlashlightUnit() {
  removeInventory("flashlight");
  flashlightOwned = getInventoryCount("flashlight") > 0;
  renderInventoryBar();
  return getInventoryCount("flashlight");
}

function updateFlashlight(delta) {
  if (flashlightOn) {
    flashlightBattery = Math.max(0, flashlightBattery - FLASHLIGHT_DRAIN_RATE * delta);
    if (flashlightBattery <= 0) {
      const remaining = consumeFlashlightUnit();
      if (remaining > 0) {
        flashlightBattery = FLASHLIGHT_BATTERY_MAX;
      } else {
        flashlightOn = false;
        flashlightBattery = 0;
      }
    }
  }

  const ratio = FLASHLIGHT_BATTERY_MAX > 0 ? flashlightBattery / FLASHLIGHT_BATTERY_MAX : 0;
  const levelEffectiveness = Number.isFinite(world?.flashlightEffectiveness)
    ? Math.max(0.42, world.flashlightEffectiveness)
    : 1;
  flashlightLight.intensity =
    flashlightOwned && flashlightOn && flashlightBattery > 0
      ? 34 * Math.max(0.5, ratio) * levelEffectiveness
      : 0;
  flashlightLight.distance = (38 + ratio * 36) * Math.min(1.45, levelEffectiveness);
  updateFlashlightHud();
}

function toggleFlashlight() {
  if (!flashlightOwned || flashlightBattery <= 0) return;
  flashlightOn = !flashlightOn;
  updateFlashlightHud();
  markDirty();
}

function updateDetectorHud() {
  const isEquipped = getEquipped()?.id === "detector";
  if (detectorMeter) {
    detectorMeter.hidden = !isEquipped;
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

function normalizeAngle(angle) {
  let next = angle;
  while (next > Math.PI) next -= Math.PI * 2;
  while (next < -Math.PI) next += Math.PI * 2;
  return next;
}

function formatCompassDirection(angle) {
  const directions = currentLanguage === "en"
    ? ["AHEAD", "FR", "RIGHT", "BR", "BACK", "BL", "LEFT", "FL"]
    : ["\u524d", "\u53f3\u524d", "\u53f3", "\u53f3\u540e", "\u540e", "\u5de6\u540e", "\u5de6", "\u5de6\u524d"];
  const index = Math.round(normalizeAngle(angle) / (Math.PI / 4));
  return directions[((index % directions.length) + directions.length) % directions.length];
}

function updateCompassHud(metrics) {
  const equipped = getEquipped();
  const equippedKeyTarget = getLevelKeyTarget(equipped?.id);
  const isLevelKeyEquipped = world?.level === HUB_LEVEL && equippedKeyTarget !== null;
  const isEquipped = equipped?.id === "compass" || isLevelKeyEquipped;
  const owned = getInventoryCount("compass") > 0;
  const targetPosition = isLevelKeyEquipped
    ? world?.getLevelKeyTargetPosition?.(equippedKeyTarget)
    : world?.targetPosition;
  if (compassMeter) compassMeter.hidden = !isEquipped || (!owned && !isLevelKeyEquipped);
  canvas.dataset.compassOwned = String(owned);
  canvas.dataset.levelKeyTarget = isLevelKeyEquipped ? String(equippedKeyTarget) : "";
  if ((!owned && !isLevelKeyEquipped) || !isEquipped || !targetPosition || !world?.camera) {
    canvas.dataset.compassBearing = "";
    canvas.dataset.compassWorldBearing = "";
    canvas.dataset.compassDirection = "";
    if (compassArrow) compassArrow.style.transform = "rotate(0rad)";
    if (compassReadout) compassReadout.textContent = "--";
    return;
  }

  compassToExit.subVectors(targetPosition, world.camera.position);
  compassToExit.y = 0;
  const targetYaw = Math.atan2(-compassToExit.x, -compassToExit.z);
  const playerState = controls?.getPlayerState?.();
  const currentYaw = Number.isFinite(playerState?.yaw) ? playerState.yaw : world.camera.rotation.y;
  const relative = normalizeAngle(currentYaw - targetYaw);
  const direction = formatCompassDirection(relative);

  if (compassArrow) compassArrow.style.transform = `rotate(${relative.toFixed(4)}rad)`;
  if (compassReadout) {
    compassReadout.textContent = isLevelKeyEquipped ? `L${equippedKeyTarget} · ${direction}` : direction;
  }
  canvas.dataset.compassBearing = String(Math.round((relative * 180) / Math.PI));
  canvas.dataset.compassWorldBearing = String(Math.round((targetYaw * 180) / Math.PI));
  canvas.dataset.compassDirection = direction;
}

function clearEntityMarkers() {
  entityMarkers?.replaceChildren();
}

function clearDebugExitMarkers() {
  debugExitMarkers?.replaceChildren();
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

  const debugActive = isDebugFeaturesActive();
  if (!entityMarkers || (!debugActive && (!detectorOwned || detectorActiveTimer <= 0))) {
    clearEntityMarkers();
    return;
  }

  const entities = entityList.filter(
    (entity) =>
      entity?.active &&
      Number.isFinite(entity.distance) &&
      (debugActive || entity.distance <= DETECTOR_RANGE),
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
        if (entity.id?.includes("hound")) marker.classList.add("entity-marker--hound");
        if (entity.id === "level-seven-thing") marker.classList.add("entity-marker--thing");
        const name = document.createElement("strong");
        name.textContent = getLocalizedText(ENTITY_TEXT, entity.id)?.marker ?? entity.id.toUpperCase();
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

function updateDebugExitMarkers() {
  if (!debugExitMarkers || !isDebugFeaturesActive() || !world?.camera) {
    clearDebugExitMarkers();
    return;
  }
  const routeList = Array.isArray(world.scene?.userData?.exitRoutes) && world.scene.userData.exitRoutes.length > 0
    ? world.scene.userData.exitRoutes
    : world.targetPosition
      ? [{ id: "primary-exit", label: "EXIT", targetLabel: "EXIT", position: world.targetPosition }]
      : [];
  debugExitMarkers.replaceChildren(
    ...routeList
      .map((route) => {
        const position = route?.position;
        if (!Number.isFinite(position?.x) || !Number.isFinite(position?.z)) return null;
        debugExitProjection.set(position.x, 1.65, position.z).project(world.camera);
        if (debugExitProjection.z < -1 || debugExitProjection.z > 1) return null;
        const x = (debugExitProjection.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-debugExitProjection.y * 0.5 + 0.5) * window.innerHeight;
        if (x < -80 || x > window.innerWidth + 80 || y < -80 || y > window.innerHeight + 80) return null;
        const marker = document.createElement("div");
        marker.className = "debug-exit-marker";
        const label = document.createElement("strong");
        label.textContent = "EXIT";
        const destination = document.createElement("span");
        destination.textContent = route.label ?? route.targetLabel ?? "EXIT";
        marker.style.left = `${x}px`;
        marker.style.top = `${y}px`;
        marker.append(label, destination);
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
  markDirty();
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

  const safeEquippedIndex =
    equippedIndex >= 0 && equippedIndex < inventory.length ? equippedIndex : 0;
  const fragment = document.createDocumentFragment();
  inventory.forEach((entry, index) => {
    fragment.append(createInventorySlot(entry, index === safeEquippedIndex));
  });

  inventorySlots.replaceChildren(fragment);
  updateActionButtonState();
  scrollEquippedIntoView(inventorySlots, safeEquippedIndex);
}

function createInventorySlot(entry, isEquipped) {
  const def = INVENTORY_DEFS[entry.id];
  const slot = document.createElement("div");
  slot.className = "inventory-slot";
  slot.dataset.type = entry.id;
  if (isEquipped) slot.dataset.equipped = "true";
  slot.setAttribute("role", "tab");
  slot.setAttribute("aria-selected", isEquipped ? "true" : "false");

  const icon = document.createElement("div");
  icon.className = "inventory-slot__icon";
  icon.appendChild(createItemIcon(entry.id));
  slot.append(icon);

  if (def?.stackable && entry.count > 1) {
    const count = document.createElement("span");
    count.className = "inventory-slot__count";
    count.textContent = String(entry.count);
    slot.append(count);
  }

  if (isEquipped) {
    const name = document.createElement("span");
    name.className = "inventory-slot__name";
    name.textContent = getInventoryItemLabel(entry.id);
    slot.append(name);
  }

  return slot;
}

function scrollEquippedIntoView(container, equippedIndex) {
  if (!container || equippedIndex < 0) return;
  const target = container.children[equippedIndex];
  if (!target) return;
  const barWidth = container.clientWidth;
  const targetLeft = target.offsetLeft;
  const targetWidth = target.offsetWidth;
  const targetRight = targetLeft + targetWidth;
  const viewLeft = container.scrollLeft;
  const viewRight = viewLeft + barWidth;
  if (targetRight > viewRight - 12) {
    container.scrollTo({ left: targetLeft - 12, behavior: "smooth" });
  } else if (targetLeft < viewLeft + 12) {
    container.scrollTo({ left: targetLeft - 12, behavior: "smooth" });
  }
}

function updateActionButtonState() {
  if (!actionButton) return;
  const equipped = getEquipped();
  const hasUsable = Boolean(equipped && equipped.id !== "compass" && !isLevelKeyId(equipped.id));
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

function setPauseState(next, { fromUnlock = false } = {}) {
  if (isPaused === next) return;
  isPaused = next;
  pauseFromUnlock = fromUnlock;
  isInPauseTransition = false;
  canvas.dataset.paused = String(isPaused);
  if (pauseOverlay) {
    pauseOverlay.classList.toggle("is-visible", isPaused);
    if (isPaused) pauseOverlay.removeAttribute("hidden");
  }
  if (isPaused) {
    updatePauseOverlay();
    if (pauseResetLabel && !pauseResetArmed) {
      pauseResetLabel.textContent = formatLocalizedStatus("pauseResetLabel");
    }
    if (pauseResetHint && !pauseResetArmed) {
      pauseResetHint.textContent = formatLocalizedStatus("pauseResetHint");
    }
    if (pauseTutorialLabel) {
      pauseTutorialLabel.textContent = formatLocalizedStatus("pauseTutorialLabel");
    }
    if (pauseTutorialHint) {
      pauseTutorialHint.textContent = formatLocalizedStatus("pauseTutorialHint");
    }
    pauseAccumulatedDelta = clock.getDelta();
    if (document.pointerLockElement === canvas && document.exitPointerLock) {
      try {
        document.exitPointerLock();
      } catch {
        // ignore
      }
    }
    ambientHum.suspend();
  } else {
    setPauseSettingsOpen(false);
    disarmPauseReset();
    clock.getDelta();
    ambientHum.resume();
  }
}

function disarmPauseReset() {
  pauseResetArmed = false;
  if (pauseResetArmedTimer) {
    window.clearTimeout(pauseResetArmedTimer);
    pauseResetArmedTimer = 0;
  }
  if (pauseResetButton) pauseResetButton.classList.remove("is-armed");
  if (pauseResetLabel) pauseResetLabel.textContent = formatLocalizedStatus("pauseResetLabel");
  if (pauseResetHint) pauseResetHint.textContent = formatLocalizedStatus("pauseResetHint");
}

function armPauseReset() {
  pauseResetArmed = true;
  if (pauseResetButton) pauseResetButton.classList.add("is-armed");
  if (pauseResetLabel) pauseResetLabel.textContent = formatLocalizedStatus("pauseResetArmedLabel");
  if (pauseResetHint) pauseResetHint.textContent = formatLocalizedStatus("pauseResetArmedHint");
  if (pauseResetArmedTimer) window.clearTimeout(pauseResetArmedTimer);
  pauseResetArmedTimer = window.setTimeout(() => {
    pauseResetArmedTimer = 0;
    disarmPauseReset();
  }, PAUSE_RESET_ARM_TIMEOUT_MS);
}

function handlePauseTutorial() {
  if (!isPaused) return;
  if (pauseResetArmed) disarmPauseReset();
  showTutorial();
}

function resetAllProgress() {
  isResettingProgress = true;
  if (saveDirtyTimer) {
    window.clearTimeout(saveDirtyTimer);
    saveDirtyTimer = 0;
  }
  if (pauseResetArmedTimer) {
    window.clearTimeout(pauseResetArmedTimer);
    pauseResetArmedTimer = 0;
  }
  try {
    window.localStorage?.removeItem("backrooms-save");
    window.localStorage?.removeItem(REACHED_KEY);
    window.localStorage?.removeItem(COMPLETED_KEY);
    window.localStorage?.removeItem(PICKED_UP_KEY);
  } catch {
    // localStorage may be unavailable.
  }
  inventory.length = 0;
  equippedIndex = -1;
  flashlightOwned = false;
  flashlightOn = false;
  flashlightBattery = 0;
  detectorOwned = false;
  detectorActiveTimer = 0;
  detectorCooldownTimer = 0;
  pickedUpItems.clear();
  runTime = 0;
  reachedLevels = new Set([0]);
  completedLevels = new Set();
  if (controls) {
    controls.health = controls.healthMax;
  }
  playerHealthCooldown = 0;
  window.location.replace(window.location.pathname);
}

function handlePointerLockChange() {
  if (document.pointerLockElement === canvas) return;
  isInPauseTransition = false;
  if (isPaused || exitComplete || gameFailed || levelTransition) return;
  if (pauseFromUnlock) {
    pauseFromUnlock = false;
    setPauseState(true, { fromUnlock: true });
    return;
  }
  setPauseState(true, { fromUnlock: true });
}

function updateTutorialPage() {
  if (!tutorialPages) return;
  tutorialPages.style.transform = `translateX(-${tutorialPage * 100}%)`;
  tutorialDots.forEach((dot, i) => {
    dot.classList.toggle("is-active", i === tutorialPage);
  });
  if (tutorialPrev) {
    tutorialPrev.disabled = tutorialPage === 0;
  }
  if (tutorialNext) {
    const isLast = tutorialPage === TUTORIAL_TOTAL_PAGES - 1;
    tutorialNext.textContent = isLast ? "开始游戏" : "下一步 →";
    tutorialNext.classList.toggle("tutorial-nav__btn--primary", isLast);
  }
}

function showTutorial() {
  if (!tutorialOverlay) return;
  tutorialPage = 0;
  updateTutorialPage();
  tutorialOverlay.removeAttribute("hidden");
  tutorialOverlay.classList.add("is-visible");
  tutorialActive = true;
  canvas.dataset.tutorial = "true";
}

function hideTutorial({ markSeen = true } = {}) {
  if (!tutorialOverlay) return;
  tutorialOverlay.classList.remove("is-visible");
  tutorialOverlay.setAttribute("hidden", "");
  tutorialActive = false;
  delete canvas.dataset.tutorial;
  if (markSeen) {
    try {
      window.localStorage?.setItem(TUTORIAL_SEEN_KEY, "true");
    } catch {
      // ignore storage errors
    }
  }
}

function acquireFlashlight(count) {
  const added = addInventory("flashlight");
  if (!added) {
    pickupFlashText = formatLocalizedStatus("flashlightFull");
    pickupFlashUntil = clock.elapsedTime + 1.4;
    return false;
  }
  flashlightOwned = true;
  flashlightOn = false;
  flashlightBattery = FLASHLIGHT_BATTERY_MAX;
  const wasFirst = getInventoryCount("flashlight") === 1;
  pickupFlashText = formatLocalizedStatus(
    wasFirst ? "flashlightAcquired" : "flashlightRestocked",
  );
  pickupFlashUntil = clock.elapsedTime + 1.7;
  canvas.dataset.flashlightPickups = String(count ?? 1);
  updateFlashlightHud();
  renderInventoryBar();
  markDirty();
  return true;
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
  markDirty();
}

function acquireCompass(count) {
  addInventory("compass");
  pickupFlashText = formatLocalizedStatus("compassAcquired");
  pickupFlashUntil = clock.elapsedTime + 1.7;
  canvas.dataset.compassPickups = String(count ?? 1);
  renderInventoryBar();
  markDirty();
}

function acquireSilenceLiquid(count) {
  addInventory("silence-liquid");
  pickupFlashText = formatLocalizedStatus("silenceLiquidAcquired");
  pickupFlashUntil = clock.elapsedTime + 1.7;
  canvas.dataset.silenceLiquidPickups = String(count ?? 1);
  renderInventoryBar();
  markDirty();
}

function activateSilenceLiquid() {
  if (!controls || getInventoryCount("silence-liquid") <= 0) return false;
  controls.activateSilenceLiquid(SILENCE_LIQUID_DURATION);
  removeInventory("silence-liquid");
  pickupFlashText = formatLocalizedStatus("silenceLiquidUsed", {
    seconds: SILENCE_LIQUID_DURATION,
  });
  pickupFlashUntil = clock.elapsedTime + 1.8;
  canvas.dataset.silenceLiquidUses = String(Number(canvas.dataset.silenceLiquidUses ?? 0) + 1);
  renderInventoryBar();
  markDirty();
  return true;
}

function updatePickupHud(metrics) {
  const almondWater = metrics.almondWater;
  const superAlmondWater = metrics.superAlmondWater;
  const flashlight = metrics.flashlight;
  const detector = metrics.detector;
  const silenceLiquid = metrics.silenceLiquid;
  const compass = metrics.compass;
  const canDrink = Boolean(almondWater?.available);
  const canDrinkSuper = Boolean(superAlmondWater?.available);
  const canTakeFlashlight = Boolean(flashlight?.available);
  const canTakeDetector = Boolean(detector?.available);
  const canTakeSilenceLiquid = Boolean(silenceLiquid?.available);
  const canTakeCompass = Boolean(compass?.available);
  const canInteract = Boolean(metrics.focusInteraction?.available);
  const canUse =
    canDrink ||
    canDrinkSuper ||
    canTakeFlashlight ||
    canTakeDetector ||
    canTakeSilenceLiquid ||
    canTakeCompass ||
    canInteract;
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
  canvas.dataset.silenceLiquidVisible = String(Boolean(silenceLiquid?.visible));
  canvas.dataset.silenceLiquidAvailable = String(canTakeSilenceLiquid);
  canvas.dataset.silenceLiquidDistance = Number.isFinite(silenceLiquid?.distance)
    ? String(Math.round(silenceLiquid.distance))
    : "";
  canvas.dataset.compassVisible = String(Boolean(compass?.visible));
  canvas.dataset.compassAvailable = String(canTakeCompass);
  canvas.dataset.compassDistance = Number.isFinite(compass?.distance)
    ? String(Math.round(compass.distance))
    : "";
  canvas.dataset.focusInteraction = metrics.focusInteraction?.id ?? "";
  canvas.dataset.focusInteractionAvailable = String(canInteract);
}

function findNearestPickupable(metrics) {
  const candidates = getPickupStates(metrics).filter((item) => Number.isFinite(item.distance) && item.available);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0];
}

function getPickupStates(metrics) {
  if (Array.isArray(metrics?.pickups)) return metrics.pickups.filter(Boolean);
  return [
    metrics?.almondWater,
    metrics?.superAlmondWater,
    metrics?.flashlight,
    metrics?.detector,
    metrics?.silenceLiquid,
    metrics?.compass,
  ].filter(Boolean);
}

function findPickupableById(metrics, id) {
  if (!id) return null;
  return getPickupStates(metrics).find((item) => item.id === id && item.available) ?? null;
}

function getPickupItemInfo(candidate) {
  if (!candidate?.id) return null;
  const embedded = candidate.i18n?.[currentLanguage] ?? candidate.i18n?.en ?? {};
  const text = getLocalizedText(ITEM_TEXT, candidate.id);
  if (!text?.name && !embedded.name) return null;
  return {
    id: candidate.id,
    type: "item",
    name: text.name ?? embedded.name,
    effect: text.effect ?? embedded.effect,
    action: text.action ?? embedded.action,
    distance: candidate.distance,
  };
}

function updateItemInfo(metrics) {
  const pickupable = findNearestPickupable(metrics);
  const focusItem = metrics.focusItem;
  const focusInteraction = metrics.focusInteraction;
  const focusEntity = metrics.focusEntity;
  let item = null;
  let canPickup = false;
  let canInteract = false;

  if (pickupable) {
    item = getPickupItemInfo(pickupable);
    canPickup = Boolean(item);
  } else if (focusItem) {
    item = focusItem;
    canPickup = Boolean(findPickupableById(metrics, focusItem.id));
  } else if (focusInteraction) {
    item = focusInteraction;
    canInteract = Boolean(focusInteraction.available);
  } else if (focusEntity) {
    item = focusEntity;
  }

  const hasFocus = Boolean(item);
  if (itemInfo) {
    if (hasFocus) itemInfo.hidden = false;
    itemInfo.classList.toggle("is-visible", hasFocus);
    itemInfo.classList.toggle("is-pickup-ready", canPickup || canInteract);
    itemInfo.dataset.infoType = item?.type ?? "item";
    if (!hasFocus) itemInfo.hidden = true;
  }
  if (hasFocus) {
    const collection =
      item.type === "entity" ? ENTITY_TEXT : item.type === "interaction" ? INTERACTION_TEXT : ITEM_TEXT;
    const embedded = item.i18n?.[currentLanguage] ?? item.i18n?.en ?? item;
    const localized = getLocalizedText(collection, item.id) ?? {};
    if (itemInfoName) itemInfoName.textContent = localized.name ?? embedded.name ?? item.name;
    if (itemInfoEffect) itemInfoEffect.textContent = localized.effect ?? embedded.effect ?? item.effect;
    if (itemInfoAction) itemInfoAction.textContent = localized.action ?? embedded.action ?? item.action;
  }
  canvas.dataset.focusItem = item?.type === "item" ? item.id : "";
  canvas.dataset.focusEntity = metrics.focusEntity?.id ?? "";
  canvas.dataset.focusInfoType = item?.type ?? "";
  canvas.dataset.focusItemDistance = Number.isFinite(item?.distance)
    ? String(Math.round(item.distance * 10) / 10)
    : "";
  canvas.dataset.pickupAvailable = String(canPickup);
  return { canPickup, canInteract };
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
  if (!world || exitComplete || gameFailed || levelTransition || isPaused) return;
  const looseTarget = worldItems?.getPickupTarget(world.camera.position);
  if (looseTarget) {
    const result = worldItems.tryPickup(world.camera.position);
    if (result?.pickedUp) {
      let added = false;
      if (result.itemId === "flashlight") {
        acquireFlashlight(1);
        if (Number.isFinite(result.data?.battery)) {
          flashlightBattery = Math.max(0, Math.min(FLASHLIGHT_BATTERY_MAX, result.data.battery));
        }
        added = true;
      } else if (result.itemId === "detector") {
        acquireDetector(1);
        if (Number.isFinite(result.data?.activeTimer)) detectorActiveTimer = Math.max(0, result.data.activeTimer);
        if (Number.isFinite(result.data?.cooldownTimer)) detectorCooldownTimer = Math.max(0, result.data.cooldownTimer);
        added = true;
      } else if (result.itemId === "compass") {
        acquireCompass(1);
        added = true;
      } else if (result.itemId === "silence-liquid") {
        acquireSilenceLiquid(1);
        added = true;
      } else {
        added = addInventory(result.itemId);
      }
      if (!added) return;
      const definition = getWorldItemDefinition(result.itemId);
      const localized = definition?.i18n?.[currentLanguage] ?? definition?.i18n?.en;
      pickupFlashText = localized?.name ?? result.itemId.toUpperCase();
      pickupFlashUntil = clock.elapsedTime + 1.5;
      renderInventoryBar();
      markDirty();
      return;
    }
  }
  const liveTarget = world.getPickupTarget
    ? world.getPickupTarget(world.camera.position)
    : findNearestPickupable(lastMetrics);
  if (
    liveTarget?.id === "flashlight" &&
    getInventoryCount("flashlight") >= FLASHLIGHT_MAX_STACK
  ) {
    pickupFlashText = formatLocalizedStatus("flashlightFull");
    pickupFlashUntil = clock.elapsedTime + 1.4;
    useButton?.classList.add("is-active");
    window.setTimeout(() => useButton?.classList.remove("is-active"), 140);
    return;
  }
  const pickup = world.tryPickup?.(world.camera.position);
  if (!pickup?.pickedUp) {
    if (openExitDoor()) return;
    if (lastMetrics?.focusInteraction?.available) {
      const interaction = world.interact?.(world.camera.position, {
        hasLevelKey: (targetLevel) =>
          (isDebugFeaturesActive() && world.level === HUB_LEVEL) ||
          getLevelKeyTarget(getEquipped()?.id) === targetLevel,
        consumeLevelKey: (targetLevel) => {
          if (isDebugFeaturesActive() && world.level === HUB_LEVEL) return true;
          const keyId = `level-key-${targetLevel}`;
          if (getEquipped()?.id !== keyId || !removeInventory(keyId)) return false;
          renderInventoryBar();
          markDirty();
          return true;
        },
      });
      if (interaction?.interacted) {
        const localized = getLocalizedText(INTERACTION_TEXT, interaction.id);
        const embedded = interaction.i18n?.[currentLanguage] ?? interaction.i18n?.en ?? {};
        pickupFlashText = localized.response ?? localized.name ?? embedded.response ?? embedded.name ?? "INTERACTION";
        pickupFlashUntil = clock.elapsedTime + 1.9;
        useButton?.classList.add("is-active");
        window.setTimeout(() => useButton?.classList.remove("is-active"), 140);
        canvas.dataset.lastInteraction = interaction.id;
        canvas.dataset.lastInteractionCount = String(interaction.count ?? 1);
        writeSaveSnapshot();
        return;
      }
      if (interaction?.locked) {
        const embedded = interaction.i18n?.[currentLanguage] ?? interaction.i18n?.en ?? {};
        pickupFlashText = embedded.response ?? embedded.effect ?? "LEVEL KEY REQUIRED";
        pickupFlashUntil = clock.elapsedTime + 1.7;
        return;
      }
    }
    flashPickupHint("pickupEmpty", 900);
    return;
  }

  if (pickup.itemId === "flashlight") {
    acquireFlashlight(pickup.count);
  } else if (pickup.itemId === "detector") {
    acquireDetector(pickup.count);
  } else if (pickup.itemId === "compass") {
    acquireCompass(pickup.count);
  } else if (pickup.itemId === "silence-liquid") {
    acquireSilenceLiquid(pickup.count);
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

  if (completedLevels.has(world.level)) {
    pickedUpItems.add(`${world.level}-${pickup.itemId}`);
    saveStringSet(PICKED_UP_KEY, pickedUpItems);
  }

  useButton?.classList.add("is-active");
  window.setTimeout(() => useButton?.classList.remove("is-active"), 140);
  renderInventoryBar();
}

function useEquippedShortPress() {
  if (!controls || exitComplete || gameFailed || levelTransition || isPaused || isDocumentReaderOpen()) return;
  const equipped = getEquipped();
  if (!equipped) return;
  if (LEVEL_DOCUMENTS[equipped.id]) {
    openDocumentReader(equipped.id);
    actionButton?.classList.add("is-active");
    window.setTimeout(() => actionButton?.classList.remove("is-active"), 140);
  } else if (equipped.id === "flashlight") {
    toggleFlashlight();
    actionButton?.classList.add("is-active");
    window.setTimeout(() => actionButton?.classList.remove("is-active"), 140);
  } else if (equipped.id === "detector") {
    startDetectorScan();
    actionButton?.classList.add("is-active");
    window.setTimeout(() => actionButton?.classList.remove("is-active"), 140);
  } else if (equipped.id === "silence-liquid") {
    if (activateSilenceLiquid()) {
      actionButton?.classList.add("is-active");
      window.setTimeout(() => actionButton?.classList.remove("is-active"), 140);
    }
  }
}

function startEquippedDrink() {
  if (!controls || exitComplete || gameFailed || levelTransition || isPaused) return;
  const equipped = getEquipped();
  if (!equipped) return;
  if (equipped.id === "almond-water") {
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

function isWaterItem(id) {
  return id === "almond-water" || id === "super-almond-water";
}

function beginEPress() {
  if (exitComplete || gameFailed || levelTransition || isPaused) return;
  if (ePressActive) return;
  ePressActive = true;
  ePressStartTime = performance.now();
  ePressLongTriggered = false;
  if (actionButton) {
    actionButton.classList.add("is-pressing");
    actionButton.dataset.longPress = "true";
    actionButton.style.setProperty("--long-press-progress", "0");
  }
}

function endEPress(event) {
  if (!controls) return;
  if (!ePressActive) return;
  const duration = performance.now() - ePressStartTime;
  ePressActive = false;
  if (actionButton) {
    actionButton.classList.remove("is-pressing");
    delete actionButton.dataset.longPress;
    actionButton.style.removeProperty("--long-press-progress");
  }
  if (exitComplete || gameFailed || levelTransition || isPaused) {
    if (controls.isDrinking) controls.cancelDrink(true);
    return;
  }
  const equipped = getEquipped();
  if (!equipped) return;

  if (isWaterItem(equipped.id)) {
    if (duration >= WATER_LONG_PRESS_MS && !ePressLongTriggered) {
      ePressLongTriggered = true;
      startEquippedDrink();
    }
    if (controls.isDrinking) controls.cancelDrink(true);
    return;
  }
  if (duration < WATER_LONG_PRESS_MS) {
    useEquippedShortPress();
  }
}

function tickLongPressProgress() {
  if (!ePressActive || !actionButton) return;
  const equipped = getEquipped();
  const duration = performance.now() - ePressStartTime;
  const ratio = Math.max(0, Math.min(1, duration / WATER_LONG_PRESS_MS));
  actionButton.style.setProperty("--long-press-progress", ratio.toFixed(3));
  if (ratio >= 1 && isWaterItem(equipped?.id) && !ePressLongTriggered) {
    ePressLongTriggered = true;
    startEquippedDrink();
  }
}

function updateHud(metrics, controlState, elapsed) {
  const hudMetrics = withExitDoorMetrics(metrics);
  const exitDistance = getCurrentExitDistance(hudMetrics);
  distanceReadout.textContent = `${metrics.exitDistance}m`;
  lightReadout.textContent = metrics.lightState ?? (metrics.flicker < 0.62 ? "DIM" : "HUM");
  statusText.textContent =
    elapsed < pickupFlashUntil
      ? pickupFlashText
      : world?.exitMode === "fall" && exitDistance <= EXIT_DOOR_INTERACT_RADIUS * 1.35
        ? formatLocalizedStatus("exitFallNearby")
      : exitDoorOpen && exitDistance <= EXIT_DOOR_INTERACT_RADIUS
        ? formatLocalizedStatus("exitDoorReady")
      : hudMetrics.focusInteraction?.id === "exit-elevator-door"
        ? formatLocalizedStatus("exitDoorNearby")
      : metrics.superAlmondWater?.available
        ? formatLocalizedStatus("super-almond-water")
      : metrics.detector?.available
        ? formatLocalizedStatus("detector")
      : metrics.silenceLiquid?.available
        ? formatLocalizedStatus("silence-liquid")
        : metrics.compass?.available
        ? formatLocalizedStatus("compass")
        : metrics.flashlight?.available
        ? formatLocalizedStatus("flashlight")
        : metrics.almondWater?.available
        ? formatLocalizedStatus("almond-water")
        : metrics.statusText ??
          (hudMetrics.exitReached
            ? "EXIT STABILIZED"
            : metrics.exitDistance < 7
              ? "SIGNAL FOUND"
              : "NO SIGNAL");
  updatePickupHud(hudMetrics);
  const itemInfoState = updateItemInfo(hudMetrics);
  showItemInfoPickupKey(itemInfoState.canPickup || itemInfoState.canInteract);
  updateStaminaHud(controlState);
  updateHealthHud(controlState);
  updateBuffCards(controlState);
  updateCompassHud(hudMetrics);
}

let playerHealthCooldown = 0;

function applyEntityContactDamage(delta, metrics) {
  if (isDebugFeaturesActive()) return;
  if (gameFailed || exitComplete || levelTransition) return;
  if (!controls || !metrics) return;
  if (controls.health <= 0) return;
  if (playerHealthCooldown > 0) {
    playerHealthCooldown = Math.max(0, playerHealthCooldown - delta);
  }
  if (playerHealthCooldown > 0) return;
  const entities = Array.isArray(metrics.entities) ? metrics.entities : [];
  const hit = entities.find((entity) => {
    if (!entity?.active) return false;
    if (!Number.isFinite(entity.distance)) return false;
    const id = entity.id ?? "";
    const radius = id.includes("hound") ? HOUND_CONTACT_RADIUS : BACTERIA_CONTACT_RADIUS;
    return entity.contact === true || entity.distance <= radius;
  });
  if (!hit) return;
  const id = hit.id ?? "";
  let damage;
  if (id === "level-seven-thing") damage = LEVEL_SEVEN_THING_DAMAGE;
  else if (id === "super-bacteria") damage = SUPER_BACTERIA_DAMAGE;
  else if (id.includes("hound")) damage = HOUND_DAMAGE;
  else damage = BACTERIA_DAMAGE;
  const killed = controls.applyDamage(damage);
  triggerDamageFlash();
  playerHealthCooldown = DAMAGE_COOLDOWN_S;
  markDirty();
  if (killed) {
    gameFailed = true;
    canvas.dataset.gameFailed = "true";
    const entityText = getLocalizedText(ENTITY_TEXT, id);
    showExitOverlay(
      formatLocalizedStatus("bacteriaFailTitle"),
      entityText.failSubtitle ?? formatLocalizedStatus("bacteriaFailSubtitle"),
      { failed: true },
    );
  }
}

function animate(timestamp) {
  clock.update(timestamp);
  if (!gameStarted || !world || !controls) {
    requestAnimationFrame(animate);
    return;
  }
  const rawDelta = clock.getDelta();
  if (isPaused || isDocumentReaderOpen()) {
    tickLongPressProgress();
    requestAnimationFrame(animate);
    return;
  }
  const delta = Math.min(rawDelta, 0.05);
  const elapsed = clock.elapsedTime;
  tickLongPressProgress();

  if (!exitComplete && !gameFailed && !levelTransition) runTime += delta;

  updateLevelTransition(delta);
  if (!exitComplete && !gameFailed && !levelTransition) controls.update(delta);
  syncFirstPersonHeldItem(world.camera, getEquipped()?.id ?? null);
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
  let metrics = world.update(delta, elapsed, world.camera.position, {
    entityRepelActive: Boolean(controlState.silenceLiquidActive),
    repelRadius: SILENCE_LIQUID_REPEL_RADIUS,
    repelSpeedMultiplier: SILENCE_LIQUID_REPEL_SPEED_MULTIPLIER,
    equippedLevelKey: getLevelKeyTarget(getEquipped()?.id),
    debugBypassLevelKeys: isDebugFeaturesActive() && world.level === HUB_LEVEL,
  });
  const looseItems = worldItems?.update(world.camera.position) ?? [];
  const looseItemFocus = worldItems?.inspect(world.camera) ?? null;
  metrics = {
    ...metrics,
    pickups: [...(metrics.pickups ?? []), ...looseItems],
    focusItem:
      looseItemFocus && (!metrics.focusItem || looseItemFocus.distance < metrics.focusItem.distance)
        ? looseItemFocus
        : metrics.focusItem,
  };
  lastMetrics = metrics;
  canvas.dataset.viewModel = world.viewModelName ?? "NONE";
  updateFlashlight(delta);
  updateDetector(delta, metrics);
  updateDebugExitMarkers();
  applyEntityContactDamage(delta, metrics);
  if (shouldEnterExit(metrics) && !gameFailed && !exitComplete && !levelTransition) {
    const nextLevel = metrics.nextLevel ?? world.nextLevel;
    if (nextLevel !== null && nextLevel !== undefined) {
      beginLevelTransition(nextLevel);
    } else {
      expireCompassAtExit();
      exitComplete = true;
      completedLevels.add(world.level);
      saveIntegerSet(COMPLETED_KEY, completedLevels);
      showExitOverlay("EXIT STABILIZED", `${world.levelLabel} SIGNAL LOST`, { complete: true });
      canvas.dataset.exitReached = "true";
    }
  }
  ambientHum.update(metrics.flicker, controlState);
  ambientHum.updateEntityAudio(metrics.entities);
  updateHud(metrics, controlState, elapsed);
  updateTimerReadout();
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
  if (isSavePromptVisible()) {
    if (event.code === "Escape") {
      event.preventDefault();
      if (savePromptMode === "levels") {
        showSavePromptMain();
      } else {
        showSavePromptLevels();
      }
    }
    return;
  }
  if (isMainMenuVisible()) {
    if (event.code === "Escape") {
      event.preventDefault();
      setMainMenuSettingsOpen(false);
    }
    return;
  }
  if (isDocumentReaderOpen()) {
    if (event.code === "KeyE" || event.code === "Escape") {
      event.preventDefault();
      closeDocumentReader();
    }
    return;
  }
  if (gameFailed) {
    if (event.code === "Escape") event.preventDefault();
    return;
  }
  if (isPaused) {
    if (event.code === "Escape") {
      event.preventDefault();
      setPauseState(false);
    }
    return;
  }
  if (isTypingTarget(event.target)) return;
  if (event.code === "KeyX" && debugMode.queryEnabled) {
    event.preventDefault();
    if (!event.repeat) toggleDebugFeatures();
    return;
  }
  if (event.code === "KeyF") {
    event.preventDefault();
    usePickup();
    return;
  }
  if (event.code === "KeyQ") {
    event.preventDefault();
    if (!event.repeat) dropEquippedItem();
    return;
  }
  if (event.code === "KeyE") {
    event.preventDefault();
    if (!event.repeat) beginEPress();
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
    if (document.pointerLockElement === canvas) {
      pauseFromUnlock = true;
      isInPauseTransition = true;
      try {
        document.exitPointerLock();
      } catch {
        isInPauseTransition = false;
        pauseFromUnlock = false;
        setPauseState(true);
      }
    } else {
      setPauseState(true);
    }
  }
}

function onUseKeyUp(event) {
  if (isDocumentReaderOpen() && event.code === "KeyE") {
    event.preventDefault();
    return;
  }
  if (event.code === "KeyE") {
    event.preventDefault();
    endEPress();
  }
}

const TAP_MAX_DURATION_MS = 300;
const TAP_MAX_DISTANCE_PX = 10;
let tapStartTime = 0;
let tapStartX = 0;
let tapStartY = 0;
let tapActive = false;

function onCanvasTapPointerDown(event) {
  if (event.pointerType !== "touch") return;
  tapStartTime = performance.now();
  tapStartX = event.clientX;
  tapStartY = event.clientY;
  tapActive = true;
}

function onCanvasTapPointerMove(event) {
  if (!tapActive) return;
  const dx = event.clientX - tapStartX;
  const dy = event.clientY - tapStartY;
  if (dx * dx + dy * dy > TAP_MAX_DISTANCE_PX * TAP_MAX_DISTANCE_PX) {
    tapActive = false;
  }
}

function onCanvasTapPointerUp(event) {
  if (!tapActive) return;
  tapActive = false;
  if (event.pointerType !== "touch") return;
  if (isPaused || isDocumentReaderOpen()) return;
  const elapsed = performance.now() - tapStartTime;
  if (elapsed > TAP_MAX_DURATION_MS) return;
  event.preventDefault();
  cycleInventory(1);
  renderInventoryBar();
}

function onWheelCycleInventory(event) {
  if (isPaused || isDocumentReaderOpen()) return;
  if (isTypingTarget(event.target) || event.target?.tagName === "SELECT") return;
  if (inventory.length === 0) return;
  const direction = event.deltaY > 0 ? 1 : -1;
  if (event.deltaY === 0) return;
  event.preventDefault();
  cycleInventory(direction);
  renderInventoryBar();
}

useButton?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  usePickup();
});
actionButton?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  beginEPress();
  if (actionButton && event.pointerId !== undefined) {
    try {
      actionButton.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }
});
actionButton?.addEventListener("pointerup", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (actionButton && actionButton.hasPointerCapture?.(event.pointerId)) {
    actionButton.releasePointerCapture(event.pointerId);
  }
  endEPress();
});
actionButton?.addEventListener("pointercancel", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (actionButton && actionButton.hasPointerCapture?.(event.pointerId)) {
    actionButton.releasePointerCapture(event.pointerId);
  }
  ePressActive = false;
  ePressLongTriggered = false;
  if (actionButton) {
    actionButton.classList.remove("is-pressing");
    delete actionButton.dataset.longPress;
    actionButton.style.removeProperty("--long-press-progress");
  }
  if (controls?.isDrinking) controls.cancelDrink(true);
});
actionButton?.addEventListener("pointerleave", (event) => {
  if (ePressActive) endEPress();
});
documentReaderClose?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  closeDocumentReader();
});
documentReader?.addEventListener("pointerdown", (event) => {
  if (event.target === documentReader) closeDocumentReader();
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
pauseResumeArea?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  setPauseState(false);
});
pauseOverlay?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  if (event.target === pauseOverlay) {
    setPauseState(false);
  }
});
pauseTutorialButton?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  handlePauseTutorial();
});
pauseSettingsButton?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  setPauseSettingsOpen(pauseSettingsPanel?.hasAttribute("hidden"));
});
pauseSettingsClose?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  setPauseSettingsOpen(false);
  pauseSettingsButton?.focus();
});
[pauseLanguageZh, pauseLanguageEn].forEach((button) => {
  button?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setLanguage(button.dataset.language);
  });
});
pauseResetButton?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (!isPaused) return;
  if (pauseResetArmed) {
    disarmPauseReset();
    resetAllProgress();
  } else {
    armPauseReset();
  }
});
exitOverlayRestart?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (!gameFailed) return;
  resetAllProgress();
});
exitOverlayContinue?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  continueExploringFromExit();
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
window.addEventListener("keyup", onUseKeyUp);
window.addEventListener("wheel", onWheelCycleInventory, { passive: false });
canvas?.addEventListener("pointerdown", onCanvasTapPointerDown);
canvas?.addEventListener("pointermove", onCanvasTapPointerMove);
canvas?.addEventListener("pointerup", onCanvasTapPointerUp);
canvas?.addEventListener("pointercancel", () => { tapActive = false; });
window.addEventListener("blur", () => {
  if (ePressActive) endEPress();
  if (isInPauseTransition) return;
  setPauseState(true);
});
document.addEventListener("pointerlockchange", handlePointerLockChange);

tutorialSkip?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  hideTutorial();
});

tutorialOverlay?.addEventListener("pointerdown", (event) => {
  if (event.target === tutorialOverlay) hideTutorial();
});

tutorialPrev?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (tutorialPage > 0) {
    tutorialPage -= 1;
    updateTutorialPage();
  }
});

tutorialNext?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (tutorialPage < TUTORIAL_TOTAL_PAGES - 1) {
    tutorialPage += 1;
    updateTutorialPage();
  } else {
    hideTutorial();
  }
});

tutorialDots.forEach((dot) => {
  dot.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const target = Number(dot.dataset.dot);
    if (Number.isFinite(target)) {
      tutorialPage = target;
      updateTutorialPage();
    }
  });
});

function populateSavePrompt(save) {
  if (!save) return;
  const saveLevel = Number(save.player?.level ?? 0);
  const urlLevel = getInitialLevel();
  const urlOverridesSave = urlLevel > 0 && urlLevel !== saveLevel;
  const displayLevel = urlOverridesSave ? urlLevel : saveLevel;
  const displayInfo = getBackroomsLevelInfo(displayLevel);
  const saveInfo = getBackroomsLevelInfo(saveLevel);

  if (savePromptLevel) savePromptLevel.textContent = displayInfo.levelLabel ?? "LEVEL ?";
  if (savePromptStamina) {
    const stamina = Math.round(save.player?.stamina ?? 0);
    const staminaMax = Math.round(save.player?.staminaMax ?? 0);
    savePromptStamina.textContent = `${stamina} / ${staminaMax}`;
  }
  if (savePromptRunTime) {
    savePromptRunTime.textContent = formatDuration(save.player?.runTime ?? 0);
  }
  if (savePromptItems) {
    if (save.inventory.length === 0) {
      savePromptItems.textContent = currentLanguage === "en" ? "EMPTY" : "空";
    } else {
      const counts = save.inventory
        .map((entry) => {
          const name = getInventoryItemLabel(entry.id);
          return `${name} ×${entry.count}`;
        })
        .join(currentLanguage === "en" ? " · " : " · ");
      savePromptItems.textContent = counts;
    }
  }

  if (urlOverridesSave) {
    if (savePromptEyebrow) {
      savePromptEyebrow.textContent = currentLanguage === "en"
        ? "URL OVERRIDE"
        : "URL 指定关卡";
    }
    if (savePromptTitle) {
      savePromptTitle.textContent = currentLanguage === "en"
        ? `ENTER ${displayInfo.levelLabel}`
        : `进入 ${displayInfo.levelLabel}`;
    }
    if (savePromptDesc) {
      savePromptDesc.textContent = currentLanguage === "en"
        ? `Save is parked at ${saveInfo.levelLabel}. URL points to ${displayInfo.levelLabel}; loading that instead.`
        : `存档停在 ${saveInfo.levelLabel},URL 请求的是 ${displayInfo.levelLabel},按此进入`;
    }
    if (savePromptContinueLabel) {
      savePromptContinueLabel.textContent = currentLanguage === "en"
        ? `ENTER ${displayInfo.levelLabel}`
        : `进入 ${displayInfo.levelLabel}`;
    }
    if (savePromptContinueHint) {
      savePromptContinueHint.textContent = currentLanguage === "en"
        ? `KEEP INVENTORY · START AT ${displayInfo.levelLabel}`
        : `保留道具 · 在 ${displayInfo.levelLabel} 开始`;
    }
    if (savePromptRestartLabel) {
      savePromptRestartLabel.textContent = currentLanguage === "en"
        ? `RESUME ${saveInfo.levelLabel}`
        : `恢复 ${saveInfo.levelLabel}`;
    }
    if (savePromptRestartHint) {
      savePromptRestartHint.textContent = currentLanguage === "en"
        ? `RESTORE SAVE STATE AT ${saveInfo.levelLabel}`
        : `在 ${saveInfo.levelLabel} 恢复存档`;
    }
  } else {
    if (savePromptEyebrow) {
      savePromptEyebrow.textContent = currentLanguage === "en"
        ? "PREVIOUS RUN DETECTED"
        : "PREVIOUS RUN DETECTED";
    }
    if (savePromptTitle) {
      savePromptTitle.textContent = currentLanguage === "en"
        ? "CONTINUE PREVIOUS RUN"
        : "继续上次进度";
    }
    if (savePromptDesc) {
      savePromptDesc.textContent = currentLanguage === "en"
        ? "An unfinished run was detected. Resume?"
        : "检测到一份未完成的进度。是否恢复?";
    }
    if (savePromptContinueLabel) {
      savePromptContinueLabel.textContent = currentLanguage === "en"
        ? "CONTINUE"
        : "继续";
    }
    if (savePromptContinueHint) {
      savePromptContinueHint.textContent = currentLanguage === "en"
        ? "RESTORE SAVE STATE"
        : "恢复上次进度";
    }
    if (savePromptRestartLabel) {
      savePromptRestartLabel.textContent = currentLanguage === "en"
        ? "RESTART"
        : "重新开始";
    }
    if (savePromptRestartHint) {
      savePromptRestartHint.textContent = currentLanguage === "en"
        ? "WIPE SAVE · START AT L0"
        : "清空存档,从头开始";
    }
  }
  if (savePromptJumpLabel) {
    savePromptJumpLabel.textContent = formatLocalizedStatus("savePromptJumpLabel");
  }
  if (savePromptJumpHint) {
    savePromptJumpHint.textContent = formatLocalizedStatus("savePromptJumpHint");
  }
  if (savePromptLevelsTitle) {
    savePromptLevelsTitle.textContent = formatLocalizedStatus("savePromptLevelsTitle");
  }
  if (savePromptLevelsBack) {
    savePromptLevelsBack.textContent = formatLocalizedStatus("savePromptLevelsBack");
  }
  if (savePromptMode === "levels") {
    populateSavePromptLevels();
  }
}

function showSavePrompt(save) {
  if (!savePromptOverlay) return;
  populateSavePrompt(save);
  showSavePromptMain();
  savePromptOverlay.removeAttribute("hidden");
  savePromptOverlay.classList.add("is-visible");
  canvas?.setAttribute("data-save-prompt", "true");
}

function hideSavePrompt() {
  if (!savePromptOverlay) return;
  savePromptOverlay.classList.remove("is-visible");
  window.setTimeout(() => savePromptOverlay.setAttribute("hidden", ""), OVERLAY_FADE_MS);
  canvas?.removeAttribute("data-save-prompt");
}

function isSavePromptVisible() {
  return Boolean(savePromptOverlay?.classList.contains("is-visible"));
}

function showSavePromptMain() {
  savePromptMode = "main";
  savePromptMain?.removeAttribute("hidden");
  savePromptLevels?.setAttribute("hidden", "");
}

function showSavePromptLevels() {
  populateSavePromptLevels();
  savePromptMode = "levels";
  savePromptMain?.setAttribute("hidden", "");
  savePromptLevels?.removeAttribute("hidden");
}

function populateSavePromptLevels() {
  if (!savePromptLevelsList) return;
  savePromptLevelsList.replaceChildren();
  for (let lv = 0; lv <= 8; lv += 1) {
    const info = getBackroomsLevelInfo(lv);
    const reached = reachedLevels.has(lv);
    const li = document.createElement("li");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = reached
      ? "save-prompt__level"
      : "save-prompt__level save-prompt__level--locked";
    btn.disabled = !reached;
    btn.dataset.level = String(lv);

    const label = document.createElement("span");
    label.className = "save-prompt__level-label";
    const strong = document.createElement("strong");
    strong.textContent = info.levelLabel ?? `LEVEL ${lv}`;
    const small = document.createElement("small");
    small.textContent = info.levelName ?? "";
    label.append(strong, small);

    const state = document.createElement("span");
    state.className = reached
      ? "save-prompt__level-state"
      : "save-prompt__level-state save-prompt__level-state--locked";
    state.textContent = reached
      ? formatLocalizedStatus("savePromptLevelReady")
      : formatLocalizedStatus("levelLocked");

    btn.append(label, state);
    if (reached) {
      btn.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (pendingSaveForPrompt) handleSavePromptJumpToLevel(lv, pendingSaveForPrompt);
      });
    }
    li.appendChild(btn);
    savePromptLevelsList.appendChild(li);
  }
}

function handleSavePromptContinue(save) {
  hideSavePrompt();
  const urlLevel = getInitialLevel();
  const saveLevel = getInitialLevelFromSave(save);
  // When the URL explicitly points to a different level than the save,
  // honour the URL — the player asked for that level. Save state (inventory,
  // flashlight, detector) is still applied so they keep their items.
  const targetLevel = urlLevel > 0 && urlLevel !== saveLevel ? urlLevel : saveLevel;
  beginGameSession(targetLevel, save);
}

function handleSavePromptRestart(save) {
  hideSavePrompt();
  const urlLevel = getInitialLevel();
  const saveLevel = save ? getInitialLevelFromSave(save) : 0;
  if (urlLevel > 0 && urlLevel !== saveLevel && save) {
    // URL override case: the second button offers to abandon the override
    // and resume the save at its actual level. URL is rewritten so refreshes
    // go to the same place.
    updateLevelUrl(saveLevel);
    beginGameSession(saveLevel, save);
    return;
  }
  clearSave();
  beginGameSession(getInitialLevel(), null);
}

function handleSavePromptJumpToLevel(targetLevel, save) {
  if (!reachedLevels.has(targetLevel)) {
    flashPickupHint("levelLockedHint", 1400);
    return;
  }
  hideSavePrompt();
  reachedLevels.add(targetLevel);
  saveIntegerSet(REACHED_KEY, reachedLevels);
  updateLevelUrl(targetLevel);
  beginGameSession(targetLevel, save);
}

savePromptContinue?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (pendingSaveForPrompt) {
    handleSavePromptContinue(pendingSaveForPrompt);
  }
});

savePromptRestart?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (pendingSaveForPrompt) {
    handleSavePromptRestart(pendingSaveForPrompt);
  }
});

savePromptJump?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  showSavePromptLevels();
});

savePromptLevelsBack?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  showSavePromptMain();
});

savePromptOverlay?.addEventListener("pointerdown", (event) => {
  if (event.target === savePromptOverlay) {
    if (pendingSaveForPrompt) handleSavePromptContinue(pendingSaveForPrompt);
  }
});

mainMenuStart?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  handleMainMenuStart();
});

mainMenuSettings?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  setMainMenuSettingsOpen(mainMenuSettingsPanel?.hasAttribute("hidden"));
});

mainMenuSettingsClose?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  setMainMenuSettingsOpen(false);
  mainMenuSettings?.focus();
});

[mainMenuLanguageZh, mainMenuLanguageEn].forEach((button) => {
  button?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setLanguage(button.dataset.language);
  });
});

let pendingSaveForPrompt = null;

showMainMenu();

window.setInterval(() => {
  if (!isResettingProgress && world && !gameFailed) {
    writeSaveSnapshot();
  }
}, SAVE_AUTOSAVE_INTERVAL_MS);

window.addEventListener("beforeunload", () => {
  if (!isResettingProgress && world && !gameFailed) {
    if (saveDirtyTimer) {
      window.clearTimeout(saveDirtyTimer);
      saveDirtyTimer = 0;
    }
    writeSaveSnapshot();
  }
});

if (typeof window !== "undefined") {
  window.__backroomsResetProgress = () => {
    if (typeof resetAllProgress === "function") {
      resetAllProgress();
      return;
    }
    try {
      window.localStorage?.removeItem("backrooms-save");
      window.localStorage?.removeItem(REACHED_KEY);
      window.localStorage?.removeItem(COMPLETED_KEY);
      window.localStorage?.removeItem(PICKED_UP_KEY);
    } catch {
      // localStorage may be unavailable.
    }
    window.location.replace(window.location.pathname);
  };
}

// Show tutorial after a new session has had time to finish loading.
function scheduleTutorial() {
  window.setTimeout(() => {
    if (!gameStarted || isPaused || exitComplete) return;
  let seen = false;
  try {
    seen = window.localStorage?.getItem(TUTORIAL_SEEN_KEY) === "true";
  } catch {
    seen = false;
  }
  if (!seen) showTutorial();
  }, 600);
}
