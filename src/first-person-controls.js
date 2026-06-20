import * as THREE from "three";

const PLAYER_RADIUS = 0.36;
const GRAVITY = 11.5;
const JUMP_VELOCITY = 4.4;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampPitch(pitch) {
  return clamp(pitch, -Math.PI * 0.47, Math.PI * 0.47);
}

export class FirstPersonControls {
  constructor({ camera, canvas, joystick, jumpButton, isWalkable, spawn }) {
    this.camera = camera;
    this.canvas = canvas;
    this.joystick = joystick;
    this.joystickKnob = joystick?.querySelector(".joystick__knob");
    this.jumpButton = jumpButton;
    this.isWalkable = isWalkable;
    this.spawn = spawn;
    this.eyeHeight = 1.62;
    this.moveSpeed = 3.05;
    this.sprintMultiplier = 1.55;
    this.lookSensitivity = 0.0028;
    this.touchSensitivity = 0.004;
    this.yaw = spawn.yaw;
    this.pitch = -0.02;
    this.lookPointerId = null;
    this.lookLast = new THREE.Vector2();
    this.joystickPointerId = null;
    this.joystickInput = new THREE.Vector2();
    this.keys = new Set();
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.move = new THREE.Vector3();
    this.isLocked = false;
    this.verticalVelocity = 0;
    this.groundY = this.eyeHeight;
    this.isGrounded = true;
    this.jumpQueued = false;

    this.onCanvasPointerDown = this.onCanvasPointerDown.bind(this);
    this.onCanvasPointerMove = this.onCanvasPointerMove.bind(this);
    this.onCanvasPointerUp = this.onCanvasPointerUp.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onBlur = this.onBlur.bind(this);
    this.onPointerLockChange = this.onPointerLockChange.bind(this);
    this.onPointerLockError = this.onPointerLockError.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onJoystickDown = this.onJoystickDown.bind(this);
    this.onJoystickMove = this.onJoystickMove.bind(this);
    this.onJoystickUp = this.onJoystickUp.bind(this);
    this.onJumpButtonDown = this.onJumpButtonDown.bind(this);
    this.onJumpButtonUp = this.onJumpButtonUp.bind(this);

    canvas.addEventListener("pointerdown", this.onCanvasPointerDown);
    canvas.addEventListener("pointermove", this.onCanvasPointerMove);
    canvas.addEventListener("pointerup", this.onCanvasPointerUp);
    canvas.addEventListener("pointercancel", this.onCanvasPointerUp);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("pointerlockerror", this.onPointerLockError);
    window.addEventListener("mousemove", this.onMouseMove);

    if (joystick) {
      joystick.addEventListener("pointerdown", this.onJoystickDown);
      joystick.addEventListener("pointermove", this.onJoystickMove);
      joystick.addEventListener("pointerup", this.onJoystickUp);
      joystick.addEventListener("pointercancel", this.onJoystickUp);
    }

    if (jumpButton) {
      jumpButton.addEventListener("pointerdown", this.onJumpButtonDown);
      jumpButton.addEventListener("pointerup", this.onJumpButtonUp);
      jumpButton.addEventListener("pointercancel", this.onJumpButtonUp);
      jumpButton.addEventListener("pointerleave", this.onJumpButtonUp);
    }

    this.reset();
  }

  reset() {
    this.camera.position.set(this.spawn.x, this.eyeHeight, this.spawn.z);
    this.verticalVelocity = 0;
    this.isGrounded = true;
    this.jumpQueued = false;
    this.yaw = this.spawn.yaw;
    this.pitch = -0.025;
    this.applyRotation();
    this.syncCameraState();
  }

  canRequestPointerLock() {
    if (typeof this.canvas.requestPointerLock !== "function") return false;
    if (!document.hasFocus()) return false;

    try {
      return window.self === window.top;
    } catch {
      return false;
    }
  }

  startDragLook(event) {
    this.lookPointerId = event.pointerId;
    this.lookLast.set(event.clientX, event.clientY);
    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch {
      this.lookPointerId = null;
      return;
    }
    this.canvas.classList.add("is-dragging");
  }

  applyRotation() {
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = 0;
    this.syncCameraState();
  }

  syncCameraState() {
    this.canvas.dataset.cameraX = this.camera.position.x.toFixed(3);
    this.canvas.dataset.cameraY = this.camera.position.y.toFixed(3);
    this.canvas.dataset.cameraZ = this.camera.position.z.toFixed(3);
    this.canvas.dataset.cameraYaw = this.yaw.toFixed(3);
    this.canvas.dataset.cameraPitch = this.pitch.toFixed(3);
    this.canvas.dataset.grounded = String(this.isGrounded);
  }

  queueJump() {
    this.jumpQueued = true;
  }

  canStandAt(x, z) {
    return this.isWalkable(x, z, PLAYER_RADIUS);
  }

  resolveMove(nextX, nextZ) {
    const currentX = this.camera.position.x;
    const currentZ = this.camera.position.z;

    if (this.canStandAt(nextX, nextZ)) {
      return { x: nextX, z: nextZ };
    }
    if (this.canStandAt(nextX, currentZ)) {
      return { x: nextX, z: currentZ };
    }
    if (this.canStandAt(currentX, nextZ)) {
      return { x: currentX, z: nextZ };
    }
    return { x: currentX, z: currentZ };
  }

  onCanvasPointerDown(event) {
    if (event.pointerType === "touch") {
      if (this.lookPointerId !== null) return;
      this.startDragLook(event);
      return;
    }

    if (document.pointerLockElement === this.canvas) return;
    if (this.lookPointerId !== null) return;

    if (this.canRequestPointerLock()) {
      try {
        const request = this.canvas.requestPointerLock({
          unadjustedMovement: true,
        });
        if (request && typeof request.catch === "function") {
          request.catch(() => {
            this.startDragLook(event);
          });
        }
      } catch {
        this.startDragLook(event);
      }
      return;
    }

    this.startDragLook(event);
  }

  onCanvasPointerMove(event) {
    if (event.pointerId !== this.lookPointerId) return;
    const deltaX = event.clientX - this.lookLast.x;
    const deltaY = event.clientY - this.lookLast.y;
    this.lookLast.set(event.clientX, event.clientY);
    const sensitivity =
      event.pointerType === "touch" ? this.touchSensitivity : this.lookSensitivity;
    this.yaw -= deltaX * sensitivity;
    this.pitch = clampPitch(this.pitch - deltaY * sensitivity);
    this.applyRotation();
  }

  onCanvasPointerUp(event) {
    if (event.pointerId !== this.lookPointerId) return;
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    this.lookPointerId = null;
    this.canvas.classList.remove("is-dragging");
  }

  onPointerLockChange() {
    this.isLocked = document.pointerLockElement === this.canvas;
    this.canvas.classList.toggle("is-locked", this.isLocked);
    this.canvas.dataset.mouseLocked = String(this.isLocked);
    if (!this.isLocked) {
      this.keys.clear();
      this.resetJoystick();
    }
  }

  onPointerLockError() {
    this.isLocked = false;
    this.canvas.classList.remove("is-locked");
    this.canvas.dataset.mouseLocked = "false";
  }

  onMouseMove(event) {
    if (!this.isLocked) return;
    this.yaw -= event.movementX * this.lookSensitivity;
    this.pitch = clampPitch(this.pitch - event.movementY * this.lookSensitivity);
    this.applyRotation();
  }

  onKeyDown(event) {
    if (event.code === "Space") {
      event.preventDefault();
      if (!event.repeat) this.queueJump();
      return;
    }

    if (["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight"].includes(event.code)) {
      event.preventDefault();
      this.keys.add(event.code);
    }
  }

  onKeyUp(event) {
    this.keys.delete(event.code);
  }

  onBlur() {
    this.keys.clear();
    this.resetJoystick();
  }

  onJoystickDown(event) {
    if (this.joystickPointerId !== null) return;
    event.preventDefault();
    event.stopPropagation();
    this.joystickPointerId = event.pointerId;
    this.joystick.setPointerCapture(event.pointerId);
    this.updateJoystick(event);
  }

  onJoystickMove(event) {
    if (event.pointerId !== this.joystickPointerId) return;
    event.preventDefault();
    event.stopPropagation();
    this.updateJoystick(event);
  }

  onJoystickUp(event) {
    if (event.pointerId !== this.joystickPointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (this.joystick.hasPointerCapture(event.pointerId)) {
      this.joystick.releasePointerCapture(event.pointerId);
    }
    this.joystickPointerId = null;
    this.resetJoystick();
  }

  updateJoystick(event) {
    const rect = this.joystick.getBoundingClientRect();
    const radius = rect.width * 0.32;
    const x = event.clientX - (rect.left + rect.width / 2);
    const y = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(x, y);
    const scale = length > radius ? radius / length : 1;
    const offsetX = x * scale;
    const offsetY = y * scale;
    this.joystickInput.set(offsetX / radius, -offsetY / radius);
    this.joystickKnob.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    this.joystick.classList.add("is-active");
  }

  resetJoystick() {
    this.joystickInput.set(0, 0);
    if (this.joystickKnob) {
      this.joystickKnob.style.transform = "translate(0, 0)";
    }
    this.joystick?.classList.remove("is-active");
  }

  onJumpButtonDown(event) {
    event.preventDefault();
    event.stopPropagation();
    this.queueJump();
    this.jumpButton.classList.add("is-active");
    this.jumpButton.setPointerCapture(event.pointerId);
  }

  onJumpButtonUp(event) {
    event.preventDefault();
    event.stopPropagation();
    if (this.jumpButton.hasPointerCapture(event.pointerId)) {
      this.jumpButton.releasePointerCapture(event.pointerId);
    }
    this.jumpButton.classList.remove("is-active");
  }

  updateVerticalMotion(delta) {
    if (this.jumpQueued && this.isGrounded) {
      this.verticalVelocity = JUMP_VELOCITY;
      this.isGrounded = false;
    }
    this.jumpQueued = false;

    this.verticalVelocity -= GRAVITY * delta;
    this.camera.position.y += this.verticalVelocity * delta;

    if (this.camera.position.y <= this.groundY) {
      this.camera.position.y = this.groundY;
      this.verticalVelocity = 0;
      this.isGrounded = true;
    }
  }

  update(delta) {
    let inputX = this.joystickInput.x;
    let inputY = this.joystickInput.y;

    if (this.keys.has("KeyA")) inputX -= 1;
    if (this.keys.has("KeyD")) inputX += 1;
    if (this.keys.has("KeyW")) inputY += 1;
    if (this.keys.has("KeyS")) inputY -= 1;

    const inputLength = Math.hypot(inputX, inputY);
    if (inputLength >= 0.01) {
      if (inputLength > 1) {
        inputX /= inputLength;
        inputY /= inputLength;
      }

      this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
      this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
      this.move.copy(this.forward).multiplyScalar(inputY).addScaledVector(this.right, inputX);

      const sprinting = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
      const distance = this.moveSpeed * (sprinting ? this.sprintMultiplier : 1) * delta;
      this.move.normalize().multiplyScalar(distance);

      const resolved = this.resolveMove(
        this.camera.position.x + this.move.x,
        this.camera.position.z + this.move.z,
      );
      this.camera.position.x = resolved.x;
      this.camera.position.z = resolved.z;
    }

    this.updateVerticalMotion(delta);
    this.syncCameraState();
  }
}
