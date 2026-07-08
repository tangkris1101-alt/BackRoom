import * as THREE from "three";
import { createWideSignTexture } from "../common/textures.js";
import { createInteractionSpot } from "../entities/interactions.js";
import { levelOneCellCenter, getLevelOneTargetMount } from "../level-one/layout.js";

export function addLevelFourStairDoor(scene, position) {
  const mount = getLevelOneTargetMount(position);
  const doorMaterial = new THREE.MeshStandardMaterial({
    color: 0x27333a,
    emissive: 0x071013,
    emissiveIntensity: 0.16,
    roughness: 0.7,
    metalness: 0.18,
  });
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.72, 2.45, 0.09), doorMaterial);
  door.position.set(mount.x, 1.22, mount.z);
  door.rotation.y = mount.rotation;
  scene.add(door);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.25, 0.58),
    new THREE.MeshStandardMaterial({
      map: createWideSignTexture("STAIRS", "#102316", "#c7ffd6"),
      color: 0xffffff,
      emissive: 0x4aff7b,
      emissiveIntensity: 0.38,
      roughness: 0.44,
      side: THREE.DoubleSide,
    }),
  );
  sign.position.set(mount.x, 2.58, mount.z);
  sign.rotation.y = mount.rotation;
  scene.add(sign);
}

export function addLevelFourOfficeDetails(scene, interactionInitial = {}) {
  const colliders = [];
  const interactions = [];
  const partitionMaterial = new THREE.MeshStandardMaterial({
    color: 0x9fa69b,
    emissive: 0x202820,
    emissiveIntensity: 0.12,
    roughness: 0.9,
  });
  const deskMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b3a2c,
    emissive: 0x0f0905,
    emissiveIntensity: 0.08,
    roughness: 0.76,
  });
  const chairMaterial = new THREE.MeshStandardMaterial({
    color: 0x151719,
    roughness: 0.72,
    metalness: 0.18,
  });
  const indentMaterial = new THREE.MeshBasicMaterial({
    color: 0x30372f,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const glassMaterial = new THREE.MeshBasicMaterial({
    color: 0x050606,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });

  const addCollider = (x, z, halfX, halfZ) => {
    colliders.push({ minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ });
  };

  const cubicles = [
    { col: 7, row: 19 },
    { col: 11, row: 19 },
    { col: 15, row: 18 },
    { col: 20, row: 20 },
    { col: 24, row: 18 },
    { col: 7, row: 11 },
    { col: 12, row: 10 },
    { col: 18, row: 11 },
    { col: 23, row: 9 },
    { col: 27, row: 13 },
    { col: 16, row: 6 },
    { col: 21, row: 6 },
    { col: 27, row: 21 },
  ];

  cubicles.forEach((cubicle, index) => {
    const center = levelOneCellCenter(cubicle.col, cubicle.row);
    const group = new THREE.Group();
    group.position.set(center.x, 0, center.z);

    const wallA = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.24, 0.09), partitionMaterial);
    wallA.position.set(0, 0.62, -0.92);
    group.add(wallA);
    const wallB = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.24, 1.86), partitionMaterial);
    wallB.position.set(-1.12, 0.62, 0);
    group.add(wallB);

    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.16, 0.62), deskMaterial);
    desk.position.set(0.24, 0.68, -0.46);
    group.add(desk);

    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.58, 0.44), chairMaterial);
    chair.position.set(0.38, 0.32, 0.32);
    group.add(chair);

    scene.add(group);
    addCollider(center.x - 0.45, center.z - 0.44, 1.3, 0.8);
    if (index === 2 || index === 8) {
      interactions.push(
        createInteractionSpot({
          id: index === 2 ? "level-four-terminal" : "level-four-files",
          position: { x: center.x + 0.24, z: center.z - 0.46 },
          inspectHeight: 0.78,
          inspectRadius: 0.75,
          responseKey: index === 2 ? "levelFourTerminalResponse" : "levelFourFilesResponse",
          initialState: index === 2 ? interactionInitial["level-four-terminal"] ?? null : interactionInitial["level-four-files"] ?? null,
        }),
      );
    }
  });

  [
    { col: 4, row: 9, width: 2.6, depth: 1.25 },
    { col: 10, row: 5, width: 3.2, depth: 1.18 },
    { col: 23, row: 15, width: 3.4, depth: 1.2 },
    { col: 30, row: 20, width: 2.8, depth: 1.1 },
    { col: 14, row: 21, width: 2.2, depth: 1.0 },
  ].forEach((mark) => {
    const center = levelOneCellCenter(mark.col, mark.row);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(mark.width, mark.depth), indentMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = (mark.col + mark.row) % 2 === 0 ? 0.03 : -0.025;
    mesh.position.set(center.x, 0.045, center.z);
    scene.add(mesh);
  });

  const vendingPositions = [
    { col: 4, row: 6, id: "level-four-vending", color: 0x24424a },
    { col: 29, row: 6, id: "level-four-water-cooler", color: 0xb7d6e2 },
  ];
  vendingPositions.forEach((spot) => {
    const center = levelOneCellCenter(spot.col, spot.row);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.88, 1.72, 0.52),
      new THREE.MeshStandardMaterial({
        color: spot.color,
        emissive: spot.id.includes("water") ? 0x1b3842 : 0x0b1c20,
        emissiveIntensity: 0.18,
        roughness: 0.58,
        metalness: 0.08,
      }),
    );
    body.position.set(center.x, 0.86, center.z);
    scene.add(body);
    addCollider(center.x, center.z, 0.48, 0.34);
    interactions.push(
      createInteractionSpot({
        id: spot.id,
        position: center,
        inspectHeight: 0.95,
        inspectRadius: 0.74,
        responseKey:
          spot.id === "level-four-water-cooler"
            ? "levelFourWaterCoolerResponse"
            : "levelFourVendingResponse",
        initialState: interactionInitial[spot.id] ?? null,
      }),
    );
  });

  [
    { col: 11, row: 21, color: 0xb7d6e2 },
    { col: 16, row: 3, color: 0x24424a },
    { col: 25, row: 5, color: 0x55736a },
  ].forEach((spot) => {
    const center = levelOneCellCenter(spot.col, spot.row);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 1.45, 0.44),
      new THREE.MeshStandardMaterial({
        color: spot.color,
        emissive: 0x0d1a18,
        emissiveIntensity: 0.12,
        roughness: 0.62,
        metalness: 0.06,
      }),
    );
    body.position.set(center.x, 0.72, center.z);
    scene.add(body);
    addCollider(center.x, center.z, 0.4, 0.28);
  });

  [
    { col: 2, row: 4, rotation: 0 },
    { col: 11, row: 2, rotation: 0 },
    { col: 21, row: 2, rotation: 0 },
    { col: 30, row: 8, rotation: -Math.PI / 2 },
    { col: 30, row: 17, rotation: -Math.PI / 2 },
  ].forEach((windowSpot) => {
    const center = levelOneCellCenter(windowSpot.col, windowSpot.row);
    const mount = getLevelOneTargetMount(center);
    const windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.08), glassMaterial);
    windowMesh.position.set(mount.x, 1.82, mount.z);
    windowMesh.rotation.y = mount.rotation;
    scene.add(windowMesh);
  });

  [
    { col: 5, row: 21, text: "M.E.G. OUTPOST", bg: "#17231f", fg: "#c8ffe0" },
    { col: 26, row: 15, text: "NO WINDOWS", bg: "#201a16", fg: "#ffd2a4" },
    { col: 18, row: 3, text: "STOCK WATER", bg: "#17231f", fg: "#c8ffe0" },
  ].forEach((sign) => {
    const center = levelOneCellCenter(sign.col, sign.row);
    const mount = getLevelOneTargetMount(center);
    const signMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.42, 0.58),
      new THREE.MeshStandardMaterial({
        map: createWideSignTexture(sign.text, sign.bg, sign.fg),
        color: 0xffffff,
        emissive: 0x2b392e,
        emissiveIntensity: 0.16,
        roughness: 0.62,
        side: THREE.DoubleSide,
      }),
    );
    signMesh.position.set(mount.x, 2.22, mount.z);
    signMesh.rotation.y = mount.rotation;
    scene.add(signMesh);
  });

  return { colliders, interactions };
}

