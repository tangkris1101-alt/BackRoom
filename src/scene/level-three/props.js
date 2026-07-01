import * as THREE from "three";
import {
  CELL_SIZE,
  CEILING_Y,
} from "../constants.js";
import { createWideSignTexture } from "../common/textures.js";
import { levelThreeCellCenter, getLevelThreeTargetMount } from "./layout.js";

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
    const center = levelThreeCellCenter(location.col, location.row);
    const mount = getLevelThreeTargetMount(center);
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
    const center = levelThreeCellCenter(gen.col, gen.row);
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
    const center = levelThreeCellCenter(cable.col, cable.row);
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
  const mount = getLevelThreeTargetMount(position);
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
}

export function addLevelThreeBlackSludgePipes(scene) {
  const sludgeMaterial = new THREE.MeshStandardMaterial({
    color: 0x080705,
    emissive: 0x18052a,
    emissiveIntensity: 0.34,
    roughness: 0.55,
    metalness: 0.42,
  });
  const jointMaterial = new THREE.MeshStandardMaterial({
    color: 0x141115,
    emissive: 0x22083a,
    emissiveIntensity: 0.48,
    roughness: 0.48,
    metalness: 0.5,
  });
  const pipes = [
    { col: 22, row: 12, axis: "z", length: CELL_SIZE * 6, radius: 0.18, y: 2.5 },
    { col: 4, row: 5, axis: "x", length: CELL_SIZE * 9, radius: 0.14, y: 2.55, offsetZ: -0.92 },
    { col: 28, row: 14, axis: "z", length: CELL_SIZE * 6, radius: 0.16, y: 2.6, offsetX: 0.94 },
    { col: 4, row: 20, axis: "x", length: CELL_SIZE * 12, radius: 0.15, y: 2.45, offsetZ: 0.88 },
  ];
  pipes.forEach((pipe) => {
    const center = levelThreeCellCenter(pipe.col, pipe.row);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(pipe.radius, pipe.radius, pipe.length, 14),
      sludgeMaterial,
    );
    mesh.position.set(
      center.x + (pipe.offsetX ?? 0),
      pipe.y,
      center.z + (pipe.offsetZ ?? 0),
    );
    if (pipe.axis === "x") mesh.rotation.z = Math.PI / 2;
    if (pipe.axis === "z") mesh.rotation.x = Math.PI / 2;
    scene.add(mesh);

    [-1, 1].forEach((sign) => {
      const joint = new THREE.Mesh(
        new THREE.SphereGeometry(pipe.radius * 1.35, 12, 8),
        jointMaterial,
      );
      joint.position.copy(mesh.position);
      if (pipe.axis === "x") joint.position.x += sign * pipe.length / 2;
      if (pipe.axis === "z") joint.position.z += sign * pipe.length / 2;
      scene.add(joint);
    });
  });
}

export function addLevelThreeIndestructibleBars(scene) {
  const barMaterial = new THREE.MeshStandardMaterial({
    color: 0x0a0908,
    emissive: 0x14080a,
    emissiveIntensity: 0.08,
    roughness: 0.5,
    metalness: 0.72,
  });
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x161109,
    emissive: 0x1c0c04,
    emissiveIntensity: 0.1,
    roughness: 0.5,
    metalness: 0.6,
  });
  const gateCells = [
    { col: 6, row: 9 },
    { col: 18, row: 9 },
    { col: 28, row: 12 },
    { col: 10, row: 18 },
    { col: 26, row: 18 },
  ];
  gateCells.forEach(({ col, row }) => {
    const center = levelThreeCellCenter(col, row);
    const mount = getLevelThreeTargetMount(center);
    const barCount = 6;
    const spacing = CELL_SIZE * 0.16;
    const totalWidth = (barCount - 1) * spacing;
    const group = new THREE.Group();
    for (let i = 0; i < barCount; i += 1) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 2.0, 0.04),
        barMaterial,
      );
      bar.position.set(-totalWidth / 2 + i * spacing, 1.0, 0);
      group.add(bar);
    }
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(totalWidth + 0.18, 0.08, 0.08),
      frameMaterial,
    );
    beam.position.set(0, 2.06, 0);
    group.add(beam);
    const bottom = new THREE.Mesh(
      new THREE.BoxGeometry(totalWidth + 0.18, 0.05, 0.05),
      frameMaterial,
    );
    bottom.position.set(0, 0.04, 0);
    group.add(bottom);
    group.position.set(mount.x, 0, mount.z);
    group.rotation.y = mount.rotation;
    scene.add(group);
  });
}

export function addLevelThreeSanctumStatue(scene) {
  const stoneMaterial = new THREE.MeshStandardMaterial({
    color: 0xe8d4a8,
    emissive: 0x1a1208,
    emissiveIntensity: 0.2,
    roughness: 0.82,
    metalness: 0.05,
  });
  const darkStoneMaterial = new THREE.MeshStandardMaterial({
    color: 0xb0a08a,
    emissive: 0x1a1208,
    emissiveIntensity: 0.1,
    roughness: 0.85,
    metalness: 0.04,
  });
  const glyphMaterial = new THREE.MeshBasicMaterial({
    color: 0x080606,
  });
  const center = levelThreeCellCenter(18, 15);
  const group = new THREE.Group();
  const pedestal = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.4, 0.8),
    darkStoneMaterial,
  );
  pedestal.position.y = 0.2;
  group.add(pedestal);
  const glyph = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.3),
    glyphMaterial,
  );
  glyph.position.set(0, 0.2, 0.41);
  group.add(glyph);
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.32, 1.2, 12),
    stoneMaterial,
  );
  body.position.y = 1.0;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 10),
    stoneMaterial,
  );
  head.position.y = 1.74;
  group.add(head);
  [-1, 1].forEach((side) => {
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.9, 0.05),
      stoneMaterial,
    );
    wing.position.set(side * 0.32, 1.4, 0);
    wing.rotation.z = side * 0.5;
    group.add(wing);
  });
  [-1, 1].forEach((side) => {
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.5, 0.06),
      stoneMaterial,
    );
    arm.position.set(side * 0.22, 1.5, 0);
    arm.rotation.z = side * -0.25;
    group.add(arm);
  });
  group.position.set(center.x, 0, center.z);
  scene.add(group);
  const halo = new THREE.PointLight(0xffd68a, 0.42, 3.5, 2);
  halo.position.set(center.x, 1.7, center.z);
  scene.add(halo);
  return [{
    minX: center.x - 0.4,
    maxX: center.x + 0.4,
    minZ: center.z - 0.4,
    maxZ: center.z + 0.4,
  }];
}

export function addLevelThreeNotebookPapers(scene) {
  const paperMaterial = new THREE.MeshStandardMaterial({
    color: 0xeae0c0,
    emissive: 0x4a3a1c,
    emissiveIntensity: 0.18,
    roughness: 0.88,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const wallPapers = [
    { col: 4, row: 5 },
    { col: 14, row: 8 },
    { col: 21, row: 10 },
    { col: 7, row: 15 },
    { col: 30, row: 18 },
  ];
  wallPapers.forEach(({ col, row }) => {
    const center = levelThreeCellCenter(col, row);
    const mount = getLevelThreeTargetMount(center);
    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.24),
      paperMaterial,
    );
    paper.position.set(mount.x, 1.55, mount.z);
    paper.rotation.y = mount.rotation;
    scene.add(paper);
  });
  const floorCenter = levelThreeCellCenter(12, 12);
  const floorPaper = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.24),
    paperMaterial,
  );
  floorPaper.rotation.x = -Math.PI / 2;
  floorPaper.rotation.z = 0.7;
  floorPaper.position.set(floorCenter.x, 0.02, floorCenter.z);
  scene.add(floorPaper);
}

export function addLevelThreeMural(scene) {
  const canvasMaterial = new THREE.MeshStandardMaterial({
    color: 0xc8b89c,
    emissive: 0x4a3a1c,
    emissiveIntensity: 0.22,
    roughness: 0.85,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const figureMaterial = new THREE.MeshStandardMaterial({
    color: 0x6a5c44,
    emissive: 0x281c0a,
    emissiveIntensity: 0.1,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const smudgeMaterial = new THREE.MeshBasicMaterial({
    color: 0x0a0805,
    side: THREE.DoubleSide,
  });
  const center = levelThreeCellCenter(22, 15);
  const mount = getLevelThreeTargetMount(center);
  const canvas = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 1.2),
    canvasMaterial,
  );
  canvas.position.set(mount.x, 1.6, mount.z);
  canvas.rotation.y = mount.rotation;
  scene.add(canvas);
  const body = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.9),
    figureMaterial,
  );
  body.position.set(0, -0.05, 0.02);
  canvas.add(body);
  const head = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.32),
    figureMaterial,
  );
  head.position.set(0, 0.5, 0.02);
  canvas.add(head);
  [-1, 1].forEach((side) => {
    const wing = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.5),
      figureMaterial,
    );
    wing.position.set(side * 0.5, 0.1, 0.02);
    wing.rotation.z = side * -0.2;
    canvas.add(wing);
  });
  const smudge = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 0.36),
    smudgeMaterial,
  );
  smudge.position.set(0, 0.5, 0.04);
  canvas.add(smudge);
}

export function addLevelThreePurpificationSpots(scene) {
  const purpleMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a1c6a,
    emissive: 0x8a3aff,
    emissiveIntensity: 0.95,
    roughness: 0.5,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  const spots = [
    { col: 14, row: 18 },
    { col: 30, row: 12 },
  ];
  spots.forEach(({ col, row }) => {
    const center = levelThreeCellCenter(col, row);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.0),
      purpleMaterial,
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(center.x, 0.045, center.z);
    scene.add(floor);
    const mount = getLevelThreeTargetMount(center);
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 1.4),
      purpleMaterial,
    );
    wall.position.set(mount.x, 1.4, mount.z);
    wall.rotation.y = mount.rotation;
    scene.add(wall);
    const light = new THREE.PointLight(0x8a3aff, 1.2, 4.2, 2);
    light.position.set(center.x, 0.6, center.z);
    scene.add(light);
  });
}

