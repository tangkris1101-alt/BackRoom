import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

globalThis.ProgressEvent ??= class ProgressEvent {
  constructor(type, init = {}) {
    this.type = type;
    Object.assign(this, init);
  }
};

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modelDirectory = resolve(projectRoot, "src/assets/models");
const sourcePath = resolve(modelDirectory, "fps-arms-para.fbx");
const binaryPath = resolve(modelDirectory, "fps-arm-para-baked.bin");
const base64Path = resolve(modelDirectory, "fps-arm-para-baked.bin.b64");
const poseTime = 2.025;
const sleeveColor = new THREE.Color(0.82, 0.66, 0.055);
const gloveColor = new THREE.Color(0.95, 0.7, 0.08);
const motionEuler = new THREE.Euler(0, 0, 0, "YXZ");
const motionQuaternion = new THREE.Quaternion();
const blendedColor = new THREE.Color();

function alignHandPose(model) {
  const hand = model.getObjectByName("handL");
  const indexTip = model.getObjectByName("f_index03L_end");
  const middleTip = model.getObjectByName("f_middle03L_end");
  const pinkyTip = model.getObjectByName("f_pinky03L_end");
  if (!hand || !indexTip || !middleTip || !pinkyTip || !hand.parent) return;

  const handPosition = hand.getWorldPosition(new THREE.Vector3());
  const currentAcross = pinkyTip
    .getWorldPosition(new THREE.Vector3())
    .sub(indexTip.getWorldPosition(new THREE.Vector3()))
    .normalize();
  const currentAlong = middleTip
    .getWorldPosition(new THREE.Vector3())
    .sub(handPosition)
    .normalize();
  const currentNormal = new THREE.Vector3()
    .crossVectors(currentAcross, currentAlong)
    .normalize();
  const targetAlong = new THREE.Vector3(0.46, 0.1, -0.88).normalize();
  const targetNormalHint = new THREE.Vector3(0.86, 0.34, 0.18).normalize();
  const targetNormal = targetNormalHint
    .addScaledVector(targetAlong, -targetNormalHint.dot(targetAlong))
    .normalize();
  const targetAcross = new THREE.Vector3()
    .crossVectors(targetAlong, targetNormal)
    .normalize();
  targetNormal.crossVectors(targetAcross, targetAlong).normalize();

  const currentBasis = new THREE.Matrix4().makeBasis(currentAcross, currentAlong, currentNormal);
  const targetBasis = new THREE.Matrix4().makeBasis(targetAcross, targetAlong, targetNormal);
  const deltaQuaternion = new THREE.Quaternion().setFromRotationMatrix(
    targetBasis.multiply(currentBasis.invert()),
  );
  const desiredWorldQuaternion = deltaQuaternion.multiply(
    hand.getWorldQuaternion(new THREE.Quaternion()),
  );
  const parentWorldQuaternion = hand.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  hand.quaternion.copy(parentWorldQuaternion.multiply(desiredWorldQuaternion));
}

function rotateBone(model, name, x = 0, y = 0, z = 0) {
  const bone = model.getObjectByName(name);
  if (!bone) return;
  motionEuler.set(x, y, z);
  motionQuaternion.setFromEuler(motionEuler);
  bone.quaternion.multiply(motionQuaternion);
}

function applyRelaxedFingerPose(model) {
  const fingers = {
    index: { curl: [0.3, 0.38, 0.2], spread: -0.035 },
    middle: { curl: [0.28, 0.4, 0.22], spread: -0.008 },
    ring: { curl: [0.31, 0.43, 0.24], spread: 0.02 },
    pinky: { curl: [0.36, 0.46, 0.27], spread: 0.052 },
  };

  Object.entries(fingers).forEach(([fingerName, pose]) => {
    pose.curl.forEach((curl, index) => {
      rotateBone(
        model,
        `f_${fingerName}0${index + 1}L`,
        curl,
        index === 0 ? pose.spread : 0,
        0,
      );
    });
  });

  rotateBone(model, "thumb01L", 0.16, 0.2, -0.34);
  rotateBone(model, "thumb02L", 0.26, 0.07, -0.1);
  rotateBone(model, "thumb03L", 0.16, 0.02, -0.03);
}

function getVertexSideWeight(mesh, vertex, suffix) {
  const skinIndex = mesh.geometry.getAttribute("skinIndex");
  const skinWeight = mesh.geometry.getAttribute("skinWeight");
  let weight = 0;
  for (let influence = 0; influence < 4; influence += 1) {
    const boneIndex = skinIndex.getComponent(vertex, influence);
    if (new RegExp(`${suffix}(?:_end)?$`).test(mesh.skeleton.bones[boneIndex]?.name ?? "")) {
      weight += skinWeight.getComponent(vertex, influence);
    }
  }
  return weight;
}

function getGloveWeight(mesh, vertex) {
  const skinIndex = mesh.geometry.getAttribute("skinIndex");
  const skinWeight = mesh.geometry.getAttribute("skinWeight");
  let weight = 0;
  for (let influence = 0; influence < 4; influence += 1) {
    const boneIndex = skinIndex.getComponent(vertex, influence);
    const boneName = mesh.skeleton.bones[boneIndex]?.name ?? "";
    if (/^(?:hand[LR]|palm_|f_|thumb)/i.test(boneName)) {
      weight += skinWeight.getComponent(vertex, influence);
    }
  }
  return weight;
}

function bakeLeftArmGeometry(model) {
  const mesh = model.getObjectByProperty("isSkinnedMesh", true);
  if (!mesh) throw new Error("No skinned mesh found in FPS arms source model.");
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  mesh.geometry = source;
  model.updateMatrixWorld(true);
  mesh.skeleton.update();

  const positionAttribute = source.getAttribute("position");
  const keptVertices = [];
  for (let vertex = 0; vertex < positionAttribute.count; vertex += 3) {
    const sideWeight =
      getVertexSideWeight(mesh, vertex, "L") +
      getVertexSideWeight(mesh, vertex + 1, "L") +
      getVertexSideWeight(mesh, vertex + 2, "L");
    if (sideWeight >= 1.5) keptVertices.push(vertex, vertex + 1, vertex + 2);
  }

  const positions = new Float32Array(keptVertices.length * 3);
  const colors = new Float32Array(keptVertices.length * 3);
  const position = new THREE.Vector3();
  keptVertices.forEach((sourceVertex, targetVertex) => {
    position.fromBufferAttribute(positionAttribute, sourceVertex);
    mesh.applyBoneTransform(sourceVertex, position).applyMatrix4(mesh.matrixWorld);
    position.toArray(positions, targetVertex * 3);

    const gloveMix = THREE.MathUtils.smoothstep(getGloveWeight(mesh, sourceVertex), 0.12, 0.76);
    blendedColor.copy(sleeveColor).lerp(gloveColor, gloveMix);
    blendedColor.toArray(colors, targetVertex * 3);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createBinaryGeometry(geometry) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const color = geometry.getAttribute("color");
  const vertexCount = position.count;
  const componentCount = vertexCount * 3;
  const buffer = new ArrayBuffer(4 + componentCount * 3 * Float32Array.BYTES_PER_ELEMENT);
  new DataView(buffer).setUint32(0, vertexCount, true);
  let offset = 4;
  new Float32Array(buffer, offset, componentCount).set(position.array);
  offset += componentCount * Float32Array.BYTES_PER_ELEMENT;
  new Float32Array(buffer, offset, componentCount).set(normal.array);
  offset += componentCount * Float32Array.BYTES_PER_ELEMENT;
  new Float32Array(buffer, offset, componentCount).set(color.array);
  return buffer;
}

const sourceBytes = await readFile(sourcePath);
const sourceBuffer = sourceBytes.buffer.slice(
  sourceBytes.byteOffset,
  sourceBytes.byteOffset + sourceBytes.byteLength,
);
const model = new FBXLoader().parse(sourceBuffer, "");
const mixer = new THREE.AnimationMixer(model);
mixer.clipAction(model.animations[0]).play();
mixer.setTime(poseTime);
model.updateMatrixWorld(true);
alignHandPose(model);
applyRelaxedFingerPose(model);
model.updateMatrixWorld(true);
const bakedGeometry = bakeLeftArmGeometry(model);
const binaryGeometry = createBinaryGeometry(bakedGeometry);
const binaryBytes = Buffer.from(binaryGeometry);
await Promise.all([
  writeFile(binaryPath, binaryBytes),
  writeFile(base64Path, binaryBytes.toString("base64"), "utf8"),
]);
console.log(`Baked ${bakedGeometry.getAttribute("position").count} vertices.`);
