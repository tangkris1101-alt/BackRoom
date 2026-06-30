import * as THREE from "three";

const CELL_SIZE = 4;
const WALL_HEIGHT = 3.72;
const WALL_THICKNESS = 0.22;
const CEILING_Y = 3.66;
const MAX_POINT_LIGHTS = 12;
const MIN_FIXTURE_DISTANCE = CELL_SIZE * 4.25;
const SHOW_FIRST_PERSON_VIEW_MODEL = false;
const ALMOND_WATER_PICKUP_RADIUS = 2.05;
const ALMOND_WATER_STAMINA_BONUS = 50;
const ALMOND_WATER_RESPAWN_MIN = 24;
const ALMOND_WATER_RESPAWN_VARIANCE = 18;
const ALMOND_WATER_INSPECT_DISTANCE = 6.4;

const LAYOUT_COLS = 31;
const LAYOUT_ROWS = 27;

const LEVEL_INFOS = new Map([
  [0, { level: 0, levelLabel: "LEVEL 0", levelName: "NOCLIP ZONE" }],
  [1, { level: 1, levelLabel: "LEVEL 1", levelName: "HABITABLE ZONE" }],
  [2, { level: 2, levelLabel: "LEVEL 2", levelName: "PIPE DREAMS" }],
]);

export function getBackroomsLevelInfo(level = 0) {
  return LEVEL_INFOS.get(Number(level)) ?? LEVEL_INFOS.get(0);
}

const BRIGHT_ZONES = [
  { col: 19, row: 1, width: 10, height: 7 },
  { col: 11, row: 3, width: 7, height: 5 },
  { col: 10, row: 10, width: 9, height: 6 },
];

const DARK_ZONES = [
  { col: 1, row: 20, width: 6, height: 5 },
  { col: 22, row: 12, width: 6, height: 4 },
  { col: 3, row: 8, width: 5, height: 5 },
  { col: 13, row: 18, width: 12, height: 5 },
];

function createLayout() {
  const grid = Array.from({ length: LAYOUT_ROWS }, () =>
    Array.from({ length: LAYOUT_COLS }, () => "#"),
  );

  const carveCell = (col, row) => {
    if (row > 0 && row < LAYOUT_ROWS - 1 && col > 0 && col < LAYOUT_COLS - 1) {
      grid[row][col] = ".";
    }
  };

  const carveRoom = (col, row, width, height) => {
    for (let y = row; y < row + height; y += 1) {
      for (let x = col; x < col + width; x += 1) {
        carveCell(x, y);
      }
    }
  };

  const carveHorizontal = (fromCol, toCol, row, width = 1) => {
    const start = Math.min(fromCol, toCol);
    const end = Math.max(fromCol, toCol);
    for (let x = start; x <= end; x += 1) {
      for (let offset = 0; offset < width; offset += 1) {
        carveCell(x, row + offset);
      }
    }
  };

  const carveVertical = (col, fromRow, toRow, width = 1) => {
    const start = Math.min(fromRow, toRow);
    const end = Math.max(fromRow, toRow);
    for (let y = start; y <= end; y += 1) {
      for (let offset = 0; offset < width; offset += 1) {
        carveCell(col + offset, y);
      }
    }
  };

  const rooms = [
    { col: 1, row: 20, width: 6, height: 5 },
    { col: 2, row: 13, width: 4, height: 3 },
    { col: 3, row: 8, width: 5, height: 5 },
    { col: 1, row: 1, width: 8, height: 6 },
    { col: 11, row: 3, width: 7, height: 5 },
    { col: 10, row: 10, width: 9, height: 6 },
    { col: 13, row: 18, width: 12, height: 5 },
    { col: 22, row: 12, width: 6, height: 4 },
    { col: 19, row: 1, width: 10, height: 7 },
    { col: 24, row: 20, width: 5, height: 4 },
  ];
  rooms.forEach((room) => carveRoom(room.col, room.row, room.width, room.height));

  carveVertical(3, 15, 22, 1);
  carveHorizontal(3, 14, 15, 1);
  carveVertical(14, 7, 15, 1);
  carveHorizontal(14, 23, 7, 2);
  carveVertical(23, 5, 8, 1);
  carveHorizontal(23, 28, 5, 1);

  carveHorizontal(5, 13, 21, 2);
  carveVertical(13, 15, 21, 2);
  carveHorizontal(18, 24, 14, 1);
  carveVertical(24, 14, 22, 1);
  carveHorizontal(5, 11, 10, 1);
  carveVertical(11, 5, 10, 1);
  carveHorizontal(8, 12, 4, 1);
  carveHorizontal(17, 22, 4, 1);

  const pillars = [
    [13, 12],
    [15, 12],
    [17, 12],
    [14, 14],
    [20, 4],
    [23, 3],
    [26, 5],
    [16, 20],
    [20, 20],
    [5, 10],
  ];
  pillars.forEach(([col, row]) => {
    grid[row][col] = "#";
  });

  return grid.map((row) => row.join(""));
}

const MAP = createLayout();

const ROWS = MAP.length;
const COLS = MAP[0].length;
const ORIGIN_X = -(COLS * CELL_SIZE) / 2;
const ORIGIN_Z = -(ROWS * CELL_SIZE) / 2;

const START_CELL = { col: 3, row: 23, yaw: -Math.PI * 0.48 };
const EXIT_CELL = { col: 27, row: 3 };
const EXIT_TRIGGER_RADIUS = CELL_SIZE * 0.8;

const matrix = new THREE.Matrix4();
const identityQuaternion = new THREE.Quaternion();
const unitScale = new THREE.Vector3(1, 1, 1);
const inspectForward = new THREE.Vector3();
const inspectToItem = new THREE.Vector3();

function isOpenCell(col, row) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS && MAP[row][col] === ".";
}

function isInRect(col, row, zone) {
  return (
    col >= zone.col &&
    col < zone.col + zone.width &&
    row >= zone.row &&
    row < zone.row + zone.height
  );
}

function isInAnyZone(col, row, zones) {
  return zones.some((zone) => isInRect(col, row, zone));
}

function countOpenNeighbors(col, row) {
  return [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ].filter(([offsetCol, offsetRow]) => isOpenCell(col + offsetCol, row + offsetRow)).length;
}

function cellCenter(col, row) {
  return {
    x: ORIGIN_X + col * CELL_SIZE + CELL_SIZE / 2,
    z: ORIGIN_Z + row * CELL_SIZE + CELL_SIZE / 2,
  };
}

function worldToCell(x, z) {
  return {
    col: Math.floor((x - ORIGIN_X) / CELL_SIZE),
    row: Math.floor((z - ORIGIN_Z) / CELL_SIZE),
  };
}

function makeTexture(size, draw, repeatX, repeatY) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  draw(context, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 6;
  return texture;
}

function createSeededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function clampColor(value) {
  return Math.max(0, Math.min(255, value));
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

function tileHash(x, y, seed) {
  const value = Math.sin((x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453);
  return value - Math.floor(value);
}

function tileNoise(x, y, size, cells, seed) {
  const scaledX = (x / size) * cells;
  const scaledY = (y / size) * cells;
  const x0 = Math.floor(scaledX);
  const y0 = Math.floor(scaledY);
  const x1 = (x0 + 1) % cells;
  const y1 = (y0 + 1) % cells;
  const tx = smoothstep(scaledX - x0);
  const ty = smoothstep(scaledY - y0);
  const a = tileHash(x0 % cells, y0 % cells, seed);
  const b = tileHash(x1, y0 % cells, seed);
  const c = tileHash(x0 % cells, y1, seed);
  const d = tileHash(x1, y1, seed);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

function drawSpeckles(context, size, count, alpha, color = "0,0,0", random = Math.random) {
  for (let i = 0; i < count; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const radius = random() * 2.4 + 0.35;
    context.fillStyle = `rgba(${color},${random() * alpha})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
}

function createWallpaperTexture() {
  return makeTexture(
    512,
    (context, size) => {
      // Flat mono-yellow base — the documented "iconic" Level 0 wall yellow.
      context.fillStyle = "#c8b46b";
      context.fillRect(0, 0, size, size);

      // Faint vertical wallpaper seams (where strips of paper meet).
      for (let x = 0; x <= size; x += 64) {
        context.fillStyle = "rgba(150,134,62,0.14)";
        context.fillRect(x - 1, 0, 2, size);
        context.fillStyle = "rgba(222,208,128,0.10)";
        context.fillRect(x + 2, 0, 1, size);
      }

      // Very subtle diamond damask motif, barely visible like the real paper.
      context.strokeStyle = "rgba(150,135,66,0.08)";
      context.lineWidth = 1.5;
      const step = 64;
      for (let y = -step; y < size + step; y += step) {
        for (let x = -step; x < size + step; x += step) {
          context.beginPath();
          context.moveTo(x + step / 2, y);
          context.lineTo(x + step, y + step / 2);
          context.lineTo(x + step / 2, y + step);
          context.lineTo(x, y + step / 2);
          context.closePath();
          context.stroke();
        }
      }

      // Damp staining drifting up from the baseboard.
      const damp = context.createLinearGradient(0, size, 0, size * 0.55);
      damp.addColorStop(0, "rgba(96,84,40,0.22)");
      damp.addColorStop(1, "rgba(96,84,40,0)");
      context.fillStyle = damp;
      context.fillRect(0, size * 0.55, size, size * 0.45);

      // Aged grime and a few lighter bleached flecks.
      drawSpeckles(context, size, 300, 0.1, "84,72,30");
      drawSpeckles(context, size, 60, 0.1, "190,172,98");
    },
    1.5,
    1.15,
  );
}

function createCarpetTexture() {
  return makeTexture(
    512,
    (context, size) => {
      // Moist olive-yellow carpet — same family as the walls but darker/greener.
      context.fillStyle = "#9f9048";
      context.fillRect(0, 0, size, size);

      // Soft mottled damp patches so the floor looks moist and uneven.
      for (let i = 0; i < 46; i += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const radius = Math.random() * 64 + 26;
        const dark = Math.random() > 0.5;
        const grd = context.createRadialGradient(x, y, 0, x, y, radius);
        grd.addColorStop(0, dark ? "rgba(64,56,26,0.16)" : "rgba(198,178,96,0.12)");
        grd.addColorStop(1, "rgba(0,0,0,0)");
        context.fillStyle = grd;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }

      // Very faint directional pile lines (low-pile commercial carpet).
      for (let y = 0; y < size; y += 6) {
        context.fillStyle = "rgba(60,52,24,0.05)";
        context.fillRect(0, y, size, 2);
      }

      // Fine fibre grain.
      drawSpeckles(context, size, 2600, 0.1, "44,38,18");
      drawSpeckles(context, size, 1200, 0.07, "206,186,102");
    },
    12,
    12,
  );
}

function createCeilingTexture() {
  return makeTexture(
    512,
    (context, size) => {
      // Pale goldenrod-cream acoustic tile (documented Level 0 ceiling tone).
      context.fillStyle = "#d4cfa5";
      context.fillRect(0, 0, size, size);

      // Slight inward shading so each tile reads as a recessed panel.
      const shade = context.createLinearGradient(0, 0, size, size);
      shade.addColorStop(0, "rgba(255,250,224,0.10)");
      shade.addColorStop(1, "rgba(96,92,64,0.12)");
      context.fillStyle = shade;
      context.fillRect(0, 0, size, size);

      // The metal T-bar grid framing each tile.
      context.strokeStyle = "rgba(58,56,40,0.42)";
      context.lineWidth = 7;
      context.strokeRect(0, 0, size, size);

      // Pin-hole acoustic speckle.
      drawSpeckles(context, size, 1600, 0.1, "104,100,72");
      drawSpeckles(context, size, 280, 0.06, "238,232,198");
    },
    21,
    19,
  );
}

function createSignTexture(label, background, foreground) {
  return makeTexture(
    512,
    (context, size) => {
      context.fillStyle = background;
      context.fillRect(0, 0, size, size * 0.42);
      context.fillStyle = foreground;
      context.font = "bold 136px Arial, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(label, size / 2, size * 0.21);
      context.strokeStyle = "rgba(0,0,0,0.34)";
      context.lineWidth = 10;
      context.strokeRect(6, 6, size - 12, size * 0.42 - 12);
    },
    1,
    1,
  );
}

function createLevelZeroWallpaperTexture() {
  const random = createSeededRandom(0xbacc00);
  const texture = makeTexture(
    512,
    (context, size) => {
      const image = context.createImageData(size, size);
      const data = image.data;

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const i = (y * size + x) * 4;
          const seamBand = Math.sin(x * 0.045) * 2.2;
          const paperNoise =
            (tileNoise(x, y, size, 18, 2.7) - 0.5) * 6 + (random() - 0.5) * 4;
          const agedEdge = Math.max(0, Math.abs(y / size - 0.5) - 0.36) * 5;
          data[i] = clampColor(222 + seamBand + paperNoise - agedEdge);
          data[i + 1] = clampColor(214 + seamBand * 0.8 + paperNoise - agedEdge);
          data[i + 2] = clampColor(153 + seamBand * 0.45 + paperNoise * 0.55);
          data[i + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);

      for (let x = 0; x <= size; x += 74) {
        context.fillStyle = "rgba(112,100,55,0.08)";
        context.fillRect(x - 1, 0, 2, size);
        context.fillStyle = "rgba(245,235,174,0.08)";
        context.fillRect(x + 2, 0, 1, size);
      }

      context.strokeStyle = "rgba(66,78,58,0.2)";
      context.lineWidth = 0.9;
      const motifWidth = 34;
      const motifHeight = 38;
      for (let y = -motifHeight; y < size + motifHeight; y += motifHeight) {
        for (let x = -motifWidth; x < size + motifWidth; x += motifWidth) {
          const wobble = (random() - 0.5) * 1.2;
          context.beginPath();
          context.moveTo(x + 10 + wobble, y + 4);
          context.lineTo(x + 18 + wobble, y + 17);
          context.lineTo(x + 10 + wobble, y + 31);
          context.moveTo(x + 24 - wobble, y + 4);
          context.lineTo(x + 16 - wobble, y + 17);
          context.lineTo(x + 24 - wobble, y + 31);
          context.stroke();

          context.fillStyle = "rgba(65,74,55,0.14)";
          context.fillRect(x + 16, y + 18, 1.2, 1.2);
        }
      }

      for (let i = 0; i < 12; i += 1) {
        const x = random() * size;
        const y = random() * size;
        const radius = 18 + random() * 48;
        const stain = context.createRadialGradient(x, y, 0, x, y, radius);
        stain.addColorStop(0, "rgba(96,82,44,0.035)");
        stain.addColorStop(1, "rgba(96,82,44,0)");
        context.fillStyle = stain;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }

      drawSpeckles(context, size, 300, 0.07, "76,68,38", random);
      drawSpeckles(context, size, 110, 0.06, "238,226,169", random);
    },
    1.85,
    1.05,
  );

  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function createLevelZeroCarpetTexture() {
  const random = createSeededRandom(0xca9f04);
  return makeTexture(
    512,
    (context, size) => {
      const image = context.createImageData(size, size);
      const data = image.data;

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const i = (y * size + x) * 4;
          const u = x / size;
          const v = y / size;
          const broad = (tileNoise(x, y, size, 4, 4.1) - 0.5) * 12;
          const mid = (tileNoise(x, y, size, 11, 8.7) - 0.5) * 7;
          const fine = (random() - 0.5) * 4;
          const pile =
            Math.sin(Math.PI * 2 * (u * 18 + v * 2)) * 0.55 +
            Math.sin(Math.PI * 2 * (u * 7 - v * 3)) * 0.45;
          const wear = broad + mid + fine + pile;
          data[i] = clampColor(185 + wear);
          data[i + 1] = clampColor(165 + wear * 0.78);
          data[i + 2] = clampColor(120 + wear * 0.5);
          data[i + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);

      context.globalAlpha = 0.028;
      for (let y = 0; y < size; y += 5) {
        const offset = Math.sin((y / size) * Math.PI * 2 * 4) * 0.8;
        context.strokeStyle = y % 10 === 0 ? "#8b774e" : "#ddc48c";
        context.lineWidth = 0.55;
        context.beginPath();
        context.moveTo(0, y + offset);
        context.lineTo(size, y + offset);
        context.stroke();
      }
      context.globalAlpha = 1;
      drawSpeckles(context, size, 1500, 0.055, "72,58,32", random);
    },
    7.5,
    7.5,
  );
}

function createLevelZeroCeilingTexture() {
  const random = createSeededRandom(0xce1119);
  return makeTexture(
    512,
    (context, size) => {
      context.fillStyle = "#d6cfaa";
      context.fillRect(0, 0, size, size);

      const shade = context.createLinearGradient(0, 0, size, size);
      shade.addColorStop(0, "rgba(255,250,224,0.12)");
      shade.addColorStop(1, "rgba(105,99,68,0.1)");
      context.fillStyle = shade;
      context.fillRect(0, 0, size, size);

      context.strokeStyle = "rgba(85,82,58,0.24)";
      context.lineWidth = 5;
      context.strokeRect(0, 0, size, size);
      context.strokeStyle = "rgba(245,239,200,0.12)";
      context.lineWidth = 1.5;
      context.strokeRect(9, 9, size - 18, size - 18);

      for (let i = 0; i < 7; i += 1) {
        const x = random() * size;
        const y = random() * size;
        const radius = 26 + random() * 58;
        const grd = context.createRadialGradient(x, y, 0, x, y, radius);
        grd.addColorStop(0, "rgba(92,80,43,0.065)");
        grd.addColorStop(1, "rgba(92,80,43,0)");
        context.fillStyle = grd;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }

      drawSpeckles(context, size, 1500, 0.08, "91,86,58", random);
      drawSpeckles(context, size, 260, 0.05, "238,231,190", random);
    },
    20,
    18,
  );
}

function createWideSignTexture(label, background, foreground) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 410;
  const context = canvas.getContext("2d");

  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = foreground;
  context.font = "bold 220px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, canvas.width / 2, canvas.height / 2 + 8);
  context.strokeStyle = "rgba(0,0,0,0.24)";
  context.lineWidth = 20;
  context.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 6;
  return texture;
}

function applyViewModelMaterialSettings(material) {
  material.depthTest = false;
  material.depthWrite = false;
  return material;
}

function createLimbSegment(start, end, radiusTop, radiusBottom, material) {
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

function addScaledMesh(parent, geometry, material, position, scale, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

function createFirstPersonHazmatViewModel() {
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

function attachFirstPersonViewModel(camera) {
  if (!SHOW_FIRST_PERSON_VIEW_MODEL) return null;
  const viewModel = createFirstPersonHazmatViewModel();
  camera.add(viewModel);
  return viewModel;
}

function getViewModelName(viewModel) {
  return viewModel ? "YELLOW HAZMAT" : "NONE";
}

function updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition) {
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

function addInstancedBoxes(scene, geometry, material, transforms) {
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  transforms.forEach((position, index) => {
    matrix.compose(position, identityQuaternion, unitScale);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
  return mesh;
}

function createFixturePointLight(fixture, y, { rangeScale, intensityScale, decay = 2 }) {
  const light = new THREE.PointLight(
    fixture.color,
    fixture.baseIntensity * intensityScale,
    fixture.range * rangeScale,
    decay,
  );
  light.position.set(fixture.x, y, fixture.z);
  light.userData.intensityScale = intensityScale;
  return light;
}

function updateFixturePointLight(fixture, pulse, fallbackScale = 1) {
  if (!fixture.light) return;
  fixture.light.intensity =
    pulse * fixture.baseIntensity * (fixture.light.userData.intensityScale ?? fallbackScale);
}

function createStableLightState(normalLabel, { dimBelow, normalAbove, dimDelay = 0.42, normalDelay = 0.62 }) {
  let state = normalLabel;
  let dimTime = 0;
  let normalTime = normalDelay;

  return (delta, flicker) => {
    if (flicker < dimBelow) {
      dimTime += delta;
      normalTime = 0;
    } else if (flicker > normalAbove) {
      normalTime += delta;
      dimTime = 0;
    } else {
      dimTime = 0;
      normalTime = 0;
    }

    if (dimTime >= dimDelay) state = "DIM";
    if (normalTime >= normalDelay) state = normalLabel;
    return state;
  };
}

function createAlmondWaterLabelTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");

  context.fillStyle = "#f5f0d4";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#2f6f94";
  context.fillRect(0, 0, canvas.width, 42);
  context.fillRect(0, canvas.height - 44, canvas.width, 44);

  const noise = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < noise.data.length; i += 4) {
    const grain = (Math.random() - 0.5) * 12;
    noise.data[i] = clampColor(noise.data[i] + grain);
    noise.data[i + 1] = clampColor(noise.data[i + 1] + grain);
    noise.data[i + 2] = clampColor(noise.data[i + 2] + grain);
  }
  context.putImageData(noise, 0, 0);

  context.fillStyle = "#f9f5df";
  context.fillRect(58, 54, 292, 134);
  context.strokeStyle = "rgba(35, 76, 79, 0.42)";
  context.lineWidth = 4;
  context.strokeRect(58, 54, 292, 134);

  context.fillStyle = "#234c4f";
  context.font = "900 34px Arial, sans-serif";
  context.fillText("ALMOND", 82, 102);
  context.font = "900 32px Arial, sans-serif";
  context.fillText("WATER", 102, 140);
  context.font = "700 11px Arial, sans-serif";
  context.fillStyle = "#5f6542";
  context.fillText("LEVEL 0 SUPPLY", 106, 164);
  context.fillText("+50 STAMINA BOOST", 83, 181);

  context.fillStyle = "#dccb83";
  context.beginPath();
  context.ellipse(304, 120, 28, 45, -0.12, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(96, 82, 38, 0.35)";
  context.lineWidth = 3;
  context.stroke();
  context.strokeStyle = "rgba(86, 76, 34, 0.42)";
  context.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    context.beginPath();
    context.moveTo(286 + i * 7, 84 + i * 6);
    context.bezierCurveTo(302, 110, 302, 132, 287 + i * 6, 156 - i * 5);
    context.stroke();
  }

  context.fillStyle = "#18303a";
  for (let x = 384; x < 462; x += 4) {
    const width = x % 12 === 0 ? 3 : 1;
    context.fillRect(x, 78, width, 88);
  }
  context.font = "700 10px Arial, sans-serif";
  context.fillStyle = "#24414a";
  context.fillText("NOT FROM HERE", 374, 190);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 2;
  texture.needsUpdate = true;
  return texture;
}

function createAlmondWaterModel() {
  const group = new THREE.Group();
  group.name = "almond-water-model";

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd9fbff,
    emissive: 0x2b6f7a,
    emissiveIntensity: 0.08,
    roughness: 0.12,
    metalness: 0,
    transmission: 0.18,
    transparent: true,
    opacity: 0.42,
    thickness: 0.22,
  });
  const liquidMaterial = new THREE.MeshStandardMaterial({
    color: 0xbadfd0,
    emissive: 0x8bbba3,
    emissiveIntensity: 0.18,
    roughness: 0.38,
    transparent: true,
    opacity: 0.72,
  });
  const labelMaterial = new THREE.MeshStandardMaterial({
    map: createAlmondWaterLabelTexture(),
    color: 0xffffff,
    emissive: 0xd7e6bd,
    emissiveIntensity: 0.08,
    roughness: 0.62,
    side: THREE.DoubleSide,
  });
  const capMaterial = new THREE.MeshStandardMaterial({
    color: 0x234e70,
    emissive: 0x07151f,
    emissiveIntensity: 0.22,
    roughness: 0.46,
    metalness: 0.12,
  });
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x1d2718,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });

  const glassProfile = [
    new THREE.Vector2(0.108, 0.02),
    new THREE.Vector2(0.158, 0.06),
    new THREE.Vector2(0.174, 0.15),
    new THREE.Vector2(0.174, 0.52),
    new THREE.Vector2(0.138, 0.6),
    new THREE.Vector2(0.086, 0.66),
    new THREE.Vector2(0.084, 0.78),
    new THREE.Vector2(0.102, 0.81),
  ];
  const bottle = new THREE.Mesh(new THREE.LatheGeometry(glassProfile, 32), glassMaterial);
  group.add(bottle);

  const liquidProfile = [
    new THREE.Vector2(0.098, 0.06),
    new THREE.Vector2(0.145, 0.09),
    new THREE.Vector2(0.151, 0.16),
    new THREE.Vector2(0.151, 0.48),
    new THREE.Vector2(0.116, 0.53),
    new THREE.Vector2(0.078, 0.58),
  ];
  const liquid = new THREE.Mesh(new THREE.LatheGeometry(liquidProfile, 28), liquidMaterial);
  group.add(liquid);

  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.181, 0.181, 0.255, 32, 1, true),
    labelMaterial,
  );
  label.position.y = 0.35;
  group.add(label);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.108, 0.09, 24), capMaterial);
  cap.position.y = 0.855;
  group.add(cap);

  for (let i = 0; i < 3; i += 1) {
    const groove = new THREE.Mesh(new THREE.TorusGeometry(0.106, 0.0045, 6, 24), capMaterial);
    groove.rotation.x = Math.PI / 2;
    groove.position.y = 0.824 + i * 0.027;
    group.add(groove);
  }

  const baseShadow = new THREE.Mesh(new THREE.CircleGeometry(0.33, 32), shadowMaterial);
  baseShadow.rotation.x = -Math.PI / 2;
  baseShadow.position.y = 0.012;
  group.add(baseShadow);

  group.traverse((child) => {
    if (child.isMesh) child.userData.itemId = "almond-water";
  });
  return group;
}

function createAlmondWaterPickup(
  scene,
  { cols, rows, isCellOpen, getCellCenter, avoidPositions = [], blockedAabbs = [] },
) {
  const candidates = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!isCellOpen(col, row)) continue;
      const center = getCellCenter(col, row);
      const isFarEnough = avoidPositions.every(
        (position) => Math.hypot(center.x - position.x, center.z - position.z) > CELL_SIZE * 4,
      );
      const isClearOfProps = blockedAabbs.every(
        (bounds) => !circleIntersectsAabb(center.x, center.z, ALMOND_WATER_PICKUP_RADIUS, bounds),
      );
      if (isFarEnough && isClearOfProps) candidates.push({ col, row, x: center.x, z: center.z });
    }
  }

  const group = new THREE.Group();
  group.name = "almond-water-pickup";
  const bottleModel = createAlmondWaterModel();
  group.add(bottleModel);

  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.5, 32),
    new THREE.MeshBasicMaterial({
      color: 0xeefbd3,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.02;
  group.add(marker);

  scene.add(group);

  let active = false;
  let respawnTimer = 0;
  let pickupCount = 0;

  function chooseCandidate() {
    return candidates[Math.floor(Math.random() * candidates.length)] ?? candidates[0];
  }

  function placeAtRandomPosition() {
    const candidate = chooseCandidate();
    if (!candidate) {
      group.visible = false;
      active = false;
      return;
    }
    group.position.set(candidate.x, 0, candidate.z);
    group.rotation.y = Math.random() * Math.PI * 2;
    group.visible = true;
    active = true;
  }

  placeAtRandomPosition();

  return {
    inspect(camera) {
      if (!active || !camera) return null;
      camera.getWorldDirection(inspectForward);
      inspectToItem.set(group.position.x, group.position.y + 0.45, group.position.z).sub(camera.position);
      const distance = inspectToItem.length();
      if (distance > ALMOND_WATER_INSPECT_DISTANCE) return null;

      inspectToItem.normalize();
      const maxAngle = Math.min(0.16, Math.max(0.055, Math.atan2(0.58, distance)));
      if (inspectForward.dot(inspectToItem) < Math.cos(maxAngle)) return null;

      return {
        id: "almond-water",
        name: "ALMOND WATER",
        effect: "+50 STAMINA CAPACITY / 45s",
        action: "F / BUTTON PICK UP",
        distance,
      };
    },

    update(delta, elapsed, playerPosition) {
      if (!active) {
        respawnTimer -= delta;
        if (respawnTimer <= 0) placeAtRandomPosition();
        return {
          visible: false,
          available: false,
          distance: Infinity,
          respawn: Math.max(0, respawnTimer),
        };
      }

      group.position.y = Math.sin(elapsed * 2.4) * 0.035;
      group.rotation.y += delta * 0.45;
      marker.material.opacity = 0.1 + Math.sin(elapsed * 3.2) * 0.045 + 0.045;
      const distance = Math.hypot(playerPosition.x - group.position.x, playerPosition.z - group.position.z);
      return {
        visible: true,
        available: distance <= ALMOND_WATER_PICKUP_RADIUS,
        distance,
        respawn: 0,
      };
    },

    tryPickup(playerPosition) {
      if (!active) return { pickedUp: false };
      const distance = Math.hypot(playerPosition.x - group.position.x, playerPosition.z - group.position.z);
      if (distance > ALMOND_WATER_PICKUP_RADIUS) return { pickedUp: false };
      pickupCount += 1;
      active = false;
      group.visible = false;
      respawnTimer = ALMOND_WATER_RESPAWN_MIN + Math.random() * ALMOND_WATER_RESPAWN_VARIANCE;
      return {
        pickedUp: true,
        count: pickupCount,
        staminaBonus: ALMOND_WATER_STAMINA_BONUS,
      };
    },
  };
}

function createLights(scene, fixturePositions) {
  const fixtures = [];
  const pointLightIndexes = new Set(
    fixturePositions
      .map((fixture, index) => ({ index, priority: fixture.priority }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, MAX_POINT_LIGHTS)
      .map(({ index }) => index),
  );
  const panelGeometry = new THREE.BoxGeometry(1, 0.035, 0.36);
  const trimGeometry = new THREE.BoxGeometry(1, 0.03, 0.52);
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x9d9258,
    emissive: 0x4a4020,
    emissiveIntensity: 0.12,
    roughness: 0.88,
    metalness: 0.02,
  });

  fixturePositions.forEach((fixture, index) => {
    const glowMaterial = new THREE.MeshStandardMaterial({
      color: fixture.color,
      emissive: fixture.color,
      emissiveIntensity: fixture.baseIntensity,
      roughness: 0.28,
    });
    const trim = new THREE.Mesh(trimGeometry, trimMaterial);
    trim.position.set(fixture.x, CEILING_Y - 0.055, fixture.z);
    trim.rotation.y = fixture.rotation;
    trim.scale.x = fixture.panelWidth + 0.24;
    scene.add(trim);

    const panel = new THREE.Mesh(panelGeometry, glowMaterial);
    panel.position.set(fixture.x, CEILING_Y - 0.09, fixture.z);
    panel.rotation.y = fixture.rotation;
    panel.scale.x = fixture.panelWidth;
    scene.add(panel);

    let light = null;
    if (fixture.hasPointLight && pointLightIndexes.has(index)) {
      light = createFixturePointLight(fixture, CEILING_Y - 0.25, {
        rangeScale: 1.48,
        intensityScale: 1.22,
      });
      scene.add(light);
    }

    fixtures.push({
      panel,
      material: glowMaterial,
      light,
      phase: fixture.phase,
      speed: fixture.speed,
      baseIntensity: fixture.baseIntensity,
      weak: fixture.weak,
    });
  });

  return fixtures;
}

function getExitMount(position) {
  const cell = worldToCell(position.x, position.z);
  const options = [
    {
      col: cell.col,
      row: cell.row - 1,
      x: position.x,
      z: position.z - CELL_SIZE / 2 + WALL_THICKNESS * 0.62,
      rotation: 0,
    },
    {
      col: cell.col,
      row: cell.row + 1,
      x: position.x,
      z: position.z + CELL_SIZE / 2 - WALL_THICKNESS * 0.62,
      rotation: Math.PI,
    },
    {
      col: cell.col - 1,
      row: cell.row,
      x: position.x - CELL_SIZE / 2 + WALL_THICKNESS * 0.62,
      z: position.z,
      rotation: Math.PI / 2,
    },
    {
      col: cell.col + 1,
      row: cell.row,
      x: position.x + CELL_SIZE / 2 - WALL_THICKNESS * 0.62,
      z: position.z,
      rotation: -Math.PI / 2,
    },
  ];

  return options.find((option) => !isOpenCell(option.col, option.row)) ?? options[1];
}

function addExitSign(scene, position) {
  const signMap = createWideSignTexture("EXIT", "#172d1d", "#a5ffba");
  const signMaterial = new THREE.MeshStandardMaterial({
    map: signMap,
    color: 0xffffff,
    emissive: 0x3fff72,
    emissiveIntensity: 0.55,
    roughness: 0.42,
    side: THREE.DoubleSide,
  });
  const mount = getExitMount(position);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 0.78), signMaterial);
  sign.position.set(mount.x, 1.72, mount.z);
  sign.rotation.y = mount.rotation;
  scene.add(sign);

  const padMaterial = new THREE.MeshBasicMaterial({
    color: 0x7dff91,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(CELL_SIZE * 0.82, CELL_SIZE * 0.82), padMaterial);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(position.x, 0.034, position.z);
  scene.add(pad);

  const glow = new THREE.PointLight(0x6dff8f, 1.15, 8.4, 2.1);
  glow.position.set(position.x, 1.35, position.z);
  scene.add(glow);
}

function addPipes(scene) {
  const pipeMaterial = new THREE.MeshStandardMaterial({
    color: 0x273a31,
    roughness: 0.68,
    metalness: 0.22,
  });
  const pipeGeometry = new THREE.CylinderGeometry(0.055, 0.055, CELL_SIZE * 7.2, 14);
  const pipeRows = [
    { col: 4, row: 10, rotation: Math.PI / 2 },
    { col: 16, row: 14, rotation: Math.PI / 2 },
    { col: 23, row: 6, rotation: 0 },
    { col: 18, row: 20, rotation: 0 },
  ];

  pipeRows.forEach((pipe) => {
    const center = cellCenter(pipe.col, pipe.row);
    const mesh = new THREE.Mesh(pipeGeometry, pipeMaterial);
    mesh.position.set(center.x, CEILING_Y - 0.32, center.z);
    mesh.rotation.z = Math.PI / 2;
    mesh.rotation.y = pipe.rotation;
    scene.add(mesh);
  });
}

function addMoodZones(scene) {
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x4a3a16,
    transparent: true,
    opacity: 0.035,
    depthWrite: false,
  });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffed9a,
    transparent: true,
    opacity: 0.055,
    depthWrite: false,
  });

  const addFloorTint = (zone, material, yOffset) => {
    const width = zone.width * CELL_SIZE;
    const height = zone.height * CELL_SIZE;
    const geometry = new THREE.PlaneGeometry(width, height);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(
      ORIGIN_X + zone.col * CELL_SIZE + width / 2,
      yOffset,
      ORIGIN_Z + zone.row * CELL_SIZE + height / 2,
    );
    scene.add(mesh);
  };

  DARK_ZONES.forEach((zone) => addFloorTint(zone, shadowMaterial, 0.018));
  BRIGHT_ZONES.forEach((zone) => addFloorTint(zone, glowMaterial, 0.022));
}

function collectWallTransforms() {
  const northSouth = [];
  const eastWest = [];
  const fixtureCandidates = [];

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (!isOpenCell(col, row)) continue;

      const center = cellCenter(col, row);
      const isBrightZone = isInAnyZone(col, row, BRIGHT_ZONES);
      const isDarkZone = isInAnyZone(col, row, DARK_ZONES);
      const openNeighborCount = countOpenNeighbors(col, row);
      const isSpacious = openNeighborCount >= 3;
      if (!isOpenCell(col, row - 1)) {
        const position = new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z - CELL_SIZE / 2);
        northSouth.push(position);
      }
      if (!isOpenCell(col, row + 1)) {
        const position = new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z + CELL_SIZE / 2);
        northSouth.push(position);
      }
      if (!isOpenCell(col - 1, row)) {
        const position = new THREE.Vector3(center.x - CELL_SIZE / 2, WALL_HEIGHT / 2, center.z);
        eastWest.push(position);
      }
      if (!isOpenCell(col + 1, row)) {
        const position = new THREE.Vector3(center.x + CELL_SIZE / 2, WALL_HEIGHT / 2, center.z);
        eastWest.push(position);
      }

      const lightSeed = (col * 37 + row * 19) % 11;
      const roomFixtureGrid = col % 6 === 3 && row % 4 === 1;
      const brightFixtureGrid = col % 5 === 2 && row % 4 === 1;
      const horizontalCorridor = isOpenCell(col - 1, row) && isOpenCell(col + 1, row);
      const verticalCorridor = isOpenCell(col, row - 1) && isOpenCell(col, row + 1);
      const corridorCenter = !isSpacious && (horizontalCorridor || verticalCorridor);
      const corridorGrid = corridorCenter && row % 5 === 2 && col % 6 === 3;
      const shouldLight =
        (isBrightZone && brightFixtureGrid) ||
        (!isDarkZone && isSpacious && roomFixtureGrid) ||
        (!isDarkZone && corridorGrid) ||
        (isDarkZone && roomFixtureGrid && (row + col) % 2 === 0);

      if (shouldLight) {
        fixtureCandidates.push({
          x: center.x,
          z: center.z,
          rotation: 0,
          phase: col * 0.83 + row * 1.17,
          speed: isDarkZone ? 5 + ((col * row) % 5) : 2.6 + ((col * row) % 4) * 0.45,
          weak: isDarkZone ? 0.18 : isBrightZone ? 0 : isSpacious ? 0.04 : 0.08,
          range: isBrightZone ? 14.8 : isDarkZone ? 8.6 : 11.4,
          baseIntensity: isBrightZone ? 1.78 : isDarkZone ? 0.74 : 1.24,
          panelWidth: isBrightZone ? 2.95 : isSpacious ? 2.58 : 2.08,
          color: isDarkZone ? 0xe7d79f : 0xfff9df,
          hasPointLight: isBrightZone || isSpacious || (corridorGrid && lightSeed <= 2),
          priority: (isBrightZone ? 4 : 0) + (isSpacious ? 2 : 0) - (isDarkZone ? 1 : 0),
        });
      }
    }
  }

  const fixturePositions = [];
  const startCenter = cellCenter(START_CELL.col, START_CELL.row);
  const exitCenter = cellCenter(EXIT_CELL.col, EXIT_CELL.row);
  fixtureCandidates.push(
    {
      x: startCenter.x,
      z: startCenter.z,
      rotation: 0,
      phase: 0.2,
      speed: 2.2,
      weak: 0.02,
      range: 13.6,
      baseIntensity: 1.46,
      panelWidth: 2.72,
      color: 0xfff9df,
      hasPointLight: true,
      priority: 8,
    },
    {
      x: exitCenter.x,
      z: exitCenter.z,
      rotation: 0,
      phase: 1.4,
      speed: 2.4,
      weak: 0.02,
      range: 13.2,
      baseIntensity: 1.42,
      panelWidth: 2.72,
      color: 0xfff9df,
      hasPointLight: true,
      priority: 7,
    },
  );

  fixtureCandidates
    .sort((a, b) => b.priority - a.priority)
    .forEach((candidate) => {
      const tooClose = fixturePositions.some(
        (fixture) => Math.hypot(fixture.x - candidate.x, fixture.z - candidate.z) < MIN_FIXTURE_DISTANCE,
      );
      if (!tooClose) fixturePositions.push(candidate);
    });

  return { northSouth, eastWest, fixturePositions };
}

function createLevelZeroScene() {
  const scene = new THREE.Scene();
  // The background MUST match the fog colour, otherwise corridor ends, the
  // far-clip plane and plane edges render as black voids instead of dissolving
  // into the warm Backrooms haze.
  const HAZE_COLOR = 0xd8d0a0;
  scene.background = new THREE.Color(HAZE_COLOR);
  scene.fog = new THREE.FogExp2(HAZE_COLOR, 0.0095);

  const cameraFar = Math.hypot(COLS * CELL_SIZE, ROWS * CELL_SIZE) + CELL_SIZE * 2;
  const camera = new THREE.PerspectiveCamera(72, 1, 0.05, cameraFar);
  const viewModel = attachFirstPersonViewModel(camera);
  scene.add(camera);
  const spawnCell = cellCenter(START_CELL.col, START_CELL.row);
  const spawn = { x: spawnCell.x, z: spawnCell.z, yaw: START_CELL.yaw };
  const exitPosition = cellCenter(EXIT_CELL.col, EXIT_CELL.row);

  const carpetTexture = createLevelZeroCarpetTexture();
  const wallpaperTexture = createLevelZeroWallpaperTexture();
  const ceilingTexture = createLevelZeroCeilingTexture();

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: carpetTexture,
    color: 0xf6e9c6,
    emissive: 0x8a7449,
    emissiveIntensity: 0.2,
    roughness: 0.98,
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: wallpaperTexture,
    color: 0xfffce3,
    emissive: 0x655b34,
    emissiveIntensity: 0.11,
    roughness: 0.92,
    metalness: 0,
  });
  const ceilingMaterial = new THREE.MeshStandardMaterial({
    map: ceilingTexture,
    color: 0xfff7df,
    emissive: 0xc0b07a,
    emissiveIntensity: 0.4,
    roughness: 0.86,
  });
  const wallCapMaterial = new THREE.MeshStandardMaterial({
    color: 0xc7b778,
    emissive: 0x584c24,
    emissiveIntensity: 0.1,
    roughness: 0.98,
    metalness: 0,
  });
  const wallMaterials = [
    wallMaterial,
    wallMaterial,
    wallCapMaterial,
    wallCapMaterial,
    wallMaterial,
    wallMaterial,
  ];

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(COLS * CELL_SIZE, ROWS * CELL_SIZE),
    floorMaterial,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0);
  scene.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(COLS * CELL_SIZE, ROWS * CELL_SIZE),
    ceilingMaterial,
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, CEILING_Y, 0);
  scene.add(ceiling);

  const { northSouth, eastWest, fixturePositions } = collectWallTransforms();
  addInstancedBoxes(
    scene,
    new THREE.BoxGeometry(CELL_SIZE + WALL_THICKNESS, WALL_HEIGHT, WALL_THICKNESS),
    wallMaterials,
    northSouth,
  );
  addInstancedBoxes(
    scene,
    new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, CELL_SIZE + WALL_THICKNESS),
    wallMaterials,
    eastWest,
  );
  const ambientLight = new THREE.HemisphereLight(0xfff8dc, 0xb99d68, 1.44);
  scene.add(ambientLight);

  const ceilingFill = new THREE.DirectionalLight(0xfff8d8, 0.32);
  ceilingFill.position.set(-18, CEILING_Y - 0.45, 12);
  scene.add(ceilingFill);

  const fixtures = createLights(scene, fixturePositions);
  const updateLightState = createStableLightState("HUM", {
    dimBelow: 0.5,
    normalAbove: 0.66,
  });
  addExitSign(scene, exitPosition);
  addMoodZones(scene);
  const almondWater = createAlmondWaterPickup(scene, {
    cols: COLS,
    rows: ROWS,
    isCellOpen: isOpenCell,
    getCellCenter: cellCenter,
    avoidPositions: [spawnCell, exitPosition],
  });
  let exitReached = false;

  function isWalkable(x, z, radius = 0.36) {
    const corner = radius * 0.72;
    const samples = [
      [0, 0],
      [radius, 0],
      [-radius, 0],
      [0, radius],
      [0, -radius],
      [corner, corner],
      [-corner, corner],
      [corner, -corner],
      [-corner, -corner],
    ];

    return samples.every(([offsetX, offsetZ]) => {
      const cell = worldToCell(x + offsetX, z + offsetZ);
      return isOpenCell(cell.col, cell.row);
    });
  }

  function update(delta, elapsed, playerPosition) {
    let lightTotal = 0;
    fixtures.forEach((fixture) => {
      const hum = 0.92 + Math.sin(elapsed * 1.45 + fixture.phase) * 0.035;
      const twitch = Math.sin(elapsed * fixture.speed + fixture.phase * 2.4) > 0.965 ? 0.72 : 1;
      const pulse = Math.max(0.58, hum * twitch - fixture.weak);
      fixture.material.emissiveIntensity = pulse * fixture.baseIntensity * 1.56;
      updateFixturePointLight(fixture, pulse, 1.1);
      lightTotal += pulse;
    });
    const flicker = fixtures.length > 0 ? lightTotal / fixtures.length : 0.9;

    const exitDistance = Math.hypot(
      playerPosition.x - exitPosition.x,
      playerPosition.z - exitPosition.z,
    );
    if (exitDistance < EXIT_TRIGGER_RADIUS) {
      exitReached = true;
    }
    scene.fog.density = 0.0095 + (1 - flicker) * 0.004;
    updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition);
    const almondWaterState = almondWater.update(delta, elapsed, playerPosition);

    return {
      exitDistance: Math.round(exitDistance),
      exitReached,
      flicker,
      lightState: updateLightState(delta, flicker),
      focusItem: almondWater.inspect(camera),
      almondWater: almondWaterState,
    };
  }

  return {
    level: 0,
    levelLabel: "LEVEL 0",
    levelName: "NOCLIP ZONE",
    viewModelName: getViewModelName(viewModel),
    nextLevel: 1,
    scene,
    camera,
    spawn,
    isWalkable,
    update,
    tryPickup: (playerPosition) => almondWater.tryPickup(playerPosition),
  };
}

const LEVEL_ONE_COLS = 35;
const LEVEL_ONE_ROWS = 25;
const LEVEL_ONE_EXIT_TRIGGER_RADIUS = CELL_SIZE * 0.86;
const LEVEL_ONE_START_CELL = { col: 4, row: 22, yaw: -Math.PI * 0.18 };
const LEVEL_ONE_TARGET_CELL = { col: 31, row: 1 };
const LEVEL_ONE_MAX_POINT_LIGHTS = 10;
const LEVEL_ONE_MIN_FIXTURE_DISTANCE = CELL_SIZE * 4.15;

const LEVEL_ONE_DARK_ZONES = [
  { col: 1, row: 16, width: 8, height: 5 },
  { col: 23, row: 11, width: 10, height: 6 },
];

const LEVEL_ONE_SUPPLY_ZONES = [
  { col: 11, row: 7, width: 6, height: 4 },
  { col: 25, row: 17, width: 6, height: 4 },
];

function createLevelOneLayout() {
  const grid = Array.from({ length: LEVEL_ONE_ROWS }, () =>
    Array.from({ length: LEVEL_ONE_COLS }, () => "#"),
  );

  const carveCell = (col, row) => {
    if (row > 0 && row < LEVEL_ONE_ROWS - 1 && col > 0 && col < LEVEL_ONE_COLS - 1) {
      grid[row][col] = ".";
    }
  };

  const carveRoom = (col, row, width, height) => {
    for (let y = row; y < row + height; y += 1) {
      for (let x = col; x < col + width; x += 1) carveCell(x, y);
    }
  };

  carveRoom(1, 1, LEVEL_ONE_COLS - 2, LEVEL_ONE_ROWS - 2);

  const blocks = [
    { col: 2, row: 2, width: 5, height: 3 },
    { col: 13, row: 2, width: 8, height: 2 },
    { col: 27, row: 5, width: 5, height: 3 },
    { col: 3, row: 17, width: 5, height: 3 },
    { col: 18, row: 18, width: 5, height: 3 },
    { col: 28, row: 14, width: 4, height: 4 },
  ];

  const pillars = [];
  for (let row = 6; row <= 20; row += 5) {
    for (let col = 8; col <= 26; col += 6) {
      pillars.push({ col, row, width: 1, height: 1 });
    }
  }

  [...blocks, ...pillars].forEach((block) => {
    for (let row = block.row; row < block.row + block.height; row += 1) {
      for (let col = block.col; col < block.col + block.width; col += 1) {
        if (
          row > 0 &&
          row < LEVEL_ONE_ROWS - 1 &&
          col > 0 &&
          col < LEVEL_ONE_COLS - 1 &&
          !(col === LEVEL_ONE_START_CELL.col && row === LEVEL_ONE_START_CELL.row) &&
          !(col === LEVEL_ONE_TARGET_CELL.col && row === LEVEL_ONE_TARGET_CELL.row)
        ) {
          grid[row][col] = "#";
        }
      }
    }
  });

  return grid.map((row) => row.join(""));
}

const LEVEL_ONE_MAP = createLevelOneLayout();
const LEVEL_ONE_ORIGIN_X = -(LEVEL_ONE_COLS * CELL_SIZE) / 2;
const LEVEL_ONE_ORIGIN_Z = -(LEVEL_ONE_ROWS * CELL_SIZE) / 2;

function isLevelOneOpenCell(col, row) {
  return (
    row >= 0 &&
    row < LEVEL_ONE_ROWS &&
    col >= 0 &&
    col < LEVEL_ONE_COLS &&
    LEVEL_ONE_MAP[row][col] === "."
  );
}

function levelOneCellCenter(col, row) {
  return {
    x: LEVEL_ONE_ORIGIN_X + col * CELL_SIZE + CELL_SIZE / 2,
    z: LEVEL_ONE_ORIGIN_Z + row * CELL_SIZE + CELL_SIZE / 2,
  };
}

function levelOneWorldToCell(x, z) {
  return {
    col: Math.floor((x - LEVEL_ONE_ORIGIN_X) / CELL_SIZE),
    row: Math.floor((z - LEVEL_ONE_ORIGIN_Z) / CELL_SIZE),
  };
}

function isInAnyLevelOneZone(col, row, zones) {
  return zones.some((zone) => isInRect(col, row, zone));
}

function countLevelOneOpenNeighbors(col, row) {
  return [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ].filter(([offsetCol, offsetRow]) => isLevelOneOpenCell(col + offsetCol, row + offsetRow)).length;
}

function createLevelOneConcreteTexture(seed, repeatX, repeatY, base, contrast = 1) {
  const random = createSeededRandom(seed);
  return makeTexture(
    512,
    (context, size) => {
      const image = context.createImageData(size, size);
      const data = image.data;

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const i = (y * size + x) * 4;
          const broad = (tileNoise(x, y, size, 4, seed * 0.03) - 0.5) * 30 * contrast;
          const mid = (tileNoise(x, y, size, 15, seed * 0.07) - 0.5) * 12 * contrast;
          const fine = (random() - 0.5) * 9 * contrast;
          const stain = Math.max(0, tileNoise(x, y, size, 7, seed * 0.11) - 0.62) * -32;
          const wear = broad + mid + fine + stain;
          data[i] = clampColor(base[0] + wear);
          data[i + 1] = clampColor(base[1] + wear * 0.94);
          data[i + 2] = clampColor(base[2] + wear * 0.86);
          data[i + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);

      context.strokeStyle = "rgba(28,31,30,0.28)";
      context.lineWidth = 1.2;
      for (let i = 0; i < 34; i += 1) {
        const x = random() * size;
        const y = random() * size;
        const length = 18 + random() * 86;
        const angle = random() * Math.PI;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
        context.stroke();
      }

      drawSpeckles(context, size, 900, 0.09, "18,20,19", random);
      drawSpeckles(context, size, 180, 0.06, "190,197,184", random);
    },
    repeatX,
    repeatY,
  );
}

function createLevelOneFloorTexture() {
  return createLevelOneConcreteTexture(0x1e1e10, 13, 10, [84, 88, 82], 1.08);
}

function createLevelOneWallTexture() {
  return createLevelOneConcreteTexture(0x1e1e11, 2.8, 1.15, [102, 107, 101], 0.9);
}

function createLevelOneCeilingTexture() {
  const texture = createLevelOneConcreteTexture(0x1e1e12, 10, 7, [76, 80, 77], 0.82);
  texture.needsUpdate = true;
  return texture;
}

function createLevelOneLights(scene, fixturePositions) {
  const fixtures = [];
  const pointLightIndexes = new Set(
    fixturePositions
      .map((fixture, index) => ({ index, priority: fixture.priority }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, LEVEL_ONE_MAX_POINT_LIGHTS)
      .map(({ index }) => index),
  );
  const tubeGeometry = new THREE.BoxGeometry(1, 0.04, 0.34);
  const mountGeometry = new THREE.BoxGeometry(1, 0.04, 0.48);
  const mountMaterial = new THREE.MeshStandardMaterial({
    color: 0x56605b,
    emissive: 0x1d2421,
    emissiveIntensity: 0.16,
    roughness: 0.72,
    metalness: 0.22,
  });

  fixturePositions.forEach((fixture, index) => {
    const mount = new THREE.Mesh(mountGeometry, mountMaterial);
    mount.position.set(fixture.x, CEILING_Y - 0.075, fixture.z);
    mount.rotation.y = fixture.rotation;
    mount.scale.x = fixture.panelWidth + 0.32;
    scene.add(mount);

    const tubeMaterial = new THREE.MeshStandardMaterial({
      color: fixture.color,
      emissive: fixture.color,
      emissiveIntensity: fixture.baseIntensity,
      roughness: 0.22,
    });
    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    tube.position.set(fixture.x, CEILING_Y - 0.12, fixture.z);
    tube.rotation.y = fixture.rotation;
    tube.scale.x = fixture.panelWidth;
    scene.add(tube);

    let light = null;
    if (fixture.hasPointLight && pointLightIndexes.has(index)) {
      light = createFixturePointLight(fixture, CEILING_Y - 0.32, {
        rangeScale: 1.52,
        intensityScale: 1.2,
      });
      scene.add(light);
    }

    fixtures.push({
      material: tubeMaterial,
      light,
      phase: fixture.phase,
      speed: fixture.speed,
      baseIntensity: fixture.baseIntensity,
      weak: fixture.weak,
      broken: fixture.broken,
    });
  });

  return fixtures;
}

function getLevelOneTargetMount(position) {
  const cell = levelOneWorldToCell(position.x, position.z);
  const options = [
    {
      col: cell.col,
      row: cell.row - 1,
      x: position.x,
      z: position.z - CELL_SIZE / 2 + WALL_THICKNESS * 0.65,
      rotation: 0,
    },
    {
      col: cell.col,
      row: cell.row + 1,
      x: position.x,
      z: position.z + CELL_SIZE / 2 - WALL_THICKNESS * 0.65,
      rotation: Math.PI,
    },
    {
      col: cell.col - 1,
      row: cell.row,
      x: position.x - CELL_SIZE / 2 + WALL_THICKNESS * 0.65,
      z: position.z,
      rotation: Math.PI / 2,
    },
    {
      col: cell.col + 1,
      row: cell.row,
      x: position.x + CELL_SIZE / 2 - WALL_THICKNESS * 0.65,
      z: position.z,
      rotation: -Math.PI / 2,
    },
  ];

  return options.find((option) => !isLevelOneOpenCell(option.col, option.row)) ?? options[0];
}

function addLevelOneElevator(scene, position) {
  const mount = getLevelOneTargetMount(position);
  const doorMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a5350,
    emissive: 0x111615,
    emissiveIntensity: 0.16,
    roughness: 0.58,
    metalness: 0.18,
  });
  const signMaterial = new THREE.MeshStandardMaterial({
    map: createWideSignTexture("ELEVATOR", "#15231f", "#c9ffd5"),
    color: 0xffffff,
    emissive: 0x214f37,
    emissiveIntensity: 0.42,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.28), doorMaterial);
  door.position.set(mount.x, 1.24, mount.z);
  door.rotation.y = mount.rotation;
  scene.add(door);

  const seam = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, 2.16, 0.022),
    new THREE.MeshStandardMaterial({ color: 0x202624, roughness: 0.7, metalness: 0.26 }),
  );
  seam.position.set(position.x, 1.24, mount.z + (mount.rotation === 0 ? 0.014 : -0.014));
  seam.rotation.y = mount.rotation;
  scene.add(seam);

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 0.72), signMaterial);
  sign.position.set(mount.x, 2.67, mount.z);
  sign.rotation.y = mount.rotation;
  scene.add(sign);

  const padMaterial = new THREE.MeshBasicMaterial({
    color: 0xa2ffd1,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(CELL_SIZE * 0.9, CELL_SIZE * 0.9), padMaterial);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(position.x, 0.032, position.z);
  scene.add(pad);

  const glow = new THREE.PointLight(0x94ffc8, 0.65, 7.2, 2.25);
  glow.position.set(position.x, 1.55, position.z);
  scene.add(glow);
}

function addLevelOnePipes(scene) {
  const pipeMaterial = new THREE.MeshStandardMaterial({
    color: 0x26322e,
    roughness: 0.7,
    metalness: 0.28,
  });
  const pipeGeometry = new THREE.CylinderGeometry(0.07, 0.07, CELL_SIZE * 9.5, 14);
  const pipes = [
    { col: 9, row: 4, axis: "x" },
    { col: 18, row: 10, axis: "z" },
    { col: 27, row: 20, axis: "x" },
    { col: 6, row: 18, axis: "z" },
  ];

  pipes.forEach((pipe) => {
    const center = levelOneCellCenter(pipe.col, pipe.row);
    const mesh = new THREE.Mesh(pipeGeometry, pipeMaterial);
    mesh.position.set(center.x, CEILING_Y - 0.42, center.z);
    if (pipe.axis === "x") mesh.rotation.z = Math.PI / 2;
    if (pipe.axis === "z") mesh.rotation.x = Math.PI / 2;
    scene.add(mesh);
  });
}

function addLevelOneCrates(scene) {
  const crateMaterial = new THREE.MeshStandardMaterial({
    color: 0x6a5840,
    emissive: 0x21180f,
    emissiveIntensity: 0.08,
    roughness: 0.86,
  });
  const darkCrateMaterial = new THREE.MeshStandardMaterial({
    color: 0x3c413a,
    emissive: 0x111511,
    emissiveIntensity: 0.06,
    roughness: 0.82,
  });
  const geometry = new THREE.BoxGeometry(1.25, 0.86, 1.15);
  const colliders = [];
  const crates = [
    { col: 12, row: 8, x: -0.72, z: -0.5, rot: 0.18, dark: false },
    { col: 14, row: 8, x: 0.45, z: 0.45, rot: -0.12, dark: true },
    { col: 16, row: 10, x: -0.3, z: 0.65, rot: 0.08, dark: false },
    { col: 25, row: 18, x: -0.54, z: -0.52, rot: 0.2, dark: true },
    { col: 27, row: 19, x: 0.58, z: 0.1, rot: -0.26, dark: false },
    { col: 29, row: 18, x: -0.2, z: 0.4, rot: 0.08, dark: true },
  ];

  crates.forEach((crate) => {
    const center = levelOneCellCenter(crate.col, crate.row);
    const mesh = new THREE.Mesh(geometry, crate.dark ? darkCrateMaterial : crateMaterial);
    mesh.position.set(center.x + crate.x, 0.43, center.z + crate.z);
    mesh.rotation.y = crate.rot;
    scene.add(mesh);

    const collider = {
      minX: mesh.position.x - 0.86,
      maxX: mesh.position.x + 0.86,
      minZ: mesh.position.z - 0.82,
      maxZ: mesh.position.z + 0.82,
    };
    mesh.userData.collider = collider;
    colliders.push(collider);
  });

  return colliders;
}

function circleIntersectsAabb(x, z, radius, bounds) {
  const closestX = Math.max(bounds.minX, Math.min(x, bounds.maxX));
  const closestZ = Math.max(bounds.minZ, Math.min(z, bounds.maxZ));
  return (x - closestX) ** 2 + (z - closestZ) ** 2 < radius ** 2;
}

function addLevelOnePuddles(scene) {
  const puddleMaterial = new THREE.MeshBasicMaterial({
    color: 0x101816,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const puddles = [
    { col: 7, row: 18, width: 5.4, height: 2.1, rot: -0.18 },
    { col: 20, row: 12, width: 4.5, height: 1.7, rot: 0.14 },
    { col: 29, row: 9, width: 3.9, height: 1.35, rot: -0.06 },
  ];

  puddles.forEach((puddle) => {
    const center = levelOneCellCenter(puddle.col, puddle.row);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(puddle.width, puddle.height), puddleMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = puddle.rot;
    mesh.position.set(center.x, 0.026, center.z);
    scene.add(mesh);
  });
}

function addLevelOneFloorZones(scene) {
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x1d2320,
    transparent: true,
    opacity: 0.11,
    depthWrite: false,
  });
  const supplyMaterial = new THREE.MeshBasicMaterial({
    color: 0xc7d1b3,
    transparent: true,
    opacity: 0.055,
    depthWrite: false,
  });

  const addTint = (zone, material, yOffset) => {
    const width = zone.width * CELL_SIZE;
    const height = zone.height * CELL_SIZE;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(
      LEVEL_ONE_ORIGIN_X + zone.col * CELL_SIZE + width / 2,
      yOffset,
      LEVEL_ONE_ORIGIN_Z + zone.row * CELL_SIZE + height / 2,
    );
    scene.add(mesh);
  };

  LEVEL_ONE_DARK_ZONES.forEach((zone) => addTint(zone, shadowMaterial, 0.018));
  LEVEL_ONE_SUPPLY_ZONES.forEach((zone) => addTint(zone, supplyMaterial, 0.02));
}

function collectLevelOneTransforms() {
  const northSouth = [];
  const eastWest = [];
  const fixtureCandidates = [];

  for (let row = 0; row < LEVEL_ONE_ROWS; row += 1) {
    for (let col = 0; col < LEVEL_ONE_COLS; col += 1) {
      if (!isLevelOneOpenCell(col, row)) continue;

      const center = levelOneCellCenter(col, row);
      const isDarkZone = isInAnyLevelOneZone(col, row, LEVEL_ONE_DARK_ZONES);
      const isSupplyZone = isInAnyLevelOneZone(col, row, LEVEL_ONE_SUPPLY_ZONES);
      const openNeighborCount = countLevelOneOpenNeighbors(col, row);
      const isOpenHall = openNeighborCount >= 3;

      if (!isLevelOneOpenCell(col, row - 1)) {
        northSouth.push(new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z - CELL_SIZE / 2));
      }
      if (!isLevelOneOpenCell(col, row + 1)) {
        northSouth.push(new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z + CELL_SIZE / 2));
      }
      if (!isLevelOneOpenCell(col - 1, row)) {
        eastWest.push(new THREE.Vector3(center.x - CELL_SIZE / 2, WALL_HEIGHT / 2, center.z));
      }
      if (!isLevelOneOpenCell(col + 1, row)) {
        eastWest.push(new THREE.Vector3(center.x + CELL_SIZE / 2, WALL_HEIGHT / 2, center.z));
      }

      const fixtureGrid = col % 7 === 3 && row % 5 === 2;
      const corridorGrid = col % 9 === 5 && row % 6 === 4;
      if ((fixtureGrid && !isDarkZone) || (corridorGrid && isOpenHall)) {
        fixtureCandidates.push({
          x: center.x,
          z: center.z,
          rotation: 0,
          phase: col * 0.74 + row * 1.31,
          speed: isDarkZone ? 6.2 : 3.1 + ((col + row) % 5) * 0.34,
          weak: isDarkZone ? 0.28 : isSupplyZone ? 0.06 : 0.14,
          broken: isDarkZone || (col + row) % 13 === 0,
          range: isSupplyZone ? 15 : isOpenHall ? 12.8 : 9.8,
          baseIntensity: isSupplyZone ? 1.8 : isOpenHall ? 1.22 : 0.92,
          panelWidth: isSupplyZone ? 2.95 : 2.35,
          color: isSupplyZone ? 0xeef7dc : 0xdce7d6,
          hasPointLight: isSupplyZone || isOpenHall,
          priority: (isSupplyZone ? 3 : 0) + (isOpenHall ? 2 : 0) - (isDarkZone ? 2 : 0),
        });
      }
    }
  }

  const fixturePositions = [];
  const spawnCenter = levelOneCellCenter(LEVEL_ONE_START_CELL.col, LEVEL_ONE_START_CELL.row);
  const targetCenter = levelOneCellCenter(LEVEL_ONE_TARGET_CELL.col, LEVEL_ONE_TARGET_CELL.row);
  fixtureCandidates.push(
    {
      x: spawnCenter.x,
      z: spawnCenter.z,
      rotation: 0,
      phase: 0.4,
      speed: 2.6,
      weak: 0.03,
      broken: false,
      range: 15.8,
      baseIntensity: 1.72,
      panelWidth: 2.7,
      color: 0xeef7df,
      hasPointLight: true,
      priority: 8,
    },
    {
      x: targetCenter.x,
      z: targetCenter.z,
      rotation: 0,
      phase: 1.7,
      speed: 2.9,
      weak: 0.04,
      broken: false,
      range: 15.2,
      baseIntensity: 1.66,
      panelWidth: 2.8,
      color: 0xdff5dc,
      hasPointLight: true,
      priority: 7,
    },
  );

  fixtureCandidates
    .sort((a, b) => b.priority - a.priority)
    .forEach((candidate) => {
      const tooClose = fixturePositions.some(
        (fixture) =>
          Math.hypot(fixture.x - candidate.x, fixture.z - candidate.z) <
          LEVEL_ONE_MIN_FIXTURE_DISTANCE,
      );
      if (!tooClose) fixturePositions.push(candidate);
    });

  return { northSouth, eastWest, fixturePositions };
}

function createLevelOneScene() {
  const scene = new THREE.Scene();
  const FOG_COLOR = 0x8c988e;
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0115);

  const cameraFar =
    Math.hypot(LEVEL_ONE_COLS * CELL_SIZE, LEVEL_ONE_ROWS * CELL_SIZE) + CELL_SIZE * 2;
  const camera = new THREE.PerspectiveCamera(76, 1, 0.05, cameraFar);
  const viewModel = attachFirstPersonViewModel(camera);
  scene.add(camera);
  const spawnCell = levelOneCellCenter(LEVEL_ONE_START_CELL.col, LEVEL_ONE_START_CELL.row);
  const spawn = { x: spawnCell.x, z: spawnCell.z, yaw: LEVEL_ONE_START_CELL.yaw };
  const targetPosition = levelOneCellCenter(LEVEL_ONE_TARGET_CELL.col, LEVEL_ONE_TARGET_CELL.row);

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: createLevelOneFloorTexture(),
    color: 0xd5dccc,
    emissive: 0x3b463d,
    emissiveIntensity: 0.32,
    roughness: 0.96,
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: createLevelOneWallTexture(),
    color: 0xd7ddd4,
    emissive: 0x354036,
    emissiveIntensity: 0.27,
    roughness: 0.94,
  });
  const ceilingMaterial = new THREE.MeshStandardMaterial({
    map: createLevelOneCeilingTexture(),
    color: 0xcbd2c8,
    emissive: 0x414e45,
    emissiveIntensity: 0.34,
    roughness: 0.9,
  });
  const wallCapMaterial = new THREE.MeshStandardMaterial({
    color: 0x777f76,
    emissive: 0x252d28,
    emissiveIntensity: 0.12,
    roughness: 0.96,
  });
  const wallMaterials = [
    wallMaterial,
    wallMaterial,
    wallCapMaterial,
    wallCapMaterial,
    wallMaterial,
    wallMaterial,
  ];

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(LEVEL_ONE_COLS * CELL_SIZE, LEVEL_ONE_ROWS * CELL_SIZE),
    floorMaterial,
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(LEVEL_ONE_COLS * CELL_SIZE, LEVEL_ONE_ROWS * CELL_SIZE),
    ceilingMaterial,
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, CEILING_Y, 0);
  scene.add(ceiling);

  const { northSouth, eastWest, fixturePositions } = collectLevelOneTransforms();
  addInstancedBoxes(
    scene,
    new THREE.BoxGeometry(CELL_SIZE + WALL_THICKNESS, WALL_HEIGHT, WALL_THICKNESS),
    wallMaterials,
    northSouth,
  );
  addInstancedBoxes(
    scene,
    new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, CELL_SIZE + WALL_THICKNESS),
    wallMaterials,
    eastWest,
  );

  scene.add(new THREE.HemisphereLight(0xe3eadf, 0x6c766b, 1.68));
  const ceilingFill = new THREE.DirectionalLight(0xd8e4d4, 0.22);
  ceilingFill.position.set(18, CEILING_Y - 0.55, -10);
  scene.add(ceilingFill);

  const fixtures = createLevelOneLights(scene, fixturePositions);
  const updateLightState = createStableLightState("HUM", {
    dimBelow: 0.48,
    normalAbove: 0.62,
  });
  addLevelOneElevator(scene, targetPosition);
  addLevelOnePipes(scene);
  const propColliders = addLevelOneCrates(scene);
  addLevelOnePuddles(scene);
  addLevelOneFloorZones(scene);
  const almondWater = createAlmondWaterPickup(scene, {
    cols: LEVEL_ONE_COLS,
    rows: LEVEL_ONE_ROWS,
    isCellOpen: isLevelOneOpenCell,
    getCellCenter: levelOneCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
  });

  let objectiveReached = false;

  function isWalkable(x, z, radius = 0.36) {
    const corner = radius * 0.72;
    const samples = [
      [0, 0],
      [radius, 0],
      [-radius, 0],
      [0, radius],
      [0, -radius],
      [corner, corner],
      [-corner, corner],
      [corner, -corner],
      [-corner, -corner],
    ];

    const isInOpenCells = samples.every(([offsetX, offsetZ]) => {
      const cell = levelOneWorldToCell(x + offsetX, z + offsetZ);
      return isLevelOneOpenCell(cell.col, cell.row);
    });
    if (!isInOpenCells) return false;

    return !propColliders.some((collider) => circleIntersectsAabb(x, z, radius, collider));
  }

  function update(delta, elapsed, playerPosition) {
    let lightTotal = 0;
    fixtures.forEach((fixture) => {
      const hum = 0.84 + Math.sin(elapsed * 1.18 + fixture.phase) * 0.055;
      const brokenCut = fixture.broken && Math.sin(elapsed * fixture.speed + fixture.phase) > 0.93 ? 0.52 : 1;
      const pulse = Math.max(0.38, hum * brokenCut - fixture.weak);
      fixture.material.emissiveIntensity = pulse * fixture.baseIntensity * 1.55;
      updateFixturePointLight(fixture, pulse, 1.05);
      lightTotal += pulse;
    });

    const flicker = fixtures.length > 0 ? lightTotal / fixtures.length : 0.76;
    const exitDistance = Math.hypot(
      playerPosition.x - targetPosition.x,
      playerPosition.z - targetPosition.z,
    );
    if (exitDistance < LEVEL_ONE_EXIT_TRIGGER_RADIUS) objectiveReached = true;
    scene.fog.density = 0.012 + (1 - flicker) * 0.009;
    updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition);
    const almondWaterState = almondWater.update(delta, elapsed, playerPosition);

    return {
      exitDistance: Math.round(exitDistance),
      exitReached: objectiveReached,
      flicker,
      almondWater: almondWaterState,
      focusItem: almondWater.inspect(camera),
      lightState: updateLightState(delta, flicker),
      statusText: objectiveReached
        ? "ELEVATOR ONLINE"
        : exitDistance < 9
          ? "ELEVATOR TRACE"
          : "HABITABLE ZONE",
    };
  }

  return {
    level: 1,
    levelLabel: "LEVEL 1",
    levelName: "HABITABLE ZONE",
    viewModelName: getViewModelName(viewModel),
    colliderCount: propColliders.length,
    nextLevel: 2,
    scene,
    camera,
    spawn,
    isWalkable,
    update,
    tryPickup: (playerPosition) => almondWater.tryPickup(playerPosition),
  };
}

const LEVEL_TWO_COLS = 39;
const LEVEL_TWO_ROWS = 23;
const LEVEL_TWO_START_CELL = { col: 3, row: 3, yaw: -Math.PI * 0.44 };
const LEVEL_TWO_TARGET_CELL = { col: 36, row: 20 };
const LEVEL_TWO_EXIT_TRIGGER_RADIUS = CELL_SIZE * 0.74;
const LEVEL_TWO_MAX_POINT_LIGHTS = 8;
const LEVEL_TWO_MIN_FIXTURE_DISTANCE = CELL_SIZE * 5.25;

function createLevelTwoLayout() {
  const grid = Array.from({ length: LEVEL_TWO_ROWS }, () =>
    Array.from({ length: LEVEL_TWO_COLS }, () => "#"),
  );

  const carveCell = (col, row) => {
    if (row > 0 && row < LEVEL_TWO_ROWS - 1 && col > 0 && col < LEVEL_TWO_COLS - 1) {
      grid[row][col] = ".";
    }
  };

  const carveRoom = (col, row, width, height) => {
    for (let y = row; y < row + height; y += 1) {
      for (let x = col; x < col + width; x += 1) carveCell(x, y);
    }
  };

  const carveHorizontal = (fromCol, toCol, row, width = 1) => {
    const start = Math.min(fromCol, toCol);
    const end = Math.max(fromCol, toCol);
    for (let x = start; x <= end; x += 1) {
      for (let offset = 0; offset < width; offset += 1) carveCell(x, row + offset);
    }
  };

  const carveVertical = (col, fromRow, toRow, width = 1) => {
    const start = Math.min(fromRow, toRow);
    const end = Math.max(fromRow, toRow);
    for (let y = start; y <= end; y += 1) {
      for (let offset = 0; offset < width; offset += 1) carveCell(col + offset, y);
    }
  };

  carveHorizontal(2, 15, 3, 2);
  carveVertical(14, 3, 11, 2);
  carveHorizontal(8, 28, 10, 2);
  carveVertical(8, 10, 20, 2);
  carveHorizontal(8, 36, 19, 2);
  carveVertical(30, 11, 20, 2);
  carveHorizontal(24, 34, 11, 2);

  carveRoom(3, 6, 5, 4);
  carveRoom(18, 5, 6, 5);
  carveRoom(12, 13, 5, 4);
  carveRoom(25, 14, 6, 4);
  carveRoom(31, 17, 6, 4);

  const bulkheads = [
    { col: 20, row: 7 },
    { col: 22, row: 7 },
    { col: 12, row: 15 },
    { col: 28, row: 16 },
    { col: 33, row: 18 },
  ];
  bulkheads.forEach(({ col, row }) => {
    if (
      !(col === LEVEL_TWO_START_CELL.col && row === LEVEL_TWO_START_CELL.row) &&
      !(col === LEVEL_TWO_TARGET_CELL.col && row === LEVEL_TWO_TARGET_CELL.row)
    ) {
      grid[row][col] = "#";
    }
  });

  return grid.map((row) => row.join(""));
}

const LEVEL_TWO_MAP = createLevelTwoLayout();
const LEVEL_TWO_ORIGIN_X = -(LEVEL_TWO_COLS * CELL_SIZE) / 2;
const LEVEL_TWO_ORIGIN_Z = -(LEVEL_TWO_ROWS * CELL_SIZE) / 2;

function isLevelTwoOpenCell(col, row) {
  return (
    row >= 0 &&
    row < LEVEL_TWO_ROWS &&
    col >= 0 &&
    col < LEVEL_TWO_COLS &&
    LEVEL_TWO_MAP[row][col] === "."
  );
}

function levelTwoCellCenter(col, row) {
  return {
    x: LEVEL_TWO_ORIGIN_X + col * CELL_SIZE + CELL_SIZE / 2,
    z: LEVEL_TWO_ORIGIN_Z + row * CELL_SIZE + CELL_SIZE / 2,
  };
}

function levelTwoWorldToCell(x, z) {
  return {
    col: Math.floor((x - LEVEL_TWO_ORIGIN_X) / CELL_SIZE),
    row: Math.floor((z - LEVEL_TWO_ORIGIN_Z) / CELL_SIZE),
  };
}

function countLevelTwoOpenNeighbors(col, row) {
  return [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ].filter(([offsetCol, offsetRow]) => isLevelTwoOpenCell(col + offsetCol, row + offsetRow)).length;
}

function createLevelTwoGrimyTexture(seed, repeatX, repeatY, base, rust = 1) {
  const random = createSeededRandom(seed);
  return makeTexture(
    512,
    (context, size) => {
      const image = context.createImageData(size, size);
      const data = image.data;

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const i = (y * size + x) * 4;
          const grime = (tileNoise(x, y, size, 5, seed * 0.021) - 0.5) * 36;
          const soot = Math.max(0, tileNoise(x, y, size, 11, seed * 0.047) - 0.58) * -46;
          const heat = Math.max(0, tileNoise(x, y, size, 8, seed * 0.091) - 0.68) * 28 * rust;
          const fine = (random() - 0.5) * 10;
          data[i] = clampColor(base[0] + grime + soot + heat + fine);
          data[i + 1] = clampColor(base[1] + grime * 0.84 + soot * 0.72 + heat * 0.42 + fine);
          data[i + 2] = clampColor(base[2] + grime * 0.58 + soot * 0.62 + heat * 0.18 + fine * 0.7);
          data[i + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);

      context.globalAlpha = 0.18;
      context.strokeStyle = "#15140f";
      context.lineWidth = 1.3;
      for (let i = 0; i < 28; i += 1) {
        const x = random() * size;
        const y = random() * size;
        const length = 24 + random() * 120;
        const angle = random() * Math.PI;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
        context.stroke();
      }
      context.globalAlpha = 1;

      for (let x = 0; x <= size; x += 86) {
        context.fillStyle = "rgba(28,24,18,0.18)";
        context.fillRect(x - 1, 0, 2, size);
      }

      drawSpeckles(context, size, 980, 0.1, "13,12,9", random);
      drawSpeckles(context, size, 210, 0.08, "173,104,50", random);
    },
    repeatX,
    repeatY,
  );
}

function createLevelTwoFloorTexture() {
  const random = createSeededRandom(0x2f2002);
  return makeTexture(
    512,
    (context, size) => {
      context.fillStyle = "#3d3d30";
      context.fillRect(0, 0, size, size);

      for (let y = 0; y < size; y += 1) {
        const shade = 0.05 + Math.sin(y * 0.08) * 0.018;
        context.fillStyle = `rgba(0,0,0,${shade})`;
        context.fillRect(0, y, size, 1);
      }

      context.strokeStyle = "rgba(15,14,10,0.46)";
      context.lineWidth = 2;
      for (let x = 0; x <= size; x += 64) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, size);
        context.stroke();
      }
      for (let y = 0; y <= size; y += 96) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(size, y);
        context.stroke();
      }

      context.globalAlpha = 0.2;
      context.strokeStyle = "#b15d2d";
      context.lineWidth = 2.2;
      for (let i = 0; i < 16; i += 1) {
        const y = random() * size;
        context.beginPath();
        context.moveTo(random() * 80, y);
        context.lineTo(size - random() * 80, y + (random() - 0.5) * 18);
        context.stroke();
      }
      context.globalAlpha = 1;

      drawSpeckles(context, size, 1050, 0.1, "12,12,9", random);
      drawSpeckles(context, size, 360, 0.12, "153,92,43", random);
    },
    11,
    9,
  );
}

function createLevelTwoWallTexture() {
  return createLevelTwoGrimyTexture(0x2f2003, 2.4, 1.1, [84, 78, 61], 1.15);
}

function createLevelTwoCeilingTexture() {
  return createLevelTwoGrimyTexture(0x2f2004, 8, 6, [56, 54, 44], 0.8);
}

function collectLevelTwoTransforms() {
  const northSouth = [];
  const eastWest = [];
  const fixtureCandidates = [];

  for (let row = 0; row < LEVEL_TWO_ROWS; row += 1) {
    for (let col = 0; col < LEVEL_TWO_COLS; col += 1) {
      if (!isLevelTwoOpenCell(col, row)) continue;

      const center = levelTwoCellCenter(col, row);
      if (!isLevelTwoOpenCell(col, row - 1)) {
        northSouth.push(new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z - CELL_SIZE / 2));
      }
      if (!isLevelTwoOpenCell(col, row + 1)) {
        northSouth.push(new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z + CELL_SIZE / 2));
      }
      if (!isLevelTwoOpenCell(col - 1, row)) {
        eastWest.push(new THREE.Vector3(center.x - CELL_SIZE / 2, WALL_HEIGHT / 2, center.z));
      }
      if (!isLevelTwoOpenCell(col + 1, row)) {
        eastWest.push(new THREE.Vector3(center.x + CELL_SIZE / 2, WALL_HEIGHT / 2, center.z));
      }

      const neighbors = countLevelTwoOpenNeighbors(col, row);
      const eastWestOpen = isLevelTwoOpenCell(col - 1, row) || isLevelTwoOpenCell(col + 1, row);
      const isCorridor = neighbors <= 2;
      const fixtureGrid = (col * 11 + row * 7) % 17 === 0;
      if ((isCorridor && fixtureGrid) || (col === 3 && row === 3) || (col === 36 && row === 20)) {
        fixtureCandidates.push({
          x: center.x,
          z: center.z,
          rotation: eastWestOpen ? 0 : Math.PI / 2,
          phase: col * 0.57 + row * 1.17,
          speed: 3.8 + ((col + row) % 5) * 0.62,
          weak: 0.2 + ((col + row) % 3) * 0.04,
          range: col === 3 || col === 36 ? 12.6 : 9.6,
          baseIntensity: col === 3 || col === 36 ? 1.36 : 0.95,
          panelWidth: 1.35 + ((col + row) % 2) * 0.38,
          color: (col + row) % 4 === 0 ? 0xff7a3d : 0xffb05c,
          hasPointLight: true,
          priority: col === 3 || col === 36 ? 8 : isCorridor ? 3 : 1,
        });
      }
    }
  }

  const fixturePositions = [];
  fixtureCandidates
    .sort((a, b) => b.priority - a.priority)
    .forEach((candidate) => {
      const tooClose = fixturePositions.some(
        (fixture) =>
          Math.hypot(fixture.x - candidate.x, fixture.z - candidate.z) <
          LEVEL_TWO_MIN_FIXTURE_DISTANCE,
      );
      if (!tooClose) fixturePositions.push(candidate);
    });

  return { northSouth, eastWest, fixturePositions };
}

function createLevelTwoLights(scene, fixturePositions) {
  const fixtures = [];
  const pointLightIndexes = new Set(
    fixturePositions
      .map((fixture, index) => ({ index, priority: fixture.priority }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, LEVEL_TWO_MAX_POINT_LIGHTS)
      .map(({ index }) => index),
  );
  const panelGeometry = new THREE.BoxGeometry(1, 0.045, 0.34);
  const cageGeometry = new THREE.BoxGeometry(1, 0.05, 0.48);
  const cageMaterial = new THREE.MeshStandardMaterial({
    color: 0x2b2218,
    emissive: 0x140b05,
    emissiveIntensity: 0.24,
    roughness: 0.82,
    metalness: 0.36,
  });

  fixturePositions.forEach((fixture, index) => {
    const cage = new THREE.Mesh(cageGeometry, cageMaterial);
    cage.position.set(fixture.x, CEILING_Y - 0.095, fixture.z);
    cage.rotation.y = fixture.rotation;
    cage.scale.x = fixture.panelWidth + 0.2;
    scene.add(cage);

    const panelMaterial = new THREE.MeshStandardMaterial({
      color: fixture.color,
      emissive: fixture.color,
      emissiveIntensity: fixture.baseIntensity,
      roughness: 0.34,
    });
    const panel = new THREE.Mesh(panelGeometry, panelMaterial);
    panel.position.set(fixture.x, CEILING_Y - 0.145, fixture.z);
    panel.rotation.y = fixture.rotation;
    panel.scale.x = fixture.panelWidth;
    scene.add(panel);

    let light = null;
    if (pointLightIndexes.has(index)) {
      light = createFixturePointLight(fixture, CEILING_Y - 0.44, {
        rangeScale: 1.62,
        intensityScale: 1.32,
        decay: 2.05,
      });
      scene.add(light);
    }

    fixtures.push({
      material: panelMaterial,
      light,
      phase: fixture.phase,
      speed: fixture.speed,
      weak: fixture.weak,
      baseIntensity: fixture.baseIntensity,
    });
  });

  return fixtures;
}

function addLevelTwoPipe(scene, pipeMaterial, pipe) {
  const center = levelTwoCellCenter(pipe.col, pipe.row);
  const geometry = new THREE.CylinderGeometry(pipe.radius, pipe.radius, pipe.length, 14);
  const mesh = new THREE.Mesh(geometry, pipeMaterial);
  mesh.position.set(center.x + (pipe.offsetX ?? 0), pipe.y, center.z + (pipe.offsetZ ?? 0));
  if (pipe.axis === "x") mesh.rotation.z = Math.PI / 2;
  if (pipe.axis === "z") mesh.rotation.x = Math.PI / 2;
  scene.add(mesh);

  if (pipe.joint) {
    const joint = new THREE.Mesh(new THREE.SphereGeometry(pipe.radius * 1.35, 12, 8), pipeMaterial);
    joint.position.copy(mesh.position);
    scene.add(joint);
  }
}

function addLevelTwoPipes(scene) {
  const pipeMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a322a,
    emissive: 0x100a05,
    emissiveIntensity: 0.12,
    roughness: 0.76,
    metalness: 0.36,
  });
  const hotPipeMaterial = new THREE.MeshStandardMaterial({
    color: 0x57301c,
    emissive: 0x2b0d04,
    emissiveIntensity: 0.2,
    roughness: 0.7,
    metalness: 0.32,
  });
  const pipes = [
    { col: 8, row: 3, axis: "x", length: CELL_SIZE * 11, radius: 0.08, y: CEILING_Y - 0.48, offsetZ: -0.9 },
    { col: 14, row: 8, axis: "z", length: CELL_SIZE * 8.5, radius: 0.11, y: CEILING_Y - 0.36, offsetX: -0.95, hot: true, joint: true },
    { col: 20, row: 10, axis: "x", length: CELL_SIZE * 9, radius: 0.07, y: 2.55, offsetZ: 1.0 },
    { col: 8, row: 16, axis: "z", length: CELL_SIZE * 7, radius: 0.1, y: 2.8, offsetX: 0.88, hot: true },
    { col: 22, row: 19, axis: "x", length: CELL_SIZE * 17, radius: 0.09, y: CEILING_Y - 0.52, offsetZ: -1.05 },
    { col: 30, row: 15, axis: "z", length: CELL_SIZE * 9, radius: 0.12, y: 2.38, offsetX: 1.05, joint: true },
    { col: 32, row: 11, axis: "x", length: CELL_SIZE * 8, radius: 0.065, y: CEILING_Y - 0.68, offsetZ: 0.82 },
  ];

  pipes.forEach((pipe) => addLevelTwoPipe(scene, pipe.hot ? hotPipeMaterial : pipeMaterial, pipe));
}

function addLevelTwoMachinery(scene) {
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x27251f,
    emissive: 0x090704,
    emissiveIntensity: 0.1,
    roughness: 0.8,
    metalness: 0.26,
  });
  const rustMaterial = new THREE.MeshStandardMaterial({
    color: 0x5a3621,
    emissive: 0x160804,
    emissiveIntensity: 0.1,
    roughness: 0.88,
    metalness: 0.18,
  });
  const meterMaterial = new THREE.MeshBasicMaterial({ color: 0xffa05a });
  const colliders = [];
  const machines = [
    { col: 5, row: 7, width: 1.35, height: 1.15, depth: 1.0, x: 0.6, z: -0.5, rot: 0.05 },
    { col: 20, row: 7, width: 1.65, height: 1.35, depth: 0.85, x: -0.4, z: 0.5, rot: -0.12, rust: true },
    { col: 13, row: 15, width: 1.2, height: 1.0, depth: 1.25, x: 0.45, z: -0.35, rot: 0.16 },
    { col: 27, row: 15, width: 1.6, height: 1.55, depth: 1.15, x: -0.55, z: 0.42, rot: -0.06, rust: true },
    { col: 33, row: 19, width: 1.28, height: 1.08, depth: 1.0, x: 0.2, z: 0.3, rot: 0.18 },
  ];

  machines.forEach((machine) => {
    const center = levelTwoCellCenter(machine.col, machine.row);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(machine.width, machine.height, machine.depth),
      machine.rust ? rustMaterial : bodyMaterial,
    );
    mesh.position.set(center.x + machine.x, machine.height / 2, center.z + machine.z);
    mesh.rotation.y = machine.rot;
    scene.add(mesh);

    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.018), meterMaterial);
    panel.position.set(mesh.position.x, mesh.position.y + machine.height * 0.18, mesh.position.z - machine.depth / 2 - 0.012);
    panel.rotation.y = machine.rot;
    scene.add(panel);

    colliders.push({
      minX: mesh.position.x - machine.width * 0.62,
      maxX: mesh.position.x + machine.width * 0.62,
      minZ: mesh.position.z - machine.depth * 0.62,
      maxZ: mesh.position.z + machine.depth * 0.62,
    });
  });

  return colliders;
}

function addLevelTwoSteam(scene) {
  const puffs = [];
  const geometry = new THREE.SphereGeometry(0.34, 12, 8);
  const vents = [
    { col: 14, row: 8, x: -1.05, z: 0.48, phase: 0.2 },
    { col: 8, row: 16, x: 0.9, z: -0.35, phase: 1.6 },
    { col: 30, row: 15, x: 1.0, z: 0.42, phase: 2.7 },
    { col: 23, row: 19, x: -0.4, z: -1.0, phase: 3.3 },
  ];

  vents.forEach((vent) => {
    const center = levelTwoCellCenter(vent.col, vent.row);
    const material = new THREE.MeshBasicMaterial({
      color: 0xd8cdb6,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    });
    const puff = new THREE.Mesh(geometry, material);
    puff.position.set(center.x + vent.x, 1.22, center.z + vent.z);
    puff.scale.set(1, 0.8, 1);
    puff.userData.phase = vent.phase;
    scene.add(puff);
    puffs.push(puff);
  });

  return puffs;
}

function getLevelTwoTargetMount(position) {
  const cell = levelTwoWorldToCell(position.x, position.z);
  const options = [
    {
      col: cell.col,
      row: cell.row - 1,
      x: position.x,
      z: position.z - CELL_SIZE / 2 + WALL_THICKNESS * 0.7,
      rotation: 0,
    },
    {
      col: cell.col,
      row: cell.row + 1,
      x: position.x,
      z: position.z + CELL_SIZE / 2 - WALL_THICKNESS * 0.7,
      rotation: Math.PI,
    },
    {
      col: cell.col - 1,
      row: cell.row,
      x: position.x - CELL_SIZE / 2 + WALL_THICKNESS * 0.7,
      z: position.z,
      rotation: Math.PI / 2,
    },
    {
      col: cell.col + 1,
      row: cell.row,
      x: position.x + CELL_SIZE / 2 - WALL_THICKNESS * 0.7,
      z: position.z,
      rotation: -Math.PI / 2,
    },
  ];

  return options.find((option) => !isLevelTwoOpenCell(option.col, option.row)) ?? options[0];
}

function addLevelTwoServiceDoor(scene, position) {
  const mount = getLevelTwoTargetMount(position);
  const doorMaterial = new THREE.MeshStandardMaterial({
    color: 0x2b2520,
    emissive: 0x120804,
    emissiveIntensity: 0.18,
    roughness: 0.72,
    metalness: 0.34,
  });
  const signMaterial = new THREE.MeshStandardMaterial({
    map: createWideSignTexture("PIPE EXIT", "#241108", "#ffbc73"),
    color: 0xffffff,
    emissive: 0x7a2d0b,
    emissiveIntensity: 0.55,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });

  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 2.35), doorMaterial);
  door.position.set(mount.x, 1.28, mount.z);
  door.rotation.y = mount.rotation;
  scene.add(door);

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.22, 0.62), signMaterial);
  sign.position.set(mount.x, 2.62, mount.z);
  sign.rotation.y = mount.rotation;
  scene.add(sign);

  const floorMarker = new THREE.Mesh(
    new THREE.RingGeometry(CELL_SIZE * 0.32, CELL_SIZE * 0.52, 32),
    new THREE.MeshBasicMaterial({
      color: 0xff8b3d,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  floorMarker.rotation.x = -Math.PI / 2;
  floorMarker.position.set(position.x, 0.035, position.z);
  scene.add(floorMarker);

  const glow = new THREE.PointLight(0xff8b3d, 0.52, 6.8, 2.2);
  glow.position.set(position.x, 1.6, position.z);
  scene.add(glow);
}

function addLevelTwoFloorHeat(scene) {
  const material = new THREE.MeshBasicMaterial({
    color: 0xff7a30,
    transparent: true,
    opacity: 0.055,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const zones = [
    { col: 13, row: 9, width: 3.2, height: 5.8, rot: 0.08 },
    { col: 29, row: 16, width: 3.6, height: 4.8, rot: -0.11 },
    { col: 21, row: 19, width: 6.4, height: 2.0, rot: 0.02 },
  ];

  zones.forEach((zone) => {
    const center = levelTwoCellCenter(zone.col, zone.row);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(zone.width, zone.height), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = zone.rot;
    mesh.position.set(center.x, 0.028, center.z);
    scene.add(mesh);
  });
}

function createLevelTwoScene() {
  const scene = new THREE.Scene();
  const FOG_COLOR = 0x554537;
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0165);

  const cameraFar =
    Math.hypot(LEVEL_TWO_COLS * CELL_SIZE, LEVEL_TWO_ROWS * CELL_SIZE) + CELL_SIZE * 2;
  const camera = new THREE.PerspectiveCamera(76, 1, 0.05, cameraFar);
  const viewModel = attachFirstPersonViewModel(camera);
  scene.add(camera);

  const spawnCell = levelTwoCellCenter(LEVEL_TWO_START_CELL.col, LEVEL_TWO_START_CELL.row);
  const spawn = { x: spawnCell.x, z: spawnCell.z, yaw: LEVEL_TWO_START_CELL.yaw };
  const targetPosition = levelTwoCellCenter(LEVEL_TWO_TARGET_CELL.col, LEVEL_TWO_TARGET_CELL.row);

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: createLevelTwoFloorTexture(),
    color: 0xc9b990,
    emissive: 0x2e2112,
    emissiveIntensity: 0.4,
    roughness: 0.94,
    metalness: 0.08,
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: createLevelTwoWallTexture(),
    color: 0xd0c29b,
    emissive: 0x2c1d0f,
    emissiveIntensity: 0.32,
    roughness: 0.94,
    metalness: 0.04,
  });
  const ceilingMaterial = new THREE.MeshStandardMaterial({
    map: createLevelTwoCeilingTexture(),
    color: 0x8b8170,
    emissive: 0x281c12,
    emissiveIntensity: 0.36,
    roughness: 0.9,
    metalness: 0.08,
  });
  const wallCapMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b4335,
    emissive: 0x130e08,
    emissiveIntensity: 0.16,
    roughness: 0.92,
    metalness: 0.08,
  });
  const wallMaterials = [
    wallMaterial,
    wallMaterial,
    wallCapMaterial,
    wallCapMaterial,
    wallMaterial,
    wallMaterial,
  ];

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(LEVEL_TWO_COLS * CELL_SIZE, LEVEL_TWO_ROWS * CELL_SIZE),
    floorMaterial,
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(LEVEL_TWO_COLS * CELL_SIZE, LEVEL_TWO_ROWS * CELL_SIZE),
    ceilingMaterial,
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, CEILING_Y, 0);
  scene.add(ceiling);

  const { northSouth, eastWest, fixturePositions } = collectLevelTwoTransforms();
  addInstancedBoxes(
    scene,
    new THREE.BoxGeometry(CELL_SIZE + WALL_THICKNESS, WALL_HEIGHT, WALL_THICKNESS),
    wallMaterials,
    northSouth,
  );
  addInstancedBoxes(
    scene,
    new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, CELL_SIZE + WALL_THICKNESS),
    wallMaterials,
    eastWest,
  );

  scene.add(new THREE.HemisphereLight(0xffbd82, 0x332216, 1.14));
  const heatFill = new THREE.DirectionalLight(0xff9b54, 0.22);
  heatFill.position.set(-8, CEILING_Y - 0.3, 18);
  scene.add(heatFill);

  const fixtures = createLevelTwoLights(scene, fixturePositions);
  const updateLightState = createStableLightState("HEAT", {
    dimBelow: 0.34,
    normalAbove: 0.52,
    dimDelay: 0.5,
    normalDelay: 0.78,
  });
  addLevelTwoServiceDoor(scene, targetPosition);
  addLevelTwoPipes(scene);
  const propColliders = addLevelTwoMachinery(scene);
  const steamPuffs = addLevelTwoSteam(scene);
  addLevelTwoFloorHeat(scene);
  const almondWater = createAlmondWaterPickup(scene, {
    cols: LEVEL_TWO_COLS,
    rows: LEVEL_TWO_ROWS,
    isCellOpen: isLevelTwoOpenCell,
    getCellCenter: levelTwoCellCenter,
    avoidPositions: [spawnCell, targetPosition],
    blockedAabbs: propColliders,
  });

  let objectiveReached = false;

  function isWalkable(x, z, radius = 0.36) {
    const corner = radius * 0.72;
    const samples = [
      [0, 0],
      [radius, 0],
      [-radius, 0],
      [0, radius],
      [0, -radius],
      [corner, corner],
      [-corner, corner],
      [corner, -corner],
      [-corner, -corner],
    ];

    const isInOpenCells = samples.every(([offsetX, offsetZ]) => {
      const cell = levelTwoWorldToCell(x + offsetX, z + offsetZ);
      return isLevelTwoOpenCell(cell.col, cell.row);
    });
    if (!isInOpenCells) return false;

    return !propColliders.some((collider) => circleIntersectsAabb(x, z, radius, collider));
  }

  function update(delta, elapsed, playerPosition) {
    let lightTotal = 0;
    fixtures.forEach((fixture) => {
      const hum = 0.78 + Math.sin(elapsed * 1.7 + fixture.phase) * 0.07;
      const brownout = Math.sin(elapsed * fixture.speed + fixture.phase * 1.7) > 0.91 ? 0.48 : 1;
      const pulse = Math.max(0.24, hum * brownout - fixture.weak);
      fixture.material.emissiveIntensity = pulse * fixture.baseIntensity * 1.8;
      updateFixturePointLight(fixture, pulse, 1.08);
      lightTotal += pulse;
    });

    steamPuffs.forEach((puff) => {
      const phase = puff.userData.phase ?? 0;
      const wave = 0.5 + Math.sin(elapsed * 1.8 + phase) * 0.5;
      const scale = 0.8 + wave * 0.9;
      puff.scale.set(scale * 0.78, 0.65 + wave * 0.9, scale);
      puff.position.y = 1.12 + wave * 0.18;
      puff.material.opacity = 0.035 + wave * 0.07;
    });

    const flicker = fixtures.length > 0 ? lightTotal / fixtures.length : 0.56;
    const exitDistance = Math.hypot(
      playerPosition.x - targetPosition.x,
      playerPosition.z - targetPosition.z,
    );
    if (exitDistance < LEVEL_TWO_EXIT_TRIGGER_RADIUS) objectiveReached = true;
    scene.fog.density = 0.016 + (1 - flicker) * 0.01;
    updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition);
    const almondWaterState = almondWater.update(delta, elapsed, playerPosition);

    return {
      exitDistance: Math.round(exitDistance),
      exitReached: objectiveReached,
      flicker,
      almondWater: almondWaterState,
      focusItem: almondWater.inspect(camera),
      lightState: updateLightState(delta, flicker),
      statusText: objectiveReached
        ? "SERVICE LOCKED"
        : exitDistance < 8
          ? "PIPE EXIT TRACE"
          : "PIPE DREAMS",
    };
  }

  return {
    level: 2,
    levelLabel: "LEVEL 2",
    levelName: "PIPE DREAMS",
    viewModelName: getViewModelName(viewModel),
    colliderCount: propColliders.length,
    nextLevel: null,
    scene,
    camera,
    spawn,
    isWalkable,
    update,
    tryPickup: (playerPosition) => almondWater.tryPickup(playerPosition),
  };
}

export function createBackroomsScene(level = 0) {
  const levelInfo = getBackroomsLevelInfo(level);
  if (levelInfo.level === 1) return createLevelOneScene();
  if (levelInfo.level === 2) return createLevelTwoScene();
  return createLevelZeroScene();
}
