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

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
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

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  world.camera.aspect = width / height;
  world.camera.updateProjectionMatrix();
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
