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
import { buildExterior, exteriorCollision } from './cathedral/exterior.js';
import { buildLoggia, hangLanternParts } from './cathedral/loggia.js';
import { buildSite, SITE } from './landscape/Site.js';
import { buildTerrain } from './landscape/Terrain.js';
import { buildGarden } from './landscape/Garden.js';
import { L } from './layout.js';
import { furnishInterior } from './props/furnish.js';
import { buildSanctuary } from './props/sanctuary.js';
import { flameGeometry } from './props/protos.js';
import { Flames, LightPool } from '../fx/Flames.js';
import { LightShafts, makeDust } from '../fx/LightShafts.js';
import { CROSS } from './cathedral/crossing.js';

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
    exteriorCollision(ctx);
    ctx.inst.define('hangLantern', hangLanternParts(), { castShadow: false });
    const loggiaFlames = buildLoggia(ctx);

    progress(0.55, 'Carving the pews and statues…');
    await tick();
    const flames = furnishInterior(ctx);
    flames.push(...buildSanctuary(ctx), ...loggiaFlames);

    progress(0.62, 'Planting the gardens…');
    await tick();
    buildSite(ctx);
    progress(0.7, 'Shaping the mountains…');
    await tick();
    scene.add(buildTerrain(ctx, this));
    flames.push(...buildGarden(ctx, this));

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

    progress(0.9, 'Letting in the light…');
    await tick();
    this.buildLight(ctx);
    progress(0.95, 'Lighting the candles…');
    await tick();
  }

  buildLight(ctx) {
    const L = this.lighting.interiorSunDir.clone().negate();
    this.shafts = new LightShafts(ctx.glass.windows, L, { floorY: 0, maxBeams: 34, intensity: 0.36, poolIntensity: 1.3 });
    // the lantern: a pale column of light falling through the oculus of the dome
    const disc = document.createElement('canvas');
    disc.width = disc.height = 64;
    const g = disc.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    grd.addColorStop(0, '#fff8e8');
    grd.addColorStop(0.7, '#ffe8c0');
    grd.addColorStop(1, '#000000');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(disc);
    const lan = ctx.anchors.lantern;
    const r = CROSS.oculus + 0.1;
    const oy = ctx.anchors.domeCenter.y + CROSS.domeH - 0.3;
    this.shafts.addBeam(new THREE.Vector3(lan.x - r, oy, lan.z - r), new THREE.Vector3(r * 2, 0, 0), new THREE.Vector3(0, 0, r * 2), tex, 0.9, 0.7);
    this.scene.add(this.shafts.group);
    this.dust = makeDust(this.shafts, 70);
    this.scene.add(this.dust);
  }

  /** Replace the procedural interior probe with a capture of the real nave. */
  captureInterior() {
    const r = this.renderer;
    const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
    const cam = new THREE.CubeCamera(0.3, 1200, cubeRT);
    cam.position.set(0, 9, -40);
    const hidden = [this.shafts?.group, this.dust, this.flames?.group];
    hidden.forEach((o) => o && (o.visible = false));
    for (const fm of this.floorMats) fm.userData.uniforms.uReflActive.value = 0;
    const probeCam = new THREE.PerspectiveCamera();
    probeCam.position.copy(cam.position);
    this.lighting.update(probeCam, 1, this.night || 0);
    this.scene.environment = this.lighting.envInterior;
    cam.update(r, this.scene);
    const env = this.pmrem.fromCubemap(cubeRT.texture).texture;
    cubeRT.dispose();
    hidden.forEach((o) => o && (o.visible = true));
    this.lighting.envInterior = env;
    for (const fm of this.interiorFloorMats) {
      fm.envMap = env;
      fm.needsUpdate = true;
    }
    this.scene.environment = env;
    return env;
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
    fm.userData.interior = true;
    fmRaised.userData.interior = true;
    this.interiorFloorMats = [fm, fmRaised];
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
    // loggia: star-tiled gallery floor
    const fmLoggia = floorMaterial(d, reflI, { mode: 2, envMap: this.lighting.envExterior, reflStrength: 0.9 });
    this.floorMats.push(fmLoggia);
    this.floorReflector.set(fmLoggia, reflI);
    if (this.loggiaFloor) this.addFloor(this.loggiaFloor, 0.0, fmLoggia);
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
    this.shafts?.update(time);
    for (const m of this.waterMaterials) m.uniforms.uTime.value = time;
    if (this.waterfallMaterial) this.waterfallMaterial.uniforms.uTime.value = time;
    for (const u of this.updaters) u(dt, time, camera);
  }
}
