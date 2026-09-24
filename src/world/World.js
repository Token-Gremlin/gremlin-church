import * as THREE from 'three';
import { Batcher } from '../arch/geom.js';
import { balusterGeometry, Parts } from '../arch/components.js';
import { createMaterials, floorMaterial } from '../materials/Materials.js';
import { Collision } from '../engine/Collision.js';
import { PlanarReflection, LAYER_FLOOR } from '../engine/PlanarReflection.js';
import { GlassRegistry, Instancer } from './registry.js';
import { registerGlass } from './glassDesigns.js';
import { Sky } from './Sky.js';
import { Lighting, makeInteriorEnvironment } from './Lighting.js';
import { buildNave } from './cathedral/nave.js';
import { buildCrossing } from './cathedral/crossing.js';
import { buildChoir, apseVertices } from './cathedral/choir.js';
import { buildWest, PORTAL } from './cathedral/west.js';
import { L } from './layout.js';

const tick = () => new Promise((r) => requestAnimationFrame(() => r()));

export class World {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.sky = new Sky();
    this.scene.add(this.sky.mesh);
    this.lighting = new Lighting(this.scene, this.sky);
    this.collision = new Collision(4);
    this.reflections = {
      interior: new PlanarReflection(0),
      exterior: new PlanarReflection(L.promenadeY),
    };
    this.updaters = [];
    this.zones = [];
  }

  async build(progress = () => {}) {
    const r = this.renderer;
    const scene = this.scene;
    progress(0.03, 'Quarrying marble…');
    await tick();
    const mats = createMaterials();
    this.mats = mats;
    const pmrem = new THREE.PMREMGenerator(r);
    this.lighting.envExterior = this.sky.buildEnvironment(r, pmrem);
    this.lighting.envInterior = makeInteriorEnvironment(r, pmrem, 0);
    scene.environment = this.lighting.envInterior;

    const ctx = {
      B: new Batcher(),
      inst: new Instancer(),
      glass: new GlassRegistry(),
      col: this.collision,
      mats,
      anchors: { vaultBosses: [], chandeliers: [], candles: [], lights: [] },
      world: this,
    };
    this.ctx = ctx;
    const bal = new Parts();
    bal.add('stone', balusterGeometry(0.72));
    ctx.inst.define('baluster', bal);
    const balG = new Parts();
    balG.add('marble', balusterGeometry(0.72));
    ctx.inst.define('balusterMarble', balG);

    progress(0.1, 'Leading the stained glass…');
    await tick();
    registerGlass(ctx.glass);

    progress(0.3, 'Raising the nave…');
    await tick();
    buildNave(ctx);
    progress(0.4, 'Turning the crossing arches…');
    await tick();
    buildCrossing(ctx);
    progress(0.5, 'Crowning the apse…');
    await tick();
    buildChoir(ctx);
    buildWest(ctx);

    progress(0.7, 'Setting the floors…');
    await tick();
    this.buildFloors(ctx);

    progress(0.8, 'Assembling…');
    await tick();
    const shell = ctx.B.build(mats, { name: 'architecture' });
    scene.add(shell);
    scene.add(ctx.glass.build());
    scene.add(ctx.inst.build(mats));
    this.glassMaterials = ctx.glass.materials();
    progress(0.95, 'Lighting the candles…');
    await tick();
  }

  addFloor(points, y, material) {
    const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ShapeGeometry(shape, 4);
    g.rotateX(-Math.PI / 2);
    g.translate(0, y, 0);
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true;
    m.layers.set(LAYER_FLOOR);
    m.matrixAutoUpdate = false;
    this.scene.add(m);
    return m;
  }

  buildFloors(ctx) {
    const reflI = this.reflections.interior;
    const fm = floorMaterial(this.mats.detail, reflI, { mode: 0, envMap: this.lighting.envInterior });
    const fmRaised = floorMaterial(this.mats.detail, null, { mode: 0, envMap: this.lighting.envInterior });
    this.floorMats = [fm];
    this.floorMatsInterior = [fm];
    const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    this.addFloor(rect(-L.aisleFace, 0.02, L.aisleFace, L.naveZ1), 0, fm);
    for (const s of [-1, 1]) this.addFloor(rect(s * (PORTAL.sideX - 1.4), L.westT + 0.1, s * (PORTAL.sideX + 1.4), 0.02), 0, fm);
    this.addFloor(rect(-2.8, L.westT + 0.1, 2.8, 0.02), 0, fm);
    this.addFloor(rect(-L.transEnd, L.crossZ0, L.transEnd, L.crossZ1), 0, fm);
    this.addFloor(rect(-L.naveFace, L.crossZ1 - 1.6, L.naveFace, -90.2), L.choirY, fmRaised);
    const apse = apseVertices(L.naveFace).map((v) => [v.x, v.z]);
    this.addFloor([[L.naveFace, -92.0], ...apse, [-L.naveFace, -92.0]], L.sanctuaryY, fmRaised);
  }

  update(dt, time, camera) {
    this.sky.update(time);
    for (const u of this.updaters) u(dt, time, camera);
  }
}
