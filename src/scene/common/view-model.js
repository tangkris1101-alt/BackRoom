import * as THREE from "three";
import bakedArmBase64 from "../../assets/models/fps-arm-para-baked.bin.b64?raw";
import { SHOW_FIRST_PERSON_VIEW_MODEL } from "../constants.js";
import { createWorldItemModel } from "./world-items.js";

const VIEW_MODEL_NAME = "BAKED RIGGED FPS HAZMAT ARMS";
const ARMS_SCALE = 0.15;
const ARMS_POSITION = new THREE.Vector3(-0.024, -0.32, -0.36);
const BAKED_HEADER_BYTES = 4;
const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;

let bakedArmGeometry = null;
let bakedArmMaterial = null;

const motionEuler = new THREE.Euler(0, 0, 0, "YXZ");
const motionQuaternion = new THREE.Quaternion();
const HELD_ITEM_NAME = "first-person-held-item";

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

function decodeBakedArmGeometry() {
  if (bakedArmGeometry) return bakedArmGeometry;
  const buffer = base64ToArrayBuffer(bakedArmBase64);
  const view = new DataView(buffer);
  const vertexCount = view.getUint32(0, true);
  const componentCount = vertexCount * 3;
  let offset = BAKED_HEADER_BYTES;
  const positions = cloneFloatSection(buffer, offset, componentCount);
  offset += componentCount * FLOAT_BYTES;
  const normals = cloneFloatSection(buffer, offset, componentCount);
  offset += componentCount * FLOAT_BYTES;
  const colors = cloneFloatSection(buffer, offset, componentCount);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  bakedArmGeometry = geometry;
  return geometry;
}

function getBakedArmMaterial() {
  if (bakedArmMaterial) return bakedArmMaterial;
  bakedArmMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.02,
    emissive: 0x15130b,
    emissiveIntensity: 0.42,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  return bakedArmMaterial;
}

function createArmMesh(name, mirrorSign) {
  const mesh = new THREE.Mesh(decodeBakedArmGeometry(), getBakedArmMaterial());
  mesh.name = name;
  mesh.scale.set(mirrorSign, 1, 1);
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

  const left = createArmMesh("first-person-left-hazmat-arm-mesh", 1);
  const right = createArmMesh("first-person-right-hazmat-arm-mesh", -1);
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
    item.position.set(0.2, -0.52, -0.69);
    item.rotation.set(0.12, Math.PI / 2, -0.16);
    item.scale.setScalar(0.84);
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
  const sprintAmount = motion?.sprinting ? walkAmount : 0;
  const strideScale = THREE.MathUtils.lerp(1, 1.2, sprintAmount);
  const breathe = Math.sin(elapsed * 1.8) * 0.0045;
  const bob = Math.sin(stridePhase * 2) * 0.0045 * walkAmount * strideScale;
  const sway = Math.sin(stridePhase) * 0.0055 * walkAmount * strideScale;
  viewModel.position.set(sway, breathe + bob, 0);
  viewModel.rotation.set(
    Math.sin(stridePhase * 2) * 0.0035 * walkAmount,
    Math.sin(stridePhase) * 0.004 * walkAmount,
    -Math.sin(stridePhase) * 0.003 * walkAmount,
  );

  const arms = viewModel.userData.arms;
  if (!arms) return;
  for (const side of ["left", "right"]) {
    const sideSign = side === "left" ? -1 : 1;
    const phase = stridePhase + (side === "left" ? 0 : Math.PI);
    const stride = Math.sin(phase) * walkAmount * strideScale;
    const returnSwing = Math.cos(phase) * walkAmount * strideScale;
    const mesh = arms.userData.meshes[side];
    const restPosition = mesh?.userData.viewModelRestPosition;
    const restQuaternion = mesh?.userData.viewModelRestQuaternion;
    if (!mesh || !restPosition || !restQuaternion) continue;
    mesh.position.set(
      restPosition.x - sideSign * stride * 0.012,
      restPosition.y + Math.sin(stridePhase * 2) * 0.008 * walkAmount,
      restPosition.z + returnSwing * 0.022,
    );
    motionEuler.set(
      returnSwing * 0.016,
      sideSign * stride * 0.012,
      sideSign * stride * 0.018,
    );
    motionQuaternion.setFromEuler(motionEuler);
    mesh.quaternion.copy(restQuaternion).multiply(motionQuaternion);
  }
}
