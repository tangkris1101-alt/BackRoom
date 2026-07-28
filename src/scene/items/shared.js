import * as THREE from "three";

export const inspectForward = new THREE.Vector3();
export const inspectToItem = new THREE.Vector3();

export function markItemMeshes(root, itemId) {
  root.traverse((child) => {
    if (child.isMesh) child.userData.itemId = itemId;
  });
}

export function createItemHighlight({
  color = 0xf3f5bd,
  width = 0.8,
  height = 0.8,
  depth = 0.8,
  y = 0.42,
} = {}) {
  const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth));
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  });
  const highlight = new THREE.LineSegments(geometry, material);
  highlight.name = "item-aim-highlight";
  highlight.position.y = y;
  highlight.visible = false;
  highlight.renderOrder = 6;
  return highlight;
}

// This is a low-cost contact-shadow cue, not a renderer shadow. Keep it on
// the pickup root rather than the tilted item model so it always remains flat
// against the world floor.
export function createItemGroundShadow({
  radius,
  color,
  opacity,
  scaleZ = 1,
  y = 0.011,
} = {}) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), material);
  shadow.name = "item-ground-shadow";
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.z = scaleZ;
  shadow.position.y = y;
  return shadow;
}

export function setItemHighlight(highlight, visible) {
  if (highlight) highlight.visible = Boolean(visible);
}

export function getPickupDistance(playerPosition, group) {
  if (!playerPosition || !group) return Infinity;
  return Math.hypot(playerPosition.x - group.position.x, playerPosition.z - group.position.z);
}

export function createPickupState({
  id,
  active,
  group,
  playerPosition,
  pickupRadius,
  respawnTimer = 0,
}) {
  if (!active) {
    return {
      id,
      visible: false,
      available: false,
      distance: Infinity,
      respawn: Math.max(0, respawnTimer),
    };
  }
  const distance = getPickupDistance(playerPosition, group);
  return {
    id,
    visible: true,
    available: distance <= pickupRadius,
    distance,
    position: { x: group.position.x, y: group.position.y, z: group.position.z },
    respawn: 0,
  };
}
