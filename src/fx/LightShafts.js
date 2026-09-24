import * as THREE from 'three';
import { NOISE_GLSL } from '../shaders/noise.js';
import { LAYER_NO_REFLECT } from '../engine/PlanarReflection.js';

// Analytic ray-marched light shafts: each beam is the window rectangle swept along
// the light direction. Samples look back up the ray to the stained glass so the
// shaft carries the colours of the window it passed through.
const SHAFT_VERT = /* glsl */ `
varying vec3 vWPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const SHAFT_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform sampler2D uGlass;
uniform mat4 uToLocal;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;
uniform float uFloorY;
uniform float uFalloff;
varying vec3 vWPos;

void main() {
  vec3 ro = (uToLocal * vec4(cameraPosition, 1.0)).xyz;
  vec3 re = (uToLocal * vec4(vWPos, 1.0)).xyz;
  vec3 rd = re - ro;
  // slab intersection with the unit cube
  vec3 inv = 1.0 / (rd + sign(rd) * 1e-6 + vec3(1e-7));
  vec3 t0 = (vec3(0.0) - ro) * inv;
  vec3 t1 = (vec3(1.0) - ro) * inv;
  vec3 tmin = min(t0, t1), tmax = max(t0, t1);
  float tn = max(max(max(tmin.x, tmin.y), tmin.z), 0.0);
  float tf = min(min(min(tmax.x, tmax.y), tmax.z), 1.0);
  if (tf <= tn) discard;
  vec3 worldDelta = vWPos - cameraPosition;
  float segLen = length(worldDelta) * (tf - tn);
  const int N = 10;
  vec3 acc = vec3(0.0);
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  for (int i = 0; i < N; i++) {
    float t = mix(tn, tf, (float(i) + jitter) / float(N));
    vec3 q = ro + rd * t;
    vec3 wp = cameraPosition + worldDelta * t;
    vec3 g = texture2D(uGlass, q.xy).rgb;
    float lum = dot(g, vec3(0.3, 0.55, 0.15));
    vec3 c = g * g * 2.6 + vec3(lum * lum * lum) * 0.5;
    float edge = smoothstep(0.0, 0.08, q.x) * smoothstep(1.0, 0.92, q.x) * smoothstep(0.0, 0.05, q.y) * smoothstep(1.0, 0.9, q.y);
    float along = exp(-q.z * uFalloff) * smoothstep(0.0, 0.04, q.z);
    float dust = 0.55 + 0.45 * vnoise3(wp * 0.35 + vec3(0.0, -uTime * 0.08, uTime * 0.03));
    float floorFade = smoothstep(uFloorY, uFloorY + 1.8, wp.y);
    acc += c * edge * along * dust * floorFade;
  }
  acc *= segLen / float(N);
  gl_FragColor = vec4(acc * uColor * uIntensity, 1.0);
}`;

const POOL_VERT = /* glsl */ `
attribute vec2 aWin;
varying vec2 vWin;
varying vec3 vWPos;
void main() {
  vWin = aWin;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const POOL_FRAG = /* glsl */ `
uniform sampler2D uGlass;
uniform vec3 uColor;
uniform float uIntensity;
varying vec2 vWin;
void main() {
  vec3 g = texture2D(uGlass, vWin, 1.5).rgb;
  float lum = dot(g, vec3(0.3, 0.55, 0.15));
  float edge = smoothstep(0.0, 0.06, vWin.x) * smoothstep(1.0, 0.94, vWin.x) * smoothstep(0.0, 0.04, vWin.y) * smoothstep(1.0, 0.96, vWin.y);
  vec3 c = (g * g * 2.0 + vec3(lum * lum) * 0.5) * edge;
  gl_FragColor = vec4(c * uColor * uIntensity, 1.0);
}`;

export class LightShafts {
  constructor(windows, lightDir, { floorY = 0, maxBeams = 40, intensity = 0.06, poolIntensity = 0.9 } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'lightShafts';
    this.materials = [];
    this.poolMaterials = [];
    this.uniformsTime = { value: 0 };
    this.master = 1;
    this.beams = [];
    this.L = lightDir.clone().normalize(); // direction light travels
    this.floorY = floorY;
    this.intensity = intensity;
    this.poolIntensity = poolIntensity;
    // A window admits sunlight when the light travels inward through it.
    const cands = windows
      .filter((w) => w.shafts !== false && w.frame)
      .map((w) => ({ w, facing: w.normal.dot(this.L) }))
      .filter((o) => o.facing > 0.12)
      .sort((a, b) => b.facing - a.facing)
      .slice(0, maxBeams);
    for (const { w, facing } of cands) {
      const f = w.frame;
      const origin = f.world(w.ca - w.W / 2, w.y0 - f.o.y, 0);
      const A = f.u.clone().multiplyScalar(w.W);
      const B = new THREE.Vector3(0, w.H, 0);
      const k = Math.min(1, facing * 1.6) * (w.kind === 'rose' ? 1.3 : 1);
      this.addBeam(origin, A, B, w.texture, k, w.kind === 'drum' ? 1.1 : 1.6);
    }
  }

  /** Add a beam whose source is the parallelogram origin + [0,1]·A + [0,1]·B. */
  addBeam(origin, A, B, texture, strength = 1, falloff = 1.6) {
    const L = this.L;
    const floorY = this.floorY;
    const topY = Math.max(origin.y, origin.y + A.y, origin.y + B.y, origin.y + A.y + B.y);
    const len = (topY - floorY) / Math.max(0.2, -L.y) + 2;
    const C = L.clone().multiplyScalar(len);
    const m = new THREE.Matrix4().makeBasis(A, B, C).setPosition(origin);
    const toLocal = m.clone().invert();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0.5, 0.5, 0.5);
    const mat = new THREE.ShaderMaterial({
      vertexShader: SHAFT_VERT,
      fragmentShader: SHAFT_FRAG,
      uniforms: {
        uGlass: { value: texture },
        uToLocal: { value: toLocal },
        uColor: { value: new THREE.Color(1.0, 0.86, 0.66) },
        uIntensity: { value: this.intensity * strength },
        uTime: this.uniformsTime,
        uFloorY: { value: floorY },
        uFalloff: { value: falloff },
      },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });
    mat.userData.base = mat.uniforms.uIntensity.value;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(m);
    mesh.matrixWorldNeedsUpdate = true;
    mesh.frustumCulled = false;
    mesh.renderOrder = 10;
    mesh.layers.set(LAYER_NO_REFLECT);
    this.group.add(mesh);
    this.materials.push(mat);
    this.beams.push({ origin, A, B, C, toLocal });

    // floor pool: project the source parallelogram along L onto the floor
    const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => {
      const p = origin.clone().addScaledVector(A, u).addScaledVector(B, v);
      const t = (floorY + 0.015 - p.y) / L.y;
      return p.addScaledVector(L, t);
    });
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(corners.flatMap((c) => [c.x, c.y, c.z]), 3));
    pg.setAttribute('aWin', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    pg.setIndex([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]);
    const pm = new THREE.ShaderMaterial({
      vertexShader: POOL_VERT,
      fragmentShader: POOL_FRAG,
      uniforms: {
        uGlass: { value: texture },
        uColor: { value: new THREE.Color(1.0, 0.88, 0.7) },
        uIntensity: { value: this.poolIntensity * Math.min(1, strength) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    pm.userData.base = pm.uniforms.uIntensity.value;
    const pool = new THREE.Mesh(pg, pm);
    pool.renderOrder = 4;
    pool.frustumCulled = false;
    pool.layers.set(LAYER_NO_REFLECT);
    this.group.add(pool);
    this.poolMaterials.push(pm);
  }

  setMaster(k) {
    this.master = k;
    for (const m of this.materials) m.uniforms.uIntensity.value = m.userData.base * k;
    for (const m of this.poolMaterials) m.uniforms.uIntensity.value = m.userData.base * k;
    this.group.visible = k > 0.001;
  }

  update(time) {
    this.uniformsTime.value = time;
  }
}

// Dust motes drifting inside the beams
const DUST_VERT = /* glsl */ `
uniform float uTime;
uniform float uSize;
attribute vec3 aSeed;
varying float vA;
void main() {
  vec3 p = position;
  float t = uTime * 0.12;
  p += vec3(sin(t + aSeed.x * 6.28) * 0.6, sin(t * 0.7 + aSeed.y * 6.28) * 0.4 - fract(t * 0.05 + aSeed.z) * 0.8, cos(t * 0.9 + aSeed.z * 6.28) * 0.6);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.6 + aSeed.x) / max(0.5, -mv.z);
  vA = 0.5 + 0.5 * sin(uTime * (1.0 + aSeed.y * 2.0) + aSeed.z * 30.0);
}`;

const DUST_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c) * 4.0;
  float a = exp(-d * 4.0);
  gl_FragColor = vec4(uColor * a * vA * uIntensity, 1.0);
}`;

export function makeDust(shafts, perBeam = 90) {
  const pos = [];
  const seed = [];
  for (const b of shafts.beams) {
    for (let i = 0; i < perBeam; i++) {
      const u = Math.random(), v = Math.random(), w = Math.pow(Math.random(), 1.6) * 0.8;
      const p = b.origin.clone().addScaledVector(b.A, u).addScaledVector(b.B, v).addScaledVector(b.C, w);
      if (p.y < 0.3) continue;
      pos.push(p.x, p.y, p.z);
      seed.push(Math.random(), Math.random(), Math.random());
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 3));
  const u = { uTime: shafts.uniformsTime, uSize: { value: 60 }, uColor: { value: new THREE.Color(1.0, 0.85, 0.6) }, uIntensity: { value: 1.6 } };
  const m = new THREE.ShaderMaterial({ vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.layers.set(LAYER_NO_REFLECT);
  pts.renderOrder = 11;
  pts.userData.uniforms = u;
  return pts;
}
