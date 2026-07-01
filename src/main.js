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
const tutorialOverlay = document.querySelector("#tutorial-overlay");
const tutorialSkip = document.querySelector("#tutorial-skip");
const tutorialPrev = document.querySelector("#tutorial-prev");
const tutorialNext = document.querySelector("#tutorial-next");
const tutorialPages = document.querySelector(".tutorial-pages");
const tutorialDots = document.querySelectorAll(".tutorial-pagination__dot");
const TUTORIAL_SEEN_KEY = "backrooms-tutorial-seen";
const TUTORIAL_TOTAL_PAGES = 4;
let tutorialPage = 0;
let tutorialActive = false;

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
const WATER_LONG_PRESS_MS = 600;

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

const ENTITY_TEXT = {
  "zh-CN": {
    bacteria: {
      name: "\u7ec6\u83cc\u5b9e\u4f53",
      marker: "\u7ec6\u83cc",
      effect: "\u7626\u957f\u3001\u4f4e\u901f\u8ffd\u51fb\uff1b\u63a5\u89e6\u5373\u5931\u8d25",
      action: "\u4fdd\u6301\u8ddd\u79bb",
      failSubtitle: "\u63a5\u89e6\u7ec6\u83cc\u5b9e\u4f53",
    },
    "super-bacteria": {
      name: "\u8d85\u7ea7\u7ec6\u83cc",
      marker: "\u8d85\u7ea7\u7ec6\u83cc",
      effect: "\u66f4\u5f3a\u7684\u7535\u7ad9\u5b9e\u4f53\uff1b\u63a5\u89e6\u5373\u5931\u8d25",
      action: "\u4fdd\u6301\u8ddd\u79bb",
      failSubtitle: "\u63a5\u89e6\u8d85\u7ea7\u7ec6\u83cc\u5b9e\u4f53",
    },
    hound: {
      name: "\u730e\u72ac\u5b9e\u4f53",
      marker: "\u730e\u72ac",
      effect: "\u56db\u8db3\u8ffd\u51fb\uff1b\u901f\u5ea6\u6bd4\u7ec6\u83cc\u66f4\u5feb",
      action: "\u907f\u5f00\u76f4\u7ebf\u8ddd\u79bb",
      failSubtitle: "\u88ab\u730e\u72ac\u5b9e\u4f53\u6355\u83b7",
    },
  },
  en: {
    bacteria: {
      name: "BACTERIA ENTITY",
      marker: "BACTERIA",
      effect: "Tall slow pursuer; contact is fatal.",
      action: "KEEP DISTANCE",
      failSubtitle: "BACTERIA CONTACT",
    },
    "super-bacteria": {
      name: "SUPER BACTERIA",
      marker: "SUPER BACTERIA",
      effect: "Stronger station entity; contact is fatal.",
      action: "KEEP DISTANCE",
      failSubtitle: "SUPER BACTERIA CONTACT",
    },
    hound: {
      name: "HOUND",
      marker: "HOUND",
      effect: "Quadruped pursuer; faster than Bacteria.",
      action: "BREAK LINE OF SIGHT",
      failSubtitle: "HOUND CONTACT",
    },
  },
};

const INTERACTION_TEXT = {
  "zh-CN": {
    "level-one-elevator-panel": {
      name: "\u7535\u68af\u9762\u677f",
      effect: "\u663e\u793a\u51fa\u53e3\u540c\u6b65\u72b6\u6001",
      action: "F / \u6309\u94ae\u68c0\u67e5",
      response: "\u7535\u68af\u8fd8\u5728\u7b49\u5f85\u7a33\u5b9a\u4fe1\u53f7",
    },
    "level-two-valve": {
      name: "\u538b\u529b\u9600",
      effect: "\u7ba1\u9053\u538b\u529b\u4e0d\u7a33\u5b9a",
      action: "F / \u6309\u94ae\u8f6c\u52a8",
      response: "\u9600\u95e8\u53ea\u662f\u53d1\u51fa\u7a7a\u6d1e\u7684\u6469\u64e6\u58f0",
    },
    "level-two-service-door": {
      name: "\u7ef4\u4fee\u95e8",
      effect: "\u95e8\u9501\u88ab\u7ba1\u9053\u70ed\u6c14\u5361\u4f4f",
      action: "F / \u6309\u94ae\u68c0\u67e5",
      response: "\u95e8\u540e\u4f20\u6765\u4f4e\u9891\u7ba1\u9053\u58f0",
    },
    "level-three-breaker": {
      name: "\u65ad\u8def\u5668",
      effect: "\u51fa\u53e3\u4f9b\u7535\u70b9",
      action: "F / \u6309\u94ae\u68c0\u67e5",
      response: "\u7535\u5f27\u95ea\u8fc7\uff0c\u51fa\u53e3\u4fe1\u53f7\u77ed\u6682\u589e\u5f3a",
    },
    "level-three-generator": {
      name: "\u53d1\u7535\u673a",
      effect: "\u58f0\u97f3\u4e0d\u7a33\uff0c\u4f46\u4ecd\u5728\u8fd0\u884c",
      action: "F / \u6309\u94ae\u503e\u542c",
      response: "\u53d1\u7535\u673a\u8282\u594f\u5ffd\u7136\u4e71\u4e86\u4e00\u62cd",
    },
    "level-four-terminal": {
      name: "\u529e\u516c\u7ec8\u7aef",
      effect: "\u5c4f\u5e55\u53ea\u5269\u4e00\u884c\u8b66\u544a",
      action: "F / \u6309\u94ae\u9605\u8bfb",
      response: "\u7ec8\u7aef\u663e\u793a\uff1a\u4e0d\u8981\u76f8\u4fe1\u7a97\u5916\u7684\u5149",
    },
    "level-four-files": {
      name: "\u6587\u4ef6\u5806",
      effect: "\u4e0a\u9762\u53ea\u6709\u91cd\u590d\u7684\u697c\u5c42\u56fe",
      action: "F / \u6309\u94ae\u7ffb\u770b",
      response: "\u6bcf\u5f20\u56fe\u7684\u51fa\u53e3\u90fd\u88ab\u624b\u5199\u5708\u6389",
    },
    "level-four-vending": {
      name: "\u81ea\u52a8\u552e\u8d27\u673a",
      effect: "\u5df2\u65e0\u8d27\uff0c\u4ecd\u5728\u8f7b\u58f0\u8fd0\u8f6c",
      action: "F / \u6309\u94ae\u68c0\u67e5",
      response: "\u9000\u5e01\u53e3\u91cc\u53ea\u6709\u7070\u5c18",
    },
    "level-four-water-cooler": {
      name: "\u996e\u6c34\u673a",
      effect: "\u6846\u4f53\u6e29\u51b7\uff0c\u6c34\u6876\u5df2\u7a7a",
      action: "F / \u6309\u94ae\u68c0\u67e5",
      response: "\u6c34\u6ce1\u58f0\u505c\u4e86\uff0c\u50cf\u662f\u6709\u4eba\u5728\u542c",
    },
    "level-four-stair-door": {
      name: "\u697c\u68af\u95e8",
      effect: "\u901a\u5f80\u66f4\u6df1\u7684\u529e\u516c\u533a",
      action: "F / \u6309\u94ae\u68c0\u67e5",
      response: "\u95e8\u628a\u624b\u5f88\u51b7\uff0c\u697c\u68af\u95f4\u91cc\u6ca1\u6709\u56de\u58f0",
    },
  },
  en: {
    "level-one-elevator-panel": {
      name: "ELEVATOR PANEL",
      effect: "Shows unstable exit synchronization.",
      action: "F / BUTTON INSPECT",
      response: "The elevator is still waiting for a stable signal.",
    },
    "level-two-valve": {
      name: "PRESSURE VALVE",
      effect: "Pipe pressure is unstable.",
      action: "F / BUTTON TURN",
      response: "The valve answers with a hollow scrape.",
    },
    "level-two-service-door": {
      name: "SERVICE DOOR",
      effect: "Heat and pressure have jammed the lock.",
      action: "F / BUTTON INSPECT",
      response: "A low pipe drone leaks through the door.",
    },
    "level-three-breaker": {
      name: "BREAKER",
      effect: "Exit power junction.",
      action: "F / BUTTON INSPECT",
      response: "An arc snaps across the breaker; the exit signal spikes.",
    },
    "level-three-generator": {
      name: "GENERATOR",
      effect: "Unsteady, but still running.",
      action: "F / BUTTON LISTEN",
      response: "The generator rhythm skips for one beat.",
    },
    "level-four-terminal": {
      name: "OFFICE TERMINAL",
      effect: "Only one warning line remains.",
      action: "F / BUTTON READ",
      response: "Terminal: DO NOT TRUST THE LIGHT OUTSIDE.",
    },
    "level-four-files": {
      name: "FILE STACK",
      effect: "Repeated floor plans with no dates.",
      action: "F / BUTTON READ",
      response: "Every printed exit is circled by hand.",
    },
    "level-four-vending": {
      name: "VENDING MACHINE",
      effect: "Empty, still humming.",
      action: "F / BUTTON INSPECT",
      response: "Only dust sits in the coin return.",
    },
    "level-four-water-cooler": {
      name: "WATER COOLER",
      effect: "Cold frame, empty bottle.",
      action: "F / BUTTON INSPECT",
      response: "The bubbling stops, as if something is listening.",
    },
    "level-four-stair-door": {
      name: "STAIR DOOR",
      effect: "Leads deeper into the office level.",
      action: "F / BUTTON INSPECT",
      response: "The handle is cold; no echo comes back.",
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
    inventoryHint: "← → / 滚轮 切换 · 点击 切换 / E 使用",
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
    inventoryHint: "← → / WHEEL · TAP TO SWITCH / E USE",
    inventoryEmpty: "INVENTORY EMPTY",
    pickupEmpty: "NO ITEM IN RANGE",
  },
};

[hud, joystick, jumpButton, useButton, actionButton, flashlightButton, detectorButton, pauseButton, loadingOverlay, inventoryBar].forEach((element) => {
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
let lastMetrics = null;

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
  if (content) {
    content = content
      .replace(/id="(fl-body|fl-lens|aw-body|saw-body|det-body|det-screen|det-glow)"/g, `id="$1-${slotId}"`)
      .replace(/url\(#(fl-body|fl-lens|aw-body|saw-body|det-body|det-screen|det-glow)\)/g, `url(#$1-${slotId})`);
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
  renderInventoryBar();
  updateActionButtonState();
  if (lastMetrics) updateItemInfo(lastMetrics);
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
        if (entity.id === "hound") marker.classList.add("entity-marker--hound");
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

  const safeEquippedIndex =
    equippedIndex >= 0 && equippedIndex < inventory.length ? equippedIndex : 0;
  const fragment = document.createDocumentFragment();

  for (let i = 1; i <= safeEquippedIndex; i += 1) {
    fragment.append(createInventorySlot(inventory[safeEquippedIndex - i], -i));
  }
  fragment.append(createInventorySlot(inventory[safeEquippedIndex], 0));
  for (let i = 1; i < inventory.length - safeEquippedIndex; i += 1) {
    fragment.append(createInventorySlot(inventory[safeEquippedIndex + i], i));
  }

  inventorySlots.replaceChildren(fragment);
  updateActionButtonState();
}

function createInventorySlot(entry, position) {
  const def = INVENTORY_DEFS[entry.id];
  const slot = document.createElement("div");
  slot.className = "inventory-slot";
  slot.dataset.type = entry.id;
  slot.dataset.position = String(position);

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

  if (position === 0) {
    const name = document.createElement("span");
    name.className = "inventory-slot__name";
    const localized = getLocalizedText(STATUS_TEXT, entry.id);
    name.textContent = localized || entry.id;
    slot.append(name);
  }

  return slot;
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
    ambientHum.suspend();
  } else {
    clock.getDelta();
    ambientHum.resume();
  }
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
  const canInteract = Boolean(metrics.focusInteraction?.available);
  const canUse = canDrink || canDrinkSuper || canTakeFlashlight || canTakeDetector || canInteract;
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
  canvas.dataset.focusInteraction = metrics.focusInteraction?.id ?? "";
  canvas.dataset.focusInteractionAvailable = String(canInteract);
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
  const item = metrics.focusItem ?? metrics.focusInteraction ?? metrics.focusEntity;
  const pickupable = findNearestPickupable(metrics);
  const canInteract = Boolean(metrics.focusInteraction?.available);
  const hasFocus = Boolean(item);
  const canPickup = Boolean(pickupable);
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
    const localized = getLocalizedText(collection, item.id) ?? item;
    if (itemInfoName) itemInfoName.textContent = localized.name ?? item.name;
    if (itemInfoEffect) itemInfoEffect.textContent = localized.effect ?? item.effect;
    if (itemInfoAction) itemInfoAction.textContent = localized.action ?? item.action;
  }
  canvas.dataset.focusItem = metrics.focusItem?.id ?? "";
  canvas.dataset.focusEntity = metrics.focusEntity?.id ?? "";
  canvas.dataset.focusInfoType = item?.type ?? "";
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
    if (lastMetrics?.focusInteraction?.available) {
      const interaction = world.interact?.(world.camera.position);
      if (interaction?.interacted) {
        const localized = getLocalizedText(INTERACTION_TEXT, interaction.id);
        pickupFlashText = localized.response ?? localized.name ?? "INTERACTION";
        pickupFlashUntil = clock.elapsedTime + 1.9;
        useButton?.classList.add("is-active");
        window.setTimeout(() => useButton?.classList.remove("is-active"), 140);
        canvas.dataset.lastInteraction = interaction.id;
        canvas.dataset.lastInteractionCount = String(interaction.count ?? 1);
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

function useEquippedShortPress() {
  if (exitComplete || levelTransition || isPaused) return;
  const equipped = getEquipped();
  if (!equipped) return;
  if (equipped.id === "flashlight") {
    toggleFlashlight();
    actionButton?.classList.add("is-active");
    window.setTimeout(() => actionButton?.classList.remove("is-active"), 140);
  } else if (equipped.id === "detector") {
    startDetectorScan();
    actionButton?.classList.add("is-active");
    window.setTimeout(() => actionButton?.classList.remove("is-active"), 140);
  }
}

function startEquippedDrink() {
  if (exitComplete || levelTransition || isPaused) return;
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
  if (exitComplete || levelTransition || isPaused) return;
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
  if (!ePressActive) return;
  const duration = performance.now() - ePressStartTime;
  ePressActive = false;
  if (actionButton) {
    actionButton.classList.remove("is-pressing");
    delete actionButton.dataset.longPress;
    actionButton.style.removeProperty("--long-press-progress");
  }
  if (exitComplete || levelTransition || isPaused) return;
  const equipped = getEquipped();
  if (!equipped) return;

  if (isWaterItem(equipped.id)) {
    if (duration >= WATER_LONG_PRESS_MS && !ePressLongTriggered) {
      ePressLongTriggered = true;
      startEquippedDrink();
    }
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
  showItemInfoPickupKey(
    (Boolean(metrics.focusItem) && Boolean(findNearestPickupable(metrics))) ||
      Boolean(metrics.focusInteraction?.available),
  );
  updateStaminaHud(controlState);
  updateBuffCards(controlState);
}

function animate() {
  const rawDelta = clock.getDelta();
  if (isPaused) {
    tickLongPressProgress();
    requestAnimationFrame(animate);
    return;
  }
  const delta = Math.min(rawDelta, 0.05);
  const elapsed = clock.elapsedTime;
  tickLongPressProgress();

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
  lastMetrics = metrics;
  updateFlashlight(delta);
  updateDetector(delta, metrics);
  if (metrics.entityContact && !gameFailed && !exitComplete && !levelTransition) {
    const contactEntity = (metrics.entities ?? []).find((entity) => entity?.contact);
    const entityText = getLocalizedText(ENTITY_TEXT, contactEntity?.id);
    gameFailed = true;
    canvas.dataset.gameFailed = "true";
    showExitOverlay(
      formatLocalizedStatus("bacteriaFailTitle"),
      entityText.failSubtitle ?? formatLocalizedStatus("bacteriaFailSubtitle"),
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
  if (isPaused) return;
  const elapsed = performance.now() - tapStartTime;
  if (elapsed > TAP_MAX_DURATION_MS) return;
  event.preventDefault();
  cycleInventory(1);
  renderInventoryBar();
}

function onWheelCycleInventory(event) {
  if (isPaused) return;
  const tagName = event.target?.tagName;
  if (tagName === "INPUT" || tagName === "SELECT" || tagName === "TEXTAREA") return;
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
});
actionButton?.addEventListener("pointerleave", (event) => {
  if (ePressActive) endEPress();
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

syncLevelHud();
resize();
renderInventoryBar();
animate();

// Show tutorial on first launch (after a short delay so loading overlay has time to settle)
window.setTimeout(() => {
  if (isPaused || exitComplete) return;
  let seen = false;
  try {
    seen = window.localStorage?.getItem(TUTORIAL_SEEN_KEY) === "true";
  } catch {
    seen = false;
  }
  if (!seen) showTutorial();
}, 600);
