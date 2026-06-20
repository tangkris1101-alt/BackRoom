import * as THREE from "three";
import "./styles.css";
import { createAmbientHum } from "./ambient-audio.js";
import { createBackroomsScene } from "./scene.js";
import { FirstPersonControls } from "./first-person-controls.js";

const canvas = document.querySelector("#scene");
const joystick = document.querySelector("#joystick");
const jumpButton = document.querySelector("#jump-button");
const statusText = document.querySelector("#status-text");
const distanceReadout = document.querySelector("#distance-readout");
const lightReadout = document.querySelector("#light-readout");
const fpsReadout = document.querySelector("#fps-readout");

const MAX_PIXEL_RATIO = 1.25;
const MIN_PIXEL_RATIO = 0.75;
const FPS_SAMPLE_INTERVAL = 0.75;
const FPS_LOW_THRESHOLD = 48;
const FPS_HIGH_THRESHOLD = 58;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
let renderPixelRatio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
renderer.setPixelRatio(renderPixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const world = createBackroomsScene();
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

function updateHud(metrics) {
  distanceReadout.textContent = `${metrics.exitDistance}m`;
  lightReadout.textContent = metrics.flicker < 0.42 ? "DIM" : "FLICKER";
  statusText.textContent = metrics.exitDistance < 7 ? "SIGNAL FOUND" : "NO SIGNAL";
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  controls.update(delta);
  const metrics = world.update(delta, elapsed, world.camera.position);
  ambientHum.update(metrics.flicker);
  updateHud(metrics);
  updatePerformanceReadout(delta);

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

window.addEventListener("resize", resize);
window.addEventListener("pointerdown", startAudioOnce, { passive: true });
window.addEventListener("keydown", startAudioOnce);

resize();
animate();
