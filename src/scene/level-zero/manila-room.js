import * as THREE from "three";
import { CELL_SIZE, CEILING_Y, WALL_HEIGHT } from "../constants.js";
import { createManilaWallpaperTexture } from "./textures.js";

function addBox(scene, geometry, material, position) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  scene.add(mesh);
  return mesh;
}

function createMegFolderTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 320;
  const context = canvas.getContext("2d");
  context.fillStyle = "#d6c79e";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#536044";
  context.lineWidth = 16;
  context.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
  context.fillStyle = "#536044";
  context.font = "bold 82px Arial, sans-serif";
  context.textAlign = "center";
  context.fillText("M.E.G.", canvas.width / 2, 132);
  context.font = "bold 38px Arial, sans-serif";
  context.fillText("FIELD DOCUMENTATION", canvas.width / 2, 204);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function addTableAndDocumentation(scene, center) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x473728, roughness: 0.88 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x363832, roughness: 0.72, metalness: 0.35 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xe4d9bd, roughness: 0.96 });
  const folderTexture = createMegFolderTexture();
  const folder = new THREE.MeshStandardMaterial({ map: folderTexture, roughness: 0.88 });
  const tableX = center.x + 0.3;
  const tableZ = center.z - 0.55;
  addBox(scene, new THREE.BoxGeometry(2.55, 0.13, 1.32), wood, new THREE.Vector3(tableX, 1.04, tableZ));
  for (const x of [-1.02, 1.02]) {
    for (const z of [-0.48, 0.48]) {
      addBox(scene, new THREE.BoxGeometry(0.09, 0.96, 0.09), metal, new THREE.Vector3(tableX + x, 0.53, tableZ + z));
    }
  }

  const documentOne = addBox(scene, new THREE.BoxGeometry(0.7, 0.018, 0.48), paper, new THREE.Vector3(tableX - 0.42, 1.12, tableZ - 0.12));
  documentOne.rotation.y = -0.18;
  const documentTwo = addBox(scene, new THREE.BoxGeometry(0.58, 0.024, 0.42), folder, new THREE.Vector3(tableX + 0.48, 1.125, tableZ + 0.12));
  documentTwo.rotation.y = 0.12;

  const chairX = center.x - 1.25;
  const chairZ = center.z + 0.78;
  addBox(scene, new THREE.BoxGeometry(0.78, 0.11, 0.72), wood, new THREE.Vector3(chairX, 0.57, chairZ));
  addBox(scene, new THREE.BoxGeometry(0.78, 0.75, 0.09), wood, new THREE.Vector3(chairX, 0.92, chairZ + 0.31));
  for (const x of [-0.28, 0.28]) {
    for (const z of [-0.24, 0.24]) {
      addBox(scene, new THREE.BoxGeometry(0.07, 0.52, 0.07), metal, new THREE.Vector3(chairX + x, 0.29, chairZ + z));
    }
  }

  return [{
    minX: tableX - 1.275,
    maxX: tableX + 1.275,
    minZ: tableZ - 0.66,
    maxZ: tableZ + 0.66,
  }];
}

function addInteriorWall(scene, material, width, depth, x, z) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(width, WALL_HEIGHT - 0.08, depth), material);
  wall.position.set(x, WALL_HEIGHT / 2, z);
  scene.add(wall);
}

export function createManilaRoom(scene, room, cellCenter) {
  const center = cellCenter(room.col + Math.floor(room.width / 2), room.row + Math.floor(room.height / 2));
  const halfWidth = (room.width * CELL_SIZE) / 2;
  const halfDepth = (room.height * CELL_SIZE) / 2;
  const wallpaper = new THREE.MeshStandardMaterial({
    map: createManilaWallpaperTexture(),
    color: 0xfff4d8,
    emissive: 0x54452f,
    emissiveIntensity: 0.1,
    roughness: 0.94,
  });

  // Skin only the interior-facing surfaces. The west side is deliberately
  // split around the single entrance, leaving the room's thick outer walls intact.
  addInteriorWall(scene, wallpaper, room.width * CELL_SIZE - 0.24, 0.035, center.x, center.z - halfDepth + 0.13);
  addInteriorWall(scene, wallpaper, room.width * CELL_SIZE - 0.24, 0.035, center.x, center.z + halfDepth - 0.13);
  addInteriorWall(scene, wallpaper, 0.035, room.height * CELL_SIZE - 0.24, center.x + halfWidth - 0.13, center.z);
  addInteriorWall(scene, wallpaper, 0.035, CELL_SIZE * 1.98, center.x - halfWidth + 0.13, center.z - CELL_SIZE * 1.5);
  addInteriorWall(scene, wallpaper, 0.035, CELL_SIZE * 1.98, center.x - halfWidth + 0.13, center.z + CELL_SIZE * 1.5);

  const colliders = addTableAndDocumentation(scene, center);

  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff4d2,
    emissive: 0xfff1bd,
    emissiveIntensity: 2.1,
    roughness: 0.32,
  });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.035, 1.42), panelMaterial);
  panel.position.set(center.x, CEILING_Y - 0.09, center.z);
  scene.add(panel);
  const light = new THREE.PointLight(0xffedbd, 2.25, 11.5, 2.35);
  light.position.set(center.x, CEILING_Y - 0.32, center.z);
  scene.add(light);

  return {
    center,
    colliders,
    update(elapsed) {
      const cycle = elapsed % 31;
      const blackout = cycle > 26.4 && cycle < 27.35;
      const flicker = blackout ? 0.025 : 0.84 + Math.sin(elapsed * 2.35) * 0.1 + Math.sin(elapsed * 7.8) * 0.035;
      panelMaterial.emissiveIntensity = Math.max(0.02, flicker * 2.14);
      light.intensity = Math.max(0.015, flicker * 2.3);
      return blackout;
    },
  };
}
