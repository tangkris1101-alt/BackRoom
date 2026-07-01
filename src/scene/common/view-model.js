import * as THREE from "three";
import { SHOW_FIRST_PERSON_VIEW_MODEL } from "../constants.js";
export function applyViewModelMaterialSettings(material) {
  material.depthTest = false;
  material.depthWrite = false;
  return material;
}

export function createLimbSegment(start, end, radiusTop, radiusBottom, material) {
  const startVector = new THREE.Vector3(...start);
  const endVector = new THREE.Vector3(...end);
  const midpoint = startVector.clone().add(endVector).multiplyScalar(0.5);
  const direction = endVector.clone().sub(startVector);
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, direction.length(), 18, 1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(midpoint);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

export function addScaledMesh(parent, geometry, material, position, scale, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

export function createFirstPersonHazmatViewModel() {
  const group = new THREE.Group();
  group.name = "first-person-yellow-hazmat";
  group.position.set(0, 0, 0);

  const suitMaterial = applyViewModelMaterialSettings(
    new THREE.MeshStandardMaterial({
      color: 0xd8bb32,
      emissive: 0x5d4b0b,
      emissiveIntensity: 0.38,
      roughness: 0.72,
      metalness: 0,
    }),
  );
  const cuffMaterial = applyViewModelMaterialSettings(
    new THREE.MeshStandardMaterial({
      color: 0x4c3f17,
      emissive: 0x171207,
      emissiveIntensity: 0.24,
      roughness: 0.82,
    }),
  );
  const gloveMaterial = applyViewModelMaterialSettings(
    new THREE.MeshStandardMaterial({
      color: 0x111512,
      emissive: 0x050605,
      emissiveIntensity: 0.18,
      roughness: 0.66,
    }),
  );

  const sleeveConfigs = [
    {
      side: -1,
      upperStart: [-0.52, -0.62, -0.82],
      upperEnd: [-0.36, -0.49, -1.02],
      wrist: [-0.28, -0.43, -1.18],
      hand: [-0.24, -0.44, -1.3],
      rot: [0.08, -0.22, -0.22],
    },
    {
      side: 1,
      upperStart: [0.52, -0.62, -0.82],
      upperEnd: [0.36, -0.49, -1.02],
      wrist: [0.28, -0.43, -1.18],
      hand: [0.24, -0.44, -1.3],
      rot: [0.08, 0.22, 0.22],
    },
  ];

  sleeveConfigs.forEach((config) => {
    const sleeve = createLimbSegment(
      config.upperStart,
      config.upperEnd,
      0.052,
      0.076,
      suitMaterial,
    );
    group.add(sleeve);

    const forearm = createLimbSegment(
      config.upperEnd,
      config.wrist,
      0.04,
      0.058,
      suitMaterial,
    );
    group.add(forearm);

    addScaledMesh(
      group,
      new THREE.TorusGeometry(0.052, 0.01, 8, 18),
      cuffMaterial,
      config.wrist,
      [1, 0.62, 0.9],
      [Math.PI / 2, 0.18 * config.side, 0],
    );

    addScaledMesh(
      group,
      new THREE.SphereGeometry(0.054, 16, 10),
      gloveMaterial,
      config.hand,
      [1.22, 0.68, 1.55],
      config.rot,
    );

    const thumbOffset = config.side * 0.065;
    addScaledMesh(
      group,
      new THREE.CapsuleGeometry(0.012, 0.052, 4, 8),
      gloveMaterial,
      [config.hand[0] + thumbOffset, config.hand[1] - 0.006, config.hand[2] + 0.006],
      [1, 1, 1],
      [0.52, 0, 0.74 * config.side],
    );

    [-1, 0, 1].forEach((fingerOffset) => {
      addScaledMesh(
        group,
        new THREE.CapsuleGeometry(0.008, 0.042, 4, 8),
        gloveMaterial,
        [
          config.hand[0] + fingerOffset * 0.019,
          config.hand[1] - 0.012,
          config.hand[2] - 0.046,
        ],
        [1, 1, 1],
        [Math.PI / 2 + 0.18, 0, 0.08 * fingerOffset],
      );
    });
  });

  group.traverse((object) => {
    object.frustumCulled = false;
    object.renderOrder = 20;
  });

  group.userData.basePosition = group.position.clone();
  return group;
}

export function attachFirstPersonViewModel(camera) {
  if (!SHOW_FIRST_PERSON_VIEW_MODEL) return null;
  const viewModel = createFirstPersonHazmatViewModel();
  camera.add(viewModel);
  return viewModel;
}

export function getViewModelName(viewModel) {
  return viewModel ? "YELLOW HAZMAT" : "NONE";
}

export function updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition) {
  if (!viewModel) return;
  if (!viewModel.userData.previousPlayerPosition) {
    viewModel.userData.previousPlayerPosition = playerPosition.clone();
  }

  const previousPosition = viewModel.userData.previousPlayerPosition;
  const movement = Math.hypot(
    playerPosition.x - previousPosition.x,
    playerPosition.z - previousPosition.z,
  );
  previousPosition.copy(playerPosition);

  const walkAmount = Math.min(1, movement * 18);
  const breathe = Math.sin(elapsed * 1.8) * 0.006;
  const bob = Math.sin(elapsed * 9.5) * 0.012 * walkAmount;
  const sway = Math.sin(elapsed * 6.8) * 0.012 * walkAmount;
  viewModel.position.set(sway, breathe + bob, 0);
  viewModel.rotation.set(
    Math.sin(elapsed * 5.2) * 0.012 * walkAmount,
    Math.sin(elapsed * 4.4) * 0.012 * walkAmount,
    -sway * 0.18,
  );
}
