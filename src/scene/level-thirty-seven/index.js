import * as THREE from "three";
import { CELL_SIZE, CEILING_Y } from "../constants.js";
import { addInstancedBoxes, createStableLightState } from "../common/lighting.js";
import {
  collectGridWallTransforms,
  createGridWalkability,
  createStandardPickupSet,
  eastWestWallGeometry,
  northSouthWallGeometry,
} from "../common/grid-world.js";
import { attachFirstPersonViewModel, getViewModelName, updateFirstPersonHazmatViewModel } from "../common/view-model.js";
import { createExitNetwork } from "../common/exit-network.js";
import {
  LEVEL_THIRTY_SEVEN_COLS,
  LEVEL_THIRTY_SEVEN_ROWS,
  LEVEL_THIRTY_SEVEN_START_CELL,
  LEVEL_THIRTY_SEVEN_TARGET_CELL,
  isLevelThirtySevenOpenCell,
  levelThirtySevenCellCenter,
  levelThirtySevenWorldToCell,
} from "./layout.js";
import {
  createLevelThirtySevenCeilingTexture,
  createLevelThirtySevenFloorTexture,
  createLevelThirtySevenWallTexture,
  createLevelThirtySevenPbrMaps,
} from "./textures.js";
import { enableAoUv } from "../common/texture-utils.js";

function createWaterSurface(scene) {
  const uniforms = { time: { value: 0 } };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      uniform float time;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.z += sin(position.x * 0.11 + time * 0.7) * 0.018;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float time;
      void main() {
        float wave = sin((vUv.x + vUv.y) * 85.0 + time * 1.1) * 0.5 + 0.5;
        float crossWave = sin((vUv.x - vUv.y) * 62.0 - time * 0.84) * 0.5 + 0.5;
        float caustic = smoothstep(0.83, 1.0, wave * crossWave);
        vec3 color = mix(vec3(0.08, 0.42, 0.48), vec3(0.42, 0.79, 0.76), wave * 0.18);
        color += vec3(0.2, 0.35, 0.28) * caustic;
        gl_FragColor = vec4(color, 0.46);
      }
    `,
  });
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(LEVEL_THIRTY_SEVEN_COLS * CELL_SIZE, LEVEL_THIRTY_SEVEN_ROWS * CELL_SIZE, 18, 14),
    material,
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.12;
  scene.add(water);
  return { uniforms };
}

function addPoolroomDetails(scene) {
  const archMaterial = new THREE.MeshStandardMaterial({ color: 0xdce8df, emissive: 0x365b58, emissiveIntensity: 0.13, roughness: 0.64 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x081516, emissive: 0x020809, emissiveIntensity: 0.08, roughness: 0.94 });
  for (const cell of [{ col: 12, row: 23 }, { col: 23, row: 17 }, { col: 35, row: 11 }, { col: 38, row: 24 }]) {
    const center = levelThirtySevenCellCenter(cell.col, cell.row);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.24, 10, 28, Math.PI), archMaterial);
    arch.position.set(center.x, 1.35, center.z);
    arch.rotation.z = Math.PI;
    scene.add(arch);
  }
  for (const cell of [{ col: 7, row: 10 }, { col: 42, row: 4 }]) {
    const center = levelThirtySevenCellCenter(cell.col, cell.row);
    const voidPool = new THREE.Mesh(new THREE.CircleGeometry(3.1, 32), darkMaterial);
    voidPool.rotation.x = -Math.PI / 2;
    voidPool.position.set(center.x, 0.135, center.z);
    scene.add(voidPool);
  }
}

export function createLevelThirtySevenScene({ initialState = null } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x769a9b);
  scene.fog = new THREE.FogExp2(0x769a9b, 0.0075);
  const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 270);
  const viewModel = attachFirstPersonViewModel(camera);
  scene.add(camera);
  const spawnCell = levelThirtySevenCellCenter(LEVEL_THIRTY_SEVEN_START_CELL.col, LEVEL_THIRTY_SEVEN_START_CELL.row);
  const targetPosition = levelThirtySevenCellCenter(LEVEL_THIRTY_SEVEN_TARGET_CELL.col, LEVEL_THIRTY_SEVEN_TARGET_CELL.row);
  const spawn = { ...spawnCell, yaw: LEVEL_THIRTY_SEVEN_START_CELL.yaw };
  const floorMaterial = new THREE.MeshStandardMaterial({ ...createLevelThirtySevenPbrMaps(24, 18), color: 0xf2f7ee, emissive: 0x486c67, emissiveIntensity: 0.16, roughness: 0.44, normalScale: new THREE.Vector2(0.38, 0.38), aoMapIntensity: 0.5 });
  const wallMaterial = new THREE.MeshStandardMaterial({ ...createLevelThirtySevenPbrMaps(16, 8), color: 0xf4f8ef, emissive: 0x4c706b, emissiveIntensity: 0.18, roughness: 0.38, normalScale: new THREE.Vector2(0.42, 0.42), aoMapIntensity: 0.44 });
  const ceilingMaterial = new THREE.MeshStandardMaterial({ map: createLevelThirtySevenCeilingTexture(), color: 0xf4f6ea, emissive: 0x76918a, emissiveIntensity: 0.3, roughness: 0.52 });
  const floor = new THREE.Mesh(enableAoUv(new THREE.PlaneGeometry(LEVEL_THIRTY_SEVEN_COLS * CELL_SIZE, LEVEL_THIRTY_SEVEN_ROWS * CELL_SIZE)), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(LEVEL_THIRTY_SEVEN_COLS * CELL_SIZE, LEVEL_THIRTY_SEVEN_ROWS * CELL_SIZE), ceilingMaterial);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = CEILING_Y;
  scene.add(ceiling);
  const walls = collectGridWallTransforms({ cols: LEVEL_THIRTY_SEVEN_COLS, rows: LEVEL_THIRTY_SEVEN_ROWS, isOpen: isLevelThirtySevenOpenCell, cellCenter: levelThirtySevenCellCenter });
  addInstancedBoxes(scene, northSouthWallGeometry, wallMaterial, walls.northSouth);
  addInstancedBoxes(scene, eastWestWallGeometry, wallMaterial, walls.eastWest);
  const water = createWaterSurface(scene);
  addPoolroomDetails(scene);
  scene.add(new THREE.HemisphereLight(0xd9fff7, 0x315657, 1.55));
  const sunlight = new THREE.DirectionalLight(0xe9fff8, 0.72);
  sunlight.position.set(-24, 36, -18);
  scene.add(sunlight);
  const coarse = window.matchMedia?.("(pointer: coarse), (max-width: 800px)").matches;
  const lightCells = [{ col: 5, row: 31 }, { col: 13, row: 22 }, { col: 22, row: 16 }, { col: 34, row: 10 }, { col: 42, row: 5 }, { col: 30, row: 28 }, { col: 7, row: 11 }, { col: 39, row: 23 }];
  lightCells.slice(0, coarse ? 6 : 8).forEach((cell, index) => {
    const center = levelThirtySevenCellCenter(cell.col, cell.row);
    const light = new THREE.PointLight(index % 3 === 0 ? 0xc8fff4 : 0xfff5d0, 1.35, 25, 2.05);
    light.position.set(center.x, CEILING_Y - 0.42, center.z);
    scene.add(light);
  });
  const updateLightState = createStableLightState("WATER", { dimBelow: 0.48, normalAbove: 0.68, dimDelay: 0.8, normalDelay: 1.1 });
  const isWalkable = createGridWalkability({ worldToCell: levelThirtySevenWorldToCell, isOpen: isLevelThirtySevenOpenCell });
  const routes = [{ id: "level-thirty-seven-dark-tunnel", targetLevel: null, targetLabel: "DARK TUNNEL", label: "EXIT", kind: "door", position: targetPosition, rotation: 0 }];
  const exitNetwork = createExitNetwork(scene, camera, routes, initialState?.interactions ?? {});
  const pickupSet = createStandardPickupSet(scene, {
    cols: LEVEL_THIRTY_SEVEN_COLS, rows: LEVEL_THIRTY_SEVEN_ROWS, isCellOpen: isLevelThirtySevenOpenCell, getCellCenter: levelThirtySevenCellCenter,
    avoidPositions: [spawnCell, targetPosition], initialState: initialState?.pickups ?? {},
  });
  let objectiveReached = Boolean(initialState?.objectives?.reached);
  function update(delta, elapsed, playerPosition) {
    water.uniforms.time.value = elapsed;
    const entered = exitNetwork.update(delta, playerPosition);
    if (entered) objectiveReached = true;
    const pickupStates = pickupSet.update(delta, elapsed, playerPosition);
    const flicker = 0.76 + Math.sin(elapsed * 0.31) * 0.045;
    scene.fog.density = 0.0075 + Math.sin(elapsed * 0.18) * 0.00035;
    updateFirstPersonHazmatViewModel(viewModel, elapsed, playerPosition);
    const exitDistance = Math.hypot(playerPosition.x - targetPosition.x, playerPosition.z - targetPosition.z);
    return {
      exitDistance: Math.round(exitDistance), exitReached: Boolean(entered), nextLevel: entered?.targetLevel,
      entityContact: false, flicker, pickups: Object.values(pickupStates), entities: [], focusEntity: null,
      focusInteraction: exitNetwork.inspect(playerPosition), focusItem: pickupSet.inspect(camera),
      lightState: updateLightState(delta, flicker), statusText: exitDistance < 12 ? "DARK TUNNEL" : "SUBLIMITY",
    };
  }
  return {
    level: 37, levelLabel: "LEVEL 37", levelName: "SUBLIMITY", scene, camera, spawn, targetPosition,
    nextLevel: null, exitMode: "network", isWalkable, movementSpeedMultiplier: 0.84, flashlightEffectiveness: 0.92,
    get viewModelName() { return getViewModelName(viewModel); },
    decorativeItemSpawns: [{ id: "seashell", position: { ...levelThirtySevenCellCenter(12, 28), y: 0.18 }, rotation: -0.3, tiltZ: 0.14 }],
    update,
    getPickupTarget: (playerPosition) => pickupSet.getPickupTarget(playerPosition),
    tryPickup: (playerPosition) => pickupSet.tryPickup(playerPosition),
    interact: (playerPosition, access) => exitNetwork.interact(playerPosition, access),
    getSnapshot: () => ({ pickups: pickupSet.getState(), interactions: exitNetwork.getState(), objectives: { reached: objectiveReached }, entities: [] }),
  };
}
