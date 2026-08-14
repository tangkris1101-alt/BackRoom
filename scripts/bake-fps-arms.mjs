import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

globalThis.ProgressEvent ??= class ProgressEvent {
  constructor(type, init = {}) {
    this.type = type;
    Object.assign(this, init);
  }
};

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modelDirectory = resolve(projectRoot, "src/assets/models");
const sourcePath = resolve(modelDirectory, "fps-arms-para.fbx");
const armOutputs = {
  L: {
    binaryPath: resolve(modelDirectory, "fps-arm-para-baked.bin"),
    base64Path: resolve(modelDirectory, "fps-arm-para-baked.bin.b64"),
  },
  R: {
    binaryPath: resolve(modelDirectory, "fps-arm-para-right-baked.bin"),
    base64Path: resolve(modelDirectory, "fps-arm-para-right-baked.bin.b64"),
  },
};
const poseTime = 2.025;
const sleeveColor = new THREE.Color(0.56, 0.36, 0.035);
const gloveColor = new THREE.Color(0.9, 0.55, 0.06);
const motionEuler = new THREE.Euler(0, 0, 0, "YXZ");
const motionQuaternion = new THREE.Quaternion();
const blendedColor = new THREE.Color();

function alignHandPose(model, suffix) {
  const mirrorSign = suffix === "L" ? 1 : -1;
  const hand = model.getObjectByName(`hand${suffix}`);
  const indexTip = model.getObjectByName(`f_index03${suffix}_end`);
  const middleTip = model.getObjectByName(`f_middle03${suffix}_end`);
  const pinkyTip = model.getObjectByName(`f_pinky03${suffix}_end`);
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
  const targetAlong = new THREE.Vector3(0.46 * mirrorSign, 0.1, -0.88).normalize();
  // The source right hand is already handed, unlike the old runtime mirror.
  // Reusing the left-hand palm normal turns its palm over around the finger
  // axis, leaving the right hand visibly hanging palm-down. Keep its fingers
  // aimed into the view, but reverse the palm-facing reference for the R rig.
  const targetNormalHint = suffix === "L"
    ? new THREE.Vector3(0.86, 0.34, 0.18)
    : new THREE.Vector3(0.86, -0.34, -0.18);
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

function applyRelaxedFingerPose(model, suffix) {
  const isLeft = suffix === "L";
  const fingers = {
    index: { curl: isLeft ? [0.24, 0.33, 0.18] : [0.4, 0.5, 0.29], spread: isLeft ? -0.05 : 0.018 },
    middle: { curl: isLeft ? [0.22, 0.35, 0.2] : [0.37, 0.53, 0.31], spread: isLeft ? -0.012 : 0.004 },
    ring: { curl: isLeft ? [0.28, 0.39, 0.23] : [0.43, 0.55, 0.34], spread: isLeft ? 0.025 : -0.024 },
    pinky: { curl: isLeft ? [0.34, 0.43, 0.26] : [0.49, 0.58, 0.37], spread: isLeft ? 0.06 : -0.06 },
  };

  Object.entries(fingers).forEach(([fingerName, pose]) => {
    pose.curl.forEach((curl, index) => {
      rotateBone(
        model,
        `f_${fingerName}0${index + 1}${suffix}`,
        curl,
        index === 0 ? pose.spread : 0,
        0,
      );
    });
  });

  const thumbSign = isLeft ? 1 : -1;
  rotateBone(model, `thumb01${suffix}`, isLeft ? 0.12 : 0.25, 0.18 * thumbSign, -0.3 * thumbSign);
  rotateBone(model, `thumb02${suffix}`, isLeft ? 0.2 : 0.34, 0.06 * thumbSign, -0.1 * thumbSign);
  rotateBone(model, `thumb03${suffix}`, isLeft ? 0.13 : 0.22, 0.02 * thumbSign, -0.04 * thumbSign);
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

function getFingerCreaseWeight(mesh, vertex, suffix) {
  const skinIndex = mesh.geometry.getAttribute("skinIndex");
  const skinWeight = mesh.geometry.getAttribute("skinWeight");
  const fingerWeights = new Map();
  for (let influence = 0; influence < 4; influence += 1) {
    const boneIndex = skinIndex.getComponent(vertex, influence);
    const boneName = mesh.skeleton.bones[boneIndex]?.name ?? "";
    const match = boneName.match(new RegExp(`^(f_(?:index|middle|ring|pinky)|thumb)(0[123])${suffix}$`, "i"));
    if (!match) continue;
    const key = `${match[1]}${match[2]}`;
    fingerWeights.set(key, (fingerWeights.get(key) ?? 0) + skinWeight.getComponent(vertex, influence));
  }
  const weights = [...fingerWeights.values()].sort((left, right) => right - left);
  if (weights.length < 2) return 0;
  return THREE.MathUtils.clamp(weights[0] * weights[1] * 5.4, 0, 1);
}

function bakeArmGeometry(model, suffix) {
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
      getVertexSideWeight(mesh, vertex, suffix) +
      getVertexSideWeight(mesh, vertex + 1, suffix) +
      getVertexSideWeight(mesh, vertex + 2, suffix);
    if (sideWeight >= 1.5) keptVertices.push(vertex, vertex + 1, vertex + 2);
  }

  const positions = new Float32Array(keptVertices.length * 3);
  const colors = new Float32Array(keptVertices.length * 3);
  const surfaceRoughness = new Float32Array(keptVertices.length);
  const roughnessByPosition = new Map();
  const position = new THREE.Vector3();
  keptVertices.forEach((sourceVertex, targetVertex) => {
    position.fromBufferAttribute(positionAttribute, sourceVertex);
    mesh.applyBoneTransform(sourceVertex, position).applyMatrix4(mesh.matrixWorld);
    position.toArray(positions, targetVertex * 3);

    const gloveMix = THREE.MathUtils.smoothstep(getGloveWeight(mesh, sourceVertex), 0.12, 0.76);
    const crease = getFingerCreaseWeight(mesh, sourceVertex, suffix);
    // This must be derived from position, not vertex index: indexed source
    // exports often repeat vertices along triangle seams, and per-index colour
    // noise would prevent mergeVertices from restoring smooth hand normals.
    const materialVariation = THREE.MathUtils.clamp(
      0.5 + (
        Math.sin(position.x * 8.3 + position.y * 5.1) +
        Math.sin(position.y * 6.7 - position.z * 7.9)
      ) * 0.12,
      0,
      1,
    );
    blendedColor.copy(sleeveColor).lerp(gloveColor, gloveMix);
    blendedColor.offsetHSL(0, 0, (materialVariation - 0.5) * 0.035 * gloveMix - crease * 0.045);
    blendedColor.toArray(colors, targetVertex * 3);
    surfaceRoughness[targetVertex] = THREE.MathUtils.lerp(
      0.52,
      THREE.MathUtils.clamp(0.53 + crease * 0.42 + (materialVariation - 0.5) * 0.14, 0, 1),
      gloveMix,
    );
    const positionKey = position.toArray().map((component) => component.toFixed(5)).join(",");
    const previous = roughnessByPosition.get(positionKey) ?? { total: 0, count: 0 };
    previous.total += surfaceRoughness[targetVertex];
    previous.count += 1;
    roughnessByPosition.set(positionKey, previous);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  // The source needs to be non-indexed while selecting triangles, but
  // calculating normals in that state assigns one normal per triangle and
  // makes the hands visibly faceted. Restore shared vertices first, compute
  // smooth normals, then expand again because the compact runtime format does
  // not store an index buffer.
  const smoothGeometry = mergeVertices(geometry, 1e-5);
  smoothGeometry.computeVertexNormals();
  const expanded = smoothGeometry.toNonIndexed();
  const expandedRoughness = new Float32Array(expanded.getAttribute("position").count);
  const expandedPositions = expanded.getAttribute("position");
  for (let index = 0; index < expandedRoughness.length; index += 1) {
    const positionKey = [expandedPositions.getX(index), expandedPositions.getY(index), expandedPositions.getZ(index)]
      .map((component) => component.toFixed(5))
      .join(",");
    const roughness = roughnessByPosition.get(positionKey);
    expandedRoughness[index] = roughness
      ? roughness.total / roughness.count
      : 0.58;
  }
  expanded.setAttribute("surfaceRoughness", new THREE.BufferAttribute(expandedRoughness, 1));
  return expanded;
}

function createBinaryGeometry(geometry) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const color = geometry.getAttribute("color");
  const surfaceRoughness = geometry.getAttribute("surfaceRoughness");
  const vertexCount = position.count;
  const componentCount = vertexCount * 3;
  const buffer = new ArrayBuffer(4 + (componentCount * 3 + vertexCount) * Float32Array.BYTES_PER_ELEMENT);
  new DataView(buffer).setUint32(0, vertexCount, true);
  let offset = 4;
  new Float32Array(buffer, offset, componentCount).set(position.array);
  offset += componentCount * Float32Array.BYTES_PER_ELEMENT;
  new Float32Array(buffer, offset, componentCount).set(normal.array);
  offset += componentCount * Float32Array.BYTES_PER_ELEMENT;
  new Float32Array(buffer, offset, componentCount).set(color.array);
  offset += componentCount * Float32Array.BYTES_PER_ELEMENT;
  new Float32Array(buffer, offset, vertexCount).set(surfaceRoughness.array);
  return buffer;
}

const sourceBytes = await readFile(sourcePath);
const sourceBuffer = sourceBytes.buffer.slice(
  sourceBytes.byteOffset,
  sourceBytes.byteOffset + sourceBytes.byteLength,
);
const bakeSide = async (suffix) => {
  const model = new FBXLoader().parse(sourceBuffer, "");
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(model.animations[0]).play();
  mixer.setTime(poseTime);
  model.updateMatrixWorld(true);
  alignHandPose(model, suffix);
  applyRelaxedFingerPose(model, suffix);
  model.updateMatrixWorld(true);
  const bakedGeometry = bakeArmGeometry(model, suffix);
  const binaryBytes = Buffer.from(createBinaryGeometry(bakedGeometry));
  const output = armOutputs[suffix];
  await Promise.all([
    writeFile(output.binaryPath, binaryBytes),
    writeFile(output.base64Path, binaryBytes.toString("base64"), "utf8"),
  ]);
  return bakedGeometry.getAttribute("position").count;
};

const [leftVertices, rightVertices] = await Promise.all([bakeSide("L"), bakeSide("R")]);
console.log(`Baked asymmetric FPS arms: left ${leftVertices} vertices, right ${rightVertices} vertices.`);
