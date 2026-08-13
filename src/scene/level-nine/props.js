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
    const turnedSideways = Math.abs(Math.sin(house.rotation)) > 0.7;
    const halfX = turnedSideways ? 2.35 : 2.8;
    const halfZ = turnedSideways ? 2.8 : 2.65;
    colliders.push({ minX: center.x - halfX, maxX: center.x + halfX, minZ: center.z - halfZ, maxZ: center.z + halfZ });
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
  const foliage = new THREE.MeshStandardMaterial({ color: 0x172d20, emissive: 0x061109, emissiveIntensity: 0.38, roughness: 1 });
  const trunk = new THREE.MeshStandardMaterial({ color: 0x1e1b16, roughness: 1 });
  const treeGeometry = new THREE.ConeGeometry(1.4, 4.4, 7);
  const trunkGeometry = new THREE.CylinderGeometry(0.11, 0.18, 1.7, 6);
  const edgeCells = [];
  for (let col = 1; col < 51; col += 3) edgeCells.push({ col, row: 1 }, { col, row: 38 });
  for (let row = 4; row < 37; row += 4) edgeCells.push({ col: 1, row }, { col: 50, row });
  edgeCells.forEach((cell, index) => {
    const center = cellCenter(cell.col, cell.row);
    const group = new THREE.Group();
    group.name = `level-nine-tree-line-${index + 1}`;
    group.position.set(center.x + ((index % 3) - 1) * 0.42, 0, center.z + ((index % 5) - 2) * 0.28);
    const treeTrunk = new THREE.Mesh(trunkGeometry, trunk);
    treeTrunk.position.y = 0.85;
    const crown = new THREE.Mesh(treeGeometry, foliage);
    crown.position.y = 3.1;
    group.add(treeTrunk, crown);
    scene.add(group);
  });

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
