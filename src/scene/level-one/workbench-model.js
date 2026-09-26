import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { addMesh, nailGeometry } from "./storage-model.js";
import { levelOneCellCenter } from "./layout.js";

// Geometry of the workshop bench, in the bench's own frame: +Z is the drawer
// side, and the top surface sits on TOP_SURFACE_Y so the level's platform
// collider keeps working.
const BENCH_LENGTH = 1.9;
const BENCH_DEPTH = 0.78;
const TOP_SURFACE_Y = 0.98;
const DRAWER_PITCH = 0.53;
const DRAWER_FRONT_Z = 0.377;
const DRAWER_CENTER_Y = 0.62;
const DRAWER_TRAVEL = 0.36;
const DRAWER_COLLIDER_TOP_Y = 0.74;

const DRAWER_INTERACT_RADIUS = 2.4;
const DRAWER_INSPECT_DISTANCE = 6;
// Drawers sit low and close, so the aim cone is wider than a door's: players
// look down at the front panel rather than straight ahead.
const DRAWER_INSPECT_SCORE = 0.5;

const DRAWER_CONTENT = [
  {
    zh: "工具",
    en: "HAND TOOLS",
    effectZh: "扳手、螺丝刀与锤子",
    effectEn: "WRENCH, SCREWDRIVER, HAMMER",
  },
  {
    zh: "零件",
    en: "FASTENERS",
    effectZh: "分格零件盒与螺栓",
    effectEn: "DIVIDED BINS AND BOLTS",
  },
  {
    zh: "耗材",
    en: "CONSUMABLES",
    effectZh: "胶带、线卷与抹布",
    effectEn: "TAPE, WIRE COIL, RAGS",
  },
];

function box(width, height, depth, x, y, z) {
  return new THREE.BoxGeometry(width, height, depth).translate(x, y, z);
}

function round(width, height, depth, radius, x, y, z) {
  return new RoundedBoxGeometry(width, height, depth, 2, radius).translate(x, y, z);
}

function rod(radius, length, x, y, z, { axis = "y", segments = 12 } = {}) {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, segments);
  if (axis === "z") geometry.rotateX(Math.PI / 2);
  else if (axis === "x") geometry.rotateZ(Math.PI / 2);
  return geometry.translate(x, y, z);
}

function ring(radius, tube, x, y, z, { flatten = true } = {}) {
  const geometry = new THREE.TorusGeometry(radius, tube, 6, 16);
  if (flatten) geometry.rotateX(Math.PI / 2);
  return geometry.translate(x, y, z);
}

function buildDrawerContents(index, x) {
  const liner = [];
  const steel = [];
  const dark = [];
  const soft = [];
  const z = 0.17;
  if (index === 0) {
    // Wrench: flat body plus two jaw prongs.
    steel.push(box(0.19, 0.018, 0.035, x - 0.05, 0.575, z + 0.06));
    steel.push(box(0.055, 0.018, 0.024, x - 0.14, 0.575, z + 0.044));
    steel.push(box(0.055, 0.018, 0.024, x - 0.14, 0.575, z + 0.078));
    // Screwdriver: shaft plus a plastic handle.
    steel.push(rod(0.008, 0.13, x + 0.03, 0.573, z - 0.05, { axis: "x", segments: 8 }));
    soft.push(box(0.07, 0.026, 0.026, x + 0.13, 0.573, z - 0.05));
    // Hammer: head across the handle.
    steel.push(box(0.07, 0.032, 0.032, x - 0.03, 0.582, z - 0.09));
    soft.push(rod(0.011, 0.17, x + 0.06, 0.576, z - 0.09, { axis: "x", segments: 8 }));
    // Loose nuts beside the tools.
    for (let nut = 0; nut < 3; nut += 1) {
      dark.push(rod(0.012, 0.012, x + 0.02 + nut * 0.035, 0.573, z + 0.12, { segments: 6 }));
    }
  } else if (index === 1) {
    // Three open bins with loose bolts in them. The bins are lighter than the
    // liner so the drawer still reads as stocked once it is pulled out.
    for (const offset of [-0.145, 0, 0.145]) {
      const binX = x + offset;
      steel.push(box(0.115, 0.008, 0.105, binX, 0.562, z));
      steel.push(box(0.115, 0.05, 0.008, binX, 0.582, z + 0.05));
      steel.push(box(0.115, 0.05, 0.008, binX, 0.582, z - 0.05));
      steel.push(box(0.008, 0.05, 0.105, binX - 0.055, 0.582, z));
      steel.push(box(0.008, 0.05, 0.105, binX + 0.055, 0.582, z));
      for (let bolt = 0; bolt < 3; bolt += 1) {
        dark.push(rod(0.009, 0.014, binX - 0.03 + bolt * 0.03, 0.572, z - 0.02 + (bolt % 2) * 0.04, { segments: 6 }));
      }
    }
  } else {
    // Tape roll, wire coil and folded rags.
    soft.push(ring(0.062, 0.022, x - 0.1, 0.578, z));
    steel.push(ring(0.055, 0.014, x + 0.1, 0.572, z + 0.03));
    soft.push(box(0.18, 0.014, 0.13, x + 0.02, 0.567, z - 0.1));
    soft.push(box(0.17, 0.016, 0.12, x - 0.03, 0.583, z - 0.11));
  }
  return { liner, steel, dark, soft };
}

/**
 * Workshop bench: boarded top with bench dog holes, bolted steel legs and
 * rails, a lower shelf, a bench vise and a tool chest on top, plus three
 * sliding drawers with runners, liners and stocked interiors. Origin is the
 * floor at the bench centre; the drawers open towards +Z.
 */
export function buildDetailedWorkbench({ materials, seed = 1 } = {}) {
  const group = new THREE.Group();
  const deck = [];
  const deckAlt = [];
  const steel = [];
  const dark = [];
  const liner = [];

  deck.push(round(BENCH_LENGTH, 0.08, BENCH_DEPTH, 0.012, 0, TOP_SURFACE_Y - 0.04, 0));
  // Bench dog holes read as dark bores through the top.
  for (let hole = -2; hole <= 2; hole += 1) {
    liner.push(rod(0.018, 0.1, hole * 0.22, TOP_SURFACE_Y - 0.04, -0.22, { segments: 12 }));
  }
  for (const x of [-0.86, 0.86]) {
    for (const z of [-0.3, 0.3]) {
      dark.push(nailGeometry(x, TOP_SURFACE_Y - 0.012, z, { axis: "y", length: 0.02, radius: 0.009 }));
      steel.push(box(0.12, 0.02, 0.12, x, 0.01, z));
      steel.push(box(0.08, 0.88, 0.08, x, 0.46, z));
    }
    steel.push(box(0.06, 0.07, 0.66, x, 0.22, 0));
    steel.push(box(0.06, 0.09, 0.62, x, 0.79, 0));
    steel.push(box(0.025, 0.31, 0.46, x, DRAWER_CENTER_Y, 0.17));
  }
  for (const z of [-0.33, 0.33]) {
    steel.push(box(1.76, 0.1, 0.06, 0, 0.845, z));
    steel.push(box(1.76, 0.06, 0.05, 0, 0.22, z));
  }
  steel.push(box(1.76, 0.05, 0.05, 0, 0.475, 0.365));
  liner.push(box(1.7, 0.02, 0.45, 0, 0.5, 0.17));
  liner.push(box(1.7, 0.02, 0.45, 0, 0.75, 0.17));
  liner.push(box(1.74, 0.3, 0.02, 0, DRAWER_CENTER_Y, -0.05));

  // Lower shelf with the usual clutter: a paint can and a small parts tray.
  deckAlt.push(box(1.74, 0.04, 0.62, 0, 0.26, 0));
  steel.push(rod(0.07, 0.17, -0.6, 0.365, -0.05, { segments: 14 }));
  steel.push(rod(0.074, 0.02, -0.6, 0.455, -0.05, { segments: 14 }));
  dark.push(ring(0.058, 0.007, -0.6, 0.468, -0.05, { flatten: false }));
  deck.push(box(0.32, 0.012, 0.24, 0.46, 0.286, -0.04));
  for (const offset of [-0.09, 0.09]) {
    deck.push(box(0.32, 0.1, 0.012, 0.46, 0.336, -0.04 + offset));
    deck.push(box(0.012, 0.1, 0.216, 0.46 + offset, 0.336, -0.04));
  }
  for (let bolt = 0; bolt < 4; bolt += 1) {
    dark.push(rod(0.011, 0.018, 0.36 + bolt * 0.06, 0.3, -0.04 + (bolt % 2) * 0.06, { segments: 6 }));
  }

  // Bench vise: base plate, body, two jaws, screw and a T handle.
  steel.push(box(0.19, 0.02, 0.19, 0.6, TOP_SURFACE_Y + 0.01, 0.04));
  steel.push(box(0.15, 0.11, 0.2, 0.6, TOP_SURFACE_Y + 0.075, 0.02));
  steel.push(box(0.13, 0.05, 0.035, 0.6, TOP_SURFACE_Y + 0.155, 0.13));
  dark.push(box(0.13, 0.05, 0.035, 0.6, TOP_SURFACE_Y + 0.155, 0.088));
  dark.push(rod(0.018, 0.16, 0.6, TOP_SURFACE_Y + 0.075, 0.16, { axis: "z", segments: 12 }));
  steel.push(rod(0.011, 0.26, 0.6, TOP_SURFACE_Y + 0.075, 0.235, { axis: "x", segments: 10 }));
  for (const side of [-1, 1]) {
    steel.push(new THREE.SphereGeometry(0.018, 10, 8).translate(0.6 + side * 0.13, TOP_SURFACE_Y + 0.075, 0.235));
  }

  // Tool chest: body, lid, latch and folding handle.
  steel.push(box(0.46, 0.2, 0.3, -0.56, TOP_SURFACE_Y + 0.1, 0));
  steel.push(round(0.48, 0.035, 0.32, 0.008, -0.56, TOP_SURFACE_Y + 0.217, 0));
  dark.push(box(0.06, 0.05, 0.02, -0.56, TOP_SURFACE_Y + 0.19, 0.16));
  steel.push(box(0.17, 0.022, 0.022, -0.56, TOP_SURFACE_Y + 0.29, 0));
  for (const side of [-1, 1]) {
    steel.push(box(0.022, 0.06, 0.022, -0.56 + side * 0.075, TOP_SURFACE_Y + 0.26, 0));
    dark.push(box(0.02, 0.02, 0.02, -0.56 + side * 0.19, TOP_SURFACE_Y + 0.06, 0.13));
  }

  addMesh(group, "level-one-workbench-top", deck, materials.deck);
  addMesh(group, "level-one-workbench-shelf", deckAlt, materials.deckAlt);
  addMesh(group, "level-one-workbench-frame", steel, materials.steel);
  addMesh(group, "level-one-workbench-fittings", dark, materials.nail);
  addMesh(group, "level-one-workbench-liner", liner, materials.liner);

  const drawers = DRAWER_CONTENT.map((content, index) => {
    const centerX = (index - 1) * DRAWER_PITCH;
    const drawer = new THREE.Group();
    drawer.name = `level-one-workbench-drawer-${index + 1}`;
    const front = [round(0.46, 0.2, 0.025, 0.006, centerX, DRAWER_CENTER_Y, DRAWER_FRONT_Z)];
    const body = [];
    const fittings = [];
    const contents = buildDrawerContents(index, centerX);

    fittings.push(box(0.26, 0.024, 0.024, centerX, DRAWER_CENTER_Y, DRAWER_FRONT_Z + 0.029));
    for (const side of [-1, 1]) {
      fittings.push(box(0.024, 0.024, 0.026, centerX + side * 0.11, DRAWER_CENTER_Y, DRAWER_FRONT_Z + 0.016));
      fittings.push(box(0.03, 0.03, 0.34, centerX + side * 0.222, 0.573, 0.17));
      fittings.push(nailGeometry(centerX + side * 0.2, DRAWER_CENTER_Y + 0.072, DRAWER_FRONT_Z + 0.014, { axis: "z", length: 0.01, radius: 0.007 }));
    }
    body.push(box(0.43, 0.02, 0.4, centerX, 0.545, 0.155));
    body.push(box(0.44, 0.16, 0.02, centerX, DRAWER_CENTER_Y, -0.035));
    for (const side of [-1, 1]) {
      body.push(box(0.02, 0.16, 0.4, centerX + side * 0.215, DRAWER_CENTER_Y, 0.155));
    }

    addMesh(drawer, `${drawer.name}-front`, front, index % 2 === 0 ? materials.plank : materials.plankAlt);
    addMesh(drawer, `${drawer.name}-body`, body, materials.deck);
    addMesh(drawer, `${drawer.name}-runners`, fittings, materials.steel);
    addMesh(
      drawer,
      `${drawer.name}-liner`,
      [box(0.4, 0.012, 0.37, centerX, 0.556, 0.16), ...contents.liner],
      materials.liner,
    );
    addMesh(drawer, `${drawer.name}-contents`, contents.steel, materials.steel);
    addMesh(drawer, `${drawer.name}-tools`, contents.dark, materials.nail);
    addMesh(drawer, `${drawer.name}-soft-goods`, contents.soft, materials.cardboardAlt);
    group.add(drawer);
    return {
      index,
      group: drawer,
      closedZ: 0,
      labelZh: content.zh,
      labelEn: content.en,
      effectZh: content.effectZh,
      effectEn: content.effectEn,
    };
  });

  return { group, drawers };
}

// The prompt's `action` describes what the key will do next, while `response`
// describes what just happened, so the two read in opposite directions.
function drawerText(drawer, open) {
  return {
    "zh-CN": {
      name: `工作台抽屉 · ${drawer.labelZh}`,
      effect: drawer.effectZh,
      action: open ? "F / 推回抽屉" : "F / 拉出抽屉",
      response: open ? `抽屉滑了出来 · ${drawer.labelZh}` : `抽屉推了回去 · ${drawer.labelZh}`,
    },
    en: {
      name: `WORKBENCH DRAWER · ${drawer.labelEn}`,
      effect: drawer.effectEn,
      action: open ? "F / PUSH THE DRAWER IN" : "F / PULL THE DRAWER OUT",
      response: open ? `THE DRAWER SLIDES OUT · ${drawer.labelEn}` : `THE DRAWER SLIDES SHUT · ${drawer.labelEn}`,
    },
  };
}

/**
 * Places the level's workbenches and drives their drawers. Each drawer is its
 * own interaction spot: the use key pulls it out, pressing it again pushes it
 * back. Drawer state lives in the level's interaction snapshot, and an open
 * drawer publishes a collider so players cannot walk through the boards that
 * are sticking out.
 */
export function createLevelOneWorkbenches(scene, { kit, initialState = {}, placements = [] } = {}) {
  const drawers = [];
  const colliders = [];

  placements.forEach((placement, benchIndex) => {
    const center = levelOneCellCenter(placement.col, placement.row);
    const built = buildDetailedWorkbench({ materials: kit.materials, seed: placement.seed ?? benchIndex + 1 });
    const rotation = placement.rotation ?? 0;
    built.group.name = "level-one-workbench-table";
    built.group.position.set(center.x, 0, center.z);
    built.group.rotation.y = rotation;
    scene.add(built.group);

    built.group.updateWorldMatrix(true, true);
    const benchBounds = new THREE.Box3().setFromObject(built.group);
    colliders.push({
      minX: benchBounds.min.x,
      maxX: benchBounds.max.x,
      minZ: benchBounds.min.z,
      maxZ: benchBounds.max.z,
      topY: TOP_SURFACE_Y,
    });

    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const slot = placement.slot ?? String.fromCharCode(97 + benchIndex);
    built.drawers.forEach((drawer) => {
      const id = `level-one-workbench-${slot}-drawer-${drawer.index + 1}`;
      const open = Boolean(initialState?.[id]?.count);
      // Measure the fully open pose, then leave the drawer on the state the
      // save restored: the collider has to describe where the boards end up,
      // not where they start.
      drawer.group.position.z = drawer.closedZ + DRAWER_TRAVEL;
      built.group.updateWorldMatrix(true, true);
      const openBounds = new THREE.Box3().setFromObject(drawer.group);
      drawer.group.position.z = drawer.closedZ + (open ? DRAWER_TRAVEL : 0);

      const frontX = (drawer.index - 1) * DRAWER_PITCH;
      drawers.push({
        ...drawer,
        id,
        open,
        openProgress: open ? 1 : 0,
        collider: {
          minX: openBounds.min.x,
          maxX: openBounds.max.x,
          minZ: openBounds.min.z,
          maxZ: openBounds.max.z,
          topY: DRAWER_COLLIDER_TOP_Y,
          active: open,
        },
        front: {
          x: center.x + frontX * cos + DRAWER_FRONT_Z * sin,
          y: DRAWER_CENTER_Y,
          z: center.z - frontX * sin + DRAWER_FRONT_Z * cos,
        },
      });
      colliders.push(drawers[drawers.length - 1].collider);
    });
    built.group.updateWorldMatrix(true, true);
  });

  function update(delta) {
    for (const drawer of drawers) {
      const target = drawer.open ? 1 : 0;
      drawer.openProgress += (target - drawer.openProgress) * Math.min(1, delta * 6.5);
      if (Math.abs(target - drawer.openProgress) < 0.002) drawer.openProgress = target;
      drawer.group.position.z = drawer.closedZ + drawer.openProgress * DRAWER_TRAVEL;
      const active = drawer.openProgress > 0.5;
      if (drawer.collider.active !== active) drawer.collider.active = active;
    }
  }

  function inspect(camera, playerPosition) {
    const direction = new THREE.Vector3();
    const toDrawer = new THREE.Vector3();
    camera.getWorldDirection(direction);
    let focused = null;
    for (const drawer of drawers) {
      const distance = Math.hypot(playerPosition.x - drawer.front.x, playerPosition.z - drawer.front.z);
      if (distance > DRAWER_INSPECT_DISTANCE) continue;
      toDrawer.set(
        drawer.front.x - camera.position.x,
        drawer.front.y - camera.position.y,
        drawer.front.z - camera.position.z,
      );
      const score = direction.dot(toDrawer.normalize());
      if (score < DRAWER_INSPECT_SCORE) continue;
      if (!focused || score > focused.score) focused = { drawer, score, distance };
    }
    if (!focused) return null;
    const text = drawerText(focused.drawer, focused.drawer.open);
    return {
      id: focused.drawer.id,
      type: "interaction",
      workbenchDrawer: true,
      score: focused.score,
      distance: focused.distance,
      available: focused.distance <= DRAWER_INTERACT_RADIUS,
      position: { x: focused.drawer.front.x, y: focused.drawer.front.y, z: focused.drawer.front.z },
      i18n: text,
      name: text.en.name,
      effect: text.en.effect,
      action: text.en.action,
    };
  }

  function interact(playerPosition, drawerId = null) {
    const candidate = drawerId
      ? drawers.find((drawer) => drawer.id === drawerId) ?? null
      : drawers
          .map((drawer) => ({
            drawer,
            distance: Math.hypot(playerPosition.x - drawer.front.x, playerPosition.z - drawer.front.z),
          }))
          .filter((entry) => entry.distance <= DRAWER_INTERACT_RADIUS)
          .sort((left, right) => left.distance - right.distance)[0]?.drawer ?? null;
    if (!candidate) return null;
    candidate.open = !candidate.open;
    return {
      interacted: true,
      id: candidate.id,
      count: candidate.open ? 1 : 0,
      workbenchDrawer: true,
      i18n: drawerText(candidate, candidate.open),
    };
  }

  return {
    drawers,
    colliders,
    update,
    inspect,
    interact,
    getState: () => Object.fromEntries(
      drawers.map((drawer) => [drawer.id, { count: drawer.open ? 1 : 0 }]),
    ),
  };
}
