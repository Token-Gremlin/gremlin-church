import * as THREE from 'three';
import { LAYER_NO_REFLECT } from '../engine/PlanarReflection.js';

const FLAME_VERT = /* glsl */ `
uniform float uTime;
varying float vH;
varying float vGlow;
#include <fog_pars_vertex>
void main() {
  vec3 base = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  float ph = fract(sin(dot(base.xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;
  float h = position.y / 0.12;
  vH = h;
  float flick = 1.0 + 0.14 * sin(uTime * 11.0 + ph) + 0.08 * sin(uTime * 23.0 + ph * 1.7);
  vec3 p = position;
  p.y *= flick;
  p.x += sin(uTime * 3.1 + ph) * 0.008 * h * h;
  p.z += cos(uTime * 2.7 + ph) * 0.008 * h * h;
  vGlow = flick;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vec4 mvPosition = mv;
  #include <fog_vertex>
}`;

const FLAME_FRAG = /* glsl */ `
uniform float uIntensity;
varying float vH;
varying float vGlow;
#include <fog_pars_fragment>
void main() {
  vec3 core = vec3(1.0, 0.92, 0.7);
  vec3 tip = vec3(1.0, 0.45, 0.08);
  vec3 c = mix(core, tip, smoothstep(0.2, 1.0, vH));
  float blueBase = smoothstep(0.18, 0.0, vH);
  c = mix(c, vec3(0.3, 0.4, 1.0), blueBase * 0.5);
  gl_FragColor = vec4(c * uIntensity * vGlow, 1.0);
  #include <fog_fragment>
}`;

const HALO_VERT = /* glsl */ `
uniform float uTime;
uniform float uSize;
varying vec2 vUv;
varying float vF;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vec3 base = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  float ph = fract(sin(dot(base.xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;
  vF = 0.85 + 0.15 * sin(uTime * 9.0 + ph);
  vec4 mvPosition = viewMatrix * modelMatrix * vec4(base, 1.0);
  mvPosition.xy += position.xy * uSize * (0.9 + 0.1 * vF);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const HALO_FRAG = /* glsl */ `
uniform float uIntensity;
uniform vec3 uColor;
varying vec2 vUv;
varying float vF;
#include <fog_pars_fragment>
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float g = exp(-d * d * 5.0) * (1.0 - smoothstep(0.7, 1.0, d));
  gl_FragColor = vec4(uColor * g * uIntensity * vF, 1.0);
  #include <fog_fragment>
}`;

export class Flames {
  constructor(positions, { flameGeometry, intensity = 7, haloSize = 0.28, haloIntensity = 0.35, spare = 0 } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'flames';
    const n = positions.length + spare;
    this.growing = [];
    this.uniforms = { uTime: { value: 0 }, uIntensity: { value: intensity } };
    const mat = new THREE.ShaderMaterial({
      vertexShader: FLAME_VERT,
      fragmentShader: FLAME_FRAG,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, this.uniforms]),
      fog: true,
    });
    mat.uniforms.uTime = this.uniforms.uTime;
    mat.uniforms.uIntensity = this.uniforms.uIntensity;
    const flames = new THREE.InstancedMesh(flameGeometry, mat, n);
    const m = new THREE.Matrix4();
    positions.forEach((p, i) => {
      m.makeTranslation(p.x, p.y - 0.04, p.z);
      flames.setMatrixAt(i, m);
    });
    flames.computeBoundingSphere();
    flames.frustumCulled = false;
    this.group.add(flames);

    this.haloUniforms = { uTime: this.uniforms.uTime, uSize: { value: haloSize }, uIntensity: { value: haloIntensity }, uColor: { value: new THREE.Color(1.0, 0.62, 0.25) } };
    const hmat = new THREE.ShaderMaterial({
      vertexShader: HALO_VERT,
      fragmentShader: HALO_FRAG,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, this.haloUniforms]),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: true,
    });
    Object.assign(hmat.uniforms, this.haloUniforms);
    const halos = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), hmat, n);
    positions.forEach((p, i) => {
      m.makeTranslation(p.x, p.y + 0.02, p.z);
      halos.setMatrixAt(i, m);
    });
    halos.frustumCulled = false;
    halos.layers.set(LAYER_NO_REFLECT);
    halos.renderOrder = 5;
    this.group.add(halos);
    this.flames = flames;
    this.halos = halos;
    flames.count = halos.count = positions.length;
  }

  /** Light a new flame at runtime; it grows from a spark over a second. */
  add(p, time) {
    const i = this.flames.count;
    if (i >= this.flames.instanceMatrix.count) return false;
    this.flames.count = this.halos.count = i + 1;
    this.growing.push({ i, p: p.clone(), t0: time });
    this._place(i, p, 0.01);
    return true;
  }

  _place(i, p, s) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y - 0.04, p.z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
    this.flames.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(p.x, p.y + 0.02, p.z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    this.halos.setMatrixAt(i, s > 0.05 ? m : m.makeScale(0, 0, 0));
    this.flames.instanceMatrix.needsUpdate = true;
    this.halos.instanceMatrix.needsUpdate = true;
  }

  update(time) {
    this.uniforms.uTime.value = time;
    for (let k = this.growing.length - 1; k >= 0; k--) {
      const g = this.growing[k];
      const t = Math.min(1, (time - g.t0) / 1.1);
      // ease-out-back: overshoots a little, like a wick catching
      const u = t - 1;
      const s = 1 + 2.70158 * u * u * u + 1.70158 * u * u;
      this._place(g.i, g.p, Math.max(0.01, s));
      if (t >= 1) this.growing.splice(k, 1);
    }
  }
}

/**
 * A small pool of real point lights that follows the nearest light anchors
 * (chandeliers, candelabra, votives) so warm light pools move with the viewer.
 */
export class LightPool {
  constructor(scene, anchors, count = 6) {
    this.anchors = anchors;
    this.lights = [];
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xffb060, 0, 20, 2);
      l.castShadow = false;
      scene.add(l);
      this.lights.push({ light: l, anchor: null, level: 0 });
    }
    this._tmp = [];
    this.enabled = true;
    this.master = 1;
  }

  update(camPos, time, dt) {
    const k = 1 - Math.exp(-dt * 4);
    const sorted = this.anchors
      .map((a) => ({ a, d: a.pos.distanceToSquared(camPos) / (a.radius * a.radius) }))
      .filter((o) => o.d < 4)
      .sort((x, y) => x.d - y.d)
      .slice(0, this.lights.length)
      .map((o) => o.a);
    // keep lights already bound to a wanted anchor
    const wanted = new Set(sorted);
    for (const s of this.lights) if (s.anchor && !wanted.has(s.anchor)) s.fading = true;
    for (const a of sorted) {
      if (this.lights.some((s) => s.anchor === a && !s.fading)) continue;
      const free = this.lights.find((s) => !s.anchor || (s.fading && s.level < 0.02));
      if (free) {
        free.anchor = a;
        free.fading = false;
        free.level = 0;
        free.light.position.copy(a.pos);
        free.light.color.copy(a.color);
        free.light.distance = a.radius * 1.6;
      }
    }
    for (const s of this.lights) {
      const target = s.anchor && !s.fading && this.enabled ? 1 : 0;
      s.level += (target - s.level) * k;
      if (s.fading && s.level < 0.01) s.anchor = null;
      const a = s.anchor;
      const flick = a ? 0.9 + 0.1 * Math.sin(time * 13 + a.pos.x * 3.1) * Math.sin(time * 7.3 + a.pos.z) : 0;
      s.light.intensity = a ? a.intensity * s.level * flick * this.master : 0;
    }
  }
}
