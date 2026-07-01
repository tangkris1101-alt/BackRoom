import * as THREE from "three";
import {
  CELL_SIZE,
  CEILING_Y,
} from "../constants.js";
import { createWideSignTexture } from "../common/textures.js";
import { levelTwoCellCenter, getLevelTwoTargetMount } from "../level-two/layout.js";

export function addLevelThreeElectricalDetails(scene) {
  const colliders = [];
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0x27302d,
    emissive: 0x07140f,
    emissiveIntensity: 0.18,
    roughness: 0.62,
    metalness: 0.32,
  });
  const warningMaterial = new THREE.MeshStandardMaterial({
    color: 0xb96c22,
    emissive: 0x3a1602,
    emissiveIntensity: 0.2,
    roughness: 0.58,
    metalness: 0.18,
  });
  const cableMaterial = new THREE.MeshStandardMaterial({
    color: 0x050505,
    emissive: 0x020101,
    emissiveIntensity: 0.1,
    roughness: 0.72,
    metalness: 0.28,
  });

  const panels = [
    { col: 7, row: 3 },
    { col: 14, row: 8 },
    { col: 21, row: 10 },
    { col: 30, row: 19 },
    { col: 34, row: 19 },
  ];
  panels.forEach((location, index) => {
    const center = levelTwoCellCenter(location.col, location.row);
    const mount = getLevelTwoTargetMount(center);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.18, 0.12), panelMaterial);
    panel.position.set(mount.x, 1.25, mount.z);
    panel.rotation.y = mount.rotation;
    scene.add(panel);

    for (let i = 0; i < 4; i += 1) {
      const switchMesh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.04, 0.035), warningMaterial);
      switchMesh.position.copy(panel.position);
      switchMesh.position.y = 0.88 + i * 0.18;
      switchMesh.position.x += Math.cos(mount.rotation) * (-0.26 + (i % 2) * 0.52);
      switchMesh.position.z -= Math.sin(mount.rotation) * (-0.26 + (i % 2) * 0.52);
      switchMesh.rotation.y = mount.rotation;
      scene.add(switchMesh);
    }

    if (index % 2 === 0) {
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(1.25, 0.36),
        new THREE.MeshStandardMaterial({
          map: createWideSignTexture("HIGH VOLTAGE", "#2a1705", "#ffcf5e"),
          emissive: 0x4a2504,
          emissiveIntensity: 0.3,
          roughness: 0.58,
          side: THREE.DoubleSide,
        }),
      );
      sign.position.set(mount.x, 2.12, mount.z);
      sign.rotation.y = mount.rotation;
      scene.add(sign);
    }
  });

  const generators = [
    { col: 12, row: 13, x: -0.35, z: 0.48, rot: 0.12 },
    { col: 26, row: 14, x: 0.52, z: -0.4, rot: -0.2 },
    { col: 8, row: 18, x: -0.2, z: 0.48, rot: 0.32 },
  ];
  generators.forEach((gen) => {
    const center = levelTwoCellCenter(gen.col, gen.row);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.82, 0.78), panelMaterial);
    mesh.position.set(center.x + gen.x, 0.43, center.z + gen.z);
    mesh.rotation.y = gen.rot;
    scene.add(mesh);
    colliders.push({
      minX: mesh.position.x - 0.78,
      maxX: mesh.position.x + 0.78,
      minZ: mesh.position.z - 0.68,
      maxZ: mesh.position.z + 0.68,
    });

    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.018, 8, 28), warningMaterial);
    coil.position.set(mesh.position.x, 0.72, mesh.position.z - 0.41);
    coil.rotation.y = gen.rot;
    scene.add(coil);
  });

  const cableGeometry = new THREE.CylinderGeometry(0.035, 0.035, 1, 8);
  const cables = [
    { col: 5, row: 3, axis: "x", length: CELL_SIZE * 9, y: CEILING_Y - 0.22, offsetZ: 0.88 },
    { col: 14, row: 7, axis: "z", length: CELL_SIZE * 8, y: CEILING_Y - 0.26, offsetX: -0.9 },
    { col: 19, row: 19, axis: "x", length: CELL_SIZE * 18, y: CEILING_Y - 0.24, offsetZ: -0.88 },
    { col: 30, row: 15, axis: "z", length: CELL_SIZE * 8, y: 2.62, offsetX: 1.05 },
  ];
  cables.forEach((cable) => {
    const center = levelTwoCellCenter(cable.col, cable.row);
    const mesh = new THREE.Mesh(cableGeometry, cableMaterial);
    mesh.scale.y = cable.length;
    mesh.position.set(center.x + (cable.offsetX ?? 0), cable.y, center.z + (cable.offsetZ ?? 0));
    if (cable.axis === "x") mesh.rotation.z = Math.PI / 2;
    if (cable.axis === "z") mesh.rotation.x = Math.PI / 2;
    scene.add(mesh);
  });

  return colliders;
}

export function addLevelThreeBreakerDoor(scene, position) {
  const mount = getLevelTwoTargetMount(position);
  const doorMaterial = new THREE.MeshStandardMaterial({
    color: 0x171b18,
    emissive: 0x06120d,
    emissiveIntensity: 0.2,
    roughness: 0.62,
    metalness: 0.34,
  });
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.55, 2.1, 0.14), doorMaterial);
  door.position.set(mount.x, 1.06, mount.z);
  door.rotation.y = mount.rotation;
  scene.add(door);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.65, 0.45),
    new THREE.MeshStandardMaterial({
      map: createWideSignTexture("BREAKER EXIT", "#1a1508", "#ffe77a"),
      emissive: 0x604208,
      emissiveIntensity: 0.36,
      roughness: 0.56,
      side: THREE.DoubleSide,
    }),
  );
  sign.position.set(mount.x, 2.42, mount.z);
  sign.rotation.y = mount.rotation;
  scene.add(sign);
}

