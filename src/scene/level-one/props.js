import * as THREE from "three";
import {
  CELL_SIZE,
  CEILING_Y,
  WALL_HEIGHT,
  WALL_THICKNESS,
} from "../constants.js";
import { createFixturePointLight } from "../common/lighting.js";
import { createWideSignTexture } from "../common/textures.js";
import {
  LEVEL_ONE_COLS,
  LEVEL_ONE_ROWS,
  LEVEL_ONE_MIN_FIXTURE_DISTANCE,
  LEVEL_ONE_DARK_ZONES,
  LEVEL_ONE_SUPPLY_ZONES,
  LEVEL_ONE_START_CELL,
  LEVEL_ONE_TARGET_CELL,
  LEVEL_ONE_MAX_POINT_LIGHTS,
  LEVEL_ONE_CORRIDOR_FIXTURES,
} from "./layout.js";
import {
  isLevelOneOpenCell,
  isLevelOneCorridorCell,
  levelOneCellCenter,
  isInAnyLevelOneZone,
  countLevelOneOpenNeighbors,
  getLevelOneTargetMount,
} from "./layout.js";
import {
  buildDetailedSupplyCrate,
  buildDetailedSupplyShelf,
  createLevelOneStorageAssetKit,
} from "./storage-model.js";

export function createLevelOneLights(scene, fixturePositions, { dynamicPointLights = false } = {}) {
  const fixtures = [];
  const pointLightIndexes = new Set(
    fixturePositions
      .map((fixture, index) => ({ index, priority: fixture.priority }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, LEVEL_ONE_MAX_POINT_LIGHTS)
      .map(({ index }) => index),
  );
  const tubeGeometry = new THREE.BoxGeometry(1, 0.04, 0.34);
  const mountGeometry = new THREE.BoxGeometry(1, 0.04, 0.48);
  const cableGeometry = new THREE.CylinderGeometry(0.012, 0.012, 1, 6);
  const mountMaterial = new THREE.MeshStandardMaterial({
    color: 0x56605b,
    emissive: 0x1d2421,
    emissiveIntensity: 0.16,
    roughness: 0.72,
    metalness: 0.22,
  });
  const cableMaterial = new THREE.MeshStandardMaterial({
    color: 0x283034,
    roughness: 0.78,
    metalness: 0.16,
  });

  fixturePositions.forEach((fixture, index) => {
    const drop = fixture.drop ?? 0.12;
    const tubeY = CEILING_Y - drop;
    const mountY = tubeY + 0.045;
    const mount = new THREE.Mesh(mountGeometry, mountMaterial);
    mount.position.set(fixture.x, mountY, fixture.z);
    mount.rotation.y = fixture.rotation;
    mount.scale.x = fixture.panelWidth + 0.32;
    scene.add(mount);

    const tubeMaterial = new THREE.MeshStandardMaterial({
      color: fixture.color,
      emissive: fixture.color,
      emissiveIntensity: fixture.baseIntensity,
      roughness: 0.22,
    });
    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    tube.position.set(fixture.x, tubeY, fixture.z);
    tube.rotation.y = fixture.rotation;
    tube.scale.x = fixture.panelWidth;
    scene.add(tube);

    if (fixture.suspended) {
      const cableLength = Math.max(0.08, CEILING_Y - 0.035 - (mountY + 0.02));
      const cable = new THREE.Mesh(cableGeometry, cableMaterial);
      cable.position.set(fixture.x, mountY + 0.02 + cableLength / 2, fixture.z);
      cable.scale.y = cableLength;
      scene.add(cable);
    }

    let light = null;
    if (!dynamicPointLights && fixture.hasPointLight && pointLightIndexes.has(index)) {
      light = createFixturePointLight(fixture, tubeY - 0.2, {
        rangeScale: 1.22,
        intensityScale: 3.25,
      });
      scene.add(light);
    }

    fixtures.push({
      material: tubeMaterial,
      light,
      x: fixture.x,
      z: fixture.z,
      lightY: tubeY - 0.2,
      color: fixture.color,
      range: fixture.range,
      priority: fixture.priority ?? 0,
      phase: fixture.phase,
      speed: fixture.speed,
      baseIntensity: fixture.baseIntensity,
      weak: fixture.weak,
      broken: fixture.broken,
    });
  });

  if (dynamicPointLights) {
    const lightPool = Array.from({ length: LEVEL_ONE_MAX_POINT_LIGHTS }, () => {
      const light = new THREE.PointLight(0xffffff, 0, 1, 2);
      light.visible = false;
      scene.add(light);
      return light;
    });
    let nextAssignmentAt = 0;

    fixtures.updatePointLights = (playerPosition, delta, elapsed) => {
      if (elapsed >= nextAssignmentAt) {
        const ranked = fixtures
          .map((fixture) => ({
            fixture,
            score: fixture.priority * 5 - Math.hypot(fixture.x - playerPosition.x, fixture.z - playerPosition.z),
          }))
          .sort((left, right) => right.score - left.score)
          .slice(0, lightPool.length);
        lightPool.forEach((light, index) => {
          const source = ranked[index]?.fixture ?? null;
          light.userData.source = source;
          if (!source) return;
          light.color.set(source.color);
          light.distance = source.range * 1.22;
          light.position.set(source.x, source.lightY, source.z);
          light.visible = true;
        });
        nextAssignmentAt = elapsed + 0.26;
      }
      const blend = 1 - Math.exp(-delta * 9);
      lightPool.forEach((light) => {
        const source = light.userData.source;
        const target = source ? source.pulse * source.baseIntensity * 3.25 : 0;
        light.intensity = THREE.MathUtils.lerp(light.intensity, target, blend);
        light.visible = light.intensity > 0.012;
      });
    };
  }

  return fixtures;
}






export function addLevelOneElevator(scene, position) {
  const mount = getLevelOneTargetMount(position);
  const doorMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a5350,
    emissive: 0x111615,
    emissiveIntensity: 0.16,
    roughness: 0.58,
    metalness: 0.18,
  });
  const signMaterial = new THREE.MeshStandardMaterial({
    map: createWideSignTexture("ELEVATOR", "#15231f", "#c9ffd5"),
    color: 0xffffff,
    emissive: 0x214f37,
    emissiveIntensity: 0.42,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.28), doorMaterial);
  door.position.set(mount.x, 1.24, mount.z);
  door.rotation.y = mount.rotation;
  scene.add(door);

  const seam = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, 2.16, 0.022),
    new THREE.MeshStandardMaterial({ color: 0x202624, roughness: 0.7, metalness: 0.26 }),
  );
  seam.position.set(position.x, 1.24, mount.z + (mount.rotation === 0 ? 0.014 : -0.014));
  seam.rotation.y = mount.rotation;
  scene.add(seam);

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 0.72), signMaterial);
  sign.position.set(mount.x, 2.67, mount.z);
  sign.rotation.y = mount.rotation;
  scene.add(sign);

  const padMaterial = new THREE.MeshBasicMaterial({
    color: 0xa2ffd1,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(CELL_SIZE * 0.9, CELL_SIZE * 0.9), padMaterial);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(position.x, 0.032, position.z);
  scene.add(pad);

  const glow = new THREE.PointLight(0x94ffc8, 0.65, 7.2, 2.25);
  glow.position.set(position.x, 1.55, position.z);
  scene.add(glow);
}

export function addLevelOnePipes(scene) {
  const pipeMaterial = new THREE.MeshStandardMaterial({
    // A light galvanized gray-green keeps the pipe visible in the fixture-only
    // parts of Level 1 without adding an invisible fill light.
    color: 0x9ab7aa,
    emissive: 0x386653,
    emissiveIntensity: 0.48,
    roughness: 0.44,
    metalness: 0.54,
  });
  const pipeGeometry = new THREE.CylinderGeometry(0.125, 0.125, 1, 16);
  const pipes = [
    { col: 9, row: 4, axis: "x" },
    { col: 18, row: 10, axis: "z" },
    { col: 27, row: 20, axis: "x" },
    { col: 6, row: 18, axis: "z" },
  ];

  pipes.forEach((pipe) => {
    const axisIsX = pipe.axis === "x";
    const delta = axisIsX ? { col: 1, row: 0 } : { col: 0, row: 1 };
    let start = { col: pipe.col, row: pipe.row };
    let end = { col: pipe.col, row: pipe.row };

    while (isLevelOneOpenCell(start.col - delta.col, start.row - delta.row)) {
      start = { col: start.col - delta.col, row: start.row - delta.row };
    }
    while (isLevelOneOpenCell(end.col + delta.col, end.row + delta.row)) {
      end = { col: end.col + delta.col, row: end.row + delta.row };
    }

    const startCenter = levelOneCellCenter(start.col, start.row);
    const endCenter = levelOneCellCenter(end.col, end.row);
    const innerWallOffset = CELL_SIZE / 2 - WALL_THICKNESS / 2;
    const startEdge = (axisIsX ? startCenter.x : startCenter.z) - innerWallOffset;
    const endEdge = (axisIsX ? endCenter.x : endCenter.z) + innerWallOffset;
    const mesh = new THREE.Mesh(pipeGeometry, pipeMaterial);
    mesh.scale.y = endEdge - startEdge;
    mesh.position.set(
      axisIsX ? (startEdge + endEdge) / 2 : startCenter.x,
      CEILING_Y - 0.42,
      axisIsX ? startCenter.z : (startEdge + endEdge) / 2,
    );
    if (axisIsX) mesh.rotation.z = Math.PI / 2;
    else mesh.rotation.x = Math.PI / 2;
    scene.add(mesh);
  });
}

// Storage props share one procedural material kit per scene: the textures are
// expensive to draw, and the scene-scoped cache keeps them out of the way of
// the level's own disposal pass.
function getLevelOneStorageKit(scene) {
  if (!scene.userData.levelOneStorageKit) {
    scene.userData.levelOneStorageKit = createLevelOneStorageAssetKit();
  }
  return scene.userData.levelOneStorageKit;
}

// Colliders follow the visible silhouette: the model's local bounds are
// rotated onto the instance, so nothing is blocked beyond the boards. The
// footprint is returned without a top, letting each caller decide whether the
// prop is a platform (crates) or a solid obstacle (shelving bays).
function footprintCollider(prototype, positionX, positionZ, rotation) {
  const bounds = new THREE.Box3().setFromObject(prototype);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const corners = [
    [bounds.min.x, bounds.min.z],
    [bounds.max.x, bounds.min.z],
    [bounds.max.x, bounds.max.z],
    [bounds.min.x, bounds.max.z],
  ].map(([x, z]) => [positionX + x * cos + z * sin, positionZ - x * sin + z * cos]);
  return {
    footprint: {
      minX: Math.min(...corners.map(([x]) => x)),
      maxX: Math.max(...corners.map(([x]) => x)),
      minZ: Math.min(...corners.map(([, z]) => z)),
      maxZ: Math.max(...corners.map(([, z]) => z)),
    },
    topY: bounds.max.y,
  };
}

export function addLevelOneCrates(scene) {
  const kit = getLevelOneStorageKit(scene);
  const prototypes = [
    buildDetailedSupplyCrate({ materials: kit.materials, tone: "light", braced: false, stencil: "meg", seed: 0x11a3 }),
    buildDetailedSupplyCrate({ materials: kit.materials, tone: "dark", braced: true, stencil: "rations", seed: 0x2b57 }),
    buildDetailedSupplyCrate({ materials: kit.materials, tone: "light", braced: true, stencil: "rations", seed: 0x43c9 }),
  ];
  prototypes.forEach((prototype) => {
    prototype.name = "level-one-crate";
    prototype.updateMatrixWorld(true);
  });

  const colliders = [];
  const crates = [
    { col: 12, row: 8, x: -0.72, z: -0.5, rot: 0.18, variant: 0 },
    { col: 14, row: 8, x: 0.45, z: 0.45, rot: -0.12, variant: 1 },
    { col: 16, row: 10, x: -0.3, z: 0.65, rot: 0.08, variant: 2 },
    { col: 25, row: 18, x: -0.54, z: -0.52, rot: 0.2, variant: 1 },
    { col: 27, row: 19, x: 0.58, z: 0.1, rot: -0.26, variant: 0 },
    // Cell (29, 18) also holds a supply shelf, which swallowed 84% of this
    // crate's footprint (1.23 m^3 of shared volume). One cell west is free and
    // still inside the same supply zone.
    { col: 28, row: 18, x: -0.2, z: 0.4, rot: 0.08, variant: 2 },
  ];

  crates.forEach((crate) => {
    const center = levelOneCellCenter(crate.col, crate.row);
    const prototype = prototypes[crate.variant];
    const mesh = prototype.clone();
    mesh.name = "level-one-crate";
    mesh.position.set(center.x + crate.x, 0, center.z + crate.z);
    mesh.rotation.y = crate.rot;
    scene.add(mesh);

    const { footprint, topY } = footprintCollider(prototype, mesh.position.x, mesh.position.z, crate.rot);
    const collider = { ...footprint, topY };
    mesh.userData.collider = collider;
    colliders.push(collider);
  });

  return colliders;
}

function circleIntersectsAabb(x, z, radius, bounds) {
  const closestX = Math.max(bounds.minX, Math.min(x, bounds.maxX));
  const closestZ = Math.max(bounds.minZ, Math.min(z, bounds.maxZ));
  return (x - closestX) ** 2 + (z - closestZ) ** 2 < radius ** 2;
}

export function addLevelOnePuddles(scene) {
  const puddleMaterial = new THREE.MeshBasicMaterial({
    color: 0x101816,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const puddles = [
    { col: 7, row: 18, width: 5.4, height: 2.1, rot: -0.18 },
    { col: 20, row: 12, width: 4.5, height: 1.7, rot: 0.14 },
    { col: 29, row: 9, width: 3.9, height: 1.35, rot: -0.06 },
  ];

  puddles.forEach((puddle) => {
    const center = levelOneCellCenter(puddle.col, puddle.row);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(puddle.width, puddle.height), puddleMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = puddle.rot;
    mesh.position.set(center.x, 0.026, center.z);
    scene.add(mesh);
  });
}

export function addLevelOneCorridorDetails(scene) {
  const colliders = [];
  const doorMaterial = new THREE.MeshStandardMaterial({
    color: 0x364047,
    emissive: 0x11191d,
    emissiveIntensity: 0.18,
    roughness: 0.7,
    metalness: 0.22,
  });
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0xb7c1c3,
    emissive: 0x35454a,
    emissiveIntensity: 0.16,
    roughness: 0.82,
    metalness: 0.1,
  });
  const benchMaterial = new THREE.MeshStandardMaterial({
    color: 0x677178,
    emissive: 0x20292d,
    emissiveIntensity: 0.12,
    roughness: 0.86,
    metalness: 0.18,
  });
  const doorGeometry = new THREE.BoxGeometry(2.18, 2.26, 0.07);
  const frameGeometry = new THREE.BoxGeometry(2.46, 2.54, 0.08);

  const serviceDoors = [
    { col: 6, row: 7, side: "north", label: "STORAGE" },
    { col: 6, row: 13, side: "south", label: "UTILITY" },
  ];
  serviceDoors.forEach((entry) => {
    const center = levelOneCellCenter(entry.col, entry.row);
    const isNorthSouth = entry.side === "north" || entry.side === "south";
    const direction = entry.side === "north" || entry.side === "west" ? -1 : 1;
    const position = {
      x: center.x + (isNorthSouth ? 0 : direction * (CELL_SIZE / 2 + 0.02)),
      z: center.z + (isNorthSouth ? direction * (CELL_SIZE / 2 + 0.02) : 0),
      rotation: isNorthSouth ? (entry.side === "north" ? 0 : Math.PI) : entry.side === "west" ? Math.PI / 2 : -Math.PI / 2,
    };
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.position.set(position.x, 1.28, position.z);
    frame.rotation.y = position.rotation;
    scene.add(frame);

    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(position.x, 1.18, position.z + (isNorthSouth ? -direction * 0.045 : 0));
    door.rotation.y = position.rotation;
    scene.add(door);

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.52, 0.3),
      new THREE.MeshStandardMaterial({
        map: createWideSignTexture(entry.label, "#223139", "#e0f4ff"),
        color: 0xffffff,
        emissive: 0x4e7688,
        emissiveIntensity: 0.32,
        roughness: 0.56,
        side: THREE.DoubleSide,
      }),
    );
    sign.position.set(position.x, 2.55, position.z + (isNorthSouth ? -direction * 0.055 : 0));
    sign.rotation.y = position.rotation;
    scene.add(sign);
  });

  const workbenches = [
    { col: 5, row: 8, rotation: Math.PI / 2 },
    { col: 7, row: 12, rotation: 0 },
  ];
  workbenches.forEach((entry) => {
    const center = levelOneCellCenter(entry.col, entry.row);
    const group = new THREE.Group();
    group.name = "level-one-workbench-table";
    group.position.set(center.x, 0, center.z);
    group.rotation.y = entry.rotation;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.13, 0.78), benchMaterial);
    top.position.y = 0.91;
    group.add(top);
    const lowerShelf = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.07, 0.62), benchMaterial);
    lowerShelf.position.y = 0.28;
    group.add(lowerShelf);
    for (const x of [-0.82, 0.82]) {
      for (const z of [-0.3, 0.3]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.88, 0.1), benchMaterial);
        leg.position.set(x, 0.44, z);
        group.add(leg);
      }
    }
    for (let drawerIndex = -1; drawerIndex <= 1; drawerIndex += 1) {
      const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.2, 0.06), frameMaterial);
      drawer.position.set(drawerIndex * 0.53, 0.64, 0.4);
      group.add(drawer);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.04), doorMaterial);
      handle.position.set(drawerIndex * 0.53, 0.64, 0.45);
      group.add(handle);
    }
    const toolbox = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.24, 0.34), doorMaterial);
    toolbox.position.set(-0.42, 1.1, 0.02);
    group.add(toolbox);
    const vice = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.2), frameMaterial);
    vice.position.set(0.58, 1.08, -0.08);
    group.add(vice);
    scene.add(group);

    const rotated = Math.abs(Math.sin(entry.rotation)) > 0.5;
    const halfX = (rotated ? 0.78 : 1.9) / 2;
    const halfZ = (rotated ? 1.9 : 0.78) / 2;
    colliders.push({
      minX: center.x - halfX,
      maxX: center.x + halfX,
      minZ: center.z - halfZ,
      maxZ: center.z + halfZ,
      topY: 0.98,
    });

    // The toolbox and the vice stand on the bench top, so the tabletop collider
    // alone lets a player stand with their shins inside them. Each tool gets its
    // own upper layer rather than one slab across the whole bench, so the free
    // ends of the top stay walkable.
    const cos = Math.cos(entry.rotation);
    const sin = Math.sin(entry.rotation);
    const toWorld = (tool) => {
      const corners = [
        [tool.minX, tool.minZ],
        [tool.maxX, tool.minZ],
        [tool.minX, tool.maxZ],
        [tool.maxX, tool.maxZ],
      ].map(([x, z]) => ({ x: center.x + x * cos + z * sin, z: center.z - x * sin + z * cos }));
      return {
        minX: Math.min(...corners.map((corner) => corner.x)),
        maxX: Math.max(...corners.map((corner) => corner.x)),
        minZ: Math.min(...corners.map((corner) => corner.z)),
        maxZ: Math.max(...corners.map((corner) => corner.z)),
        topY: tool.topY,
      };
    };
    for (const tool of [toolbox, vice]) {
      const { width, depth, height } = tool.geometry.parameters;
      colliders.push(toWorld({
        minX: tool.position.x - width / 2,
        maxX: tool.position.x + width / 2,
        minZ: tool.position.z - depth / 2,
        maxZ: tool.position.z + depth / 2,
        topY: tool.position.y + height / 2,
      }));
    }
  });

  return colliders;
}


export function addLevelOneWallSigns(scene) {
  const signs = [
    { col: 12, row: 7, text: "M.E.G. BASE", bg: "#101f1a", fg: "#c9ffd5" },
    { col: 11, row: 10, text: "CORRIDORS", bg: "#28302d", fg: "#dde5d8" },
    { col: 25, row: 17, text: "SUPPLY", bg: "#263022", fg: "#e9ffbd" },
    { col: 30, row: 4, text: "ELEVATOR AHEAD", bg: "#101f1a", fg: "#9dffbe" },
    { col: 7, row: 18, text: "NO ENTRY", bg: "#221814", fg: "#ffd1a1" },
  ];

  signs.forEach((sign) => {
    const center = levelOneCellCenter(sign.col, sign.row);
    const mount = getLevelOneTargetMount(center);
    const material = new THREE.MeshStandardMaterial({
      map: createWideSignTexture(sign.text, sign.bg, sign.fg),
      color: 0xffffff,
      emissive: 0x1b3328,
      emissiveIntensity: 0.24,
      roughness: 0.55,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.54), material);
    mesh.position.set(mount.x, 1.74, mount.z);
    mesh.rotation.y = mount.rotation;
    scene.add(mesh);
  });
}

export function addLevelOneSupplyShelves(scene) {
  const kit = getLevelOneStorageKit(scene);
  const prototypes = [
    buildDetailedSupplyShelf({ materials: kit.materials, seed: 0x31d5, stocked: "cartons", labels: "supply" }),
    buildDetailedSupplyShelf({ materials: kit.materials, seed: 0x5f27, stocked: "crate", labels: "rations" }),
  ];
  prototypes.forEach((prototype) => {
    prototype.name = "level-one-supply-shelf";
    prototype.updateMatrixWorld(true);
  });

  const colliders = [];
  const shelves = [
    { col: 12, row: 9, rot: 0.04, variant: 0 },
    { col: 15, row: 8, rot: -0.05, variant: 1 },
    { col: 26, row: 18, rot: Math.PI / 2 + 0.06, variant: 0 },
    { col: 29, row: 18, rot: Math.PI / 2 - 0.04, variant: 1 },
  ];

  shelves.forEach((shelf) => {
    const center = levelOneCellCenter(shelf.col, shelf.row);
    const prototype = prototypes[shelf.variant];
    const group = prototype.clone();
    group.name = "level-one-supply-shelf";
    group.position.set(center.x, 0, center.z);
    group.rotation.y = shelf.rot;
    scene.add(group);

    // Shelving bays stay solid columns: their open bays are not a surface the
    // player is meant to stand on, so no topY is published for them.
    const { footprint } = footprintCollider(prototype, center.x, center.z, shelf.rot);
    const collider = { ...footprint };
    group.userData.collider = collider;
    colliders.push(collider);
  });

  return colliders;
}

export function collectLevelOneTransforms({ openings = [] } = {}) {
  const northSouth = [];
  const eastWest = [];
  const corridorNorthSouth = [];
  const corridorEastWest = [];
  const fixtureCandidates = [];
  const hasOpeningAt = (x, z) => openings.some(
    (opening) => Math.abs(opening.x - x) < 0.01 && Math.abs(opening.z - z) < 0.01,
  );

  for (let row = 0; row < LEVEL_ONE_ROWS; row += 1) {
    for (let col = 0; col < LEVEL_ONE_COLS; col += 1) {
      if (!isLevelOneOpenCell(col, row)) continue;

      const center = levelOneCellCenter(col, row);
      const isDarkZone = isInAnyLevelOneZone(col, row, LEVEL_ONE_DARK_ZONES);
      const isSupplyZone = isInAnyLevelOneZone(col, row, LEVEL_ONE_SUPPLY_ZONES);
      const isCorridor = isLevelOneCorridorCell(col, row);
      const openNeighborCount = countLevelOneOpenNeighbors(col, row);
      const isOpenHall = openNeighborCount >= 3;

      if (!isLevelOneOpenCell(col, row - 1) && !hasOpeningAt(center.x, center.z - CELL_SIZE / 2)) {
        (isCorridor ? corridorNorthSouth : northSouth).push(
          new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z - CELL_SIZE / 2),
        );
      }
      if (!isLevelOneOpenCell(col, row + 1) && !hasOpeningAt(center.x, center.z + CELL_SIZE / 2)) {
        (isCorridor ? corridorNorthSouth : northSouth).push(
          new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z + CELL_SIZE / 2),
        );
      }
      if (!isLevelOneOpenCell(col - 1, row) && !hasOpeningAt(center.x - CELL_SIZE / 2, center.z)) {
        (isCorridor ? corridorEastWest : eastWest).push(
          new THREE.Vector3(center.x - CELL_SIZE / 2, WALL_HEIGHT / 2, center.z),
        );
      }
      if (!isLevelOneOpenCell(col + 1, row) && !hasOpeningAt(center.x + CELL_SIZE / 2, center.z)) {
        (isCorridor ? corridorEastWest : eastWest).push(
          new THREE.Vector3(center.x + CELL_SIZE / 2, WALL_HEIGHT / 2, center.z),
        );
      }

      // Fluorescent fixtures form an intentionally regular warehouse grid.
      // Each candidate below creates both the visible tube and its light.
      const fixtureGrid = col % 6 === 3 && row % 4 === 2;
      const corridorGrid = col % 8 === 4 && row % 5 === 2;
      if (!isCorridor && ((fixtureGrid && !isDarkZone) || (corridorGrid && isOpenHall))) {
        fixtureCandidates.push({
          x: center.x,
          z: center.z,
          rotation: 0,
          phase: col * 0.74 + row * 1.31,
          speed: isDarkZone ? 6.2 : 3.1 + ((col + row) % 5) * 0.34,
          weak: isDarkZone ? 0.28 : isSupplyZone ? 0.06 : 0.14,
          broken: isDarkZone || (col + row) % 13 === 0,
          range: isSupplyZone ? 16.2 : isOpenHall ? 14.1 : 11.7,
          baseIntensity: isSupplyZone ? 1.72 : isOpenHall ? 1.28 : 1.02,
          panelWidth: isSupplyZone ? 2.95 : 2.35,
          color: isSupplyZone ? 0xeef7dc : 0xdce7d6,
          hasPointLight: true,
          priority: (isSupplyZone ? 3 : 0) + (isOpenHall ? 2 : 0) - (isDarkZone ? 2 : 0),
        });
      }
    }
  }

  const fixturePositions = [];
  const spawnCenter = levelOneCellCenter(LEVEL_ONE_START_CELL.col, LEVEL_ONE_START_CELL.row);
  const targetCenter = levelOneCellCenter(LEVEL_ONE_TARGET_CELL.col, LEVEL_ONE_TARGET_CELL.row);
  fixtureCandidates.push(
    {
      x: spawnCenter.x,
      z: spawnCenter.z,
      rotation: 0,
      phase: 0.4,
      speed: 2.6,
      weak: 0.03,
      broken: false,
      range: 15.8,
      baseIntensity: 1.72,
      panelWidth: 2.7,
      color: 0xeef7df,
      hasPointLight: true,
      priority: 8,
    },
    {
      x: targetCenter.x,
      z: targetCenter.z,
      rotation: 0,
      phase: 1.7,
      speed: 2.9,
      weak: 0.04,
      broken: false,
      range: 15.2,
      baseIntensity: 1.66,
      panelWidth: 2.8,
      color: 0xdff5dc,
      hasPointLight: true,
      priority: 7,
    },
  );

  LEVEL_ONE_CORRIDOR_FIXTURES.forEach((fixture, index) => {
    const center = levelOneCellCenter(fixture.col, fixture.row);
    fixtureCandidates.push({
      x: center.x,
      z: center.z,
      rotation: fixture.rotation,
      phase: 2.2 + index * 1.37,
      speed: 2.1 + index * 0.22,
      weak: index === 1 ? 0.08 : 0.03,
      broken: false,
      range: 10.8,
      baseIntensity: 1.36,
      panelWidth: 2.25,
      color: 0xe4efff,
      hasPointLight: true,
      priority: 6 - index * 0.1,
      suspended: true,
      drop: 0.52,
    });
  });

  fixtureCandidates
    .sort((a, b) => b.priority - a.priority)
    .forEach((candidate) => {
      const tooClose = fixturePositions.some(
        (fixture) =>
          Math.hypot(fixture.x - candidate.x, fixture.z - candidate.z) <
          LEVEL_ONE_MIN_FIXTURE_DISTANCE,
      );
      if (!tooClose) fixturePositions.push(candidate);
    });

  return { northSouth, eastWest, corridorNorthSouth, corridorEastWest, fixturePositions };
}
