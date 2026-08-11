import * as THREE from "three";
import { createGameMaterial, isLowQuality } from "../common/materials.js";
import { enableAoUv } from "../common/texture-utils.js";
import { CELL_SIZE } from "../constants.js";
import { levelElevenCellCenter } from "./layout.js";
import {
  createLevelElevenBrickMaps,
  createLevelElevenConcreteMaps,
  createLevelElevenInteriorFloorMaps,
  createLevelElevenTileMaps,
} from "./textures.js";

const BUILDINGS = [
  { minCol: 2, maxCol: 7, minRow: 2, maxRow: 6, height: 11, type: "brick" },
  { minCol: 14, maxCol: 24, minRow: 2, maxRow: 6, height: 22, type: "concrete" },
  { minCol: 32, maxCol: 42, minRow: 2, maxRow: 6, height: 30, type: "concrete" },
  { minCol: 2, maxCol: 7, minRow: 13, maxRow: 20, height: 16, type: "brick" },
  { minCol: 14, maxCol: 24, minRow: 13, maxRow: 20, height: 26, type: "brick" },
  { minCol: 50, maxCol: 57, minRow: 14, maxRow: 20, height: 18, type: "concrete" },
  { minCol: 2, maxCol: 7, minRow: 27, maxRow: 34, height: 20, type: "concrete" },
  { minCol: 14, maxCol: 24, minRow: 27, maxRow: 34, height: 34, type: "brick" },
  { minCol: 32, maxCol: 42, minRow: 27, maxRow: 34, height: 17, type: "concrete" },
  { minCol: 50, maxCol: 57, minRow: 27, maxRow: 34, height: 28, type: "brick" },
  { minCol: 2, maxCol: 7, minRow: 41, maxRow: 46, height: 14, type: "brick" },
  { minCol: 14, maxCol: 24, minRow: 41, maxRow: 46, height: 25, type: "concrete" },
  { minCol: 32, maxCol: 42, minRow: 41, maxRow: 46, height: 32, type: "brick" },
  { minCol: 50, maxCol: 57, minRow: 41, maxRow: 46, height: 20, type: "concrete" },
];

function boundsForBuilding(building) {
  const a = levelElevenCellCenter(building.minCol, building.minRow);
  const b = levelElevenCellCenter(building.maxCol, building.maxRow);
  return {
    minX: a.x - 2,
    maxX: b.x + 2,
    minZ: a.z - 2,
    maxZ: b.z + 2,
  };
}

function addBuildings(scene) {
  const low = isLowQuality();
  const brick = createGameMaterial({ ...createLevelElevenBrickMaps(5, 5, !low), color: 0x9d8174, roughness: 0.92, normalScale: new THREE.Vector2(0.52, 0.52), aoMapIntensity: 0.65 });
  const concrete = createGameMaterial({ ...createLevelElevenConcreteMaps(5, 6, !low), color: 0x9a9c98, roughness: 0.94, normalScale: new THREE.Vector2(0.45, 0.45), aoMapIntensity: 0.6 });
  const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x2d4555, emissive: 0x162b38, emissiveIntensity: 0.48, roughness: 0.24, metalness: 0.12 });
  const roofMaterial = createGameMaterial({ color: 0x4f5353, roughness: 0.88, metalness: 0.18 });
  const colliders = [];
  BUILDINGS.forEach((building, index) => {
    const bounds = boundsForBuilding(building);
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxZ - bounds.minZ;
    const x = (bounds.minX + bounds.maxX) / 2;
    const z = (bounds.minZ + bounds.maxZ) / 2;
    const body = new THREE.Mesh(enableAoUv(new THREE.BoxGeometry(width, building.height, depth)), building.type === "brick" ? brick : concrete);
    body.name = `level-eleven-building-${index + 1}`;
    body.position.set(x, building.height / 2, z);
    scene.add(body);
    const rows = Math.max(2, Math.floor(building.height / 4));
    const frontCount = Math.max(2, Math.floor(width / 4));
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < frontCount; col += 1) {
        const window = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.7), windowMaterial);
        window.position.set(bounds.minX + (col + 0.5) * (width / frontCount), 2.4 + row * 3.3, bounds.minZ - 0.012);
        scene.add(window);
      }
    }
    const roofUnit = new THREE.Mesh(new THREE.BoxGeometry(Math.min(3.2, width * 0.3), 1.1, Math.min(4, depth * 0.34)), roofMaterial);
    roofUnit.position.set(x + width * 0.16, building.height + 0.55, z - depth * 0.12);
    scene.add(roofUnit);
    colliders.push(bounds);
  });
  return colliders;
}

function addPoolLobby(scene) {
  const low = isLowQuality();
  const first = levelElevenCellCenter(49, 5);
  const last = levelElevenCellCenter(56, 12);
  const center = { x: (first.x + last.x) / 2, z: (first.z + last.z) / 2 };
  const width = 32;
  const depth = 32;
  const wallMaterial = createGameMaterial({ ...createLevelElevenTileMaps(8, 3, !low), color: 0xe1e4d9, roughness: 0.78, normalScale: new THREE.Vector2(0.36, 0.36) });
  const floorMaterial = createGameMaterial({ ...createLevelElevenInteriorFloorMaps(8, 8, !low), color: 0x939997, roughness: 0.9, normalScale: new THREE.Vector2(0.42, 0.42) });
  const floor = new THREE.Mesh(enableAoUv(new THREE.PlaneGeometry(width, depth)), floorMaterial);
  floor.name = "level-eleven-public-pool-floor";
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(center.x, 0.028, center.z);
  scene.add(floor);
  const wallGeometryX = enableAoUv(new THREE.BoxGeometry(width, 4.5, 0.22));
  const wallGeometryZ = enableAoUv(new THREE.BoxGeometry(0.22, 4.5, depth));
  const back = new THREE.Mesh(wallGeometryX, wallMaterial);
  back.position.set(center.x, 2.25, center.z - depth / 2);
  const north = new THREE.Mesh(wallGeometryZ, wallMaterial);
  north.position.set(center.x + width / 2, 2.25, center.z);
  const south = new THREE.Mesh(wallGeometryZ, wallMaterial);
  south.position.set(center.x - width / 2, 2.25, center.z);
  scene.add(back, north, south);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.08, 1.05), createGameMaterial({ color: 0x6f7e7e, roughness: 0.82, metalness: 0.12 }));
  desk.position.set(center.x - 5, 0.54, center.z - 5.2);
  scene.add(desk);
  const emptyPool = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.35, 5.2), createGameMaterial({ color: 0x4b747b, emissive: 0x092b31, emissiveIntensity: 0.24, roughness: 0.52 }));
  emptyPool.position.set(center.x + 6.5, -0.12, center.z + 5.4);
  scene.add(emptyPool);
  const emergencyLight = new THREE.PointLight(0x9edfd1, 1.8, 16, 2.2);
  emergencyLight.position.set(center.x, 3.8, center.z - 5);
  scene.add(emergencyLight);
  const colliders = [
    { minX: center.x - width / 2, maxX: center.x + width / 2, minZ: center.z - depth / 2 - 0.18, maxZ: center.z - depth / 2 + 0.18 },
    { minX: center.x + width / 2 - 0.18, maxX: center.x + width / 2 + 0.18, minZ: center.z - depth / 2, maxZ: center.z + depth / 2 },
    { minX: center.x - width / 2 - 0.18, maxX: center.x - width / 2 + 0.18, minZ: center.z - depth / 2, maxZ: center.z + depth / 2 },
    { minX: center.x - 7.4, maxX: center.x - 2.6, minZ: center.z - 5.75, maxZ: center.z - 4.65, topY: 1.08 },
    { minX: center.x + 2.1, maxX: center.x + 10.9, minZ: center.z + 2.8, maxZ: center.z + 8, topY: 0.18 },
  ];
  return { colliders, light: emergencyLight };
}

function addStreetDetails(scene, coarse) {
  const colliders = [];
  const metal = createGameMaterial({ color: 0x3b4245, roughness: 0.72, metalness: 0.62 });
  const lampGlass = new THREE.MeshStandardMaterial({ color: 0xf1e4c1, emissive: 0xecc274, emissiveIntensity: 2.2, roughness: 0.2 });
  const lampCells = [[10, 37], [28, 37], [46, 37], [10, 23], [28, 23], [46, 23], [10, 9], [28, 9], [46, 9]];
  const lights = [];
  lampCells.slice(0, coarse ? 6 : lampCells.length).forEach(([col, row], index) => {
    const center = levelElevenCellCenter(col, row);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 8), metal);
    pole.position.set(center.x + 1.45, 2.1, center.z + 1.3);
    scene.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), lampGlass);
    bulb.position.set(center.x + 1.45, 4.1, center.z + 1.3);
    scene.add(bulb);
    const light = new THREE.PointLight(0xffdda2, 0.72, 13, 2.1);
    light.position.copy(bulb.position);
    scene.add(light);
    lights.push({ light, bulb, phase: index * 1.71 });
  });
  const carMaterial = createGameMaterial({ color: 0x55616a, roughness: 0.5, metalness: 0.42 });
  for (const [col, row, rotation] of [[34, 37, 0], [18, 23, Math.PI / 2], [46, 17, 0]]) {
    const center = levelElevenCellCenter(col, row);
    const car = new THREE.Group();
    car.position.set(center.x, 0, center.z);
    car.rotation.y = rotation;
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.75, 1.75), carMaterial);
    body.position.y = 0.65;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 1.55), new THREE.MeshStandardMaterial({ color: 0x263944, roughness: 0.26, metalness: 0.2 }));
    cabin.position.set(-0.15, 1.25, 0);
    car.add(body, cabin);
    scene.add(car);
    const sideways = Math.abs(Math.sin(rotation)) > 0.7;
    colliders.push({ minX: center.x - (sideways ? 1 : 2.1), maxX: center.x + (sideways ? 1 : 2.1), minZ: center.z - (sideways ? 2.1 : 1), maxZ: center.z + (sideways ? 2.1 : 1), topY: 1.55 });
  }

  const anomalyMaterial = createGameMaterial({ color: 0x6f7371, emissive: 0x121616, emissiveIntensity: 0.14, roughness: 0.94 });
  const floating = new THREE.Mesh(new THREE.BoxGeometry(15, 3.2, 9), anomalyMaterial);
  floating.name = "level-eleven-floating-floor";
  const floatingCenter = levelElevenCellCenter(37, 16);
  floating.position.set(floatingCenter.x, 12.5, floatingCenter.z);
  floating.rotation.z = 0.05;
  scene.add(floating);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.35, 15), anomalyMaterial);
  ramp.name = "level-eleven-sky-ramp";
  const rampCenter = levelElevenCellCenter(33, 20);
  ramp.position.set(rampCenter.x, 2.2, rampCenter.z);
  ramp.rotation.x = -0.24;
  scene.add(ramp);
  return { colliders, lights };
}

export function addLevelElevenDetails(scene, { coarse = false } = {}) {
  const buildingColliders = addBuildings(scene);
  const lobby = addPoolLobby(scene);
  const street = addStreetDetails(scene, coarse);
  return {
    colliders: [...buildingColliders, ...lobby.colliders, ...street.colliders],
    update(elapsed) {
      street.lights.forEach(({ light, bulb, phase }) => {
        const flicker = Math.sin(elapsed * 1.7 + phase) > 0.96 ? 0.18 : 1;
        light.intensity = 0.72 * flicker;
        bulb.material.emissiveIntensity = 1.7 + flicker * 1.2;
      });
      lobby.light.intensity = 1.55 + Math.sin(elapsed * 0.8) * 0.18;
    },
  };
}

export function addLevelElevenExpansionEntrances(scene) {
  const matrixCell = levelElevenCellCenter(19, 12);
  const windowMaterial = new THREE.MeshBasicMaterial({
    color: 0xc8f4ff,
    transparent: true,
    opacity: 0.78,
    toneMapped: false,
  });
  const matrixWindow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.25), windowMaterial);
  matrixWindow.name = "level-eleven-matrix-window";
  matrixWindow.position.set(matrixCell.x, 1.55, matrixCell.z + CELL_SIZE / 2 - 0.04);
  matrixWindow.rotation.y = Math.PI;
  scene.add(matrixWindow);
  const glow = new THREE.PointLight(0xc8f4ff, 1.4, 8, 2.2);
  glow.position.set(matrixCell.x, 1.8, matrixCell.z + 0.8);
  scene.add(glow);

  const apartmentCell = levelElevenCellCenter(37, 40);
  const numberCanvas = document.createElement("canvas");
  numberCanvas.width = 256;
  numberCanvas.height = 128;
  const context = numberCanvas.getContext("2d");
  context.fillStyle = "#191710";
  context.fillRect(0, 0, 256, 128);
  context.fillStyle = "#d9cfae";
  context.font = "bold 64px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("13", 128, 66);
  const numberTexture = new THREE.CanvasTexture(numberCanvas);
  numberTexture.colorSpace = THREE.SRGBColorSpace;
  const number = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.5),
    new THREE.MeshBasicMaterial({ map: numberTexture }),
  );
  number.name = "level-eleven-apartment-thirteen-number";
  number.position.set(apartmentCell.x, 2.85, apartmentCell.z + CELL_SIZE / 2 - 0.06);
  number.rotation.y = Math.PI;
  scene.add(number);

  return {
    update(elapsed) {
      matrixWindow.material.opacity = 0.68 + Math.sin(elapsed * 2.7) * 0.12;
      glow.intensity = 1.2 + Math.sin(elapsed * 3.1) * 0.35;
    },
  };
}
