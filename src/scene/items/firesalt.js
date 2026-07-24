import * as THREE from "three";
import {
  CELL_SIZE,
  FIRESALT_EFFECT_RADIUS,
  FIRESALT_INSPECT_DISTANCE,
  FIRESALT_PICKUP_RADIUS,
  FIRESALT_RESPAWN_MIN,
  FIRESALT_RESPAWN_VARIANCE,
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

export function createFiresaltModel() {
  const group = new THREE.Group();
  group.name = "firesalt-model";
  const crystalMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xff6a18,
    emissive: 0xff2300,
    emissiveIntensity: 0.62,
    roughness: 0.24,
    transmission: 0.12,
    transparent: true,
    opacity: 0.88,
    thickness: 0.2,
  });
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: 0x6f1608,
    emissive: 0xff2c05,
    emissiveIntensity: 0.82,
    roughness: 0.48,
  });
  const shards = [
    { p: [0, 0.19, 0], s: [0.15, 0.42, 0.14], r: [0.08, 0.1, -0.12] },
    { p: [-0.16, 0.12, 0.03], s: [0.12, 0.3, 0.1], r: [-0.18, 0.4, 0.4] },
    { p: [0.15, 0.1, 0.05], s: [0.11, 0.27, 0.12], r: [0.28, -0.3, -0.34] },
    { p: [0.04, 0.08, -0.14], s: [0.09, 0.22, 0.1], r: [-0.35, 0.2, 0.18] },
  ];
  for (const shard of shards) {
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(1, 1), crystalMaterial);
    mesh.position.fromArray(shard.p);
    mesh.scale.fromArray(shard.s);
    mesh.rotation.set(...shard.r);
    group.add(mesh);
  }
  const core = new THREE.Mesh(new THREE.DodecahedronGeometry(0.19, 0), coreMaterial);
  core.position.y = 0.08;
  core.scale.y = 0.55;
  group.add(core);
  markItemMeshes(group, "firesalt");
  return group;
}

export function createFiresaltPickup(scene, {
  cols,
  rows,
  isCellOpen,
  getCellCenter,
  avoidPositions = [],
  blockedAabbs = [],
  initialState = null,
  initialSpawnChance = 0.55,
} = {}) {
  const candidates = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!isCellOpen(col, row)) continue;
      const center = getCellCenter(col, row);
      if (!avoidPositions.every((p) => Math.hypot(center.x - p.x, center.z - p.z) > CELL_SIZE * 4)) continue;
      if (!blockedAabbs.every((b) => !circleIntersectsAabb(center.x, center.z, FIRESALT_PICKUP_RADIUS, b))) continue;
      candidates.push(center);
    }
  }
  const group = new THREE.Group();
  group.name = "firesalt-pickup";
  const model = createFiresaltModel();
  group.add(model);
  const highlight = createItemHighlight({ color: 0xff8b45, width: 0.55, height: 0.58, depth: 0.55, y: 0.24 });
  group.add(highlight);
  scene.add(group);
  let active = false;
  let respawnTimer = 0;
  let pickupCount = 0;

  function place() {
    const candidate = candidates[Math.floor(Math.random() * candidates.length)];
    if (!candidate) return;
    group.position.set(candidate.x, 0.03, candidate.z);
    group.rotation.set((Math.random() - 0.5) * 0.25, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.3);
    active = true;
    group.visible = true;
  }
  function schedule() {
    active = false;
    group.visible = false;
    respawnTimer = FIRESALT_RESPAWN_MIN + Math.random() * FIRESALT_RESPAWN_VARIANCE;
  }
  function state(playerPosition) {
    return createPickupState({ id: "firesalt", active, group, playerPosition, pickupRadius: FIRESALT_PICKUP_RADIUS, respawnTimer });
  }
  if (initialState && Number.isFinite(initialState.position?.x) && Number.isFinite(initialState.position?.z)) {
    active = Boolean(initialState.active);
    respawnTimer = Math.max(0, initialState.respawnTimer ?? 0);
    group.position.set(initialState.position.x, 0.03, initialState.position.z);
    group.rotation.y = initialState.rotation ?? 0;
    group.visible = active;
  } else if (Math.random() <= initialSpawnChance) {
    place();
  } else {
    schedule();
  }
  return {
    getState: () => ({ active, respawnTimer, position: { x: group.position.x, y: 0, z: group.position.z }, rotation: group.rotation.y }),
    getPickupState: state,
    inspect(camera) {
      if (!active || !camera) return null;
      camera.getWorldDirection(inspectForward);
      inspectToItem.set(group.position.x, group.position.y + 0.25, group.position.z).sub(camera.position);
      const distance = inspectToItem.length();
      if (distance > FIRESALT_INSPECT_DISTANCE) return null;
      inspectToItem.normalize();
      if (inspectForward.dot(inspectToItem) < Math.cos(Math.min(0.16, Math.max(0.055, Math.atan2(0.42, distance))))) return null;
      setItemHighlight(highlight, true);
      return { id: "firesalt", name: "FIRESALT", effect: "THROW / DISORIENT ENTITIES", action: "F / BUTTON PICK UP", distance };
    },
    update(delta, elapsed, playerPosition) {
      setItemHighlight(highlight, false);
      if (!active) {
        respawnTimer -= delta;
        if (respawnTimer <= 0) {
          if (Math.random() <= 0.67) place(); else schedule();
        }
      } else {
        model.rotation.y = elapsed * 0.16;
      }
      return state(playerPosition);
    },
    tryPickup(playerPosition) {
      if (!state(playerPosition).available) return { pickedUp: false };
      pickupCount += 1;
      schedule();
      return { pickedUp: true, itemId: "firesalt", count: pickupCount };
    },
  };
}

export function createFiresaltEffectManager(scene, isWalkable = null) {
  const projectiles = [];
  let burstTimer = 0;
  const burstPosition = new THREE.Vector3();
  const geometry = new THREE.OctahedronGeometry(0.13, 0);
  const material = new THREE.MeshStandardMaterial({ color: 0xff6a18, emissive: 0xff2400, emissiveIntensity: 1.8 });
  const flash = new THREE.PointLight(0xff541f, 0, 18, 2);
  scene.add(flash);

  function burst(projectile) {
    burstPosition.copy(projectile.mesh.position);
    burstPosition.y = 0;
    burstTimer = 0.42;
    flash.position.copy(projectile.mesh.position);
    flash.intensity = 7.5;
    scene.remove(projectile.mesh);
  }
  return {
    throw(camera) {
      const mesh = new THREE.Mesh(geometry, material);
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      mesh.position.copy(camera.position).addScaledVector(direction, 0.65);
      scene.add(mesh);
      projectiles.push({ mesh, velocity: direction.multiplyScalar(12).add(new THREE.Vector3(0, 2.1, 0)), age: 0 });
    },
    update(delta) {
      for (let index = projectiles.length - 1; index >= 0; index -= 1) {
        const projectile = projectiles[index];
        projectile.age += delta;
        projectile.velocity.y -= 9.2 * delta;
        projectile.mesh.position.addScaledVector(projectile.velocity, delta);
        projectile.mesh.rotation.x += delta * 8;
        projectile.mesh.rotation.z += delta * 6;
        const hitWall = typeof isWalkable === "function" && !isWalkable(projectile.mesh.position.x, projectile.mesh.position.z, 0.08);
        if (projectile.mesh.position.y <= 0.08 || hitWall || projectile.age > 2.4) {
          burst(projectile);
          projectiles.splice(index, 1);
        }
      }
      if (burstTimer > 0) {
        burstTimer = Math.max(0, burstTimer - delta);
        flash.intensity = 7.5 * (burstTimer / 0.42);
      } else {
        flash.intensity = 0;
      }
      return {
        active: burstTimer > 0,
        position: burstPosition,
        radius: FIRESALT_EFFECT_RADIUS,
      };
    },
  };
}
