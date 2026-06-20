(function (Scratch) {
  'use strict';

  if (!Scratch) return;

  const MAP = [
    '#####################',
    '#.........#.........#',
    '#.#####.#.#.#####.#.#',
    '#.#...#.#.#.#...#.#.#',
    '#.#.#.#.#...#.#.#.#.#',
    '#...#...#####.#...#.#',
    '###.#####.....#####.#',
    '#...#...#.###.#.....#',
    '#.###.#.#.#.#.#.#####',
    '#.....#...#...#.....#',
    '#####.#########.###.#',
    '#...#.......#...#...#',
    '#.#.#######.#.###.#.#',
    '#.#.......#.#.....#.#',
    '#.#######.#.#####.#.#',
    '#.....#...#.....#.#.#',
    '#.###.#.#######.#.#.#',
    '#...#...........#...#',
    '#####################',
  ];

  const ROWS = MAP.length;
  const COLS = MAP[0].length;
  const START = { x: 1.5, y: 17.5, yaw: -Math.PI * 0.42 };
  const EXIT = { x: 19.5, y: 1.5 };
  const FOV = Math.PI / 3;
  const TAN_HALF_FOV = Math.tan(FOV / 2);
  // Shared "haze" colour (#c0b05a). Distant walls, the floor and the ceiling all
  // blend toward this instead of toward black — that black-fade was why far areas
  // rendered as voids. It matches the foggy mono-yellow Backrooms look.
  const FOG_RGB = { r: 194, g: 178, b: 102 };
  const MOVE_SPEED = 2.2;
  const SPRINT_MULT = 1.55;
  const ROTATE_SPEED = 0.0022;
  const TOUCH_ROTATE_SPEED = 0.004;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function isWall(cx, cy) {
    if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) return true;
    return MAP[cy][cx] === '#';
  }

  class Backrooms3D {
    constructor(runtime) {
      this.runtime = runtime;
      this.initialized = false;
      this.active = false;
      this.keys = {};
      this.mouse = {
        x: 0,
        y: 0,
        lastX: 0,
        lastY: 0,
        locked: false,
        movementX: 0,
        movementY: 0,
        dragging: false,
      };
      this.player = {
        x: START.x,
        y: START.y,
        yaw: START.yaw,
        pitch: 0,
      };
      this.metrics = {
        exitDistance: 0,
        flicker: 0.78,
        signalFound: false,
      };
      this.elapsed = 0;
      this.lastTime = performance.now();
      this.fixtures = [];
      this.overlay = null;
      this.canvas = null;
      this.ctx = null;
      this.audioCtx = null;
      this.osc = null;
      this.gain = null;

      this.generateFixtures();
      this.bindEvents();
    }

    getInfo() {
      return {
        id: 'backrooms3d',
        name: 'Backrooms 3D',
        color1: '#c5b756',
        color2: '#a99943',
        blocks: [
          {
            opcode: 'init',
            blockType: Scratch.BlockType.COMMAND,
            text: 'initialize Backrooms 3D',
          },
          {
            opcode: 'update',
            blockType: Scratch.BlockType.COMMAND,
            text: 'update frame',
          },
          {
            opcode: 'requestPointerLock',
            blockType: Scratch.BlockType.COMMAND,
            text: 'request pointer lock',
          },
          {
            opcode: 'exitPointerLock',
            blockType: Scratch.BlockType.COMMAND,
            text: 'exit pointer lock',
          },
          {
            opcode: 'isPointerLocked',
            blockType: Scratch.BlockType.BOOLEAN,
            text: 'pointer locked?',
          },
          {
            opcode: 'distanceToExit',
            blockType: Scratch.BlockType.REPORTER,
            text: 'distance to exit',
          },
          {
            opcode: 'signalFound',
            blockType: Scratch.BlockType.BOOLEAN,
            text: 'signal found?',
          },
          {
            opcode: 'flickerValue',
            blockType: Scratch.BlockType.REPORTER,
            text: 'flicker',
          },
        ],
      };
    }

    generateFixtures() {
      this.fixtures = [];
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          if (MAP[row][col] !== '.') continue;
          const lightSeed = (col * 37 + row * 19) % 11;
          if (lightSeed === 0 || (row + col) % 13 === 0) {
            this.fixtures.push({
              x: col + 0.5,
              y: row + 0.5,
              phase: col * 0.83 + row * 1.17,
              speed: 6 + ((col * row) % 5),
              weak: lightSeed === 0 ? 0 : 0.22,
            });
          }
        }
      }
    }

    bindEvents() {
      const keyHandler = (e) => {
        const down = e.type === 'keydown';
        this.keys[e.code] = down;
        if (down && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
          e.preventDefault();
        }
        if (down && e.code === 'KeyL') {
          if (this.mouse.locked) {
            document.exitPointerLock && document.exitPointerLock();
          } else {
            this.canvas && this.canvas.requestPointerLock && this.canvas.requestPointerLock();
          }
        }
      };
      window.addEventListener('keydown', keyHandler);
      window.addEventListener('keyup', keyHandler);

      window.addEventListener('mousemove', (e) => {
        if (this.mouse.locked) {
          this.player.yaw -= e.movementX * ROTATE_SPEED;
          this.player.pitch = clamp(this.player.pitch - e.movementY * ROTATE_SPEED, -Math.PI * 0.45, Math.PI * 0.45);
        }
      });

      document.addEventListener('pointerlockchange', () => {
        this.mouse.locked = document.pointerLockElement === this.canvas;
      });

      window.addEventListener('blur', () => {
        this.keys = {};
      });

      this.runtime.on('PROJECT_STOP_ALL', () => {
        this.active = false;
        if (this.audioCtx) {
          try { this.audioCtx.close(); } catch (_) {}
          this.audioCtx = null;
          this.osc = null;
          this.gain = null;
        }
        if (this.overlay) {
          this.overlay.style.display = 'none';
        }
      });
    }

    init() {
      if (this.initialized) {
        this.active = true;
        this.lastTime = performance.now();
        if (this.overlay) this.overlay.style.display = 'block';
        this.startAudio();
        return;
      }

      const stageCanvas = this.runtime.renderer && this.runtime.renderer.canvas;
      const wrapper = stageCanvas ? stageCanvas.parentElement : document.body;
      if (!wrapper) return;

      this.overlay = document.createElement('div');
      this.overlay.style.position = 'absolute';
      this.overlay.style.top = '0';
      this.overlay.style.left = '0';
      this.overlay.style.width = '100%';
      this.overlay.style.height = '100%';
      this.overlay.style.pointerEvents = 'auto';
      this.overlay.style.zIndex = '100';
      this.overlay.style.overflow = 'hidden';

      this.canvas = document.createElement('canvas');
      this.canvas.width = 480;
      this.canvas.height = 360;
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.display = 'block';
      this.canvas.style.cursor = 'crosshair';

      this.ctx = this.canvas.getContext('2d', { alpha: false });

      this.overlay.appendChild(this.canvas);
      wrapper.appendChild(this.overlay);

      this.bindPointerEvents();

      this.initialized = true;
      this.active = true;
      this.lastTime = performance.now();
      this.startAudio();
    }

    bindPointerEvents() {
      let lastX = 0;
      let lastY = 0;

      this.overlay.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch' || e.pointerType === 'pen' || !this.mouse.locked) {
          this.mouse.dragging = true;
          lastX = e.clientX;
          lastY = e.clientY;
          this.canvas.setPointerCapture && this.canvas.setPointerCapture(e.pointerId);
        }
      });

      this.overlay.addEventListener('pointermove', (e) => {
        if (!this.mouse.dragging || this.mouse.locked) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        const sensitivity = e.pointerType === 'touch' ? TOUCH_ROTATE_SPEED : ROTATE_SPEED * 1.5;
        this.player.yaw -= dx * sensitivity;
        this.player.pitch = clamp(this.player.pitch - dy * sensitivity, -Math.PI * 0.45, Math.PI * 0.45);
      });

      const endDrag = (e) => {
        if (!this.mouse.dragging) return;
        this.mouse.dragging = false;
        try { this.canvas.releasePointerCapture && this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      };
      this.overlay.addEventListener('pointerup', endDrag);
      this.overlay.addEventListener('pointercancel', endDrag);
    }

    requestPointerLock() {
      if (!this.canvas) return;
      this.canvas.requestPointerLock && this.canvas.requestPointerLock();
    }

    exitPointerLock() {
      document.exitPointerLock && document.exitPointerLock();
    }

    isPointerLocked() {
      return this.mouse.locked;
    }

    startAudio() {
      try {
        if (!this.audioCtx) {
          this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }
        if (!this.osc) {
          this.osc = this.audioCtx.createOscillator();
          this.gain = this.audioCtx.createGain();
          this.osc.type = 'sawtooth';
          this.osc.frequency.value = 48;
          this.gain.gain.value = 0.0;
          this.osc.connect(this.gain);
          this.gain.connect(this.audioCtx.destination);
          this.osc.start();
        }
      } catch (_) {}
    }

    update() {
      if (!this.active || !this.ctx) return;

      const now = performance.now();
      const delta = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;
      this.elapsed += delta;

      this.updatePlayer(delta);
      this.updateMetrics(delta);
      this.render();
    }

    updatePlayer(delta) {
      const yaw = this.player.yaw;
      const forwardX = -Math.sin(yaw);
      const forwardY = -Math.cos(yaw);
      const rightX = Math.cos(yaw);
      const rightY = -Math.sin(yaw);

      let inputX = 0;
      let inputY = 0;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) inputX -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) inputX += 1;
      if (this.keys['KeyW'] || this.keys['ArrowUp']) inputY += 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) inputY -= 1;

      const len = Math.hypot(inputX, inputY);
      if (len > 0) {
        inputX /= len;
        inputY /= len;
      }

      const sprint = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
      const speed = MOVE_SPEED * (sprint ? SPRINT_MULT : 1) * delta;
      const moveX = (forwardX * inputY + rightX * inputX) * speed;
      const moveY = (forwardY * inputY + rightY * inputX) * speed;

      const resolved = this.resolveMove(this.player.x + moveX, this.player.y + moveY);
      this.player.x = resolved.x;
      this.player.y = resolved.y;
    }

    resolveMove(nextX, nextY) {
      const radius = 0.22;
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

      const canStand = (px, py) => samples.every(([ox, oy]) => !isWall(Math.floor(px + ox), Math.floor(py + oy)));

      if (canStand(nextX, nextY)) return { x: nextX, y: nextY };
      if (canStand(nextX, this.player.y)) return { x: nextX, y: this.player.y };
      if (canStand(this.player.x, nextY)) return { x: this.player.x, y: nextY };
      return { x: this.player.x, y: this.player.y };
    }

    updateMetrics(delta) {
      let flicker = 0.78;
      const elapsed = this.elapsed;
      for (const fixture of this.fixtures) {
        const soft = 0.72 + Math.sin(elapsed * 1.7 + fixture.phase) * 0.1;
        const sharp = Math.sin(elapsed * fixture.speed + fixture.phase * 2.4) > 0.89 ? 0.18 : 1;
        const pulse = Math.max(0.18, soft * sharp - fixture.weak);
        flicker = Math.min(flicker, pulse);
      }
      this.metrics.flicker = flicker;
      this.metrics.exitDistance = Math.round(Math.hypot(this.player.x - EXIT.x, this.player.y - EXIT.y));
      this.metrics.signalFound = this.metrics.exitDistance < 7;

      if (this.gain) {
        const hum = 0.04 + (1 - flicker) * 0.035;
        this.gain.gain.setTargetAtTime(hum, this.audioCtx.currentTime, 0.1);
      }
    }

    render() {
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;
      const flicker = this.metrics.flicker;
      const fogDensity = 0.025 + (1 - flicker) * 0.018;
      const brightness = 0.55 + flicker * 0.45;

      const pitchOffset = Math.round(this.player.pitch * 80);
      const horizon = clamp(Math.floor(h / 2 + pitchOffset), 1, h - 1);

      // ceiling — off-white acoustic drop-tiles fading into haze at the horizon
      const ceilGrad = ctx.createLinearGradient(0, 0, 0, horizon);
      ceilGrad.addColorStop(0, this.shadeToFog('#d4cfa5', brightness * 0.95, 0.06));
      ceilGrad.addColorStop(1, this.shadeToFog('#d4cfa5', brightness * 0.9, 0.88));
      ctx.fillStyle = ceilGrad;
      ctx.fillRect(0, 0, w, horizon);

      // floor — moist mono-yellow carpet fading into haze at the horizon
      const floorGrad = ctx.createLinearGradient(0, horizon, 0, h);
      floorGrad.addColorStop(0, this.shadeToFog('#9f9048', brightness * 0.85, 0.88));
      floorGrad.addColorStop(1, this.shadeToFog('#9f9048', brightness * 0.82, 0.04));
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, horizon, w, h - horizon);

      const dirX = -Math.sin(this.player.yaw);
      const dirY = -Math.cos(this.player.yaw);
      const planeX = Math.cos(this.player.yaw) * TAN_HALF_FOV;
      const planeY = -Math.sin(this.player.yaw) * TAN_HALF_FOV;

      const numRays = 120;
      const stripWidth = w / numRays;

      for (let i = 0; i < numRays; i++) {
        const cameraX = 2 * i / numRays - 1;
        const rayDirX = dirX + planeX * cameraX;
        const rayDirY = dirY + planeY * cameraX;

        let mapX = Math.floor(this.player.x);
        let mapY = Math.floor(this.player.y);

        let sideDistX, sideDistY;
        const deltaDistX = Math.abs(1 / rayDirX);
        const deltaDistY = Math.abs(1 / rayDirY);
        let stepX, stepY;
        let side = 0;

        if (rayDirX < 0) {
          stepX = -1;
          sideDistX = (this.player.x - mapX) * deltaDistX;
        } else {
          stepX = 1;
          sideDistX = (mapX + 1 - this.player.x) * deltaDistX;
        }
        if (rayDirY < 0) {
          stepY = -1;
          sideDistY = (this.player.y - mapY) * deltaDistY;
        } else {
          stepY = 1;
          sideDistY = (mapY + 1 - this.player.y) * deltaDistY;
        }

        let hit = false;
        while (!hit) {
          if (sideDistX < sideDistY) {
            sideDistX += deltaDistX;
            mapX += stepX;
            side = 0;
          } else {
            sideDistY += deltaDistY;
            mapY += stepY;
            side = 1;
          }
          if (isWall(mapX, mapY)) hit = true;
        }

        const perpWallDist = side === 0
          ? (mapX - this.player.x + (1 - stepX) / 2) / rayDirX
          : (mapY - this.player.y + (1 - stepY) / 2) / rayDirY;

        const lineHeight = Math.min(h * 1.5, h / perpWallDist);
        const drawStart = Math.max(0, Math.floor(-lineHeight / 2 + h / 2 + pitchOffset));
        const drawEnd = Math.min(h - 1, Math.floor(lineHeight / 2 + h / 2 + pitchOffset));

        // How far along the wall cell the ray hit (0..1), used for wallpaper seams.
        let wallX = side === 0
          ? this.player.y + perpWallDist * rayDirY
          : this.player.x + perpWallDist * rayDirX;
        wallX -= Math.floor(wallX);

        // Distance haze: 0 up close, 1 far away. Far walls dissolve into the fog
        // colour instead of fading to black.
        const fogAmount = 1 - Math.min(1, Math.exp(-perpWallDist * fogDensity));

        // Mono-yellow wallpaper with a faint per-cell tonal shift.
        let wallColor = (mapX + mapY) % 2 === 0 ? '#c0b160' : '#c8b46b';
        // Fake directional shading: walls facing N/S read slightly darker.
        let light = brightness * (side === 1 ? 0.82 : 1);
        // Subtle darker seam where wallpaper strips meet at the cell edges.
        if (wallX < 0.045 || wallX > 0.955) light *= 0.8;

        ctx.fillStyle = this.shadeToFog(wallColor, light, fogAmount);
        ctx.fillRect(Math.floor(i * stripWidth), drawStart, Math.ceil(stripWidth), drawEnd - drawStart + 1);
      }

      // exit sign overlay
      this.drawExitSign(ctx, w, h);

      // vignette
      const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.85);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(54,47,18,${0.28 + (1 - flicker) * 0.28})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // HUD hint
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(this.mouse.locked ? 'LOCKED (L to exit, drag does nothing)' : 'WASD/Arrows move | Drag to look | L to lock cursor', 6, h - 6);
    }

    drawExitSign(ctx, w, h) {
      const dx = EXIT.x - this.player.x;
      const dy = EXIT.y - this.player.y;
      const invDet = 1.0 / (Math.cos(this.player.yaw) * -Math.cos(this.player.yaw) - Math.sin(this.player.yaw) * Math.sin(this.player.yaw));
      // skip if behind
      const forwardX = -Math.sin(this.player.yaw);
      const forwardY = -Math.cos(this.player.yaw);
      const dot = dx * forwardX + dy * forwardY;
      if (dot <= 0) return;

      const rightX = Math.cos(this.player.yaw);
      const rightY = -Math.sin(this.player.yaw);
      const screenX = (dx * rightX + dy * rightY) / dot;
      const x = w / 2 * (1 + screenX / TAN_HALF_FOV);
      const y = h / 2 + this.player.pitch * 80;
      const size = Math.min(120, h * 4 / dot);

      if (x > -size && x < w + size) {
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = '#172d1d';
        ctx.fillRect(-size / 2, -size / 6, size, size / 3);
        ctx.strokeStyle = '#a5ffba';
        ctx.lineWidth = Math.max(2, size / 20);
        ctx.strokeRect(-size / 2 + 2, -size / 6 + 2, size - 4, size / 3 - 4);
        ctx.fillStyle = '#a5ffba';
        ctx.font = `bold ${Math.max(12, size / 4)}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('EXIT', 0, 0);
        ctx.restore();
      }
    }

    shadeColor(color, factor) {
      const hex = color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`;
    }

    // Shade a base hex colour by `light` (0..1), then blend the result toward the
    // shared fog colour by `fog` (0..1). At distance fog -> 1 so the surface melts
    // into yellow haze rather than going black.
    shadeToFog(color, light, fog) {
      const hex = color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) * light;
      const g = parseInt(hex.substring(2, 4), 16) * light;
      const b = parseInt(hex.substring(4, 6), 16) * light;
      const rr = Math.floor(r + (FOG_RGB.r - r) * fog);
      const gg = Math.floor(g + (FOG_RGB.g - g) * fog);
      const bb = Math.floor(b + (FOG_RGB.b - b) * fog);
      return `rgb(${rr}, ${gg}, ${bb})`;
    }

    distanceToExit() {
      return this.metrics.exitDistance;
    }

    signalFound() {
      return this.metrics.signalFound;
    }

    flickerValue() {
      return Math.round(this.metrics.flicker * 100) / 100;
    }
  }

  Scratch.extensions.register(new Backrooms3D());
})(Scratch);
