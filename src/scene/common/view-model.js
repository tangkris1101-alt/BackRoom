import * as THREE from "three";
import bakedLeftArmBase64 from "../../assets/models/fps-arm-para-baked.bin.b64?raw";
import bakedRightArmBase64 from "../../assets/models/fps-arm-para-right-baked.bin.b64?raw";
import relaxedLeftArmUrl from "../../assets/models/fps-arm-para-relaxed-baked.bin?url";
import relaxedRightArmUrl from "../../assets/models/fps-arm-para-right-relaxed-baked.bin?url";
import { SHOW_FIRST_PERSON_VIEW_MODEL } from "../constants.js";
import { createWorldItemModel, getWorldItemDefinition } from "./world-items.js";
import armAnchors from "../../assets/models/fps-arm-anchors.json";

const VIEW_MODEL_NAME = "BAKED RIGGED FPS HAZMAT ARMS";
const ARMS_SCALE = 0.15;
const ARMS_POSITION = new THREE.Vector3(-0.024, -0.32, -0.36);
const EMPTY_ARMS_POSITION = new THREE.Vector3(-0.024, -0.5, -0.42);
const TUCKED_ARMS_POSITION = new THREE.Vector3(-0.024, -0.88, -0.42);
const ARM_POSE_TRANSITION_HALF = 0.11;
const EMPTY_ARM_OUTSET = 3;
const BAKED_HEADER_BYTES = 4;
const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;

const bakedArmGeometries = new Map();
let relaxedArmLoad = null;
let bakedArmMaterial = null;

const motionEuler = new THREE.Euler(0, 0, 0, "YXZ");
const motionQuaternion = new THREE.Quaternion();
const HELD_ITEM_NAME = "first-person-held-item";
const HELD_ITEM_MOUNT_NAME = "first-person-held-item-mount";
// Fallback grip centre for the right hand in the arm group's local units,
// measured from the grip bake. The bake script exports the authoritative
// value to fps-arm-anchors.json; this only covers a missing or stale file.
const FALLBACK_GRIP_ANCHOR = new THREE.Vector3(0.974, -0.852, -3.026);

function getGripAnchor(arms, side = "right") {
  const anchor = armAnchors?.[arms?.userData?.pose]?.[side]?.position;
  if (Array.isArray(anchor) && anchor.length === 3 && anchor.every((value) => Number.isFinite(value))) {
    return new THREE.Vector3().fromArray(anchor);
  }
  return FALLBACK_GRIP_ANCHOR.clone();
}

// Held props ride the baked right hand instead of the camera: the mount sits on
// the exported grip centre, cancels the arm rig's scale so items keep camera
// units, and inherits the pose transition, walk swing and camera motion for
// free. Its position is refreshed whenever the hand pose changes.
function syncHeldItemMount(arms) {
  const mesh = arms?.userData?.meshes?.right;
  if (!mesh) return null;
  let mount = arms.userData.heldItemMount;
  if (!mount) {
    mount = new THREE.Group();
    mount.name = HELD_ITEM_MOUNT_NAME;
    mount.scale.setScalar(1 / ARMS_SCALE);
    mesh.add(mount);
    arms.userData.heldItemMount = mount;
  }
  mount.position.copy(getGripAnchor(arms, "right"));
  return mount;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
const FLASHLIGHT_LENS_AXIS = new THREE.Vector3(1, 0, 0);
const HELD_FLASHLIGHT_DIRECTION = new THREE.Vector3(-0.08, -0.14, -1).normalize();
const VIEW_MODEL_LIGHT_LAYER = 1;

export function createLimbSegment(start, end, radiusTop, radiusBottom, material) {
  const startVector = new THREE.Vector3(...start);
  const endVector = new THREE.Vector3(...end);
  const midpoint = startVector.clone().add(endVector).multiplyScalar(0.5);
  const direction = endVector.clone().sub(startVector);
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, direction.length(), 18, 1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(midpoint);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function cloneFloatSection(buffer, offset, length) {
  return new Float32Array(buffer.slice(offset, offset + length * FLOAT_BYTES));
}

function decodeBakedArmGeometry(id, source) {
  if (bakedArmGeometries.has(id)) return bakedArmGeometries.get(id);
  const buffer = typeof source === "string" ? base64ToArrayBuffer(source) : source;
  const view = new DataView(buffer);
  const vertexCount = view.getUint32(0, true);
  const componentCount = vertexCount * 3;
  let offset = BAKED_HEADER_BYTES;
  const positions = cloneFloatSection(buffer, offset, componentCount);
  offset += componentCount * FLOAT_BYTES;
  const normals = cloneFloatSection(buffer, offset, componentCount);
  offset += componentCount * FLOAT_BYTES;
  const colors = cloneFloatSection(buffer, offset, componentCount);
  offset += componentCount * FLOAT_BYTES;
  const surfaceRoughness = cloneFloatSection(buffer, offset, vertexCount);
  offset += vertexCount * FLOAT_BYTES;
  const skinSurface = cloneFloatSection(buffer, offset, vertexCount);
  offset += vertexCount * FLOAT_BYTES;
  const nailSurface = cloneFloatSection(buffer, offset, vertexCount);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("surfaceRoughness", new THREE.BufferAttribute(surfaceRoughness, 1));
  geometry.setAttribute("skinSurface", new THREE.BufferAttribute(skinSurface, 1));
  geometry.setAttribute("nailSurface", new THREE.BufferAttribute(nailSurface, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  bakedArmGeometries.set(id, geometry);
  return geometry;
}

// The relaxed arm geometry is fetched over the network, so the arms are added
// to the camera well after the scene has been constructed. Callers that want a
// complete first render (shader prewarm, loading gate) must await this.
export function preloadFirstPersonViewModel() {
  if (!SHOW_FIRST_PERSON_VIEW_MODEL) return Promise.resolve(null);
  return loadRelaxedArmGeometries();
}

export function primeFirstPersonViewModelPoses() {
  decodeBakedArmGeometry("grip-left", bakedLeftArmBase64);
  decodeBakedArmGeometry("grip-right", bakedRightArmBase64);
}

function loadRelaxedArmGeometries() {
  if (!relaxedArmLoad) {
    // A rejection must never stay cached: the next level entry has to run a
    // fresh fetch instead of replaying the failure with the arms hidden for the
    // rest of the session. Callers handle the rejection, so rethrowing here
    // cannot surface as an unhandled one.
    relaxedArmLoad = Promise.all([relaxedLeftArmUrl, relaxedRightArmUrl].map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`unable to load relaxed arm: ${response.status}`);
      return response.arrayBuffer();
    })).then(([left, right]) => ({
      left: decodeBakedArmGeometry("empty-left", left),
      right: decodeBakedArmGeometry("empty-right", right),
    })).catch((error) => {
      relaxedArmLoad = null;
      throw error;
    });
  }
  return relaxedArmLoad;
}

function getBakedArmMaterial() {
  if (bakedArmMaterial) return bakedArmMaterial;
  bakedArmMaterial = new THREE.MeshStandardMaterial({
    // The bake separates fabric from skin, including restrained fingertip
    // circulation and pale nail beds. Keep the base matte so it does not
    // inherit the plastic or rubber look of the former hazmat gloves.
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.82,
    metalness: 0,
    emissive: 0x000000,
    emissiveIntensity: 0,
    flatShading: false,
    // Preserve normal self-occlusion: disabling depth completely made hidden
    // backfaces render through the palms as dirty-looking colour patches.
    depthTest: true,
    depthWrite: true,
    toneMapped: true,
    side: THREE.FrontSide,
  });
  bakedArmMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float surfaceRoughness;\nattribute float skinSurface;\nattribute float nailSurface;\nvarying float vSurfaceRoughness;\nvarying float vSkinSurface;\nvarying float vNailSurface;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvSurfaceRoughness = surfaceRoughness;\nvSkinSurface = skinSurface;\nvNailSurface = nailSurface;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vSurfaceRoughness;\nvarying float vSkinSurface;\nvarying float vNailSurface;",
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nfloat creaseShadow = smoothstep(0.7, 0.98, vSurfaceRoughness) * vSkinSurface;\ndiffuseColor.rgb *= 1.0 - creaseShadow * 0.16;\ndiffuseColor.rgb += vec3(0.055, 0.012, 0.007) * vNailSurface;\nroughnessFactor = clamp(roughnessFactor * mix(0.72, 1.15, vSurfaceRoughness) * mix(1.0, 0.72, vNailSurface), 0.42, 0.98);",
      )
      .replace(
        "#include <output_fragment>",
        "float skinRim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.2);\nfloat skinTranslucency = vSkinSurface * (0.018 + skinRim * 0.065);\noutgoingLight += vec3(0.34, 0.06, 0.035) * skinTranslucency;\n#include <output_fragment>",
      );
  };
  bakedArmMaterial.customProgramCacheKey = () => "first-person-human-skin-surface-v3";
  return bakedArmMaterial;
}

function createArmMesh(name, geometry) {
  const mesh = new THREE.Mesh(geometry, getBakedArmMaterial());
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.renderOrder = 20;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.viewModelRestPosition = mesh.position.clone();
  mesh.userData.viewModelRestQuaternion = mesh.quaternion.clone();
  return mesh;
}

function createBakedHazmatArms(relaxedGeometries) {
  const arms = new THREE.Group();
  arms.name = "first-person-baked-hazmat-arms-model";
  arms.position.copy(EMPTY_ARMS_POSITION);
  arms.rotation.set(0, 0, 0);
  arms.scale.setScalar(ARMS_SCALE);

  const left = createArmMesh(
    "first-person-left-hazmat-arm-mesh",
    relaxedGeometries.left,
  );
  const right = createArmMesh(
    "first-person-right-hazmat-arm-mesh",
    relaxedGeometries.right,
  );
  arms.add(left, right);
  arms.userData.meshes = { left, right };
  arms.userData.pose = "empty";
  return arms;
}

function setArmPoseGeometry(arms, pose) {
  if (arms.userData.pose === pose) return;
  const { left, right } = arms.userData.meshes;
  left.geometry = pose === "grip"
    ? decodeBakedArmGeometry("grip-left", bakedLeftArmBase64)
    : bakedArmGeometries.get("empty-left");
  right.geometry = pose === "grip"
    ? decodeBakedArmGeometry("grip-right", bakedRightArmBase64)
    : bakedArmGeometries.get("empty-right");
  arms.userData.pose = pose;
  // The grip anchor moves with the fingers, so the prop mount has to follow the
  // geometry it was measured against.
  if (arms.userData.heldItemMount) syncHeldItemMount(arms);
}

export function attachFirstPersonViewModel(camera) {
  if (!SHOW_FIRST_PERSON_VIEW_MODEL) return null;
  const viewModel = new THREE.Group();
  viewModel.name = "first-person-baked-hazmat-arms";
  viewModel.userData.modelName = VIEW_MODEL_NAME;
  viewModel.userData.loaded = false;
  viewModel.userData.heldItemId = null;
  viewModel.userData.targetHeldItemId = null;
  // A small camera-space bounce keeps the hands readable in dark scenes, but
  // directional and local scene lights remain the dominant illumination.
  const fillLight = new THREE.HemisphereLight(0xe8f0df, 0x304039, 0.12);
  fillLight.name = "first-person-view-model-fill";
  viewModel.add(fillLight);
  viewModel.userData.fillLight = fillLight;
  // A nearby key light gives the arms a readable minimum exposure in levels
  // that deliberately have no ambient scene light. It starts disabled and is
  // enabled only by the owning level, so it cannot brighten the world.
  const keyLight = new THREE.PointLight(0xffe7d8, 0, 1.35, 2);
  keyLight.name = "first-person-view-model-key";
  keyLight.position.set(0, 0.08, 0.16);
  viewModel.add(keyLight);
  viewModel.userData.keyLight = keyLight;
  camera.add(viewModel);

  loadRelaxedArmGeometries().then((relaxedGeometries) => {
    const arms = createBakedHazmatArms(relaxedGeometries);
    viewModel.add(arms);
    viewModel.userData.arms = arms;
    viewModel.userData.loaded = true;
  }).catch((error) => {
    viewModel.userData.loadError = error?.message ?? "failed";
  });
  // Never rejects: a failed arm fetch must not be able to hold up the loader.
  viewModel.userData.ready = loadRelaxedArmGeometries().catch(() => null);
  return viewModel;
}

export function setFirstPersonViewModelLighting(viewModel, { intensity = 0, skyColor = 0xe8f0df, groundColor = 0x304039 } = {}) {
  const fillLight = viewModel?.userData?.fillLight;
  if (!fillLight) return;
  fillLight.color.set(skyColor);
  fillLight.groundColor.set(groundColor);
  const blend = 0.12;
  fillLight.intensity = THREE.MathUtils.lerp(fillLight.intensity, intensity, blend);
}

export function setFirstPersonViewModelKeyLight(viewModel, { intensity = 0, color = 0xffe7d8 } = {}) {
  const keyLight = viewModel?.userData?.keyLight;
  if (!keyLight) return;
  // Keep this camera-space light off the world layer. The meshes move to the
  // dedicated layer only in levels that opt in, retaining normal scene-light
  // response elsewhere.
  const camera = viewModel.parent;
  const fillLight = viewModel.userData.fillLight;
  camera?.layers.enable(VIEW_MODEL_LIGHT_LAYER);
  fillLight?.layers.set(VIEW_MODEL_LIGHT_LAYER);
  keyLight.layers.set(VIEW_MODEL_LIGHT_LAYER);
  viewModel.userData.arms?.traverse((child) => {
    if (child.isMesh) child.layers.set(VIEW_MODEL_LIGHT_LAYER);
  });
  keyLight.color.set(color);
  keyLight.intensity = THREE.MathUtils.lerp(keyLight.intensity, intensity, 0.12);
}

function setHeldItemMaterialState(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.renderOrder = 21;
    child.frustumCulled = false;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((material) => {
      const isTransparent = material.transparent || material.opacity < 1 || material.transmission > 0;
      material.depthTest = isTransparent;
      material.depthWrite = false;
      material.needsUpdate = true;
    });
  });
}

function positionHeldItem(item, itemId) {
  // Offsets are camera units measured from the exported grip centre of the
  // right hand, so the prop sits inside the palm instead of at fixed
  // camera-space coordinates that drift with every re-bake. Scale is applied
  // with multiplyScalar because several models (keys, bottles) carry their own
  // authored scale on the root group and assigning would flatten it.
  item.position.set(0, 0.01, 0.03);
  item.rotation.set(0, 0, 0);
  const shape = getWorldItemDefinition(itemId)?.shape ?? "generic";

  if (itemId === "flashlight") {
    // The model's lens is on local +X, so align that axis with the camera
    // forward vector instead of leaving the barrel pointed down-right across
    // the screen, then roll the button up into the thumb.
    item.position.set(0.01, 0.035, 0.045);
    item.quaternion.setFromUnitVectors(FLASHLIGHT_LENS_AXIS, HELD_FLASHLIGHT_DIRECTION);
    item.rotateX(-0.38);
    item.scale.multiplyScalar(0.32);
  } else if (itemId === "detector") {
    item.position.set(0.02, 0.02, 0.06);
    item.rotation.set(-0.82, 0.16, -0.14);
    item.scale.multiplyScalar(0.55);
  } else if (itemId === "compass") {
    item.position.set(0.015, 0.05, 0.055);
    item.rotation.set(-0.95, 0.06, -0.08);
    item.scale.multiplyScalar(0.3);
  } else if (itemId === "almond-water" || itemId === "super-almond-water" || itemId === "silence-liquid") {
    // The bottle profile starts at its base, so drop it until the palm grips
    // the middle of the body instead of the bottom edge.
    item.position.set(0.015, -0.12, 0.06);
    item.rotation.set(0.08, -0.26, -0.08);
    item.scale.multiplyScalar(0.3);
  } else if (itemId === "firesalt") {
    item.position.set(0.02, 0.03, 0.05);
    item.rotation.set(0.28, -0.42, -0.18);
    item.scale.multiplyScalar(0.4);
  } else if (shape === "note" || shape === "file" || shape === "badge") {
    // Flat sheets are unreadable lying face-up on the palm; stand them up and
    // lean them back towards the eyes like a held page.
    item.position.set(0.01, 0.06, 0.07);
    item.rotation.set(1.15, 0.12, -0.12);
    item.scale.multiplyScalar(shape === "note" ? 0.5 : 0.62);
  } else if (itemId?.startsWith("level-key-")) {
    item.position.set(0.015, 0.03, 0.05);
    item.rotation.set(0.18, -0.26, -0.52);
    item.scale.multiplyScalar(0.9);
  } else {
    item.position.set(0.015, 0.03, 0.05);
    item.rotation.set(0.18, -0.3, -0.18);
    item.scale.multiplyScalar(0.78);
  }
}

function replaceHeldItem(viewModel, heldItemId) {
  if (viewModel.userData.heldItemId === heldItemId) return;
  const previous = viewModel.getObjectByName(HELD_ITEM_NAME);
  if (previous) previous.removeFromParent();
  viewModel.userData.heldItemId = heldItemId;
  if (!heldItemId) return;

  const arms = viewModel.userData.arms;
  const mount = arms ? syncHeldItemMount(arms) : null;
  if (!mount) return;

  const heldItem = createWorldItemModel(heldItemId);
  heldItem.name = HELD_ITEM_NAME;
  setHeldItemMaterialState(heldItem);
  positionHeldItem(heldItem, heldItemId);
  mount.add(heldItem);
}

export function syncFirstPersonHeldItem(camera, itemId) {
  const viewModel = camera?.getObjectByName("first-person-baked-hazmat-arms");
  if (!viewModel) return;
  const arms = viewModel.userData.arms;
  if (!arms) return;
  const targetId = typeof itemId === "string" && itemId ? itemId : null;
  if (viewModel.userData.targetHeldItemId === targetId) return;
  viewModel.userData.targetHeldItemId = targetId;

  // Item-to-item changes stay in the grip pose. Empty-to-held changes tuck
  // the arms below the frame before replacing the baked finger geometry.
  if (targetId && viewModel.userData.heldItemId && arms.userData.pose === "grip") {
    replaceHeldItem(viewModel, targetId);
    return;
  }
  if (Boolean(targetId) === Boolean(viewModel.userData.heldItemId) && !viewModel.userData.poseTransition) return;
  if (viewModel.userData.poseTransition?.phase === "lower") return;
  viewModel.userData.poseTransition = {
    phase: "lower",
    elapsed: 0,
    startPosition: arms.position.clone(),
  };
}

function updateArmPoseTransition(viewModel, delta) {
  const arms = viewModel.userData.arms;
  if (!arms) return;
  const transition = viewModel.userData.poseTransition;
  if (transition) {
    transition.elapsed += delta;
    const progress = THREE.MathUtils.smoothstep(
      Math.min(1, transition.elapsed / ARM_POSE_TRANSITION_HALF), 0, 1,
    );
    if (transition.phase === "lower") {
      arms.position.lerpVectors(transition.startPosition, TUCKED_ARMS_POSITION, progress);
      if (transition.elapsed >= ARM_POSE_TRANSITION_HALF) {
        const targetId = viewModel.userData.targetHeldItemId;
        setArmPoseGeometry(arms, targetId ? "grip" : "empty");
        replaceHeldItem(viewModel, targetId);
        transition.phase = "raise";
        transition.elapsed = 0;
        arms.position.copy(TUCKED_ARMS_POSITION);
      }
    } else {
      const targetPosition = arms.userData.pose === "grip" ? ARMS_POSITION : EMPTY_ARMS_POSITION;
      arms.position.lerpVectors(TUCKED_ARMS_POSITION, targetPosition, progress);
      if (transition.elapsed >= ARM_POSE_TRANSITION_HALF) {
        arms.position.copy(targetPosition);
        viewModel.userData.poseTransition = null;
      }
    }
  }
}

export function getViewModelName(viewModel) {
  if (!viewModel) return "NONE";
  if (viewModel.userData.loadError) return VIEW_MODEL_NAME + " ERROR: " + viewModel.userData.loadError;
  return viewModel.userData.loaded ? viewModel.userData.modelName : VIEW_MODEL_NAME + " LOADING";
}

export function updateFirstPersonHazmatViewModel(viewModel, elapsed) {
  if (!viewModel) return;
  const motion = viewModel.parent?.userData.firstPersonMotion;
  const walkAmount = THREE.MathUtils.clamp(motion?.walkBobStrength ?? 0, 0, 1);
  const stridePhase = Number.isFinite(motion?.walkCycle) ? motion.walkCycle : 0;
  const lastElapsed = viewModel.userData.lastMotionElapsed ?? elapsed;
  const motionDelta = THREE.MathUtils.clamp(elapsed - lastElapsed, 0, 0.1);
  viewModel.userData.lastMotionElapsed = elapsed;
  const targetSprintBlend = motion?.sprinting && walkAmount > 0.05 ? 1 : 0;
  viewModel.userData.sprintBlend = THREE.MathUtils.damp(
    viewModel.userData.sprintBlend ?? 0,
    targetSprintBlend,
    targetSprintBlend ? 10 : 7,
    motionDelta,
  );
  const sprintBlend = viewModel.userData.sprintBlend;
  const strideScale = THREE.MathUtils.lerp(0.98, 2.2, sprintBlend);
  const bodyScale = THREE.MathUtils.lerp(0.72, 1.35, sprintBlend);
  const breathe = Math.sin(elapsed * 1.8) * 0.0045;
  const bob = Math.sin(stridePhase * 2) * 0.0045 * walkAmount * bodyScale;
  const sway = Math.sin(stridePhase) * 0.0055 * walkAmount * bodyScale;
  const airborne = motion?.grounded === false;
  const verticalVelocity = THREE.MathUtils.clamp(motion?.verticalVelocity ?? 0, -7, 6);
  const landingImpact = THREE.MathUtils.clamp(motion?.landingImpact ?? 0, 0, 1);
  const airborneY = airborne ? THREE.MathUtils.clamp(verticalVelocity * 0.0035, -0.018, 0.016) : 0;
  const airborneZ = airborne ? 0.018 : 0;
  viewModel.position.set(sway, breathe + bob - landingImpact * 0.028 + airborneY, airborneZ + landingImpact * 0.022);
  viewModel.rotation.set(
    Math.sin(stridePhase * 2) * 0.0035 * walkAmount * bodyScale + landingImpact * 0.025,
    Math.sin(stridePhase) * 0.004 * walkAmount * bodyScale,
    -Math.sin(stridePhase) * 0.003 * walkAmount * bodyScale,
  );

  const arms = viewModel.userData.arms;
  if (!arms) return;
  updateArmPoseTransition(viewModel, motionDelta);
  if (!viewModel.userData.armVariation) {
    viewModel.userData.armVariation = { left: 1, right: 1, leftPhase: 0, rightPhase: 0 };
    viewModel.userData.armVariationTarget = { ...viewModel.userData.armVariation };
    viewModel.userData.armVariationStep = -1;
  }
  const armStepIndex = Math.floor(stridePhase / Math.PI);
  if (walkAmount > 0.05 && armStepIndex !== viewModel.userData.armVariationStep) {
    viewModel.userData.armVariationStep = armStepIndex;
    viewModel.userData.armVariationTarget = {
      left: randomBetween(0.86, 1.14),
      right: randomBetween(0.86, 1.14),
      leftPhase: randomBetween(-0.08, 0.08),
      rightPhase: randomBetween(-0.08, 0.08),
    };
  }
  const armVariation = viewModel.userData.armVariation;
  const armVariationTarget = viewModel.userData.armVariationTarget;
  armVariation.left = THREE.MathUtils.damp(
    armVariation.left,
    armVariationTarget.left,
    5.5,
    motionDelta,
  );
  armVariation.right = THREE.MathUtils.damp(
    armVariation.right,
    armVariationTarget.right,
    5.5,
    motionDelta,
  );
  armVariation.leftPhase = THREE.MathUtils.damp(
    armVariation.leftPhase,
    armVariationTarget.leftPhase,
    5.5,
    motionDelta,
  );
  armVariation.rightPhase = THREE.MathUtils.damp(
    armVariation.rightPhase,
    armVariationTarget.rightPhase,
    5.5,
    motionDelta,
  );
  const holdingItem = Boolean(viewModel.userData.heldItemId);
  const emptyOutset = EMPTY_ARM_OUTSET * THREE.MathUtils.clamp(
    (viewModel.parent?.aspect ?? 16 / 9) / (16 / 9), 0.25, 1,
  );
  for (const side of ["left", "right"]) {
    const isLeft = side === "left";
    const sideSign = isLeft ? -1 : 1;
    // Keep both arms on one footstep clock; small per-step amplitude and phase
    // changes add life without allowing the hands to drift out of opposition.
    const phase = stridePhase
      + (isLeft ? 0.2 + armVariation.leftPhase : Math.PI - 0.13 + armVariation.rightPhase);
    const sideAmplitude = isLeft ? 0.9 : 1;
    const heldDamping = holdingItem && !isLeft ? 0.36 : 1;
    const swingAmplitude = walkAmount * strideScale * sideAmplitude * armVariation[side] * heldDamping;
    const stride = Math.sin(phase) * swingAmplitude;
    const returnSwing = Math.cos(phase) * swingAmplitude;
    const idleDrift = Math.sin(elapsed * (isLeft ? 1.19 : 1.47) + (isLeft ? 0.6 : 1.9));
    const idleRoll = Math.sin(elapsed * (isLeft ? 0.83 : 1.04) + (isLeft ? 1.2 : 0.25));
    const mesh = arms.userData.meshes[side];
    const restPosition = mesh?.userData.viewModelRestPosition;
    const restQuaternion = mesh?.userData.viewModelRestQuaternion;
    if (!mesh || !restPosition || !restQuaternion) continue;
    if (holdingItem) {
      mesh.position.set(
        restPosition.x - sideSign * stride * 0.04 + idleDrift * (isLeft ? 0.0015 : 0.0022),
        restPosition.y + Math.sin(phase * 2) * 0.011 * walkAmount * bodyScale - landingImpact * 0.016 + idleDrift * 0.0015,
        restPosition.z + returnSwing * 0.082 + (airborne ? 0.012 : 0) + (!isLeft ? -0.012 : 0),
      );
      motionEuler.set(
        returnSwing * 0.065 + landingImpact * 0.018 + idleDrift * (isLeft ? 0.008 : 0.012),
        sideSign * stride * 0.04 + idleRoll * 0.009,
        sideSign * stride * 0.075 + idleRoll * (isLeft ? 0.008 : -0.011),
      );
    } else {
      // Opposite fore-and-aft swings let each relaxed hand briefly enter the
      // bottom edge without lifting both hands together on every footfall.
      mesh.position.set(
        restPosition.x + sideSign * emptyOutset - sideSign * stride * 0.025,
        restPosition.y + returnSwing * 0.085 - landingImpact * 0.016 + idleDrift * 0.0015,
        restPosition.z + returnSwing * 0.19 + (airborne ? 0.012 : 0),
      );
      motionEuler.set(
        returnSwing * 0.105 + landingImpact * 0.018,
        sideSign * stride * 0.018 + idleRoll * 0.005,
        sideSign * stride * 0.032 + idleRoll * (isLeft ? 0.005 : -0.005),
      );
    }
    motionQuaternion.setFromEuler(motionEuler);
    mesh.quaternion.copy(restQuaternion).multiply(motionQuaternion);
  }
}
