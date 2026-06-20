import * as THREE from "three";

const CELL_SIZE = 4;
const WALL_HEIGHT = 3.72;
const WALL_THICKNESS = 0.22;
const CEILING_Y = 3.66;
const MAX_POINT_LIGHTS = 14;

const LAYOUT_COLS = 31;
const LAYOUT_ROWS = 27;

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

const matrix = new THREE.Matrix4();
const identityQuaternion = new THREE.Quaternion();
const unitScale = new THREE.Vector3(1, 1, 1);

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

function drawSpeckles(context, size, count, alpha, color = "0,0,0") {
  for (let i = 0; i < count; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = Math.random() * 2.4 + 0.35;
    context.fillStyle = `rgba(${color},${Math.random() * alpha})`;
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

function createLights(scene, fixturePositions) {
  const fixtures = [];
  const pointLightIndexes = new Set(
    fixturePositions
      .map((fixture, index) => ({ index, priority: fixture.priority }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, MAX_POINT_LIGHTS)
      .map(({ index }) => index),
  );
  const panelGeometry = new THREE.BoxGeometry(1, 0.04, 0.42);
  const trimGeometry = new THREE.BoxGeometry(1, 0.035, 0.62);
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x2b2c22,
    roughness: 0.72,
    metalness: 0.08,
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
      light = new THREE.PointLight(fixture.color, fixture.baseIntensity, fixture.range, 1.8);
      light.position.set(fixture.x, CEILING_Y - 0.25, fixture.z);
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

function addExitSign(scene, position) {
  const signMap = createSignTexture("EXIT", "#172d1d", "#a5ffba");
  const signMaterial = new THREE.MeshStandardMaterial({
    map: signMap,
    color: 0xffffff,
    emissive: 0x3fff72,
    emissiveIntensity: 0.55,
    roughness: 0.42,
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.25, 0.9), signMaterial);
  sign.position.set(position.x, 2.34, position.z + CELL_SIZE / 2 - 0.12);
  sign.rotation.y = Math.PI;
  scene.add(sign);

  const glow = new THREE.PointLight(0x6dff8f, 0.9, 7, 2.2);
  glow.position.set(position.x, 2.39, position.z + CELL_SIZE / 2 - 0.55);
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
    color: 0x080904,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffed9a,
    transparent: true,
    opacity: 0.12,
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
  const fixturePositions = [];

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (!isOpenCell(col, row)) continue;

      const center = cellCenter(col, row);
      const isBrightZone = isInAnyZone(col, row, BRIGHT_ZONES);
      const isDarkZone = isInAnyZone(col, row, DARK_ZONES);
      const openNeighborCount = countOpenNeighbors(col, row);
      const isSpacious = openNeighborCount >= 3;
      if (!isOpenCell(col, row - 1)) {
        northSouth.push(new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z - CELL_SIZE / 2));
      }
      if (!isOpenCell(col, row + 1)) {
        northSouth.push(new THREE.Vector3(center.x, WALL_HEIGHT / 2, center.z + CELL_SIZE / 2));
      }
      if (!isOpenCell(col - 1, row)) {
        eastWest.push(new THREE.Vector3(center.x - CELL_SIZE / 2, WALL_HEIGHT / 2, center.z));
      }
      if (!isOpenCell(col + 1, row)) {
        eastWest.push(new THREE.Vector3(center.x + CELL_SIZE / 2, WALL_HEIGHT / 2, center.z));
      }

      const lightSeed = (col * 37 + row * 19) % 11;
      const wideLightSeed = (col * 17 + row * 29) % 19;
      const shouldLight =
        (isBrightZone && wideLightSeed <= 2) ||
        (!isDarkZone && isSpacious && lightSeed === 0 && (row + col) % 2 === 0) ||
        (!isDarkZone && !isSpacious && lightSeed === 0) ||
        (isDarkZone && lightSeed === 0 && (row + col) % 3 === 0);

      if (shouldLight) {
        fixturePositions.push({
          x: center.x,
          z: center.z,
          rotation: (row + col) % 2 === 0 ? 0 : Math.PI / 2,
          phase: col * 0.83 + row * 1.17,
          speed: isDarkZone ? 8 + ((col * row) % 7) : 4 + ((col * row) % 5),
          weak: isDarkZone ? 0.48 : isBrightZone ? 0 : isSpacious ? 0.12 : 0.3,
          range: isBrightZone ? 12.8 : isDarkZone ? 5.7 : 8.8,
          baseIntensity: isBrightZone ? 1.48 : isDarkZone ? 0.38 : 0.86,
          panelWidth: isBrightZone ? 2.85 : isSpacious ? 2.05 : 1.35,
          color: isDarkZone ? 0xd4b05f : 0xffefb0,
          hasPointLight: isBrightZone || isSpacious || lightSeed === 0,
          priority: (isBrightZone ? 3 : 0) + (isSpacious ? 1 : 0) - (isDarkZone ? 2 : 0),
        });
      }
    }
  }

  return { northSouth, eastWest, fixturePositions };
}

export function createBackroomsScene() {
  const scene = new THREE.Scene();
  // The background MUST match the fog colour, otherwise corridor ends, the
  // far-clip plane and plane edges render as black voids instead of dissolving
  // into the warm Backrooms haze.
  const HAZE_COLOR = 0xd4bd65;
  scene.background = new THREE.Color(HAZE_COLOR);
  scene.fog = new THREE.FogExp2(HAZE_COLOR, 0.024);

  const camera = new THREE.PerspectiveCamera(76, 1, 0.05, 82);
  const spawnCell = cellCenter(START_CELL.col, START_CELL.row);
  const spawn = { x: spawnCell.x, z: spawnCell.z, yaw: START_CELL.yaw };
  const exitPosition = cellCenter(EXIT_CELL.col, EXIT_CELL.row);

  const carpetTexture = createCarpetTexture();
  const wallpaperTexture = createWallpaperTexture();
  const ceilingTexture = createCeilingTexture();

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: carpetTexture,
    color: 0xffffff,
    emissive: 0x4a3b18,
    emissiveIntensity: 0.08,
    roughness: 0.98,
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: wallpaperTexture,
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0,
  });
  const ceilingMaterial = new THREE.MeshStandardMaterial({
    map: ceilingTexture,
    color: 0xffffff,
    emissive: 0xd0b86c,
    emissiveIntensity: 0.42,
    roughness: 0.86,
  });

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
    wallMaterial,
    northSouth,
  );
  addInstancedBoxes(
    scene,
    new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, CELL_SIZE + WALL_THICKNESS),
    wallMaterial,
    eastWest,
  );

  const ambientLight = new THREE.HemisphereLight(0xfff1b8, 0x90713a, 0.92);
  scene.add(ambientLight);

  const ceilingFill = new THREE.DirectionalLight(0xfff1bd, 0.26);
  ceilingFill.position.set(-18, CEILING_Y - 0.45, 12);
  scene.add(ceilingFill);

  const fixtures = createLights(scene, fixturePositions);
  addExitSign(scene, exitPosition);
  addPipes(scene);
  addMoodZones(scene);

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

  function update(_delta, elapsed, playerPosition) {
    let flicker = 0.78;
    fixtures.forEach((fixture) => {
      const soft = 0.72 + Math.sin(elapsed * 1.7 + fixture.phase) * 0.1;
      const sharp = Math.sin(elapsed * fixture.speed + fixture.phase * 2.4) > 0.89 ? 0.18 : 1;
      const pulse = Math.max(0.18, soft * sharp - fixture.weak);
      fixture.material.emissiveIntensity = pulse * fixture.baseIntensity * 1.55;
      if (fixture.light) fixture.light.intensity = pulse * fixture.baseIntensity * 1.12;
      flicker = Math.min(flicker, pulse);
    });

    const exitDistance = Math.hypot(
      playerPosition.x - exitPosition.x,
      playerPosition.z - exitPosition.z,
    );
    scene.fog.density = 0.02 + (1 - flicker) * 0.013;

    return {
      exitDistance: Math.round(exitDistance),
      flicker,
    };
  }

  return {
    scene,
    camera,
    spawn,
    isWalkable,
    update,
  };
}
