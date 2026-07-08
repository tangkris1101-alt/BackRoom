import * as THREE from "three";
import { ENTITY_SPEED_MULTIPLIER, HOUND_CONTACT_RADIUS } from "../constants.js";
import { createLimbSegment } from "../common/view-model.js";
import { resolveEntityStep } from "./spawn.js";
import { createNavGrid, aStar, followPath, pathContainsCell } from "./pathfinding.js";

const RECOMPUTE_INTERVAL = 0.6;
const STUCK_THRESHOLD = 0.8;
const STUCK_MIN_PROGRESS = 0.25;

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

  let contact = false;
  if (initialState && Number.isFinite(initialState.position?.x) && Number.isFinite(initialState.position?.z)) {
    group.position.x = initialState.position.x;
    group.position.z = initialState.position.z;
  }
  const navGrid =
    cols && rows && isCellOpen && worldToCell && cellCenter
      ? createNavGrid({ cols, rows, isCellOpen })
      : null;
  const path = { waypoints: [], index: 0 };
  let recomputeTimer = 0;
  let stuckTimer = 0;
  let lastPlayerCellKey = "";
  let lastPositionX = group.position.x;
  let lastPositionZ = group.position.z;
  const movementSpeed = speed * ENTITY_SPEED_MULTIPLIER;

  function repathTo(playerPosition) {
    if (!navGrid) return;
    const start = worldToCell(group.position.x, group.position.z);
    const goal = worldToCell(playerPosition.x, playerPosition.z);
    const next = aStar(navGrid, start, goal);
    if (next && next.length > 0) {
      path.waypoints = next;
      path.index = 0;
    } else {
      path.waypoints = [];
      path.index = 0;
    }
    recomputeTimer = RECOMPUTE_INTERVAL;
  }

  return {
    getState() {
      return {
        id,
        type: "hound",
        position: { x: group.position.x, z: group.position.z },
        contact,
      };
    },
    update(delta, elapsed, playerPosition, effects = {}) {
      const dx = playerPosition.x - group.position.x;
      const dz = playerPosition.z - group.position.z;
      const distance = Math.hypot(dx, dz);
      const repelRadius = Number.isFinite(effects.repelRadius) ? effects.repelRadius : 0;
      const repelActive = Boolean(effects.entityRepelActive && distance <= repelRadius);

      if (repelActive) {
        contact = false;
        path.waypoints = [];
        path.index = 0;
        recomputeTimer = RECOMPUTE_INTERVAL;
        stuckTimer = 0;
      }

      if (!contact && !repelActive && navGrid) {
        const playerCell = worldToCell(playerPosition.x, playerPosition.z);
        const playerCellKey = `${playerCell.col},${playerCell.row}`;
        const playerMoved = playerCellKey !== lastPlayerCellKey;
        const playerOffPath = !pathContainsCell(path.waypoints, playerCell, path.index);
        const stuck = stuckTimer > STUCK_THRESHOLD;
        const needRepath =
          path.waypoints.length === 0 ||
          recomputeTimer <= 0 ||
          (playerMoved && playerOffPath) ||
          stuck;
        if (needRepath) {
          repathTo(playerPosition);
          lastPlayerCellKey = playerCellKey;
        }
      }

      let nextX = group.position.x;
      let nextZ = group.position.z;
      let advanced = false;
      let reachedEnd = false;

      if (!contact && repelActive && distance > 0.001) {
        const repelMultiplier = Number.isFinite(effects.repelSpeedMultiplier)
          ? Math.max(0.2, effects.repelSpeedMultiplier)
          : 1.4;
        const surge = 0.82 + Math.sin(elapsed * 1.9) * 0.12;
        const step = movementSpeed * repelMultiplier * surge * delta;
        const resolved = resolveEntityStep(
          group.position,
          (-dx / distance) * step,
          (-dz / distance) * step,
          isWalkable,
        );
        nextX = resolved.x;
        nextZ = resolved.z;
        advanced = nextX !== group.position.x || nextZ !== group.position.z;
      } else if (!contact && path.waypoints.length > 0) {
        const followed = followPath({
          entityPos: group.position,
          waypoints: path.waypoints,
          indexRef: path,
          cellCenter,
          speed: movementSpeed,
          delta,
          isWalkable,
        });
        nextX = followed.x;
        nextZ = followed.z;
        advanced = followed.advanced;
        reachedEnd = followed.reachedEnd;
        if (reachedEnd && distance > 0.001) {
          const surge = 0.78 + Math.sin(elapsed * 1.9) * 0.12;
          const step = Math.min(distance, movementSpeed * surge * delta);
          const resolved = resolveEntityStep(
            group.position,
            (dx / distance) * step,
            (dz / distance) * step,
            isWalkable,
          );
          nextX = resolved.x;
          nextZ = resolved.z;
          advanced = nextX !== group.position.x || nextZ !== group.position.z;
        }
      } else if (distance > 0.001 && !contact) {
        const surge = 0.78 + Math.sin(elapsed * 1.9) * 0.12;
        const step = Math.min(distance, movementSpeed * surge * delta);
        const resolved = resolveEntityStep(
          group.position,
          (dx / distance) * step,
          (dz / distance) * step,
          isWalkable,
        );
        nextX = resolved.x;
        nextZ = resolved.z;
        advanced = nextX !== group.position.x || nextZ !== group.position.z;
      }

      if (!contact) {
        const movedNow = Math.hypot(nextX - lastPositionX, nextZ - lastPositionZ);
        const expected = movementSpeed * delta * STUCK_MIN_PROGRESS;
        if (movedNow < expected) {
          stuckTimer += delta;
        } else {
          stuckTimer = 0;
        }
        lastPositionX = nextX;
        lastPositionZ = nextZ;
      }

      group.position.x = nextX;
      group.position.z = nextZ;
      if (distance > 0.001 && (advanced || reachedEnd)) {
        group.rotation.y = repelActive ? Math.atan2(-dx, -dz) : Math.atan2(dx, dz);
      }

      const gait = Math.sin(elapsed * 7.2) * 0.035;
      group.position.y = Math.abs(Math.sin(elapsed * 5.4)) * 0.028;
      group.rotation.z = gait;
      const currentDistance = Math.hypot(playerPosition.x - group.position.x, playerPosition.z - group.position.z);
      contact = !repelActive && currentDistance <= HOUND_CONTACT_RADIUS;

      if (recomputeTimer > 0) recomputeTimer -= delta;

      return {
        id,
        active: true,
        contact,
        distance: currentDistance,
        x: group.position.x,
        y: 0.9,
        z: group.position.z,
      };
    },
  };
}
