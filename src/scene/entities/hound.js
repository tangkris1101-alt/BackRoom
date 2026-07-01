import * as THREE from "three";
import { HOUND_CONTACT_RADIUS } from "../constants.js";
import { createLimbSegment } from "../common/view-model.js";
import { resolveEntityStep } from "./spawn.js";

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
    initialState = null,
    dormant = false,
    dormantArmRadius = 8,
  },
) {
  const group = createHoundModel();
  group.position.set(spawnPosition.x, 0, spawnPosition.z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);

  let contact = false;
  let isDormant = dormant;
  if (initialState && Number.isFinite(initialState.position?.x) && Number.isFinite(initialState.position?.z)) {
    group.position.x = initialState.position.x;
    group.position.z = initialState.position.z;
    contact = Boolean(initialState.contact);
    if (typeof initialState.dormant === "boolean") isDormant = initialState.dormant;
  }
  return {
    getState() {
      return {
        id,
        type,
        position: { x: group.position.x, z: group.position.z },
        contact,
        dormant: isDormant,
      };
    },
    update(delta, elapsed, playerPosition) {
      const dx = playerPosition.x - group.position.x;
      const dz = playerPosition.z - group.position.z;
      const distance = Math.hypot(dx, dz);

      if (isDormant && distance > dormantArmRadius) {
        return {
          id,
          type,
          active: false,
          contact: false,
          distance,
          x: group.position.x,
          y: 0.9,
          z: group.position.z,
          dormant: true,
        };
      }
      isDormant = false;

      if (distance > 0.001 && !contact) {
        const surge = 0.78 + Math.sin(elapsed * 1.9) * 0.12;
        const step = Math.min(distance, speed * surge * delta);
        const resolved = resolveEntityStep(
          group.position,
          (dx / distance) * step,
          (dz / distance) * step,
          isWalkable,
        );
        group.position.x = resolved.x;
        group.position.z = resolved.z;
        group.rotation.y = Math.atan2(dx, dz);
      }

      const gait = Math.sin(elapsed * 7.2) * 0.035;
      group.position.y = Math.abs(Math.sin(elapsed * 5.4)) * 0.028;
      group.rotation.z = gait;
      contact = contact || distance <= HOUND_CONTACT_RADIUS;
      return {
        id,
        type,
        active: true,
        contact,
        distance,
        x: group.position.x,
        y: 0.9,
        z: group.position.z,
        dormant: false,
      };
    },
  };
}

