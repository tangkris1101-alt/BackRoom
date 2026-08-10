import * as THREE from "three";
import { createGameMaterial, isLowQuality } from "../common/materials.js";
import { createSeededRandom } from "../common/texture-utils.js";
import { LEVEL_TEN_WHEAT_PLOTS, levelTenCellCenter } from "./layout.js";
import { createLevelTenBarnMaps, createLevelTenRoofMaps, createWheatAtlas } from "./textures.js";

function makeWheatMaterial() {
  const lowQuality = isLowQuality();
  const material = lowQuality
    ? new THREE.MeshLambertMaterial({ map: createWheatAtlas(), color: 0xe1c65f, alphaTest: 0.22, side: THREE.DoubleSide })
    : new THREE.MeshStandardMaterial({ map: createWheatAtlas(), color: 0xe7cb68, alphaTest: 0.22, side: THREE.DoubleSide, roughness: 0.92 });
  if (!lowQuality) {
    material.userData.windTime = { value: 0 };
    material.onBeforeCompile = (shader) => {
      shader.uniforms.windTime = material.userData.windTime;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float windTime;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nfloat sway = sin(windTime * 1.35 + instanceMatrix[3].x * 0.11 + instanceMatrix[3].z * 0.09);\ntransformed.x += sway * max(position.y, 0.0) * 0.075;");
    };
    material.customProgramCacheKey = () => "level-ten-wheat-wind-v1";
  }
  return material;
}

function addWheatFields(scene, { coarse }) {
  const random = createSeededRandom(101011);
  const material = makeWheatMaterial();
  const card = new THREE.PlaneGeometry(0.62, 1.32);
  card.translate(0, 0.66, 0);
  const clumpsPerPlot = coarse ? 116 : 300;
  const meshes = [];
  LEVEL_TEN_WHEAT_PLOTS.forEach((plot, plotIndex) => {
    const first = new THREE.InstancedMesh(card, material, clumpsPerPlot);
    const second = new THREE.InstancedMesh(card, material, clumpsPerPlot);
    first.name = `level-ten-wheat-plot-${plotIndex + 1}-a`;
    second.name = `level-ten-wheat-plot-${plotIndex + 1}-b`;
    const transform = new THREE.Object3D();
    for (let index = 0; index < clumpsPerPlot; index += 1) {
      const col = plot.minCol + random() * (plot.maxCol - plot.minCol + 1);
      const row = plot.minRow + random() * (plot.maxRow - plot.minRow + 1);
      const center = levelTenCellCenter(col, row);
      const scale = 0.74 + random() * 0.48;
      transform.position.set(center.x, 0, center.z);
      transform.rotation.set(0, random() * Math.PI, 0);
      transform.scale.set(scale, scale, scale);
      transform.updateMatrix();
      first.setMatrixAt(index, transform.matrix);
      transform.rotation.y += Math.PI / 2;
      transform.updateMatrix();
      second.setMatrixAt(index, transform.matrix);
    }
    first.instanceMatrix.needsUpdate = true;
    second.instanceMatrix.needsUpdate = true;
    scene.add(first, second);
    meshes.push(first, second);
  });
  return { material, meshes };
}

function addBarn(scene) {
  const center = levelTenCellCenter(15.5, 22);
  const lowQuality = isLowQuality();
  const wallMaterial = createGameMaterial({ ...createLevelTenBarnMaps(3, 2, { detail: !lowQuality }), color: 0x9f7158, roughness: 0.9, normalScale: new THREE.Vector2(0.55, 0.55) });
  const roofMaterial = createGameMaterial({ ...createLevelTenRoofMaps(2.4, 1.4, { detail: !lowQuality }), color: 0x8d5c50, roughness: 0.75, metalness: 0.26, normalScale: new THREE.Vector2(0.45, 0.45) });
  const group = new THREE.Group();
  group.name = "level-ten-open-barn";
  group.position.set(center.x, 0, center.z);
  const addWall = (width, height, depth, x, y, z) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMaterial);
    wall.position.set(x, y, z);
    group.add(wall);
  };
  addWall(10, 4.2, 0.22, 0, 2.1, 5);
  addWall(0.22, 4.2, 10, -5, 2.1, 0);
  addWall(0.22, 4.2, 10, 5, 2.1, 0);
  addWall(3.4, 4.2, 0.22, -3.3, 2.1, -5);
  addWall(3.4, 4.2, 0.22, 3.3, 2.1, -5);
  const roofGeometry = new THREE.ConeGeometry(7.1, 2.4, 4);
  const roof = new THREE.Mesh(roofGeometry, roofMaterial);
  roof.position.y = 5.25;
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.72;
  group.add(roof);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 9.6), createGameMaterial({ color: 0x4b3926, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.018;
  group.add(floor);
  scene.add(group);
  return {
    center,
    colliders: [
      { minX: center.x - 5.1, maxX: center.x + 5.1, minZ: center.z + 4.75, maxZ: center.z + 5.25 },
      { minX: center.x - 5.25, maxX: center.x - 4.75, minZ: center.z - 5.1, maxZ: center.z + 5.1 },
      { minX: center.x + 4.75, maxX: center.x + 5.25, minZ: center.z - 5.1, maxZ: center.z + 5.1 },
      { minX: center.x - 5.1, maxX: center.x - 1.55, minZ: center.z - 5.25, maxZ: center.z - 4.75 },
      { minX: center.x + 1.55, maxX: center.x + 5.1, minZ: center.z - 5.25, maxZ: center.z - 4.75 },
    ],
    pickupPosition: { x: center.x, y: 0, z: center.z + 1.8 },
  };
}

function addFarmDetails(scene) {
  const colliders = [];
  const hedgeMaterial = createGameMaterial({ color: 0x53622b, emissive: 0x101607, emissiveIntensity: 0.18, roughness: 1 });
  const hedgeGeometry = new THREE.BoxGeometry(18, 1.25, 0.9);
  for (const [col, row, rotation] of [[8, 14.5, 0], [18, 14.5, 0], [37, 14.5, 0], [47, 14.5, 0], [16, 28.5, 0], [43, 28.5, 0]]) {
    const center = levelTenCellCenter(col, row);
    const hedge = new THREE.Mesh(hedgeGeometry, hedgeMaterial);
    hedge.position.set(center.x, 0.62, center.z);
    hedge.rotation.y = rotation;
    scene.add(hedge);
    colliders.push({ minX: center.x - 9, maxX: center.x + 9, minZ: center.z - 0.48, maxZ: center.z + 0.48 });
  }
  const pondCenter = levelTenCellCenter(45, 22);
  const pond = new THREE.Mesh(new THREE.CircleGeometry(6.4, 36), new THREE.MeshPhysicalMaterial({ color: 0x536b6f, emissive: 0x13252a, emissiveIntensity: 0.2, transparent: true, opacity: 0.78, roughness: 0.24 }));
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(pondCenter.x, 0.035, pondCenter.z);
  scene.add(pond);
  colliders.push({ minX: pondCenter.x - 5.7, maxX: pondCenter.x + 5.7, minZ: pondCenter.z - 5.7, maxZ: pondCenter.z + 5.7 });

  const hayMaterial = createGameMaterial({ color: 0xc0a148, roughness: 0.95 });
  for (const [col, row, scale] of [[12, 24, 1], [18, 19, 0.82], [10, 20, 0.72]]) {
    const center = levelTenCellCenter(col, row);
    const bale = new THREE.Mesh(new THREE.CylinderGeometry(0.85 * scale, 0.85 * scale, 1.7 * scale, 12), hayMaterial);
    bale.rotation.z = Math.PI / 2;
    bale.position.set(center.x, 0.86 * scale, center.z);
    scene.add(bale);
  }
  const scarecrow = new THREE.Group();
  scarecrow.name = "level-ten-scarecrow";
  const wood = createGameMaterial({ color: 0x4f3520, roughness: 1 });
  const cloth = createGameMaterial({ color: 0x64533b, roughness: 0.94, side: THREE.DoubleSide });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.3, 7), wood);
  post.position.y = 1.65;
  const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 2.5, 7), wood);
  cross.rotation.z = Math.PI / 2;
  cross.position.y = 2.35;
  const coat = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 1.28), cloth);
  coat.position.set(0, 1.95, 0.04);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), createGameMaterial({ color: 0xb29b66, roughness: 1 }));
  head.position.y = 2.95;
  scarecrow.add(post, cross, coat, head);
  const scarecrowCenter = levelTenCellCenter(35, 18);
  scarecrow.position.set(scarecrowCenter.x, 0, scarecrowCenter.z);
  scene.add(scarecrow);
  return colliders;
}

function addRain(scene, coarse) {
  const count = coarse ? 300 : 600;
  const positions = new Float32Array(count * 3);
  const random = createSeededRandom(101012);
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (random() - 0.5) * 180;
    positions[index * 3 + 1] = random() * 24;
    positions[index * 3 + 2] = (random() - 0.5) * 140;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xb7c6c8, size: 0.075, transparent: true, opacity: 0, depthWrite: false });
  const points = new THREE.Points(geometry, material);
  points.name = "level-ten-rain";
  scene.add(points);
  return { points, positions, material };
}

export function addLevelTenDetails(scene, { coarse = false } = {}) {
  const wheat = addWheatFields(scene, { coarse });
  const barn = addBarn(scene);
  const colliders = [...barn.colliders, ...addFarmDetails(scene)];
  const rain = addRain(scene, coarse);
  return {
    colliders,
    barnPickupPosition: barn.pickupPosition,
    update(delta, elapsed, raining) {
      if (wheat.material.userData.windTime) wheat.material.userData.windTime.value = elapsed;
      rain.material.opacity += ((raining ? 0.42 : 0) - rain.material.opacity) * Math.min(1, delta * 2.2);
      rain.points.visible = rain.material.opacity > 0.01;
      if (!rain.points.visible) return;
      for (let index = 0; index < rain.positions.length / 3; index += 1) {
        const offset = index * 3 + 1;
        rain.positions[offset] -= delta * 13;
        if (rain.positions[offset] < 0.1) rain.positions[offset] += 24;
      }
      rain.points.geometry.attributes.position.needsUpdate = true;
    },
  };
}
