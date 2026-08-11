import * as THREE from "three";
import { CELL_SIZE, CEILING_Y, WALL_HEIGHT } from "../constants.js";
import { collectGridWallTransforms, eastWestWallGeometry, northSouthWallGeometry } from "../common/grid-world.js";
import { createGameMaterial, isLowQuality } from "../common/materials.js";
import { enableAoUv } from "../common/texture-utils.js";
import {
  LEVEL_THIRTEEN_APARTMENTS,
  LEVEL_THIRTEEN_COLS,
  LEVEL_THIRTEEN_FLOORS,
  LEVEL_THIRTEEN_ROWS,
  isLevelThirteenOpenCell,
  levelThirteenCellCenter,
} from "./layout.js";
import {
  createLevelThirteenCarpetMaps,
  createLevelThirteenLaminateMaps,
  createLevelThirteenRustMaps,
  createLevelThirteenTileMaps,
  createLevelThirteenWallMaps,
} from "./textures.js";

function createDoorNumberTexture(label) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ddd4bd";
  context.fillRect(0, 0, 256, 128);
  context.fillStyle = "#302820";
  context.font = "bold 52px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, 128, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addArchitecture(scene, colliders) {
  const low = isLowQuality();
  const wallMaterial = createGameMaterial({
    ...createLevelThirteenWallMaps(1.6, 1.1, !low),
    color: 0xd6d0c2,
    roughness: 0.95,
    normalScale: new THREE.Vector2(0.22, 0.22),
  });
  const carpetMaterial = createGameMaterial({
    ...createLevelThirteenCarpetMaps(10, 18, !low),
    color: 0x8a6a48,
    roughness: 0.98,
    normalScale: new THREE.Vector2(0.26, 0.26),
  });
  const laminateMaterial = createGameMaterial({
    ...createLevelThirteenLaminateMaps(5, 6, !low),
    color: 0xb6a183,
    roughness: 0.82,
    normalScale: new THREE.Vector2(0.28, 0.28),
  });
  const ceilingMaterial = createGameMaterial({
    color: 0xc7c2b6,
    emissive: 0x8a867b,
    emissiveIntensity: 0.34,
    roughness: 0.98,
  });
  for (const floor of LEVEL_THIRTEEN_FLOORS) {
    const first = levelThirteenCellCenter(floor.minCol, 20);
    const width = (floor.maxCol - floor.minCol + 1) * CELL_SIZE;
    const base = new THREE.Mesh(enableAoUv(new THREE.PlaneGeometry(width, 38 * CELL_SIZE)), carpetMaterial);
    base.rotation.x = -Math.PI / 2;
    base.position.set(first.x + width / 2 - CELL_SIZE / 2, 0, first.z);
    scene.add(base);
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, 38 * CELL_SIZE), ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(base.position.x, CEILING_Y, first.z);
    scene.add(ceiling);
  }
  for (const apartment of LEVEL_THIRTEEN_APARTMENTS) {
    const first = levelThirteenCellCenter(apartment.minCol, apartment.minRow);
    const last = levelThirteenCellCenter(apartment.maxCol, apartment.maxRow);
    const apartmentFloor = new THREE.Mesh(
      enableAoUv(new THREE.PlaneGeometry(last.x - first.x + CELL_SIZE, last.z - first.z + CELL_SIZE)),
      laminateMaterial,
    );
    apartmentFloor.rotation.x = -Math.PI / 2;
    apartmentFloor.position.set((first.x + last.x) / 2, 0.018, (first.z + last.z) / 2);
    scene.add(apartmentFloor);
  }
  const transforms = collectGridWallTransforms({
    cols: LEVEL_THIRTEEN_COLS,
    rows: LEVEL_THIRTEEN_ROWS,
    isOpen: isLevelThirteenOpenCell,
    cellCenter: levelThirteenCellCenter,
  });
  const ns = new THREE.InstancedMesh(northSouthWallGeometry, wallMaterial, transforms.northSouth.length);
  const ew = new THREE.InstancedMesh(eastWestWallGeometry, wallMaterial, transforms.eastWest.length);
  ns.name = "level-thirteen-north-south-walls";
  ew.name = "level-thirteen-east-west-walls";
  const transform = new THREE.Object3D();
  transforms.northSouth.forEach((position, index) => {
    transform.position.copy(position);
    transform.rotation.set(0, 0, 0);
    transform.scale.set(1, 1, 1);
    transform.updateMatrix();
    ns.setMatrixAt(index, transform.matrix);
  });
  transforms.eastWest.forEach((position, index) => {
    transform.position.copy(position);
    transform.updateMatrix();
    ew.setMatrixAt(index, transform.matrix);
  });
  ns.instanceMatrix.needsUpdate = true;
  ew.instanceMatrix.needsUpdate = true;
  scene.add(ns, ew);

  const doorMaterial = createGameMaterial({ color: 0x725a43, roughness: 0.86 });
  for (const floor of LEVEL_THIRTEEN_FLOORS) {
    const rows = [6, 9, 16, 22, 31, 35];
    rows.forEach((row, index) => {
      const side = index % 2 ? 1 : -1;
      const center = levelThirteenCellCenter(floor.centerCol + side * 2, row);
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.85, 0.16), doorMaterial);
      door.position.set(center.x, 1.425, center.z);
      scene.add(door);
      const number = new THREE.Mesh(
        new THREE.PlaneGeometry(0.72, 0.34),
        new THREE.MeshBasicMaterial({ map: createDoorNumberTexture(`${floor.id}${index + 1}0${index + 2}`) }),
      );
      number.position.set(center.x, 2.25, center.z - 0.09);
      scene.add(number);
    });
  }

  const claimed = LEVEL_THIRTEEN_APARTMENTS.find((room) => room.id === "71304");
  const doorCell = levelThirteenCellCenter(claimed.door.col, claimed.door.row);
  const claimedDoor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3, 1.9), doorMaterial);
  claimedDoor.name = "level-thirteen-apartment-71304-door";
  claimedDoor.position.set(doorCell.x - CELL_SIZE / 2, 1.5, doorCell.z);
  scene.add(claimedDoor);
  const claimedDoorCollider = {
    minX: claimedDoor.position.x - 0.14,
    maxX: claimedDoor.position.x + 0.14,
    minZ: claimedDoor.position.z - 1,
    maxZ: claimedDoor.position.z + 1,
    active: true,
  };
  colliders.push(claimedDoorCollider);
  return { claimedDoor, claimedDoorCollider };
}

function addApartmentFurniture(scene, colliders) {
  const wood = createGameMaterial({ color: 0x755c46, roughness: 0.88 });
  const fabric = createGameMaterial({ color: 0x7c746b, roughness: 0.98 });
  const tile = createGameMaterial({
    ...createLevelThirteenTileMaps(3, 3, !isLowQuality()),
    color: 0xd6d7d0,
    roughness: 0.86,
    normalScale: new THREE.Vector2(0.25, 0.25),
  });
  for (const apartment of LEVEL_THIRTEEN_APARTMENTS) {
    const center = levelThirteenCellCenter(
      Math.floor((apartment.minCol + apartment.maxCol) / 2),
      Math.floor((apartment.minRow + apartment.maxRow) / 2),
    );
    const sofa = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.72, 1.05), fabric);
    sofa.position.set(center.x - 2.2, 0.42, center.z - 2.2);
    scene.add(sofa);
    colliders.push({ minX: sofa.position.x - 1.4, maxX: sofa.position.x + 1.4, minZ: sofa.position.z - 0.55, maxZ: sofa.position.z + 0.55, topY: 0.8 });
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.58, 3.6), fabric);
    bed.position.set(center.x + 2.2, 0.32, center.z + 2.1);
    scene.add(bed);
    colliders.push({ minX: bed.position.x - 1.13, maxX: bed.position.x + 1.13, minZ: bed.position.z - 1.8, maxZ: bed.position.z + 1.8, topY: 0.64 });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.02, 0.72), wood);
    counter.position.set(center.x - 1.4, 0.51, center.z + 4.4);
    scene.add(counter);
    colliders.push({ minX: counter.position.x - 1.7, maxX: counter.position.x + 1.7, minZ: counter.position.z - 0.38, maxZ: counter.position.z + 0.38, topY: 1.02 });
    const bathroom = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.6, 0.12), tile);
    bathroom.position.set(center.x + 3.1, 1.3, center.z - 3.2);
    scene.add(bathroom);
  }
}

function addApartmentPartitions(scene, colliders) {
  const partitionMaterial = createGameMaterial({ color: 0xd8d2c4, roughness: 0.96 });
  for (const apartment of LEVEL_THIRTEEN_APARTMENTS) {
    const first = levelThirteenCellCenter(apartment.minCol, apartment.minRow);
    const last = levelThirteenCellCenter(apartment.maxCol, apartment.maxRow);
    const centerZ = (first.z + last.z) / 2;
    const wallX = (first.x + last.x) / 2 + 0.75;
    const fullDepth = last.z - first.z + CELL_SIZE;
    const gap = 1.9;
    const segmentDepth = (fullDepth - gap) / 2;
    for (const side of [-1, 1]) {
      const segmentZ = centerZ + side * (gap / 2 + segmentDepth / 2);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.14, WALL_HEIGHT, segmentDepth), partitionMaterial);
      wall.position.set(wallX, WALL_HEIGHT / 2, segmentZ);
      scene.add(wall);
      colliders.push({
        minX: wallX - 0.1,
        maxX: wallX + 0.1,
        minZ: segmentZ - segmentDepth / 2,
        maxZ: segmentZ + segmentDepth / 2,
      });
    }
    const bathWall = new THREE.Mesh(new THREE.BoxGeometry(3.2, WALL_HEIGHT, 0.14), partitionMaterial);
    bathWall.position.set(wallX + 1.55, WALL_HEIGHT / 2, first.z + 2.4);
    scene.add(bathWall);
    colliders.push({
      minX: bathWall.position.x - 1.6,
      maxX: bathWall.position.x + 1.6,
      minZ: bathWall.position.z - 0.1,
      maxZ: bathWall.position.z + 0.1,
    });
  }
}

function addLobbyAndFaceling(scene, colliders) {
  const lobbyCenter = levelThirteenCellCenter(11, 36);
  const deskMaterial = createGameMaterial({ color: 0x5d4b3c, roughness: 0.84 });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.08, 1.05), deskMaterial);
  desk.position.set(lobbyCenter.x, 0.54, lobbyCenter.z - 2.4);
  scene.add(desk);
  colliders.push({ minX: desk.position.x - 2.25, maxX: desk.position.x + 2.25, minZ: desk.position.z - 0.55, maxZ: desk.position.z + 0.55, topY: 1.08 });
  const faceling = new THREE.Group();
  faceling.name = "level-thirteen-desk-faceling";
  const suit = createGameMaterial({ color: 0x282a2a, roughness: 0.88 });
  const skin = createGameMaterial({ color: 0xc7b39e, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.95, 5, 10), suit);
  torso.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 10), skin);
  head.position.y = 1.95;
  head.scale.z = 0.82;
  faceling.add(torso, head);
  faceling.position.set(lobbyCenter.x, 0, lobbyCenter.z - 3.55);
  scene.add(faceling);
  return { faceling, facelingPosition: { x: faceling.position.x, z: faceling.position.z } };
}

function addWindows(scene) {
  const positions = [levelThirteenCellCenter(28, 18), levelThirteenCellCenter(67, 33)];
  const material = new THREE.MeshBasicMaterial({ color: 0x79c9ff, toneMapped: false });
  const windows = positions.map((position, index) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.3), material.clone());
    mesh.name = `level-thirteen-window-entity-${index + 1}`;
    mesh.position.set(position.x, 1.55, position.z);
    scene.add(mesh);
    const glow = new THREE.PointLight(0x6abfff, 1.25, 7, 2.4);
    glow.position.set(position.x, 1.5, position.z - 0.5);
    scene.add(glow);
    return { id: `window-entity-${index + 1}`, position, mesh, glow, phase: index * 2.1 };
  });
  return windows;
}

function addRustyPipeExit(scene) {
  const position = levelThirteenCellCenter(18, 7);
  const material = createGameMaterial({
    ...createLevelThirteenRustMaps(2, 2, !isLowQuality()),
    color: 0x9c5b34,
    roughness: 0.94,
    metalness: 0.42,
    normalScale: new THREE.Vector2(0.4, 0.4),
  });
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 3.1, 14, 1, true), material);
  pipe.name = "level-thirteen-rusty-pipe-exit";
  pipe.position.set(position.x, 1.55, position.z);
  pipe.rotation.z = Math.PI / 2;
  scene.add(pipe);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.1, 8, 18), material);
  ring.position.set(position.x - 1.55, 1.55, position.z);
  ring.rotation.y = Math.PI / 2;
  scene.add(ring);
  return position;
}

function addTransitionProps(scene) {
  const cells = [[11, 37], [35, 37], [35, 4], [59, 4]];
  const stairMaterial = createGameMaterial({ color: 0xaaa295, roughness: 0.95 });
  cells.forEach(([col, row]) => {
    const position = levelThirteenCellCenter(col, row);
    for (let index = 0; index < 6; index += 1) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.18, 0.62), stairMaterial);
      step.position.set(position.x, 0.09 + index * 0.16, position.z + 1.6 - index * 0.5);
      scene.add(step);
    }
  });
  const elevatorMaterial = createGameMaterial({ color: 0x4f5354, roughness: 0.72, metalness: 0.58 });
  for (const floor of LEVEL_THIRTEEN_FLOORS) {
    const position = levelThirteenCellCenter(floor.centerCol, 3);
    const elevator = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.1, 0.18), elevatorMaterial);
    elevator.position.set(position.x, 1.55, position.z - 1.9);
    scene.add(elevator);
  }
}

export function addLevelThirteenProps(scene) {
  const colliders = [];
  const architecture = addArchitecture(scene, colliders);
  addApartmentPartitions(scene, colliders);
  addApartmentFurniture(scene, colliders);
  const lobby = addLobbyAndFaceling(scene, colliders);
  const windows = addWindows(scene);
  const pipeExitPosition = addRustyPipeExit(scene);
  addTransitionProps(scene);
  return {
    colliders,
    ...architecture,
    ...lobby,
    windows,
    pipeExitPosition,
    update(elapsed, claimed) {
      architecture.claimedDoorCollider.active = !claimed;
      architecture.claimedDoor.position.y += ((claimed ? 4.8 : 1.5) - architecture.claimedDoor.position.y) * 0.08;
      lobby.faceling.rotation.y = Math.sin(elapsed * 0.28) * 0.08;
      windows.forEach((window) => {
        const pulse = 0.78 + Math.sin(elapsed * 2.2 + window.phase) * 0.16;
        window.mesh.material.opacity = pulse;
        window.mesh.material.transparent = true;
        window.glow.intensity = 1.05 + pulse * 0.42;
      });
    },
  };
}
