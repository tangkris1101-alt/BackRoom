import * as THREE from "three";
import { BACTERIA_CONTACT_RADIUS, ENTITY_SPEED_MULTIPLIER } from "../constants.js";
import { createLimbSegment } from "../common/view-model.js";
import { resolveEntityStep } from "./spawn.js";
import { createNavGrid, aStar, followPath, pathContainsCell } from "./pathfinding.js";

const RECOMPUTE_INTERVAL = 0.6;
const STUCK_THRESHOLD = 0.8;
const STUCK_MIN_PROGRESS = 0.25;

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
        type: "bacteria",
        position: { x: group.position.x, z: group.position.z },
        contact,
      };
    },
    update(delta, elapsed, playerPosition) {
      const dx = playerPosition.x - group.position.x;
      const dz = playerPosition.z - group.position.z;
      const distance = Math.hypot(dx, dz);

      if (!contact && navGrid) {
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

      if (!contact && path.waypoints.length > 0) {
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
          const step = Math.min(distance, movementSpeed * delta);
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
        const step = Math.min(distance, movementSpeed * delta);
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
        group.rotation.y = Math.atan2(dx, dz);
      }

      const sway = Math.sin(elapsed * 2.1) * 0.04;
      group.position.y = Math.sin(elapsed * 3.6) * 0.025;
      group.rotation.z = sway;
      const currentDistance = Math.hypot(playerPosition.x - group.position.x, playerPosition.z - group.position.z);
      contact = currentDistance <= BACTERIA_CONTACT_RADIUS;

      if (recomputeTimer > 0) recomputeTimer -= delta;

      return {
        id,
        active: true,
        contact,
        distance: currentDistance,
        x: group.position.x,
        y: 1.45,
        z: group.position.z,
      };
    },
  };
}
