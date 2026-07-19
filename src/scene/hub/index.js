import * as THREE from "three";
import { attachFirstPersonViewModel, getViewModelName, updateFirstPersonHazmatViewModel } from "../common/view-model.js";
import { createExitNetwork } from "../common/exit-network.js";
import { HUB_LEVEL } from "../constants.js";

const HALF_WIDTH = 17;
const HALF_LENGTH = 132;
const WALL_SPRING_HEIGHT = 2.9;
const CEILING_HEIGHT = 7.8;
const DOORWAY_WIDTH = 3;
const DOORWAY_HEIGHT = 2.72;

function createVaultGeometry(halfWidth, halfLength, segments = 28) {
  const vertices = [];
  const indices = [];
  for (let zIndex = 0; zIndex <= 1; zIndex += 1) {
    const z = zIndex === 0 ? -halfLength : halfLength;
    for (let index = 0; index <= segments; index += 1) {
      const normalizedX = index / segments * 2 - 1;
      const x = normalizedX * halfWidth;
      const arch = 1 - normalizedX * normalizedX;
      const y = WALL_SPRING_HEIGHT + (CEILING_HEIGHT - WALL_SPRING_HEIGHT) * Math.pow(Math.max(0, arch), 0.58);
      vertices.push(x, y, z);
    }
  }
  for (let index = 0; index < segments; index += 1) {
    const nextRow = segments + 1;
    indices.push(index, nextRow + index, index + 1, index + 1, nextRow + index, nextRow + index + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addHubGlyph(group, seed, color = 0xb98b46) {
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.014, 6, 18), material);
  group.add(ring);
  for (let index = 0; index < 4; index += 1) {
    const angle = seed * 0.73 + index * Math.PI / 2;
    const marker = new THREE.Mesh(new THREE.CircleGeometry(0.032 + ((seed + index) % 3) * 0.012, 10), material);
    marker.position.set(Math.cos(angle) * 0.29, Math.sin(angle) * 0.29, 0.012);
    group.add(marker);
  }
}

function addHighLockedDoors(scene) {
  const doorMaterial = new THREE.MeshStandardMaterial({
    color: 0x34342f,
    emissive: 0x0a0906,
    emissiveIntensity: 0.1,
    roughness: 0.92,
  });
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x6b675b, roughness: 0.9 });
  const keyholeMaterial = new THREE.MeshBasicMaterial({ color: 0x17140d });
  const doors = [
    { side: -1, z: -104, y: 3.82, seed: 13 },
    { side: 1, z: -76, y: 4.38, seed: 17 },
    { side: -1, z: -38, y: 4.06, seed: 23 },
    { side: 1, z: 10, y: 4.52, seed: 29 },
    { side: -1, z: 49, y: 3.74, seed: 31 },
    { side: 1, z: 89, y: 4.24, seed: 37 },
  ];

  doors.forEach((door) => {
    const group = new THREE.Group();
    group.name = `hub-high-locked-door-${door.seed}`;
    group.position.set(door.side * 15.05, door.y, door.z);
    group.rotation.y = door.side < 0 ? Math.PI / 2 : -Math.PI / 2;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.82, 0.1), doorMaterial);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.14, 0.16), frameMaterial);
    top.position.y = 0.98;
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.98, 0.16), frameMaterial);
    left.position.x = -0.84;
    const right = left.clone();
    right.position.x = 0.84;
    const keyhole = new THREE.Mesh(new THREE.CircleGeometry(0.065, 14), keyholeMaterial);
    keyhole.position.set(0, -0.15, 0.058);
    const glyph = new THREE.Group();
    glyph.position.set(0, 1.26, 0.06);
    addHubGlyph(glyph, door.seed);
    group.add(panel, top, left, right, keyhole, glyph);
    scene.add(group);
  });
}

function addHubArchitecture(scene, routes) {
  const concrete = new THREE.MeshStandardMaterial({
    color: 0x605d54,
    emissive: 0x201b11,
    emissiveIntensity: 0.22,
    roughness: 0.94,
  });
  const asphalt = new THREE.MeshStandardMaterial({
    color: 0x24231f,
    emissive: 0x100d08,
    emissiveIntensity: 0.12,
    roughness: 0.98,
  });
  const wallSeam = new THREE.MeshBasicMaterial({ color: 0x343126 });
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd797,
    emissive: 0xf0a64e,
    emissiveIntensity: 1.7,
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

  const vault = new THREE.Mesh(createVaultGeometry(HALF_WIDTH, HALF_LENGTH), concrete);
  vault.material.side = THREE.BackSide;
  scene.add(vault);

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
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.35, WALL_SPRING_HEIGHT, segmentLength), concrete);
        wall.position.set(side * HALF_WIDTH, WALL_SPRING_HEIGHT / 2, cursor + segmentLength / 2);
        scene.add(wall);
      }
      const lintel = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, WALL_SPRING_HEIGHT - DOORWAY_HEIGHT, DOORWAY_WIDTH),
        concrete,
      );
      lintel.position.set(side * HALF_WIDTH, DOORWAY_HEIGHT + (CEILING_HEIGHT - DOORWAY_HEIGHT) / 2, route.position.z);
      scene.add(lintel);
      cursor = gapEnd;
    }
    const tailLength = HALF_LENGTH - cursor;
    if (tailLength > 0.1) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.35, WALL_SPRING_HEIGHT, tailLength), concrete);
      wall.position.set(side * HALF_WIDTH, WALL_SPRING_HEIGHT / 2, cursor + tailLength / 2);
      scene.add(wall);
    }
  }
  for (const end of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(HALF_WIDTH * 2, WALL_SPRING_HEIGHT, 0.35), concrete);
    wall.position.set(0, WALL_SPRING_HEIGHT / 2, end * HALF_LENGTH);
    scene.add(wall);
  }

  const slabBreaks = [-121, -106, -88, -67, -52, -31, -11, 8, 30, 47, 71, 93, 112];
  slabBreaks.forEach((z, index) => {
    for (const side of [-1, 1]) {
      const verticalSeam = new THREE.Mesh(new THREE.BoxGeometry(0.02, WALL_SPRING_HEIGHT, 0.09), wallSeam);
      verticalSeam.position.set(side * (HALF_WIDTH - 0.18), WALL_SPRING_HEIGHT / 2, z);
      scene.add(verticalSeam);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 2.35), lampMaterial);
      lamp.position.set(side * (HALF_WIDTH - 0.36), 2.18, z + (index % 2 === 0 ? 1.7 : -1.15));
      scene.add(lamp);
      if (index % 2 === 0) {
        const light = new THREE.PointLight(0xffb45c, 4.2, 18, 1.9);
        light.position.set(side * (HALF_WIDTH - 1.05), 2.18, lamp.position.z);
        scene.add(light);
      }
    }
    const rib = new THREE.Mesh(new THREE.BoxGeometry(HALF_WIDTH * 1.86, 0.16, 0.34), concrete);
    rib.position.set(0, CEILING_HEIGHT - 0.38, z);
    rib.rotation.z = (index % 2 === 0 ? 1 : -1) * 0.035;
    scene.add(rib);
  });

  addHighLockedDoors(scene);
}

export function createHubScene({ initialState = null } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3a3326);
  scene.fog = new THREE.FogExp2(0x3e3729, 0.008);
  const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 320);
  const viewModel = attachFirstPersonViewModel(camera);
  scene.add(camera);
  scene.add(new THREE.HemisphereLight(0xffdf9d, 0x29251d, 1.2));
  const fill = new THREE.DirectionalLight(0xffd68a, 0.7);
  fill.position.set(6, CEILING_HEIGHT - 0.5, 10);
  scene.add(fill);

  const spawn = { x: 0, z: 112, yaw: Math.PI };
  const routes = [
    { level: 1, side: -1, z: -111, symbolSeed: 7 },
    { level: 6, side: 1, z: -83, symbolSeed: 2 },
    { level: 3, side: -1, z: -54, symbolSeed: 9 },
    { level: 0, side: 1, z: -17, symbolSeed: 4 },
    { level: 7, side: -1, z: 21, symbolSeed: 1 },
    { level: 2, side: 1, z: 57, symbolSeed: 11 },
    { level: 5, side: -1, z: 84, symbolSeed: 5 },
    { level: 4, side: 1, z: 108, symbolSeed: 8 },
  ].map(({ level, side, z, symbolSeed }) => ({
    id: `hub-door-level-${level}`,
    targetLevel: level,
    targetLabel: `LEVEL ${level}`,
    kind: "door",
    noSign: true,
    anonymous: true,
    singleDoor: true,
    doorNumber: level,
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
