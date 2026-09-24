import * as THREE from 'three';
import { NOISE_GLSL } from '../shaders/noise.js';

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform float uTime;
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uBelt;
uniform vec3 uSunGlow;
uniform vec3 uCloudLit;
uniform vec3 uCloudShadow;
uniform float uCover;
uniform float uCloudOpacity;
uniform float uNight;
uniform float uEnvMode;
uniform vec3 uGround;
varying vec3 vDir;

float cloudField(vec2 p) {
  float base = fbm(p);
  float detail = fbm(p * 3.1 + 5.0);
  return base * 0.78 + detail * 0.32;
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float hp = max(h, 0.0);

  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.32, hp));
  col = mix(col, uZenith, smoothstep(0.12, 0.95, hp));

  float cosT = dot(d, uSunDir);
  float cs = max(cosT, 0.0);
  float horizonBand = exp(-hp * 3.5);
  col += uSunGlow * (pow(cs, 3.0) * 0.55 * horizonBand + pow(cs, 24.0) * 1.6 + pow(cs, 350.0) * 9.0);
  float anti = 1.0 - (cosT * 0.5 + 0.5);
  col = mix(col, uBelt, anti * exp(-abs(h - 0.07) * 10.0) * 0.55);

  // stars and moon for the night mood
  if (uNight > 0.001) {
    vec3 sp = d * 220.0;
    vec3 cell = floor(sp);
    float r = hash13(cell);
    if (r > 0.992 && h > -0.02) {
      vec3 c = cell + 0.5 + (vec3(hash13(cell + 1.3), hash13(cell + 2.7), hash13(cell + 4.1)) - 0.5) * 0.6;
      float sd = length(sp - c);
      float tw = 0.65 + 0.35 * sin(uTime * (1.5 + r * 5.0) + r * 60.0);
      float b = smoothstep(0.22, 0.0, sd) * (r - 0.992) * 125.0 * tw;
      vec3 sc = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.9, 0.75), hash13(cell + 9.1));
      col += sc * b * 2.2 * uNight * smoothstep(-0.02, 0.15, h);
    }
    // faint milky band
    float band = exp(-pow(dot(d, normalize(vec3(0.35, 0.55, -0.76))), 2.0) * 14.0);
    col += vec3(0.25, 0.28, 0.45) * band * fbm(d.xz * 9.0 + d.y * 4.0) * 0.18 * uNight;
    float cm = dot(d, uMoonDir);
    col += vec3(0.85, 0.9, 1.0) * smoothstep(0.99955, 0.9997, cm) * 14.0 * uNight;
    col += vec3(0.30, 0.38, 0.6) * pow(max(cm, 0.0), 60.0) * 0.8 * uNight;
    col += vec3(0.16, 0.2, 0.36) * pow(max(cm, 0.0), 6.0) * 0.25 * uNight;
  }

  col += uSunGlow * smoothstep(0.99962, 0.99978, cosT) * 60.0 * (1.0 - uNight);

  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.1);
    vec2 wind = vec2(uTime * 0.0045, uTime * 0.0016);
    vec2 p = uv * 0.85 + wind;
    float n = cloudField(p);
    float cov = smoothstep(uCover, uCover + 0.3, n);
    vec3 lightDir = normalize(mix(uSunDir, uMoonDir, uNight));
    vec2 sdir = normalize(lightDir.xz + 1e-4) * 0.07;
    float n2 = cloudField(p + sdir);
    float lit = clamp(0.5 + (n - n2) * 3.2, 0.0, 1.0);
    vec3 cc = mix(uCloudShadow, uCloudLit, lit);
    float lc = max(dot(d, lightDir), 0.0);
    float edge = cov * (1.0 - cov) * 4.0;
    cc += uSunGlow * (edge * pow(lc, 3.0) * 1.4 + pow(lc, 10.0) * 1.1 * cov) * (1.0 - uNight * 0.8);
    // high thin cirrus streaks
    float ci = fbm(vec2(uv.x * 0.35 + uTime * 0.002, uv.y * 2.2) * 1.3);
    float cir = smoothstep(0.55, 0.85, ci) * 0.35 * smoothstep(0.05, 0.4, h);
    col = mix(col, uCloudLit * 1.1 + uSunGlow * pow(lc, 6.0), cir * uCloudOpacity);
    float fade = smoothstep(0.015, 0.22, h);
    col = mix(col, cc, cov * fade * uCloudOpacity);
  }

  if (uEnvMode > 0.5 && h < 0.0) {
    col = mix(col, uGround, smoothstep(0.0, -0.08, h));
  } else if (h < 0.0) {
    col = mix(col, uHorizon * 0.8, smoothstep(0.0, -0.3, h));
  }

  gl_FragColor = vec4(col, 0.0);
}`;

const DUSK = {
  zenith: new THREE.Color(0.105, 0.15, 0.40),
  mid: new THREE.Color(0.62, 0.42, 0.62),
  horizon: new THREE.Color(1.55, 0.86, 0.50),
  belt: new THREE.Color(0.78, 0.46, 0.66),
  sunGlow: new THREE.Color(1.9, 1.02, 0.46),
  cloudLit: new THREE.Color(1.75, 1.05, 0.72),
  cloudShadow: new THREE.Color(0.42, 0.33, 0.52),
  ground: new THREE.Color(0.16, 0.13, 0.11),
  cover: 0.5,
};

const NIGHT = {
  zenith: new THREE.Color(0.006, 0.01, 0.035),
  mid: new THREE.Color(0.018, 0.026, 0.075),
  horizon: new THREE.Color(0.06, 0.07, 0.16),
  belt: new THREE.Color(0.05, 0.05, 0.12),
  sunGlow: new THREE.Color(0.05, 0.05, 0.09),
  cloudLit: new THREE.Color(0.1, 0.12, 0.2),
  cloudShadow: new THREE.Color(0.02, 0.025, 0.05),
  ground: new THREE.Color(0.01, 0.012, 0.02),
  cover: 0.56,
};

export class Sky {
  constructor() {
    this.sunDir = new THREE.Vector3(-0.9, 0.16, 0.26).normalize();
    this.moonDir = new THREE.Vector3(0.45, 0.42, -0.78).normalize();
    this.uniforms = {
      uSunDir: { value: this.sunDir },
      uMoonDir: { value: this.moonDir },
      uTime: { value: 0 },
      uZenith: { value: DUSK.zenith.clone() },
      uMid: { value: DUSK.mid.clone() },
      uHorizon: { value: DUSK.horizon.clone() },
      uBelt: { value: DUSK.belt.clone() },
      uSunGlow: { value: DUSK.sunGlow.clone() },
      uCloudLit: { value: DUSK.cloudLit.clone() },
      uCloudShadow: { value: DUSK.cloudShadow.clone() },
      uCover: { value: DUSK.cover },
      uCloudOpacity: { value: 0.95 },
      uNight: { value: 0 },
      uEnvMode: { value: 0 },
      uGround: { value: DUSK.ground.clone() },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 64, 32), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.name = 'sky';
  }

  setNight(t) {
    const u = this.uniforms;
    u.uNight.value = t;
    const lerp = (key, a, b) => u[key].value.copy(a).lerp(b, t);
    lerp('uZenith', DUSK.zenith, NIGHT.zenith);
    lerp('uMid', DUSK.mid, NIGHT.mid);
    lerp('uHorizon', DUSK.horizon, NIGHT.horizon);
    lerp('uBelt', DUSK.belt, NIGHT.belt);
    lerp('uSunGlow', DUSK.sunGlow, NIGHT.sunGlow);
    lerp('uCloudLit', DUSK.cloudLit, NIGHT.cloudLit);
    lerp('uCloudShadow', DUSK.cloudShadow, NIGHT.cloudShadow);
    lerp('uGround', DUSK.ground, NIGHT.ground);
    u.uCover.value = THREE.MathUtils.lerp(DUSK.cover, NIGHT.cover, t);
  }

  update(time) {
    this.uniforms.uTime.value = time;
  }

  /** Renders the sky into a PMREM environment map for image based lighting. */
  buildEnvironment(renderer, pmrem) {
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(this.mesh.geometry, this.material);
    scene.add(mesh);
    this.uniforms.uEnvMode.value = 1;
    const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
    const cubeCam = new THREE.CubeCamera(0.1, 1000, cubeRT);
    cubeCam.update(renderer, scene);
    this.uniforms.uEnvMode.value = 0;
    const env = pmrem.fromCubemap(cubeRT.texture);
    cubeRT.dispose();
    return env.texture;
  }
}
