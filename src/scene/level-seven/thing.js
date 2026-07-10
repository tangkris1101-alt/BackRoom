import * as THREE from "three";
import { createLimbSegment } from "../common/view-model.js";
import { createEntityMover } from "../entities/behavior.js";

const THING_CONTACT_RADIUS = 1.38;
const THING_RECOMPUTE_INTERVAL = 0.68;
const THING_STUCK_THRESHOLD = 0.92;
const THING_DIRECT_CHASE_DISTANCE = 7.8;

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

  const hasNavGrid =
    cols && rows && isCellOpen && worldToCell && cellCenter ? true : false;
  const mover = createEntityMover({
    group,
    isWalkable,
    speed,
    contactRadius: THING_CONTACT_RADIUS,
    cols: hasNavGrid ? cols : undefined,
    rows: hasNavGrid ? rows : undefined,
    isCellOpen: hasNavGrid ? isCellOpen : undefined,
    worldToCell: hasNavGrid ? worldToCell : undefined,
    cellCenter: hasNavGrid ? cellCenter : undefined,
    recomputeInterval: THING_RECOMPUTE_INTERVAL,
    stuckThreshold: THING_STUCK_THRESHOLD,
    directChaseDistance: THING_DIRECT_CHASE_DISTANCE,
    turnRate: 5.8,
  });

  return {
    getState() {
      return {
        id: "level-seven-thing",
        type: "bacteria",
        position: { x: group.position.x, z: group.position.z },
        contact,
      };
    },
    update(delta, elapsed, playerPosition, effects = {}) {
      const pulse = 0.9 + Math.sin(elapsed * 0.77) * 0.08;
      const moveState = mover.update(delta, elapsed, playerPosition, effects, {
        speedScale: pulse,
      });
      group.position.y = 0.01 + Math.sin(elapsed * 1.1) * 0.025;
      group.rotation.z = Math.sin(elapsed * 1.42) * 0.035;
      contact = moveState.contact;

      return {
        id: "level-seven-thing",
        active: true,
        contact,
        distance: moveState.distance,
        x: group.position.x,
        y: 0.58,
        z: group.position.z,
      };
    },
  };
}
