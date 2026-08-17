import * as THREE from "three";
import bakedLeftArmBase64 from "../../assets/models/fps-arm-para-baked.bin.b64?raw";
import bakedRightArmBase64 from "../../assets/models/fps-arm-para-right-baked.bin.b64?raw";
import { SHOW_FIRST_PERSON_VIEW_MODEL } from "../constants.js";
import { createWorldItemModel } from "./world-items.js";

const VIEW_MODEL_NAME = "BAKED RIGGED FPS HAZMAT ARMS";
const ARMS_SCALE = 0.15;
const ARMS_POSITION = new THREE.Vector3(-0.024, -0.32, -0.36);
const BAKED_HEADER_BYTES = 4;
const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;

const bakedArmGeometries = new Map();
let bakedArmMaterial = null;

const motionEuler = new THREE.Euler(0, 0, 0, "YXZ");
const motionQuaternion = new THREE.Quaternion();
const HELD_ITEM_NAME = "first-person-held-item";
const FLASHLIGHT_LENS_AXIS = new THREE.Vector3(1, 0, 0);
const HELD_FLASHLIGHT_DIRECTION = new THREE.Vector3(-0.08, -0.14, -1).normalize();

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

function decodeBakedArmGeometry(id, base64) {
  if (bakedArmGeometries.has(id)) return bakedArmGeometries.get(id);
  const buffer = base64ToArrayBuffer(base64);
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

function createBakedHazmatArms() {
  const arms = new THREE.Group();
  arms.name = "first-person-baked-hazmat-arms-model";
  arms.position.copy(ARMS_POSITION);
  arms.rotation.set(0, 0, 0);
  arms.scale.setScalar(ARMS_SCALE);

  const left = createArmMesh(
    "first-person-left-hazmat-arm-mesh",
    decodeBakedArmGeometry("left", bakedLeftArmBase64),
  );
  const right = createArmMesh(
    "first-person-right-hazmat-arm-mesh",
    decodeBakedArmGeometry("right", bakedRightArmBase64),
  );
  arms.add(left, right);
  arms.userData.meshes = { left, right };
  return arms;
}

export function attachFirstPersonViewModel(camera) {
  if (!SHOW_FIRST_PERSON_VIEW_MODEL) return null;
  const viewModel = new THREE.Group();
  viewModel.name = "first-person-baked-hazmat-arms";
  viewModel.userData.modelName = VIEW_MODEL_NAME;
  viewModel.userData.loaded = false;
  // A small camera-space bounce keeps the hands readable in dark scenes, but
  // directional and local scene lights remain the dominant illumination.
  const fillLight = new THREE.HemisphereLight(0xe8f0df, 0x304039, 0.12);
  fillLight.name = "first-person-view-model-fill";
  viewModel.add(fillLight);
  viewModel.userData.fillLight = fillLight;
  camera.add(viewModel);

  try {
    const arms = createBakedHazmatArms();
    viewModel.add(arms);
    viewModel.userData.arms = arms;
    viewModel.userData.loaded = true;
  } catch (error) {
    viewModel.userData.loadError = error?.message ?? "failed";
  }
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
  item.position.set(0.19, -0.475, -0.64);
  item.rotation.set(0, 0, 0);
  item.scale.setScalar(0.8);

  if (itemId === "flashlight") {
    // The baked arms do not expose wrist or palm bones. This camera-space
    // pose is therefore calibrated to overlap the right palm. The model's
    // lens is on local +X, so align that axis with the camera forward vector
    // instead of leaving the barrel pointed down-right across the screen.
    item.position.set(0.15, -0.58, -0.74);
    item.quaternion.setFromUnitVectors(FLASHLIGHT_LENS_AXIS, HELD_FLASHLIGHT_DIRECTION);
    item.rotateX(-0.38);
    item.scale.setScalar(0.32);
  } else if (itemId === "detector") {
    item.position.set(0.19, -0.51, -0.63);
    item.rotation.set(-0.82, 0.16, -0.14);
    item.scale.setScalar(0.9);
  } else if (itemId === "compass") {
    item.position.set(0.18, -0.51, -0.62);
    item.rotation.set(-0.95, 0.06, -0.08);
    item.scale.setScalar(0.42);
  } else if (itemId === "almond-water" || itemId === "super-almond-water" || itemId === "silence-liquid") {
    item.position.set(0.155, -0.6, -0.84);
    item.rotation.set(0.08, -0.26, -0.08);
    item.scale.setScalar(0.36);
  } else if (itemId === "firesalt") {
    item.position.set(0.17, -0.55, -0.7);
    item.rotation.set(0.28, -0.42, -0.18);
    item.scale.setScalar(0.72);
  } else if (itemId?.startsWith("level-key-")) {
    item.position.set(0.18, -0.49, -0.62);
    item.rotation.set(0.18, -0.26, -0.52);
    item.scale.setScalar(0.9);
  } else {
    item.position.set(0.18, -0.5, -0.62);
    item.rotation.set(0.18, -0.3, -0.18);
    item.scale.setScalar(0.78);
  }
}

export function syncFirstPersonHeldItem(camera, itemId) {
  const viewModel = camera?.getObjectByName("first-person-baked-hazmat-arms");
  if (!viewModel) return;
  const heldItemId = typeof itemId === "string" && itemId ? itemId : null;
  if (viewModel.userData.heldItemId === heldItemId) return;

  const previous = viewModel.getObjectByName(HELD_ITEM_NAME);
  if (previous) viewModel.remove(previous);
  viewModel.userData.heldItemId = heldItemId;
  if (!heldItemId) return;

  const heldItem = createWorldItemModel(heldItemId);
  heldItem.name = HELD_ITEM_NAME;
  setHeldItemMaterialState(heldItem);
  positionHeldItem(heldItem, heldItemId);
  viewModel.add(heldItem);
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
  const strideScale = THREE.MathUtils.lerp(0.78, 2.2, sprintBlend);
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
  const holdingItem = Boolean(viewModel.userData.heldItemId);
  for (const side of ["left", "right"]) {
    const isLeft = side === "left";
    const sideSign = isLeft ? -1 : 1;
    // A walking cycle should alternate the hands, but real arms never trace
    // perfectly mirrored sine waves. The unequal cadence, phase and idle
    // drift keep the relaxed bake from turning into a mannequin pose.
    const cadence = isLeft ? 0.94 : 1.06;
    const phase = stridePhase * cadence + (isLeft ? 0.2 : Math.PI - 0.13);
    const sideAmplitude = isLeft ? 0.78 : 1;
    const heldDamping = holdingItem && !isLeft ? 0.36 : 1;
    const stride = Math.sin(phase) * walkAmount * strideScale * sideAmplitude * heldDamping;
    const returnSwing = Math.cos(phase) * walkAmount * strideScale * sideAmplitude * heldDamping;
    const idleDrift = Math.sin(elapsed * (isLeft ? 1.19 : 1.47) + (isLeft ? 0.6 : 1.9));
    const idleRoll = Math.sin(elapsed * (isLeft ? 0.83 : 1.04) + (isLeft ? 1.2 : 0.25));
    const mesh = arms.userData.meshes[side];
    const restPosition = mesh?.userData.viewModelRestPosition;
    const restQuaternion = mesh?.userData.viewModelRestQuaternion;
    if (!mesh || !restPosition || !restQuaternion) continue;
    mesh.position.set(
      restPosition.x - sideSign * stride * 0.028 + idleDrift * (isLeft ? 0.0015 : 0.0022),
      restPosition.y + Math.sin(phase * 2) * 0.008 * walkAmount * bodyScale - landingImpact * 0.016 + idleDrift * 0.0015,
      restPosition.z + returnSwing * 0.06 + (airborne ? 0.012 : 0) + (holdingItem && !isLeft ? -0.012 : 0),
    );
    motionEuler.set(
      returnSwing * 0.055 + landingImpact * 0.018 + idleDrift * (isLeft ? 0.008 : 0.012),
      sideSign * stride * 0.04 + idleRoll * 0.009,
      sideSign * stride * 0.065 + idleRoll * (isLeft ? 0.008 : -0.011),
    );
    motionQuaternion.setFromEuler(motionEuler);
    mesh.quaternion.copy(restQuaternion).multiply(motionQuaternion);
  }
}
