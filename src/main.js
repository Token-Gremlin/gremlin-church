import * as THREE from 'three';
import { Pipeline } from './engine/Pipeline.js';
import { Player } from './engine/Controls.js';
import { Tour } from './engine/Tour.js';
import { World } from './world/World.js';
import { insideFactor, darkFactor, surfaceAt } from './world/places.js';
import { Soundscape } from './audio/Soundscape.js';
import { Interface } from './ui/Interface.js';
import { LAYER_FLOOR, LAYER_NO_REFLECT } from './engine/PlanarReflection.js';

const params = new URLSearchParams(location.search);
const SITE_Z = 30;
const SHOT = params.has('shot');
const RECORD = params.has('record');
// for machines without a GPU: no shadow pass, deeper resolution scaling, real-time motion at low frame rates
const LITE = params.has('lite');
const MAX_DT = LITE ? 0.25 : 0.05;

const QUALITY = {
  low: { scale: 0.7, samples: 0, shadow: 1024, reflections: false, bloomLevels: 5, maxPixelRatio: 1 },
  medium: { scale: 0.85, samples: 2, shadow: 2048, reflections: true, reflScale: 0.35, bloomLevels: 6, maxPixelRatio: 1.25 },
  high: { scale: 1.0, samples: 4, shadow: 2048, reflections: true, reflScale: 0.5, bloomLevels: 6, maxPixelRatio: 1.5 },
  ultra: { scale: 1.0, samples: 4, shadow: 4096, reflections: true, reflScale: 0.6, bloomLevels: 7, maxPixelRatio: 2 },
};
const QUALITY_ORDER = ['low', 'medium', 'high', 'ultra'];

const _dir = new THREE.Vector3();
const _to = new THREE.Vector3();

class App {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = !LITE;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    document.getElementById('app').appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 6000);
    this.camera.layers.enable(LAYER_FLOOR);
    this.camera.layers.enable(LAYER_NO_REFLECT);
    this.pipeline = new Pipeline(this.renderer);
    this.pipeline.fadeColor.setRGB(0.03, 0.022, 0.04);
    this.world = new World(this.renderer);
    this.player = new Player(this.camera, this.renderer.domElement, this.world.collision);
    this.tour = new Tour();
    this.audio = new Soundscape();
    this.timer = new THREE.Timer();
    this.time = 0;
    this.frames = 0;
    this.mode = 'loading';
    this.muted = params.has('mute');
    this.nightTarget = params.has('night') ? 1 : 0;
    this.night = this.nightTarget;
    this.dynScale = 1;
    this.dark = 0;
    this.perf = { acc: 0, n: 0, since: 0, slow: 0 };
    // an explicit choice (URL, title screen, Q key) is never overridden by the automatic step-down
    this.qualityLocked = params.has('q');
    this.qualityName = params.get('q') || (matchMedia('(pointer: coarse)').matches ? 'low' : 'high');
    this.applyQuality(this.qualityName, false);
    addEventListener('resize', () => this.resize());
  }

  applyQuality(name, doResize = true) {
    this.qualityName = name;
    const q = QUALITY[name];
    this.quality = q;
    this.dynScale = 1;
    this.pipeline.params.renderScale = q.scale;
    this.pipeline.params.samples = q.samples;
    this.pipeline.params.bloomLevels = q.bloomLevels;
    if (this.world.lighting && this.mode !== 'loading') this.world.lighting.setShadowSize(q.shadow);
    if (doResize) this.resize();
  }

  cycleQuality() {
    this.qualityLocked = true;
    const i = QUALITY_ORDER.indexOf(this.qualityName);
    this.applyQuality(QUALITY_ORDER[(i + 1) % QUALITY_ORDER.length]);
    this.ui?.refresh();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    const pr = Math.min(devicePixelRatio, this.quality.maxPixelRatio);
    this.pipeline.params.renderScale = this.quality.scale * this.dynScale;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.pipeline.setSize(w, h, pr);
    for (const r of Object.values(this.world.reflections)) {
      r.scale = this.quality.reflScale || 0.5;
      r.setSize(this.pipeline.rw, this.pipeline.rh);
    }
  }

  async init() {
    const bar = document.getElementById('progress-bar');
    const status = document.getElementById('progress-status');
    await this.world.build((p, msg) => {
      bar.style.width = `${Math.round(p * 100)}%`;
      if (msg) status.textContent = msg;
    });
    const w = this.world;
    w.lighting.setShadowSize(this.quality.shadow);
    this.resize();
    w.captureInterior(0);
    w.setNight(this.night);
    bar.style.width = '100%';
    this.ui = new Interface(this);
    this.wire();
    if (SHOT) return this.initShot();
    if (RECORD) return this.initRecord();
    this.mode = 'attract';
    this.ui.showEntry();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  wire() {
    const w = this.world;
    this.tour.onChapter = (c, i) => {
      this.ui.setCaption(c.def.title, c.def.text);
      this.ui.setTourProgress(i, this.tour.chapters.length);
      if (!c.joined) this.inside = undefined;
    };
    // chapters that change the hour do so while the screen is dark
    this.tour.onNight = (v) => {
      this.nightTarget = this.night = v;
      w.setNight(v);
      this.ui.refresh();
    };
    this.tour.onEnd = () => this.endTour();
    this.player.onStep = (speed) => this.audio.step(surfaceAt(this.player.pos), speed, this.inside || 0);
    w.onBellStrike = (v) => {
      if (!w.bell) return;
      const d = w.bell.distanceTo(this.camera.position);
      this.camera.getWorldDirection(_dir);
      _to.copy(w.bell).sub(this.camera.position).normalize();
      const pan = _dir.x * _to.z - _dir.z * _to.x;
      this.audio.bell(d / Math.max(0.2, v), -pan * 0.8);
    };
  }

  // ------------------------------------------------------------------ modes
  enter(mode) {
    this.audio.start();
    this.audio.setMuted(this.muted);
    this.ui.hideLoader();
    if (mode === 'tour') this.startTour(0, false);
    else {
      this.startWalk(false);
      this.player.lock();
    }
  }

  startWalk(fromCamera) {
    this.mode = 'walk';
    if (fromCamera) {
      const c = this.camera;
      c.getWorldDirection(_dir);
      const yaw = Math.atan2(-_dir.x, -_dir.z);
      const pitch = THREE.MathUtils.clamp(Math.asin(_dir.y), -1.2, 1.2);
      this.player.place(c.position.x, c.position.y - this.player.eye, c.position.z, yaw, pitch);
    } else {
      this.player.place(0, -3, 62, 0, 0.1);
    }
    this.player.fovTarget = this.player.fovBase;
    this.player.enabled = true;
    this.pipeline.fade = 0;
    this.ui.clearCaption();
    this.ui.refresh();
  }

  startTour(index = 0, fadeOut = true) {
    this.mode = 'tour';
    this.player.enabled = false;
    this.player.unlock();
    this.ui.setHint('');
    this.tour.start(index, fadeOut);
    this.ui.refresh();
  }

  endTour() {
    if (this.mode !== 'tour') return;
    this.tour.stop();
    this.startWalk(true);
    this.ui.announce('Explore freely', 'Click to look around · WASD to walk · E to interact', this.camera.position, this.time, 5);
  }

  toggleTour() {
    if (this.mode === 'tour') this.endTour();
    else if (this.mode === 'walk') this.startTour(0);
  }

  toggleFly() {
    if (this.mode !== 'walk') return;
    this.player.fly = !this.player.fly;
    this.ui.refresh();
  }

  toggleNight() {
    this.nightTarget = this.nightTarget > 0.5 ? 0 : 1;
    this.ui.refresh();
  }

  toggleSound() {
    this.muted = !this.muted;
    if (!this.muted) this.audio.start();
    this.audio.setMuted(this.muted);
    this.ui.refresh();
  }

  onCanvasClick() {
    if (this.mode === 'walk' && !this.player.locked) this.player.lock();
  }

  // ------------------------------------------------------------------ interaction
  findTarget() {
    const w = this.world;
    const cam = this.camera.position;
    this.camera.getWorldDirection(_dir);
    let best = null;
    let bestScore = Infinity;
    for (const v of w.unlitVotives) {
      if (v.lit) continue;
      const d = v.pos.distanceTo(cam);
      if (d > 2.3) continue;
      const dot = _to.copy(v.pos).sub(cam).normalize().dot(_dir);
      if (dot < 0.78) continue;
      const score = d * (2.2 - dot * 1.2);
      if (score < bestScore) {
        bestScore = score;
        best = { kind: 'votive', v };
      }
    }
    if (w.bell) {
      const d = w.bell.distanceTo(cam);
      if (d < 4 && _to.copy(w.bell).sub(cam).normalize().dot(_dir) > 0.35) best = { kind: 'bell' };
    }
    return best;
  }

  interact() {
    if (this.mode !== 'walk') return;
    const t = this.target;
    if (!t) return;
    if (t.kind === 'votive') {
      if (this.world.flames.add(t.v.pos, this.time)) {
        t.v.lit = true;
        this.audio.candle();
      }
    } else if (t.kind === 'bell') this.world.ringBell(this.time);
  }

  // ------------------------------------------------------------------ per frame
  attractCamera(t) {
    const a = t * 0.045;
    this.camera.position.set(Math.sin(a) * 7, 0.4 + Math.sin(t * 0.07) * 1.1, 84 + Math.cos(a) * 10);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 23, 0);
  }

  frame(fixedDt) {
    this.timer.update();
    const raw = this.timer.getDelta();
    const dt = fixedDt ?? Math.min(MAX_DT, raw);
    this.time += dt;
    const cam = this.camera;
    const w = this.world;
    if (this.mode === 'walk') this.player.update(dt);
    else if (this.mode === 'tour') {
      this.tour.update(dt);
      if (this.tour.active) {
        this.tour.apply(cam);
        this.ui.setCaptionOpacity(this.tour.caption);
      }
      this.pipeline.fade = this.tour.fade;
    } else if (this.mode === 'attract') this.attractCamera(this.time);
    cam.updateMatrixWorld();

    const target = insideFactor(cam.position);
    const darkTarget = darkFactor(cam.position);
    const snap = this.inside === undefined || SHOT;
    const k = 1 - Math.exp(-dt * 4);
    this.inside = snap ? target : this.inside + (target - this.inside) * k;
    this.dark = snap ? darkTarget : this.dark + (darkTarget - this.dark) * k;
    const inside = this.inside;
    if (this.night !== this.nightTarget) {
      const step = dt / 2.5;
      this.night = Math.abs(this.nightTarget - this.night) < step ? this.nightTarget : this.night + Math.sign(this.nightTarget - this.night) * step;
    }
    const night = THREE.MathUtils.smoothstep(this.night, 0, 1);
    w.setNight(night);
    w.lighting.update(cam, inside, night, this.dark);
    w.scene.environment = inside > 0.5 ? w.lighting.envInterior : w.lighting.envExterior;
    w.shafts?.setMaster(Math.max(0, inside * 1.2 - 0.2) * (1 - night));
    if (w.dust) w.dust.visible = inside > 0.2 && night < 0.8;
    w.lightPool.master = 1 + night * 0.7;
    w.extPool.master = (1 - inside) * (0.2 + night * 1.1);
    this.pipeline.params.exposure = THREE.MathUtils.lerp(0.92, 1.3, night) * (1 + 0.3 * this.dark);
    w.update(dt, this.time, cam);

    // Render the one planar reflection that matters for where we stand.
    const reflOn = this.quality.reflections && this.frames > 1;
    const active = cam.position.y > 0.3 && cam.position.z < SITE_Z ? w.reflections.interior : w.reflections.exterior;
    for (const fm of w.floorMats) fm.userData.uniforms.uReflActive.value = reflOn && w.floorReflector.get(fm) === active ? 1 : 0;
    if (reflOn) active.update(this.renderer, w.scene, cam);
    const sp = w.sky.sunDir.clone().multiplyScalar(1000).add(cam.position).project(cam);
    this.pipeline.sunUV.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);
    const sunInView = sp.z < 1 && Math.abs(sp.x) < 1.6 && Math.abs(sp.y) < 1.6 ? 1 : 0;
    this.pipeline.params.rays = (1 - inside) * 0.55 * sunInView * (1 - night);
    this.pipeline.render(w.scene, cam, this.time);
    this.frames++;

    if (this.mode === 'walk') {
      this.target = this.findTarget();
      this.ui.setHint(this.target ? (this.target.kind === 'bell' ? 'Ring the bell' : 'Light a candle') : '');
      this.ui.updatePlace(cam.position, this.time);
    }
    if (this.mode === 'walk' || this.mode === 'tour') {
      this.camera.getWorldDirection(_dir);
      this.audio.update(dt, { inside, night, pos: cam.position, yaw: Math.atan2(-_dir.x, -_dir.z), waters: w.waters, altitude: cam.position.y });
    }
    if (!fixedDt) this.adaptResolution(raw);
    if (SHOT && this.frames === (+params.get('frames') || 4)) {
      window.__STATS = { calls: this.renderer.info.render.calls, tris: this.renderer.info.render.triangles };
      window.__SHOT_READY = true;
    }
  }

  /** Trade resolution for smoothness when frames run long; recover when there is headroom. */
  adaptResolution(raw) {
    if (SHOT || this.mode === 'attract' || this.mode === 'loading') return;
    const p = this.perf;
    p.acc += raw;
    p.n++;
    p.since += raw;
    if (p.since < 2.5) return;
    const fps = p.n / p.acc;
    this.ui.setFps(`${fps.toFixed(0)} fps · ${this.qualityName} · ${(this.quality.scale * this.dynScale * 100).toFixed(0)}% · ${this.renderer.info.render.calls} calls`);
    p.acc = p.n = p.since = 0;
    let next = this.dynScale;
    const floor = LITE ? 0.45 : 0.6;
    if (fps < 40 && this.dynScale > floor) next = Math.max(floor, this.dynScale - 0.1);
    else if (fps > 57 && this.dynScale < 1) next = Math.min(1, this.dynScale + 0.05);
    if (next !== this.dynScale) {
      this.dynScale = next;
      this.resize();
    }
    p.slow = fps < 26 && this.dynScale <= floor ? p.slow + 1 : 0;
    const i = QUALITY_ORDER.indexOf(this.qualityName);
    if (p.slow >= 2 && i > 0 && !this.qualityLocked) {
      p.slow = 0;
      this.applyQuality(QUALITY_ORDER[i - 1]);
      this.ui.refresh();
    }
  }

  // ------------------------------------------------------------------ tooling
  initShot() {
    document.getElementById('loader').remove();
    document.getElementById('hud').hidden = true;
    const tourAt = params.get('tour');
    if (tourAt !== null) {
      const [ci, t] = tourAt.split(',').map(Number);
      const c = this.tour.chapters[ci];
      if (c.def.night !== undefined) this.world.setNight((this.night = this.nightTarget = c.def.night));
      c.sample(t || 0, this.tour.eye, this.tour.target);
      this.mode = 'shot-tour';
      this.tour.apply(this.camera);
    } else {
      const pos = (params.get('pos') || '0,0,-4').split(',').map(Number);
      const look = (params.get('look') || '0,0').split(',').map(Number);
      this.player.place(pos[0], pos[1], pos[2], THREE.MathUtils.degToRad(look[0]), THREE.MathUtils.degToRad(look[1]));
      if (params.has('fly')) this.player.fly = true;
    }
    if (params.get('fov')) {
      this.camera.fov = +params.get('fov');
      this.player.fovTarget = this.camera.fov;
      this.camera.updateProjectionMatrix();
    }
    // Re-aim without reloading: __view({ pos: [x,y,z], look: [yawDeg, pitchDeg] } | { tour: [chapter, t] }, frames)
    window.__view = (v, frames = 3) => new Promise((resolve) => {
      if (v.night !== undefined) this.world.setNight((this.night = this.nightTarget = v.night));
      if (v.fov) {
        this.camera.fov = v.fov;
        this.camera.updateProjectionMatrix();
      }
      if (v.tour) {
        const c = this.tour.chapters[v.tour[0]];
        if (c.def.night !== undefined && v.night === undefined) this.world.setNight((this.night = this.nightTarget = c.def.night));
        c.sample(v.tour[1] || 0, this.tour.eye, this.tour.target);
        this.mode = 'shot-tour';
        this.tour.apply(this.camera);
      } else {
        this.mode = 'loading';
        this.player.place(v.pos[0], v.pos[1], v.pos[2], THREE.MathUtils.degToRad(v.look?.[0] || 0), THREE.MathUtils.degToRad(v.look?.[1] || 0));
      }
      const until = this.frames + frames;
      const wait = () => (this.frames >= until ? resolve({ calls: this.renderer.info.render.calls }) : requestAnimationFrame(wait));
      wait();
    });
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** Deterministic capture of the guided tour: the page is stepped frame by frame from outside. */
  initRecord() {
    document.body.classList.add('record');
    document.getElementById('loader').remove();
    document.getElementById('hud').hidden = false;
    const fps = +params.get('fps') || 24;
    this.startTour(+params.get('chapter') || 0, false);
    const only = params.has('only');
    const status = () => ({ done: !this.tour.active || (only && this.tour.index !== (+params.get('chapter') || 0)), chapter: this.tour.index, t: this.tour.time, total: this.tour.duration });
    window.__step = (n = 1) => new Promise((resolve) => {
      requestAnimationFrame(() => {
        for (let i = 0; i < n; i++) this.frame(1 / fps);
        requestAnimationFrame(() => resolve(status()));
      });
    });
    window.__RECORD_READY = true;
  }
}

const app = new App();
window.app = app;
app.init().catch((e) => {
  console.error(e);
  document.getElementById('progress-status').textContent = `Something went wrong: ${e.message}`;
});
