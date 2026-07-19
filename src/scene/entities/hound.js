import * as THREE from "three";
import { HOUND_CONTACT_RADIUS } from "../constants.js";
import { createLimbSegment } from "../common/view-model.js";
import { createEntityMover } from "./behavior.js";

const HOUND_RECOMPUTE_INTERVAL = 0.42;
const HOUND_STUCK_THRESHOLD = 0.58;
const HOUND_DIRECT_CHASE_DISTANCE = 10.5;
const HOUND_FLASH_STUN_DURATION = 1.5;

export function createHoundModel() {
  const group = new THREE.Group();
  group.name = "hound-entity";

  const hideMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b0807,
    emissive: 0x150605,
    emissiveIntensity: 0.22,
    roughness: 0.9,
    metalness: 0,
  });
  const sinewMaterial = new THREE.MeshStandardMaterial({
    color: 0x231512,
    emissive: 0x260706,
    emissiveIntensity: 0.18,
    roughness: 0.82,
  });
  const eyeMaterial = new THREE.MeshBasicMaterial({
    color: 0xff4b24,
    transparent: true,
    opacity: 0.88,
  });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.78, 8, 16), hideMaterial);
  body.position.set(0, 0.72, 0);
  body.rotation.z = Math.PI / 2;
  body.scale.set(1.12, 0.78, 0.88);
  group.add(body);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 12), hideMaterial);
  chest.position.set(0, 0.78, -0.34);
  chest.scale.set(0.92, 1.1, 0.82);
  group.add(chest);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), hideMaterial);
  head.position.set(0, 0.94, -0.62);
  head.scale.set(0.82, 0.74, 1.34);
  group.add(head);

  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.09, 0.2, 10), sinewMaterial);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0.9, -0.78);
  group.add(snout);

  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), eyeMaterial);
    eye.position.set(side * 0.064, 0.99, -0.76);
    group.add(eye);

    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 8), hideMaterial);
    ear.position.set(side * 0.11, 1.08, -0.6);
    ear.rotation.z = -side * 0.34;
    group.add(ear);
  });

  [
    [-0.18, -0.32],
    [0.18, -0.32],
    [-0.18, 0.32],
    [0.18, 0.32],
  ].forEach(([x, z], index) => {
    const upper = createLimbSegment(
      [x, 0.62, z],
      [x * 1.18, 0.32, z - (index < 2 ? 0.18 : -0.1)],
      0.042,
      0.03,
      sinewMaterial,
    );
    const lower = createLimbSegment(
      [x * 1.18, 0.32, z - (index < 2 ? 0.18 : -0.1)],
      [x * 1.34, 0.06, z - (index < 2 ? 0.28 : -0.2)],
      0.028,
      0.02,
      sinewMaterial,
    );
    group.add(upper, lower);
  });

  const tail = createLimbSegment([0, 0.8, 0.48], [0.08, 0.92, 0.84], 0.032, 0.012, sinewMaterial);
  group.add(tail);

  return group;
}


export function createHoundEntity(
  scene,
  {
    spawnPosition,
    isWalkable,
    speed = 1.45,
    id = "hound",
    type = "hound",
    dormant = false,
    dormantArmRadius = 0,
    initialState = null,
    cols,
    rows,
    isCellOpen,
    worldToCell,
    cellCenter,
  },
) {
  const group = createHoundModel();
  group.position.set(spawnPosition.x, 0, spawnPosition.z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);

  const stunLight = new THREE.PointLight(0xd9eeff, 0, 3.6, 2.1);
  stunLight.position.set(0, 0.86, 0);
  stunLight.visible = false;
  group.add(stunLight);

  let contact = false;
  let isDormant = Boolean(dormant);
  let stunnedUntil = 0;
  let wasFlashlit = false;
  if (initialState && Number.isFinite(initialState.position?.x) && Number.isFinite(initialState.position?.z)) {
    group.position.x = initialState.position.x;
    group.position.z = initialState.position.z;
  }
  if (initialState?.awakened === true) isDormant = false;
  const mover = createEntityMover({
    group,
    isWalkable,
    speed,
    contactRadius: HOUND_CONTACT_RADIUS,
    cols,
    rows,
    isCellOpen,
    worldToCell,
    cellCenter,
    recomputeInterval: HOUND_RECOMPUTE_INTERVAL,
    stuckThreshold: HOUND_STUCK_THRESHOLD,
    directChaseDistance: HOUND_DIRECT_CHASE_DISTANCE,
    turnRate: 10.5,
  });

  function isFlashlightHit(effects) {
    const beam = effects.flashlightBeam;
    if (!beam?.active || !beam.origin || !beam.direction) return false;
    const dx = group.position.x - beam.origin.x;
    const dz = group.position.z - beam.origin.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.2 || distance > beam.range) return false;
    const directionLength = Math.hypot(beam.direction.x, beam.direction.z);
    if (directionLength < 0.001) return false;
    const dot = (dx * beam.direction.x + dz * beam.direction.z) / (distance * directionLength);
    if (dot < (beam.minimumDot ?? 0.86)) return false;
    if (!worldToCell || !isCellOpen) return true;
    const samples = Math.max(2, Math.ceil(distance / 0.45));
    for (let index = 1; index < samples; index += 1) {
      const ratio = index / samples;
      const cell = worldToCell(beam.origin.x + dx * ratio, beam.origin.z + dz * ratio);
      if (!isCellOpen(cell.col, cell.row)) return false;
    }
    return true;
  }

  return {
    getState() {
      return {
        id,
        type,
        position: { x: group.position.x, z: group.position.z },
        contact,
        awakened: !isDormant,
      };
    },
    update(delta, elapsed, playerPosition, effects = {}) {
      const dx = playerPosition.x - group.position.x;
      const dz = playerPosition.z - group.position.z;
      const distance = Math.hypot(dx, dz);
      const flashlit = isFlashlightHit(effects);
      if (flashlit && !wasFlashlit) {
        stunnedUntil = Math.max(stunnedUntil, elapsed + HOUND_FLASH_STUN_DURATION);
        mover.clearPath();
      }
      wasFlashlit = flashlit;
      const stunned = elapsed < stunnedUntil;
      if (isDormant && dormantArmRadius > 0 && distance <= dormantArmRadius) {
        isDormant = false;
        mover.clearPath();
      }
      const closeSurge = distance < 8 ? 1.12 : 1;
      const stride = 0.96 + Math.sin(elapsed * 3.8) * 0.09;
      const moveState = stunned
        ? { distance, contact: false }
        : mover.update(delta, elapsed, playerPosition, effects, {
            dormant: isDormant,
            speedScale: closeSurge * stride,
          });
      contact = !stunned && moveState.contact;

      const gait = Math.sin(elapsed * 7.2) * 0.035;
      group.position.y = isDormant
        ? 0.01
        : stunned
          ? 0.025 + Math.abs(Math.sin(elapsed * 19)) * 0.018
          : Math.abs(Math.sin(elapsed * 5.4)) * 0.032;
      group.rotation.z = isDormant ? Math.sin(elapsed * 0.9) * 0.012 : stunned ? Math.sin(elapsed * 27) * 0.085 : gait;
      stunLight.visible = stunned;
      stunLight.intensity = stunned ? 1.15 + Math.sin(elapsed * 18) * 0.35 : 0;

      return {
        id,
        active: true,
        contact,
        distance: moveState.distance,
        x: group.position.x,
        y: 0.9,
        z: group.position.z,
        dormant: isDormant,
        stunned,
        flashlit,
      };
    },
  };
}
