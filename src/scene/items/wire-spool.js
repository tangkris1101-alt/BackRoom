import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createGameMaterial } from "../common/materials.js";
import { createSeededRandom, drawSpeckles } from "../common/texture-utils.js";

// The world item keeps the silhouette its spawn offsets were authored for: a
// spool lying on its side, axis along X, rim radius 0.25m and centre at the
// origin, so the 0.26m floor offset and the aim box still line up.
const FLANGE_RADIUS = 0.25;
const FLANGE_HALF_WIDTH = 0.17;
const FLANGE_INNER_X = 0.12;
const FLANGE_BEVEL = 0.013;
const RIM_RADIUS = FLANGE_RADIUS - FLANGE_BEVEL;
const DRUM_RADIUS = 0.15;
const DRUM_LIP = 0.006;
const BORE_RADIUS = 0.05;

// Wound cable: a 19mm insulated core, turns packed tight enough to touch, plus
// a partly unwound upper layer running out into a stripped lead end.
const WIRE_RADIUS = 0.0095;
const WINDING_RADIUS = DRUM_RADIUS + WIRE_RADIUS;
const WINDING_TURNS = 13;
const WINDING_START_X = -0.105;
const WINDING_LENGTH = 0.21;
const OVERLAY_TURNS = 4;
const OVERLAY_RADIUS = WINDING_RADIUS + WIRE_RADIUS * 2;
const OVERLAY_START_X = -0.03;
const OVERLAY_LENGTH = 0.075;
const LEAD_RADIUS = WIRE_RADIUS * 0.72;

const LABEL_RADIUS = 0.128;

// The lead leaves the top of the upper winding, arcs over the flange and comes
// to rest on the floor beside the spool. The floor line of a model whose rim
// touches the ground sits at y = -FLANGE_RADIUS, so the run-out is authored a
// millimetre above it and the spawn tilt settles it onto the ground.
const LEAD_PATH = [
  [0.052, 0.180, 0.0],
  [0.116, 0.208, 0.034],
  [0.188, 0.182, 0.098],
  [0.244, 0.094, 0.16],
  [0.258, -0.02, 0.196],
  [0.236, -0.152, 0.222],
  [0.182, -0.232, 0.24],
  [0.104, -0.248, 0.238],
  [0.03, -0.247, 0.212],
];
const LEAD_TIP = [-0.03, -0.244, 0.176];

// Node-side checks build scenes without a canvas: every texture below has to
// fall back to a flat colour there.
function canCreateCanvasTexture() {
  return typeof document !== "undefined" && typeof document.createElement === "function";
}

function createCanvasTexture(width, height, draw, { colorSpace = THREE.SRGBColorSpace } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  draw(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = colorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Moulded spool body. The UVs come off the lathe, so u runs around the part and
 * v follows the profile: streaks drawn along u therefore read as the tool marks
 * and scuffs a spinning moulding actually picks up, and they wrap without a
 * seam where the rim turns over.
 */
function createSpoolBodyMaps(seed) {
  if (!canCreateCanvasTexture()) return { map: null, bumpMap: null };
  const size = 512;

  const drawBody = (context, tone, tint, shade) => {
    const random = createSeededRandom(seed);
    for (let i = 0; i < 300; i += 1) {
      const y = random() * size;
      const start = random() * size;
      context.strokeStyle = random() > 0.5
        ? `rgba(${tint}, ${0.05 + random() * 0.1})`
        : `rgba(${shade}, ${0.05 + random() * 0.12})`;
      context.lineWidth = 0.6 + random() * 2.4;
      context.beginPath();
      context.moveTo(start, y);
      context.lineTo(start + 40 + random() * 220, y + (random() - 0.5) * 3.5);
      context.stroke();
    }
    // Chipped corners and the grey scuff a spool picks up from being dragged.
    for (let i = 0; i < 34; i += 1) {
      const x = random() * size;
      const y = random() * size;
      context.fillStyle = `rgba(196, 190, 172, ${0.12 + random() * 0.3})`;
      context.beginPath();
      context.ellipse(x, y, 1.5 + random() * 7, 0.7 + random() * 2.2, random() * Math.PI, 0, Math.PI * 2);
      context.fill();
    }
    for (let i = 0; i < 12; i += 1) {
      const y = random() * size;
      context.strokeStyle = `rgba(${tone}, ${0.16 + random() * 0.22})`;
      context.lineWidth = 3 + random() * 9;
      context.beginPath();
      context.moveTo(random() * size, y);
      context.lineTo(random() * size, y + (random() - 0.5) * 8);
      context.stroke();
    }
    drawSpeckles(context, size, 760, 0.1, shade, random);
    drawSpeckles(context, size, 300, 0.07, tint, random);
  };

  const map = createCanvasTexture(size, size, (context) => {
    context.fillStyle = "#8d5231";
    context.fillRect(0, 0, size, size);
    drawBody(context, "72, 40, 22", "204, 146, 98", "54, 30, 16");
  });

  const bumpMap = createCanvasTexture(size, size, (context) => {
    const random = createSeededRandom(seed + 17);
    context.fillStyle = "#8a8a8a";
    context.fillRect(0, 0, size, size);
    for (let i = 0; i < 420; i += 1) {
      const y = random() * size;
      context.strokeStyle = random() > 0.5
        ? `rgba(255, 255, 255, ${0.05 + random() * 0.14})`
        : `rgba(0, 0, 0, ${0.05 + random() * 0.16})`;
      context.lineWidth = 0.6 + random() * 2;
      context.beginPath();
      context.moveTo(random() * size, y);
      context.lineTo(random() * size, y + (random() - 0.5) * 3);
      context.stroke();
    }
    for (let i = 0; i < 700; i += 1) {
      const x = random() * size;
      const y = random() * size;
      context.fillStyle = `rgba(0, 0, 0, ${0.1 + random() * 0.3})`;
      context.fillRect(x, y, 1 + random() * 2.6, 1 + random() * 1.8);
    }
  }, { colorSpace: THREE.NoColorSpace });

  return { map, bumpMap };
}

/**
 * Cable insulation. One tile spans the whole wound length, so the dark bands at
 * each turn boundary are painted rather than tiled: touching turns occlude each
 * other in a real coil, and that is what makes the winding read as layers
 * instead of a smooth sleeve. Cracks run across u, i.e. around the wire, which
 * is where dried-out PVC splits first.
 */
function createInsulationMaps(turns, seed) {
  if (!canCreateCanvasTexture()) return { map: null, bumpMap: null };
  const width = 1024;
  const height = 128;

  const drawBands = (context, tone) => {
    const band = width / turns;
    for (let turn = 0; turn < turns; turn += 1) {
      const left = turn * band;
      const gradient = context.createLinearGradient(left, 0, left + band, 0);
      gradient.addColorStop(0, `rgba(${tone}, 0.5)`);
      gradient.addColorStop(0.18, `rgba(${tone}, 0.24)`);
      gradient.addColorStop(0.5, `rgba(${tone}, 0.02)`);
      gradient.addColorStop(0.86, `rgba(${tone}, 0.26)`);
      gradient.addColorStop(1, `rgba(${tone}, 0.55)`);
      context.fillStyle = gradient;
      context.fillRect(left, 0, band + 1, height);
    }
  };

  const map = createCanvasTexture(width, height, (context) => {
    const random = createSeededRandom(seed);
    context.fillStyle = "#a3572c";
    context.fillRect(0, 0, width, height);
    // Faded, chalky patches where the plastic has dried out. Kept faint and
    // small: at arm's length strong blotches read as fungus, not weathering.
    for (let i = 0; i < 42; i += 1) {
      const x = random() * width;
      const y = random() * height;
      const radius = 8 + random() * 34;
      const gradient = context.createRadialGradient(x, y, radius * 0.2, x, y, radius);
      gradient.addColorStop(0, `rgba(198, 172, 146, ${0.05 + random() * 0.11})`);
      gradient.addColorStop(1, "rgba(198, 172, 146, 0)");
      context.fillStyle = gradient;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    drawBands(context, "26, 12, 6");
    // Split insulation, plus the brighter chafe where the lead has been dragged.
    for (let i = 0; i < 8; i += 1) {
      const x = random() * width;
      context.strokeStyle = `rgba(30, 15, 8, ${0.18 + random() * 0.2})`;
      context.lineWidth = 0.6 + random() * 1.1;
      context.beginPath();
      let y = -4;
      context.moveTo(x, y);
      while (y < height + 4) {
        y += 4 + random() * 10;
        context.lineTo(x + (random() - 0.5) * 4, y);
      }
      context.stroke();
    }
    for (let i = 0; i < 22; i += 1) {
      const x = random() * width;
      const y = random() * height;
      context.strokeStyle = `rgba(226, 176, 132, ${0.1 + random() * 0.2})`;
      context.lineWidth = 1 + random() * 3;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + 6 + random() * 26, y + (random() - 0.5) * 5);
      context.stroke();
    }
    drawSpeckles(context, width, 900, 0.1, "34, 18, 10", random);
    drawSpeckles(context, width, 260, 0.06, "228, 190, 150", random);
  });

  const bumpMap = createCanvasTexture(width, height, (context) => {
    const random = createSeededRandom(seed + 29);
    context.fillStyle = "#8c8c8c";
    context.fillRect(0, 0, width, height);
    drawBands(context, "0, 0, 0");
    for (let i = 0; i < 420; i += 1) {
      const x = random() * width;
      const y = random() * height;
      context.fillStyle = `rgba(0, 0, 0, ${0.12 + random() * 0.3})`;
      context.fillRect(x, y, 1 + random() * 3, 1 + random() * 2);
    }
  }, { colorSpace: THREE.NoColorSpace });

  return { map, bumpMap };
}

/** Printed sticker on the outer flange: the M.E.G. supply line label. */
function createSpoolLabelTexture(seed) {
  if (!canCreateCanvasTexture()) return null;
  const size = 512;
  return createCanvasTexture(size, size, (context) => {
    const random = createSeededRandom(seed);
    // Pale stock with dark ink: a green-on-brown sticker disappeared into the
    // flange the moment the level's fixtures were the only light on it.
    context.fillStyle = "#d3cca6";
    context.fillRect(0, 0, size, size);
    context.strokeStyle = "#3f4a33";
    context.lineWidth = 16;
    context.beginPath();
    context.arc(size / 2, size / 2, size * 0.455, 0, Math.PI * 2);
    context.stroke();
    context.lineWidth = 4;
    context.beginPath();
    context.arc(size / 2, size / 2, size * 0.385, 0, Math.PI * 2);
    context.stroke();

    context.fillStyle = "#38412d";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "bold 96px Arial, sans-serif";
    context.fillText("M.E.G.", size / 2, size * 0.36);
    context.font = "600 30px Arial, sans-serif";
    context.fillText("SUPPLY LINE", size / 2, size * 0.47);
    context.fillStyle = "#4a5340";
    context.font = "600 27px Arial, sans-serif";
    context.fillText("INSULATED CABLE", size / 2, size * 0.59);
    context.font = "26px Arial, sans-serif";
    context.fillText("2.5 mm² · 100 m", size / 2, size * 0.665);

    // Sticker wear: scuffed print, a crease and grime out of the floor.
    for (let i = 0; i < 170; i += 1) {
      const x = random() * size;
      const y = random() * size;
      if (Math.hypot(x - size / 2, y - size / 2) > size * 0.45) continue;
      context.fillStyle = `rgba(122, 116, 88, ${0.08 + random() * 0.26})`;
      context.fillRect(x, y, 1 + random() * 7, 1 + random() * 4);
    }
    context.strokeStyle = "rgba(104, 98, 72, 0.42)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(size * 0.2, size * 0.78);
    context.lineTo(size * 0.82, size * 0.24);
    context.stroke();
    const stain = context.createRadialGradient(size * 0.68, size * 0.74, 6, size * 0.68, size * 0.74, size * 0.32);
    stain.addColorStop(0, "rgba(88, 72, 42, 0.42)");
    stain.addColorStop(1, "rgba(88, 72, 42, 0)");
    context.fillStyle = stain;
    context.fillRect(0, 0, size, size);
  });
}

/** Flange disc, barrel, bore and moulding ribs, all in one merged mesh. */
function createSpoolBodyGeometry() {
  const profile = [
    new THREE.Vector2(BORE_RADIUS, FLANGE_HALF_WIDTH),
    new THREE.Vector2(RIM_RADIUS, FLANGE_HALF_WIDTH),
    new THREE.Vector2(FLANGE_RADIUS, FLANGE_HALF_WIDTH - FLANGE_BEVEL),
    new THREE.Vector2(FLANGE_RADIUS, FLANGE_INNER_X + FLANGE_BEVEL),
    new THREE.Vector2(RIM_RADIUS, FLANGE_INNER_X),
    new THREE.Vector2(DRUM_RADIUS + DRUM_LIP, FLANGE_INNER_X),
    new THREE.Vector2(DRUM_RADIUS, FLANGE_INNER_X),
    new THREE.Vector2(DRUM_RADIUS, -FLANGE_INNER_X),
    new THREE.Vector2(DRUM_RADIUS + DRUM_LIP, -FLANGE_INNER_X),
    new THREE.Vector2(RIM_RADIUS, -FLANGE_INNER_X),
    new THREE.Vector2(FLANGE_RADIUS, -FLANGE_INNER_X - FLANGE_BEVEL),
    new THREE.Vector2(FLANGE_RADIUS, -FLANGE_HALF_WIDTH + FLANGE_BEVEL),
    new THREE.Vector2(RIM_RADIUS, -FLANGE_HALF_WIDTH),
    new THREE.Vector2(BORE_RADIUS, -FLANGE_HALF_WIDTH),
    new THREE.Vector2(BORE_RADIUS, FLANGE_HALF_WIDTH),
  ];
  const parts = [new THREE.LatheGeometry(profile, 48).rotateZ(Math.PI / 2)];

  // Ribs stiffen the printed-side flange; the label sits on the other face, so
  // the two sides no longer read as the same stamped part.
  for (let index = 0; index < 4; index += 1) {
    const angle = Math.PI / 4 + index * (Math.PI / 2);
    const rib = new THREE.BoxGeometry(0.012, 0.15, 0.02);
    rib.rotateX(angle);
    rib.translate(0, Math.cos(angle) * 0.145, Math.sin(angle) * 0.145);
    rib.translate(-(FLANGE_HALF_WIDTH - 0.002), 0, 0);
    parts.push(rib);
  }
  return mergeGeometries(parts, false);
}

/** One helical pass of insulated cable around the drum. */
class WindingCurve extends THREE.Curve {
  constructor(startX, length, radius, turns, phase) {
    super();
    this.startX = startX;
    this.length = length;
    this.radius = radius;
    this.turns = turns;
    this.phase = phase;
  }

  getPoint(t, target = new THREE.Vector3()) {
    const angle = this.phase + t * this.turns * Math.PI * 2;
    return target.set(
      this.startX + this.length * t,
      Math.cos(angle) * this.radius,
      Math.sin(angle) * this.radius,
    );
  }
}

function createWindingGeometry({ turns, radius, startX, length, phase, segmentsPerTurn }) {
  const curve = new WindingCurve(startX, length, radius, turns, phase);
  return new THREE.TubeGeometry(curve, Math.round(turns * segmentsPerTurn), WIRE_RADIUS, 12, false);
}

function leadCurve(points) {
  return new THREE.CatmullRomCurve3(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    "centripetal",
  );
}

/**
 * Insulated supply spool: moulded flanges with a printed sticker on one face,
 * thirteen turns of brittle orange cable wound tight against each other, a
 * partly unwound upper layer and a lead end that runs out across the floor and
 * ends in bare copper. Origin is the spool's centre, axis along X.
 */
export function createWireSpoolModel() {
  const group = new THREE.Group();
  group.name = "wire-spool-model";

  const body = createSpoolBodyMaps(0x51f0);
  const insulation = createInsulationMaps(WINDING_TURNS, 0x7a31);
  const overlayInsulation = createInsulationMaps(OVERLAY_TURNS, 0x2c96);
  const label = createSpoolLabelTexture(0x6193);

  const bodyMaterial = createGameMaterial(({ lowQuality }) => ({
    map: body.map,
    color: body.map ? 0xffffff : 0x8d5231,
    roughness: 0.9,
    metalness: 0.02,
    emissive: 0x160e08,
    emissiveIntensity: 0.07,
    ...(lowQuality || !body.bumpMap ? {} : { bumpMap: body.bumpMap, bumpScale: 0.012 }),
  }));
  const insulationMaterial = createGameMaterial(({ lowQuality }) => ({
    map: insulation.map,
    color: insulation.map ? 0xffffff : 0xb15d32,
    roughness: 0.88,
    metalness: 0.01,
    emissive: 0x170d06,
    emissiveIntensity: 0.06,
    ...(lowQuality || !insulation.bumpMap ? {} : { bumpMap: insulation.bumpMap, bumpScale: 0.006 }),
  }));
  const overlayMaterial = createGameMaterial(({ lowQuality }) => ({
    map: overlayInsulation.map,
    color: overlayInsulation.map ? 0xffffff : 0xb15d32,
    roughness: 0.88,
    metalness: 0.01,
    emissive: 0x170d06,
    emissiveIntensity: 0.06,
    ...(lowQuality || !overlayInsulation.bumpMap ? {} : { bumpMap: overlayInsulation.bumpMap, bumpScale: 0.006 }),
  }));
  const labelMaterial = createGameMaterial({
    map: label,
    color: label ? 0xffffff : 0xcbc49c,
    roughness: 0.9,
    metalness: 0,
    emissive: 0x15160f,
    emissiveIntensity: 0.05,
  });
  // Copper without an environment map: metalness would mostly subtract lit
  // response (see empty-can.js), so the wire stays only faintly metallic and
  // keeps its colour from the albedo.
  const copperMaterial = createGameMaterial({
    color: 0xb87333,
    roughness: 0.42,
    metalness: 0.42,
    emissive: 0x150c04,
    emissiveIntensity: 0.06,
  });

  const bodyMesh = new THREE.Mesh(createSpoolBodyGeometry(), bodyMaterial);
  bodyMesh.name = "wire-spool-body";
  group.add(bodyMesh);

  const winding = new THREE.Mesh(
    createWindingGeometry({
      turns: WINDING_TURNS,
      radius: WINDING_RADIUS,
      startX: WINDING_START_X,
      length: WINDING_LENGTH,
      phase: 0,
      segmentsPerTurn: 18,
    }),
    insulationMaterial,
  );
  winding.name = "wire-spool-winding";
  group.add(winding);

  const overlay = new THREE.Mesh(
    createWindingGeometry({
      turns: OVERLAY_TURNS,
      radius: OVERLAY_RADIUS,
      startX: OVERLAY_START_X,
      length: OVERLAY_LENGTH,
      phase: 0,
      segmentsPerTurn: 18,
    }),
    overlayMaterial,
  );
  overlay.name = "wire-spool-winding-upper";
  group.add(overlay);

  const lead = new THREE.Mesh(
    new THREE.TubeGeometry(leadCurve(LEAD_PATH.slice(0, -1)), 96, WIRE_RADIUS, 10, false),
    insulationMaterial,
  );
  lead.name = "wire-spool-lead-insulation";
  group.add(lead);

  // The last stretch is stripped: bare core, then the strands splaying out of
  // the cut where the insulation finally gave up.
  const lastPoint = LEAD_PATH[LEAD_PATH.length - 1];
  const corePoints = [LEAD_PATH[LEAD_PATH.length - 4], LEAD_PATH[LEAD_PATH.length - 3], lastPoint, LEAD_TIP];
  const coreParts = [new THREE.TubeGeometry(leadCurve(corePoints), 32, LEAD_RADIUS, 8, false)];
  const tip = new THREE.Vector3(...LEAD_TIP);
  const tipDirection = tip.clone().sub(new THREE.Vector3(...lastPoint)).normalize();
  const tipQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipDirection);
  for (let index = 0; index < 3; index += 1) {
    const spread = new THREE.Quaternion().setFromEuler(new THREE.Euler((index - 1) * 0.36, 0, (index - 1) * 0.26));
    const strand = new THREE.CylinderGeometry(0.0016, 0.0016, 0.036, 5);
    strand.translate(0, 0.018, 0);
    strand.applyQuaternion(tipQuaternion.clone().multiply(spread));
    strand.translate(tip.x, tip.y, tip.z);
    coreParts.push(strand);
  }
  const core = new THREE.Mesh(mergeGeometries(coreParts, false), copperMaterial);
  core.name = "wire-spool-lead-core";
  group.add(core);

  const sticker = new THREE.Mesh(
    new THREE.CircleGeometry(LABEL_RADIUS, 48).rotateY(Math.PI / 2),
    labelMaterial,
  );
  sticker.name = "wire-spool-label";
  sticker.position.x = FLANGE_HALF_WIDTH + 0.0004;
  group.add(sticker);

  group.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = false;
    object.receiveShadow = false;
  });
  return group;
}
