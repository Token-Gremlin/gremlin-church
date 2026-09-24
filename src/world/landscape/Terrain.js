import * as THREE from 'three';
import { NOISE_GLSL } from '../../shaders/noise.js';
import { rng, TAU } from '../../arch/geom.js';
import { pointInPoly } from '../../engine/Collision.js';

// Plateau outline (x, z) — the walkable upland the basilica stands on.
export const PLATEAU = [
  [-74, -118], [62, -118], [62, 26], [41, 38], [41, 178], [-41, 178], [-41, 38], [-74, 26],
];
export const PLATEAU_Y = -3.3;
export const LAKE_Y = -57;

function segDist(px, pz, ax, az, bx, bz) {
  const ex = bx - ax, ez = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / (ex * ex + ez * ez)));
  return Math.hypot(px - (ax + ex * t), pz - (az + ez * t));
}

function polyDist(x, z) {
  let d = Infinity;
  for (let i = 0; i < PLATEAU.length; i++) {
    const a = PLATEAU[i], b = PLATEAU[(i + 1) % PLATEAU.length];
    d = Math.min(d, segDist(x, z, a[0], a[1], b[0], b[1]));
  }
  return d;
}

// Simple value noise for CPU heights
const R = rng(1234);
const PERM = new Float32Array(1024);
for (let i = 0; i < 1024; i++) PERM[i] = R();
function hn(ix, iz) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return PERM[(h ^ (h >>> 16)) & 1023];
}
function noise2(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hn(ix, iz), b = hn(ix + 1, iz), c = hn(ix, iz + 1), d = hn(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
export function fbm2(x, z, oct = 5) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) {
    s += noise2(x, z) * a;
    n += a;
    x = x * 2.03 + 11.7;
    z = z * 2.03 + 5.3;
    a *= 0.5;
  }
  return s / n;
}

export function groundHeight(x, z) {
  const inside = pointInPoly(x, z, PLATEAU);
  if (inside) {
    const e = polyDist(x, z);
    return PLATEAU_Y - 0.25 + fbm2(x * 0.05, z * 0.05, 3) * 0.3 - Math.max(0, 3 - e) * 0.15;
  }
  const d = polyDist(x, z);
  const rock = fbm2(x * 0.08, z * 0.08, 4);
  const cliff = 54 * THREE.MathUtils.smoothstep(d, 0, 9 + rock * 6) + rock * 6;
  let h = PLATEAU_Y - cliff;
  // valley floor with low islands, rising to foothills far away
  const far = Math.max(0, d - 60);
  h += fbm2(x * 0.012, z * 0.012, 4) * 10 * Math.min(1, d / 40) + Math.pow(Math.min(1, far / 700), 1.5) * 70 * fbm2(x * 0.004 + 3, z * 0.004, 3);
  return h;
}

const TERRAIN_FRAG_CHUNK = /* glsl */ `
{
  float slope = 1.0 - clamp(vWNrm.y, 0.0, 1.0);
  float n1 = fbm(vWPos.xz * 0.15);
  float n2 = fbm(vWPos.xz * 1.3 + 7.0);
  vec3 grass = mix(vec3(0.11, 0.2, 0.06), vec3(0.2, 0.26, 0.08), n1);
  grass *= 0.8 + 0.35 * n2;
  vec3 rock = mix(vec3(0.34, 0.3, 0.27), vec3(0.52, 0.47, 0.42), fbm(vec2(vWPos.y * 0.6, vWPos.x * 0.05 + vWPos.z * 0.05)));
  float strata = 0.85 + 0.15 * sin(vWPos.y * 2.2 + n1 * 4.0);
  rock *= strata;
  float rm = smoothstep(0.28, 0.55, slope + (n1 - 0.5) * 0.2);
  vec3 c = mix(grass, rock, rm);
  float shore = smoothstep(-52.0, -56.5, vWPos.y);
  c = mix(c, vec3(0.3, 0.27, 0.22), shore);
  diffuseColor.rgb = c;
}`;

export function terrainMaterial(detail, envMap) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, envMap, envMapIntensity: 0.7 });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNrm = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;\n${NOISE_GLSL}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${TERRAIN_FRAG_CHUNK}`);
  };
  mat.customProgramCacheKey = () => 'terrain';
  return mat;
}

function gridGeometry(x0, z0, x1, z1, nx, nz, hfn) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, hfn(pos.getX(i), pos.getZ(i)));
  g.computeVertexNormals();
  return g;
}

const MOUNTAIN_VERT = /* glsl */ `
varying vec3 vWPos;
varying vec3 vNrm;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz;
  vNrm = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const MOUNTAIN_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uHaze;
uniform vec3 uHazeTop;
uniform vec3 uAmbient;
uniform float uNight;
varying vec3 vWPos;
varying vec3 vNrm;
void main() {
  vec3 n = normalize(vNrm);
  float h = vWPos.y;
  float slope = 1.0 - n.y;
  float nz = fbm(vWPos.xz * 0.006);
  float snowLine = 330.0 + nz * 140.0;
  float snow = smoothstep(snowLine, snowLine + 70.0, h) * smoothstep(0.8, 0.4, slope + (fbm(vWPos.xz * 0.03) - 0.5) * 0.3);
  vec3 rock = mix(vec3(0.26, 0.22, 0.23), vec3(0.42, 0.35, 0.34), fbm(vWPos.xz * 0.012 + h * 0.006));
  vec3 forest = vec3(0.045, 0.075, 0.05);
  vec3 alb = mix(forest, rock, smoothstep(60.0, 240.0, h + nz * 90.0));
  alb = mix(alb, vec3(0.95, 0.94, 1.0), snow);
  float diff = max(dot(n, uSunDir), 0.0);
  float wrap = max(dot(n, uSunDir) * 0.5 + 0.5, 0.0);
  vec3 col = alb * (uSunColor * (diff * 1.5 + wrap * 0.15) + uAmbient * (0.6 + 0.4 * n.y));
  float dist = length(vWPos.xz - cameraPosition.xz);
  float haze = 1.0 - exp(-dist * 0.00034);
  vec3 hazeCol = mix(uHaze, uHazeTop, clamp(h / 900.0, 0.0, 1.0));
  col = mix(col, hazeCol, clamp(haze * 0.95, 0.0, 0.93));
  gl_FragColor = vec4(col, 1.0);
}`;

export function buildTerrain(ctx, world) {
  const mats = ctx.mats;
  const group = new THREE.Group();
  group.name = 'terrain';
  const tmat = terrainMaterial(mats.detail, world.lighting.envExterior);
  // near terrain (plateau + cliffs + valley)
  const near = new THREE.Mesh(gridGeometry(-260, -300, 260, 380, 208, 272, groundHeight), tmat);
  near.receiveShadow = true;
  near.castShadow = false;
  near.name = 'terrain-near';
  group.add(near);
  // distant rolling land as a coarse ring
  const far = new THREE.Mesh(gridGeometry(-1600, -1600, 1600, 1800, 80, 85, (x, z) => {
    const inNear = x > -250 && x < 250 && z > -290 && z < 370;
    const h = groundHeight(x, z);
    return inNear ? h - 6 : h;
  }), tmat);
  far.receiveShadow = false;
  far.name = 'terrain-far';
  group.add(far);

  // Lake
  const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000, 1, 1), waterMaterial(world));
  water.rotation.x = -Math.PI / 2;
  water.position.y = LAKE_Y;
  water.name = 'lake';
  group.add(water);
  world.waterMaterials.push(water.material);

  // Mountain ring
  const mUniforms = {
    uSunDir: { value: world.sky.sunDir },
    uSunColor: { value: new THREE.Color(1.5, 0.66, 0.46) },
    uHaze: { value: new THREE.Color(1.25, 0.72, 0.5) },
    uHazeTop: { value: new THREE.Color(0.62, 0.44, 0.62) },
    uAmbient: { value: new THREE.Color(0.2, 0.17, 0.3) },
    uNight: { value: 0 },
  };
  world.mountainUniforms = mUniforms;
  const mMat = new THREE.ShaderMaterial({ vertexShader: MOUNTAIN_VERT, fragmentShader: MOUNTAIN_FRAG, uniforms: mUniforms });
  const segA = 360, segR = 44;
  const pos = [], idx = [];
  const r0 = 1500, r1 = 5200;
  for (let j = 0; j <= segR; j++) {
    const t = j / segR;
    const r = r0 + (r1 - r0) * Math.pow(t, 1.3);
    for (let i = 0; i <= segA; i++) {
      const a = (i / segA) * TAU;
      const x = Math.cos(a) * r, z = Math.sin(a) * r + 100;
      let ridge = 1 - Math.abs(fbm2(x * 0.0011, z * 0.0011, 5) * 2 - 1);
      ridge = ridge * ridge;
      const envl = Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) * (1 - t * 0.3);
      // taller peaks to the east where the alpenglow falls
      const bias = 0.5 + 0.5 * Math.max(0, Math.cos(a - 0.35));
      const h = -45 + envl * (ridge * 820 * bias + fbm2(x * 0.004, z * 0.004, 4) * 160);
      pos.push(x, h, z);
    }
  }
  for (let j = 0; j < segR; j++) {
    for (let i = 0; i < segA; i++) {
      const a = j * (segA + 1) + i, b = a + 1, c = a + segA + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  mg.setIndex(idx);
  mg.computeVertexNormals();
  const mountains = new THREE.Mesh(mg, mMat);
  mountains.name = 'mountains';
  mountains.frustumCulled = false;
  group.add(mountains);

  buildWaterfalls(ctx, world, group);
  return group;
}

// ---------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------
const WATER_VERT = /* glsl */ `
varying vec3 vWPos;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const WATER_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uDeep;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform float uGlitter;
varying vec3 vWPos;
#include <fog_pars_fragment>
void main() {
  vec2 p = vWPos.xz;
  float t = uTime;
  vec2 g = vec2(
    fbm(p * 0.08 + vec2(t * 0.05, t * 0.03)) - fbm(p * 0.08 + vec2(0.7, 0.0) + vec2(t * 0.05, t * 0.03)),
    fbm(p * 0.08 + vec2(0.0, 0.7) - vec2(t * 0.04, t * 0.05)) - fbm(p * 0.08 - vec2(t * 0.04, t * 0.05)));
  vec3 n = normalize(vec3(g.x * 1.4, 1.0, g.y * 1.4));
  vec3 V = normalize(cameraPosition - vWPos);
  vec3 R = reflect(-V, n);
  float fr = 0.02 + 0.98 * pow(1.0 - max(dot(V, n), 0.0), 5.0);
  vec3 sky = mix(uSkyHorizon, uSkyTop, smoothstep(0.0, 0.5, R.y));
  float sp = pow(max(dot(R, uSunDir), 0.0), 350.0) * 60.0 + pow(max(dot(R, uSunDir), 0.0), 18.0) * 0.6;
  vec3 col = mix(uDeep, sky, fr) + uSunColor * sp * uGlitter;
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;

export function waterMaterial(world, { deep = new THREE.Color(0.02, 0.05, 0.08) } = {}) {
  const u = {
    uTime: { value: 0 },
    uSunDir: { value: world.sky.sunDir },
    uSunColor: { value: new THREE.Color(1.6, 0.9, 0.5) },
    uDeep: { value: deep },
    uSkyTop: { value: new THREE.Color(0.3, 0.32, 0.6) },
    uSkyHorizon: { value: new THREE.Color(1.3, 0.75, 0.5) },
    uGlitter: { value: 1 },
  };
  return new THREE.ShaderMaterial({
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, u]),
    fog: true,
  });
}

const FALL_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWPos;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FALL_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform float uTime;
uniform vec3 uTint;
uniform vec3 uLight;
varying vec2 vUv;
varying vec3 vWPos;
#include <fog_pars_fragment>
void main() {
  float x = vUv.x;
  float y = vUv.y;
  float speed = 0.55;
  float s1 = fbm(vec2(x * 18.0, y * 2.2 + uTime * speed * 2.2));
  float s2 = fbm(vec2(x * 42.0 + 3.0, y * 5.0 + uTime * speed * 3.4));
  float streak = smoothstep(0.35, 0.8, s1 * 0.6 + s2 * 0.55);
  float edge = smoothstep(0.0, 0.12, x) * smoothstep(1.0, 0.88, x);
  float foamTop = smoothstep(0.08, 0.0, y);
  float foamBottom = smoothstep(0.82, 1.0, y);
  float a = edge * (0.45 + 0.55 * streak) + foamBottom * 0.6;
  a *= smoothstep(0.0, 0.02, y);
  vec3 col = mix(uTint * 0.55, uLight, streak * 0.8 + foamBottom * 0.6 + foamTop * 0.5);
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  #include <fog_fragment>
}`;

function buildWaterfalls(ctx, world, group) {
  const u = { uTime: { value: 0 }, uTint: { value: new THREE.Color(0.55, 0.62, 0.7) }, uLight: { value: new THREE.Color(1.6, 1.35, 1.2) } };
  const mat = new THREE.ShaderMaterial({
    vertexShader: FALL_VERT,
    fragmentShader: FALL_FRAG,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, u]),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  });
  world.waterfallMaterial = mat;
  // Each fall: top point on the plateau edge, outward direction, width
  const falls = [
    { x: -41.5, z: 58, dx: -1, dz: 0, w: 9 },
    { x: 41.5, z: 70, dx: 1, dz: 0, w: 11 },
    { x: -41.5, z: 112, dx: -1, dz: 0, w: 7 },
    { x: 41.5, z: 128, dx: 1, dz: 0, w: 8 },
    { x: -74.5, z: -20, dx: -1, dz: 0, w: 14 },
    { x: -74.5, z: -78, dx: -1, dz: 0, w: 10 },
    { x: 62.5, z: -60, dx: 1, dz: 0, w: 12 },
    { x: 55, z: 30, dx: 0.7, dz: 0.7, w: 8 },
    { x: -58, z: 31, dx: -0.6, dz: 0.8, w: 9 },
  ];
  world.waterfalls = falls;
  for (const f of falls) {
    const pts = [];
    const n = 28;
    // sample the cliff profile outward and follow it down with a slight arc
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const out = 0.6 + t * 10 + Math.sin(t * Math.PI) * 2.0;
      const x = f.x + f.dx * out, z = f.z + f.dz * out;
      const gy = groundHeight(x, z);
      const y = THREE.MathUtils.lerp(PLATEAU_Y + 0.4, LAKE_Y + 0.5, Math.pow(t, 1.15));
      pts.push(new THREE.Vector3(x, Math.max(y, gy + 0.6), z));
    }
    const px = -f.dz, pz = f.dx;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const p = pts[i];
      const spread = 1 + (i / n) * 0.35;
      for (let k = 0; k <= 4; k++) {
        const s = (k / 4 - 0.5) * f.w * spread;
        pos.push(p.x + px * s, p.y, p.z + pz * s);
        uv.push(k / 4, i / n);
      }
    }
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 4; k++) {
        const a = i * 5 + k, b = a + 1, c = a + 5, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.renderOrder = 2;
    group.add(m);
    // spring basin at the top
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(f.w * 0.35, f.w * 0.4, 0.8, 16), ctx.mats.stone);
    basin.position.set(f.x - f.dx * 2.5, PLATEAU_Y + 0.1, f.z - f.dz * 2.5);
    group.add(basin);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(f.w * 0.32, 20), world.waterMaterials[0] || mat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(basin.position.x, PLATEAU_Y + 0.52, basin.position.z);
    group.add(pool);
  }
}
