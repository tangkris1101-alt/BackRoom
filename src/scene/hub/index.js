import * as THREE from "three";
import { attachFirstPersonViewModel, getViewModelName, updateFirstPersonHazmatViewModel } from "../common/view-model.js";
import { createExitNetwork } from "../common/exit-network.js";
import {
  colliderBlocksAtFeetHeight,
  getPlatformFloorHeight,
  resolvePlatformOverlap,
} from "../common/platform-collision.js";
import { HUB_LEVEL, circleIntersectsAabb } from "../constants.js";
import { resolveHubEntry } from "./entry.js";
import { createHubAsphaltMaps, createHubConcreteMaps, createHubWalkwayMaps } from "./textures.js";

const HALF_WIDTH = 17;
const HALF_LENGTH = 132;
const WALL_SPRING_HEIGHT = 2.9;
const CEILING_HEIGHT = 7.8;
const DOORWAY_WIDTH = 3;
const DOORWAY_HEIGHT = 2.72;
// Floor footprints, all measured from the geometry below: the central asphalt
// slab is 12 wide (|x| <= 6), the raised walkways are 4.85 wide boxes centred on
// |x| = 10.55 (|x| in [8.125, 12.975]), and the side walls are 0.35 thick with
// their centres on |x| = 17, so the wall face is at 16.825. The two strips in
// between - |x| in (6, 8.125) and (12.975, 16.825) - were a hole the walkable
// clamp still allowed the player to cross; the floor pads built from these
// constants fill them so every reachable x has a surface under it.
const CENTRAL_FLOOR_HALF_WIDTH = 6;
const WALL_THICKNESS = 0.35;
const WALKWAY_WIDTH = 4.85;
const WALKWAY_CENTER_X = 10.55;
const WALKWAY_HEIGHT = 0.14;
const WALKWAY_BASE_Y = 0.035;
const WALKWAY_INNER_X = WALKWAY_CENTER_X - WALKWAY_WIDTH / 2;
const WALKWAY_OUTER_X = WALKWAY_CENTER_X + WALKWAY_WIDTH / 2;
const WALKWAY_TOP_Y = WALKWAY_BASE_Y + WALKWAY_HEIGHT / 2;
const FLOOR_PAD_OUTER_X = HALF_WIDTH - WALL_THICKNESS / 2;

function createVaultGeometry(halfWidth, halfLength, segments = 28) {
  const vertices = [];
  const uvs = [];
  const indices = [];
  let arcLength = 0;
  let previousX = -halfWidth;
  let previousY = WALL_SPRING_HEIGHT;
  for (let zIndex = 0; zIndex <= 1; zIndex += 1) {
    const z = zIndex === 0 ? -halfLength : halfLength;
    arcLength = 0;
    for (let index = 0; index <= segments; index += 1) {
      const normalizedX = index / segments * 2 - 1;
      const x = normalizedX * halfWidth;
      const arch = 1 - normalizedX * normalizedX;
      const y = WALL_SPRING_HEIGHT + (CEILING_HEIGHT - WALL_SPRING_HEIGHT) * Math.pow(Math.max(0, arch), 0.58);
      if (index > 0) arcLength += Math.hypot(x - previousX, y - previousY);
      vertices.push(x, y, z);
      uvs.push(arcLength / 3.2, z / 3.2);
      previousX = x;
      previousY = y;
    }
  }
  for (let index = 0; index < segments; index += 1) {
    const nextRow = segments + 1;
    indices.push(index, nextRow + index, index + 1, index + 1, nextRow + index, nextRow + index + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createTiledBoxGeometry(width, height, depth, tileSize = 3.2) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  const uvs = geometry.attributes.uv;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    if (Math.abs(normals.getX(index)) > 0.5) uvs.setXY(index, z / tileSize, y / tileSize);
    else if (Math.abs(normals.getY(index)) > 0.5) uvs.setXY(index, x / tileSize, z / tileSize);
    else uvs.setXY(index, x / tileSize, y / tileSize);
  }
  uvs.needsUpdate = true;
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
    ...createHubConcreteMaps(),
    color: 0xd2c7b3,
    roughness: 0.9,
    normalScale: new THREE.Vector2(0.35, 0.35),
  });
  const asphalt = new THREE.MeshStandardMaterial({
    ...createHubAsphaltMaps(),
    color: 0xb7a992,
    roughness: 0.98,
    normalScale: new THREE.Vector2(0.32, 0.32),
  });
  const walkwayConcrete = new THREE.MeshStandardMaterial({
    ...createHubWalkwayMaps(),
    color: 0xb9ab91,
    roughness: 0.94,
    normalScale: new THREE.Vector2(0.3, 0.3),
  });
  const vaultConcrete = concrete.clone();
  vaultConcrete.side = THREE.BackSide;
  vaultConcrete.emissive.set(0x9c8260);
  vaultConcrete.emissiveMap = concrete.map;
  vaultConcrete.emissiveIntensity = 0.35;
  const wallSeam = new THREE.MeshBasicMaterial({ color: 0x343126 });
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd797,
    emissive: 0xf0a64e,
    emissiveIntensity: 1.7,
    roughness: 0.28,
  });

  const floorGeometry = new THREE.PlaneGeometry(CENTRAL_FLOOR_HALF_WIDTH * 2, HALF_LENGTH * 2);
  const floorUvs = floorGeometry.attributes.uv;
  for (let index = 0; index < floorUvs.count; index += 1) {
    floorUvs.setXY(
      index,
      floorUvs.getX(index) * CENTRAL_FLOOR_HALF_WIDTH * 2 / 3.2,
      floorUvs.getY(index) * HALF_LENGTH * 2 / 3.2,
    );
  }
  const floor = new THREE.Mesh(floorGeometry, asphalt);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  for (const side of [-1, 1]) {
    const walkway = new THREE.Mesh(createTiledBoxGeometry(WALKWAY_WIDTH, WALKWAY_HEIGHT, HALF_LENGTH * 2), walkwayConcrete);
    walkway.position.set(side * WALKWAY_CENTER_X, WALKWAY_BASE_Y, 0);
    scene.add(walkway);
  }

  // The walkways are only 4.85 wide, so they leave a 2.125 wide gutter against
  // the asphalt edge (|x| in [6, 8.125]) and a 3.85 wide one against the wall
  // face (|x| in [12.975, 16.825]). Both sit inside the walkable clamp, and the
  // outer one is exactly where the 15 doors at |x| = 17 are opened (|x| >= 13.8)
  // and entered (|x| >= 15.75), so the player used to cross it over nothing. The
  // pads reuse the walkway material, height and 3.2 m tiling, so the raised
  // sidewalk reads as one continuous surface up to the wall with no visible
  // gutter.
  const floorPadBands = [
    { name: "inner", minX: CENTRAL_FLOOR_HALF_WIDTH, maxX: WALKWAY_INNER_X },
    { name: "outer", minX: WALKWAY_OUTER_X, maxX: FLOOR_PAD_OUTER_X },
  ];
  for (const side of [-1, 1]) {
    for (const band of floorPadBands) {
      const pad = new THREE.Mesh(
        createTiledBoxGeometry(band.maxX - band.minX, WALKWAY_HEIGHT, HALF_LENGTH * 2),
        walkwayConcrete,
      );
      pad.name = `hub-floor-pad-${band.name}-${side < 0 ? "west" : "east"}`;
      pad.position.set(side * (band.minX + band.maxX) / 2, WALKWAY_BASE_Y, 0);
      scene.add(pad);
    }
  }

  const vault = new THREE.Mesh(createVaultGeometry(HALF_WIDTH, HALF_LENGTH), vaultConcrete);
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
        const wall = new THREE.Mesh(createTiledBoxGeometry(0.35, WALL_SPRING_HEIGHT, segmentLength), concrete);
        wall.position.set(side * HALF_WIDTH, WALL_SPRING_HEIGHT / 2, cursor + segmentLength / 2);
        scene.add(wall);
      }
      const lintel = new THREE.Mesh(
        createTiledBoxGeometry(0.35, WALL_SPRING_HEIGHT - DOORWAY_HEIGHT, DOORWAY_WIDTH),
        concrete,
      );
      lintel.position.set(side * HALF_WIDTH, DOORWAY_HEIGHT + (CEILING_HEIGHT - DOORWAY_HEIGHT) / 2, route.position.z);
      scene.add(lintel);
      cursor = gapEnd;
    }
    const tailLength = HALF_LENGTH - cursor;
    if (tailLength > 0.1) {
      const wall = new THREE.Mesh(createTiledBoxGeometry(0.35, WALL_SPRING_HEIGHT, tailLength), concrete);
      wall.position.set(side * HALF_WIDTH, WALL_SPRING_HEIGHT / 2, cursor + tailLength / 2);
      scene.add(wall);
    }
  }
  for (const end of [-1, 1]) {
    const wall = new THREE.Mesh(createTiledBoxGeometry(HALF_WIDTH * 2, WALL_SPRING_HEIGHT, 0.35), concrete);
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
        const light = new THREE.PointLight(0xffb45c, 4.2, 23, 1.9);
        light.position.set(side * (HALF_WIDTH - 1.05), 2.18, lamp.position.z);
        scene.add(light);
      }
    }
    const rib = new THREE.Mesh(createTiledBoxGeometry(HALF_WIDTH * 1.86, 0.16, 0.34), concrete);
    rib.position.set(0, CEILING_HEIGHT - 0.38, z);
    rib.rotation.z = (index % 2 === 0 ? 1 : -1) * 0.035;
    scene.add(rib);
  });

  addHighLockedDoors(scene);
}

export function createHubScene({ initialState = null, entryContext = null } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3a3326);
  scene.fog = new THREE.FogExp2(0x3e3729, 0.008);
  const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 320);
  const viewModel = attachFirstPersonViewModel(camera);
  scene.add(camera);
  scene.add(new THREE.HemisphereLight(0xffdfae, 0x5a5041, 1.45));
  const fill = new THREE.DirectionalLight(0xffdba8, 0.78);
  fill.position.set(6, CEILING_HEIGHT - 0.5, 10);
  scene.add(fill);

  const routes = [
    { level: 1, side: -1, z: -111, symbolSeed: 7 },
    { level: 6, side: 1, z: -83, symbolSeed: 2 },
    { level: 3, side: -1, z: -54, symbolSeed: 9 },
    { level: 12, side: 1, z: -54, symbolSeed: 31 },
    { level: 0, side: 1, z: -17, symbolSeed: 4 },
    { level: 13, side: -1, z: -17, symbolSeed: 37 },
    { level: 7, side: -1, z: 21, symbolSeed: 1 },
    { level: 10, side: 1, z: 21, symbolSeed: 23 },
    { level: 2, side: 1, z: 57, symbolSeed: 11 },
    { level: 11, side: -1, z: 57, symbolSeed: 29 },
    { level: 5, side: -1, z: 84, symbolSeed: 5 },
    { level: 4, side: 1, z: 108, symbolSeed: 8 },
    { level: 8, side: -1, z: -126, symbolSeed: 13 },
    { level: 9, side: -1, z: 116, symbolSeed: 19 },
    { level: 37, side: 1, z: 126, symbolSeed: 17 },
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
  const hubEntry = resolveHubEntry({
    routes,
    initialInteractions: initialState?.interactions ?? {},
    entryContext,
    defaultSpawn: { x: 0, z: 112, yaw: Math.PI },
  });
  const spawn = hubEntry.spawn;
  addHubArchitecture(scene, routes);

  // One collider per side stands for every raised surface: the walkway plus both
  // new floor pads, all sharing the 0.105 top face. It spans the central asphalt
  // edge (6) out to the wall face (16.825), so the platform height is published
  // across the whole walkable width instead of only the 4.85 m walkway.
  //
  // A `topY` of 0.105 together with platform-collision's SIDE_CLEARANCE (0.18)
  // makes this a floor lift and never a wall: colliderBlocksAtFeetHeight only
  // blocks while the feet are below 0.105 - 0.18 = -0.075, and no Hub floor sits
  // below 0. The 10.5 cm step at x = 6 therefore cannot push the player back -
  // it only raises the ground once the body is fully on top of the platform.
  //
  // The exit network pushes one collider per door pose into this same list (the
  // shut doorway, plus the swinging leaf for the single-door routes), so it has
  // to exist before the network is built. Nothing else in the Hub reads the list
  // during construction, so the order is free.
  const colliders = [
    {
      minX: CENTRAL_FLOOR_HALF_WIDTH,
      maxX: FLOOR_PAD_OUTER_X,
      minZ: -HALF_LENGTH,
      maxZ: HALF_LENGTH,
      topY: WALKWAY_TOP_Y,
    },
    {
      minX: -FLOOR_PAD_OUTER_X,
      maxX: -CENTRAL_FLOOR_HALF_WIDTH,
      minZ: -HALF_LENGTH,
      maxZ: HALF_LENGTH,
      topY: WALKWAY_TOP_Y,
    },
  ];

  const exitNetwork = createExitNetwork(scene, camera, routes, hubEntry.interactions, { colliders });
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

  // The walkable rectangle keeps its full |x| <= HALF_WIDTH - 0.45 - radius
  // (16.19 at the player radius) and |z| <= 131.19 clamp. Narrowing it to the
  // visible walkway edge would soft-lock the level: the doors sit at |x| = 17 and
  // need |x| >= 13.8 to be opened and |x| >= 15.75 to be entered. The pads above
  // supply the missing ground for that band instead.
  function isWalkable(x, z, radius = 0.36, feetY = 0) {
    if (Math.abs(x) > HALF_WIDTH - 0.45 - radius || Math.abs(z) > HALF_LENGTH - 0.45 - radius) return false;
    return !colliders.some(
      (collider) => colliderBlocksAtFeetHeight(collider, feetY) && circleIntersectsAabb(x, z, radius, collider),
    );
  }

  function getFloorHeight(x, z, feetY) {
    return getPlatformFloorHeight({ colliders, x, z, feetY });
  }

  function resolvePosition(x, z, radius, feetY, maxCorrection) {
    return resolvePlatformOverlap({ colliders, x, z, radius, feetY, maxCorrection });
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
    getFloorHeight,
    resolvePosition,
    getFootstepSurface: (position) => Math.abs(position.x) <= 6 ? "asphalt" : "concrete",
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
        // Kept inside |x| <= 5.2 so the +/-0.6m spawn jitter never drops a key
        // onto the raised walkway pads (top 0.105), where the item's fixed
        // y = 0.08 would bury it under the concrete.
        { position: { x: -5.2, z: -41 } },
        { position: { x: 5.2, z: -6 } },
        { position: { x: -5.2, z: 38 } },
        { position: { x: 5.2, z: 56 } },
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
