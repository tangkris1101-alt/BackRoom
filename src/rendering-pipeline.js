import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";

const SHADOW_CASTER_PATTERN = /entity|lifeform|hound|smiler|faceling|item|pickup|door|table|chair|desk|sofa|cabinet|crate|shelf|bed|lamp|fixture|rail|stair|pipe/i;
const SHADOW_RECEIVER_PATTERN = /floor|wall|ceiling|ground|road|pavement|carpet|room|hall|platform/i;

function materialSupportsShadows(material) {
  const materials = Array.isArray(material) ? material : [material];
  return materials.some((entry) => entry?.isMeshStandardMaterial || entry?.isMeshLambertMaterial || entry?.isMeshPhongMaterial);
}

function hasNamedAncestor(object, pattern) {
  let current = object;
  while (current) {
    if (pattern.test(current.name ?? "")) return true;
    current = current.parent;
  }
  return false;
}

function configureMeshQuality(scene, profile, maxAnisotropy) {
  scene.traverse((object) => {
    if (object.material) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (!material) return;
        for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "alphaMap"]) {
          const texture = material[key];
          if (!texture) continue;
          texture.anisotropy = Math.min(profile.maxAnisotropy, maxAnisotropy);
          if (texture.image) texture.needsUpdate = true;
        }
      });
    }
    if (!object.isMesh || !materialSupportsShadows(object.material)) return;
    if (!profile.shadows) {
      object.castShadow = false;
      object.receiveShadow = false;
      return;
    }
    object.receiveShadow = hasNamedAncestor(object, SHADOW_RECEIVER_PATTERN) || !object.material?.transparent;
    object.castShadow = !object.isInstancedMesh && hasNamedAncestor(object, SHADOW_CASTER_PATTERN);
  });
}

function createIndoorShadowRig(world, profile) {
  const candidates = [];
  world.scene.traverse((object) => {
    if (!object.isPointLight || object.name?.includes("debug") || object.parent?.isCamera) return;
    candidates.push(object);
  });
  if (!candidates.length) return null;

  // Levels can soften the key light via presentation.shadow (penumbra, blur
  // radius, intensity, cone angle). Levels without the override keep the
  // original crisp look.
  const shadowConfig = world.presentation?.shadow ?? {};
  const intensityScale = shadowConfig.intensityScale ?? 0.34;
  const intensityCap = shadowConfig.intensityCap ?? 1.35;
  const key = new THREE.SpotLight(
    0xffe8bd,
    0,
    22,
    Math.PI * (shadowConfig.angle ?? 0.46),
    shadowConfig.penumbra ?? 0.72,
    2,
  );
  key.name = "realism-indoor-shadow-key";
  key.castShadow = true;
  key.shadow.mapSize.set(profile.indoorShadowMapSize, profile.indoorShadowMapSize);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.035;
  key.shadow.radius = shadowConfig.radius ?? 1;
  key.shadow.camera.near = 0.15;
  key.shadow.camera.far = 24;
  key.target.name = "realism-indoor-shadow-target";
  world.scene.add(key, key.target);
  const worldPosition = new THREE.Vector3();
  let activeSource = null;
  let selectionCooldown = 0;

  return {
    mode: "indoor",
    light: key,
    update(delta, playerPosition) {
      selectionCooldown -= delta;
      if (!activeSource || selectionCooldown <= 0) {
        activeSource = candidates
          .filter((source) => source.visible && source.intensity > 0.08)
          .map((source) => ({ source, distance: source.getWorldPosition(worldPosition).distanceTo(playerPosition) }))
          .sort((a, b) => a.distance - b.distance)[0]?.source ?? null;
        selectionCooldown = 0.45;
      }
      if (!activeSource) {
        key.intensity = 0;
        return;
      }
      activeSource.getWorldPosition(worldPosition);
      key.position.copy(worldPosition);
      key.color.copy(activeSource.color);
      key.intensity = Math.min(intensityCap, Math.max(0.22, activeSource.intensity * intensityScale));
      // Pooled fixture lights run without a cutoff radius (distance 0), so the
      // key light takes its reach from the fixture itself instead of reading a
      // radius that no longer exists.
      const sourceRange = activeSource.userData?.fixture?.range ?? 14;
      key.distance = Math.min(24, Math.max(9, sourceRange * 1.2));
      key.target.position.set(worldPosition.x, Math.max(0, worldPosition.y - 3.4), worldPosition.z);
      key.target.updateMatrixWorld();
    },
  };
}

function createOutdoorShadowRig(world, profile) {
  const lights = [];
  world.scene.traverse((object) => {
    if (object.isDirectionalLight) lights.push(object);
  });
  const key = lights.sort((a, b) => b.intensity - a.intensity)[0];
  if (!key) return null;
  key.castShadow = true;
  key.shadow.mapSize.set(profile.outdoorShadowMapSize, profile.outdoorShadowMapSize);
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.045;
  key.shadow.camera.left = -28;
  key.shadow.camera.right = 28;
  key.shadow.camera.top = 28;
  key.shadow.camera.bottom = -28;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 112;
  const offset = key.position.clone().sub(key.target.position);
  if (offset.lengthSq() < 1) offset.set(45, 72, 38);

  return {
    mode: "outdoor",
    light: key,
    update(_delta, playerPosition) {
      key.target.position.set(playerPosition.x, 0, playerPosition.z);
      key.position.copy(key.target.position).add(offset);
      key.target.updateMatrixWorld();
      key.shadow.camera.updateProjectionMatrix();
    },
  };
}

const PREWARM_TEXTURE_SLOTS = [
  "map",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "aoMap",
  "alphaMap",
  "emissiveMap",
  "bumpMap",
  "specularMap",
  "lightMap",
  "displacementMap",
  "envMap",
];

// Textures are uploaded lazily on first draw, so walking into a part of a level
// that has not been on screen yet costs a decode + upload + mipmap stall right
// when the player turns around. Pay that cost while the loading overlay is up.
function uploadSceneTextures(renderer, scene) {
  if (typeof renderer.initTexture !== "function") return;
  const uploaded = new WeakSet();
  scene.traverse((object) => {
    if (!object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      for (const slot of PREWARM_TEXTURE_SLOTS) {
        const texture = material[slot];
        if (!texture || !texture.image || uploaded.has(texture)) continue;
        uploaded.add(texture);
        try {
          renderer.initTexture(texture);
        } catch {
          // A texture that cannot be uploaded yet is left to the first draw.
        }
      }
    }
  });
}

const VIEW_MODEL_NAME = "first-person-baked-hazmat-arms";
const VIEW_MODEL_WAIT_MS = 6000;

// Missing the target by this much counts as dropping frames. Main.js applies the
// same two margins to the render resolution, which is the lever it owns.
export const ADAPTIVE_SHED_MARGIN_FPS = 2;
export const ADAPTIVE_RESTORE_MARGIN_FPS = 0.5;
// Samples (0.75s each) before a step comes off, and before a shed step is even
// considered for a comeback. A restore is a probe: if it does not hold, the next
// probe waits twice as long.
const ADAPTIVE_SHED_SAMPLES = 3;
const ADAPTIVE_RESTORE_SAMPLES = 12;
const ADAPTIVE_PROBATION_SAMPLES = 24;
const ADAPTIVE_MAX_BACKOFF = 6;

export function createRenderingPipeline(renderer, canvas, profile) {
  let world = null;
  let composer = null;
  let gtaoPass = null;
  let bloomPass = null;
  let fxaaPass = null;
  let shadowRig = null;
  let width = window.innerWidth;
  let height = window.innerHeight;
  let pixelRatio = Math.min(window.devicePixelRatio, profile.maxPixelRatio);
  let gtaoEnabled = profile.gtao;
  let shadowScale = 1;
  let baseExposure = 1;

  // Adaptive quality. The frame-rate verdict comes from the sampler in main.js,
  // which owns the frame limit and the measured refresh rate, so the ladder
  // sheds against the rate the player actually asked for instead of assuming a
  // 60Hz display and a 54fps floor. Steps come off in order - ambient occlusion,
  // bloom, shadow resolution - and the render resolution is the caller's last
  // lever.
  let targetFps = 60;
  let missingFrameTime = 0;
  let steadyTime = 0;
  // A step that was restored and then had to come off again proved it does not
  // fit where the player is standing. Ambient occlusion is cheap to switch off
  // and dear to switch back on, and under vsync the frame rate cannot tell
  // whether the load changed later - 60fps looks the same at 40% and at 99% GPU
  // - so every failed attempt doubles the proof the next one has to bring
  // instead of re-probing, and popping the picture, every few seconds.
  let probation = null;
  let restoreBackoff = 0;

  renderer.shadowMap.enabled = profile.shadows;
  // r184 removed the separate PCFSoft path; PCFShadowMap is its supported
  // filtered replacement and avoids a runtime deprecation warning.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // A shadow map costs a depth render of every caster, and renderer.render()
  // refreshes it on every call. The composer calls render() more than once per
  // frame - GTAO redraws the whole scene into its normal/depth buffer before it
  // samples it - and those extra calls reuse the same light transforms, so the
  // shadow map they produced was identical work. Refresh it once per frame from
  // render() instead.
  renderer.shadowMap.autoUpdate = false;
  renderer.info.autoReset = false;
  let lastRenderCalls = 0;
  let lastRenderTriangles = 0;

  function disposeComposer() {
    gtaoPass?.dispose?.();
    bloomPass?.dispose?.();
    fxaaPass?.dispose?.();
    composer?.dispose?.();
    gtaoPass = null;
    bloomPass = null;
    fxaaPass = null;
    composer = null;
  }

  function rebuildComposer() {
    disposeComposer();
    if (!world || !profile.gtao) return;
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
    composer.addPass(new RenderPass(world.scene, world.camera));
    gtaoPass = new GTAOPass(world.scene, world.camera, Math.ceil(width * pixelRatio * 0.5), Math.ceil(height * pixelRatio * 0.5));
    gtaoPass.blendIntensity = world.presentation?.post?.aoIntensity ?? 0.58;
    // The denoise pass runs at the addon's default of 16 samples over 2 rings.
    // GTAOPass exposes pdSamples/pdRings as plain properties, so assigning them
    // here looked like a 8 sample / 1 ring reduction while the compiled shader
    // kept the defaults; updatePdMaterial() is the only thing that moves them.
    // Measured before enabling that: at 3858x2298 the two settings are inside
    // the same 0.1ms noise floor (16/2 5.74ms vs 8/1 5.83ms against a 5.64ms
    // frame), because the composer is bound by submission rather than fill, and
    // 8/1 denoises measurably worse - 0.68% of pixels off by more than 1/255
    // against a 0.003% repeat-capture floor. Kept at the default.
    gtaoPass.enabled = gtaoEnabled;
    composer.addPass(gtaoPass);
    // Optional per-level highlight bloom (e.g. Level 0 fluorescent fixtures).
    // High threshold keeps it to a soft glow around light panels only.
    const bloomConfig = world.presentation?.post?.bloom ?? null;
    if (bloomConfig) {
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        bloomConfig.strength,
        bloomConfig.radius,
        bloomConfig.threshold,
      );
      composer.addPass(bloomPass);
    }
    composer.addPass(new OutputPass());
    // Anti-aliasing. The renderer's own `antialias` cannot reach the scene once
    // the composer runs: every geometry pass draws into an off screen target and
    // the canvas only ever receives the final full screen quad, so the MSAA
    // backbuffer was pure cost. Multisampling the composer's own targets is the
    // other option, but that is a full resolution, half float, multisampled
    // ping-pong pair and it multiplies the sample fill of the most expensive
    // pass in the frame - more than this budget affords at 4K. One edge pass
    // over the tone mapped image buys most of it back. FXAA runs after
    // OutputPass because it reads the display referred image.
    fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.material.uniforms.resolution.value.set(
      1 / Math.max(1, width * pixelRatio),
      1 / Math.max(1, height * pixelRatio),
    );
    composer.addPass(fxaaPass);
    gtaoPass.setSize(Math.ceil(width * pixelRatio * 0.5), Math.ceil(height * pixelRatio * 0.5));
  }

  function applyShadowScale() {
    if (!shadowRig?.light?.shadow || !profile.shadows) return;
    const baseSize = shadowRig.mode === "outdoor" ? profile.outdoorShadowMapSize : profile.indoorShadowMapSize;
    const next = Math.max(512, Math.round(baseSize * shadowScale));
    shadowRig.light.shadow.mapSize.set(next, next);
    shadowRig.light.shadow.map?.dispose?.();
    shadowRig.light.shadow.map = null;
  }

  // One rung of the ladder. Ambient occlusion first: it costs the most per
  // frame and hides the least when it goes.
  function shedNextStep() {
    if (gtaoEnabled && gtaoPass) {
      gtaoEnabled = false;
      gtaoPass.enabled = false;
      return "gtao";
    }
    if (bloomPass?.enabled) {
      bloomPass.enabled = false;
      return "bloom";
    }
    if (profile.shadows && shadowScale > 0.5) {
      shadowScale = 0.5;
      applyShadowScale();
      return "shadows";
    }
    return null;
  }

  function restoreNextStep() {
    if (profile.shadows && shadowScale < 1) {
      shadowScale = 1;
      applyShadowScale();
      return "shadows";
    }
    if (bloomPass && !bloomPass.enabled) {
      bloomPass.enabled = true;
      return "bloom";
    }
    if (!gtaoEnabled && gtaoPass) {
      gtaoEnabled = true;
      gtaoPass.enabled = true;
      return "gtao";
    }
    return null;
  }

  // True once every rung the ladder can switch off is off, i.e. when the render
  // resolution is the only lever the caller has left. Profiles without rungs
  // (low quality) start here, exactly as they did before.
  function ladderSpent() {
    if (gtaoPass && gtaoEnabled) return false;
    if (bloomPass?.enabled) return false;
    if (profile.shadows && shadowScale > 0.5) return false;
    return true;
  }

  // A new level is a new cost profile, so a step that proved unaffordable in the
  // last one gets a clean slate here.
  function resetAdaptiveLadder() {
    gtaoEnabled = profile.gtao;
    shadowScale = 1;
    missingFrameTime = 0;
    steadyTime = 0;
    probation = null;
    restoreBackoff = 0;
  }

  return {
    profile,
    setWorld(nextWorld) {
      world = nextWorld;
      baseExposure = world?.presentation?.exposure ?? 1;
      renderer.toneMappingExposure = baseExposure;
      configureMeshQuality(world.scene, profile, renderer.capabilities.getMaxAnisotropy());
      shadowRig = null;
      if (profile.shadows) {
        shadowRig = world.presentation?.shadowMode === "outdoor"
          ? createOutdoorShadowRig(world, profile)
          : createIndoorShadowRig(world, profile);
      }
      world.shadowRig = shadowRig;
      resetAdaptiveLadder();
      rebuildComposer();
      this.syncDebugState();
    },
    setSize(nextWidth, nextHeight, nextPixelRatio = pixelRatio) {
      width = Math.max(1, nextWidth);
      height = Math.max(1, nextHeight);
      pixelRatio = nextPixelRatio;
      if (composer) {
        composer.setPixelRatio(pixelRatio);
        composer.setSize(width, height);
        gtaoPass?.setSize(Math.ceil(width * pixelRatio * 0.5), Math.ceil(height * pixelRatio * 0.5));
        // ShaderPass ignores setSize, so the edge pass needs the new texel size
        // pushed at it by hand.
        fxaaPass?.material.uniforms.resolution.value.set(
          1 / Math.max(1, width * pixelRatio),
          1 / Math.max(1, height * pixelRatio),
        );
      }
    },
    update(delta, playerPosition) {
      shadowRig?.update?.(delta, playerPosition);
      // Subtle exposure breathing: levels that expose `exposureBias` (-1..1)
      // and a `post.exposureDrift` amplitude get a smoothed exposure wobble
      // around their base exposure. Other levels stay pinned at baseExposure.
      const drift = world?.presentation?.post?.exposureDrift ?? 0;
      if (drift > 0) {
        const bias = THREE.MathUtils.clamp(world.exposureBias ?? 0, -1, 1);
        const target = baseExposure * (1 + bias * drift);
        const smoothing = 1 - Math.exp(-3 * delta);
        renderer.toneMappingExposure += (target - renderer.toneMappingExposure) * smoothing;
      } else if (renderer.toneMappingExposure !== baseExposure) {
        renderer.toneMappingExposure = baseExposure;
      }
    },
    render() {
      renderer.info.reset();
      // The one shadow refresh for this frame: the light rig has already been
      // moved by update(), so every render() call inside the composer would
      // produce the same map.
      renderer.shadowMap.needsUpdate = true;
      if (composer) composer.render();
      else if (world) renderer.render(world.scene, world.camera);
      lastRenderCalls = renderer.info.render.calls;
      lastRenderTriangles = renderer.info.render.triangles;
      this.syncDebugState();
    },
    async prewarm() {
      if (!world) return;
      // The first-person arms are fetched asynchronously and only then added to
      // the camera. Without waiting for them their programs compile on the first
      // frame the hands are visible - i.e. right when the player regains control.
      const viewModel = world.camera?.getObjectByName?.(VIEW_MODEL_NAME) ?? null;
      if (viewModel && !viewModel.userData.loaded && viewModel.userData.ready) {
        await Promise.race([
          viewModel.userData.ready,
          new Promise((resolve) => setTimeout(resolve, VIEW_MODEL_WAIT_MS)),
        ]);
      }
      await renderer.compileAsync?.(world.scene, world.camera);
      this.render();
      uploadSceneTextures(renderer, world.scene);
      // Shadow depth programs and the view model's programs are only created by
      // an actual draw pass, so force one with the hands visible.
      const previousVisibility = viewModel?.visible ?? null;
      if (viewModel) viewModel.visible = true;
      try {
        this.render();
      } finally {
        if (viewModel && previousVisibility !== null) viewModel.visible = previousVisibility;
      }
    },
    updateAdaptive(fps, nextTargetFps = targetFps) {
      if (Number.isFinite(nextTargetFps) && nextTargetFps > 0) targetFps = nextTargetFps;
      if (!Number.isFinite(fps)) {
        return { canReducePixelRatio: true, canRaisePixelRatio: false, changed: false };
      }
      const shedBelow = targetFps - ADAPTIVE_SHED_MARGIN_FPS;
      const restoreAbove = targetFps - ADAPTIVE_RESTORE_MARGIN_FPS;
      if (fps < shedBelow) {
        missingFrameTime += 1;
        steadyTime = 0;
      } else if (fps >= restoreAbove) {
        steadyTime += 1;
        missingFrameTime = Math.max(0, missingFrameTime - 1);
      } else {
        // Close to the target but not on it: the sample counts for neither side,
        // which keeps a machine that hovers one frame short from see-sawing.
        missingFrameTime = Math.max(0, missingFrameTime - 0.25);
        steadyTime = 0;
      }

      let changed = false;
      if (probation) {
        probation.samples -= 1;
        if (probation.samples <= 0) {
          // The step held for a whole probation window, so the machine can
          // afford it: trust the next probe a little more.
          probation = null;
          restoreBackoff = Math.max(0, restoreBackoff - 1);
        }
      }

      if (missingFrameTime >= ADAPTIVE_SHED_SAMPLES) {
        const shedStep = shedNextStep();
        missingFrameTime = 0;
        if (shedStep) {
          if (probation && probation.step === shedStep) {
            restoreBackoff = Math.min(restoreBackoff + 1, ADAPTIVE_MAX_BACKOFF);
          }
          probation = null;
          changed = true;
        }
      }

      const restoreWindow = ADAPTIVE_RESTORE_SAMPLES << restoreBackoff;
      if (!changed && !probation && steadyTime >= restoreWindow) {
        const restoredStep = restoreNextStep();
        steadyTime = 0;
        if (restoredStep) {
          probation = { step: restoredStep, samples: ADAPTIVE_PROBATION_SAMPLES };
          changed = true;
        }
      }

      this.syncDebugState();
      const spent = ladderSpent();
      return {
        changed,
        // The resolution only moves once every rung is already off, and a rung
        // only comes back once the frame rate holds the target on its own: the
        // picture is restored before the resolution is.
        canReducePixelRatio: !changed && spent,
        canRaisePixelRatio: !changed && spent && steadyTime >= ADAPTIVE_RESTORE_SAMPLES,
      };
    },
    syncDebugState() {
      const info = renderer.info;
      canvas.dataset.graphicsProfile = profile.id;
      canvas.dataset.gtao = String(Boolean(gtaoEnabled && gtaoPass?.enabled));
      canvas.dataset.bloom = String(Boolean(bloomPass?.enabled));
      canvas.dataset.antialias = String(Boolean(fxaaPass?.enabled));
      canvas.dataset.shadows = String(Boolean(profile.shadows && shadowRig));
      canvas.dataset.shadowMode = shadowRig?.mode ?? "none";
      canvas.dataset.shadowScale = shadowScale.toFixed(2);
      canvas.dataset.adaptiveTarget = targetFps.toFixed(0);
      canvas.dataset.adaptiveBackoff = String(restoreBackoff);
      canvas.dataset.drawCalls = String(lastRenderCalls);
      canvas.dataset.triangles = String(lastRenderTriangles);
      canvas.dataset.textureCount = String(info.memory.textures);
      canvas.dataset.geometryCount = String(info.memory.geometries);
      canvas.dataset.shaderCount = String(info.programs?.length ?? 0);
    },
    dispose() {
      disposeComposer();
      shadowRig = null;
      world = null;
    },
  };
}
