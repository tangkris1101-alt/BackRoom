import * as THREE from "three";
import {
  CELL_SIZE,
  DETECTOR_PICKUP_RADIUS,
  DETECTOR_INSPECT_DISTANCE,
  DETECTOR_RESPAWN_MIN,
  DETECTOR_RESPAWN_VARIANCE,
  circleIntersectsAabb,
} from "../constants.js";
import { inspectForward, inspectToItem } from "./shared.js";

export function createDetectorModel() {
  const group = new THREE.Group();
  group.name = "entity-detector-model";

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2621,
    emissive: 0x120806,
    emissiveIntensity: 0.12,
    roughness: 0.64,
    metalness: 0.28,
  });
  const screenMaterial = new THREE.MeshStandardMaterial({
    color: 0x111b18,
    emissive: 0xff654d,
    emissiveIntensity: 0.28,
    roughness: 0.38,
    metalness: 0.08,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0xb85638,
    emissive: 0x461006,
    emissiveIntensity: 0.26,
    roughness: 0.5,
    metalness: 0.16,
  });
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x090504,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.28), bodyMaterial);
  body.position.y = 0.17;
  group.add(body);

  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.022, 0.16), screenMaterial);
  screen.position.set(0.02, 0.286, 0);
  group.add(screen);

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8), accentMaterial);
  antenna.position.set(-0.16, 0.46, -0.02);
  antenna.rotation.z = -0.32;
  group.add(antenna);

  const dish = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.009, 6, 24), accentMaterial);
  dish.position.set(-0.22, 0.66, -0.03);
  dish.rotation.x = Math.PI / 2;
  group.add(dish);

  for (let i = 0; i < 3; i += 1) {
    const blip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, 0.035), accentMaterial);
    blip.position.set(-0.05 + i * 0.055, 0.304, -0.055 + i * 0.018);
    group.add(blip);
  }

  const baseShadow = new THREE.Mesh(new THREE.CircleGeometry(0.38, 28), shadowMaterial);
  baseShadow.rotation.x = -Math.PI / 2;
  baseShadow.scale.z = 0.55;
  baseShadow.position.y = 0.011;
  group.add(baseShadow);

  group.traverse((child) => {
    if (child.isMesh) child.userData.itemId = "detector";
  });
  return group;
}

export function createDetectorPickup(
  scene,
  { cols, rows, isCellOpen, getCellCenter, avoidPositions = [], blockedAabbs = [] },
) {
  const candidates = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!isCellOpen(col, row)) continue;
      const center = getCellCenter(col, row);
      const isFarEnough = avoidPositions.every(
        (position) => Math.hypot(center.x - position.x, center.z - position.z) > CELL_SIZE * 4.5,
      );
      const isClearOfProps = blockedAabbs.every(
        (bounds) => !circleIntersectsAabb(center.x, center.z, DETECTOR_PICKUP_RADIUS, bounds),
      );
      if (isFarEnough && isClearOfProps) candidates.push({ col, row, x: center.x, z: center.z });
    }
  }

  const group = new THREE.Group();
  group.name = "entity-detector-pickup";
  group.add(createDetectorModel());

  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.38, 0.52, 32),
    new THREE.MeshBasicMaterial({
      color: 0xff8b68,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.018;
  group.add(marker);
  scene.add(group);

  let active = false;
  let respawnTimer = 0;
  let pickupCount = 0;

  function chooseCandidate() {
    return candidates[Math.floor(Math.random() * candidates.length)] ?? candidates[0];
  }

  function placeAtRandomPosition() {
    const candidate = chooseCandidate();
    if (!candidate) {
      group.visible = false;
      active = false;
      return;
    }
    group.position.set(candidate.x, 0, candidate.z);
    group.rotation.y = Math.random() * Math.PI * 2;
    group.visible = true;
    active = true;
  }

  placeAtRandomPosition();

  return {
    inspect(camera) {
      if (!active || !camera) return null;
      camera.getWorldDirection(inspectForward);
      inspectToItem.set(group.position.x, group.position.y + 0.26, group.position.z).sub(camera.position);
      const distance = inspectToItem.length();
      if (distance > DETECTOR_INSPECT_DISTANCE) return null;

      inspectToItem.normalize();
      const maxAngle = Math.min(0.15, Math.max(0.055, Math.atan2(0.5, distance)));
      if (inspectForward.dot(inspectToItem) < Math.cos(maxAngle)) return null;

      return {
        id: "detector",
        name: "ENTITY DETECTOR",
        effect: "WIDE ENTITY PING / 5s SCAN",
        action: "F / BUTTON PICK UP",
        distance,
      };
    },

    update(delta, elapsed, playerPosition) {
      if (!active) {
        respawnTimer -= delta;
        if (respawnTimer <= 0) placeAtRandomPosition();
        return {
          id: "detector",
          visible: false,
          available: false,
          distance: Infinity,
          respawn: Math.max(0, respawnTimer),
        };
      }

      group.position.y = Math.sin(elapsed * 2.1 + 0.8) * 0.018;
      marker.material.opacity = 0.08 + Math.sin(elapsed * 3.4) * 0.038 + 0.04;
      const distance = Math.hypot(playerPosition.x - group.position.x, playerPosition.z - group.position.z);
      return {
        id: "detector",
        visible: true,
        available: distance <= DETECTOR_PICKUP_RADIUS,
        distance,
        respawn: 0,
      };
    },

    tryPickup(playerPosition) {
      if (!active) return { pickedUp: false };
      const distance = Math.hypot(playerPosition.x - group.position.x, playerPosition.z - group.position.z);
      if (distance > DETECTOR_PICKUP_RADIUS) return { pickedUp: false };
      pickupCount += 1;
      active = false;
      group.visible = false;
      respawnTimer = DETECTOR_RESPAWN_MIN + Math.random() * DETECTOR_RESPAWN_VARIANCE;
      return {
        pickedUp: true,
        itemId: "detector",
        count: pickupCount,
      };
    },
  };
}

