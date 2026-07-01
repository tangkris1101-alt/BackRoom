import * as THREE from "three";

const PLAYER_RADIUS = 0.36;
const GRAVITY = 11.5;
const JUMP_VELOCITY = 4.4;
const MAX_STAMINA = 150;
const STAMINA_DRAIN_RATE = 30;
const STAMINA_RECOVERY_RATE = 20;
const STAMINA_RECOVERY_DELAY = 0.55;
const MIN_SPRINT_STAMINA = 0;
const ALMOND_WATER_STAMINA_BONUS = 50;
const ALMOND_WATER_EFFECT_DURATION = 45;
const ALMOND_WATER_MAX_STAMINA = MAX_STAMINA + ALMOND_WATER_STAMINA_BONUS;
const SUPER_ALMOND_WATER_MAX_STAMINA = 250;
const SUPER_ALMOND_WATER_EFFECT_DURATION = 25;
const SUPER_ALMOND_WATER_RECOVERY_MULTIPLIER = 2;
const SUPER_ALMOND_WATER_SPEED_MULTIPLIER = 1.5;
const ALMOND_WATER_DRINK_DURATION = 1.0;
const DRINK_MOVE_MULTIPLIER = 0.5;
const DRINK_ON_COMPLETE_EVENT = "backrooms:drink-complete";
const HEALTH_MAX = 100;
const HOUND_SLOW_MOVE_MULTIPLIER = 0.7;

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
    this.sprintMultiplier = 1.65;
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
    this.bodyY = this.eyeHeight;
    this.isGrounded = true;
    this.jumpQueued = false;
    this.staminaMax = MAX_STAMINA;
    this.stamina = MAX_STAMINA;
    this.staminaRecoveryDelay = 0;
    this.almondWaterTimer = 0;
    this.superAlmondWaterTimer = 0;
    this.healthMax = HEALTH_MAX;
    this.health = HEALTH_MAX;
    this.houndSlowTimer = 0;
    this.isSprinting = false;
    this.isDrinking = false;
    this.drinkTimer = 0;
    this.drinkItemId = null;
    this.drinkStaminaBonus = ALMOND_WATER_STAMINA_BONUS;
    this.drinkCancelled = false;
    this.walkCycle = 0;
    this.walkBobStrength = 0;
    this.headBobY = 0;
    this.rollOffset = 0;
    this.isMoving = false;
    this.movementSpeed = 0;

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
    this.bodyY = this.eyeHeight;
    this.headBobY = 0;
    this.rollOffset = 0;
    this.walkCycle = 0;
    this.walkBobStrength = 0;
    this.camera.position.set(this.spawn.x, this.bodyY, this.spawn.z);
    this.verticalVelocity = 0;
    this.isGrounded = true;
    this.jumpQueued = false;
    this.refreshStaminaModifiers({ fill: true });
    this.staminaRecoveryDelay = 0;
    this.health = this.healthMax;
    this.houndSlowTimer = 0;
    this.isSprinting = false;
    this.isDrinking = false;
    this.drinkTimer = 0;
    this.drinkItemId = null;
    this.drinkCancelled = false;
    this.isMoving = false;
    this.movementSpeed = 0;
    this.yaw = this.spawn.yaw;
    this.pitch = -0.025;
    this.applyRotation();
    this.syncCameraState();
  }

  setWorld({ camera, isWalkable, spawn }) {
    this.camera = camera;
    this.isWalkable = isWalkable;
    this.spawn = spawn;
    this.keys.clear();
    this.resetJoystick();
    this.reset();
  }

  applyState(state) {
    if (!state) return;
    this.yaw = Number.isFinite(state.yaw) ? state.yaw : this.yaw;
    this.pitch = Number.isFinite(state.pitch) ? state.pitch : -0.025;
    this.stamina = Number.isFinite(state.stamina) ? Math.max(0, state.stamina) : this.stamina;
    this.staminaMax = Number.isFinite(state.staminaMax) ? Math.max(1, state.staminaMax) : this.staminaMax;
    this.staminaRecoveryDelay = Number.isFinite(state.staminaRecoveryDelay)
      ? Math.max(0, state.staminaRecoveryDelay)
      : 0;
    this.almondWaterTimer = Number.isFinite(state.almondWaterTimer)
      ? Math.max(0, state.almondWaterTimer)
      : 0;
    this.superAlmondWaterTimer = Number.isFinite(state.superAlmondWaterTimer)
      ? Math.max(0, state.superAlmondWaterTimer)
      : 0;
    this.healthMax = Number.isFinite(state.healthMax) && state.healthMax > 0 ? state.healthMax : HEALTH_MAX;
    this.health = Number.isFinite(state.health) ? Math.max(0, Math.min(state.health, this.healthMax)) : this.healthMax;
    this.houndSlowTimer = Number.isFinite(state.houndSlowTimer)
      ? Math.max(0, state.houndSlowTimer)
      : 0;
    this.isSprinting = false;
    this.isDrinking = Boolean(state.isDrinking);
    this.drinkTimer = Number.isFinite(state.drinkTimer) ? Math.max(0, state.drinkTimer) : 0;
    this.drinkItemId =
      typeof state.drinkItemId === "string" && state.drinkItemId ? state.drinkItemId : null;
    this.drinkStaminaBonus = Number.isFinite(state.drinkStaminaBonus)
      ? state.drinkStaminaBonus
      : ALMOND_WATER_STAMINA_BONUS;
    this.drinkCancelled = false;
    this.verticalVelocity = 0;
    this.isGrounded = true;
    this.jumpQueued = false;
    this.refreshStaminaModifiers({ fill: false });
    if (!this.isDrinking) {
      this.stamina = Math.min(this.stamina, this.staminaMax);
    }
    this.applyRotation();
  }

  getPlayerState() {
    return {
      position: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z,
      },
      yaw: this.yaw,
      pitch: this.pitch,
      stamina: this.stamina,
      staminaMax: this.staminaMax,
      staminaBaseMax: MAX_STAMINA,
      staminaRecoveryDelay: this.staminaRecoveryDelay,
      almondWaterTimer: this.almondWaterTimer,
      superAlmondWaterTimer: this.superAlmondWaterTimer,
      health: this.health,
      healthMax: this.healthMax,
      houndSlowTimer: this.houndSlowTimer,
      isSprinting: this.isSprinting,
      isDrinking: this.isDrinking,
      drinkTimer: this.drinkTimer,
      drinkItemId: this.drinkItemId,
      drinkStaminaBonus: this.drinkStaminaBonus,
    };
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
    this.camera.rotation.z = this.rollOffset;
    this.syncCameraState();
  }

  syncCameraState() {
    this.canvas.dataset.cameraX = this.camera.position.x.toFixed(3);
    this.canvas.dataset.cameraY = this.camera.position.y.toFixed(3);
    this.canvas.dataset.cameraZ = this.camera.position.z.toFixed(3);
    this.canvas.dataset.cameraYaw = this.yaw.toFixed(3);
    this.canvas.dataset.cameraPitch = this.pitch.toFixed(3);
    this.canvas.dataset.grounded = String(this.isGrounded);
    this.canvas.dataset.stamina = this.stamina.toFixed(0);
    this.canvas.dataset.staminaMax = this.staminaMax.toFixed(0);
    this.canvas.dataset.staminaBaseMax = MAX_STAMINA.toFixed(0);
    this.canvas.dataset.almondWaterActive = String(this.almondWaterTimer > 0);
    this.canvas.dataset.almondWaterRemaining = this.almondWaterTimer.toFixed(1);
    this.canvas.dataset.superAlmondWaterActive = String(this.superAlmondWaterTimer > 0);
    this.canvas.dataset.superAlmondWaterRemaining = this.superAlmondWaterTimer.toFixed(1);
    this.canvas.dataset.staminaRecoveryMultiplier = this.getStaminaRecoveryMultiplier().toFixed(1);
    this.canvas.dataset.sprinting = String(this.isSprinting);
    this.canvas.dataset.health = this.health.toFixed(0);
    this.canvas.dataset.healthMax = this.healthMax.toFixed(0);
    this.canvas.dataset.houndSlow = this.houndSlowTimer > 0 ? "1" : "0";
    this.canvas.dataset.houndSlowRemaining = this.houndSlowTimer.toFixed(1);
    this.canvas.dataset.moving = String(this.isMoving);
    this.canvas.dataset.movementSpeed = this.movementSpeed.toFixed(3);
    this.canvas.dataset.headBob = this.headBobY.toFixed(3);
    this.canvas.dataset.drinking = String(this.isDrinking);
    this.canvas.dataset.drinkItemId = this.drinkItemId ?? "";
    this.canvas.dataset.drinkProgress = this.isDrinking
      ? (1 - this.drinkTimer / ALMOND_WATER_DRINK_DURATION).toFixed(3)
      : "0";
  }

  clearDrinkCancelled() {
    this.drinkCancelled = false;
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

    if (
      [
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "ShiftLeft",
        "ShiftRight",
      ].includes(event.code)
    ) {
      event.preventDefault();
      this.keys.add(event.code);
    }
  }

  onKeyUp(event) {
    this.keys.delete(event.code);
  }

  onBlur() {
    this.keys.clear();
    this.isSprinting = false;
    this.isMoving = false;
    this.movementSpeed = 0;
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
    this.bodyY += this.verticalVelocity * delta;

    if (this.bodyY <= this.groundY) {
      this.bodyY = this.groundY;
      this.verticalVelocity = 0;
      this.isGrounded = true;
    }
  }

  getStaminaRecoveryMultiplier() {
    return this.superAlmondWaterTimer > 0 ? SUPER_ALMOND_WATER_RECOVERY_MULTIPLIER : 1;
  }

  getMoveSpeedMultiplier() {
    if (this.houndSlowTimer > 0) return HOUND_SLOW_MOVE_MULTIPLIER;
    return this.superAlmondWaterTimer > 0 ? SUPER_ALMOND_WATER_SPEED_MULTIPLIER : 1;
  }

  getCurrentStaminaMax() {
    if (this.superAlmondWaterTimer > 0) return SUPER_ALMOND_WATER_MAX_STAMINA;
    if (this.almondWaterTimer > 0) return ALMOND_WATER_MAX_STAMINA;
    return MAX_STAMINA;
  }

  refreshStaminaModifiers({ fill = false } = {}) {
    this.staminaMax = this.getCurrentStaminaMax();
    this.stamina = fill ? this.staminaMax : Math.min(this.stamina, this.staminaMax);
  }

  updateStaminaEffects(delta) {
    const previousMax = this.staminaMax;
    if (this.almondWaterTimer > 0) {
      this.almondWaterTimer = Math.max(0, this.almondWaterTimer - delta);
    }
    if (this.superAlmondWaterTimer > 0) {
      this.superAlmondWaterTimer = Math.max(0, this.superAlmondWaterTimer - delta);
    }
    this.refreshStaminaModifiers({ fill: false });
    if (this.staminaMax < previousMax) this.stamina = Math.min(this.stamina, this.staminaMax);
  }

  updateHeadBob(delta, horizontalDistance, hasMovementInput) {
    const moving = hasMovementInput && horizontalDistance > 0.0001 && this.isGrounded;
    this.isMoving = moving;
    this.movementSpeed = delta > 0 ? horizontalDistance / delta : 0;
    const targetStrength = moving ? 1 : 0;
    const blend = Math.min(1, delta * (moving ? 10 : 7));
    this.walkBobStrength += (targetStrength - this.walkBobStrength) * blend;

    if (moving) {
      const targetSpeed = this.moveSpeed * (this.isSprinting ? this.sprintMultiplier : 1);
      const speedRatio = horizontalDistance / Math.max(delta * targetSpeed, 0.0001);
      const cadence = (this.isSprinting ? 10.35 : 9.4) * Math.min(1.18, Math.max(0.55, speedRatio));
      this.walkCycle += cadence * delta;
    }

    const verticalAmplitude = this.isSprinting ? 0.038 : 0.032;
    const rollAmplitude = this.isSprinting ? 0.014 : 0.012;
    this.headBobY = Math.sin(this.walkCycle * 2) * verticalAmplitude * this.walkBobStrength;
    this.rollOffset = Math.sin(this.walkCycle) * rollAmplitude * this.walkBobStrength;
    this.camera.position.y = this.bodyY + this.headBobY;
  }

  update(delta) {
    this.updateStaminaEffects(delta);
    if (this.houndSlowTimer > 0) {
      this.houndSlowTimer = Math.max(0, this.houndSlowTimer - delta);
    }
    this.updateDrinking(delta);
    let inputX = this.joystickInput.x;
    let inputY = this.joystickInput.y;
    this.isSprinting = false;
    let horizontalDistance = 0;

    if (this.keys.has("KeyA")) inputX -= 1;
    if (this.keys.has("KeyD")) inputX += 1;
    if (this.keys.has("KeyW")) inputY += 1;
    if (this.keys.has("KeyS")) inputY -= 1;

    const inputLength = Math.hypot(inputX, inputY);
    let hasMovementInput = false;
    if (inputLength >= 0.01) {
      hasMovementInput = true;
      if (inputLength > 1) {
        inputX /= inputLength;
        inputY /= inputLength;
      }

      this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
      this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
      this.move.copy(this.forward).multiplyScalar(inputY).addScaledVector(this.right, inputX);

      const wantsKeyboardSprint =
        inputY > 0.35 &&
        this.keys.has("KeyW") &&
        (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"));
      const wantsJoystickSprint =
        this.joystickPointerId !== null && this.joystickInput.y > 0.88;
      const wantsSprint = wantsKeyboardSprint || wantsJoystickSprint;

      this.isSprinting = wantsSprint && this.stamina > MIN_SPRINT_STAMINA;
      if (this.isSprinting) {
        this.stamina = Math.max(0, this.stamina - STAMINA_DRAIN_RATE * delta);
        this.staminaRecoveryDelay = STAMINA_RECOVERY_DELAY;
      }

      const drinkMultiplier = this.isDrinking ? DRINK_MOVE_MULTIPLIER : 1;
      const superAlmondSpeedMultiplier = this.getMoveSpeedMultiplier();
      const distance =
        this.moveSpeed *
        (this.isSprinting ? this.sprintMultiplier : 1) *
        drinkMultiplier *
        superAlmondSpeedMultiplier *
        delta;
      this.move.normalize().multiplyScalar(distance);

      const currentX = this.camera.position.x;
      const currentZ = this.camera.position.z;
      const resolved = this.resolveMove(
        currentX + this.move.x,
        currentZ + this.move.z,
      );
      horizontalDistance = Math.hypot(resolved.x - currentX, resolved.z - currentZ);
      this.camera.position.x = resolved.x;
      this.camera.position.z = resolved.z;
    }

    if (!this.isSprinting) {
      this.staminaRecoveryDelay = Math.max(0, this.staminaRecoveryDelay - delta);
      if (this.staminaRecoveryDelay === 0) {
        const recoveryRate =
          (hasMovementInput ? STAMINA_RECOVERY_RATE * 0.72 : STAMINA_RECOVERY_RATE) *
          this.getStaminaRecoveryMultiplier();
        this.stamina = Math.min(this.staminaMax, this.stamina + recoveryRate * delta);
      }
    }

    this.updateVerticalMotion(delta);
    this.updateHeadBob(delta, horizontalDistance, hasMovementInput);
    this.applyRotation();
  }

  getState() {
    return {
      stamina: this.stamina,
      staminaMax: this.staminaMax,
      staminaBaseMax: MAX_STAMINA,
      sprinting: this.isSprinting,
      moving: this.isMoving,
      grounded: this.isGrounded,
      movementSpeed: this.movementSpeed,
      almondWaterActive: this.almondWaterTimer > 0,
      almondWaterRemaining: this.almondWaterTimer,
      almondWaterDuration: ALMOND_WATER_EFFECT_DURATION,
      superAlmondWaterActive: this.superAlmondWaterTimer > 0,
      superAlmondWaterRemaining: this.superAlmondWaterTimer,
      superAlmondWaterDuration: SUPER_ALMOND_WATER_EFFECT_DURATION,
      staminaRecoveryMultiplier: this.getStaminaRecoveryMultiplier(),
      activeBuffs: this.getActiveBuffs(),
      health: this.health,
      healthMax: this.healthMax,
      houndSlowRemaining: this.houndSlowTimer,
      isDrinking: this.isDrinking,
      drinkItemId: this.drinkItemId,
      drinkProgress: this.isDrinking
        ? 1 - this.drinkTimer / ALMOND_WATER_DRINK_DURATION
        : 0,
      drinkCancelled: this.drinkCancelled,
    };
  }

  getActiveBuffs() {
    if (this.superAlmondWaterTimer > 0) {
      return [
        {
          id: "super-almond-water",
          remaining: this.superAlmondWaterTimer,
          duration: SUPER_ALMOND_WATER_EFFECT_DURATION,
          staminaMax: SUPER_ALMOND_WATER_MAX_STAMINA,
          recoveryMultiplier: SUPER_ALMOND_WATER_RECOVERY_MULTIPLIER,
          speedMultiplier: SUPER_ALMOND_WATER_SPEED_MULTIPLIER,
        },
      ];
    }

    if (this.almondWaterTimer > 0) {
      return [
        {
          id: "almond-water",
          remaining: this.almondWaterTimer,
          duration: ALMOND_WATER_EFFECT_DURATION,
          staminaMax: ALMOND_WATER_MAX_STAMINA,
          recoveryMultiplier: 1,
        },
      ];
    }

    return [];
  }

  startDrink(itemId, { staminaBonus = ALMOND_WATER_STAMINA_BONUS } = {}) {
    if (this.isDrinking) return false;
    if (itemId !== "almond-water" && itemId !== "super-almond-water") return false;
    this.isDrinking = true;
    this.drinkTimer = ALMOND_WATER_DRINK_DURATION;
    this.drinkItemId = itemId;
    this.drinkStaminaBonus = staminaBonus;
    this.drinkCancelled = false;
    this.isSprinting = false;
    this.staminaRecoveryDelay = 0;
    this.syncCameraState();
    return true;
  }

  cancelDrink(notify = true) {
    if (!this.isDrinking) return false;
    this.isDrinking = false;
    this.drinkTimer = 0;
    if (notify) this.drinkCancelled = true;
    this.syncCameraState();
    return true;
  }

  updateDrinking(delta) {
    if (!this.isDrinking) return;
    this.drinkTimer = Math.max(0, this.drinkTimer - delta);
    if (this.drinkTimer <= 0) {
      const completedItemId = this.drinkItemId;
      const completedBonus = this.drinkStaminaBonus;
      this.isDrinking = false;
      this.drinkTimer = 0;
      if (completedItemId === "super-almond-water") {
        this.drinkSuperAlmondWater();
      } else {
        this.drinkAlmondWater(completedBonus);
      }
      this.notifyDrinkComplete?.(completedItemId);
    }
  }

  drinkAlmondWater(bonus = ALMOND_WATER_STAMINA_BONUS) {
    if (this.superAlmondWaterTimer <= 0) {
      const temporaryBonus = Math.max(0, Math.min(bonus, ALMOND_WATER_MAX_STAMINA - MAX_STAMINA));
      this.almondWaterTimer = ALMOND_WATER_EFFECT_DURATION;
      this.staminaMax = Math.min(ALMOND_WATER_MAX_STAMINA, MAX_STAMINA + temporaryBonus);
    }
    this.stamina = this.staminaMax;
    this.staminaRecoveryDelay = 0;
    this.isSprinting = false;
    this.syncCameraState();
    return this.getState();
  }

  drinkSuperAlmondWater() {
    this.superAlmondWaterTimer = SUPER_ALMOND_WATER_EFFECT_DURATION;
    this.almondWaterTimer = 0;
    this.refreshStaminaModifiers({ fill: true });
    this.staminaRecoveryDelay = 0;
    this.isSprinting = false;
    this.syncCameraState();
    return this.getState();
  }

  applyDamage(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    const previous = this.health;
    this.health = Math.max(0, Math.min(this.healthMax, this.health - amount));
    this.syncCameraState();
    return this.health <= 0 && previous > 0;
  }

  applyHeal(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    if (this.health <= 0) return false;
    if (this.health >= this.healthMax) return false;
    this.health = Math.max(0, Math.min(this.healthMax, this.health + amount));
    this.syncCameraState();
    return true;
  }
}
