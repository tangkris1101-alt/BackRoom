import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";

const storage = new Map();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
  },
});

const {
  MATERIAL_QUALITY,
  createGameMaterial,
  setMaterialQuality,
} = await import("../src/scene/common/materials.js");
const { disposeWorldResources } = await import("../src/scene/common/dispose.js");

const baseMap = new THREE.Texture();
const normalMap = new THREE.Texture();
let detailMapCreations = 0;
const createLazyMaterial = () => createGameMaterial(({ lowQuality }) => {
  const props = { color: 0xffffff, map: baseMap };
  if (!lowQuality) {
    detailMapCreations += 1;
    props.normalMap = normalMap;
  }
  return props;
});

setMaterialQuality(MATERIAL_QUALITY.LOW);
const lowMaterial = createLazyMaterial();
assert.equal(lowMaterial.isMeshLambertMaterial, true);
assert.equal(lowMaterial.map, baseMap);
assert.equal(detailMapCreations, 0);

setMaterialQuality(MATERIAL_QUALITY.HIGH);
const highMaterial = createLazyMaterial();
assert.equal(highMaterial.isMeshStandardMaterial, true);
assert.equal(highMaterial.normalMap, normalMap);
assert.equal(detailMapCreations, 1);

const sharedGeometry = new THREE.BoxGeometry(1, 1, 1);
const sharedTexture = new THREE.Texture();
const nestedTexture = new THREE.Texture();
const uniformTexture = new THREE.Texture();
const explicitTexture = new THREE.Texture();
const sharedMaterial = new THREE.MeshStandardMaterial({ map: sharedTexture });
const shaderMaterial = new THREE.ShaderMaterial({
  uniforms: { nested: { value: { texture: uniformTexture } } },
});
const scene = new THREE.Scene();
scene.add(
  new THREE.Mesh(sharedGeometry, sharedMaterial),
  new THREE.Mesh(sharedGeometry, sharedMaterial),
  new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shaderMaterial),
);
scene.userData.resources = { nested: [nestedTexture] };
const camera = new THREE.PerspectiveCamera();
camera.add(new THREE.Object3D());
scene.add(camera);

const disposeCounts = new Map();
for (const resource of [sharedGeometry, sharedMaterial, shaderMaterial, sharedTexture, nestedTexture, uniformTexture, explicitTexture]) {
  resource.addEventListener("dispose", () => disposeCounts.set(resource, (disposeCounts.get(resource) ?? 0) + 1));
}
let renderListDisposals = 0;
disposeWorldResources(
  { scene, camera, disposableTextures: [sharedTexture, explicitTexture] },
  { renderLists: { dispose: () => { renderListDisposals += 1; } } },
);

assert.equal(disposeCounts.get(sharedGeometry), 1);
assert.equal(disposeCounts.get(sharedMaterial), 1);
assert.equal(disposeCounts.get(shaderMaterial), 1);
assert.equal(disposeCounts.get(sharedTexture), 1);
assert.equal(disposeCounts.get(nestedTexture), 1);
assert.equal(disposeCounts.get(uniformTexture), 1);
assert.equal(disposeCounts.get(explicitTexture), 1);
assert.equal(renderListDisposals, 1);
assert.equal(camera.children.length, 0);

const sourcePaths = [
  "level-one",
  "level-five",
  "level-eight",
  "level-thirty-seven",
];
for (const level of sourcePaths) {
  const indexSource = await readFile(new URL(`../src/scene/${level}/index.js`, import.meta.url), "utf8");
  const textureSource = await readFile(new URL(`../src/scene/${level}/textures.js`, import.meta.url), "utf8");
  assert.match(indexSource, /includeDetailMaps:\s*!\w*[Ll]owQuality/);
  assert.match(textureSource, /includeDetailMaps\s*=\s*true/);
  assert.match(textureSource, /if \(!includeDetailMaps\) return maps;/);
}

const levelZeroSource = await readFile(new URL("../src/scene/level-zero/index.js", import.meta.url), "utf8");
const levelOneSource = await readFile(new URL("../src/scene/level-one/index.js", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
assert.match(levelZeroSource, /isLowQuality\(\) \? null : createFixtureLightField/);
assert.match(levelOneSource, /includeTexture:\s*!lowQuality/);
assert.match(levelOneSource, /disposableTextures:\s*lightField\.texture/);
assert.match(mainSource, /disposeWorldResources\(previousWorld, renderer\)/);

console.log("material quality and disposal checks passed");
