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
import { buildExterior } from './cathedral/exterior.js';
import { buildSite, SITE } from './landscape/Site.js';
import { buildTerrain } from './landscape/Terrain.js';
import { L } from './layout.js';
import { furnishInterior } from './props/furnish.js';
import { buildSanctuary } from './props/sanctuary.js';
import { flameGeometry } from './props/protos.js';
import { Flames, LightPool } from '../fx/Flames.js';

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
    this.waterMaterials = [];
    this.floorMats = [];
  }

  async build(progress = () => {}) {
    const r = this.renderer;
    const scene = this.scene;
    progress(0.03, 'Quarrying marble…');
    await tick();
    const mats = createMaterials();
    this.mats = mats;
    const pmrem = new THREE.PMREMGenerator(r);
    this.pmrem = pmrem;
    this.lighting.envExterior = this.sky.buildEnvironment(r, pmrem);
    this.lighting.envInterior = makeInteriorEnvironment(r, pmrem, 0);
    scene.environment = this.lighting.envInterior;

    const ctx = {
      B: new Batcher(),
      inst: new Instancer(),
      glass: new GlassRegistry(),
      col: this.collision,
      mats,
      anchors: { vaultBosses: [], lights: [], extLights: [] },
      world: this,
    };
    this.ctx = ctx;
    const bal = new Parts();
    bal.add('stone', balusterGeometry(0.72));
    ctx.inst.define('baluster', bal);
    const balG = new Parts();
    balG.add('marble', balusterGeometry(0.72));
    ctx.inst.define('balusterMarble', balG);

    progress(0.08, 'Leading the stained glass…');
    await tick();
    registerGlass(ctx.glass);

    progress(0.25, 'Raising the nave…');
    await tick();
    buildNave(ctx);
    progress(0.33, 'Turning the crossing arches…');
    await tick();
    buildCrossing(ctx);
    progress(0.4, 'Crowning the apse…');
    await tick();
    buildChoir(ctx);
    buildWest(ctx);
    progress(0.47, 'Raising the towers…');
    await tick();
    buildExterior(ctx);

    progress(0.55, 'Carving the pews and statues…');
    await tick();
    const flames = furnishInterior(ctx);
    flames.push(...buildSanctuary(ctx));

    progress(0.62, 'Planting the gardens…');
    await tick();
    buildSite(ctx);
    progress(0.7, 'Shaping the mountains…');
    await tick();
    scene.add(buildTerrain(ctx, this));

    progress(0.78, 'Setting the floors…');
    await tick();
    this.buildFloors(ctx);
    this.flames = new Flames(flames, { flameGeometry: flameGeometry() });
    scene.add(this.flames.group);
    this.lightPool = new LightPool(scene, ctx.anchors.lights, 6);

    progress(0.86, 'Assembling…');
    await tick();
    const shell = ctx.B.build(mats, { name: 'architecture' });
    scene.add(shell);
    scene.add(ctx.glass.build());
    scene.add(ctx.inst.build(mats));
    this.glassMaterials = ctx.glass.materials();
    this.glassWindows = ctx.glass.windows;
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
    const reflE = this.reflections.exterior;
    const d = this.mats.detail;
    const fm = floorMaterial(d, reflI, { mode: 0, envMap: this.lighting.envInterior });
    const fmRaised = floorMaterial(d, null, { mode: 0, envMap: this.lighting.envInterior });
    const fmTerrace = floorMaterial(d, reflI, { mode: 1, envMap: this.lighting.envExterior, reflStrength: 0.9 });
    const fmProm = floorMaterial(d, reflE, { mode: 1, envMap: this.lighting.envExterior, reflStrength: 0.9 });
    this.floorMats = [fm, fmTerrace, fmProm];
    this.floorReflector = new Map([[fm, reflI], [fmTerrace, reflI], [fmProm, reflE]]);
    const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    this.addFloor(rect(-L.aisleFace, 0.02, L.aisleFace, L.naveZ1), 0, fm);
    for (const s of [-1, 1]) this.addFloor(rect(s * (PORTAL.sideX - 1.4), L.westT + 0.1, s * (PORTAL.sideX + 1.4), 0.02), 0, fm);
    this.addFloor(rect(-2.8, L.westT + 0.1, 2.8, 0.02), 0, fm);
    this.addFloor(rect(-L.transEnd, L.crossZ0, L.transEnd, L.crossZ1), 0, fm);
    this.addFloor(rect(-L.naveFace, L.crossZ1 - 1.6, L.naveFace, -90.2), L.choirY, fmRaised);
    const apse = apseVertices(L.naveFace).map((v) => [v.x, v.z]);
    this.addFloor([[L.naveFace, -92.0], ...apse, [-L.naveFace, -92.0]], L.sanctuaryY, fmRaised);
    // exterior paving
    this.addFloor(rect(-SITE.terraceX, SITE.terraceZ1, SITE.terraceX, SITE.terraceZ0 - 0.1), -0.012, fmTerrace);
    const P = ctx.podium;
    this.addFloor(rect(P.x0, P.z1, P.x1, P.z0), -0.012, fmTerrace);
    this.addFloor(rect(-SITE.promHalf - 0.3, SITE.promZ1, SITE.promHalf + 0.3, SITE.stairsZ1), SITE.y, fmProm);
  }

  update(dt, time, camera) {
    this.sky.update(time);
    this.flames?.update(time);
    this.lightPool?.update(camera.position, time, dt);
    for (const m of this.waterMaterials) m.uniforms.uTime.value = time;
    if (this.waterfallMaterial) this.waterfallMaterial.uniforms.uTime.value = time;
    for (const u of this.updaters) u(dt, time, camera);
  }
}
