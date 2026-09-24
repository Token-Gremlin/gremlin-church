import * as THREE from 'three';

const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

function fullscreenTriangle() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  return g;
}

function pass(fragmentShader, uniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
}

const DOWNSAMPLE_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uFirst;
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;

vec3 s(vec2 o) { return texture2D(tSrc, vUv + uTexel * o).rgb; }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 karis(vec3 a, vec3 b, vec3 c, vec3 d) {
  vec3 avg = (a + b + c + d) * 0.25;
  return avg / (1.0 + luma(avg));
}

void main() {
  vec3 a = s(vec2(-2.0, 2.0)), b = s(vec2(0.0, 2.0)), c = s(vec2(2.0, 2.0));
  vec3 d = s(vec2(-2.0, 0.0)), e = s(vec2(0.0)),      f = s(vec2(2.0, 0.0));
  vec3 g = s(vec2(-2.0, -2.0)), h = s(vec2(0.0, -2.0)), i = s(vec2(2.0, -2.0));
  vec3 j = s(vec2(-1.0, 1.0)), k = s(vec2(1.0, 1.0));
  vec3 l = s(vec2(-1.0, -1.0)), m = s(vec2(1.0, -1.0));
  vec3 col;
  if (uFirst > 0.5) {
    // Karis average on the first downsample tames fireflies from tiny hot pixels.
    vec3 g0 = karis(a, b, d, e), g1 = karis(b, c, e, f), g2 = karis(d, e, g, h), g3 = karis(e, f, h, i);
    vec3 g4 = karis(j, k, l, m);
    col = g4 * 0.5 + (g0 + g1 + g2 + g3) * 0.125;
    col /= max(1.0 - luma(col), 0.05);
    float br = max(col.r, max(col.g, col.b));
    float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
    soft = soft * soft / (4.0 * uKnee + 1e-4);
    float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
    col *= contrib;
  } else {
    col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  }
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;

const UPSAMPLE_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D tCur;
uniform vec2 uTexel;
uniform float uRadius;
uniform float uWeight;
varying vec2 vUv;
void main() {
  vec2 d = uTexel * uRadius;
  vec3 s = texture2D(tSrc, vUv + vec2(-d.x, d.y)).rgb
    + 2.0 * texture2D(tSrc, vUv + vec2(0.0, d.y)).rgb
    + texture2D(tSrc, vUv + vec2(d.x, d.y)).rgb
    + 2.0 * texture2D(tSrc, vUv + vec2(-d.x, 0.0)).rgb
    + 4.0 * texture2D(tSrc, vUv).rgb
    + 2.0 * texture2D(tSrc, vUv + vec2(d.x, 0.0)).rgb
    + texture2D(tSrc, vUv + vec2(-d.x, -d.y)).rgb
    + 2.0 * texture2D(tSrc, vUv + vec2(0.0, -d.y)).rgb
    + texture2D(tSrc, vUv + vec2(d.x, -d.y)).rgb;
  gl_FragColor = vec4(texture2D(tCur, vUv).rgb + s / 16.0 * uWeight, 1.0);
}`;

const RAYMASK_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uSun;
uniform float uAspect;
uniform float uThreshold;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tScene, vUv);
  float sky = 1.0 - step(0.5, c.a);
  vec2 dv = (vUv - uSun) * vec2(uAspect, 1.0);
  float fall = exp(-dot(dv, dv) * 5.0);
  vec3 m = max(c.rgb - uThreshold, 0.0) * sky * fall;
  gl_FragColor = vec4(min(m, vec3(40.0)), 1.0);
}`;

const RAYBLUR_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uSun;
uniform float uStep;
uniform float uDecay;
varying vec2 vUv;
void main() {
  const int N = 24;
  vec2 delta = (uSun - vUv) * uStep / float(N);
  vec2 p = vUv;
  vec3 acc = vec3(0.0);
  float w = 1.0, ws = 0.0;
  for (int i = 0; i < N; i++) {
    acc += texture2D(tSrc, p).rgb * w;
    ws += w;
    w *= uDecay;
    p += delta;
  }
  gl_FragColor = vec4(acc / ws, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tRays;
uniform float uBloom;
uniform float uRays;
uniform vec3 uRayColor;
uniform float uExposure;
uniform float uSaturation;
uniform float uContrast;
uniform vec3 uLift;
uniform vec3 uGain;
uniform float uVignette;
uniform float uGrain;
uniform float uTime;
uniform float uFade;
uniform vec3 uFadeColor;
uniform vec2 uResolution;
varying vec2 vUv;

// ACES fitted (Stephen Hill)
vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 ACESFitted(vec3 color) {
  const mat3 ACESInputMat = mat3(
    0.59719, 0.07600, 0.02840,
    0.35458, 0.90834, 0.13383,
    0.04823, 0.01566, 0.83777);
  const mat3 ACESOutputMat = mat3(
     1.60475, -0.10208, -0.00327,
    -0.53108,  1.10813, -0.07276,
    -0.07367, -0.00605,  1.07602);
  color = ACESInputMat * color;
  color = RRTAndODTFit(color);
  color = ACESOutputMat * color;
  return clamp(color, 0.0, 1.0);
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 col = texture2D(tScene, vUv).rgb;
  vec3 bloom = texture2D(tBloom, vUv).rgb;
  col += bloom * uBloom;
  col += texture2D(tRays, vUv).rgb * uRays * uRayColor;
  col *= uExposure;

  // gentle highlight roll into warm white, then filmic curve
  col = ACESFitted(col * 1.05);

  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSaturation);
  col = (col - 0.5) * uContrast + 0.5;
  col = uGain * (col + uLift * (1.0 - col));
  col = clamp(col, 0.0, 1.0);

  vec2 q = vUv - 0.5;
  q.x *= uResolution.x / uResolution.y;
  float vig = smoothstep(1.25, 0.25, length(q));
  col *= mix(1.0 - uVignette, 1.0, vig);

  col = mix(col, uFadeColor, uFade);

  vec3 srgb = toSRGB(col);
  float n = hash12(gl_FragCoord.xy + fract(uTime * 7.13) * 91.7) - 0.5;
  srgb += n * uGrain + (hash12(gl_FragCoord.yx * 1.37) - 0.5) / 255.0;
  gl_FragColor = vec4(srgb, 1.0);
}`;

export class Pipeline {
  constructor(renderer) {
    this.renderer = renderer;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(fullscreenTriangle());
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);

    this.params = {
      renderScale: 1,
      samples: 4,
      bloomStrength: 0.9,
      bloomRadius: 1.0,
      bloomThreshold: 1.4,
      bloomKnee: 0.8,
      bloomLevels: 6,
      rays: 0,
      exposure: 0.92,
      saturation: 1.08,
      contrast: 1.07,
      lift: new THREE.Vector3(0.008, 0.007, 0.012),
      gain: new THREE.Vector3(1.0, 0.985, 0.95),
      vignette: 0.28,
      grain: 0.018,
    };

    this.sceneRT = null;
    this.down = [];
    this.up = [];
    this.rayA = null;
    this.rayB = null;
    this.sunUV = new THREE.Vector2(0.5, 0.5);
    this.rayColor = new THREE.Color(1.0, 0.8, 0.55);
    this.fade = 0;
    this.fadeColor = new THREE.Color(1, 0.97, 0.9);

    this.mDown = pass(DOWNSAMPLE_FRAG, {
      tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uFirst: { value: 0 },
      uThreshold: { value: 1 }, uKnee: { value: 0.5 },
    });
    this.mUp = pass(UPSAMPLE_FRAG, {
      tSrc: { value: null }, tCur: { value: null }, uTexel: { value: new THREE.Vector2() },
      uRadius: { value: 1 }, uWeight: { value: 1 },
    });
    this.mRayMask = pass(RAYMASK_FRAG, {
      tScene: { value: null }, uSun: { value: this.sunUV }, uAspect: { value: 1 }, uThreshold: { value: 2.0 },
    });
    this.mRayBlur = pass(RAYBLUR_FRAG, {
      tSrc: { value: null }, uSun: { value: this.sunUV }, uStep: { value: 1 }, uDecay: { value: 0.96 },
    });
    this.mComposite = pass(COMPOSITE_FRAG, {
      tScene: { value: null }, tBloom: { value: null }, tRays: { value: null },
      uBloom: { value: 1 }, uRays: { value: 0 }, uRayColor: { value: this.rayColor },
      uExposure: { value: 1 }, uSaturation: { value: 1 }, uContrast: { value: 1 },
      uLift: { value: new THREE.Vector3() }, uGain: { value: new THREE.Vector3(1, 1, 1) },
      uVignette: { value: 0.3 }, uGrain: { value: 0.02 }, uTime: { value: 0 },
      uFade: { value: 0 }, uFadeColor: { value: this.fadeColor }, uResolution: { value: new THREE.Vector2(1, 1) },
    });
    this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.black.needsUpdate = true;
  }

  setSize(width, height, pixelRatio) {
    this.width = width;
    this.height = height;
    this.pixelRatio = pixelRatio;
    const s = this.params.renderScale * pixelRatio;
    const w = Math.max(2, Math.round(width * s));
    const h = Math.max(2, Math.round(height * s));
    this.rw = w;
    this.rh = h;
    this.disposeTargets();
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      samples: this.params.samples,
      depthBuffer: true,
    });
    this.sceneRT.texture.generateMipmaps = false;
    let bw = w, bh = h;
    for (let i = 0; i < this.params.bloomLevels; i++) {
      bw = Math.max(1, Math.floor(bw / 2));
      bh = Math.max(1, Math.floor(bh / 2));
      const opts = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
      this.down.push(new THREE.WebGLRenderTarget(bw, bh, opts));
      this.up.push(new THREE.WebGLRenderTarget(bw, bh, opts));
    }
    const rw = Math.max(1, Math.floor(w / 4)), rh = Math.max(1, Math.floor(h / 4));
    const ropts = { type: THREE.HalfFloatType, depthBuffer: false };
    this.rayA = new THREE.WebGLRenderTarget(rw, rh, ropts);
    this.rayB = new THREE.WebGLRenderTarget(rw, rh, ropts);
  }

  disposeTargets() {
    this.sceneRT?.dispose();
    this.down.forEach((t) => t.dispose());
    this.up.forEach((t) => t.dispose());
    this.rayA?.dispose();
    this.rayB?.dispose();
    this.down = [];
    this.up = [];
  }

  blit(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
  }

  render(scene, camera, time) {
    const r = this.renderer;
    const p = this.params;
    r.setRenderTarget(this.sceneRT);
    r.clear(true, true, true);
    r.render(scene, camera);

    // Bloom mip chain
    let src = this.sceneRT.texture;
    let sw = this.rw, sh = this.rh;
    for (let i = 0; i < this.down.length; i++) {
      const u = this.mDown.uniforms;
      u.tSrc.value = src;
      u.uTexel.value.set(1 / sw, 1 / sh);
      u.uFirst.value = i === 0 ? 1 : 0;
      u.uThreshold.value = p.bloomThreshold;
      u.uKnee.value = p.bloomKnee;
      this.blit(this.mDown, this.down[i]);
      src = this.down[i].texture;
      sw = this.down[i].width;
      sh = this.down[i].height;
    }
    const n = this.down.length;
    let prev = this.down[n - 1].texture;
    for (let i = n - 2; i >= 0; i--) {
      const u = this.mUp.uniforms;
      u.tSrc.value = prev;
      u.tCur.value = this.down[i].texture;
      u.uTexel.value.set(1 / this.down[i + 1].width, 1 / this.down[i + 1].height);
      u.uRadius.value = p.bloomRadius;
      u.uWeight.value = 1.0;
      this.blit(this.mUp, this.up[i]);
      prev = this.up[i].texture;
    }

    // Sun shafts
    let rays = this.black;
    if (p.rays > 0.001) {
      const m = this.mRayMask.uniforms;
      m.tScene.value = this.sceneRT.texture;
      m.uAspect.value = this.rw / this.rh;
      this.blit(this.mRayMask, this.rayA);
      const b = this.mRayBlur.uniforms;
      b.tSrc.value = this.rayA.texture; b.uStep.value = 0.55; b.uDecay.value = 0.975;
      this.blit(this.mRayBlur, this.rayB);
      b.tSrc.value = this.rayB.texture; b.uStep.value = 0.3; b.uDecay.value = 0.97;
      this.blit(this.mRayBlur, this.rayA);
      b.tSrc.value = this.rayA.texture; b.uStep.value = 0.12; b.uDecay.value = 0.95;
      this.blit(this.mRayBlur, this.rayB);
      rays = this.rayB.texture;
    }

    const c = this.mComposite.uniforms;
    c.tScene.value = this.sceneRT.texture;
    c.tBloom.value = prev;
    c.tRays.value = rays;
    c.uBloom.value = p.bloomStrength / n;
    c.uRays.value = p.rays;
    c.uExposure.value = p.exposure;
    c.uSaturation.value = p.saturation;
    c.uContrast.value = p.contrast;
    c.uLift.value.copy(p.lift);
    c.uGain.value.copy(p.gain);
    c.uVignette.value = p.vignette;
    c.uGrain.value = p.grain;
    c.uTime.value = time;
    c.uFade.value = this.fade;
    c.uResolution.value.set(this.rw, this.rh);
    this.blit(this.mComposite, null);
  }
}
