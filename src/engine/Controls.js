import * as THREE from 'three';

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wish = new THREE.Vector3();

export class Player {
  constructor(camera, dom, collision) {
    this.camera = camera;
    this.dom = dom;
    this.col = collision;
    this.pos = new THREE.Vector3(0, 0, 10);
    this.feetY = 0;
    this.vy = 0;
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.eye = 1.66;
    this.radius = 0.32;
    this.fly = false;
    this.enabled = false;
    this.locked = false;
    this.keys = new Set();
    this.walkSpeed = 3.4;
    this.runSpeed = 8.0;
    this.bob = 0;
    this.bobAmt = 0;
    this.fovTarget = 70;
    this.fovBase = 70;
    this.speedNow = 0;
    this.stepDistance = 0;
    this.onStep = null;
    this.touch = { move: new THREE.Vector2(), lookId: null, moveId: null, lx: 0, ly: 0, cx: 0, cy: 0 };
    this._bind();
  }

  _bind() {
    const dom = this.dom;
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code) && this.enabled) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === dom;
      document.body.classList.toggle('locked', this.locked);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      const k = 0.0021 * (this.camera.fov / this.fovBase);
      this.yaw -= e.movementX * k;
      this.pitch -= e.movementY * k;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -1.5, 1.5);
    });
    dom.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      this.fovTarget = THREE.MathUtils.clamp(this.fovTarget + Math.sign(e.deltaY) * 6, 22, 80);
    }, { passive: true });
    // Touch: left half = move stick, right half = look
    const stick = document.getElementById('touch-stick');
    dom.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.4 && this.touch.moveId === null) {
          this.touch.moveId = t.identifier;
          this.touch.cx = t.clientX;
          this.touch.cy = t.clientY;
          if (stick) stick.hidden = false;
        } else if (this.touch.lookId === null) {
          this.touch.lookId = t.identifier;
          this.touch.lx = t.clientX;
          this.touch.ly = t.clientY;
        }
      }
    }, { passive: true });
    dom.addEventListener('touchmove', (e) => {
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.moveId) {
          const dx = (t.clientX - this.touch.cx) / 50, dy = (t.clientY - this.touch.cy) / 50;
          this.touch.move.set(THREE.MathUtils.clamp(dx, -1, 1), THREE.MathUtils.clamp(dy, -1, 1));
          const knob = stick && stick.firstElementChild;
          if (knob) knob.style.transform = `translate(${this.touch.move.x * 36}px, ${this.touch.move.y * 36}px)`;
        } else if (t.identifier === this.touch.lookId) {
          this.yaw -= (t.clientX - this.touch.lx) * 0.005;
          this.pitch -= (t.clientY - this.touch.ly) * 0.005;
          this.pitch = THREE.MathUtils.clamp(this.pitch, -1.5, 1.5);
          this.touch.lx = t.clientX;
          this.touch.ly = t.clientY;
        }
      }
    }, { passive: true });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.moveId) {
          this.touch.moveId = null;
          this.touch.move.set(0, 0);
          const knob = stick && stick.firstElementChild;
          if (knob) knob.style.transform = '';
        }
        if (t.identifier === this.touch.lookId) this.touch.lookId = null;
      }
    };
    dom.addEventListener('touchend', end, { passive: true });
    dom.addEventListener('touchcancel', end, { passive: true });
  }

  lock() {
    if (matchMedia('(pointer: coarse)').matches) return;
    this.dom.requestPointerLock?.();
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  place(x, y, z, yaw = 0, pitch = 0) {
    this.pos.set(x, 0, z);
    const g = this.col.groundAt(x, z, y + 0.5, 1.0);
    this.feetY = Number.isFinite(g) ? g : y;
    this.yaw = yaw;
    this.pitch = pitch;
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.applyCamera(0);
  }

  get eyePosition() {
    return new THREE.Vector3(this.pos.x, this.feetY + this.eye, this.pos.z);
  }

  update(dt) {
    if (!this.enabled) return;
    const k = this.keys;
    let fx = 0, sx = 0, up = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) fx += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) fx -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) sx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) sx += 1;
    if (k.has('Space')) up += 1;
    if (k.has('KeyC') || k.has('ControlLeft')) up -= 1;
    fx -= this.touch.move.y;
    sx += this.touch.move.x;
    const run = k.has('ShiftLeft') || k.has('ShiftRight');

    if (this.fly) {
      const speed = run ? 24 : 9;
      _fwd.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
      _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      _wish.set(0, 0, 0).addScaledVector(_fwd, fx).addScaledVector(_right, sx);
      _wish.y += up;
      if (_wish.lengthSq() > 1) _wish.normalize();
      const target = _wish.multiplyScalar(speed);
      this.vel.lerp(target, 1 - Math.exp(-dt * 5));
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
      this.feetY += this.vel.y * dt;
      this.feetY = THREE.MathUtils.clamp(this.feetY, -60, 140);
      const g = this.col.groundAt(this.pos.x, this.pos.z, this.feetY, 0);
      if (Number.isFinite(g) && this.feetY < g) this.feetY = g;
      this.speedNow = this.vel.length();
    } else {
      const speed = run ? this.runSpeed : this.walkSpeed;
      _fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      _wish.set(0, 0, 0).addScaledVector(_fwd, fx).addScaledVector(_right, sx);
      if (_wish.lengthSq() > 1) _wish.normalize();
      const target = _wish.multiplyScalar(speed);
      const accel = target.lengthSq() > 0.01 ? 9 : 7;
      this.vel.x += (target.x - this.vel.x) * (1 - Math.exp(-dt * accel));
      this.vel.z += (target.z - this.vel.z) * (1 - Math.exp(-dt * accel));
      this.vel.y = 0;
      const steps = Math.max(1, Math.ceil((Math.hypot(this.vel.x, this.vel.z) * dt) / 0.25));
      for (let i = 0; i < steps; i++) this._move((this.vel.x * dt) / steps, (this.vel.z * dt) / steps);
      // gravity / stair smoothing
      const g = this.col.groundAt(this.pos.x, this.pos.z, this.feetY, 0.55);
      if (Number.isFinite(g)) {
        if (g > this.feetY) {
          this.feetY += (g - this.feetY) * (1 - Math.exp(-dt * 18));
          this.vy = 0;
        } else if (this.feetY - g < 0.7 && this.vy === 0) {
          this.feetY += (g - this.feetY) * (1 - Math.exp(-dt * 14));
        } else {
          this.vy -= 22 * dt;
          this.feetY += this.vy * dt;
          if (this.feetY <= g) {
            this.feetY = g;
            this.vy = 0;
          }
        }
      }
      const hs = Math.hypot(this.vel.x, this.vel.z);
      this.speedNow = hs;
      this.bobAmt += ((hs > 0.3 ? Math.min(1, hs / this.walkSpeed) : 0) - this.bobAmt) * (1 - Math.exp(-dt * 6));
      this.bob += hs * dt * 1.9;
      this.stepDistance += hs * dt;
      const stride = run ? 1.25 : 0.85;
      if (this.stepDistance > stride) {
        this.stepDistance -= stride;
        this.onStep?.(hs, this);
      }
    }
    this.applyCamera(dt);
  }

  _move(dx, dz) {
    const px = this.pos.x, pz = this.pos.z;
    this.pos.x += dx;
    this.pos.z += dz;
    this.col.resolve(this.pos, this.feetY, this.feetY + 1.8, this.radius);
    const g = this.col.groundAt(this.pos.x, this.pos.z, this.feetY, 0.55);
    if (!Number.isFinite(g) || g < this.feetY - 3.5) {
      // no walkable ground: slide along the axis that still has ground
      this.pos.x = px + dx;
      this.pos.z = pz;
      const gx = this.col.groundAt(this.pos.x, this.pos.z, this.feetY, 0.55);
      if (!Number.isFinite(gx) || gx < this.feetY - 3.5) {
        this.pos.x = px;
        this.pos.z = pz + dz;
        const gz = this.col.groundAt(this.pos.x, this.pos.z, this.feetY, 0.55);
        if (!Number.isFinite(gz) || gz < this.feetY - 3.5) {
          this.pos.x = px;
          this.pos.z = pz;
        }
      }
      this.col.resolve(this.pos, this.feetY, this.feetY + 1.8, this.radius);
    }
  }

  applyCamera(dt) {
    const cam = this.camera;
    const bobY = this.fly ? 0 : Math.sin(this.bob * 2) * 0.03 * this.bobAmt;
    const bobX = this.fly ? 0 : Math.cos(this.bob) * 0.018 * this.bobAmt;
    cam.position.set(this.pos.x + Math.cos(this.yaw) * bobX, this.feetY + this.eye + bobY, this.pos.z - Math.sin(this.yaw) * bobX);
    cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    if (dt > 0) {
      const f = cam.fov + (this.fovTarget - cam.fov) * (1 - Math.exp(-dt * 8));
      if (Math.abs(f - cam.fov) > 0.01) {
        cam.fov = f;
        cam.updateProjectionMatrix();
      }
    }
  }
}
