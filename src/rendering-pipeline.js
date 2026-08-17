import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const SHADOW_CASTER_PATTERN = /entity|lifeform|hound|smiler|faceling|item|pickup|door|table|chair|desk|sofa|cabinet|crate|bed|lamp|fixture|rail|stair|pipe/i;
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
      key.distance = Math.min(22, Math.max(8, activeSource.distance || 14));
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

export function createRenderingPipeline(renderer, canvas, profile) {
  let world = null;
  let composer = null;
  let gtaoPass = null;
  let bloomPass = null;
  let shadowRig = null;
  let width = window.innerWidth;
  let height = window.innerHeight;
  let pixelRatio = Math.min(window.devicePixelRatio, profile.maxPixelRatio);
  let gtaoEnabled = profile.gtao;
  let shadowScale = 1;
  let baseExposure = 1;
  let lowFpsTime = 0;
  let recoveryTime = 0;

  renderer.shadowMap.enabled = profile.shadows;
  // r184 removed the separate PCFSoft path; PCFShadowMap is its supported
  // filtered replacement and avoids a runtime deprecation warning.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.info.autoReset = false;
  let lastRenderCalls = 0;
  let lastRenderTriangles = 0;

  function disposeComposer() {
    gtaoPass?.dispose?.();
    bloomPass?.dispose?.();
    composer?.dispose?.();
    gtaoPass = null;
    bloomPass = null;
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
    gtaoPass.pdSamples = 8;
    gtaoPass.pdRings = 1;
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
      if (composer) composer.render();
      else if (world) renderer.render(world.scene, world.camera);
      lastRenderCalls = renderer.info.render.calls;
      lastRenderTriangles = renderer.info.render.triangles;
      this.syncDebugState();
    },
    async prewarm() {
      if (!world) return;
      await renderer.compileAsync?.(world.scene, world.camera);
      this.render();
    },
    updateAdaptive(fps) {
      if (!profile.gtao || !Number.isFinite(fps)) {
        return { canReducePixelRatio: true, changed: false };
      }
      let changed = false;
      if (fps < 54) {
        lowFpsTime += 1;
        recoveryTime = 0;
      } else if (fps > 58) {
        recoveryTime += 1;
        lowFpsTime = Math.max(0, lowFpsTime - 1);
      } else {
        lowFpsTime = Math.max(0, lowFpsTime - 0.25);
        recoveryTime = 0;
      }
      if (lowFpsTime >= 3 && gtaoEnabled) {
        gtaoEnabled = false;
        if (gtaoPass) gtaoPass.enabled = false;
        lowFpsTime = 0;
        changed = true;
      } else if (lowFpsTime >= 3 && bloomPass?.enabled) {
        bloomPass.enabled = false;
        lowFpsTime = 0;
        changed = true;
      } else if (lowFpsTime >= 3 && shadowScale > 0.5) {
        shadowScale = 0.5;
        applyShadowScale();
        lowFpsTime = 0;
        changed = true;
      }
      if (recoveryTime >= 8 && shadowScale < 1) {
        shadowScale = 1;
        applyShadowScale();
        recoveryTime = 0;
        changed = true;
      } else if (recoveryTime >= 8 && bloomPass && !bloomPass.enabled) {
        bloomPass.enabled = true;
        recoveryTime = 0;
        changed = true;
      } else if (recoveryTime >= 8 && !gtaoEnabled) {
        gtaoEnabled = true;
        if (gtaoPass) gtaoPass.enabled = true;
        recoveryTime = 0;
        changed = true;
      }
      this.syncDebugState();
      return {
        canReducePixelRatio: !gtaoEnabled && !bloomPass?.enabled && shadowScale <= 0.5 && !changed,
        changed,
      };
    },
    syncDebugState() {
      const info = renderer.info;
      canvas.dataset.graphicsProfile = profile.id;
      canvas.dataset.gtao = String(Boolean(gtaoEnabled && gtaoPass?.enabled));
      canvas.dataset.bloom = String(Boolean(bloomPass?.enabled));
      canvas.dataset.shadows = String(Boolean(profile.shadows && shadowRig));
      canvas.dataset.shadowMode = shadowRig?.mode ?? "none";
      canvas.dataset.shadowScale = shadowScale.toFixed(2);
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
