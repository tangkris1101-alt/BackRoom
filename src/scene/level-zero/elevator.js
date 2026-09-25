import * as THREE from "three";
import { createSeededRandom } from "../common/texture-utils.js";
import { CELL_SIZE } from "../constants.js";

export const LEVEL_ZERO_ELEVATOR_ID = "level-zero-elevator-level-one";

const CABIN_ROTATION = -Math.PI / 2;
const HALF_WIDTH = 1.17;
const FRONT = 0.83;
const BACK = -0.94;
const BACK_WALL_DEPTH = 0.14;
const DOOR_FRONT_OFFSET = 0.055;
const DOOR_DEPTH = 0.074;
const FOCUS_ANGLE_COS = Math.cos(0.58);
const focusForward = new THREE.Vector3();
const focusOffset = new THREE.Vector3();

export function getLevelZeroElevatorFocus(camera, doorCenter, callPosition) {
  if (!camera) return null;
  camera.getWorldDirection(focusForward);
  let best = null;
  for (const [target, point] of [
    ["door", { ...doorCenter, y: 1.35 }],
    ["call", { ...callPosition, y: 1.31 }],
  ]) {
    focusOffset.set(point.x - camera.position.x, point.y - camera.position.y, point.z - camera.position.z);
    const distance = focusOffset.length();
    if (distance > 8 || distance < 0.001) continue;
    const alignment = focusForward.dot(focusOffset) / distance;
    if (alignment < FOCUS_ANGLE_COS || (best && alignment <= best.alignment)) continue;
    best = { target, distance, alignment };
  }
  return best;
}

export function getLevelZeroElevatorWallMount(cellPosition) {
  // Set the sliding leaves into the east-wall opening. The cabin extends
  // into the concealed shaft cell behind it, while its call box faces west.
  const wallPlaneX = cellPosition.x + CELL_SIZE / 2;
  return {
    x: wallPlaneX + FRONT + DOOR_FRONT_OFFSET + DOOR_DEPTH / 2,
    z: cellPosition.z,
  };
}

const ROUTE_TEXT = {
  "zh-CN": {
    name: "通往 LEVEL 1 的电梯",
    effect: "轿厢下方传来持续的电机低鸣",
    action: "F / 按钮开门",
    response: "电梯门缓缓滑开；走入轿厢前往 LEVEL 1",
  },
  en: {
    name: "ELEVATOR TO LEVEL 1",
    effect: "A MOTOR HUMS BENEATH THE CABIN",
    action: "F / BUTTON OPEN",
    response: "THE DOORS SLIDE OPEN; ENTER FOR LEVEL 1",
  },
};

function makeCanvasTexture(canvas, colorSpace = THREE.NoColorSpace) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  return texture;
}

function createPaintedSteelMaps(seed) {
  // A full 1024px sheet is used exactly once per leaf: there are no visible
  // 512px repeats or stretched metal photos across the 2.36m door height.
  const size = 1024;
  const colorCanvas = document.createElement("canvas");
  const normalCanvas = document.createElement("canvas");
  const roughCanvas = document.createElement("canvas");
  for (const canvas of [colorCanvas, normalCanvas, roughCanvas]) {
    canvas.width = size;
    canvas.height = size;
  }
  const colorContext = colorCanvas.getContext("2d");
  const normalContext = normalCanvas.getContext("2d");
  const roughContext = roughCanvas.getContext("2d");
  const color = colorContext.createImageData(size, size);
  const normal = normalContext.createImageData(size, size);
  const rough = roughContext.createImageData(size, size);
  const heights = new Float32Array(size * size);
  const random = createSeededRandom(seed);
  const stripNoise = Array.from({ length: size }, () => random() - 0.5);
  const scratchLines = Array.from({ length: 31 }, () => ({
    x: Math.floor(random() * size),
    top: Math.floor(random() * size * 0.78),
    length: 34 + Math.floor(random() * 360),
    strength: 0.15 + random() * 0.6,
  }));
  const scratches = new Float32Array(size * size);
  for (const line of scratchLines) {
    const bottom = Math.min(size, line.top + line.length);
    for (let y = line.top; y < bottom; y += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const x = line.x + dx;
        if (x < 0 || x >= size) continue;
        const pixel = y * size + x;
        scratches[pixel] = Math.max(scratches[pixel], line.strength * (dx === 0 ? 1 : 0.45));
      }
    }
  }

  for (let y = 0; y < size; y += 1) {
    const edgeWear = Math.pow(Math.abs(y / size - 0.5) * 2, 3);
    for (let x = 0; x < size; x += 1) {
      const pixel = y * size + x;
      const offset = pixel * 4;
      const grain = random() - 0.5;
      const broad = Math.sin(x * 0.015 + seed) * 2.5 + Math.sin(y * 0.009 + seed * 0.3) * 1.8;
      const brush = stripNoise[x] * 4 + Math.sin(x * 0.8) * 1.4;
      const wear = edgeWear * (1.7 + Math.sin(x * 0.026 + seed) * 1.2);
      const scratch = scratches[pixel];
      const lowerDust = Math.max(0, (y / size - 0.71) / 0.29);
      const oxide = lowerDust * lowerDust * (4 + Math.max(0, Math.sin(x * 0.041 + seed) * 4));
      const shade = broad + brush + grain * 12 - wear * 5 + scratch * 30;
      color.data[offset] = 191 + shade * 1.55 - oxide * 0.4;
      color.data[offset + 1] = 187 + shade * 1.45 - oxide;
      color.data[offset + 2] = 166 + shade * 1.35 - oxide * 1.6;
      color.data[offset + 3] = 255;
      const height = brush * 0.7 + grain * 8 - scratch * 8;
      heights[pixel] = height;
      const roughness = Math.max(0, Math.min(255, 163 + grain * 31 + wear * 28 - scratch * 26));
      rough.data[offset] = roughness;
      rough.data[offset + 1] = roughness;
      rough.data[offset + 2] = roughness;
      rough.data[offset + 3] = 255;
    }
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const left = heights[y * size + Math.max(0, x - 1)];
      const right = heights[y * size + Math.min(size - 1, x + 1)];
      const up = heights[Math.max(0, y - 1) * size + x];
      const down = heights[Math.min(size - 1, y + 1) * size + x];
      normal.data[offset] = Math.max(0, Math.min(255, 128 - (right - left) * 1.25));
      normal.data[offset + 1] = Math.max(0, Math.min(255, 128 - (down - up) * 1.25));
      normal.data[offset + 2] = 252;
      normal.data[offset + 3] = 255;
    }
  }
  colorContext.putImageData(color, 0, 0);
  normalContext.putImageData(normal, 0, 0);
  roughContext.putImageData(rough, 0, 0);

  return {
    map: makeCanvasTexture(colorCanvas, THREE.SRGBColorSpace),
    normalMap: makeCanvasTexture(normalCanvas),
    roughnessMap: makeCanvasTexture(roughCanvas),
  };
}

function createTreadPlateMaps() {
  const size = 512;
  const colorCanvas = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  for (const canvas of [colorCanvas, bumpCanvas]) {
    canvas.width = size;
    canvas.height = size;
  }
  const color = colorCanvas.getContext("2d");
  const bump = bumpCanvas.getContext("2d");
  color.fillStyle = "#50534b";
  color.fillRect(0, 0, size, size);
  bump.fillStyle = "#777777";
  bump.fillRect(0, 0, size, size);
  const random = createSeededRandom(0xe1e0a7);
  for (let y = 0; y < size; y += 32) {
    for (let x = 0; x < size; x += 32) {
      const shiftedX = x + (Math.floor(y / 32) % 2) * 16;
      for (const [context, shade] of [[color, 92], [bump, 196]]) {
        context.save();
        context.translate(shiftedX + 8, y + 16);
        context.rotate(Math.PI / 4);
        context.fillStyle = `rgb(${shade},${shade},${Math.max(0, shade - 5)})`;
        context.fillRect(-11, -2.3, 22, 4.6);
        context.restore();
      }
    }
  }
  for (let i = 0; i < 1400; i += 1) {
    const x = random() * size;
    const y = random() * size;
    color.fillStyle = `rgba(15,16,13,${random() * 0.14})`;
    color.fillRect(x, y, 1.5, 1.5);
  }
  return {
    map: makeCanvasTexture(colorCanvas, THREE.SRGBColorSpace),
    bumpMap: makeCanvasTexture(bumpCanvas),
  };
}

function addBox(group, name, dimensions, position, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), material);
  mesh.name = name;
  mesh.position.set(...position);
  group.add(mesh);
  return mesh;
}

function createElevatorSign(text, foreground = "#e3edd3") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  context.fillStyle = "#17231e";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = foreground;
  context.font = "bold 80px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 256, 84);
  return makeCanvasTexture(canvas, THREE.SRGBColorSpace);
}

function toWorldWithRotation(position, rotation, localX, localZ) {
  return {
    x: position.x + Math.cos(rotation) * localX + Math.sin(rotation) * localZ,
    z: position.z - Math.sin(rotation) * localX + Math.cos(rotation) * localZ,
  };
}

function toLocalWithRotation(position, rotation, worldX, worldZ) {
  const dx = worldX - position.x;
  const dz = worldZ - position.z;
  return {
    x: Math.cos(rotation) * dx - Math.sin(rotation) * dz,
    z: Math.sin(rotation) * dx + Math.cos(rotation) * dz,
  };
}

const CABIN_DOOR_OFFSET = FRONT + DOOR_FRONT_OFFSET + DOOR_DEPTH / 2;

// Origin of the cabin group for a given door plane, so the sliding leaves sit
// flush with the wall and the cabin recesses into the concealed shaft.
export function getElevatorCabOrigin(doorPlane, rotation = CABIN_ROTATION) {
  return {
    x: doorPlane.x - Math.sin(rotation) * CABIN_DOOR_OFFSET,
    z: doorPlane.z - Math.cos(rotation) * CABIN_DOOR_OFFSET,
  };
}

export function createElevatorCab(scene, position, initialState = null, {
  id = LEVEL_ZERO_ELEVATOR_ID,
  name = "level-zero-service-elevator",
  rotation = CABIN_ROTATION,
  signText = "↓  LEVEL 1",
  routeText = ROUTE_TEXT,
  targetLevel = 1,
  registerExitRoute = true,
  arrival = false,
  arriveOpen = false,
} = {}) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(position.x, 0, position.z);
  group.rotation.y = rotation;
  scene.add(group);

  const steelA = createPaintedSteelMaps(0xe1e0a1);
  const steelB = createPaintedSteelMaps(0xe1e0b2);
  const tread = createTreadPlateMaps();
  const steelMaterial = (maps) => new THREE.MeshStandardMaterial({
    ...maps,
    color: 0xf7f4e7,
    emissive: 0x392f1d,
    emissiveIntensity: 0.12,
    metalness: 0.18,
    roughness: 0.72,
    normalScale: new THREE.Vector2(0.84, 0.84),
  });
  const doorA = steelMaterial(steelA);
  const doorB = steelMaterial(steelB);
  const outerSteel = steelMaterial(steelA);
  const frameSteel = new THREE.MeshStandardMaterial({
    ...steelA,
    color: 0xd7d2bd,
    emissive: 0x3a3424,
    emissiveIntensity: 0.13,
    metalness: 0.12,
    roughness: 0.78,
    normalScale: new THREE.Vector2(0.46, 0.46),
  });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x4a4d42, metalness: 0.34, roughness: 0.66 });
  const edgeMetal = new THREE.MeshStandardMaterial({ color: 0x777c72, metalness: 0.75, roughness: 0.4 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x171a18, metalness: 0.02, roughness: 0.94 });
  const cabinFloor = new THREE.MeshStandardMaterial({
    ...tread,
    bumpScale: 0.028,
    metalness: 0.65,
    roughness: 0.63,
  });
  const lit = new THREE.MeshStandardMaterial({
    color: 0xf6ebc7,
    emissive: 0xffdf98,
    emissiveIntensity: 2.1,
    roughness: 0.32,
  });

  // Physically closed sides/back, with the front opening left between jambs.
  addBox(group, "elevator-left-wall", [0.13, 2.86, 1.8], [-HALF_WIDTH, 1.43, -0.06], outerSteel);
  addBox(group, "elevator-right-wall", [0.13, 2.86, 1.8], [HALF_WIDTH, 1.43, -0.06], outerSteel);
  addBox(group, "elevator-back-wall", [2.48, 2.86, BACK_WALL_DEPTH], [0, 1.43, BACK], outerSteel);
  addBox(group, "elevator-roof", [2.48, 0.13, 1.85], [0, 2.87, -0.06], outerSteel);
  addBox(group, "elevator-floor", [2.24, 0.08, 1.69], [0, 0.045, -0.04], cabinFloor);
  addBox(group, "elevator-floor-threshold", [2.07, 0.025, 0.19], [0, 0.095, FRONT], edgeMetal);
  addBox(group, "elevator-header", [2.53, 0.42, 0.19], [0, 2.69, FRONT], frameSteel);
  addBox(group, "elevator-left-jamb", [0.23, 2.55, 0.22], [-1.16, 1.28, FRONT], frameSteel);
  addBox(group, "elevator-right-jamb", [0.23, 2.55, 0.22], [1.16, 1.28, FRONT], frameSteel);
  // Side housings hide the sliding leaves as they retract. A thin lintel
  // ties them into the cabin rather than leaving two floating wall panels.
  for (const side of [-1, 1]) {
    addBox(group, `elevator-door-pocket-${side}`, [0.94, 2.39, 0.15], [side * 1.68, 1.27, FRONT + 0.18], frameSteel);
    addBox(group, `elevator-pocket-seam-${side}`, [0.025, 2.35, 0.18], [side * 1.22, 1.27, FRONT + 0.2], darkMetal);
    for (const bandY of [0.19, 2.34]) {
      addBox(group, `elevator-pocket-band-${side}-${bandY}`, [0.89, 0.026, 0.02], [side * 1.68, bandY, FRONT + 0.27], edgeMetal);
    }
  }
  addBox(group, "elevator-pocket-lintel", [4.32, 0.16, 0.18], [0, 2.53, FRONT + 0.16], frameSteel);
  addBox(group, "elevator-upper-rail", [2.13, 0.065, 0.13], [0, 2.42, FRONT + 0.03], edgeMetal);
  addBox(group, "elevator-lower-track", [2.13, 0.038, 0.16], [0, 0.07, FRONT + 0.03], darkMetal);

  // Front/back are single-use PBR sheets. The narrow sides receive a plain
  // brushed edge material so their UVs never stretch the door's scratches.
  const panelMaterialsA = [edgeMetal, edgeMetal, edgeMetal, edgeMetal, doorA, doorA];
  const panelMaterialsB = [edgeMetal, edgeMetal, edgeMetal, edgeMetal, doorB, doorB];
  const leftPanel = addBox(group, "elevator-sliding-door-left", [1.035, 2.34, DOOR_DEPTH], [-0.52, 1.26, FRONT + DOOR_FRONT_OFFSET], panelMaterialsA);
  const rightPanel = addBox(group, "elevator-sliding-door-right", [1.035, 2.34, DOOR_DEPTH], [0.52, 1.26, FRONT + DOOR_FRONT_OFFSET], panelMaterialsB);
  for (const panel of [leftPanel, rightPanel]) {
    addBox(panel, `${panel.name}-edge`, [0.027, 2.3, 0.095], [panel === leftPanel ? 0.505 : -0.505, 0, 0], rubber);
    addBox(panel, `${panel.name}-base-guard`, [0.97, 0.12, 0.012], [0, -1.03, 0.046], darkMetal);
    // Shallow folded ribs cast readable highlights without fake reflection.
    for (const ribX of [-0.36, 0.36]) {
      addBox(panel, `${panel.name}-fold`, [0.012, 2.03, 0.012], [ribX, 0.04, 0.047], edgeMetal);
    }
  }
  const boltGeometry = new THREE.SphereGeometry(0.025, 8, 6);
  for (const side of [-1, 1]) {
    for (const y of [0.31, 0.8, 1.29, 1.78, 2.27]) {
      const bolt = new THREE.Mesh(boltGeometry, edgeMetal);
      bolt.name = `elevator-frame-bolt-${side}-${y}`;
      bolt.position.set(side * 1.16, y, FRONT + 0.125);
      group.add(bolt);
    }
  }

  // Lit landing label and call button make the service lift legible from the
  // yellow maze; the cabin itself keeps the more utilitarian metal palette.
  const signMaterial = new THREE.MeshStandardMaterial({
    map: createElevatorSign(signText),
    emissive: 0x718760,
    emissiveIntensity: 0.58,
    roughness: 0.42,
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 0.54), signMaterial);
  sign.name = "elevator-level-one-sign";
  sign.position.set(0, 3.09, FRONT + 0.26);
  group.add(sign);
  addBox(group, "elevator-call-box", [0.3, 0.54, 0.12], [1.68, 1.28, FRONT + 0.32], darkMetal);
  const callButton = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.022, 28), lit);
  callButton.name = "elevator-call-button";
  callButton.rotation.x = Math.PI / 2;
  callButton.position.set(1.68, 1.31, FRONT + 0.399);
  group.add(callButton);
  const signal = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.08), lit);
  signal.name = "elevator-landing-indicator";
  signal.position.set(1.68, 1.51, FRONT + 0.395);
  group.add(signal);

  addBox(group, "elevator-cabin-lamp-housing", [1.42, 0.06, 0.35], [0, 2.77, -0.18], darkMetal);
  addBox(group, "elevator-cabin-lamp", [1.23, 0.025, 0.24], [0, 2.723, -0.18], lit);
  const cabinLight = new THREE.PointLight(0xffe6b5, 1.1, 4.5, 2);
  cabinLight.position.set(0, 2.55, -0.18);
  group.add(cabinLight);
  for (const side of [-1, 1]) {
    addBox(group, `elevator-interior-handrail-${side}`, [0.06, 0.06, 1.2], [side * 1.04, 1.04, -0.1], edgeMetal);
    for (const endZ of [-0.65, 0.45]) {
      addBox(group, `elevator-handrail-bracket-${side}-${endZ}`, [0.13, 0.13, 0.05], [side * 1.05, 1.04, endZ], darkMetal);
    }
  }
  addBox(group, "elevator-interior-control", [0.21, 0.76, 0.07], [0.99, 1.38, -0.51], darkMetal);
  for (const y of [1.64, 1.43, 1.22]) {
    const button = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), lit);
    button.position.set(0.99, y, -0.556);
    button.rotation.y = Math.PI;
    group.add(button);
  }

  const landingLight = new THREE.PointLight(0xffe8bc, 2.45, 5.2, 2);
  landingLight.position.set(0, 2.74, FRONT + 0.36);
  group.add(landingLight);

  const doorCenter = toWorldWithRotation(position, rotation, 0, FRONT + 0.12);
  const callPosition = toWorldWithRotation(position, rotation, 1.68, FRONT + 0.4);
  if (registerExitRoute) {
    scene.userData.exitRoutes = [{
      id,
      label: routeText.en.name,
      targetLabel: routeText.en.name,
      position: { x: doorCenter.x, z: doorCenter.z },
    }];
  }

  let opened = arrival
    ? arriveOpen || Boolean(initialState?.count)
    : Boolean(initialState?.count);
  // A route arrival replays the door-opening moment; a restored save skips it.
  let openProgress = arrival && arriveOpen && !initialState?.count ? 0 : (opened ? 1 : 0);
  let triggered = false;

  function blocksMovement(worldX, worldZ) {
    const { x, z } = toLocalWithRotation(position, rotation, worldX, worldZ);
    // The concealed shaft is solid around the cabin, but only inside the
    // cabin's own footprint: open corridors continue past the door plane, so
    // an unbounded door-plane test would throw an invisible wall across every
    // walkable cell beyond it.
    const withinShaft = z <= CABIN_DOOR_OFFSET + 0.01 && Math.abs(x) <= 2.17 && z >= BACK - 0.09;
    if (withinShaft &&
        (Math.abs(x) >= HALF_WIDTH - 0.095 || z <= BACK + 0.09)) return true;
    if (Math.abs(x) > 1.2 && Math.abs(x) < 2.17 && z > FRONT + 0.1 && z < FRONT + 0.28) return true;
    if (z < BACK - 0.09 || z > FRONT + 0.14 || Math.abs(x) > HALF_WIDTH + 0.09) return false;
    if (Math.abs(x) >= HALF_WIDTH - 0.095) return true;
    if (z <= BACK + 0.09) return true;
    if (z >= FRONT - 0.08) {
      // Each isWalkable sample represents a point on the player's capsule.
      // Only the actual moving gap is passable; near-jamb positions cannot
      // ghost through a leaf just because its animation is almost complete.
      const halfOpening = 0.0025 + openProgress * 0.78;
      return Math.abs(x) >= halfOpening;
    }
    return false;
  }

  function update(delta, playerPosition) {
    openProgress += ((opened ? 1 : 0) - openProgress) * Math.min(1, delta * 4.2);
    leftPanel.position.x = -0.52 - openProgress * 0.78;
    rightPanel.position.x = 0.52 + openProgress * 0.78;
    const local = toLocalWithRotation(position, rotation, playerPosition.x, playerPosition.z);
    if (arrival) {
      // The arrival cab opens on entry, then closes behind the player once
      // they have clearly stepped out into the level. It never triggers an
      // exit and never traps anyone inside.
      if (opened && openProgress > 0.985 && local.z > FRONT + 0.05) {
        const distance = Math.hypot(playerPosition.x - doorCenter.x, playerPosition.z - doorCenter.z);
        if (distance > 1.9) opened = false;
      }
      return false;
    }
    const entered = !triggered && opened && openProgress > 0.92 &&
      Math.abs(local.x) < 0.8 && local.z < 0.3 && local.z > BACK + 0.16;
    if (entered) triggered = true;
    return entered;
  }

  function inspect(camera, playerPosition) {
    if (arrival) return null;
    const focus = getLevelZeroElevatorFocus(camera, doorCenter, callPosition);
    if (!focus) return null;
    const distance = Math.hypot(playerPosition.x - doorCenter.x, playerPosition.z - doorCenter.z);
    const local = toLocalWithRotation(position, rotation, playerPosition.x, playerPosition.z);
    const canClose = !opened || Math.abs(local.x) >= 0.93 || local.z >= FRONT;
    const text = opened
      ? {
          "zh-CN": { ...routeText["zh-CN"], action: "F / 按钮关门" },
          en: { ...routeText.en, action: "F / BUTTON CLOSE" },
        }
      : routeText;
    return {
      id,
      type: "interaction",
      exitRoute: true,
      targetLevel,
      distance: focus.distance,
      available: distance <= 3.1 && canClose,
      opened,
      position: focus.target === "door"
        ? { ...doorCenter, y: 0.9 }
        : { ...callPosition, y: 0.59 },
      i18n: text,
      name: text.en.name,
      effect: text.en.effect,
      action: text.en.action,
    };
  }

  function interact(playerPosition) {
    if (arrival) return { interacted: false };
    const local = toLocalWithRotation(position, rotation, playerPosition.x, playerPosition.z);
    const distance = Math.hypot(playerPosition.x - doorCenter.x, playerPosition.z - doorCenter.z);
    if (distance > 3.1) return { interacted: false };
    if (opened && Math.abs(local.x) < 0.93 && local.z < FRONT) {
      // Never trap the player in the cabin by closing the doors behind them.
      return { interacted: false };
    }
    opened = !opened;
    return {
      interacted: true,
      id,
      count: opened ? 1 : 0,
      exitRoute: true,
      targetLevel,
      i18n: opened
        ? routeText
        : {
            "zh-CN": { ...routeText["zh-CN"], response: "电梯门缓缓合上" },
            en: { ...routeText.en, response: "THE DOORS SLIDE SHUT" },
          },
    };
  }

  return {
    id,
    group,
    doorCenter,
    callPosition,
    blocksMovement,
    update,
    inspect,
    interact,
    getState: () => ({ count: opened ? 1 : 0 }),
  };
}
