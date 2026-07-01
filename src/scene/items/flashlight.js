import * as THREE from "three";
import {
  CELL_SIZE,
  FLASHLIGHT_PICKUP_RADIUS,
  FLASHLIGHT_INSPECT_DISTANCE,
  FLASHLIGHT_RESPAWN_MIN,
  FLASHLIGHT_RESPAWN_VARIANCE,
} from "../constants.js";
import { circleIntersectsAabb } from "../constants.js";
import { inspectForward, inspectToItem } from "./shared.js";

export function createFlashlightModel() {
  const group = new THREE.Group();
  group.name = "flashlight-model";

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f2423,
    emissive: 0x060807,
    emissiveIntensity: 0.12,
    roughness: 0.46,
    metalness: 0.42,
  });
  const gripMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b0e0d,
    roughness: 0.78,
    metalness: 0.2,
  });
  const lensMaterial = new THREE.MeshStandardMaterial({
    color: 0xf8ffd7,
    emissive: 0xece7a6,
    emissiveIntensity: 0.34,
    roughness: 0.2,
    metalness: 0.02,
  });
  const buttonMaterial = new THREE.MeshStandardMaterial({
    color: 0x20272a,
    emissive: 0x071016,
    emissiveIntensity: 0.08,
    roughness: 0.56,
    metalness: 0.18,
  });
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x060807,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.105, 0.62, 20), bodyMaterial);
  body.rotation.z = Math.PI / 2;
  body.position.set(0, 0.13, 0);
  group.add(body);

  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.112, 0.18, 20), bodyMaterial);
  head.rotation.z = Math.PI / 2;
  head.position.set(0.39, 0.13, 0);
  group.add(head);

  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.018, 20), lensMaterial);
  lens.rotation.z = Math.PI / 2;
  lens.position.set(0.49, 0.13, 0);
  group.add(lens);

  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.096, 0.088, 0.09, 18), gripMaterial);
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-0.36, 0.13, 0);
  group.add(tail);

  for (let i = 0; i < 5; i += 1) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.104, 0.0045, 6, 20), gripMaterial);
    rib.rotation.y = Math.PI / 2;
    rib.position.set(-0.22 + i * 0.074, 0.13, 0);
    group.add(rib);
  }

  const button = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.026, 0.06), buttonMaterial);
  button.position.set(0.07, 0.235, 0);
  group.add(button);

  const baseShadow = new THREE.Mesh(new THREE.CircleGeometry(0.54, 28), shadowMaterial);
  baseShadow.rotation.x = -Math.PI / 2;
  baseShadow.scale.z = 0.42;
  baseShadow.position.y = 0.011;
  group.add(baseShadow);

  group.traverse((child) => {
    if (child.isMesh) child.userData.itemId = "flashlight";
  });
  return group;
}

export function createFlashlightPickup(
  scene,
  { cols, rows, isCellOpen, getCellCenter, avoidPositions = [], blockedAabbs = [] },
) {
  const candidates = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!isCellOpen(col, row)) continue;
      const center = getCellCenter(col, row);
      const isFarEnough = avoidPositions.every(
        (position) => Math.hypot(center.x - position.x, center.z - position.z) > CELL_SIZE * 4.2,
      );
      const isClearOfProps = blockedAabbs.every(
        (bounds) => !circleIntersectsAabb(center.x, center.z, FLASHLIGHT_PICKUP_RADIUS, bounds),
      );
      if (isFarEnough && isClearOfProps) candidates.push({ col, row, x: center.x, z: center.z });
    }
  }

  const group = new THREE.Group();
  group.name = "flashlight-pickup";
  group.add(createFlashlightModel());

  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.58, 32),
    new THREE.MeshBasicMaterial({
      color: 0xb7e4ff,
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
      inspectToItem.set(group.position.x, group.position.y + 0.2, group.position.z).sub(camera.position);
      const distance = inspectToItem.length();
      if (distance > FLASHLIGHT_INSPECT_DISTANCE) return null;

      inspectToItem.normalize();
      const maxAngle = Math.min(0.15, Math.max(0.055, Math.atan2(0.5, distance)));
      if (inspectForward.dot(inspectToItem) < Math.cos(maxAngle)) return null;

      return {
        id: "flashlight",
        name: "FLASHLIGHT",
        effect: "FORWARD BEAM / LIMITED BATTERY",
        action: "F / BUTTON PICK UP",
        distance,
      };
    },

    update(delta, elapsed, playerPosition) {
      if (!active) {
        respawnTimer -= delta;
        if (respawnTimer <= 0) placeAtRandomPosition();
        return {
          visible: false,
          available: false,
          distance: Infinity,
          respawn: Math.max(0, respawnTimer),
        };
      }

      group.position.y = Math.sin(elapsed * 1.9 + 1.6) * 0.018;
      marker.material.opacity = 0.08 + Math.sin(elapsed * 2.8) * 0.034 + 0.034;
      const distance = Math.hypot(playerPosition.x - group.position.x, playerPosition.z - group.position.z);
      return {
        visible: true,
        available: distance <= FLASHLIGHT_PICKUP_RADIUS,
        distance,
        respawn: 0,
      };
    },

    tryPickup(playerPosition) {
      if (!active) return { pickedUp: false };
      const distance = Math.hypot(playerPosition.x - group.position.x, playerPosition.z - group.position.z);
      if (distance > FLASHLIGHT_PICKUP_RADIUS) return { pickedUp: false };
      pickupCount += 1;
      active = false;
      group.visible = false;
      respawnTimer = FLASHLIGHT_RESPAWN_MIN + Math.random() * FLASHLIGHT_RESPAWN_VARIANCE;
      return {
        pickedUp: true,
        itemId: "flashlight",
        count: pickupCount,
      };
    },
  };
}