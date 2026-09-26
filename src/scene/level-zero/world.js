import * as THREE from "three";
import {
  CELL_SIZE,
  CEILING_Y,
  WALL_HEIGHT,
  WALL_THICKNESS,
} from "../constants.js";
import { buildDetailedTable, buildPaperStack, createTableAssetKit } from "./table-model.js";
import { isInAnyZone } from "../common/layout.js";
import { wallSegmentTransform } from "../common/wall-corners.js";
import { isLowQuality } from "../common/materials.js";
import {
  isOpenCell,
  cellCenter,
  countOpenNeighbors,
  ORIGIN_X,
  ORIGIN_Z,
  START_CELL,
  EXIT_CELL,
  COLS,
  ROWS,
} from "./layout.js";

export const BRIGHT_ZONES = [
  { col: 19, row: 1, width: 10, height: 7 },
  { col: 11, row: 3, width: 7, height: 5 },
  { col: 10, row: 10, width: 9, height: 6 },
];

export const DARK_ZONES = [
  { col: 1, row: 20, width: 6, height: 5 },
  { col: 22, row: 12, width: 6, height: 4 },
  { col: 3, row: 8, width: 5, height: 5 },
  { col: 13, row: 18, width: 12, height: 5 },
  { col: 2, row: 13, width: 4, height: 3 },
  { col: 24, row: 20, width: 5, height: 4 },
];





// A larger live pool keeps the transition between the nearest fixtures from
// reading as "lights switching off" as the player walks. Low quality keeps the
// smaller pool because every light costs a shader loop iteration per fragment.
const ACTIVE_FIXTURE_LIGHTS = isLowQuality() ? 8 : 12;
// The pool can only ever cover a handful of fixtures, so a lamp entering or
// leaving it used to switch its own wash on and off in one frame ("the far lamp
// went dark, walk closer and it lights up"). Pooled lights now fade out with the
// player's distance and hand the area over to the baked light field — which
// already paints every fixture's pool — so nothing changes in a single step.
const LEVEL_ZERO_POOL_FADE_NEAR = CELL_SIZE * 5;    // 20 m: full strength
const LEVEL_ZERO_POOL_FADE_FAR = CELL_SIZE * 9;     // 36 m: fully handed over
const POOL_SWAP_SLACK = 4;
// 1 while the lamp is close, 0 once it is far enough that the baked field can
// own its pool on its own.
function poolFade(distance) {
  return 1 - THREE.MathUtils.smoothstep(distance, LEVEL_ZERO_POOL_FADE_NEAR, LEVEL_ZERO_POOL_FADE_FAR);
}
// Fixture density is driven by clearances, not by parity: every open cell may
// host a light, but a candidate is only accepted when it clears every fixture
// already placed by the zone-dependent distance below. Rooms, corridor lengths
// and zone changes therefore cannot stack lights on top of each other.
const LEVEL_ZERO_FIXTURE_SPACING = CELL_SIZE * 3.5;
const LEVEL_ZERO_BRIGHT_FIXTURE_SPACING = CELL_SIZE * 2.5;
const LEVEL_ZERO_DARK_FIXTURE_SPACING = CELL_SIZE * 5;
// L0's broad tables are intentional traversal props. Keep their collision on
// the ground, but release the side early enough during a normal jump that the
// player can clear the lip and land on the tabletop.
const LEVEL_ZERO_TABLE_JUMP_EDGE_CLEARANCE = 0.42;
export const LEVEL_ZERO_ROOM_TABLE_CELLS = Object.freeze([
  { col: 4, row: 3, rotation: 0 },
  { col: 14, row: 5, rotation: Math.PI / 2 },
  { col: 16, row: 13, rotation: 0 },
  { col: 21, row: 21, rotation: Math.PI / 2 },
  { col: 25, row: 4, rotation: 0 },
  { col: 33, row: 19, rotation: Math.PI / 2 },
  { col: 41, row: 12, rotation: 0 },
  { col: 33, row: 33, rotation: Math.PI / 2 },
  { col: 20, row: 30, rotation: 0 },
  { col: 7, row: 32, rotation: Math.PI / 2 },
]);

export const LEVEL_ZERO_ROOM_TABLE_COUNT = LEVEL_ZERO_ROOM_TABLE_CELLS.length;

export function addRoomTables(scene, cellCenter) {
  const kit = createTableAssetKit({ woodColor: 0x4b3a28, metalColor: 0x3b3b34 });
  const tablePrototype = buildDetailedTable(kit, {
    width: 2.28,
    depth: 1.18,
    topThickness: 0.12,
    topCenterY: 0.82,
    legX: 0.9,
    legZ: 0.43,
  });
  const colliders = [];

  LEVEL_ZERO_ROOM_TABLE_CELLS.forEach((table, index) => {
    const center = cellCenter(table.col, table.row);
    const group = index === 0 ? tablePrototype : tablePrototype.clone();
    group.name = `level-zero-room-table-${index + 1}`;
    group.position.set(center.x, 0, center.z);
    group.rotation.y = table.rotation;

    const paperStack = buildPaperStack(kit, { width: 0.5, depth: 0.36, seed: 1013 + index * 97 });
    paperStack.position.set(index % 2 === 0 ? -0.34 : 0.34, 0.8815, index % 3 === 0 ? -0.14 : 0.14);
    paperStack.rotation.y = index * 0.37;
    group.add(paperStack);
    scene.add(group);

    const halfX = table.rotation % Math.PI === 0 ? 1.14 : 0.59;
    const halfZ = table.rotation % Math.PI === 0 ? 0.59 : 1.14;
    colliders.push({
      minX: center.x - halfX,
      maxX: center.x + halfX,
      minZ: center.z - halfZ,
      maxZ: center.z + halfZ,
      topY: 0.88,
      sideClearance: LEVEL_ZERO_TABLE_JUMP_EDGE_CLEARANCE,
    });
  });

  return colliders;
}

function createFixtureHaloTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255, 250, 221, 0.72)");
  gradient.addColorStop(0.28, "rgba(255, 238, 177, 0.3)");
  gradient.addColorStop(0.68, "rgba(236, 205, 125, 0.075)");
  gradient.addColorStop(1, "rgba(214, 178, 92, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function createFixturePanelTexture() {
  // A bare white box reads as a plastic sticker. Real luminaires are brightest
  // along the middle of the diffuser and fall off towards the end caps, so the
  // panel gets a soft longitudinal gradient and keeps its headroom out of
  // clipping, letting bloom paint the glow instead of the material.
  const width = 128;
  const height = 16;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, "rgba(226, 214, 186, 1)");
  gradient.addColorStop(0.18, "rgba(248, 240, 214, 1)");
  gradient.addColorStop(0.5, "rgba(252, 246, 224, 1)");
  gradient.addColorStop(0.82, "rgba(248, 240, 214, 1)");
  gradient.addColorStop(1, "rgba(226, 214, 186, 1)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

export function createLights(scene, fixturePositions) {
  const fixtures = [];
  const activeLights = [];
  const activeLightCount = Math.min(ACTIVE_FIXTURE_LIGHTS, fixturePositions.length);
  let refreshTimer = 0;
  let lastLightAnchor = null;
  const panelGeometry = new THREE.BoxGeometry(1, 0.035, 1);
  const trimGeometry = new THREE.BoxGeometry(1, 0.03, 1);
  const haloGeometry = new THREE.PlaneGeometry(1, 1);
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x9d9258,
    emissive: 0x4a4020,
    emissiveIntensity: 0.12,
    roughness: 0.88,
    metalness: 0.02,
  });
  const panelMaterial = new THREE.MeshBasicMaterial({
    map: createFixturePanelTexture(),
    color: 0xf2e8cc,
    toneMapped: false,
  });
  const haloMaterial = new THREE.MeshBasicMaterial({
    map: createFixtureHaloTexture(),
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const trims = new THREE.InstancedMesh(trimGeometry, trimMaterial, fixturePositions.length);
  const panels = new THREE.InstancedMesh(panelGeometry, panelMaterial, fixturePositions.length);
  const halos = new THREE.InstancedMesh(haloGeometry, haloMaterial, fixturePositions.length);
  trims.name = "level-zero-fixture-trims";
  panels.name = "level-zero-fixture-panels";
  halos.name = "level-zero-fixture-halos";

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const fixtureQuaternion = new THREE.Quaternion();
  const fixtureEuler = new THREE.Euler(0, 0, 0);
  const haloBaseQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const haloQuaternion = new THREE.Quaternion();
  const haloColor = new THREE.Color();

  fixturePositions.forEach((fixture, index) => {
    // Square diffusers. The baked light pool is a radial falloff that cannot be
    // shaped into a strip at the field's resolution, so the luminaire is sized
    // to cover the pool instead of promising a shape the light does not have.
    const panelSize = (fixture.panelLength ?? 2.1) * 0.72;
    fixtureEuler.set(0, fixture.orientation ?? 0, 0);
    fixtureQuaternion.setFromEuler(fixtureEuler);

    position.set(fixture.x, CEILING_Y - 0.055, fixture.z);
    scale.set(panelSize + 0.2, 1, panelSize + 0.2);
    matrix.compose(position, fixtureQuaternion, scale);
    trims.setMatrixAt(index, matrix);

    position.y = CEILING_Y - 0.09;
    scale.set(panelSize, 1, panelSize);
    matrix.compose(position, fixtureQuaternion, scale);
    panels.setMatrixAt(index, matrix);

    position.y = CEILING_Y - 0.125;
    haloQuaternion.copy(fixtureQuaternion).multiply(haloBaseQuaternion);
    scale.set(panelSize * 1.25, panelSize * 1.25, 1);
    matrix.compose(position, haloQuaternion, scale);
    halos.setMatrixAt(index, matrix);

    halos.setColorAt(index, haloColor.setHex(fixture.color).multiplyScalar(0.42 + fixture.baseIntensity * 0.18));
    fixtures.push({
      index,
      x: fixture.x,
      z: fixture.z,
      color: fixture.color,
      range: fixture.range,
      phase: fixture.phase,
      speed: fixture.speed,
      baseIntensity: fixture.baseIntensity,
      weak: fixture.weak,
      pulse: fixture.baseIntensity,
    });
  });
  trims.instanceMatrix.needsUpdate = true;
  panels.instanceMatrix.needsUpdate = true;
  halos.instanceMatrix.needsUpdate = true;
  halos.instanceColor?.setUsage(THREE.DynamicDrawUsage);
  scene.add(trims, panels, halos);

  // Keep the pool lights visible at zero intensity from the first frame.
  // Toggling `visible` changes the scene's light count, which makes three.js
  // recompile every lit shader program mid-game (the post-stand-up stall).
  for (let index = 0; index < activeLightCount; index += 1) {
    // distance 0 = no artificial cutoff: the inverse-square decay alone fades
    // the fixture out, so the floor never shows a ring where light stops.
    const light = new THREE.PointLight(0xfff9df, 0, 0, 2);
    scene.add(light);
    activeLights.push(light);
  }

  function refreshActiveLights(playerPosition) {
    const ranked = fixtures
      .map((fixture) => ({
        fixture,
        distance: Math.hypot(fixture.x - playerPosition.x, fixture.z - playerPosition.z),
      }))
      .sort((first, second) => first.distance - second.distance);

    // Hysteresis: keep whatever is already assigned while it is still ranked
    // near the front, so walking along the pool boundary cannot make two lamps
    // trade places every refresh.
    const previous = new Set(
      activeLights.map((light) => light.userData.fixture).filter(Boolean),
    );
    const keepWindow = activeLightCount + POOL_SWAP_SLACK;
    const chosen = ranked
      .slice(0, keepWindow)
      .filter((entry) => previous.has(entry.fixture))
      .map((entry) => entry);
    for (const entry of ranked) {
      if (chosen.length >= activeLightCount) break;
      // Entries that have already faded to nothing never take up a slot.
      if (poolFade(entry.distance) <= 0.001) continue;
      if (!chosen.includes(entry)) chosen.push(entry);
    }

    activeLights.forEach((light, index) => {
      const entry = chosen[index] ?? null;
      const fixture = entry?.fixture ?? null;
      light.userData.fixture = fixture;
      light.userData.poolDistance = entry?.distance ?? Infinity;
      if (!fixture) {
        light.intensity = 0;
        return;
      }
      light.color.setHex(fixture.color);
      // Hang the pool light ~0.75 m below the diffuser. At 0.24 m the inverse
      // square term set the ceiling ring around each tube on fire (1/0.06),
      // which is why the old build needed such a heavy ambient wash.
      light.position.set(fixture.x, CEILING_Y - 0.75, fixture.z);
    });
  }

  function updateFixtureVisuals() {
    fixtures.forEach((fixture) => {
      const haloBrightness = 0.14 + fixture.pulse * fixture.baseIntensity * 0.2;
      halos.setColorAt(fixture.index, haloColor.setHex(fixture.color).multiplyScalar(haloBrightness));
    });
    if (halos.instanceColor) halos.instanceColor.needsUpdate = true;
  }

  function updatePointLights(delta, playerPosition) {
    refreshTimer += delta;
    const movedSinceRefresh =
      !lastLightAnchor ||
      Math.hypot(playerPosition.x - lastLightAnchor.x, playerPosition.z - lastLightAnchor.z) > 1.15;
    if (movedSinceRefresh || refreshTimer >= 0.22) {
      refreshActiveLights(playerPosition);
      lastLightAnchor = { x: playerPosition.x, z: playerPosition.z };
      refreshTimer = 0;
    }

    activeLights.forEach((light) => {
      const fixture = light.userData.fixture;
      if (!fixture) return;
      // The fixture, not a global ambient term, is what lights the room now:
      // the hemisphere fill was cut to ~half, so the live pool carries the
      // brightness and the falloff around each fixture becomes visible. The
      // pool weight keeps that from ending in a step at the pool boundary.
      light.intensity = fixture.pulse * fixture.baseIntensity * 3 * poolFade(light.userData.poolDistance ?? 0);
    });
  }

  return { fixtures, updateFixtureVisuals, updatePointLights };
}

export function collectWallTransforms() {
  const northSouth = [];
  const eastWest = [];
  const fixtureCandidates = [];

  const wallSegment = (x, z, axis, extendNegative, extendPositive) =>
    wallSegmentTransform(x, z, axis, extendNegative, extendPositive);

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (!isOpenCell(col, row)) continue;

      const center = cellCenter(col, row);
      const isBrightZone = isInAnyZone(col, row, BRIGHT_ZONES);
      const isDarkZone = isInAnyZone(col, row, DARK_ZONES);
      const openNeighborCount = countOpenNeighbors(col, row);
      const isSpacious = openNeighborCount >= 3;
      if (!isOpenCell(col, row - 1)) {
        northSouth.push(wallSegment(
          center.x,
          center.z - CELL_SIZE / 2,
          "x",
          isOpenCell(col - 1, row) && isOpenCell(col - 1, row - 1),
          isOpenCell(col + 1, row) && isOpenCell(col + 1, row - 1),
        ));
      }
      if (!isOpenCell(col, row + 1)) {
        northSouth.push(wallSegment(
          center.x,
          center.z + CELL_SIZE / 2,
          "x",
          isOpenCell(col - 1, row) && isOpenCell(col - 1, row + 1),
          isOpenCell(col + 1, row) && isOpenCell(col + 1, row + 1),
        ));
      }
      if (!isOpenCell(col - 1, row)) {
        eastWest.push(wallSegment(
          center.x - CELL_SIZE / 2,
          center.z,
          "z",
          isOpenCell(col, row - 1) && isOpenCell(col - 1, row - 1),
          isOpenCell(col, row + 1) && isOpenCell(col - 1, row + 1),
        ));
      }
      if (!isOpenCell(col + 1, row)) {
        eastWest.push(wallSegment(
          center.x + CELL_SIZE / 2,
          center.z,
          "z",
          isOpenCell(col, row - 1) && isOpenCell(col + 1, row - 1),
          isOpenCell(col, row + 1) && isOpenCell(col + 1, row + 1),
        ));
      }

      const horizontalCorridor = isOpenCell(col - 1, row) && isOpenCell(col + 1, row);
      const verticalCorridor = isOpenCell(col, row - 1) && isOpenCell(col, row + 1);
      const corridorCenter = !isSpacious && (horizontalCorridor || verticalCorridor);
      // Lights are placed by clearance (see LEVEL_ZERO_FIXTURE_SPACING): a room
      // cell, a corridor centre line or a junction is only a candidate, and the
      // rejection pass below keeps at least one fixture spacing between them.
      // Dark-zone candidates additionally sit on a 5x5 block checkerboard so
      // those pockets stay dim under every spacing value.
      const verticalOnly = verticalCorridor && !horizontalCorridor;
      const darkFixtureBlock = (Math.floor(col / 5) + Math.floor(row / 5)) % 2 === 0;
      const ambientRoom = isSpacious || corridorCenter;
      if (ambientRoom && (!isDarkZone || darkFixtureBlock)) {
        fixtureCandidates.push({
          x: center.x,
          z: center.z,
          orientation: verticalOnly ? Math.PI / 2 : 0,
          spacing: isBrightZone
            ? LEVEL_ZERO_BRIGHT_FIXTURE_SPACING
            : isDarkZone ? LEVEL_ZERO_DARK_FIXTURE_SPACING : LEVEL_ZERO_FIXTURE_SPACING,
          panelLength: isBrightZone ? 2.5 : isDarkZone ? 2 : isSpacious ? 2.2 : 1.9,
          // A cheap deterministic hash keeps the accepted set from lining up in
          // scan order, which would rebuild the old rigid ceiling grid.
          order: ((col * 73856093) ^ (row * 19349663)) & 1023,
          phase: col * 0.83 + row * 1.17,
          speed: isDarkZone ? 5 + ((col * row) % 5) : 2.6 + ((col * row) % 4) * 0.45,
          weak: isDarkZone ? 0.15 : isBrightZone ? 0 : isSpacious ? 0.04 : 0.08,
          range: isBrightZone ? 16.5 : isDarkZone ? 11 : 13.5,
          baseIntensity: isBrightZone ? 1.78 : isDarkZone ? 0.95 : 1.24,
          color: isDarkZone ? 0xe7d79f : 0xfff9df,
          priority: (isBrightZone ? 4 : 0) + (isSpacious ? 2 : 0) - (isDarkZone ? 1 : 0),
        });
      }
    }
  }

  const fixturePositions = [];
  const startCenter = cellCenter(START_CELL.col, START_CELL.row);
  const exitCenter = cellCenter(EXIT_CELL.col, EXIT_CELL.row);
  // Spawn and exit keep a guaranteed light; they lead the sort so the clearance
  // pass can never reject them.
  fixtureCandidates.push(
    {
      x: startCenter.x,
      z: startCenter.z,
      orientation: 0,
      spacing: LEVEL_ZERO_FIXTURE_SPACING,
      panelLength: 2.3,
      order: -2,
      phase: 0.2,
      speed: 2.2,
      weak: 0.02,
      range: 15.5,
      baseIntensity: 1.46,
      color: 0xfff9df,
      priority: 8,
    },
    {
      x: exitCenter.x,
      z: exitCenter.z,
      orientation: 0,
      spacing: LEVEL_ZERO_FIXTURE_SPACING,
      panelLength: 2.3,
      order: -1,
      phase: 1.4,
      speed: 2.4,
      weak: 0.02,
      range: 15.2,
      baseIntensity: 1.42,
      color: 0xfff9df,
      priority: 7,
    },
  );

  fixtureCandidates
    .sort((a, b) => (b.priority - a.priority) || (a.order - b.order))
    .forEach((candidate) => {
      // The pair keeps the stricter of the two zone clearances, so a bright
      // zone can only be denser when its neighbours are bright as well.
      const tooClose = fixturePositions.some(
        (fixture) =>
          Math.hypot(fixture.x - candidate.x, fixture.z - candidate.z) <
          Math.max(candidate.spacing, fixture.spacing),
      );
      if (!tooClose) fixturePositions.push(candidate);
    });

  return { northSouth, eastWest, fixturePositions };
}
