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
import { createLevelTwelveWallMaps } from "./textures.js";

function addWall(scene, material, x, z, width, depth, colliders) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(width, WALL_HEIGHT, depth), material);
  wall.position.set(x, WALL_HEIGHT / 2, z);
  scene.add(wall);
  colliders.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 });
  return wall;
}

function addCoreRoom(scene, wallMaterial, colliders) {
  const coreCell = levelTwelveCellCenter(20, 28);
  const core = { x: coreCell.x, z: coreCell.z + CELL_SIZE / 2 };
  const width = CELL_SIZE * 3;
  const depth = CELL_SIZE * 4;
  const northZ = core.z - depth / 2;
  const southZ = core.z + depth / 2;
  const doorwayWidth = 2.2;
  const northSegmentWidth = (width - doorwayWidth) / 2;
  const northOffset = doorwayWidth / 2 + northSegmentWidth / 2;
  addWall(scene, wallMaterial, core.x - northOffset, northZ, northSegmentWidth, WALL_THICKNESS, colliders);
  addWall(scene, wallMaterial, core.x + northOffset, northZ, northSegmentWidth, WALL_THICKNESS, colliders);
  addWall(scene, wallMaterial, core.x, southZ, width + WALL_THICKNESS, WALL_THICKNESS, colliders);
  for (const side of [-1, 1]) {
    addWall(scene, wallMaterial, core.x + side * width / 2, core.z - 5, WALL_THICKNESS, 6, colliders);
    addWall(scene, wallMaterial, core.x + side * width / 2, core.z + 5, WALL_THICKNESS, 6, colliders);
  }

  const wood = createGameMaterial({ color: 0x77716a, roughness: 0.9 });
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

function addFurnitureField(scene, count) {
  const random = createSeededRandom(1213);
  const wood = createGameMaterial({ color: 0xaaa7a0, roughness: 0.96 });
  const metal = createGameMaterial({ color: 0xc9c9c7, roughness: 0.72, metalness: 0.16 });
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
    transform.position.y = 0.45 + sink;
    transform.position.x += Math.cos(rotation) * 1.15;
    transform.position.z += Math.sin(rotation) * 1.15;
    transform.updateMatrix();
    chairs.setMatrixAt(index, transform.matrix);
    transform.position.y = 0.5 + sink;
    transform.position.x -= Math.cos(rotation) * 2.2;
    transform.position.z -= Math.sin(rotation) * 2.2;
    transform.scale.multiplyScalar(0.72);
    transform.updateMatrix();
    drawers.setMatrixAt(index, transform.matrix);
  }
  tables.instanceMatrix.needsUpdate = true;
  chairs.instanceMatrix.needsUpdate = true;
  drawers.instanceMatrix.needsUpdate = true;
  scene.add(tables, chairs, drawers);
}

function addCopycatDoor(scene) {
  const position = levelTwelveCellCenter(LEVEL_TWELVE_COPYCAT_CELL.col, LEVEL_TWELVE_COPYCAT_CELL.row);
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 3.2, 0.28),
    createGameMaterial({ color: 0xf2f2ee, roughness: 0.92 }),
  );
  frame.name = "level-twelve-copycat-door-model";
  frame.position.set(position.x, 1.6, position.z);
  scene.add(frame);
  const inset = new THREE.Mesh(
    new THREE.PlaneGeometry(1.55, 2.65),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
  );
  inset.position.set(position.x, 1.48, position.z - 0.15);
  scene.add(inset);
  return position;
}

function addWhiteStair(scene) {
  const position = levelTwelveCellCenter(LEVEL_TWELVE_STAIR_CELL.col, LEVEL_TWELVE_STAIR_CELL.row);
  const material = createGameMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.15, roughness: 0.86 });
  for (let index = 0; index < 10; index += 1) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.24, 0.8), material);
    step.position.set(position.x, 0.12 + index * 0.22, position.z + 3.2 - index * 0.7);
    scene.add(step);
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
    emissiveIntensity: 0.42,
    roughness: 0.94,
    normalScale: new THREE.Vector2(0.18, 0.18),
  });
  const colliders = [];
  const core = addCoreRoom(scene, wallMaterial, colliders);
  addFurnitureField(scene, low || window.matchMedia?.("(pointer: coarse), (max-width: 800px)").matches ? 60 : 140);
  const copycatPosition = addCopycatDoor(scene);
  const stairPosition = addWhiteStair(scene);
  return { colliders, ...core, copycatPosition, stairPosition };
}
