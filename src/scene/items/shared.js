import * as THREE from "three";

// 道具和实体共享的可变向量 — 避免在 inspect/aim 调用中频繁分配。

export const inspectForward = new THREE.Vector3();
export const inspectToItem = new THREE.Vector3();