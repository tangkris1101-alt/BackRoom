import * as THREE from "three";
import { CELL_SIZE, WALL_HEIGHT, WALL_THICKNESS } from "../constants.js";
import { createGameMaterial, isLowQuality } from "../common/materials.js";
import { createSeededRandom } from "../common/texture-utils.js";
import {
  LEVEL_TWELVE_COLS,
  LEVEL_TWELVE_ROWS,
  LEVEL_TWELVE_COPYCAT_CELL,
  LEVEL_TWELVE_STAIR_CELL,
  levelTwelveCellCenter,
} from "./layout.js";
import { createLevelTwelveWallMaps, createLevelTwelveFurnitureMaps } from "./textures.js";

function addWall(scene, material, finish, x, z, width, depth, colliders) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(width, WALL_HEIGHT, depth), material);
  wall.position.set(x, WALL_HEIGHT / 2, z);
  scene.add(wall);
  const alongX = width > depth;
  const skirting = new THREE.Mesh(
    new THREE.BoxGeometry(width + (alongX ? 0 : 0.035), 0.14, depth + (alongX ? 0.035 : 0)),
    finish.skirting,
  );
  skirting.position.set(x, 0.07, z);
  scene.add(skirting);
  const length = alongX ? width : depth;
  for (let offset = -length / 2 + 2.5; offset < length / 2 - 0.7; offset += 2.5) {
    for (const side of [-1, 1]) {
      const seam = new THREE.Mesh(
        new THREE.PlaneGeometry(0.012, WALL_HEIGHT - 0.24),
        finish.seam,
      );
      if (alongX) {
        seam.position.set(x + offset, WALL_HEIGHT / 2 + 0.06, z + side * (depth / 2 + 0.003));
        if (side < 0) seam.rotation.y = Math.PI;
      } else {
        seam.position.set(x + side * (width / 2 + 0.003), WALL_HEIGHT / 2 + 0.06, z + offset);
        seam.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      scene.add(seam);
    }
  }
  colliders.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 });
  return wall;
}

function addCoreRoom(scene, wallMaterial, wallFinish, colliders) {
  const coreCell = levelTwelveCellCenter(20, 28);
  const core = { x: coreCell.x, z: coreCell.z + CELL_SIZE / 2 };
  const width = CELL_SIZE * 3;
  const depth = CELL_SIZE * 4;
  const northZ = core.z - depth / 2;
  const southZ = core.z + depth / 2;
  const doorwayWidth = 2.2;
  const northSegmentWidth = (width - doorwayWidth) / 2;
  const northOffset = doorwayWidth / 2 + northSegmentWidth / 2;
  addWall(scene, wallMaterial, wallFinish, core.x - northOffset, northZ, northSegmentWidth, WALL_THICKNESS, colliders);
  addWall(scene, wallMaterial, wallFinish, core.x + northOffset, northZ, northSegmentWidth, WALL_THICKNESS, colliders);
  addWall(scene, wallMaterial, wallFinish, core.x, southZ, width + WALL_THICKNESS, WALL_THICKNESS, colliders);
  // Each side of the room is walled from the north/south corners inwards but
  // stops 2m short of core.z, leaving a 4m opening in the middle of both side
  // walls. That gap is deliberate and must stay: the spawn point is inside this
  // room while the original door starts locked (the progression first needs the
  // chair observation and then the copycat door, which sits outside), so the
  // side openings are the only way out. Closing them seals the player in at
  // spawn with no way to reach the copycat door, i.e. an immediate soft lock.
  for (const side of [-1, 1]) {
    addWall(scene, wallMaterial, wallFinish, core.x + side * width / 2, core.z - 5, WALL_THICKNESS, 6, colliders);
    addWall(scene, wallMaterial, wallFinish, core.x + side * width / 2, core.z + 5, WALL_THICKNESS, 6, colliders);
  }

  const wood = createGameMaterial({
    ...createLevelTwelveFurnitureMaps("original", !isLowQuality()),
    color: 0xe0d7ce,
    roughness: 0.78,
    normalScale: new THREE.Vector2(0.24, 0.24),
  });
  const table = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 1.25), wood);
  table.name = "level-twelve-original-table";
  table.position.set(core.x, 0.82, coreCell.z);
  scene.add(table);
  colliders.push({ minX: core.x - 1.3, maxX: core.x + 1.3, minZ: coreCell.z - 0.63, maxZ: coreCell.z + 0.63, topY: 0.91 });
  for (const x of [-1.05, 1.05]) for (const z of [-0.43, 0.43]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.82, 0.12), wood);
    leg.position.set(core.x + x, 0.41, coreCell.z + z);
    scene.add(leg);
  }
  const chair = new THREE.Group();
  chair.name = "level-twelve-original-chair";
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.12, 0.78), wood);
  seat.position.y = 0.48;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.05, 0.12), wood);
  back.position.set(0, 0.93, 0.34);
  chair.add(seat, back);
  chair.position.set(core.x - 2.15, 0, coreCell.z + 1.55);
  scene.add(chair);
  colliders.push({ minX: chair.position.x - 0.44, maxX: chair.position.x + 0.44, minZ: chair.position.z - 0.45, maxZ: chair.position.z + 0.45, topY: 1.45 });

  const panelMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.06, 0.72), panelMaterial);
  panel.position.set(core.x, 3.55, coreCell.z);
  scene.add(panel);
  const light = new THREE.PointLight(0xffffff, 2.1, 18, 2.2);
  light.position.set(core.x, 3.35, coreCell.z);
  scene.add(light);
  const originalDoor = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 3.05, 0.18),
    createGameMaterial({ color: 0xe9e9e5, roughness: 0.9 }),
  );
  originalDoor.name = "level-twelve-original-door";
  originalDoor.position.set(core.x, 1.525, northZ);
  scene.add(originalDoor);
  const doorCollider = {
    minX: core.x - 0.98,
    maxX: core.x + 0.98,
    minZ: northZ - 0.18,
    maxZ: northZ + 0.18,
    active: true,
  };
  colliders.push(doorCollider);
  return {
    core,
    chairPosition: { x: chair.position.x, z: chair.position.z },
    exitPosition: { x: core.x, z: northZ + 0.8 },
    originalDoor,
    doorCollider,
  };
}

function addFurnitureField(scene, count, colliders) {
  const random = createSeededRandom(1213);
  const wood = createGameMaterial({
    ...createLevelTwelveFurnitureMaps("field", !isLowQuality()),
    color: 0xc8c4be,
    roughness: 0.86,
    normalScale: new THREE.Vector2(0.22, 0.22),
  });
  const metal = createGameMaterial({ color: 0x9faaa9, roughness: 0.63, metalness: 0.32 });
  const topGeometry = new THREE.BoxGeometry(1.65, 0.16, 0.9);
  const seatGeometry = new THREE.BoxGeometry(0.68, 0.12, 0.68);
  const drawerGeometry = new THREE.BoxGeometry(0.9, 1.05, 0.72);
  const tables = new THREE.InstancedMesh(topGeometry, wood, count);
  const chairs = new THREE.InstancedMesh(seatGeometry, wood, count);
  const drawers = new THREE.InstancedMesh(drawerGeometry, metal, count);
  tables.name = "level-twelve-void-tables";
  chairs.name = "level-twelve-void-chairs";
  drawers.name = "level-twelve-void-drawers";
  const transform = new THREE.Object3D();
  const tableBounds = new THREE.Box3().setFromBufferAttribute(topGeometry.attributes.position);
  const chairBounds = new THREE.Box3().setFromBufferAttribute(seatGeometry.attributes.position);
  const drawerBounds = new THREE.Box3().setFromBufferAttribute(drawerGeometry.attributes.position);
  const instanceBounds = new THREE.Box3();
  // Instances are scattered and sunk by design, so clamp each collider to the
  // geometry actually drawn and only solidify the pieces within reach. The
  // furniture parked above head height or buried under the floor stays scenery.
  // Four drawers (indices 10, 40, 97, 126) do pass this filter: they hang
  // 0.65-0.83m off the floor with tops at 1.29-1.45m, above the 1.15m jump apex,
  // so for a walking player they behave like a full-height obstacle. They are
  // the drawn 0.55-0.69 x 0.46-0.70m cabinet body rather than an invisible wall,
  // and its top can never carry the player (narrower than the 0.72m body, so
  // getPlatformFloorHeight never reports it as a floor) - only two of the four
  // even clear the 0.18m side-clearance band at the apex. Nothing else covers
  // them either: the table drawn next to the same index floats 1.16-1.31m off
  // the floor and is dropped by this very filter. Left as is; tightening the
  // rule to "body fully above head height" (min.y > 1.75) would solidify many
  // more of the 140 instances, which belongs in its own pass rather than here.
  const addInstanceCollider = (geometryBounds) => {
    instanceBounds.copy(geometryBounds).applyMatrix4(transform.matrix);
    if (instanceBounds.min.y > 0.9 || instanceBounds.max.y < 0.25) return;
    colliders.push({
      minX: instanceBounds.min.x,
      maxX: instanceBounds.max.x,
      minZ: instanceBounds.min.z,
      maxZ: instanceBounds.max.z,
      topY: instanceBounds.max.y,
    });
  };
  for (let index = 0; index < count; index += 1) {
    let col;
    let row;
    do {
      col = 2 + Math.floor(random() * (LEVEL_TWELVE_COLS - 4));
      row = 2 + Math.floor(random() * (LEVEL_TWELVE_ROWS - 4));
    } while ((col >= 16 && col <= 24 && row >= 24) || (Math.abs(col - 32) < 3 && Math.abs(row - 6) < 3));
    const center = levelTwelveCellCenter(col, row);
    const sink = random() < 0.28 ? -random() * 0.8 : random() < 0.08 ? 0.35 + random() * 1.4 : 0;
    const rotation = random() * Math.PI * 2;
    transform.position.set(center.x + (random() - 0.5) * 2.4, 0.76 + sink, center.z + (random() - 0.5) * 2.4);
    transform.rotation.set((random() - 0.5) * 0.08, rotation, (random() - 0.5) * 0.08);
    transform.scale.setScalar(0.78 + random() * 0.42);
    transform.updateMatrix();
    tables.setMatrixAt(index, transform.matrix);
    addInstanceCollider(tableBounds);
    transform.position.y = 0.45 + sink;
    transform.position.x += Math.cos(rotation) * 1.15;
    transform.position.z += Math.sin(rotation) * 1.15;
    transform.updateMatrix();
    chairs.setMatrixAt(index, transform.matrix);
    addInstanceCollider(chairBounds);
    transform.position.y = 0.5 + sink;
    transform.position.x -= Math.cos(rotation) * 2.2;
    transform.position.z -= Math.sin(rotation) * 2.2;
    transform.scale.multiplyScalar(0.72);
    transform.updateMatrix();
    drawers.setMatrixAt(index, transform.matrix);
    addInstanceCollider(drawerBounds);
  }
  tables.instanceMatrix.needsUpdate = true;
  chairs.instanceMatrix.needsUpdate = true;
  drawers.instanceMatrix.needsUpdate = true;
  scene.add(tables, chairs, drawers);
}

function addCopycatDoor(scene, colliders) {
  const position = levelTwelveCellCenter(LEVEL_TWELVE_COPYCAT_CELL.col, LEVEL_TWELVE_COPYCAT_CELL.row);
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 3.2, 0.28),
    createGameMaterial({ color: 0xf2f2ee, roughness: 0.92 }),
  );
  frame.name = "level-twelve-copycat-door-model";
  frame.position.set(position.x, 1.6, position.z);
  scene.add(frame);
  // The slab carries the F prompt but had no body, so the player could walk
  // through the door they were being asked to open.
  colliders.push({
    minX: position.x - 1.05,
    maxX: position.x + 1.05,
    minZ: position.z - 0.14,
    maxZ: position.z + 0.14,
  });
  const inset = new THREE.Mesh(
    new THREE.PlaneGeometry(1.55, 2.65),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
  );
  inset.position.set(position.x, 1.48, position.z - 0.15);
  scene.add(inset);
  return position;
}

function addWhiteStair(scene, colliders) {
  const position = levelTwelveCellCenter(LEVEL_TWELVE_STAIR_CELL.col, LEVEL_TWELVE_STAIR_CELL.row);
  const material = createGameMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.15, roughness: 0.86 });
  const stepCount = 10;
  const stepWidth = 3.2;
  const stepHeight = 0.24;
  const stepDepth = 0.8;
  const stepRise = 0.22;
  const stepRun = 0.7;
  // The flight is laid out from its front face, 0.9 cells in front of the cell
  // centre, and climbs away from the entrance as z decreases.
  const frontFaceZ = position.z + CELL_SIZE * 0.9;
  const deepestZ = frontFaceZ - stepDepth - (stepCount - 1) * stepRun;
  const minX = position.x - stepWidth / 2;
  const maxX = position.x + stepWidth / 2;
  for (let index = 0; index < stepCount; index += 1) {
    const centerZ = frontFaceZ - stepDepth / 2 - index * stepRun;
    const topY = stepHeight + index * stepRise;
    const step = new THREE.Mesh(new THREE.BoxGeometry(stepWidth, stepHeight, stepDepth), material);
    step.position.set(position.x, topY - stepHeight / 2, centerZ);
    scene.add(step);
    // The flight used to be scenery only, so the player walked straight through
    // it. Each collider is a wedge: solid from its own riser back to the deepest
    // tread, so the stacked tops reproduce exactly the visible stair surface
    // (the highest topY at any z is the step drawn there) and the space under
    // the treads stays filled instead of leaving 0.22m holes between steps.
    // Together with the trigger that now sits at the foot of the flight
    // (entryPosition in index.js): a 0.22m rise beats the 0.18m landing/side
    // clearance and a 0.7m tread is narrower than the 0.72m body, so the stairs
    // are a solid block that can only be jumped, never walked up.
    colliders.push({
      minX,
      maxX,
      minZ: deepestZ,
      maxZ: centerZ + stepDepth / 2,
      topY,
    });
  }
  const glow = new THREE.PointLight(0xffffff, 1.5, 14, 2.1);
  glow.position.set(position.x, 3.1, position.z - 1.4);
  scene.add(glow);
  return position;
}

export function addLevelTwelveProps(scene) {
  const low = isLowQuality();
  const wallMaterial = createGameMaterial({
    ...createLevelTwelveWallMaps(2.5, 1.2, !low),
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.08,
    roughness: 0.94,
    normalScale: new THREE.Vector2(0.38, 0.38),
    aoMapIntensity: 1.15,
  });
  const wallFinish = {
    skirting: createGameMaterial({ color: 0xd8d6cf, roughness: 0.91 }),
    seam: new THREE.MeshBasicMaterial({ color: 0x625f5a, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }),
  };
  const colliders = [];
  const core = addCoreRoom(scene, wallMaterial, wallFinish, colliders);
  addFurnitureField(scene, low || window.matchMedia?.("(pointer: coarse), (max-width: 800px)").matches ? 60 : 140, colliders);
  const copycatPosition = addCopycatDoor(scene, colliders);
  const stairPosition = addWhiteStair(scene, colliders);
  return { colliders, ...core, copycatPosition, stairPosition };
}
