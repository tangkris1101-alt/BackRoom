import * as THREE from "three";
import { BACTERIA_CONTACT_RADIUS } from "../constants.js";
import { createLimbSegment } from "../common/view-model.js";
import { resolveEntityStep } from "./spawn.js";

export function createBacteriaModel() {
  const group = new THREE.Group();
  group.name = "bacteria-lifeform";

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x050303,
    emissive: 0x170403,
    emissiveIntensity: 0.18,
    roughness: 0.86,
    metalness: 0,
  });
  const sinewMaterial = new THREE.MeshStandardMaterial({
    color: 0x16100e,
    emissive: 0x3b0906,
    emissiveIntensity: 0.22,
    roughness: 0.74,
    metalness: 0,
  });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff3d22,
    transparent: true,
    opacity: 0.78,
  });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.45, 10), bodyMaterial);
  torso.position.y = 1.12;
  torso.rotation.z = 0.08;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 10), bodyMaterial);
  head.position.set(0.03, 1.94, 0);
  head.scale.set(0.78, 1.12, 0.7);
  group.add(head);

  const maw = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.024, 0.035), glowMaterial);
  maw.position.set(0.03, 1.9, -0.145);
  group.add(maw);

  const limbs = [
    [[-0.12, 1.58, 0], [-0.6, 0.72, -0.12], 0.028, 0.02],
    [[0.13, 1.54, 0], [0.55, 0.68, -0.1], 0.028, 0.02],
    [[-0.08, 0.56, 0], [-0.36, 0.02, -0.08], 0.036, 0.024],
    [[0.09, 0.56, 0], [0.34, 0.02, -0.07], 0.036, 0.024],
    [[0.01, 1.72, 0.02], [-0.2, 1.2, 0.34], 0.015, 0.009],
    [[0.02, 1.76, 0.02], [0.26, 1.12, 0.3], 0.015, 0.009],
  ];
  limbs.forEach(([start, end, top, bottom]) => {
    group.add(createLimbSegment(start, end, top, bottom, sinewMaterial));
  });

  for (let i = 0; i < 7; i += 1) {
    const tendril = createLimbSegment(
      [(Math.random() - 0.5) * 0.16, 1.4 + Math.random() * 0.45, 0.03],
      [(Math.random() - 0.5) * 0.64, 0.55 + Math.random() * 0.55, 0.18 + Math.random() * 0.28],
      0.009,
      0.004,
      sinewMaterial,
    );
    group.add(tendril);
  }

  return group;
}


export function createBacteriaEntity(scene, { spawnPosition, isWalkable, speed = 1.05, id = "bacteria" }) {
  const group = createBacteriaModel();
  group.position.set(spawnPosition.x, 0, spawnPosition.z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);

  let contact = false;
  return {
    update(delta, elapsed, playerPosition) {
      const dx = playerPosition.x - group.position.x;
      const dz = playerPosition.z - group.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 0.001 && !contact) {
        const step = Math.min(distance, speed * delta);
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

      const sway = Math.sin(elapsed * 2.1) * 0.04;
      group.position.y = Math.sin(elapsed * 3.6) * 0.025;
      group.rotation.z = sway;
      contact = contact || distance <= BACTERIA_CONTACT_RADIUS;
      return {
        id,
        active: true,
        contact,
        distance,
        x: group.position.x,
        y: 1.45,
        z: group.position.z,
      };
    },
  };
}

