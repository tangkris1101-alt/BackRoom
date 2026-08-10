function disposeTextureResources(value, disposedTextures, visitedResources) {
  if (!value || typeof value !== "object") return;
  if (value.isTexture) {
    if (disposedTextures.has(value)) return;
    disposedTextures.add(value);
    value.dispose();
    return;
  }
  if (visitedResources.has(value)) return;
  visitedResources.add(value);
  if (Array.isArray(value) || value instanceof Set) {
    value.forEach((entry) => disposeTextureResources(entry, disposedTextures, visitedResources));
    return;
  }
  if (value instanceof Map) {
    value.forEach((entry, key) => {
      disposeTextureResources(key, disposedTextures, visitedResources);
      disposeTextureResources(entry, disposedTextures, visitedResources);
    });
    return;
  }
  if (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null) {
    Object.values(value).forEach((entry) => disposeTextureResources(entry, disposedTextures, visitedResources));
  }
}

function disposeMaterial(material, state) {
  if (Array.isArray(material)) {
    material.forEach((entry) => disposeMaterial(entry, state));
    return;
  }
  if (!material || state.disposedMaterials.has(material)) return;
  state.disposedMaterials.add(material);
  Object.values(material).forEach((value) => {
    if (value?.isTexture) {
      disposeTextureResources(value, state.disposedTextures, state.visitedResources);
    }
  });
  disposeTextureResources(material.userData, state.disposedTextures, state.visitedResources);
  disposeTextureResources(material.uniforms, state.disposedTextures, state.visitedResources);
  material.dispose();
}

export function disposeWorldResources(previousWorld, renderer = null) {
  if (!previousWorld?.scene) return;
  const state = {
    disposedGeometries: new Set(),
    disposedMaterials: new Set(),
    disposedTextures: new Set(),
    visitedResources: new Set(),
  };
  previousWorld.scene.traverse((object) => {
    if (object.geometry && !state.disposedGeometries.has(object.geometry)) {
      state.disposedGeometries.add(object.geometry);
      object.geometry.dispose();
    }
    if (object.material) disposeMaterial(object.material, state);
    disposeTextureResources(object.userData, state.disposedTextures, state.visitedResources);
  });
  disposeTextureResources(previousWorld.disposableTextures, state.disposedTextures, state.visitedResources);
  renderer?.renderLists?.dispose?.();
  previousWorld.camera?.clear();
}
