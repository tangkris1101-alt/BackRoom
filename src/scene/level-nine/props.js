import * as THREE from "three";
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

function createLampPoolTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.92)");
  gradient.addColorStop(0.28, "rgba(255, 255, 255, 0.48)");
  gradient.addColorStop(0.68, "rgba(255, 255, 255, 0.11)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// The crown is lifted as one piece from its original ragged-pine profile (base
// 1.48/2.2/2.93/3.7, top 3.16/3.86/4.52/5.15) so that even the smallest tree
// keeps its foliage above the player's 1.75m head line: the tier-0 skirt edge
// wobbles down by up to 0.25 and the smallest size is 0.78, so the lowest
// foliage is at least (2.5 - 0.25) * 0.78 = 1.755m (measured 1.756m). Before the
// lift the same tree reached down to 0.96m, so brushing past a trunk smeared a
// tier across the camera. No collider was added: the player walks under the
// branches, and the trunks still block at +-0.3m.
const CROWN_LIFT = 1.02;
// The trunk has to reach the lifted crown base (2.5 * size) instead of floating
// below it, so it grew from 1.85 to 2.6 and its centre moved up to the new half
// height of 1.3 * size.
const TRUNK_HEIGHT = 2.6;

function createRaggedPineCrownGeometry() {
  const positions = [];
  const colors = [];
  const tiers = [
    { base: 1.48 + CROWN_LIFT, top: 3.16 + CROWN_LIFT, radius: 1.5 },
    { base: 2.2 + CROWN_LIFT, top: 3.86 + CROWN_LIFT, radius: 1.27 },
    { base: 2.93 + CROWN_LIFT, top: 4.52 + CROWN_LIFT, radius: 0.98 },
    { base: 3.7 + CROWN_LIFT, top: 5.15 + CROWN_LIFT, radius: 0.64 },
  ];
  const segments = 13;
  tiers.forEach((tier, tierIndex) => {
    for (let segment = 0; segment < segments; segment += 1) {
      const angleA = segment * Math.PI * 2 / segments;
      const angleB = (segment + 1) * Math.PI * 2 / segments;
      const radiusA = tier.radius * (0.69 + 0.34 * Math.sin(segment * 5.3 + tierIndex * 2.7));
      const radiusB = tier.radius * (0.69 + 0.34 * Math.sin((segment + 1) * 5.3 + tierIndex * 2.7));
      const edgeA = tier.base + 0.25 * Math.sin(segment * 3.7 + tierIndex);
      const edgeB = tier.base + 0.25 * Math.sin((segment + 1) * 3.7 + tierIndex);
      positions.push(
        Math.cos(angleA) * radiusA, edgeA, Math.sin(angleA) * radiusA,
        0.12 * Math.sin(tierIndex * 2.8), tier.top, 0.11 * Math.cos(tierIndex * 3.2),
        Math.cos(angleB) * radiusB, edgeB, Math.sin(angleB) * radiusB,
      );
      const shade = 0.77 + 0.16 * Math.sin(segment * 6.1 + tierIndex * 2.4);
      for (let vertex = 0; vertex < 3; vertex += 1) {
        colors.push(shade * 0.88, shade, shade * 0.83);
      }
      if ((segment * 7 + tierIndex * 3) % 4 !== 0) {
        const branchAngle = (angleA + angleB) / 2;
        const reach = tier.radius * (1.06 + 0.22 * Math.sin(segment * 2.9 + tierIndex));
        const innerRadius = tier.radius * 0.52;
        positions.push(
          Math.cos(branchAngle - 0.19) * innerRadius, tier.base + 0.43, Math.sin(branchAngle - 0.19) * innerRadius,
          Math.cos(branchAngle) * reach, tier.base - 0.11, Math.sin(branchAngle) * reach,
          Math.cos(branchAngle + 0.19) * innerRadius, tier.base + 0.4, Math.sin(branchAngle + 0.19) * innerRadius,
        );
        for (let vertex = 0; vertex < 3; vertex += 1) {
          colors.push(shade * 0.82, shade * 0.96, shade * 0.75);
        }
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function addLevelNineDetails(scene, cellCenter, { coarse = false } = {}) {
  const houseWall = new THREE.MeshStandardMaterial({ color: 0x41444c, emissive: 0x07090c, emissiveIntensity: 0.26, roughness: 0.92 });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x171b22, roughness: 0.94 });
  const windowMaterial = new THREE.MeshStandardMaterial({ color: 0xb9a766, emissive: 0xd19c3d, emissiveIntensity: 0.35, roughness: 0.42 });
  const porchMaterial = new THREE.MeshStandardMaterial({ color: 0x6a6257, roughness: 0.88 });
  const lampMetal = new THREE.MeshStandardMaterial({ color: 0x242b30, roughness: 0.8, metalness: 0.68 });
  const lampGlass = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 3.2, roughness: 0.2 });
  const roadReflector = new THREE.MeshBasicMaterial({ color: 0xc6b98c, transparent: true, opacity: 0.52 });
  const lampPoolTexture = createLampPoolTexture();
  const lampPoolGeometry = new THREE.CircleGeometry(15.2, 32);
  const colliders = [];

  HOUSE_CELLS.forEach((house, index) => {
    const center = cellCenter(house.col, house.row);
    const group = new THREE.Group();
    group.name = `level-nine-house-${index + 1}`;
    group.position.set(center.x, 0, center.z);
    group.rotation.y = house.rotation;
    const facade = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.7, 4.6), houseWall);
    facade.position.set(0, 1.35, 0.55);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.25, 1.65, 4), roofMaterial);
    roof.position.set(0, 3.02, 0.55);
    roof.rotation.y = Math.PI / 4;
    const porch = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.16, 1.3), porchMaterial);
    porch.position.set(0, 0.08, -2.28);
    group.add(facade, roof, porch);
    for (const x of [-1.72, 1.72]) {
      const window = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.7), windowMaterial);
      window.position.set(x, 1.52, -1.76);
      group.add(window);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.65, 0.08), roofMaterial);
    door.position.set(0, 0.84, -1.78);
    group.add(door);
    scene.add(group);
    // The 5.5x4.6 facade sits at local z 0.55 and the porch reaches local z
    // -2.93, so one half-extent of 2.95 covers the footprint at any of the
    // three yaws used by HOUSE_CELLS.
    colliders.push({ minX: center.x - 2.95, maxX: center.x + 2.95, minZ: center.z - 2.95, maxZ: center.z + 2.95 });
  });

  const lamps = [];
  LAMP_CELLS.slice(0, coarse ? 8 : LAMP_CELLS.length).forEach((lamp, index) => {
    const center = cellCenter(lamp.col, lamp.row);
    const poleX = center.x + (index % 2 ? 1.15 : -1.15);
    const poleZ = center.z + 1.15;
    const group = new THREE.Group();
    group.name = `level-nine-street-lamp-${index + 1}`;
    group.position.set(poleX, 0, poleZ);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 3.55, 8), lampMetal);
    pole.position.y = 1.775;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.06), lampMetal);
    arm.position.set(0.3, 3.38, 0);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), lampGlass);
    bulb.position.set(0.63, 3.19, 0);
    group.add(pole, arm, bulb);
    // The lamps are roughly 40-48m apart, so each one needs a broad but soft
    // reach to keep the road readable without turning the night scene flat.
    const light = new THREE.PointLight(0xffffff, 0, 68, 1.45);
    light.position.set(0.62, 3.05, 0);
    const poolMaterial = new THREE.MeshBasicMaterial({
      map: lampPoolTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    });
    const pool = new THREE.Mesh(lampPoolGeometry, poolMaterial);
    pool.name = `level-nine-lamp-pool-${index + 1}`;
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0.62, 0.018, 0);
    group.add(light, pool);
    scene.add(group);
    // The pole foot is 0.075m wide and the column runs to the 3.55m lamp head,
    // so it blocks every reachable feet height and needs no topY.
    colliders.push({ minX: poleX - 0.14, maxX: poleX + 0.14, minZ: poleZ - 0.14, maxZ: poleZ + 0.14 });
    lamps.push({ light, bulb, pool, phase: index * 1.71 + lamp.col * 0.13 });
  });

  for (let index = 0; index < 18; index += 1) {
    const cell = cellCenter(5 + index * 2.35, 33);
    const reflector = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.018, 0.12), roadReflector);
    reflector.position.set(cell.x, 0.022, cell.z);
    scene.add(reflector);
  }

  // A tree line and scattered hedges hide the gameplay rim in mist instead of
  // turning the suburbs into a boxed room.
  const foliage = new THREE.MeshStandardMaterial({
    color: 0x58795a, emissive: 0x28432c, emissiveIntensity: 0.4,
    roughness: 1, vertexColors: true, flatShading: true, side: THREE.DoubleSide,
  });
  const trunk = new THREE.MeshStandardMaterial({ color: 0x3a342a, roughness: 1, flatShading: true });
  const treeGeometry = createRaggedPineCrownGeometry();
  // Trunk girth is scaled up with its height so the 2.6m bare trunk still reads
  // as a pine rather than a pole; the 0.24m top stays inside the +/-0.3m trunk
  // collider.
  const trunkGeometry = new THREE.CylinderGeometry(0.14, 0.24, TRUNK_HEIGHT, 7);
  const edgeCells = [];
  for (let col = 1; col < 51; col += 3) edgeCells.push({ col, row: 1 }, { col, row: 38 });
  for (let row = 4; row < 37; row += 4) edgeCells.push({ col: 1, row }, { col: 50, row });
  const crowns = new THREE.InstancedMesh(treeGeometry, foliage, edgeCells.length);
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunk, edgeCells.length);
  crowns.name = "level-nine-tree-crowns";
  trunks.name = "level-nine-tree-trunks";
  const crownTransform = new THREE.Object3D();
  const trunkTransform = new THREE.Object3D();
  edgeCells.forEach((cell, index) => {
    const center = cellCenter(cell.col, cell.row);
    const x = center.x + ((index % 3) - 1) * 0.42;
    const z = center.z + ((index % 5) - 2) * 0.28;
    const size = 0.78 + ((index * 7) % 11) * 0.038;
    crownTransform.position.set(x, 0, z);
    crownTransform.rotation.y = index * 2.39996;
    crownTransform.scale.set(size * (0.94 + index % 4 * 0.025), size, size);
    crownTransform.updateMatrix();
    crowns.setMatrixAt(index, crownTransform.matrix);
    const tint = 0.78 + ((index * 13) % 9) * 0.025;
    crowns.setColorAt(index, new THREE.Color().setRGB(tint, tint, tint));
    trunkTransform.position.set(x, (TRUNK_HEIGHT / 2) * size, z);
    trunkTransform.rotation.y = index * 1.2;
    trunkTransform.scale.set(size, size, size);
    trunkTransform.updateMatrix();
    trunks.setMatrixAt(index, trunkTransform.matrix);
    // The trunk is 0.16-0.23m wide at its foot and disappears into the crown at
    // 2.03-3.02m, far above the player's head: a trunk-sized box with no topY
    // keeps the tree solid without letting anyone stand on it.
    colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
  });
  crowns.instanceMatrix.needsUpdate = true;
  crowns.instanceColor.needsUpdate = true;
  trunks.instanceMatrix.needsUpdate = true;
  scene.add(crowns, trunks);

  return {
    colliders,
    update(elapsed, fogSurge) {
      lamps.forEach(({ light, bulb, pool, phase }) => {
        const flicker = Math.sin(elapsed * 2.3 + phase) > 0.94 ? 0.18 : 1;
        const strength = (fogSurge ? 0.52 : 0.88) * flicker;
        light.intensity = strength * 3.6;
        bulb.material.emissiveIntensity = 2.1 + strength * 4.2;
        pool.material.opacity = (fogSurge ? 0.12 : 0.24) * flicker;
        pool.scale.setScalar(fogSurge ? 0.88 : 1);
      });
    },
  };
}
