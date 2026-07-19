import * as THREE from "three";
import {
  createAlmondWaterModel,
  createDetectorModel,
  createFlashlightModel,
  createSilenceLiquidModel,
} from "../items/index.js";
import { createItemHighlight, setItemHighlight } from "../items/shared.js";

const PICKUP_RADIUS = 3;
const INSPECT_DISTANCE = 7;
const LEVEL_KEY_SPAWN_CHANCE = 0.14;
const HUB_BONUS_LEVEL_KEY_ROLLS = 2;
const KEY_MODEL_SCALE = 0.1875;

export const LEVEL_KEY_IDS = Object.freeze(Array.from({ length: 8 }, (_, level) => `level-key-${level}`));

export function isLevelKeyId(id) {
  return typeof id === "string" && LEVEL_KEY_IDS.includes(id);
}

export function getLevelKeyTarget(id) {
  if (!isLevelKeyId(id)) return null;
  return Number(id.slice("level-key-".length));
}

export const DECORATIVE_ITEM_DEFS = {
  "rusted-key": {
    color: 0x8a6841,
    shape: "key",
    i18n: {
      "zh-CN": { name: "生锈钥匙", effect: "一把无法对应任何门锁的旧钥匙", action: "F / 按钮拾取" },
      en: { name: "RUSTED KEY", effect: "AN OLD KEY THAT FITS NO VISIBLE LOCK", action: "F / BUTTON PICK UP" },
    },
  },
  "crumpled-note": {
    color: 0xd8cfaa,
    shape: "note",
    i18n: {
      "zh-CN": { name: "皱折便签", effect: "墨迹已经无法辨认", action: "F / 按钮拾取" },
      en: { name: "CRUMPLED NOTE", effect: "THE INK IS NO LONGER LEGIBLE", action: "F / BUTTON PICK UP" },
    },
  },
  "level-one-file": {
    color: 0xd8d2ad,
    shape: "file",
    i18n: {
      "zh-CN": {
        name: "M.E.G. 层级档案：Level 1",
        effect: "来自 M.E.G. 基地的生存概括",
        action: "F / 按钮拾取 · 选中后按 E 查看",
      },
      en: {
        name: "M.E.G. LEVEL 1 FILE",
        effect: "A SURVIVAL BRIEF FROM THE M.E.G. BASE",
        action: "F / BUTTON PICK UP · EQUIP AND PRESS E TO READ",
      },
    },
  },
  "empty-can": {
    color: 0x788078,
    shape: "can",
    i18n: {
      "zh-CN": { name: "空罐头", effect: "里面只剩金属和灰尘的气味", action: "F / 按钮拾取" },
      en: { name: "EMPTY CAN", effect: "ONLY METAL AND DUST REMAIN", action: "F / BUTTON PICK UP" },
    },
  },
  "wire-spool": {
    color: 0xb15d32,
    shape: "spool",
    i18n: {
      "zh-CN": { name: "电线卷", effect: "绝缘层已经脆化", action: "F / 按钮拾取" },
      en: { name: "WIRE SPOOL", effect: "THE INSULATION HAS TURNED BRITTLE", action: "F / BUTTON PICK UP" },
    },
  },
  "office-badge": {
    color: 0x7aa2b8,
    shape: "badge",
    i18n: {
      "zh-CN": { name: "办公证件", effect: "照片和姓名都被刮掉了", action: "F / 按钮拾取" },
      en: { name: "OFFICE BADGE", effect: "THE PHOTO AND NAME WERE SCRAPED OFF", action: "F / BUTTON PICK UP" },
    },
  },
  "hotel-token": {
    color: 0xc9a052,
    shape: "token",
    i18n: {
      "zh-CN": { name: "酒店代币", effect: "边缘刻着不存在的房号", action: "F / 按钮拾取" },
      en: { name: "HOTEL TOKEN", effect: "AN IMPOSSIBLE ROOM NUMBER IS ENGRAVED ON IT", action: "F / BUTTON PICK UP" },
    },
  },
  "concrete-chip": {
    color: 0x88877e,
    shape: "chip",
    i18n: {
      "zh-CN": { name: "混凝土碎片", effect: "来自一扇没有编号的枢纽门", action: "F / 按钮拾取" },
      en: { name: "CONCRETE CHIP", effect: "BROKEN FROM AN UNNUMBERED HUB DOOR", action: "F / BUTTON PICK UP" },
    },
  },
  seashell: {
    color: 0xd9c7aa,
    shape: "shell",
    i18n: {
      "zh-CN": { name: "苍白贝壳", effect: "贴近时能听见远处的管道声", action: "F / 按钮拾取" },
      en: { name: "PALE SHELL", effect: "DISTANT PIPES CAN BE HEARD INSIDE", action: "F / BUTTON PICK UP" },
    },
  },
};

export function getWorldItemDefinition(id) {
  const targetLevel = getLevelKeyTarget(id);
  if (targetLevel !== null) {
    return {
      color: 0xc49a4d,
      shape: "level-key",
      i18n: {
        "zh-CN": {
          name: `Level ${targetLevel} \u94a5\u5319`,
          effect: `\u53ea\u80fd\u5728 THE HUB \u4f7f\u7528\uff0c\u624b\u6301\u65f6\u6807\u8bb0 Level ${targetLevel} \u95e8\u7684\u4f4d\u7f6e`,
          action: "F / \u6309\u94ae\u62fe\u53d6 \u00b7 \u5728 THE HUB \u624b\u6301\u5e76\u6309 F \u5f00\u95e8",
        },
        en: {
          name: `LEVEL ${targetLevel} KEY`,
          effect: `THE HUB ONLY. EQUIP TO MARK THE LEVEL ${targetLevel} DOOR`,
          action: "F / BUTTON PICK UP · EQUIP IN THE HUB AND PRESS F TO OPEN",
        },
      },
    };
  }
  return DECORATIVE_ITEM_DEFS[id] ?? {
    color: 0x87907f,
    shape: "generic",
    i18n: {
      "zh-CN": { name: id, effect: "\u5df2\u4e22\u5f03\u7684\u7269\u54c1", action: "F / \u6309\u94ae\u62fe\u53d6" },
      en: { name: id.toUpperCase(), effect: "A DROPPED ITEM", action: "F / BUTTON PICK UP" },
    },
  };
}

function getItemDefinition(id) {
  return getWorldItemDefinition(id);
}

function createNoteFaceMaterial(color) {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 224;
  const context = canvas.getContext("2d");
  context.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(91, 72, 45, 0.22)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(16, 38);
  context.quadraticCurveTo(92, 28, 166, 42);
  context.quadraticCurveTo(236, 55, 308, 39);
  context.moveTo(22, 180);
  context.quadraticCurveTo(110, 166, 188, 184);
  context.quadraticCurveTo(246, 194, 302, 177);
  context.stroke();

  context.strokeStyle = "rgba(37, 42, 68, 0.8)";
  context.lineWidth = 4;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(54, 91);
  context.quadraticCurveTo(77, 77, 101, 89);
  context.quadraticCurveTo(119, 98, 140, 85);
  context.moveTo(51, 117);
  context.quadraticCurveTo(76, 104, 102, 116);
  context.quadraticCurveTo(120, 124, 147, 108);
  context.moveTo(182, 133);
  context.quadraticCurveTo(205, 112, 225, 129);
  context.quadraticCurveTo(242, 143, 266, 123);
  context.stroke();
  context.fillStyle = "rgba(37, 42, 68, 0.72)";
  context.font = "italic 22px serif";
  context.fillText("...keep moving", 164, 82);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, metalness: 0 });
}

function createLevelFileFaceMaterial() {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 300;
  const context = canvas.getContext("2d");
  context.fillStyle = "#d8d2ad";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#31443a";
  context.lineWidth = 10;
  context.strokeRect(13, 13, canvas.width - 26, canvas.height - 26);
  context.fillStyle = "#31443a";
  context.textAlign = "center";
  context.font = "bold 56px Arial, sans-serif";
  context.fillText("M.E.G.", canvas.width / 2, 92);
  context.font = "bold 32px Arial, sans-serif";
  context.fillText("LEVEL 1", canvas.width / 2, 145);
  context.font = "22px Arial, sans-serif";
  context.fillText("HABITABLE ZONE", canvas.width / 2, 184);
  context.strokeStyle = "rgba(49, 68, 58, 0.48)";
  context.lineWidth = 4;
  for (let y = 212; y < 268; y += 17) {
    context.beginPath();
    context.moveTo(56, y);
    context.lineTo(344, y);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 3;
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.88, metalness: 0 });
}

export function createWorldItemModel(id) {
  const toolModelFactories = {
    flashlight: createFlashlightModel,
    detector: createDetectorModel,
    "silence-liquid": createSilenceLiquidModel,
    "almond-water": () => createAlmondWaterModel("normal"),
    "super-almond-water": () => createAlmondWaterModel("super"),
  };
  const createToolModel = toolModelFactories[id];
  if (createToolModel) return createToolModel();

  const definition = getItemDefinition(id);
  const material = new THREE.MeshStandardMaterial({
    color: definition.color,
    roughness: 0.78,
    metalness: definition.shape === "key" || definition.shape === "level-key" || definition.shape === "can" || definition.shape === "token" ? 0.36 : 0.05,
  });
  const group = new THREE.Group();

  if (definition.shape === "key" || definition.shape === "level-key") {
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.1), material);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 8, 18), material);
    ring.rotation.x = Math.PI / 2;
    ring.position.x = -0.32;
    group.add(shaft, ring);
    if (definition.shape === "level-key") {
      const ward = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.22), material);
      ward.position.x = 0.28;
      group.add(ward);
    }
    group.scale.setScalar(KEY_MODEL_SCALE);
  } else if (definition.shape === "note") {
    group.add(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.025, 0.34), material));
    const inkedFace = new THREE.Mesh(
      new THREE.PlaneGeometry(0.455, 0.315),
      createNoteFaceMaterial(definition.color),
    );
    inkedFace.rotation.x = -Math.PI / 2;
    inkedFace.position.y = 0.014;
    group.add(inkedFace);
  } else if (definition.shape === "file") {
    group.add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.035, 0.44), material));
    const cover = new THREE.Mesh(
      new THREE.PlaneGeometry(0.59, 0.41),
      createLevelFileFaceMaterial(),
    );
    cover.rotation.x = -Math.PI / 2;
    cover.position.y = 0.02;
    group.add(cover);
  } else if (definition.shape === "badge") {
    group.add(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.025, 0.34), material));
  } else if (definition.shape === "can") {
    group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.38, 16), material));
  } else if (definition.shape === "spool") {
    const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.25, 16), material);
    spool.rotation.z = Math.PI / 2;
    group.add(spool);
  } else if (definition.shape === "token") {
    const token = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.045, 20), material);
    token.rotation.z = Math.PI / 2;
    group.add(token);
  } else if (definition.shape === "shell") {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), material);
    shell.scale.set(1, 0.55, 0.78);
    group.add(shell);
  } else {
    group.add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), material));
  }

  group.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = false;
    object.receiveShadow = false;
  });
  return group;
}

export function createWorldItemManager(scene, defaultSpawns = [], initialState = null, options = {}) {
  const savedItems = Array.isArray(initialState) ? initialState : null;
  const sourceItems = savedItems ? [...savedItems] : [...defaultSpawns];
  // Preserve existing save state, but introduce explicitly flagged authored
  // items to older saves without reviving previously picked up world items.
  if (savedItems) {
    for (const spawn of defaultSpawns) {
      if (spawn.ensureOnExistingSave && !sourceItems.some((item) => item?.id === spawn.id)) {
        sourceItems.push(spawn);
      }
    }
  }
  const levelKeyAnchors = options.levelKeyAnchors?.length ? options.levelKeyAnchors : defaultSpawns;
  const usedLevelKeyIds = new Set(
    sourceItems.filter((item) => isLevelKeyId(item?.id)).map((item) => item.id),
  );
  const activeLevelKeyCount = sourceItems.filter(
    (item) => isLevelKeyId(item?.id) && item.active !== false,
  ).length;

  function addLevelKey() {
    const candidates = LEVEL_KEY_IDS.filter((id) => !usedLevelKeyIds.has(id));
    if (candidates.length === 0 || levelKeyAnchors.length === 0) return false;
    const anchor = levelKeyAnchors[Math.floor(Math.random() * levelKeyAnchors.length)];
    const id = candidates[Math.floor(Math.random() * candidates.length)];
    sourceItems.push({
      id,
      active: true,
      position: {
        x: anchor.position.x + (Math.random() - 0.5) * 1.2,
        y: 0.08,
        z: anchor.position.z + (Math.random() - 0.5) * 1.2,
      },
      rotation: Math.random() * Math.PI * 2,
      tiltX: (Math.random() - 0.5) * 0.16,
      tiltZ: (Math.random() - 0.5) * 0.16,
    });
    usedLevelKeyIds.add(id);
    return true;
  }

  const minimumLevelKeys = Math.max(0, Math.floor(options.minimumLevelKeys ?? 0));
  for (let count = activeLevelKeyCount; count < minimumLevelKeys; count += 1) {
    if (!addLevelKey()) break;
  }

  if (!savedItems && minimumLevelKeys > 0) {
    for (let roll = 0; roll < HUB_BONUS_LEVEL_KEY_ROLLS; roll += 1) {
      if (Math.random() < LEVEL_KEY_SPAWN_CHANCE) addLevelKey();
    }
  } else if (minimumLevelKeys === 0 && activeLevelKeyCount === 0 && Math.random() < LEVEL_KEY_SPAWN_CHANCE) {
    addLevelKey();
  }
  const items = [];

  function addItem(raw) {
    if (!raw?.id || !raw.position) return null;
    const model = createWorldItemModel(raw.id);
    model.position.set(raw.position.x, raw.position.y ?? 0.24, raw.position.z);
    model.rotation.set(raw.tiltX ?? 0, raw.rotation ?? 0, raw.tiltZ ?? 0);
    model.visible = raw.active !== false;
    scene.add(model);
    const highlight = createItemHighlight({ color: 0xc9f7aa, width: 0.76, height: 0.72, depth: 0.76, y: 0.34 });
    model.add(highlight);
    const item = { id: raw.id, model, highlight, active: raw.active !== false, data: raw.data ?? null };
    items.push(item);
    return item;
  }

  sourceItems.forEach(addItem);

  function stateFor(item, playerPosition) {
    const distance = Math.hypot(
      playerPosition.x - item.model.position.x,
      playerPosition.z - item.model.position.z,
    );
    return {
      id: item.id,
      itemId: item.id,
      type: "item",
      decorative: Boolean(DECORATIVE_ITEM_DEFS[item.id]),
      active: item.active,
      visible: item.active,
      available: item.active && distance <= PICKUP_RADIUS,
      distance,
      position: { x: item.model.position.x, y: item.model.position.y, z: item.model.position.z },
      i18n: getItemDefinition(item.id).i18n,
    };
  }

  function update(playerPosition) {
    return items.filter((item) => {
      setItemHighlight(item.highlight, false);
      return item.active;
    }).map((item) => stateFor(item, playerPosition));
  }

  function inspect(camera) {
    const direction = new THREE.Vector3();
    const toItem = new THREE.Vector3();
    camera.getWorldDirection(direction);
    let focused = null;
    let bestScore = 0.94;
    for (const item of items) {
      if (!item.active) continue;
      const distance = camera.position.distanceTo(item.model.position);
      if (distance > INSPECT_DISTANCE) continue;
      const score = direction.dot(toItem.copy(item.model.position).sub(camera.position).normalize());
      if (score <= bestScore) continue;
      bestScore = score;
      const definition = getItemDefinition(item.id);
      focused = {
        id: item.id,
        type: "item",
        distance,
        position: { x: item.model.position.x, y: item.model.position.y, z: item.model.position.z },
        i18n: definition.i18n,
        ...definition.i18n.en,
      };
    }
    if (focused) {
      const highlighted = items.find((item) => item.active && item.id === focused.id &&
        Math.hypot(item.model.position.x - focused.position.x, item.model.position.z - focused.position.z) < 0.01);
      if (highlighted) setItemHighlight(highlighted.highlight, focused.distance <= PICKUP_RADIUS);
    }
    return focused;
  }

  function getPickupTarget(playerPosition) {
    return items
      .filter((item) => item.active)
      .map((item) => ({ item, state: stateFor(item, playerPosition) }))
      .filter(({ state }) => state.available)
      .sort((a, b) => a.state.distance - b.state.distance)[0]?.state ?? null;
  }

  function tryPickup(playerPosition) {
    const target = getPickupTarget(playerPosition);
    if (!target) return null;
    const item = items.find((candidate) => candidate.active && candidate.id === target.id &&
      Math.hypot(candidate.model.position.x - playerPosition.x, candidate.model.position.z - playerPosition.z) <= PICKUP_RADIUS);
    if (!item) return null;
    item.active = false;
    item.model.visible = false;
    return { pickedUp: true, itemId: item.id, count: 1, data: item.data };
  }

  function drop(id, position, yaw = 0, data = null) {
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    return addItem({
      id,
      active: true,
      position: { x: position.x + forwardX * 1.15, y: 0, z: position.z + forwardZ * 1.15 },
      rotation: yaw + Math.PI * 0.5,
      tiltX: 0.12,
      tiltZ: -0.08,
      data,
    });
  }

  return {
    update,
    inspect,
    getPickupTarget,
    tryPickup,
    drop,
    getState: () => items.map((item) => ({
      id: item.id,
      active: item.active,
      position: {
        x: item.model.position.x,
        y: item.model.position.y,
        z: item.model.position.z,
      },
      rotation: item.model.rotation.y,
      tiltX: item.model.rotation.x,
      tiltZ: item.model.rotation.z,
      data: item.data,
    })),
  };
}
