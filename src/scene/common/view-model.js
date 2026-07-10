import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import glovedHandModelBase64 from "../../assets/models/gloved-hand-j-toastie.glb.b64?raw";
import { SHOW_FIRST_PERSON_VIEW_MODEL } from "../constants.js";

const handsLoader = new GLTFLoader();
let handsModelPromise = null;
const HAND_MODEL_SCALE = 0.24;
const HAND_MODEL_NAME = "EXTERNAL GLOVED HANDS";
const ARM_MESH_NAMES = new Set(["Arm", "HandModel001_2"]);
const HAND_REST_TRANSFORMS = {
  left: {
    position: new THREE.Vector3(-0.37, -0.61, -0.69),
    rotation: new THREE.Euler(
      THREE.MathUtils.degToRad(-14),
      THREE.MathUtils.degToRad(14),
      THREE.MathUtils.degToRad(-44),
    ),
  },
  right: {
    position: new THREE.Vector3(0.37, -0.61, -0.69),
    rotation: new THREE.Euler(
      THREE.MathUtils.degToRad(-14),
      THREE.MathUtils.degToRad(-14),
      THREE.MathUtils.degToRad(44),
    ),
  },
};

function applyViewModelMaterialSettings(material) {
  if (material.userData.viewModelPrepared) return material;
  material.userData.viewModelPrepared = true;
  material.depthTest = false;
  material.depthWrite = false;
  material.toneMapped = false;
  if ("color" in material) material.color.setRGB(0.015, 0.016, 0.014);
  if ("roughness" in material) material.roughness = Math.max(material.roughness ?? 0.65, 0.86);
  if ("metalness" in material) material.metalness = 0.02;
  if ("emissive" in material) material.emissive.setRGB(0.026, 0.025, 0.02);
  if ("emissiveIntensity" in material) material.emissiveIntensity = Math.max(material.emissiveIntensity ?? 0, 0.32);
  return material;
}

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

function loadGlovedHandModel() {
  if (!handsModelPromise) {
    handsModelPromise = new Promise((resolve, reject) => {
      handsLoader.parse(base64ToArrayBuffer(glovedHandModelBase64), "", (gltf) => resolve(gltf.scene), reject);
    });
  }
  return handsModelPromise;
}

function prepareHandsModel(model) {
  model.name = "first-person-gloved-hands-model";
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  model.scale.set(1, 1, 1);
  model.traverse((object) => {
    object.frustumCulled = false;
    object.renderOrder = 20;
    if (object.isMesh) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (ARM_MESH_NAMES.has(object.name) || materials.some((material) => ARM_MESH_NAMES.has(material?.name))) {
        object.visible = false;
        return;
      }
      object.castShadow = false;
      object.receiveShadow = false;
      if (Array.isArray(object.material)) {
        object.material.forEach(applyViewModelMaterialSettings);
      } else if (object.material) {
        applyViewModelMaterialSettings(object.material);
      }
    }
  });
  return model;
}

function createHandInstance(sourceModel, side) {
  const handAnchor = new THREE.Group();
  handAnchor.name = `first-person-${side}-gloved-hand`;
  const hand = SkeletonUtils.clone(sourceModel);
  prepareHandsModel(hand);

  const wrist = hand.getObjectByName("Wrist");
  if (wrist) {
    hand.updateWorldMatrix(true, true);
    const wristPosition = wrist.getWorldPosition(new THREE.Vector3());
    hand.position.sub(wristPosition);
  } else {
    const bounds = new THREE.Box3().setFromObject(hand);
    const center = bounds.getCenter(new THREE.Vector3());
    hand.position.sub(center);
  }

  const sideSign = side === "left" ? -1 : 1;
  const restTransform = HAND_REST_TRANSFORMS[side];
  handAnchor.add(hand);
  handAnchor.scale.set(sideSign * HAND_MODEL_SCALE, HAND_MODEL_SCALE, HAND_MODEL_SCALE);
  handAnchor.position.copy(restTransform.position);
  handAnchor.rotation.copy(restTransform.rotation);
  handAnchor.userData.side = side;
  handAnchor.userData.restPosition = restTransform.position.clone();
  handAnchor.userData.restRotation = restTransform.rotation.clone();
  return handAnchor;
}

function createHandPair(sourceModel) {
  const hands = new THREE.Group();
  hands.name = "first-person-external-gloved-hands-model";
  const leftHand = createHandInstance(sourceModel, "left");
  const rightHand = createHandInstance(sourceModel, "right");
  hands.add(leftHand);
  hands.add(rightHand);
  hands.userData.leftHand = leftHand;
  hands.userData.rightHand = rightHand;
  return hands;
}

export function attachFirstPersonViewModel(camera) {
  if (!SHOW_FIRST_PERSON_VIEW_MODEL) return null;
  const viewModel = new THREE.Group();
  viewModel.name = "first-person-external-gloved-hands";
  viewModel.userData.modelName = HAND_MODEL_NAME;
  viewModel.userData.loaded = false;
  camera.add(viewModel);
  loadGlovedHandModel()
    .then((sourceModel) => {
      if (!camera.children.includes(viewModel)) return;
      const hands = createHandPair(sourceModel);
      viewModel.add(hands);
      viewModel.userData.hands = hands;
      viewModel.userData.loaded = true;
    })
    .catch((error) => {
      viewModel.userData.loadError = error?.message ?? "failed";
    });
  return viewModel;
}

export function getViewModelName(viewModel) {
  if (!viewModel) return "NONE";
  return viewModel.userData.loaded ? viewModel.userData.modelName : `${HAND_MODEL_NAME} LOADING`;
}

export function updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition) {
  if (!viewModel) return;
  if (!viewModel.userData.previousPlayerPosition) {
    viewModel.userData.previousPlayerPosition = playerPosition.clone();
  }

  const previousPosition = viewModel.userData.previousPlayerPosition;
  const movement = Math.hypot(
    playerPosition.x - previousPosition.x,
    playerPosition.z - previousPosition.z,
  );
  previousPosition.copy(playerPosition);

  const walkAmount = Math.min(1, movement * 18);
  const breathe = Math.sin(elapsed * 1.8) * 0.006;
  const bob = Math.sin(elapsed * 9.2) * 0.006 * walkAmount;
  const sway = Math.sin(elapsed * 6.4) * 0.008 * walkAmount;
  viewModel.position.set(sway, breathe + bob, 0);
  viewModel.rotation.set(
    Math.sin(elapsed * 5.2) * 0.006 * walkAmount,
    Math.sin(elapsed * 4.4) * 0.006 * walkAmount,
    -sway * 0.1,
  );

  const hands = viewModel.userData.hands;
  if (!hands) return;
  const stridePhase = elapsed * (7.2 + walkAmount * 2.2);
  const idleLift = Math.sin(elapsed * 1.6) * 0.006;
  [hands.userData.leftHand, hands.userData.rightHand].forEach((handAnchor) => {
    if (!handAnchor) return;
    const sideSign = handAnchor.userData.side === "left" ? -1 : 1;
    const restPosition = handAnchor.userData.restPosition;
    const restRotation = handAnchor.userData.restRotation;
    const handPhase = stridePhase + (sideSign < 0 ? 0 : Math.PI);
    const lift = Math.sin(handPhase) * 0.038 * walkAmount;
    const push = Math.cos(handPhase) * 0.026 * walkAmount;
    const inwardSway = Math.sin(handPhase) * 0.014 * walkAmount;
    handAnchor.position.set(
      restPosition.x - sideSign * inwardSway,
      restPosition.y + idleLift + lift,
      restPosition.z + push,
    );
    handAnchor.rotation.set(
      restRotation.x + Math.cos(handPhase) * 0.045 * walkAmount,
      restRotation.y + sideSign * Math.sin(handPhase) * 0.04 * walkAmount,
      restRotation.z + sideSign * Math.sin(handPhase) * 0.035 * walkAmount,
    );
  });
}
