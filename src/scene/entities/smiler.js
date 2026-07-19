import * as THREE from "three";
import { createLimbSegment } from "../common/view-model.js";
import { createEntityMover } from "./behavior.js";

const CONTACT_RADIUS = 0.82;
const lookDirection = new THREE.Vector3();
const toSmiler = new THREE.Vector3();

export function createSmilerModel() {
  const group = new THREE.Group();
  group.name = "smiler-entity";
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x010101,
    emissive: 0x020202,
    emissiveIntensity: 0.1,
    roughness: 0.98,
  });
  const faceMaterial = new THREE.MeshBasicMaterial({ color: 0xf8fff0, toneMapped: false });
  const gumMaterial = new THREE.MeshBasicMaterial({ color: 0x160202, toneMapped: false });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.88, 5, 10), bodyMaterial);
  torso.position.y = 1.3;
  torso.scale.set(0.72, 1, 0.48);
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 12), bodyMaterial);
  head.position.set(0, 2.05, -0.02);
  head.scale.set(0.9, 1.05, 0.6);
  group.add(head);
  const eyeGeometry = new THREE.SphereGeometry(0.033, 10, 6);
  for (const x of [-0.075, 0.075]) {
    const eye = new THREE.Mesh(eyeGeometry, faceMaterial);
    eye.position.set(x, 2.09, -0.205);
    group.add(eye);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.026, 7, 24, Math.PI), gumMaterial);
  mouth.position.set(0, 1.99, -0.205);
  mouth.rotation.set(0, 0, Math.PI);
  group.add(mouth);
  for (let index = 0; index < 7; index += 1) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.055, 5), faceMaterial);
    tooth.position.set(-0.09 + index * 0.03, 1.95 + Math.sin(index / 6 * Math.PI) * 0.035, -0.225);
    tooth.rotation.z = Math.PI;
    group.add(tooth);
  }
  const limbs = [
    [[-0.14, 1.68, 0], [-0.45, 1.05, -0.02], [-0.58, 0.3, -0.15]],
    [[0.14, 1.68, 0], [0.48, 1.02, -0.04], [0.62, 0.28, -0.16]],
    [[-0.1, 0.88, 0], [-0.24, 0.42, 0.04], [-0.3, 0.02, -0.14]],
    [[0.1, 0.88, 0], [0.25, 0.4, 0.04], [0.34, 0.02, -0.14]],
  ];
  limbs.forEach(([a, b, c]) => {
    group.add(createLimbSegment(a, b, 0.04, 0.025, bodyMaterial));
    group.add(createLimbSegment(b, c, 0.026, 0.012, bodyMaterial));
  });
  const faceLight = new THREE.PointLight(0xeaffd5, 0.42, 3.5, 2.4);
  faceLight.position.set(0, 2.02, -0.3);
  group.add(faceLight);
  group.userData.head = head;
  return group;
}

export function createSmilerEntity(scene, {
  id = "smiler",
  spawnPosition,
  isWalkable,
  camera,
  initialState = null,
  cols,
  rows,
  isCellOpen,
  worldToCell,
  cellCenter,
  speed = 1.72,
} = {}) {
  const group = createSmilerModel();
  group.position.set(initialState?.position?.x ?? spawnPosition.x, 0, initialState?.position?.z ?? spawnPosition.z);
  scene.add(group);
  let contact = false;
  let alertTimer = Math.max(0, initialState?.alertTimer ?? 0);
  let stunnedTimer = Math.max(0, initialState?.stunnedTimer ?? 0);
  const mover = createEntityMover({
    group, isWalkable, speed, contactRadius: CONTACT_RADIUS,
    cols, rows, isCellOpen, worldToCell, cellCenter,
    recomputeInterval: 0.38, stuckThreshold: 0.58, directChaseDistance: 10, turnRate: 9,
  });

  return {
    getState() {
      return {
        id,
        type: "smiler",
        position: { x: group.position.x, z: group.position.z },
        contact,
        alertTimer,
        stunnedTimer,
      };
    },
    update(delta, elapsed, playerPosition, effects = {}) {
      const distance = Math.hypot(playerPosition.x - group.position.x, playerPosition.z - group.position.z);
      camera.getWorldDirection(lookDirection);
      toSmiler.set(group.position.x, 1.9, group.position.z).sub(camera.position).normalize();
      const watched = distance < 20 && lookDirection.dot(toSmiler) > 0.965;
      const noisy = Boolean(effects.playerSprinting && distance < 18) || Boolean(effects.playerMoving && distance < 8);
      const lit = Boolean(effects.flashlightOn && distance < 24);
      if (noisy || lit || distance < 6.5) alertTimer = Math.max(alertTimer, 7);
      alertTimer = Math.max(0, alertTimer - delta);
      if (effects.firesaltActive && effects.firesaltPosition &&
          Math.hypot(group.position.x - effects.firesaltPosition.x, group.position.z - effects.firesaltPosition.z) <= (effects.firesaltRadius ?? 0)) {
        stunnedTimer = 4;
      }
      stunnedTimer = Math.max(0, stunnedTimer - delta);
      const dormant = stunnedTimer > 0 || watched || alertTimer <= 0;
      const moveState = mover.update(delta, elapsed, playerPosition, effects, { dormant, speedScale: lit ? 1.16 : 1 });
      contact = !watched && stunnedTimer <= 0 && moveState.contact;
      group.position.y = Math.sin(elapsed * 2.8) * 0.015;
      group.rotation.z = Math.sin(elapsed * 2.1) * 0.025;
      if (group.userData.head) group.userData.head.rotation.z = Math.sin(elapsed * 1.7) * 0.09;
      return {
        id,
        type: "smiler",
        active: true,
        contact,
        distance: moveState.distance,
        watched,
        stunned: stunnedTimer > 0,
        x: group.position.x,
        y: 1.92,
        z: group.position.z,
      };
    },
  };
}
