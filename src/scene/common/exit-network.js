import * as THREE from "three";
import { createWideSignTexture } from "./textures.js";

const INTERACT_RADIUS = 3.2;
const INSPECT_DISTANCE = 8;
const ENTER_RADIUS = 1.25;

function createRouteText(route) {
  const target = route.targetLabel ?? `LEVEL ${route.targetLevel}`;
  if (route.anonymous) {
    return {
      "zh-CN": {
        name: "混凝土门",
        effect: "门后的空间没有标记",
        action: "F / 按钮开锁",
        response: "锁芯发出一声轻响",
      },
      en: {
        name: "CONCRETE DOOR",
        effect: "THE SPACE BEYOND IS UNMARKED",
        action: "F / BUTTON UNLOCK",
        response: "THE LOCK CLICKS OPEN",
      },
    };
  }
  const kindZh = route.kind === "elevator"
    ? "电梯"
    : route.kind === "cabinet"
      ? "储物柜"
      : route.kind === "stair"
        ? "楼梯门"
        : "出口门";
  const kindEn = route.kind === "elevator"
    ? "ELEVATOR"
    : route.kind === "cabinet"
      ? "STORAGE CABINET"
      : route.kind === "stair"
        ? "STAIR DOOR"
        : "EXIT DOOR";
  const isCabinet = route.kind === "cabinet";
  return {
    "zh-CN": {
      name: isCabinet ? "普通储物柜" : route.hidden ? "异常混凝土门" : `${target} ${kindZh}`,
      effect: isCabinet ? `柜内存在通往 ${target} 的异常空间` : route.hidden ? "门框后的空间信号无法识别" : `通往 ${target}`,
      action: "F / 按钮打开",
      response: isCabinet ? "柜门已打开" : `${target} 出口已打开`,
    },
    en: {
      name: isCabinet ? "ORDINARY STORAGE CABINET" : route.hidden ? "ANOMALOUS CONCRETE DOOR" : `${target} ${kindEn}`,
      effect: isCabinet ? `AN ANOMALOUS SPACE LEADS TO ${target}` : route.hidden ? "THE SIGNAL BEHIND THE FRAME IS UNREADABLE" : `ROUTE TO ${target}`,
      action: "F / BUTTON OPEN",
      response: isCabinet ? "CABINET OPEN" : `${target} ROUTE OPEN`,
    },
  };
}

function createLockedRouteText(route) {
  const target = route.targetLabel ?? `LEVEL ${route.targetLevel}`;
  if (route.anonymous) {
    return {
      "zh-CN": {
        name: "锁定混凝土门",
        effect: "门后的空间没有标记",
        action: "需要对应钥匙",
        response: "锁没有松动",
      },
      en: {
        name: "LOCKED CONCRETE DOOR",
        effect: "THE SPACE BEYOND IS UNMARKED",
        action: "A MATCHING KEY IS REQUIRED",
        response: "THE LOCK DOES NOT YIELD",
      },
    };
  }
  return {
    "zh-CN": {
      name: `${target} \u9501\u5b9a\u95e8`,
      effect: `\u9700\u8981\u624b\u6301\u5bf9\u5e94\u7684 ${target} \u94a5\u5319`,
      action: "\u624b\u6301\u5bf9\u5e94\u5c42\u7ea7\u94a5\u5319\u540e\u6309 F / \u6309\u94ae\u5f00\u95e8",
      response: `${target} \u4ecd\u5904\u4e8e\u9501\u5b9a\u72b6\u6001`,
    },
    en: {
      name: `${target} LOCKED DOOR`,
      effect: `REQUIRES THE MATCHING ${target} KEY IN HAND`,
      action: "EQUIP THE MATCHING LEVEL KEY, THEN PRESS F / BUTTON",
      response: `${target} REMAINS LOCKED`,
    },
  };
}

function createRouteModel(scene, route) {
  const group = new THREE.Group();
  group.position.set(route.position.x, 0, route.position.z);
  group.rotation.y = route.rotation ?? 0;
  group.name = `exit-network-${route.id}`;

  const frameColor = route.hidden ? 0x31332f : route.kind === "elevator" ? 0x4f5755 : 0x514b40;
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: frameColor,
    roughness: route.hidden ? 0.96 : 0.68,
    metalness: route.kind === "elevator" ? 0.28 : 0.08,
  });
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: route.hidden ? 0x242723 : route.kind === "elevator" ? 0x69716e : 0x62594a,
    emissive: route.hidden ? 0x020302 : 0x0b0d0c,
    emissiveIntensity: 0.12,
    roughness: 0.74,
    metalness: route.kind === "elevator" ? 0.22 : 0.04,
  });
  const portalMaterial = new THREE.MeshBasicMaterial({ color: route.hidden ? 0x030403 : 0x090a08 });

  if (route.kind === "cabinet") {
    const cabinetMaterial = new THREE.MeshStandardMaterial({
      color: 0x6e756f,
      emissive: 0x1d2422,
      emissiveIntensity: 0.14,
      roughness: 0.74,
      metalness: 0.24,
    });
    const cabinetInteriorMaterial = new THREE.MeshStandardMaterial({
      color: 0x1d2424,
      emissive: 0x06100e,
      emissiveIntensity: 0.3,
      roughness: 0.9,
    });
    const cabinetDoorMaterial = new THREE.MeshStandardMaterial({
      color: 0x828982,
      emissive: 0x242b28,
      emissiveIntensity: 0.16,
      roughness: 0.7,
      metalness: 0.18,
    });
    const cabinetBody = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.06, 2.48, 0.08), cabinetInteriorMaterial);
    back.position.set(0, 1.24, -0.48);
    const leftSide = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 0.56), cabinetMaterial);
    leftSide.position.set(-1.03, 1.25, -0.24);
    const rightSide = leftSide.clone();
    rightSide.position.x = 1.03;
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.12, 0.58), cabinetMaterial);
    top.position.set(0, 2.47, -0.24);
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.12, 0.58), cabinetMaterial);
    base.position.set(0, 0.06, -0.24);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.07, 0.47), cabinetMaterial);
    shelf.position.set(0, 1.3, -0.27);
    cabinetBody.add(back, leftSide, rightSide, top, base, shelf);
    group.add(cabinetBody);

    const portal = new THREE.Mesh(new THREE.PlaneGeometry(1.88, 2.3), portalMaterial);
    portal.position.set(0, 1.2, -0.43);
    group.add(portal);

    const makeDoor = (side) => {
      const hinge = new THREE.Group();
      hinge.position.set(side * 0.98, 0, 0.04);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.96, 2.3, 0.07), cabinetDoorMaterial);
      door.position.set(-side * 0.48, 1.18, 0);
      hinge.add(door);
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.32, 0.02), frameMaterial);
      vent.position.set(-side * 0.48, 1.8, side * 0.045);
      hinge.add(vent);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.36, 0.08), frameMaterial);
      handle.position.set(side * -0.13, 1.17, side * 0.055);
      hinge.add(handle);
      group.add(hinge);
      return hinge;
    };

    const leftHinge = makeDoor(-1);
    const rightHinge = makeDoor(1);
    scene.add(group);
    return { group, portal, leftHinge, rightHinge };
  }

  const portal = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 2.4), portalMaterial);
  portal.position.set(0, 1.2, -0.055);
  group.add(portal);

  if (route.kind === "elevator") {
    const cabinMaterial = new THREE.MeshStandardMaterial({
      color: 0x52605e,
      emissive: 0x172522,
      emissiveIntensity: 0.32,
      roughness: 0.62,
      metalness: 0.3,
    });
    const cabinBack = new THREE.Mesh(new THREE.BoxGeometry(2.26, 2.36, 0.12), cabinMaterial);
    cabinBack.position.set(0, 1.2, -1.12);
    const cabinLeft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.36, 1.18), cabinMaterial);
    cabinLeft.position.set(-1.07, 1.2, -0.58);
    const cabinRight = cabinLeft.clone();
    cabinRight.position.x = 1.07;
    const cabinCeiling = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.1, 1.18), cabinMaterial);
    cabinCeiling.position.set(0, 2.36, -0.58);
    const cabinFloor = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.1, 1.18), new THREE.MeshStandardMaterial({
      color: 0x27302f,
      emissive: 0x0b1011,
      emissiveIntensity: 0.16,
      roughness: 0.82,
      metalness: 0.18,
    }));
    cabinFloor.position.set(0, 0.05, -0.58);
    const ceilingLampMaterial = new THREE.MeshStandardMaterial({
      color: 0xe9f5ee,
      emissive: 0xe9f5ee,
      emissiveIntensity: 1.45,
      roughness: 0.3,
    });
    const ceilingLamp = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.035, 0.3), ceilingLampMaterial);
    ceilingLamp.position.set(0, 2.29, -0.58);
    const controlPanel = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.68, 0.06), new THREE.MeshStandardMaterial({
      color: 0x1d2927,
      emissive: 0x0c2820,
      emissiveIntensity: 0.32,
      roughness: 0.56,
      metalness: 0.38,
    }));
    controlPanel.position.set(0.94, 1.25, -0.57);
    const buttonMaterial = new THREE.MeshBasicMaterial({ color: 0xa4ffd0 });
    for (let buttonIndex = 0; buttonIndex < 3; buttonIndex += 1) {
      const button = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), buttonMaterial);
      button.position.set(0.94, 1.43 - buttonIndex * 0.18, -0.607);
      button.rotation.y = Math.PI;
      group.add(button);
    }
    const cabinLight = new THREE.PointLight(0xdaf7e7, 0.75, 4.8, 2.1);
    cabinLight.position.set(0, 2.08, -0.54);
    group.add(cabinBack, cabinLeft, cabinRight, cabinCeiling, cabinFloor, ceilingLamp, controlPanel, cabinLight);
  }

  let leftPanel = null;
  let rightPanel = null;
  let singlePanel = null;
  let singleHinge = null;
  let lockAssembly = null;
  if (route.singleDoor) {
    singleHinge = new THREE.Group();
    singleHinge.position.set(-1.14, 0, 0);
    singlePanel = new THREE.Mesh(new THREE.BoxGeometry(2.28, 2.35, 0.12), panelMaterial);
    singlePanel.position.set(1.14, 1.2, 0);
    singleHinge.add(singlePanel);
    group.add(singleHinge);
  } else {
    leftPanel = new THREE.Mesh(new THREE.BoxGeometry(1.12, 2.35, 0.12), panelMaterial);
    rightPanel = leftPanel.clone();
    leftPanel.position.set(-0.57, 1.2, 0);
    rightPanel.position.set(0.57, 1.2, 0);
    group.add(leftPanel, rightPanel);
  }

  if (route.requiresLevelKey && singleHinge) {
    const plateMaterial = new THREE.MeshStandardMaterial({
      color: 0x28231a,
      emissive: 0x090704,
      emissiveIntensity: 0.16,
      roughness: 0.46,
      metalness: 0.72,
    });
    const lockMaterial = new THREE.MeshStandardMaterial({
      color: 0x8d6b2b,
      emissive: 0x3c2609,
      emissiveIntensity: 0.32,
      roughness: 0.36,
      metalness: 0.8,
    });
    const keyholeMaterial = new THREE.MeshBasicMaterial({ color: 0x100c05 });
    lockAssembly = new THREE.Group();
    lockAssembly.name = `exit-lock-${route.id}`;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.52, 0.05), plateMaterial);
    plate.position.set(1.14, 1.22, 0.095);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.22, 0.1), lockMaterial);
    body.position.set(1.14, 1.13, 0.165);
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.023, 8, 18, Math.PI), lockMaterial);
    shackle.position.set(1.14, 1.25, 0.168);
    shackle.rotation.z = Math.PI;
    const keyhole = new THREE.Mesh(new THREE.CircleGeometry(0.026, 10), keyholeMaterial);
    keyhole.position.set(1.14, 1.13, 0.221);
    lockAssembly.add(plate, body, shackle, keyhole);
    singleHinge.add(lockAssembly);
  }

  const top = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.18, 0.22), frameMaterial);
  top.position.set(0, 2.47, 0);
  const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.55, 0.22), frameMaterial);
  leftPost.position.set(-1.28, 1.24, 0);
  const rightPost = leftPost.clone();
  rightPost.position.x = 1.28;
  group.add(top, leftPost, rightPost);

  if (!route.hidden && !route.noSign) {
    const signMaterial = new THREE.MeshStandardMaterial({
      map: createWideSignTexture(route.label ?? route.targetLabel ?? "EXIT", "#18211d", "#d8ffe0"),
      emissive: 0x315c3c,
      emissiveIntensity: 0.36,
      roughness: 0.55,
      side: THREE.DoubleSide,
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.45, 0.56), signMaterial);
    sign.position.set(0, 2.84, 0.02);
    group.add(sign);
  }

  if (route.doorNumber !== undefined && route.doorNumber !== null) {
    const numberMaterial = new THREE.MeshBasicMaterial({
      map: createWideSignTexture(String(route.doorNumber), "#1d1810", "#ffd777"),
      side: THREE.DoubleSide,
    });
    const numberSign = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.64), numberMaterial);
    // Hub doorways sit under a curved vault. Offset the plate into the corridor so the vault cannot clip it.
    numberSign.position.set(0, 3.08, 0.48);
    group.add(numberSign);
  } else if (route.symbolSeed !== undefined) {
    const glyphMaterial = new THREE.MeshBasicMaterial({ color: 0xe2b35f });
    const glyph = new THREE.Group();
    const seed = Number(route.symbolSeed) || 0;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.018, 6, 18), glyphMaterial);
    glyph.add(ring);
    for (let index = 0; index < 3; index += 1) {
      const angle = seed * 0.87 + (index / 3) * Math.PI * 2;
      const marker = new THREE.Mesh(new THREE.CircleGeometry(0.042 + ((seed + index) % 2) * 0.014, 10), glyphMaterial);
      marker.position.set(Math.cos(angle) * 0.28, Math.sin(angle) * 0.28, 0.01);
      glyph.add(marker);
    }
    glyph.position.set(0, 2.96, 0.025);
    group.add(glyph);
  }

  scene.add(group);
  return { group, portal, leftPanel, rightPanel, singlePanel, singleHinge, lockAssembly };
}

export function createExitNetwork(scene, camera, routeDefinitions, initialState = {}) {
  const routes = routeDefinitions.map((definition) => {
    const route = {
      ...definition,
      opened: Boolean(initialState?.[definition.id]?.count),
      unlocked: Boolean(initialState?.[definition.id]?.unlocked ?? initialState?.[definition.id]?.count),
      openProgress: Boolean(initialState?.[definition.id]?.count) ? 1 : 0,
      i18n: createRouteText(definition),
    };
    route.model = createRouteModel(scene, route);
    return route;
  });
  scene.userData.exitRoutes = routes.map((route) => ({
    id: route.id,
    label: route.label ?? route.targetLabel ?? "EXIT",
    targetLabel: route.targetLabel ?? "EXIT",
    position: { x: route.position.x, z: route.position.z },
  }));

  function updateModel(route, delta) {
    const target = route.opened ? 1 : 0;
    route.openProgress += (target - route.openProgress) * Math.min(1, delta * 4.8);
    if (route.model.lockAssembly) route.model.lockAssembly.visible = !route.unlocked;
    if (route.kind === "cabinet") {
      const swing = route.openProgress * Math.PI * 0.58;
      route.model.leftHinge.rotation.y = swing;
      route.model.rightHinge.rotation.y = -swing;
      return;
    }
    if (route.model.singlePanel) {
      route.model.singleHinge.rotation.y = route.openProgress * (route.doorSwingAngle ?? -Math.PI * 0.58);
    } else {
      const slide = route.openProgress * 1.08;
      route.model.leftPanel.position.x = -0.57 - slide;
      route.model.rightPanel.position.x = 0.57 + slide;
    }
    if (route.kind === "elevator" && route.model.portal) {
      route.model.portal.visible = route.openProgress < 0.3;
    }
  }

  function distanceTo(route, playerPosition) {
    return Math.hypot(playerPosition.x - route.position.x, playerPosition.z - route.position.z);
  }

  function distanceToEntry(route, playerPosition) {
    const position = route.entryPosition ?? route.position;
    return Math.hypot(playerPosition.x - position.x, playerPosition.z - position.z);
  }

  function update(delta, playerPosition) {
    let entered = null;
    for (const route of routes) {
      updateModel(route, delta);
      const distance = distanceToEntry(route, playerPosition);
      if (route.opened && route.openProgress > 0.72 && distance <= (route.enterRadius ?? ENTER_RADIUS)) {
        entered = route;
      }
    }
    return entered;
  }

  function inspect(playerPosition, { hasLevelKey = () => true } = {}) {
    const direction = new THREE.Vector3();
    const toRoute = new THREE.Vector3();
    camera.getWorldDirection(direction);
    let focused = null;
    let bestScore = -Infinity;
    for (const route of routes) {
      const distance = distanceTo(route, playerPosition);
      if (distance > INSPECT_DISTANCE) continue;
      toRoute.set(route.position.x - camera.position.x, 1.35 - camera.position.y, route.position.z - camera.position.z);
      const score = direction.dot(toRoute.normalize());
      if (score < 0.9 || score <= bestScore) continue;
      bestScore = score;
      const locked = !route.opened && !route.unlocked && Boolean(route.requiresLevelKey) && !hasLevelKey(route.targetLevel);
      const text = locked ? createLockedRouteText(route) : route.i18n;
      const canClose = route.opened && route.canClose !== false && distance <= INTERACT_RADIUS;
      const displayText = route.opened
        ? {
            "zh-CN": { ...text["zh-CN"], action: "F / 按钮关闭门" },
            en: { ...text.en, action: "F / BUTTON CLOSE DOOR" },
          }
        : text;
      focused = {
        id: route.id,
        type: "interaction",
        exitRoute: true,
        targetLevel: route.targetLevel,
        distance,
        available: (!route.opened && !locked && distance <= INTERACT_RADIUS) || canClose,
        locked,
        opened: route.opened,
        unlocked: route.unlocked,
        position: { x: route.position.x, y: 1.38, z: route.position.z },
        i18n: displayText,
        name: text.en.name,
        effect: text.en.effect,
        action: displayText.en.action,
      };
    }
    return focused;
  }

  function interact(playerPosition, {
    hasLevelKey = () => true,
    consumeLevelKey = () => false,
    routeId = null,
  } = {}) {
    let candidate = null;
    for (const route of routes) {
      const distance = distanceTo(route, playerPosition);
      if ((routeId && route.id !== routeId) || distance > INTERACT_RADIUS) continue;
      if (!candidate || distance < candidate.distance) candidate = { route, distance };
    }
    if (!candidate) return null;
    if (candidate.route.opened) {
      if (candidate.route.canClose === false) return null;
      candidate.route.opened = false;
      return {
        interacted: true,
        closed: true,
        id: candidate.route.id,
        count: 0,
        exitRoute: true,
        targetLevel: candidate.route.targetLevel,
        i18n: {
          "zh-CN": { ...candidate.route.i18n["zh-CN"], response: "门缓缓合上" },
          en: { ...candidate.route.i18n.en, response: "THE DOOR SWINGS SHUT" },
        },
      };
    }
    if (!candidate.route.unlocked && candidate.route.requiresLevelKey && !hasLevelKey(candidate.route.targetLevel)) {
      return {
        interacted: false,
        locked: true,
        id: candidate.route.id,
        targetLevel: candidate.route.targetLevel,
        i18n: createLockedRouteText(candidate.route),
      };
    }
    if (!candidate.route.unlocked && candidate.route.requiresLevelKey && !consumeLevelKey(candidate.route.targetLevel)) {
      return {
        interacted: false,
        locked: true,
        id: candidate.route.id,
        targetLevel: candidate.route.targetLevel,
        i18n: createLockedRouteText(candidate.route),
      };
    }
    candidate.route.unlocked = true;
    candidate.route.opened = true;
    return {
      interacted: true,
      id: candidate.route.id,
      count: 1,
      exitRoute: true,
      targetLevel: candidate.route.targetLevel,
      i18n: candidate.route.i18n,
    };
  }

  return {
    routes,
    update,
    inspect,
    interact,
    getState: () => Object.fromEntries(routes.map((route) => [route.id, {
      count: route.opened ? 1 : 0,
      unlocked: route.unlocked,
    }])),
  };
}
