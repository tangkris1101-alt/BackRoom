import * as THREE from "three";
import "./styles.css";
import { createAmbientHum } from "./ambient-audio.js";
import { createBackroomsScene, getBackroomsLevelInfo } from "./scene.js";
import { FirstPersonControls } from "./first-person-controls.js";

const canvas = document.querySelector("#scene");
const joystick = document.querySelector("#joystick");
const jumpButton = document.querySelector("#jump-button");
const useButton = document.querySelector("#use-button");
const statusText = document.querySelector("#status-text");
const levelSelect = document.querySelector("#level-select");
const distanceReadout = document.querySelector("#distance-readout");
const lightReadout = document.querySelector("#light-readout");
const fpsReadout = document.querySelector("#fps-readout");
const hud = document.querySelector(".hud");
const staminaMeter = document.querySelector(".stamina-meter");
const staminaFill = document.querySelector("#stamina-fill");
const staminaReadout = document.querySelector("#stamina-readout");
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

const MAX_PIXEL_RATIO = 1.25;
const MIN_PIXEL_RATIO = 0.75;
const FPS_SAMPLE_INTERVAL = 0.75;
const FPS_LOW_THRESHOLD = 48;
const FPS_HIGH_THRESHOLD = 58;
const OVERLAY_FADE_MS = 460;
const LEVEL_TRANSITION_MS = 1250;

[hud, joystick, jumpButton, useButton, loadingOverlay].forEach((element) => {
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

function getInitialLevel() {
  const level = Number(new URLSearchParams(window.location.search).get("level"));
  return getBackroomsLevelInfo(level).level;
}

let world = createBackroomsScene(getInitialLevel());
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
let frameCount = 0;
let sampleFrameCount = 0;
let sampleElapsed = 0;
let displayedFps = 0;
let loadingComplete = false;
let exitComplete = false;
let levelTransition = null;
let pickupFlashUntil = 0;
let pickupFlashText = "";

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
  controls.setWorld({
    camera: world.camera,
    isWalkable: world.isWalkable,
    spawn: world.spawn,
  });
  exitComplete = false;
  canvas.dataset.exitReached = "false";
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
  canvas.dataset.transitioning = "false";
  canvas.dataset.exitReached = "false";
  hideExitOverlay();
  loadLevel(nextLevel, { updateUrl: true });
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
  const boostRemaining = Math.max(0, controlState.almondWaterRemaining ?? 0);
  const hasBoost = boostRemaining > 0;
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
  canvas.dataset.sprinting = String(controlState.sprinting);
}

function updatePickupHud(metrics) {
  const pickup = metrics.almondWater;
  const canDrink = Boolean(pickup?.available);
  useButton?.classList.toggle("is-visible", canDrink);
  if (useButton) useButton.disabled = !canDrink;
  canvas.dataset.almondWaterVisible = String(Boolean(pickup?.visible));
  canvas.dataset.almondWaterAvailable = String(canDrink);
  canvas.dataset.almondWaterDistance = Number.isFinite(pickup?.distance)
    ? String(Math.round(pickup.distance))
    : "";
}

function updateItemInfo(metrics) {
  const item = metrics.focusItem;
  const hasFocus = Boolean(item);
  if (itemInfo) {
    if (hasFocus) itemInfo.hidden = false;
    itemInfo.classList.toggle("is-visible", hasFocus);
    if (!hasFocus) itemInfo.hidden = true;
  }
  if (hasFocus) {
    if (itemInfoName) itemInfoName.textContent = item.name;
    if (itemInfoEffect) itemInfoEffect.textContent = item.effect;
    if (itemInfoAction) itemInfoAction.textContent = item.action;
  }
  canvas.dataset.focusItem = hasFocus ? item.id : "";
  canvas.dataset.focusItemDistance = Number.isFinite(item?.distance)
    ? String(Math.round(item.distance * 10) / 10)
    : "";
}

function useAlmondWater() {
  if (exitComplete || levelTransition) return;
  const pickup = world.tryPickup?.(world.camera.position);
  if (!pickup?.pickedUp) return;

  const controlState = controls.drinkAlmondWater(pickup.staminaBonus);
  pickupFlashText = `ALMOND WATER ${Math.ceil(controlState.almondWaterRemaining)}s`;
  pickupFlashUntil = clock.elapsedTime + 1.7;
  useButton?.classList.add("is-active");
  window.setTimeout(() => useButton?.classList.remove("is-active"), 140);
  canvas.dataset.almondWaterDrinks = String(pickup.count);
}

function updateHud(metrics, controlState, elapsed) {
  distanceReadout.textContent = `${metrics.exitDistance}m`;
  lightReadout.textContent = metrics.lightState ?? (metrics.flicker < 0.62 ? "DIM" : "HUM");
  statusText.textContent =
    elapsed < pickupFlashUntil
      ? pickupFlashText
      : metrics.almondWater?.available
        ? "ALMOND WATER"
        : metrics.statusText ??
          (metrics.exitReached
            ? "EXIT STABILIZED"
            : metrics.exitDistance < 7
              ? "SIGNAL FOUND"
              : "NO SIGNAL");
  updatePickupHud(metrics);
  updateItemInfo(metrics);
  updateStaminaHud(controlState);
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  updateLevelTransition(delta);
  if (!exitComplete && !levelTransition) controls.update(delta);
  const controlState = controls.getState();
  const metrics = world.update(delta, elapsed, world.camera.position);
  if (metrics.exitReached && !exitComplete && !levelTransition) {
    if (world.nextLevel !== null && world.nextLevel !== undefined) {
      beginLevelTransition(world.nextLevel);
    } else {
      exitComplete = true;
      showExitOverlay("EXIT STABILIZED", `${world.levelLabel} SIGNAL LOST`);
      canvas.dataset.exitReached = "true";
    }
  }
  ambientHum.update(metrics.flicker);
  updateHud(metrics, controlState, elapsed);
  updatePerformanceReadout(delta);
  updateLoadingOverlay();

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
  if (event.code !== "KeyF") return;
  const tagName = event.target?.tagName;
  if (tagName === "INPUT" || tagName === "SELECT" || tagName === "TEXTAREA") return;
  event.preventDefault();
  useAlmondWater();
}

useButton?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  useAlmondWater();
});
window.addEventListener("resize", resize);
window.addEventListener("pointerdown", startAudioOnce, { passive: true });
window.addEventListener("keydown", startAudioOnce);
window.addEventListener("keydown", onUseKeyDown);

syncLevelHud();
resize();
animate();
