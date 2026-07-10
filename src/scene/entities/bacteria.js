import * as THREE from "three";
import { BACTERIA_CONTACT_RADIUS } from "../constants.js";
import { createLimbSegment } from "../common/view-model.js";
import { createEntityMover } from "./behavior.js";

const BACTERIA_RECOMPUTE_INTERVAL = 0.48;
const BACTERIA_STUCK_THRESHOLD = 0.66;
const BACTERIA_DIRECT_CHASE_DISTANCE = 8.8;

export function createBacteriaModel() {
  const group = new THREE.Group();
  group.name = "bacteria-lifeform";

  const silhouetteMaterial = new THREE.MeshStandardMaterial({
    color: 0x030202,
    emissive: 0x060303,
    emissiveIntensity: 0.1,
    roughness: 0.94,
    metalness: 0,
  });
  const sinewMaterial = new THREE.MeshStandardMaterial({
    color: 0x0c0807,
    emissive: 0x100504,
    emissiveIntensity: 0.12,
    roughness: 0.88,
  });
  const wetEdgeMaterial = new THREE.MeshStandardMaterial({
    color: 0x120b09,
    emissive: 0x180605,
    emissiveIntensity: 0.16,
    roughness: 0.72,
  });
  const mouthMaterial = new THREE.MeshBasicMaterial({
    color: 0x2a0805,
    transparent: true,
    opacity: 0.42,
  });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.135, 1.42, 9), silhouetteMaterial);
  torso.position.set(-0.01, 1.28, 0);
  torso.rotation.z = -0.12;
  torso.scale.set(0.74, 1, 0.58);
  group.add(torso);

  const ribs = [
    [[-0.13, 1.56, -0.015], [0.12, 1.49, -0.02]],
    [[-0.14, 1.38, -0.006], [0.11, 1.31, -0.012]],
    [[-0.11, 1.18, 0.005], [0.08, 1.12, 0]],
  ];
  ribs.forEach(([start, end]) => {
    group.add(createLimbSegment(start, end, 0.011, 0.008, wetEdgeMaterial));
  });

  const neck = createLimbSegment([0.025, 1.9, -0.01], [0.06, 2.14, -0.035], 0.035, 0.024, sinewMaterial);
  group.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 10), silhouetteMaterial);
  head.name = "bacteria-head";
  head.position.set(0.08, 2.26, -0.05);
  head.scale.set(0.95, 1.18, 0.72);
  head.rotation.z = 0.16;
  group.add(head);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.028, 0.032), mouthMaterial);
  jaw.position.set(0.08, 2.18, -0.18);
  jaw.rotation.z = -0.08;
  group.add(jaw);

  const hip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), silhouetteMaterial);
  hip.position.set(-0.045, 0.62, 0.018);
  hip.scale.set(0.82, 0.62, 0.54);
  group.add(hip);

  const jointedLimbs = [
    [
      [-0.1, 1.78, -0.02],
      [-0.5, 1.04, -0.1],
      [-0.66, 0.3, -0.19],
      [-0.72, 0.03, -0.28],
      0.024,
    ],
    [
      [0.11, 1.74, -0.015],
      [0.45, 1.08, -0.11],
      [0.72, 0.44, -0.2],
      [0.64, 0.09, -0.28],
      0.023,
    ],
    [
      [-0.08, 0.68, 0.015],
      [-0.22, 0.38, -0.02],
      [-0.25, 0.08, -0.08],
      [-0.18, -0.02, -0.2],
      0.034,
    ],
    [
      [0.06, 0.68, 0.012],
      [0.2, 0.42, -0.035],
      [0.17, 0.1, -0.1],
      [0.34, -0.02, -0.2],
      0.032,
    ],
  ];
  jointedLimbs.forEach(([a, b, c, d, radius]) => {
    group.add(createLimbSegment(a, b, radius, radius * 0.72, sinewMaterial));
    group.add(createLimbSegment(b, c, radius * 0.72, radius * 0.48, sinewMaterial));
    group.add(createLimbSegment(c, d, radius * 0.44, radius * 0.2, sinewMaterial));
  });

  const headTendrils = [
    [[0.04, 2.34, -0.01], [-0.18, 2.25, -0.16]],
    [[0.13, 2.36, -0.01], [0.33, 2.3, -0.13]],
    [[0.01, 2.28, 0.02], [-0.28, 2.06, 0.08]],
    [[0.16, 2.28, 0.02], [0.42, 2.08, 0.04]],
    [[0.08, 2.42, -0.02], [0.02, 2.58, -0.08]],
    [[0.1, 2.38, 0.03], [0.28, 2.54, 0.05]],
  ];
  const animatedTendrils = [];
  headTendrils.forEach(([start, end]) => {
    const tendril = createLimbSegment(start, end, 0.012, 0.004, sinewMaterial);
    animatedTendrils.push(tendril);
    group.add(tendril);
  });

  [
    [[-0.02, 1.72, 0.02], [-0.3, 1.34, 0.22]],
    [[0.06, 1.7, 0.02], [0.28, 1.28, 0.24]],
    [[-0.02, 1.34, 0.02], [-0.38, 0.86, 0.12]],
    [[0.04, 1.28, 0.02], [0.42, 0.82, 0.1]],
  ].forEach(([start, end]) => {
    group.add(createLimbSegment(start, end, 0.009, 0.003, wetEdgeMaterial));
  });

  group.userData.head = head;
  group.userData.tendrils = animatedTendrils;
  group.userData.baseScale = new THREE.Vector3(1, 1, 1);

  return group;
}


export function createBacteriaEntity(
  scene,
  {
    spawnPosition,
    isWalkable,
    speed = 1.05,
    id = "bacteria",
    initialState = null,
    cols,
    rows,
    isCellOpen,
    worldToCell,
    cellCenter,
  },
) {
  const group = createBacteriaModel();
  group.position.set(spawnPosition.x, 0, spawnPosition.z);
  group.rotation.y = Math.random() * Math.PI * 2;
  if (id === "super-bacteria") {
    group.scale.setScalar(1.14);
    group.userData.baseScale?.setScalar(1.14);
  }
  scene.add(group);

  let contact = false;
  if (initialState && Number.isFinite(initialState.position?.x) && Number.isFinite(initialState.position?.z)) {
    group.position.x = initialState.position.x;
    group.position.z = initialState.position.z;
  }
  const mover = createEntityMover({
    group,
    isWalkable,
    speed,
    contactRadius: BACTERIA_CONTACT_RADIUS,
    cols,
    rows,
    isCellOpen,
    worldToCell,
    cellCenter,
    recomputeInterval: BACTERIA_RECOMPUTE_INTERVAL,
    stuckThreshold: BACTERIA_STUCK_THRESHOLD,
    directChaseDistance: BACTERIA_DIRECT_CHASE_DISTANCE,
    turnRate: 7.2,
  });

  return {
    getState() {
      return {
        id,
        type: "bacteria",
        position: { x: group.position.x, z: group.position.z },
        contact,
      };
    },
    update(delta, elapsed, playerPosition, effects = {}) {
      const tension = id === "super-bacteria" ? 1.16 : 1;
      const moveState = mover.update(delta, elapsed, playerPosition, effects, {
        speedScale: tension * (1 + Math.sin(elapsed * 2.4) * 0.035),
      });
      contact = moveState.contact;

      const proximity = Math.max(0, 1 - moveState.distance / 9);
      const sway = Math.sin(elapsed * 2.25) * (0.045 + proximity * 0.035);
      group.position.y = Math.sin(elapsed * 3.6) * 0.018 + proximity * 0.02;
      group.rotation.z = sway;
      const baseScale = group.userData.baseScale ?? new THREE.Vector3(1, 1, 1);
      group.scale.set(
        baseScale.x * (1 + Math.sin(elapsed * 4.2) * 0.012 * proximity),
        baseScale.y * (1 + Math.sin(elapsed * 3.1) * 0.018 * proximity),
        baseScale.z,
      );
      if (group.userData.head) {
        group.userData.head.rotation.x = Math.sin(elapsed * 1.9) * 0.12;
        group.userData.head.rotation.z = 0.16 + Math.sin(elapsed * 2.7) * 0.08;
      }
      group.userData.tendrils?.forEach((tendril, index) => {
        tendril.rotation.z = Math.sin(elapsed * (2.1 + index * 0.2) + index) * 0.08;
      });

      return {
        id,
        active: true,
        contact,
        distance: moveState.distance,
        x: group.position.x,
        y: 1.72,
        z: group.position.z,
      };
    },
  };
}
