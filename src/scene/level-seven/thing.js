import * as THREE from "three";
import { ENTITY_SPEED_MULTIPLIER } from "../constants.js";
import { createLimbSegment } from "../common/view-model.js";
import { resolveEntityStep } from "../entities/spawn.js";
import { createNavGrid, aStar, followPath, pathContainsCell } from "../entities/pathfinding.js";

const THING_CONTACT_RADIUS = 1.38;
const RECOMPUTE_INTERVAL = 0.72;
const STUCK_THRESHOLD = 1.1;
const STUCK_MIN_PROGRESS = 0.22;

function createLevelSevenThingModel() {
  const group = new THREE.Group();
  group.name = "level-seven-thing";

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x010101,
    emissive: 0x020405,
    emissiveIntensity: 0.22,
    roughness: 0.94,
  });
  const wetMaterial = new THREE.MeshStandardMaterial({
    color: 0x030507,
    emissive: 0x061213,
    emissiveIntensity: 0.16,
    roughness: 0.62,
    metalness: 0.08,
  });
  const eyeMaterial = new THREE.MeshBasicMaterial({
    color: 0xa3f4ff,
    transparent: true,
    opacity: 0.45,
  });

  const hump = new THREE.Mesh(new THREE.SphereGeometry(0.64, 24, 14), bodyMaterial);
  hump.position.set(0, 0.16, 0);
  hump.scale.set(1.55, 0.42, 0.82);
  group.add(hump);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 12), bodyMaterial);
  head.position.set(0, 0.22, -0.76);
  head.scale.set(0.82, 0.52, 1.28);
  group.add(head);

  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.82, 4), wetMaterial);
  fin.position.set(0, 0.72, -0.06);
  fin.rotation.x = Math.PI * 0.03;
  fin.rotation.z = Math.PI * 0.25;
  group.add(fin);

  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), eyeMaterial);
    eye.position.set(side * 0.13, 0.28, -1.02);
    group.add(eye);
  });

  [
    [[-0.48, 0.02, -0.18], [-1.18, -0.02, -0.68]],
    [[0.48, 0.02, -0.18], [1.18, -0.02, -0.68]],
    [[-0.42, 0.02, 0.16], [-1.1, -0.03, 0.62]],
    [[0.42, 0.02, 0.16], [1.1, -0.03, 0.62]],
  ].forEach(([start, end]) => {
    group.add(createLimbSegment(start, end, 0.035, 0.012, wetMaterial));
  });

  return group;
}

export function createLevelSevenThingEntity(
  scene,
  {
    spawnPosition,
    isWalkable,
    speed = 0.92,
    initialState = null,
    cols,
    rows,
    isCellOpen,
    worldToCell,
    cellCenter,
  },
) {
  const group = createLevelSevenThingModel();
  group.position.set(spawnPosition.x, 0.02, spawnPosition.z);
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

  function repathTo(playerPosition) {
    if (!navGrid) return;
    const start = worldToCell(group.position.x, group.position.z);
    const goal = worldToCell(playerPosition.x, playerPosition.z);
    const next = aStar(navGrid, start, goal);
    path.waypoints = next ?? [];
    path.index = 0;
    recomputeTimer = RECOMPUTE_INTERVAL;
  }

  return {
    getState() {
      return {
        id: "level-seven-thing",
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
        if (path.waypoints.length === 0 || recomputeTimer <= 0 || (playerMoved && playerOffPath) || stuckTimer > STUCK_THRESHOLD) {
          repathTo(playerPosition);
          lastPlayerCellKey = playerCellKey;
        }
      }

      let nextX = group.position.x;
      let nextZ = group.position.z;
      let advanced = false;
      let reachedEnd = false;
      const huntSpeed = speed * ENTITY_SPEED_MULTIPLIER * (0.84 + Math.sin(elapsed * 0.77) * 0.08);

      if (!contact && path.waypoints.length > 0) {
        const followed = followPath({
          entityPos: group.position,
          waypoints: path.waypoints,
          indexRef: path,
          cellCenter,
          speed: huntSpeed,
          delta,
          isWalkable,
        });
        nextX = followed.x;
        nextZ = followed.z;
        advanced = followed.advanced;
        reachedEnd = followed.reachedEnd;
      } else if (!contact && distance > 0.001) {
        const step = Math.min(distance, huntSpeed * delta);
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
        const expected = speed * ENTITY_SPEED_MULTIPLIER * delta * STUCK_MIN_PROGRESS;
        stuckTimer = movedNow < expected ? stuckTimer + delta : 0;
        lastPositionX = nextX;
        lastPositionZ = nextZ;
      }

      group.position.x = nextX;
      group.position.z = nextZ;
      if (distance > 0.001 && (advanced || reachedEnd)) group.rotation.y = Math.atan2(dx, dz);
      group.position.y = 0.01 + Math.sin(elapsed * 1.1) * 0.025;
      group.rotation.z = Math.sin(elapsed * 1.42) * 0.035;

      const currentDistance = Math.hypot(playerPosition.x - group.position.x, playerPosition.z - group.position.z);
      contact = currentDistance <= THING_CONTACT_RADIUS;
      if (recomputeTimer > 0) recomputeTimer -= delta;

      return {
        id: "level-seven-thing",
        active: true,
        contact,
        distance: currentDistance,
        x: group.position.x,
        y: 0.58,
        z: group.position.z,
      };
    },
  };
}
