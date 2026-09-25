import * as THREE from "three";
import { CELL_SIZE, CEILING_Y, WALL_HEIGHT } from "../constants.js";
import { createManilaWallpaperTexture } from "./textures.js";
import { buildDetailedTable, buildPaperSheet, createTableAssetKit } from "./table-model.js";

function addBox(parent, geometry, material, position) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  parent.add(mesh);
  return mesh;
}

const CHAIR_SEAT_TOP_Y = 0.625;
const CHAIR_BACK_TOP_Y = 1.295;
const CHAIR_HALF_WIDTH = 0.39;
const CHAIR_SEAT_HALF_DEPTH = 0.36;
// The backrest slab spans chairZ + 0.265 .. chairZ + 0.355; the seat collider
// stops at its front face so the two AABBs meet without overlapping.
const CHAIR_BACK_FRONT_OFFSET = 0.265;
const CHAIR_BACK_DEPTH = 0.09;

/**
 * Furniture layout and collision footprint of the M.E.G. documentation room.
 * Kept free of THREE so the node content checks rebuild the same AABBs.
 */
export function getManilaRoomFurniture(center) {
  const tableX = center.x + 0.3;
  const tableZ = center.z - 0.55;
  const chairX = center.x - 1.25;
  const chairZ = center.z + 0.78;
  const chairMinX = chairX - CHAIR_HALF_WIDTH;
  const chairMaxX = chairX + CHAIR_HALF_WIDTH;
  const chairBackFrontZ = chairZ + CHAIR_BACK_FRONT_OFFSET;

  return {
    tableX,
    tableZ,
    chairX,
    chairZ,
    documentationPosition: { x: tableX + 0.48, y: 1.125, z: tableZ + 0.12 },
    colliders: [
      {
        minX: tableX - 1.275,
        maxX: tableX + 1.275,
        minZ: tableZ - 0.66,
        maxZ: tableZ + 0.66,
        topY: 1.11,
      },
      // The chair is split by height: the 0.625m seat releases its side midway
      // through a jump, while the 1.295m backrest keeps blocking, so the chair
      // reads as a solid object instead of an invisible wall.
      {
        minX: chairMinX,
        maxX: chairMaxX,
        minZ: chairZ - CHAIR_SEAT_HALF_DEPTH,
        maxZ: chairBackFrontZ,
        topY: CHAIR_SEAT_TOP_Y,
      },
      {
        minX: chairMinX,
        maxX: chairMaxX,
        minZ: chairBackFrontZ,
        maxZ: chairBackFrontZ + CHAIR_BACK_DEPTH,
        topY: CHAIR_BACK_TOP_Y,
      },
    ],
  };
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
  const kit = createTableAssetKit({ woodColor: 0x473728, metalColor: 0x363832, paperTint: 0xe4d9bd });
  const wood = kit.materials.woodTop;
  const metal = kit.materials.metal;
  const folderTexture = createMegFolderTexture();
  const folder = new THREE.MeshStandardMaterial({ map: folderTexture, roughness: 0.88 });
  const furniture = getManilaRoomFurniture(center);
  const { tableX, tableZ, chairX, chairZ } = furniture;
  const table = buildDetailedTable(kit, {
    width: 2.55,
    depth: 1.32,
    topThickness: 0.13,
    topCenterY: 1.04,
    legX: 1.02,
    legZ: 0.48,
  });
  table.position.set(tableX, 0, tableZ);
  scene.add(table);

  const documentOne = buildPaperSheet(kit, { width: 0.66, depth: 0.46, seed: 77 });
  documentOne.position.set(tableX - 0.42, 1.1065, tableZ - 0.12);
  documentOne.rotation.y = -0.18;
  scene.add(documentOne);
  const documentTwo = addBox(
    scene,
    new THREE.BoxGeometry(0.58, 0.024, 0.42),
    folder,
    new THREE.Vector3(
      furniture.documentationPosition.x,
      furniture.documentationPosition.y,
      furniture.documentationPosition.z,
    ),
  );
  documentTwo.rotation.y = 0.12;

  const chair = new THREE.Group();
  chair.name = "level-zero-manila-chair";
  chair.position.set(chairX, 0, chairZ);
  addBox(chair, new THREE.BoxGeometry(0.78, 0.11, 0.72), wood, new THREE.Vector3(0, 0.57, 0));
  addBox(
    chair,
    new THREE.BoxGeometry(0.78, 0.75, CHAIR_BACK_DEPTH),
    wood,
    new THREE.Vector3(0, 0.92, CHAIR_BACK_FRONT_OFFSET + CHAIR_BACK_DEPTH / 2),
  );
  for (const x of [-0.28, 0.28]) {
    for (const z of [-0.24, 0.24]) {
      addBox(chair, new THREE.BoxGeometry(0.07, 0.52, 0.07), metal, new THREE.Vector3(x, 0.29, z));
    }
  }
  scene.add(chair);

  return {
    colliders: furniture.colliders,
    documentationPosition: furniture.documentationPosition,
  };
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

  const furnishings = addTableAndDocumentation(scene, center);

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
    colliders: furnishings.colliders,
    documentationPosition: furnishings.documentationPosition,
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
