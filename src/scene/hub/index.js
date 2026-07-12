import * as THREE from "three";
import { attachFirstPersonViewModel, getViewModelName, updateFirstPersonHazmatViewModel } from "../common/view-model.js";
import { createExitNetwork } from "../common/exit-network.js";
import { HUB_LEVEL } from "../constants.js";

const HALF_WIDTH = 17;
const HALF_LENGTH = 76;
const CEILING_HEIGHT = 7.2;
const DOORWAY_WIDTH = 3;
const DOORWAY_HEIGHT = 2.72;

function addHubArchitecture(scene, routes) {
  const concrete = new THREE.MeshStandardMaterial({
    color: 0x74736b,
    emissive: 0x302819,
    emissiveIntensity: 0.34,
    roughness: 0.94,
  });
  const asphalt = new THREE.MeshStandardMaterial({
    color: 0x30302a,
    emissive: 0x15120c,
    emissiveIntensity: 0.18,
    roughness: 0.98,
  });
  const stripe = new THREE.MeshBasicMaterial({ color: 0xc59846 });
  const wallSeam = new THREE.MeshBasicMaterial({ color: 0x413e34 });
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd987,
    emissive: 0xffa443,
    emissiveIntensity: 2.2,
    roughness: 0.28,
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, HALF_LENGTH * 2), asphalt);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  for (const side of [-1, 1]) {
    const walkway = new THREE.Mesh(new THREE.BoxGeometry(4.85, 0.14, HALF_LENGTH * 2), concrete);
    walkway.position.set(side * 10.55, 0.035, 0);
    scene.add(walkway);
  }

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(HALF_WIDTH * 2, HALF_LENGTH * 2), concrete);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = CEILING_HEIGHT;
  scene.add(ceiling);

  for (const side of [-1, 1]) {
    const sideDoors = routes
      .filter((route) => Math.sign(route.position.x) === side)
      .sort((a, b) => a.position.z - b.position.z);
    let cursor = -HALF_LENGTH;
    for (const route of sideDoors) {
      const gapStart = route.position.z - DOORWAY_WIDTH / 2;
      const gapEnd = route.position.z + DOORWAY_WIDTH / 2;
      const segmentLength = gapStart - cursor;
      if (segmentLength > 0.1) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.35, CEILING_HEIGHT, segmentLength), concrete);
        wall.position.set(side * HALF_WIDTH, CEILING_HEIGHT / 2, cursor + segmentLength / 2);
        scene.add(wall);
      }
      const lintel = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, CEILING_HEIGHT - DOORWAY_HEIGHT, DOORWAY_WIDTH),
        concrete,
      );
      lintel.position.set(side * HALF_WIDTH, DOORWAY_HEIGHT + (CEILING_HEIGHT - DOORWAY_HEIGHT) / 2, route.position.z);
      scene.add(lintel);
      cursor = gapEnd;
    }
    const tailLength = HALF_LENGTH - cursor;
    if (tailLength > 0.1) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.35, CEILING_HEIGHT, tailLength), concrete);
      wall.position.set(side * HALF_WIDTH, CEILING_HEIGHT / 2, cursor + tailLength / 2);
      scene.add(wall);
    }
  }
  for (const end of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(HALF_WIDTH * 2, CEILING_HEIGHT, 0.35), concrete);
    wall.position.set(0, CEILING_HEIGHT / 2, end * HALF_LENGTH);
    scene.add(wall);
  }

  for (let z = -72; z <= 72; z += 8) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(HALF_WIDTH * 2, 0.018, 0.08), stripe);
    seam.position.set(0, 0.022, z);
    scene.add(seam);

    for (const side of [-1, 1]) {
      const verticalSeam = new THREE.Mesh(new THREE.BoxGeometry(0.02, CEILING_HEIGHT, 0.09), wallSeam);
      verticalSeam.position.set(side * (HALF_WIDTH - 0.18), CEILING_HEIGHT / 2, z);
      scene.add(verticalSeam);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 2.35), lampMaterial);
      lamp.position.set(side * (HALF_WIDTH - 0.36), CEILING_HEIGHT - 1.25, z + 2.15);
      scene.add(lamp);
    }

    if (z % 16 === 0) {
      const light = new THREE.PointLight(0xffad57, 2.4, 22, 1.85);
      light.position.set(0, CEILING_HEIGHT - 1.45, z + 2.15);
      scene.add(light);
    }
  }

  for (const z of [-48, -16, 16, 48]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(HALF_WIDTH * 2, 0.34, 0.45), concrete);
    beam.position.set(0, CEILING_HEIGHT - 0.62, z);
    scene.add(beam);
  }
}

export function createHubScene({ initialState = null } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x5b503b);
  scene.fog = new THREE.FogExp2(0x5f533c, 0.0052);
  const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 210);
  const viewModel = attachFirstPersonViewModel(camera);
  scene.add(camera);
  scene.add(new THREE.HemisphereLight(0xffe2a7, 0x3b3425, 2.15));
  const fill = new THREE.DirectionalLight(0xffd68a, 0.7);
  fill.position.set(6, CEILING_HEIGHT - 0.5, 10);
  scene.add(fill);

  const spawn = { x: 0, z: 68, yaw: Math.PI };
  const routes = [
    { level: 1, side: -1, z: -51, symbolSeed: 7 },
    { level: 6, side: 1, z: -35, symbolSeed: 2 },
    { level: 3, side: -1, z: -18, symbolSeed: 9 },
    { level: 0, side: 1, z: -3, symbolSeed: 4 },
    { level: 7, side: -1, z: 14, symbolSeed: 1 },
    { level: 2, side: 1, z: 31, symbolSeed: 11 },
    { level: 5, side: -1, z: 47, symbolSeed: 5 },
    { level: 4, side: 1, z: 61, symbolSeed: 8 },
  ].map(({ level, side, z, symbolSeed }) => ({
    id: `hub-door-level-${level}`,
    targetLevel: level,
    targetLabel: `LEVEL ${level}`,
    kind: "door",
    noSign: true,
    requiresLevelKey: true,
    symbolSeed,
    position: { x: side * HALF_WIDTH, z },
    rotation: side < 0 ? Math.PI / 2 : -Math.PI / 2,
  }));
  addHubArchitecture(scene, routes);
  const exitNetwork = createExitNetwork(scene, camera, routes, initialState?.interactions ?? {});
  const keyMarker = new THREE.Group();
  keyMarker.name = "hub-level-key-door-marker";
  const keyMarkerMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd36a,
    transparent: true,
    opacity: 0.94,
    depthTest: false,
  });
  const keyMarkerRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 8, 28), keyMarkerMaterial);
  const keyMarkerPointer = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.34, 3), keyMarkerMaterial);
  keyMarkerPointer.position.y = -0.62;
  keyMarkerPointer.rotation.z = Math.PI;
  keyMarker.add(keyMarkerRing, keyMarkerPointer);
  keyMarker.visible = false;
  keyMarker.renderOrder = 12;
  scene.add(keyMarker);

  function isWalkable(x, z, radius = 0.36) {
    return Math.abs(x) <= HALF_WIDTH - 0.45 - radius && Math.abs(z) <= HALF_LENGTH - 0.45 - radius;
  }

  function setKeyMarker(targetLevel, elapsed = 0) {
    const route = routes.find((candidate) => candidate.targetLevel === targetLevel);
    keyMarker.visible = Boolean(route);
    if (!route) return null;
    keyMarker.position.set(Math.sign(route.position.x) * (HALF_WIDTH - 0.9), 3.62, route.position.z);
    keyMarker.rotation.z = elapsed * 0.72;
    keyMarker.scale.setScalar(1 + Math.sin(elapsed * 3.2) * 0.08);
    return route.position;
  }

  function update(delta, elapsed, playerPosition, effects = {}) {
    updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition);
    const equippedLevelKey = Number.isInteger(effects.equippedLevelKey) ? effects.equippedLevelKey : null;
    setKeyMarker(equippedLevelKey, elapsed);
    const entered = exitNetwork.update(delta, playerPosition);
    const distances = routes.map((route) => Math.hypot(playerPosition.x - route.position.x, playerPosition.z - route.position.z));
    return {
      exitDistance: Math.round(Math.min(...distances)),
      exitReached: Boolean(entered),
      nextLevel: entered?.targetLevel,
      exitId: entered?.id ?? null,
      flicker: 1,
      lightState: "HUM",
      pickups: [],
      entities: [],
      focusInteraction: exitNetwork.inspect(playerPosition, {
        hasLevelKey: (targetLevel) => Boolean(effects.debugBypassLevelKeys) || equippedLevelKey === targetLevel,
      }),
      statusText: "THE HUB",
    };
  }

  return {
    level: HUB_LEVEL,
    levelLabel: "THE HUB",
    levelName: "NEXUS TUNNELS",
    get viewModelName() {
      return getViewModelName(viewModel);
    },
    scene,
    camera,
    spawn,
    targetPosition: routes[0].position,
    exitMode: "network",
    nextLevel: null,
    isWalkable,
    update,
    interact: (playerPosition, access) => exitNetwork.interact(playerPosition, access),
    getLevelKeyTargetPosition: (targetLevel) =>
      routes.find((route) => route.targetLevel === targetLevel)?.position ?? null,
    decorativeItemSpawns: [
      { id: "concrete-chip", position: { x: 1.4, y: 0.24, z: 25 }, rotation: 0.4, tiltX: 0.1 },
    ],
    worldItemOptions: {
      minimumLevelKeys: 1,
      levelKeyAnchors: [
        { position: { x: -7.6, z: -41 } },
        { position: { x: 6.9, z: -6 } },
        { position: { x: -6.7, z: 38 } },
        { position: { x: 7.3, z: 56 } },
      ],
    },
    getSnapshot() {
      return {
        pickups: {},
        interactions: exitNetwork.getState(),
        objectives: { reached: false },
        entities: [],
      };
    },
  };
}
