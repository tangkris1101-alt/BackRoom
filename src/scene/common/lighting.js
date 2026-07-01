import * as THREE from "three";

const matrix = new THREE.Matrix4();
const identityQuaternion = new THREE.Quaternion();
const unitScale = new THREE.Vector3(1, 1, 1);

export function addInstancedBoxes(scene, geometry, material, transforms) {
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  transforms.forEach((position, index) => {
    matrix.compose(position, identityQuaternion, unitScale);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
  return mesh;
}

export function createFixturePointLight(fixture, y, { rangeScale, intensityScale, decay = 2 }) {
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

export function updateFixturePointLight(fixture, pulse, fallbackScale = 1) {
  if (!fixture.light) return;
  fixture.light.intensity =
    pulse * fixture.baseIntensity * (fixture.light.userData.intensityScale ?? fallbackScale);
}

export function createStableLightState(normalLabel, { dimBelow, normalAbove, dimDelay = 0.42, normalDelay = 0.62 }) {
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
