import * as THREE from "three";
import {
  CELL_SIZE,
  CEILING_Y,
} from "../constants.js";
import { createWideSignTexture } from "../common/textures.js";
import { levelThreeCellCenter, getLevelThreeTargetMount, LEVEL_THREE_BAR_POSITIONS } from "./layout.js";

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
    { col: 5, row: 5 },
    { col: 8, row: 7 },
    { col: 14, row: 14 },
    { col: 11, row: 17 },
    { col: 30, row: 19 },
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

  // 3 generators — all inside the new Generator Room (rows 5-10 cols 4-10)
  const generators = [
    { col: 5, row: 8, x: -0.35, z: 0.4, rot: 0.12 },
    { col: 8, row: 6, x: 0.5, z: -0.3, rot: -0.2 },
    { col: 6, row: 9, x: -0.15, z: 0.5, rot: 0.32 },
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
    { col: 4, row: 11, axis: "x", length: CELL_SIZE * 7, y: CEILING_Y - 0.22, offsetZ: 0.85 },
    { col: 15, row: 13, axis: "x", length: CELL_SIZE * 12, y: CEILING_Y - 0.26, offsetZ: -0.88 },
    { col: 24, row: 11, axis: "x", length: CELL_SIZE * 10, y: CEILING_Y - 0.24, offsetZ: -0.88 },
    { col: 30, row: 18, axis: "x", length: CELL_SIZE * 5, y: 2.62, offsetZ: 0.88 },
  ];
  cables.forEach((cable) => {
    const center = levelThreeCellCenter(cable.col, cable.row);
    const mesh = new THREE.Mesh(cableGeometry, cableMaterial);
    mesh.scale.y = cable.length;
    mesh.position.set(center.x, cable.y, center.z + cable.offsetZ);
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
  scene.add(sign);
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
    { col: 22, row: 11, axis: "z", length: CELL_SIZE * 5, radius: 0.18, y: 2.5 },
    { col: 14, row: 13, axis: "x", length: CELL_SIZE * 6, radius: 0.14, y: 2.55, offsetZ: -0.92 },
    { col: 28, row: 13, axis: "z", length: CELL_SIZE * 4, radius: 0.16, y: 2.6, offsetX: 0.94 },
    { col: 4, row: 19, axis: "x", length: CELL_SIZE * 11, radius: 0.15, y: 2.45, offsetZ: 0.88 },
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

// Renders the indestructible bars at LEVEL_THREE_BAR_POSITIONS. Each bar
// is a small gate of 5 vertical metal rods welded between two horizontal
// beams — visually heavy, clearly impassable, and the only way through
// is to find another route.
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

  LEVEL_THREE_BAR_POSITIONS.forEach(({ col, row }) => {
    const center = levelThreeCellCenter(col, row);
    const barCount = 5;
    const spacing = CELL_SIZE * 0.18;
    const totalWidth = (barCount - 1) * spacing;

    const group = new THREE.Group();
    for (let i = 0; i < barCount; i += 1) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 2.6, 0.05),
        barMaterial,
      );
      bar.position.set(-totalWidth / 2 + i * spacing, 1.3, 0);
      group.add(bar);
    }
    const topBeam = new THREE.Mesh(
      new THREE.BoxGeometry(totalWidth + 0.2, 0.1, 0.1),
      frameMaterial,
    );
    topBeam.position.set(0, 2.62, 0);
    group.add(topBeam);
    const bottomBeam = new THREE.Mesh(
      new THREE.BoxGeometry(totalWidth + 0.2, 0.08, 0.08),
      frameMaterial,
    );
    bottomBeam.position.set(0, 0.06, 0);
    group.add(bottomBeam);
    scene.add(group);
    group.position.set(center.x, 0, center.z);
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
  // Sanctum is rows 5-10 cols 19-24. Centre cell (21, 7) gives the statue
  // room to be visible from any of the four cardinal entry cells.
  const center = levelThreeCellCenter(21, 7);
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
  const halo = new THREE.PointLight(0xffd68a, 0.6, 3.8, 2);
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
  // Repositioned to the new room walls.
  const wallPapers = [
    { col: 5, row: 5 },
    { col: 9, row: 8 },
    { col: 20, row: 5 },
    { col: 23, row: 9 },
    { col: 14, row: 17 },
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
  // 1 paper on the Assembly Line floor.
  const floorCenter = levelThreeCellCenter(9, 16);
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
  // Mural on the Sanctum west wall (col 19 row 8 — gets mounted against
  // the west wall via getLevelThreeTargetMount).
  const center = levelThreeCellCenter(19, 8);
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
    emissiveIntensity: 0.55,
    roughness: 0.5,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  // Wiki: "instances of entities and the portions of the wall
  // immediately surrounding them are always completely purple" — the
  // entity itself is also purple-fused, so we render the silhouette in
  // the same purple palette (slightly desaturated to read as 'solid form'
  // rather than 'flat patch'). The bright emissive keeps it visible
  // against the otherwise-dark L3 walls.
  const silhouetteMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a1c6a,
    emissive: 0x9c4aff,
    emissiveIntensity: 1.1,
    roughness: 0.55,
    metalness: 0.08,
  });
  // Back-glow plane behind the silhouette — fakes a bright energy source
  // embedded deeper in the wall, so the silhouette pops off the wall.
  const backGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0xc890ff,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  // 1 in Generator Room, 1 near Boiler Room.
  const spots = [
    { col: 8, row: 9 },
    { col: 32, row: 18 },
  ];
  spots.forEach(({ col, row }) => {
    const center = levelThreeCellCenter(col, row);

    // Floor patch — purple energy bleeding onto the floor under the spot.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.7),
      purpleMaterial,
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(center.x, 0.045, center.z);
    scene.add(floor);

    // Wall group — small purple patch + bright silhouette + back glow.
    const mount = getLevelThreeTargetMount(center);
    const group = new THREE.Group();
    group.position.set(mount.x, 1.4, mount.z);
    group.rotation.y = mount.rotation;

    // Wall patch — keep small so the silhouette dominates the visual.
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.7),
      purpleMaterial,
    );
    group.add(wall);

    // Back glow — bright pale-purple plane behind the silhouette so the
    // figure pops out of the wall. Sits at z=-0.05 (just behind the
    // wall patch's front face).
    const backGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 1.2),
      backGlowMaterial,
    );
    backGlow.position.set(0, 0.05, -0.05);
    group.add(backGlow);

    // Torso — pushed further out (z = 0.28) so most of it is in front of
    // the wall plane. Wider/taller than before so it reads at distance.
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.7, 0.4),
      silhouetteMaterial,
    );
    torso.position.set(0, -0.1, 0.28);
    torso.rotation.z = 0.08;
    group.add(torso);

    // Head sphere — slightly tilted.
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 14, 12),
      silhouetteMaterial,
    );
    head.position.set(0, 0.4, 0.28);
    head.rotation.z = 0.12;
    group.add(head);

    // One arm reaching further out of the wall — bent + extended.
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.55, 0.1),
      silhouetteMaterial,
    );
    arm.position.set(0.22, 0.0, 0.45);
    arm.rotation.z = -0.7;
    arm.rotation.x = -0.2;
    group.add(arm);

    // Second arm — shorter, partly visible on the other side.
    const arm2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.45, 0.1),
      silhouetteMaterial,
    );
    arm2.position.set(-0.18, -0.15, 0.32);
    arm2.rotation.z = 0.5;
    group.add(arm2);

    scene.add(group);

    // Purple point light for ambient purple wash (slightly stronger now
    // since the silhouette needs illumination to read at distance).
    const light = new THREE.PointLight(0x9c4aff, 1.1, 4.0, 2);
    light.position.set(mount.x, 1.4, mount.z);
    scene.add(light);
  });
}

// New prop: Assembly Line equipment. The wiki says these rooms have
// "conveyer belts that produce all objects that are multiple and not
// confined to a specific level" — we render two static conveyor belts
// plus a handful of scattered cardboard boxes to evoke that factory feel.
export function addLevelThreeAssemblyLineEquipment(scene) {
  const beltMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1815,
    emissive: 0x050403,
    emissiveIntensity: 0.1,
    roughness: 0.78,
    metalness: 0.42,
  });
  const rollerMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2520,
    emissive: 0x080604,
    emissiveIntensity: 0.1,
    roughness: 0.6,
    metalness: 0.5,
  });
  const boxMaterial = new THREE.MeshStandardMaterial({
    color: 0x6a4f30,
    emissive: 0x1a0e04,
    emissiveIntensity: 0.1,
    roughness: 0.88,
    metalness: 0.06,
  });
  const labelMaterial = new THREE.MeshStandardMaterial({
    color: 0xc8b890,
    emissive: 0x4a3a1c,
    emissiveIntensity: 0.18,
    roughness: 0.78,
    side: THREE.DoubleSide,
  });

  const beltCenterY = 0.55;
  const belts = [
    { col: 5, row: 14, length: CELL_SIZE * 6, axis: "x" },
    { col: 5, row: 17, length: CELL_SIZE * 6, axis: "x" },
  ];
  belts.forEach((belt) => {
    const center = levelThreeCellCenter(belt.col, belt.row);
    const beltMesh = new THREE.Mesh(
      new THREE.BoxGeometry(belt.length, 0.08, 0.7),
      beltMaterial,
    );
    beltMesh.position.set(center.x, beltCenterY, center.z);
    scene.add(beltMesh);

    const rollerPositions = [-1, 1];
    rollerPositions.forEach((sign) => {
      const roller = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.74, 10),
        rollerMaterial,
      );
      roller.position.set(center.x + sign * belt.length / 2, beltCenterY, center.z);
      roller.rotation.x = Math.PI / 2;
      scene.add(roller);
    });

    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.32),
      new THREE.MeshStandardMaterial({
        map: createWideSignTexture("ASSEMBLY", "#1a1408", "#ffd68a"),
        emissive: 0x4a2504,
        emissiveIntensity: 0.28,
        roughness: 0.6,
        side: THREE.DoubleSide,
      }),
    );
    label.position.set(center.x, beltCenterY + 0.05, center.z + 0.36);
    scene.add(label);
  });

  // 5 scattered boxes (no collision — purely decorative)
  const boxes = [
    { col: 8, row: 13, w: 0.55, h: 0.4, d: 0.5, x: 0.3, z: 0.2, rot: 0.4 },
    { col: 11, row: 15, w: 0.7, h: 0.45, d: 0.6, x: -0.4, z: 0.35, rot: -0.3 },
    { col: 14, row: 14, w: 0.5, h: 0.35, d: 0.55, x: 0.45, z: -0.25, rot: 0.15 },
    { col: 6, row: 18, w: 0.6, h: 0.5, d: 0.5, x: -0.35, z: 0.3, rot: -0.2 },
    { col: 13, row: 18, w: 0.45, h: 0.3, d: 0.45, x: 0.2, z: -0.4, rot: 0.5 },
  ];
  boxes.forEach((box) => {
    const center = levelThreeCellCenter(box.col, box.row);
    const boxMesh = new THREE.Mesh(
      new THREE.BoxGeometry(box.w, box.h, box.d),
      boxMaterial,
    );
    boxMesh.position.set(center.x + box.x, box.h / 2, center.z + box.z);
    boxMesh.rotation.y = box.rot;
    scene.add(boxMesh);
  });

  // 2 almond-water style bottles (using box, simple visual)
  const bottles = [
    { col: 7, row: 16, x: 0.3, z: -0.4 },
    { col: 12, row: 17, x: -0.4, z: 0.3 },
  ];
  bottles.forEach((bottle) => {
    const center = levelThreeCellCenter(bottle.col, bottle.row);
    const bottleMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.28, 0.1),
      labelMaterial,
    );
    bottleMesh.position.set(center.x + bottle.x, 0.14, center.z + bottle.z);
    bottleMesh.rotation.y = Math.random() * Math.PI;
    scene.add(bottleMesh);
  });
}

// New prop: Boiler Room pipes. Wiki says boiler rooms are "the source
// of the mysterious black liquid in the pipes" — render a thick vertical
// boiler drum plus a couple of large horizontal pipes so the room reads
// as "boiler".
export function addLevelThreeBoilerRoomPipe(scene) {
  const drumMaterial = new THREE.MeshStandardMaterial({
    color: 0x18181a,
    emissive: 0x1c1430,
    emissiveIntensity: 0.32,
    roughness: 0.55,
    metalness: 0.5,
  });
  const pipeMaterial = new THREE.MeshStandardMaterial({
    color: 0x0e0d10,
    emissive: 0x18052a,
    emissiveIntensity: 0.4,
    roughness: 0.5,
    metalness: 0.55,
  });
  const valveMaterial = new THREE.MeshStandardMaterial({
    color: 0x6b3520,
    emissive: 0x1a0703,
    emissiveIntensity: 0.18,
    roughness: 0.62,
    metalness: 0.32,
  });

  // Boiler drum in the NE corner of the Boiler Room.
  const drumCenter = levelThreeCellCenter(32, 18);
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 1.4, 14),
    drumMaterial,
  );
  drum.position.set(drumCenter.x, 0.7, drumCenter.z);
  scene.add(drum);
  const drumCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.55, 0.18, 14),
    drumMaterial,
  );
  drumCap.position.set(drumCenter.x, 1.49, drumCenter.z);
  scene.add(drumCap);

  // 2 large horizontal pipes running across the room.
  const pipes = [
    { col: 28, row: 17, axis: "x", length: CELL_SIZE * 6, radius: 0.22, y: 2.45, offsetZ: 0.95 },
    { col: 28, row: 19, axis: "x", length: CELL_SIZE * 6, radius: 0.18, y: 2.3, offsetZ: -0.88 },
  ];
  pipes.forEach((pipe) => {
    const center = levelThreeCellCenter(pipe.col, pipe.row);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(pipe.radius, pipe.radius, pipe.length, 14),
      pipeMaterial,
    );
    mesh.position.set(center.x, pipe.y, center.z + pipe.offsetZ);
    mesh.rotation.z = Math.PI / 2;
    scene.add(mesh);
    [-1, 1].forEach((sign) => {
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(pipe.radius * 1.25, 12, 8),
        pipeMaterial,
      );
      cap.position.set(center.x + sign * pipe.length / 2, pipe.y, center.z + pipe.offsetZ);
      scene.add(cap);
    });
  });

  // 1 valve wheel on the drum.
  const valve = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.024, 8, 20),
    valveMaterial,
  );
  valve.position.set(drumCenter.x - 0.62, 0.8, drumCenter.z);
  valve.rotation.y = Math.PI / 2;
  scene.add(valve);
}