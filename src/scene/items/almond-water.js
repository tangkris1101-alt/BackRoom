import * as THREE from "three";
import {
  CELL_SIZE,
  ALMOND_WATER_RESPAWN_MIN,
  ALMOND_WATER_RESPAWN_VARIANCE,
  ALMOND_WATER_INSPECT_DISTANCE,
  ALMOND_WATER_MODEL_SCALE,
  ALMOND_WATER_PICKUP_RADIUS,
  ALMOND_WATER_STAMINA_BONUS,
  SUPER_ALMOND_WATER_MODEL_SCALE,
  circleIntersectsAabb,
} from "../constants.js";
import { createAlmondWaterLabelTexture } from "./labels.js";
import { inspectForward, inspectToItem } from "./shared.js";

export function createAlmondWaterModel(variant = "normal") {
  const isSuper = variant === "super";
  const group = new THREE.Group();
  group.name = isSuper ? "super-almond-water-model" : "almond-water-model";

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: isSuper ? 0xffe56a : 0xd9fbff,
    emissive: isSuper ? 0x9d6d08 : 0x2b6f7a,
    emissiveIntensity: isSuper ? 0.18 : 0.08,
    roughness: 0.12,
    metalness: 0,
    transmission: isSuper ? 0.12 : 0.18,
    transparent: true,
    opacity: isSuper ? 0.5 : 0.42,
    thickness: 0.22,
  });
  const liquidMaterial = new THREE.MeshStandardMaterial({
    color: isSuper ? 0xffc43f : 0xbadfd0,
    emissive: isSuper ? 0xffb423 : 0x8bbba3,
    emissiveIntensity: isSuper ? 0.32 : 0.18,
    roughness: 0.38,
    transparent: true,
    opacity: isSuper ? 0.78 : 0.72,
  });
  const labelMaterial = new THREE.MeshStandardMaterial({
    map: createAlmondWaterLabelTexture(variant),
    color: 0xffffff,
    emissive: isSuper ? 0xffcf54 : 0xd7e6bd,
    emissiveIntensity: isSuper ? 0.18 : 0.08,
    roughness: 0.62,
    side: THREE.DoubleSide,
  });
  const capMaterial = new THREE.MeshStandardMaterial({
    color: isSuper ? 0xb17508 : 0x234e70,
    emissive: isSuper ? 0x362200 : 0x07151f,
    emissiveIntensity: isSuper ? 0.28 : 0.22,
    roughness: 0.46,
    metalness: isSuper ? 0.2 : 0.12,
  });
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: isSuper ? 0x332005 : 0x1d2718,
    transparent: true,
    opacity: isSuper ? 0.26 : 0.2,
    depthWrite: false,
  });

  const glassProfile = [
    new THREE.Vector2(0.108, 0.02),
    new THREE.Vector2(0.158, 0.06),
    new THREE.Vector2(0.174, 0.15),
    new THREE.Vector2(0.174, 0.52),
    new THREE.Vector2(0.138, 0.6),
    new THREE.Vector2(0.086, 0.66),
    new THREE.Vector2(0.084, 0.78),
    new THREE.Vector2(0.102, 0.81),
  ];
  const bottle = new THREE.Mesh(new THREE.LatheGeometry(glassProfile, 32), glassMaterial);
  group.add(bottle);

  const liquidProfile = [
    new THREE.Vector2(0.098, 0.06),
    new THREE.Vector2(0.145, 0.09),
    new THREE.Vector2(0.151, 0.16),
    new THREE.Vector2(0.151, 0.48),
    new THREE.Vector2(0.116, 0.53),
    new THREE.Vector2(0.078, 0.58),
  ];
  const liquid = new THREE.Mesh(new THREE.LatheGeometry(liquidProfile, 28), liquidMaterial);
  group.add(liquid);

  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.181, 0.181, 0.255, 32, 1, true),
    labelMaterial,
  );
  label.position.y = 0.35;
  group.add(label);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.108, 0.09, 24), capMaterial);
  cap.position.y = 0.855;
  group.add(cap);

  for (let i = 0; i < 3; i += 1) {
    const groove = new THREE.Mesh(new THREE.TorusGeometry(0.106, 0.0045, 6, 24), capMaterial);
    groove.rotation.x = Math.PI / 2;
    groove.position.y = 0.824 + i * 0.027;
    group.add(groove);
  }

  const baseShadow = new THREE.Mesh(new THREE.CircleGeometry(0.33, 32), shadowMaterial);
  baseShadow.rotation.x = -Math.PI / 2;
  baseShadow.position.y = 0.012;
  group.add(baseShadow);

  group.traverse((child) => {
    if (child.isMesh) child.userData.itemId = isSuper ? "super-almond-water" : "almond-water";
  });
  return group;
}

export function createAlmondWaterPickup(
  scene,
  {
    cols,
    rows,
    isCellOpen,
    getCellCenter,
    avoidPositions = [],
    blockedAabbs = [],
    variant = "normal",
    respawnMin = ALMOND_WATER_RESPAWN_MIN,
    respawnVariance = ALMOND_WATER_RESPAWN_VARIANCE,
    initialSpawnChance = 1,
    respawnChance = 1,
  },
) {
  const isSuper = variant === "super";
  const itemId = isSuper ? "super-almond-water" : "almond-water";
  const candidates = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!isCellOpen(col, row)) continue;
      const center = getCellCenter(col, row);
      const isFarEnough = avoidPositions.every(
        (position) => Math.hypot(center.x - position.x, center.z - position.z) > CELL_SIZE * 4,
      );
      const isClearOfProps = blockedAabbs.every(
        (bounds) => !circleIntersectsAabb(center.x, center.z, ALMOND_WATER_PICKUP_RADIUS, bounds),
      );
      if (isFarEnough && isClearOfProps) candidates.push({ col, row, x: center.x, z: center.z });
    }
  }

  const group = new THREE.Group();
  group.name = isSuper ? "super-almond-water-pickup" : "almond-water-pickup";
  const bottleModel = createAlmondWaterModel(variant);
  bottleModel.scale.setScalar(isSuper ? SUPER_ALMOND_WATER_MODEL_SCALE : ALMOND_WATER_MODEL_SCALE);
  group.add(bottleModel);

  const marker = new THREE.Mesh(
    new THREE.RingGeometry(isSuper ? 0.3 : 0.26, isSuper ? 0.46 : 0.38, 32),
    new THREE.MeshBasicMaterial({
      color: isSuper ? 0xffd863 : 0xeefbd3,
      transparent: true,
      opacity: isSuper ? 0.18 : 0.13,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.02;
  group.add(marker);

  scene.add(group);

  let active = false;
  let respawnTimer = 0;
  let pickupCount = 0;

  function chooseCandidate() {
    return candidates[Math.floor(Math.random() * candidates.length)] ?? candidates[0];
  }

  function scheduleRespawn() {
    group.visible = false;
    active = false;
    respawnTimer = respawnMin + Math.random() * respawnVariance;
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

  function trySpawn(chance = 1) {
    if (Math.random() > chance) {
      scheduleRespawn();
      return;
    }
    placeAtRandomPosition();
  }

  trySpawn(initialSpawnChance);

  return {
    inspect(camera) {
      if (!active || !camera) return null;
      camera.getWorldDirection(inspectForward);
      inspectToItem.set(group.position.x, group.position.y + 0.34, group.position.z).sub(camera.position);
      const distance = inspectToItem.length();
      if (distance > ALMOND_WATER_INSPECT_DISTANCE) return null;

      inspectToItem.normalize();
      const maxAngle = Math.min(0.13, Math.max(0.048, Math.atan2(0.42, distance)));
      if (inspectForward.dot(inspectToItem) < Math.cos(maxAngle)) return null;

      return {
        id: itemId,
        name: isSuper ? "SUPER ALMOND WATER" : "ALMOND WATER",
        effect: isSuper ? "250 STAMINA CAP / RECOVERY x2" : "+50 STAMINA CAPACITY / 45s",
        action: "F / BUTTON PICK UP",
        distance,
      };
    },

    update(delta, elapsed, playerPosition) {
      if (!active) {
        respawnTimer -= delta;
        if (respawnTimer <= 0) trySpawn(respawnChance);
        return {
          visible: false,
          available: false,
          distance: Infinity,
          respawn: Math.max(0, respawnTimer),
        };
      }

      group.position.y = Math.sin(elapsed * (isSuper ? 2.8 : 2.4)) * (isSuper ? 0.045 : 0.035);
      group.rotation.y += delta * (isSuper ? 0.62 : 0.45);
      marker.material.opacity =
        (isSuper ? 0.14 : 0.1) + Math.sin(elapsed * (isSuper ? 3.8 : 3.2)) * 0.045 + 0.045;
      const distance = Math.hypot(playerPosition.x - group.position.x, playerPosition.z - group.position.z);
      return {
        visible: true,
        available: distance <= ALMOND_WATER_PICKUP_RADIUS,
        distance,
        respawn: 0,
      };
    },

    tryPickup(playerPosition) {
      if (!active) return { pickedUp: false };
      const distance = Math.hypot(playerPosition.x - group.position.x, playerPosition.z - group.position.z);
      if (distance > ALMOND_WATER_PICKUP_RADIUS) return { pickedUp: false };
      pickupCount += 1;
      active = false;
      group.visible = false;
      respawnTimer = respawnMin + Math.random() * respawnVariance;
      return {
        pickedUp: true,
        itemId,
        count: pickupCount,
        staminaBonus: isSuper ? undefined : ALMOND_WATER_STAMINA_BONUS,
      };
    },
  };
}

