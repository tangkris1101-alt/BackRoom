import * as THREE from "three";

const CELL_SIZE = 4;
const WALL_HEIGHT = 3.18;
const WALL_THICKNESS = 0.22;
const CEILING_Y = 3.12;

const MAP = [
  "#####################",
  "#.........#.........#",
  "#.#####.#.#.#####.#.#",
  "#.#...#.#.#.#...#.#.#",
  "#.#.#.#.#...#.#.#.#.#",
  "#...#...#####.#...#.#",
  "###.#####.....#####.#",
  "#...#...#.###.#.....#",
  "#.###.#.#.#.#.#.#####",
  "#.....#...#...#.....#",
  "#####.#########.###.#",
  "#...#.......#...#...#",
  "#.#.#######.#.###.#.#",
  "#.#.......#.#.....#.#",
  "#.#######.#.#####.#.#",
  "#.....#...#.....#.#.#",
  "#.###.#.#######.#.#.#",
  "#...#...........#...#",
  "#####################",
];

const ROWS = MAP.length;
const COLS = MAP[0].length;
const ORIGIN_X = -(COLS * CELL_SIZE) / 2;
const ORIGIN_Z = -(ROWS * CELL_SIZE) / 2;

const START_CELL = { col: 1, row: 17, yaw: -Math.PI * 0.42 };
const EXIT_CELL = { col: 19, row: 1 };

const matrix = new THREE.Matrix4();
const identityQuaternion = new THREE.Quaternion();
const unitScale = new THREE.Vector3(1, 1, 1);

function isOpenCell(col, row) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS && MAP[row][col] === ".";
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
      const gradient = context.createLinearGradient(0, 0, size, size);
      gradient.addColorStop(0, "#d8c866");
      gradient.addColorStop(0.52, "#c5b756");
      gradient.addColorStop(1, "#a99943");
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);

      for (let x = -24; x < size + 24; x += 42) {
        context.strokeStyle = "rgba(92,80,35,0.26)";
        context.lineWidth = 2;
        context.beginPath();
        for (let y = 0; y <= size; y += 8) {
          const wave = Math.sin(y * 0.038 + x * 0.13) * 5;
          if (y === 0) {
            context.moveTo(x + wave, y);
          } else {
            context.lineTo(x + wave, y);
          }
        }
        context.stroke();
      }

      for (let y = 38; y < size; y += 82) {
        context.fillStyle = "rgba(244,231,126,0.22)";
        context.fillRect(0, y, size, 5);
        context.fillStyle = "rgba(83,71,31,0.16)";
        context.fillRect(0, y + 6, size, 2);
      }

      drawSpeckles(context, size, 460, 0.16, "44,38,21");
      drawSpeckles(context, size, 70, 0.2, "112,99,43");
    },
    1.6,
    1.4,
  );
}

function createCarpetTexture() {
  return makeTexture(
    512,
    (context, size) => {
      context.fillStyle = "#72642f";
      context.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 8) {
        context.fillStyle = y % 16 === 0 ? "rgba(40,34,18,0.2)" : "rgba(218,194,91,0.06)";
        context.fillRect(0, y, size, 3);
      }
      for (let x = 0; x < size; x += 28) {
        context.fillStyle = "rgba(22,19,13,0.15)";
        context.fillRect(x, 0, 2, size);
      }
      drawSpeckles(context, size, 1600, 0.12, "10,9,7");
      drawSpeckles(context, size, 800, 0.08, "210,178,77");
    },
    18,
    18,
  );
}

function createCeilingTexture() {
  return makeTexture(
    512,
    (context, size) => {
      context.fillStyle = "#b7b08b";
      context.fillRect(0, 0, size, size);
      context.strokeStyle = "rgba(43,45,36,0.34)";
      context.lineWidth = 4;
      for (let x = 0; x <= size; x += 128) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, size);
        context.stroke();
      }
      for (let y = 0; y <= size; y += 128) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(size, y);
        context.stroke();
      }
      drawSpeckles(context, size, 520, 0.12, "33,34,27");
      drawSpeckles(context, size, 90, 0.2, "91,84,45");
    },
    12,
    12,
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
  const panelGeometry = new THREE.BoxGeometry(1.8, 0.04, 0.42);
  const trimGeometry = new THREE.BoxGeometry(2.04, 0.035, 0.62);
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x2b2c22,
    roughness: 0.72,
    metalness: 0.08,
  });

  fixturePositions.forEach((fixture, index) => {
    const glowMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff4ba,
      emissive: 0xffef9d,
      emissiveIntensity: 1.2,
      roughness: 0.28,
    });
    const trim = new THREE.Mesh(trimGeometry, trimMaterial);
    trim.position.set(fixture.x, CEILING_Y - 0.055, fixture.z);
    trim.rotation.y = fixture.rotation;
    scene.add(trim);

    const panel = new THREE.Mesh(panelGeometry, glowMaterial);
    panel.position.set(fixture.x, CEILING_Y - 0.09, fixture.z);
    panel.rotation.y = fixture.rotation;
    scene.add(panel);

    let light = null;
    if (index < 16) {
      light = new THREE.PointLight(0xffefb0, 0.95, 8.8, 1.8);
      light.position.set(fixture.x, CEILING_Y - 0.25, fixture.z);
      scene.add(light);
    }

    fixtures.push({
      panel,
      material: glowMaterial,
      light,
      phase: fixture.phase,
      speed: fixture.speed,
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
  sign.position.set(position.x, 2.1, position.z + CELL_SIZE / 2 - 0.12);
  sign.rotation.y = Math.PI;
  scene.add(sign);

  const glow = new THREE.PointLight(0x6dff8f, 0.9, 7, 2.2);
  glow.position.set(position.x, 2.15, position.z + CELL_SIZE / 2 - 0.55);
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
    { col: 5, row: 7, rotation: Math.PI / 2 },
    { col: 14, row: 12, rotation: Math.PI / 2 },
    { col: 10, row: 4, rotation: 0 },
  ];

  pipeRows.forEach((pipe) => {
    const center = cellCenter(pipe.col, pipe.row);
    const mesh = new THREE.Mesh(pipeGeometry, pipeMaterial);
    mesh.position.set(center.x, 2.86, center.z);
    mesh.rotation.z = Math.PI / 2;
    mesh.rotation.y = pipe.rotation;
    scene.add(mesh);
  });
}

function collectWallTransforms() {
  const northSouth = [];
  const eastWest = [];
  const fixturePositions = [];

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (!isOpenCell(col, row)) continue;

      const center = cellCenter(col, row);
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
      if (lightSeed === 0 || (row + col) % 13 === 0) {
        fixturePositions.push({
          x: center.x,
          z: center.z,
          rotation: (row + col) % 2 === 0 ? 0 : Math.PI / 2,
          phase: col * 0.83 + row * 1.17,
          speed: 6 + ((col * row) % 5),
          weak: lightSeed === 0 ? 0 : 0.22,
        });
      }
    }
  }

  return { northSouth, eastWest, fixturePositions };
}

export function createBackroomsScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x15150d);
  scene.fog = new THREE.FogExp2(0xc8b55a, 0.026);

  const camera = new THREE.PerspectiveCamera(76, 1, 0.05, 82);
  const spawnCell = cellCenter(START_CELL.col, START_CELL.row);
  const spawn = { x: spawnCell.x, z: spawnCell.z, yaw: START_CELL.yaw };
  const exitPosition = cellCenter(EXIT_CELL.col, EXIT_CELL.row);

  const carpetTexture = createCarpetTexture();
  const wallpaperTexture = createWallpaperTexture();
  const ceilingTexture = createCeilingTexture();

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: carpetTexture,
    color: 0xb99d49,
    roughness: 0.98,
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: wallpaperTexture,
    color: 0xd4c15e,
    roughness: 0.94,
    metalness: 0,
  });
  const ceilingMaterial = new THREE.MeshStandardMaterial({
    map: ceilingTexture,
    color: 0xb8af88,
    roughness: 0.9,
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

  const ambientLight = new THREE.HemisphereLight(0xf6e9a2, 0x342e19, 0.72);
  scene.add(ambientLight);

  const fixtures = createLights(scene, fixturePositions);
  addExitSign(scene, exitPosition);
  addPipes(scene);

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
      fixture.material.emissiveIntensity = pulse * 1.55;
      if (fixture.light) fixture.light.intensity = pulse * 1.15;
      flicker = Math.min(flicker, pulse);
    });

    const exitDistance = Math.hypot(
      playerPosition.x - exitPosition.x,
      playerPosition.z - exitPosition.z,
    );
    scene.fog.density = 0.022 + (1 - flicker) * 0.014;

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
