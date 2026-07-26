import * as THREE from "three";
import { CEILING_Y } from "../constants.js";

const HOUSE_CELLS = [
  { col: 7, row: 26, rotation: Math.PI },
  { col: 17, row: 26, rotation: Math.PI },
  { col: 32, row: 26, rotation: Math.PI },
  { col: 9, row: 13, rotation: 0 },
  { col: 18, row: 13, rotation: 0 },
  { col: 32, row: 13, rotation: 0 },
  { col: 41, row: 13, rotation: 0 },
  { col: 32, row: 3, rotation: Math.PI / 2 },
  { col: 41, row: 3, rotation: Math.PI / 2 },
];

const LAMP_CELLS = [
  { col: 6, row: 33 }, { col: 16, row: 33 }, { col: 27, row: 33 }, { col: 39, row: 33 },
  { col: 45, row: 27 }, { col: 45, row: 20 }, { col: 45, row: 12 }, { col: 45, row: 6 },
  { col: 32, row: 20 }, { col: 24, row: 20 }, { col: 30, row: 8 }, { col: 40, row: 8 },
];

export function addLevelNineDetails(scene, cellCenter, { coarse = false } = {}) {
  const houseWall = new THREE.MeshStandardMaterial({ color: 0x41444c, emissive: 0x07090c, emissiveIntensity: 0.26, roughness: 0.92 });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x171b22, roughness: 0.94 });
  const windowMaterial = new THREE.MeshStandardMaterial({ color: 0xb9a766, emissive: 0xd19c3d, emissiveIntensity: 0.35, roughness: 0.42 });
  const porchMaterial = new THREE.MeshStandardMaterial({ color: 0x6a6257, roughness: 0.88 });
  const lampMetal = new THREE.MeshStandardMaterial({ color: 0x242b30, roughness: 0.8, metalness: 0.68 });
  const lampGlass = new THREE.MeshStandardMaterial({ color: 0xffd68c, emissive: 0xffa83e, emissiveIntensity: 1.65, roughness: 0.26 });
  const roadReflector = new THREE.MeshBasicMaterial({ color: 0xc6b98c, transparent: true, opacity: 0.52 });
  const colliders = [];

  HOUSE_CELLS.forEach((house, index) => {
    const center = cellCenter(house.col, house.row);
    const group = new THREE.Group();
    group.name = `level-nine-house-${index + 1}`;
    group.position.set(center.x, 0, center.z);
    group.rotation.y = house.rotation;
    const facade = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.7, 0.22), houseWall);
    facade.position.set(0, 1.35, 0);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.25, 1.65, 4), roofMaterial);
    roof.position.set(0, 3.02, 0.08);
    roof.rotation.y = Math.PI / 4;
    const porch = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.16, 1.3), porchMaterial);
    porch.position.set(0, 0.08, -0.72);
    group.add(facade, roof, porch);
    for (const x of [-1.72, 1.72]) {
      const window = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.7), windowMaterial);
      window.position.set(x, 1.52, -0.125);
      group.add(window);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.65, 0.08), roofMaterial);
    door.position.set(0, 0.84, -0.13);
    group.add(door);
    scene.add(group);
    colliders.push({ minX: center.x - 2.75, maxX: center.x + 2.75, minZ: center.z - 0.58, maxZ: center.z + 0.58 });
  });

  const lamps = [];
  LAMP_CELLS.slice(0, coarse ? 8 : LAMP_CELLS.length).forEach((lamp, index) => {
    const center = cellCenter(lamp.col, lamp.row);
    const group = new THREE.Group();
    group.name = `level-nine-street-lamp-${index + 1}`;
    group.position.set(center.x + (index % 2 ? 1.15 : -1.15), 0, center.z + 1.15);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 3.55, 8), lampMetal);
    pole.position.y = 1.775;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.06), lampMetal);
    arm.position.set(0.3, 3.38, 0);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), lampGlass);
    bulb.position.set(0.63, 3.19, 0);
    group.add(pole, arm, bulb);
    const light = new THREE.PointLight(0xffc87a, 0, 15, 2.0);
    light.position.set(0.62, 3.05, 0);
    group.add(light);
    scene.add(group);
    lamps.push({ light, bulb, phase: index * 1.71 + lamp.col * 0.13 });
  });

  for (let index = 0; index < 18; index += 1) {
    const cell = cellCenter(5 + index * 2.35, 33);
    const reflector = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.018, 0.12), roadReflector);
    reflector.position.set(cell.x, 0.022, cell.z);
    scene.add(reflector);
  }

  const distantGlow = new THREE.PointLight(0x7896be, 0.42, 22, 2.2);
  distantGlow.position.set(0, CEILING_Y - 0.48, -20);
  scene.add(distantGlow);

  return {
    colliders,
    update(elapsed, fogSurge) {
      lamps.forEach(({ light, bulb, phase }) => {
        const flicker = Math.sin(elapsed * 2.3 + phase) > 0.94 ? 0.18 : 1;
        const strength = (fogSurge ? 0.38 : 0.82) * flicker;
        light.intensity = strength * 1.6;
        bulb.material.emissiveIntensity = 1.2 + strength * 1.45;
      });
      distantGlow.intensity = fogSurge ? 0.16 : 0.42;
    },
  };
}
