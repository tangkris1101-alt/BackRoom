import * as THREE from "three";
import {
  CELL_SIZE,
  COMPASS_PICKUP_RADIUS,
  COMPASS_INSPECT_DISTANCE,
  COMPASS_RESPAWN_MIN,
  COMPASS_RESPAWN_VARIANCE,
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

export function createCompassModel() {
  const group = new THREE.Group();
  group.name = "exit-compass-model";

  const brassMaterial = new THREE.MeshStandardMaterial({
    color: 0xb28643,
    emissive: 0x2a1706,
    emissiveIntensity: 0.18,
    roughness: 0.42,
    metalness: 0.56,
  });
  const faceMaterial = new THREE.MeshStandardMaterial({
    color: 0xe8dfb8,
    emissive: 0x51451f,
    emissiveIntensity: 0.18,
    roughness: 0.66,
  });
  const needleMaterial = new THREE.MeshBasicMaterial({ color: 0xff4c34 });
  const backNeedleMaterial = new THREE.MeshBasicMaterial({ color: 0x232019 });
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd9f6ff,
    transparent: true,
    opacity: 0.22,
    roughness: 0.04,
    metalness: 0,
    transmission: 0.2,
    thickness: 0.04,
  });
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x080604,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.07, 40), brassMaterial);
  base.position.y = 0.075;
  group.add(base);

  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.016, 40), faceMaterial);
  face.position.y = 0.124;
  group.add(face);

  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.012, 40), glassMaterial);
  glass.position.y = 0.146;
  group.add(glass);

  const needle = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.23, 4), needleMaterial);
  needle.position.set(0, 0.164, -0.048);
  needle.rotation.x = Math.PI / 2;
  group.add(needle);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.18, 4), backNeedleMaterial);
  tail.position.set(0, 0.162, 0.054);
  tail.rotation.x = -Math.PI / 2;
  group.add(tail);

  for (let i = 0; i < 8; i += 1) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.01, i % 2 === 0 ? 0.055 : 0.034), backNeedleMaterial);
    const angle = (i / 8) * Math.PI * 2;
    tick.position.set(Math.sin(angle) * 0.165, 0.158, Math.cos(angle) * 0.165);
    tick.rotation.y = angle;
    group.add(tick);
  }

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.282, 0.018, 8, 36), brassMaterial);
  ring.position.y = 0.12;
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.018, 36), brassMaterial);
  lid.position.set(0, 0.24, 0.26);
  lid.rotation.x = -Math.PI * 0.64;
  group.add(lid);

  const baseShadow = new THREE.Mesh(new THREE.CircleGeometry(0.38, 28), shadowMaterial);
  baseShadow.rotation.x = -Math.PI / 2;
  baseShadow.scale.z = 0.7;
  baseShadow.position.y = 0.012;
  group.add(baseShadow);

  markItemMeshes(group, "compass");
  return group;
}

export function createCompassPickup(
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
        (position) => Math.hypot(center.x - position.x, center.z - position.z) > CELL_SIZE * 3.8,
      );
      const isClearOfProps = blockedAabbs.every(
        (bounds) => !circleIntersectsAabb(center.x, center.z, COMPASS_PICKUP_RADIUS, bounds),
      );
      if (isFarEnough && isClearOfProps) candidates.push({ col, row, x: center.x, z: center.z });
    }
  }

  const group = new THREE.Group();
  group.name = "exit-compass-pickup";
  const model = createCompassModel();
  group.add(model);
  const highlight = createItemHighlight({
    color: 0xffd97b,
    width: 0.66,
    height: 0.52,
    depth: 0.78,
    y: 0.24,
  });
  group.add(highlight);
  scene.add(group);

  let active = false;
  let respawnTimer = 0;
  let pickupCount = 0;

  function randomizePose() {
    model.rotation.x = (Math.random() - 0.5) * 0.18;
    model.rotation.z = (Math.random() - 0.5) * 0.18;
  }

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
    randomizePose();
    group.visible = true;
    active = true;
  }

  function getPickupState(playerPosition) {
    return createPickupState({
      id: "compass",
      active,
      group,
      playerPosition,
      pickupRadius: COMPASS_PICKUP_RADIUS,
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
    placeAtRandomPosition();
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
      inspectToItem.set(group.position.x, group.position.y + 0.25, group.position.z).sub(camera.position);
      const distance = inspectToItem.length();
      if (distance > COMPASS_INSPECT_DISTANCE) return null;

      inspectToItem.normalize();
      const maxAngle = Math.min(0.16, Math.max(0.06, Math.atan2(0.48, distance)));
      if (inspectForward.dot(inspectToItem) < Math.cos(maxAngle)) return null;
      setItemHighlight(highlight, true);

      return {
        id: "compass",
        name: "EXIT COMPASS",
        effect: "POINTS TOWARD THE EXIT",
        action: "F / BUTTON PICK UP",
        distance,
      };
    },
    update(delta, elapsed, playerPosition) {
      setItemHighlight(highlight, false);
      if (!active) {
        respawnTimer -= delta;
        if (respawnTimer <= 0) placeAtRandomPosition();
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
      respawnTimer = COMPASS_RESPAWN_MIN + Math.random() * COMPASS_RESPAWN_VARIANCE;
      return {
        pickedUp: true,
        itemId: "compass",
        count: pickupCount,
      };
    },
  };
}
