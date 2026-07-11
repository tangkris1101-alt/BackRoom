import * as THREE from "three";
import { createWideSignTexture } from "./textures.js";

const INTERACT_RADIUS = 3.2;
const INSPECT_DISTANCE = 8;
const ENTER_RADIUS = 1.25;

function createRouteText(route) {
  const target = route.targetLabel ?? `LEVEL ${route.targetLevel}`;
  const kindZh = route.kind === "elevator" ? "电梯" : route.kind === "stair" ? "楼梯门" : "出口门";
  const kindEn = route.kind === "elevator" ? "ELEVATOR" : route.kind === "stair" ? "STAIR DOOR" : "EXIT DOOR";
  return {
    "zh-CN": {
      name: route.hidden ? "异常混凝土门" : `${target} ${kindZh}`,
      effect: route.hidden ? "门框后的空间信号无法识别" : `通往 ${target}`,
      action: "F / 按钮打开",
      response: `${target} 出口已打开`,
    },
    en: {
      name: route.hidden ? "ANOMALOUS CONCRETE DOOR" : `${target} ${kindEn}`,
      effect: route.hidden ? "THE SIGNAL BEHIND THE FRAME IS UNREADABLE" : `ROUTE TO ${target}`,
      action: "F / BUTTON OPEN",
      response: `${target} ROUTE OPEN`,
    },
  };
}

function createLockedRouteText(route) {
  const target = route.targetLabel ?? `LEVEL ${route.targetLevel}`;
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

  const portal = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 2.4), portalMaterial);
  portal.position.set(0, 1.2, -0.055);
  group.add(portal);

  if (route.kind === "elevator") {
    const cabinMaterial = new THREE.MeshStandardMaterial({
      color: 0x27302e,
      emissive: 0x07110d,
      emissiveIntensity: 0.26,
      roughness: 0.68,
      metalness: 0.22,
    });
    const cabinBack = new THREE.Mesh(new THREE.BoxGeometry(2.26, 2.36, 0.12), cabinMaterial);
    cabinBack.position.set(0, 1.2, -1.12);
    const cabinLeft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.36, 1.18), cabinMaterial);
    cabinLeft.position.set(-1.07, 1.2, -0.58);
    const cabinRight = cabinLeft.clone();
    cabinRight.position.x = 1.07;
    const cabinCeiling = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.1, 1.18), cabinMaterial);
    cabinCeiling.position.set(0, 2.36, -0.58);
    group.add(cabinBack, cabinLeft, cabinRight, cabinCeiling);
  }

  const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(1.12, 2.35, 0.12), panelMaterial);
  const rightPanel = leftPanel.clone();
  leftPanel.position.set(-0.57, 1.2, 0);
  rightPanel.position.set(0.57, 1.2, 0);
  group.add(leftPanel, rightPanel);

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

  if (route.symbolSeed !== undefined) {
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
  return { group, leftPanel, rightPanel };
}

export function createExitNetwork(scene, camera, routeDefinitions, initialState = {}) {
  const routes = routeDefinitions.map((definition) => {
    const route = {
      ...definition,
      opened: Boolean(initialState?.[definition.id]?.count),
      openProgress: Boolean(initialState?.[definition.id]?.count) ? 1 : 0,
      i18n: createRouteText(definition),
    };
    route.model = createRouteModel(scene, route);
    return route;
  });

  function updateModel(route, delta) {
    const target = route.opened ? 1 : 0;
    route.openProgress += (target - route.openProgress) * Math.min(1, delta * 4.8);
    const slide = route.openProgress * 1.08;
    route.model.leftPanel.position.x = -0.57 - slide;
    route.model.rightPanel.position.x = 0.57 + slide;
  }

  function distanceTo(route, playerPosition) {
    return Math.hypot(playerPosition.x - route.position.x, playerPosition.z - route.position.z);
  }

  function update(delta, playerPosition) {
    let entered = null;
    for (const route of routes) {
      updateModel(route, delta);
      const distance = distanceTo(route, playerPosition);
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
      const locked = !route.opened && Boolean(route.requiresLevelKey) && !hasLevelKey(route.targetLevel);
      const text = locked ? createLockedRouteText(route) : route.i18n;
      const displayText = route.opened
        ? {
            "zh-CN": { ...text["zh-CN"], action: "走入门后区域" },
            en: { ...text.en, action: "WALK THROUGH" },
          }
        : text;
      focused = {
        id: route.id,
        type: "interaction",
        exitRoute: true,
        targetLevel: route.targetLevel,
        distance,
        available: !route.opened && !locked && distance <= INTERACT_RADIUS,
        locked,
        opened: route.opened,
        i18n: displayText,
        name: text.en.name,
        effect: text.en.effect,
        action: displayText.en.action,
      };
    }
    return focused;
  }

  function interact(playerPosition, { hasLevelKey = () => true, consumeLevelKey = () => false } = {}) {
    let candidate = null;
    for (const route of routes) {
      const distance = distanceTo(route, playerPosition);
      if (route.opened || distance > INTERACT_RADIUS) continue;
      if (!candidate || distance < candidate.distance) candidate = { route, distance };
    }
    if (!candidate) return null;
    if (candidate.route.requiresLevelKey && !hasLevelKey(candidate.route.targetLevel)) {
      return {
        interacted: false,
        locked: true,
        id: candidate.route.id,
        targetLevel: candidate.route.targetLevel,
        i18n: createLockedRouteText(candidate.route),
      };
    }
    if (candidate.route.requiresLevelKey && !consumeLevelKey(candidate.route.targetLevel)) {
      return {
        interacted: false,
        locked: true,
        id: candidate.route.id,
        targetLevel: candidate.route.targetLevel,
        i18n: createLockedRouteText(candidate.route),
      };
    }
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
    getState: () => Object.fromEntries(routes.map((route) => [route.id, { count: route.opened ? 1 : 0 }])),
  };
}
