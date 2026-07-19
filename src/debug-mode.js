import * as THREE from "three";
import { HUB_LEVEL } from "./scene/constants.js";

// Set to false in source to ignore ?debug=true entirely in published builds.
export const ALLOW_QUERY_DEBUG = true;
export const DEBUG_PLAYABLE_LEVELS = new Set([HUB_LEVEL, 0, 1, 2, 3, 4, 5, 6, 7, 8, 37]);

export class DebugMode {
  constructor({ canvas, onSync } = {}) {
    this.canvas = canvas;
    this.onSync = onSync;
    this.queryEnabled =
      ALLOW_QUERY_DEBUG && new URLSearchParams(window.location.search).get("debug") === "true";
    this.featuresEnabled = this.queryEnabled;
    this.areaLight = null;
  }

  isActive() {
    return this.queryEnabled && this.featuresEnabled;
  }

  toggle() {
    if (!this.queryEnabled) return this.isActive();
    this.featuresEnabled = !this.featuresEnabled;
    this.sync();
    return this.isActive();
  }

  sync() {
    const active = this.isActive();
    if (this.canvas) {
      this.canvas.dataset.debugQuery = String(this.queryEnabled);
      this.canvas.dataset.debugFeatures = String(active);
      this.canvas.dataset.debugAreaLight = String(active);
    }
    if (this.areaLight) this.areaLight.intensity = active ? 4.6 : 0;
    this.onSync?.(active);
  }

  attachAreaLight(camera) {
    if (!this.queryEnabled || !camera) return;
    this.areaLight = new THREE.PointLight(0xd6f4ff, 0, 126, 1.7);
    this.areaLight.name = "debug-player-area-light";
    this.areaLight.position.set(0, -0.55, 0);
    this.areaLight.castShadow = false;
    camera.add(this.areaLight);
    this.sync();
  }
}
