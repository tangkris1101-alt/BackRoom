import * as THREE from "three";
import {
  CELL_SIZE,
  CEILING_Y,
} from "../constants.js";
import { createWideSignTexture } from "../common/textures.js";
import { levelThreeCellCenter, getLevelThreeTargetMount, isLevelThreeOpenCell, LEVEL_THREE_BAR_POSITIONS } from "./layout.js";

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
  const panelGeometry = new THREE.BoxGeometry(1.05, 1.18, 0.12);
  panels.forEach((location, index) => {
    const center = levelThreeCellCenter(location.col, location.row);
    const mount = getLevelThreeTargetMount(center);
    const panel = new THREE.Mesh(panelGeometry, panelMaterial);
    panel.position.set(mount.x, 1.25, mount.z);
    panel.rotation.y = mount.rotation;
    scene.add(panel);

    // The cabinet is a solid 1.05 x 0.12 m steel plate (top at 1.84 m) standing
    // flush against a wall, so the collider has to follow the mount: unrotated
    // it blocks a 1.05 x 0.12 slab, and on a west/east wall the sin/cos swap
    // turns it 0.12 x 1.05. The wall itself is already blocked by the open-cell
    // test in isWalkable, so the plate only has to cover the 1.846 m it stands
    // off the cell centre.
    const cos = Math.abs(Math.cos(mount.rotation));
    const sin = Math.abs(Math.sin(mount.rotation));
    const { width, height, depth } = panelGeometry.parameters;
    colliders.push({
      minX: panel.position.x - (cos * width + sin * depth) / 2,
      maxX: panel.position.x + (cos * width + sin * depth) / 2,
      minZ: panel.position.z - (sin * width + cos * depth) / 2,
      maxZ: panel.position.z + (sin * width + cos * depth) / 2,
      topY: panel.position.y + height / 2,
    });

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
// is to find another route. The gate is yawed to span the corridor it
// blocks (see the per-cell comment below).
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

    // The rods are laid out along the group's local X, and a gate only blocks
    // a corridor if it spans the corridor's cross-section. The three row-7
    // bars sit in east-west corridors (open cells to their west and east), so
    // they need a quarter turn; (28,14) sits in the north-south connector and
    // already runs across it. Cells are read from the map rather than
    // hard-coded so a moved bar keeps blocking the right way.
    const spansEastWestCorridor =
      isLevelThreeOpenCell(col - 1, row) || isLevelThreeOpenCell(col + 1, row);

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
    group.rotation.y = spansEastWestCorridor ? Math.PI / 2 : 0;
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
  const wingGeometry = new THREE.BoxGeometry(0.6, 0.9, 0.05);
  const wingTilt = 0.5;
  const wingOffsetX = 0.32;
  const wingCenterY = 1.4;
  [-1, 1].forEach((side) => {
    const wing = new THREE.Mesh(wingGeometry, stoneMaterial);
    wing.position.set(side * wingOffsetX, wingCenterY, 0);
    wing.rotation.z = side * wingTilt;
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
  // The pedestal is only 0.8 m wide, but the tilted wings reach 0.799 m off
  // centre and 1.939 m up — the old +/-0.4 box let the player stand inside the
  // wings. Z keeps the previous 0.4 m half-depth (body r 0.32, glyph at 0.41).
  const wingHalfX =
    (Math.cos(wingTilt) * wingGeometry.parameters.width +
      Math.sin(wingTilt) * wingGeometry.parameters.height) /
    2;
  const wingHalfY =
    (Math.cos(wingTilt) * wingGeometry.parameters.height +
      Math.sin(wingTilt) * wingGeometry.parameters.width) /
    2;
  return [{
    minX: center.x - (wingOffsetX + wingHalfX),
    maxX: center.x + (wingOffsetX + wingHalfX),
    minZ: center.z - 0.4,
    maxZ: center.z + 0.4,
    topY: wingCenterY + wingHalfY,
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
  // immediately surrounding them are always completely purple" — we
  // render this as just the glowing purple patch on the wall + a faint
  // spill on the floor. No figure silhouette: every iteration of a
  // body shape (v1 invisible, v2 neon-portal, v3 dark-cutout) read as
  // a pasted-on UI element rather than a corpse fused with the wall.
  // Better to leave the figure to the player's imagination — they know
  // what the purple patch means.
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a0e3a,
    emissive: 0x4a1a6a,
    emissiveIntensity: 0.2,
    roughness: 0.65,
    metalness: 0.05,
  });
  // 1 in Generator Room, 1 near Boiler Room.
  const spots = [
    { col: 8, row: 9 },
    { col: 32, row: 18 },
  ];
  spots.forEach(({ col, row }) => {
    const center = levelThreeCellCenter(col, row);
    const mount = getLevelThreeTargetMount(center);

    // Floor stain — small dark-purple patch bleeding out from under the
    // wall spot, so it is placed from the mount rather than the cell centre:
    // the mount sits near a wall face, and for the wall-less spot it can be a
    // whole cell off the centre.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.55),
      floorMaterial,
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(mount.x, 0.045, mount.z);
    scene.add(floor);

    // Wall patch — the glowing purple energy on the wall.
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.85),
      purpleMaterial,
    );
    wall.position.set(mount.x, 1.4, mount.z);
    wall.rotation.y = mount.rotation;
    scene.add(wall);

    // Subtle purple point light — gentle wash on nearby walls.
    const light = new THREE.PointLight(0x9c4aff, 0.45, 3.0, 2);
    light.position.set(mount.x, 1.4, mount.z);
    scene.add(light);
  });
}

// New prop: Assembly Line equipment. The wiki says these rooms have
// "conveyer belts that produce all objects that are multiple and not
// confined to a specific level" — we render two static conveyor belts
// plus a handful of scattered cardboard boxes to evoke that factory feel.
export function addLevelThreeAssemblyLineEquipment(scene) {
  const colliders = [];
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
    const beltGeometry = new THREE.BoxGeometry(belt.length, 0.08, 0.7);
    const beltMesh = new THREE.Mesh(beltGeometry, beltMaterial);
    beltMesh.position.set(center.x, beltCenterY, center.z);
    scene.add(beltMesh);

    // Solid belt: the west 6 m of the model is buried inside the room's solid
    // wall, so the collider is clipped to the Assembly Line floor (col 4,
    // x = -62) instead of extending into unwalkable cells. Top is 0.59 m.
    const { width: beltWidth, height: beltHeight, depth: beltDepth } = beltGeometry.parameters;
    colliders.push({
      minX: -62,
      maxX: beltMesh.position.x + beltWidth / 2,
      minZ: beltMesh.position.z - beltDepth / 2,
      maxZ: beltMesh.position.z + beltDepth / 2,
      topY: beltMesh.position.y + beltHeight / 2,
    });

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

  // 5 scattered boxes — solid crates the player can step onto.
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

    // Every crate is rotated, so use the rotated footprint as the collider.
    // They are knee-high (0.30-0.50 m), i.e. steps the player can climb.
    const cos = Math.abs(Math.cos(box.rot));
    const sin = Math.abs(Math.sin(box.rot));
    colliders.push({
      minX: boxMesh.position.x - (cos * box.w + sin * box.d) / 2,
      maxX: boxMesh.position.x + (cos * box.w + sin * box.d) / 2,
      minZ: boxMesh.position.z - (sin * box.w + cos * box.d) / 2,
      maxZ: boxMesh.position.z + (sin * box.w + cos * box.d) / 2,
      topY: boxMesh.position.y + box.h / 2,
    });
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

  return colliders;
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
  const drumGeometry = new THREE.CylinderGeometry(0.55, 0.55, 1.4, 14);
  const drum = new THREE.Mesh(drumGeometry, drumMaterial);
  drum.position.set(drumCenter.x, 0.7, drumCenter.z);
  scene.add(drum);
  const drumCapGeometry = new THREE.CylinderGeometry(0.42, 0.55, 0.18, 14);
  const drumCap = new THREE.Mesh(drumCapGeometry, drumMaterial);
  drumCap.position.set(drumCenter.x, 1.49, drumCenter.z);
  scene.add(drumCap);

  // Solid drum (shell r 0.55, cap top at 1.58 m) plus the valve wheel 0.62 m
  // out on -X. The wheel is rotated into the Y-Z plane, so only its tube
  // radius adds to the x footprint. The drum is far taller than the jump apex,
  // so the topY below records the model top rather than a reachable step.
  const drumRadius = drumGeometry.parameters.radiusBottom;
  const valveX = drumCenter.x - 0.62;
  const valveGeometry = new THREE.TorusGeometry(0.18, 0.024, 8, 20);
  const valveReach = drumCenter.x - valveX + valveGeometry.parameters.tube;
  const boilerColliders = [{
    minX: drumCenter.x - Math.max(drumRadius, valveReach),
    maxX: drumCenter.x + drumRadius,
    minZ: drumCenter.z - drumRadius,
    maxZ: drumCenter.z + drumRadius,
    topY: drumCap.position.y + drumCapGeometry.parameters.height / 2,
  }];

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
  const valve = new THREE.Mesh(valveGeometry, valveMaterial);
  valve.position.set(valveX, 0.8, drumCenter.z);
  valve.rotation.y = Math.PI / 2;
  scene.add(valve);

  return boilerColliders;
}