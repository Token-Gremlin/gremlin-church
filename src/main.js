import * as THREE from 'three';
import { Pipeline } from './engine/Pipeline.js';
import { Player } from './engine/Controls.js';
import { World } from './world/World.js';
import { LAYER_FLOOR, LAYER_NO_REFLECT } from './engine/PlanarReflection.js';

const params = new URLSearchParams(location.search);
const SHOT = params.has('shot');

const QUALITY = {
  low: { scale: 0.7, samples: 0, shadow: 1024, reflections: false, bloomLevels: 5, maxPixelRatio: 1 },
  medium: { scale: 0.85, samples: 2, shadow: 2048, reflections: true, reflScale: 0.35, bloomLevels: 6, maxPixelRatio: 1.25 },
  high: { scale: 1.0, samples: 4, shadow: 2048, reflections: true, reflScale: 0.5, bloomLevels: 6, maxPixelRatio: 1.5 },
  ultra: { scale: 1.0, samples: 4, shadow: 4096, reflections: true, reflScale: 0.6, bloomLevels: 7, maxPixelRatio: 2 },
};

class App {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    document.getElementById('app').appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 6000);
    this.camera.layers.enable(LAYER_FLOOR);
    this.camera.layers.enable(LAYER_NO_REFLECT);
    this.pipeline = new Pipeline(this.renderer);
    this.world = new World(this.renderer);
    this.player = new Player(this.camera, this.renderer.domElement, this.world.collision);
    this.timer = new THREE.Timer();
    this.time = 0;
    this.frames = 0;
    this.qualityName = params.get('q') || (matchMedia('(pointer: coarse)').matches ? 'low' : 'high');
    this.applyQuality(this.qualityName, false);
    addEventListener('resize', () => this.resize());
  }

  applyQuality(name, doResize = true) {
    this.qualityName = name;
    const q = QUALITY[name];
    this.quality = q;
    this.pipeline.params.renderScale = q.scale;
    this.pipeline.params.samples = q.samples;
    this.pipeline.params.bloomLevels = q.bloomLevels;
    if (doResize) this.resize();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    const pr = Math.min(devicePixelRatio, this.quality.maxPixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.pipeline.setSize(w, h, pr);
    const refl = this.world.reflections;
    for (const r of Object.values(refl)) {
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
    this.world.lighting.setShadowSize(this.quality.shadow);
    this.resize();
    const pos = (params.get('pos') || '0,0,-4').split(',').map(Number);
    const look = (params.get('look') || '0,0').split(',').map(Number);
    this.player.place(pos[0], pos[1], pos[2], THREE.MathUtils.degToRad(look[0]), THREE.MathUtils.degToRad(look[1]));
    if (params.get('fov')) {
      this.camera.fov = +params.get('fov');
      this.player.fovTarget = this.camera.fov;
      this.camera.updateProjectionMatrix();
    }
    if (params.has('fly')) this.player.fly = true;
    bar.style.width = '100%';
    status.textContent = 'The doors are open.';
    this.renderer.setAnimationLoop(() => this.frame());
    if (SHOT) {
      document.getElementById('loader').remove();
      document.getElementById('hud').hidden = true;
    }
  }

  frame() {
    this.timer.update();
    const dt = Math.min(0.05, this.timer.getDelta());
    this.time += dt;
    this.player.update(dt);
    const cam = this.camera;
    cam.updateMatrixWorld();
    const w = this.world;
    const inside = 1;
    w.lighting.update(cam, inside, 0);
    w.update(dt, this.time, cam);
    const refl = w.reflections.interior;
    const reflOn = this.quality.reflections && this.frames > 1;
    for (const fm of w.floorMats) fm.userData.uniforms.uReflActive.value = reflOn ? 1 : 0;
    if (reflOn) refl.update(this.renderer, w.scene, cam);
    const sp = w.sky.sunDir.clone().multiplyScalar(1000).add(cam.position).project(cam);
    this.pipeline.sunUV.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);
    this.pipeline.render(w.scene, cam, this.time);
    this.frames++;
    if (SHOT && this.frames === (+params.get('frames') || 4)) {
      window.__STATS = { calls: this.renderer.info.render.calls, tris: this.renderer.info.render.triangles };
      window.__SHOT_READY = true;
    }
  }
}

const app = new App();
window.app = app;
app.init().catch((e) => {
  console.error(e);
  document.getElementById('progress-status').textContent = `Something went wrong: ${e.message}`;
});
