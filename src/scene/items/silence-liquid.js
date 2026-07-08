import * as THREE from "three";
import {
  CELL_SIZE,
  SILENCE_LIQUID_INSPECT_DISTANCE,
  SILENCE_LIQUID_INITIAL_SPAWN_CHANCE,
  SILENCE_LIQUID_MODEL_SCALE,
  SILENCE_LIQUID_PICKUP_RADIUS,
  SILENCE_LIQUID_RESPAWN_CHANCE,
  SILENCE_LIQUID_RESPAWN_MIN,
  SILENCE_LIQUID_RESPAWN_VARIANCE,
  circleIntersectsAabb,
} from "../constants.js";
import {
  createItemHighlight,
  createPickupState,
  inspectForward,
  inspectToItem,
  markItemMeshes,
  setItemHighlight,
} from "./shared.js";

export function createSilenceLiquidModel() {
  const group = new THREE.Group();
  group.name = "silence-liquid-model";

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xbfd7ff,
    emissive: 0x2e236c,
    emissiveIntensity: 0.08,
    roughness: 0.16,
    transmission: 0.18,
    transparent: true,
    opacity: 0.46,
    thickness: 0.18,
  });
  const liquidMaterial = new THREE.MeshStandardMaterial({
    color: 0x5c4cff,
    emissive: 0x2b1b92,
    emissiveIntensity: 0.38,
    roughness: 0.34,
    transparent: true,
    opacity: 0.78,
  });
  const capMaterial = new THREE.MeshStandardMaterial({
    color: 0x151426,
    emissive: 0x080618,
    emissiveIntensity: 0.18,
    roughness: 0.58,
    metalness: 0.18,
  });
  const labelMaterial = new THREE.MeshStandardMaterial({
    color: 0x221a54,
    emissive: 0x10102d,
    emissiveIntensity: 0.16,
    roughness: 0.72,
    side: THREE.DoubleSide,
  });
  const inkMaterial = new THREE.MeshBasicMaterial({
    color: 0xded7ff,
    transparent: true,
    opacity: 0.86,
    side: THREE.DoubleSide,
  });
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x080514,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });

  const bottleProfile = [
    new THREE.Vector2(0.074, 0.02),
    new THREE.Vector2(0.132, 0.06),
    new THREE.Vector2(0.146, 0.18),
    new THREE.Vector2(0.126, 0.54),
    new THREE.Vector2(0.068, 0.62),
    new THREE.Vector2(0.056, 0.78),
    new THREE.Vector2(0.072, 0.84),
  ];
  const bottle = new THREE.Mesh(new THREE.LatheGeometry(bottleProfile, 28), glassMaterial);
  group.add(bottle);

  const liquidProfile = [
    new THREE.Vector2(0.066, 0.06),
    new THREE.Vector2(0.114, 0.1),
    new THREE.Vector2(0.12, 0.18),
    new THREE.Vector2(0.106, 0.45),
    new THREE.Vector2(0.062, 0.52),
  ];
  const liquid = new THREE.Mesh(new THREE.LatheGeometry(liquidProfile, 24), liquidMaterial);
  group.add(liquid);

  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.151, 0.151, 0.19, 28, 1, true), labelMaterial);
  label.position.y = 0.32;
  group.add(label);

  const labelMark = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), inkMaterial);
  labelMark.position.set(0, 0.33, -0.153);
  labelMark.rotation.y = Math.PI;
  group.add(labelMark);

  const slash = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.012, 0.003), inkMaterial);
  slash.position.set(0, 0.33, -0.156);
  slash.rotation.z = -0.7;
  group.add(slash);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.078, 0.092, 20), capMaterial);
  cap.position.y = 0.89;
  group.add(cap);

  const baseShadow = new THREE.Mesh(new THREE.CircleGeometry(0.25, 28), shadowMaterial);
  baseShadow.rotation.x = -Math.PI / 2;
  baseShadow.position.y = 0.01;
  group.add(baseShadow);

  markItemMeshes(group, "silence-liquid");
  return group;
}

export function createSilenceLiquidPickup(
  scene,
  {
    cols,
    rows,
    isCellOpen,
    getCellCenter,
    avoidPositions = [],
    blockedAabbs = [],
    initialState = null,
  },
) {
  const candidates = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!isCellOpen(col, row)) continue;
      const center = getCellCenter(col, row);
      const isFarEnough = avoidPositions.every(
        (position) => Math.hypot(center.x - position.x, center.z - position.z) > CELL_SIZE * 4,
      );
      const isClearOfProps = blockedAabbs.every(
        (bounds) => !circleIntersectsAabb(center.x, center.z, SILENCE_LIQUID_PICKUP_RADIUS, bounds),
      );
      if (isFarEnough && isClearOfProps) candidates.push({ col, row, x: center.x, z: center.z });
    }
  }

  const group = new THREE.Group();
  group.name = "silence-liquid-pickup";
  const model = createSilenceLiquidModel();
  model.scale.setScalar(SILENCE_LIQUID_MODEL_SCALE);
  group.add(model);
  const highlight = createItemHighlight({
    color: 0xb9b0ff,
    width: 0.34,
    height: 0.64,
    depth: 0.34,
    y: 0.3,
  });
  group.add(highlight);
  scene.add(group);

  let active = false;
  let respawnTimer = 0;
  let pickupCount = 0;

  function chooseCandidate() {
    return candidates[Math.floor(Math.random() * candidates.length)] ?? candidates[0];
  }

  function randomizePose() {
    model.rotation.x = (Math.random() - 0.5) * 0.36;
    model.rotation.z = (Math.random() - 0.5) * 0.42;
  }

  function scheduleRespawn() {
    group.visible = false;
    active = false;
    respawnTimer = SILENCE_LIQUID_RESPAWN_MIN + Math.random() * SILENCE_LIQUID_RESPAWN_VARIANCE;
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
    randomizePose();
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

  function getPickupState(playerPosition) {
    return createPickupState({
      id: "silence-liquid",
      active,
      group,
      playerPosition,
      pickupRadius: SILENCE_LIQUID_PICKUP_RADIUS,
      respawnTimer,
    });
  }

  if (initialState && Number.isFinite(initialState.position?.x) && Number.isFinite(initialState.position?.z)) {
    active = Boolean(initialState.active);
    respawnTimer = Math.max(0, Number(initialState.respawnTimer ?? 0));
    group.position.set(initialState.position.x, 0, initialState.position.z);
    group.rotation.y = Number.isFinite(initialState.rotation) ? initialState.rotation : 0;
    randomizePose();
    group.visible = active;
  } else {
    trySpawn(SILENCE_LIQUID_INITIAL_SPAWN_CHANCE);
  }

  return {
    getState() {
      return {
        active,
        respawnTimer,
        position: { x: group.position.x, y: 0, z: group.position.z },
        rotation: group.rotation.y,
      };
    },
    getPickupState,
    inspect(camera) {
      if (!active || !camera) return null;
      camera.getWorldDirection(inspectForward);
      inspectToItem.set(group.position.x, group.position.y + 0.34, group.position.z).sub(camera.position);
      const distance = inspectToItem.length();
      if (distance > SILENCE_LIQUID_INSPECT_DISTANCE) return null;

      inspectToItem.normalize();
      const maxAngle = Math.min(0.13, Math.max(0.05, Math.atan2(0.36, distance)));
      if (inspectForward.dot(inspectToItem) < Math.cos(maxAngle)) return null;
      setItemHighlight(highlight, true);

      return {
        id: "silence-liquid",
        name: "SILENCE LIQUID",
        effect: "REPEL ENTITIES / 12s",
        action: "F / BUTTON PICK UP",
        distance,
      };
    },
    update(delta, elapsed, playerPosition) {
      setItemHighlight(highlight, false);
      if (!active) {
        respawnTimer -= delta;
        if (respawnTimer <= 0) trySpawn(SILENCE_LIQUID_RESPAWN_CHANCE);
        return getPickupState(playerPosition);
      }
      group.position.y = 0;
      return getPickupState(playerPosition);
    },
    tryPickup(playerPosition) {
      const state = getPickupState(playerPosition);
      if (!state.available) return { pickedUp: false };
      pickupCount += 1;
      active = false;
      group.visible = false;
      setItemHighlight(highlight, false);
      respawnTimer = SILENCE_LIQUID_RESPAWN_MIN + Math.random() * SILENCE_LIQUID_RESPAWN_VARIANCE;
      return {
        pickedUp: true,
        itemId: "silence-liquid",
        count: pickupCount,
      };
    },
  };
}
