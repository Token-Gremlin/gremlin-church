import * as THREE from 'three';
import { NOISE_GLSL } from '../shaders/noise.js';
import { FLOOR_GLSL } from '../shaders/floor.js';
import { marbleDetailTexture, woodTexture, bannerTexture, goldMosaicTexture, domeTexture } from '../textures/surfaces.js';

const WORLD_VARYINGS_VERT = /* glsl */ `
varying vec3 vWPos;
varying vec3 vWNrm;
`;

const WORLD_POS_VERT = /* glsl */ `
{
  #ifdef USE_INSTANCING
    vec4 wp4 = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
    vWNrm = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
  #else
    vec4 wp4 = modelMatrix * vec4(transformed, 1.0);
    vWNrm = normalize(mat3(modelMatrix) * objectNormal);
  #endif
  vWPos = wp4.xyz;
}
`;

const TRIPLANAR_GLSL = /* glsl */ `
varying vec3 vWPos;
varying vec3 vWNrm;
uniform sampler2D uDetail;
uniform float uDetailScale;
uniform float uDetailAmt;
uniform float uVeinAmt;
uniform float uRoughAmt;
uniform vec3 uVeinColor;
vec4 triplanar(sampler2D t, vec3 p, vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  w /= (w.x + w.y + w.z);
  return texture2D(t, p.zy) * w.x + texture2D(t, p.xz) * w.y + texture2D(t, p.xy) * w.z;
}
`;

let cacheId = 0;

/** Adds world-space triplanar marble detail to a MeshStandardMaterial. */
export function withDetail(mat, detail, { scale = 0.3, amount = 0.06, veins = 0.0, veinColor = new THREE.Color(0.6, 0.58, 0.56), rough = 0.2, extraFrag = '', extraUniforms = {} } = {}) {
  const id = `detail-${cacheId++}`;
  mat.userData.uniforms = {
    uDetail: { value: detail },
    uDetailScale: { value: scale },
    uDetailAmt: { value: amount },
    uVeinAmt: { value: veins },
    uRoughAmt: { value: rough },
    uVeinColor: { value: veinColor },
    ...extraUniforms,
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${WORLD_VARYINGS_VERT}`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${WORLD_POS_VERT}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${TRIPLANAR_GLSL}`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec4 dtl = triplanar(uDetail, vWPos * uDetailScale, normalize(vWNrm));
        diffuseColor.rgb *= 1.0 + (dtl.g - 0.5) * uDetailAmt * 2.0 + (dtl.b - 0.5) * uDetailAmt;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uVeinColor, (1.0 - dtl.r) * uVeinAmt);
        ${extraFrag}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor * (1.0 + (dtl.b - 0.5) * uRoughAmt * 2.0 + (dtl.g - 0.5) * uRoughAmt), 0.03, 1.0);`,
      );
  };
  mat.customProgramCacheKey = () => id;
  return mat;
}

/**
 * Marble floor with procedural inlay patterns and planar reflection
 * injected as the specular IBL radiance.
 */
export function floorMaterial(detail, reflection, { mode = 0, roughness = 0.12, envMap = null, reflStrength = 1.0 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness, metalness: 0, envMap });
  const id = `floor-${mode}-${cacheId++}`;
  mat.userData.uniforms = {
    uDetail: { value: detail },
    uRefl: { value: reflection ? reflection.texture : null },
    uReflMatrix: { value: reflection ? reflection.textureMatrix : new THREE.Matrix4() },
    uReflStrength: { value: reflection ? reflStrength : 0 },
    uReflActive: { value: 0 },
    uFloorMode: { value: mode },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${WORLD_VARYINGS_VERT}`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${WORLD_POS_VERT}`);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWPos;
        varying vec3 vWNrm;
        uniform sampler2D uDetail;
        uniform sampler2D uRefl;
        uniform mat4 uReflMatrix;
        uniform float uReflStrength;
        uniform float uReflActive;
        uniform int uFloorMode;
        ${NOISE_GLSL}
        ${FLOOR_GLSL}`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        FloorSample fs = floorPattern(vWPos.xz, uFloorMode, uDetail);
        diffuseColor.rgb = fs.albedo;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = fs.roughness;`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        metalnessFactor = fs.metal;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          // grout grooves and slight slab unevenness
          vec3 pn = vec3(fs.slope.x, 0.0, fs.slope.y);
          normal = normalize(normal + (viewMatrix * vec4(pn, 0.0)).xyz);
        }`,
      )
      .replace(
        '#include <lights_fragment_maps>',
        `#include <lights_fragment_maps>
        #if defined( RE_IndirectSpecular )
        if (uReflActive > 0.5) {
          vec4 rc = uReflMatrix * vec4(vWPos + vec3(fs.slope.x, 0.0, fs.slope.y) * 0.6, 1.0);
          vec2 ruv = rc.xy / rc.w;
          float lod = clamp(fs.roughness * 22.0, 0.0, 6.0);
          vec3 refl = textureLod(uRefl, ruv, lod).rgb;
          float inside = step(0.0, ruv.x) * step(ruv.x, 1.0) * step(0.0, ruv.y) * step(ruv.y, 1.0);
          radiance = mix(radiance, refl * uReflStrength, inside);
        }
        #endif`,
      );
  };
  mat.customProgramCacheKey = () => id;
  return mat;
}

/** Vault webbing: deep blue painted with gold stars; ribs edge from aEdge attribute. */
export function vaultMaterial(detail) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0 });
  const id = `vault-${cacheId++}`;
  mat.userData.uniforms = { uDetail: { value: detail } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float aEdge;\nvarying float vEdge;\nvarying vec2 vPUv;\n${WORLD_VARYINGS_VERT}`)
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvEdge = aEdge;\nvPUv = uv;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${WORLD_POS_VERT}`);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying float vEdge;
        varying vec2 vPUv;
        varying vec3 vWPos;
        varying vec3 vWNrm;
        uniform sampler2D uDetail;
        ${NOISE_GLSL}
        float starMask(vec2 p, float rOut, float rIn, float n) {
          float r = length(p);
          float a = atan(p.y, p.x);
          float k = pow(abs(cos(a * n * 0.5)), 1.6);
          float rs = mix(rIn, rOut, k);
          float w = fwidth(r - rs) + 1e-4;
          return 1.0 - smoothstep(-w, w, r - rs);
        }`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec2 sp = vPUv / 1.25;
        vec2 si = floor(sp);
        vec2 sf = fract(sp) - 0.5;
        vec2 jit = (hash22(si) - 0.5) * 0.45;
        float rnd = hash12(si + 3.7);
        float st = starMask(sf - jit, 0.1 + 0.12 * rnd, 0.035 + 0.03 * rnd, rnd > 0.7 ? 4.0 : 8.0);
        st *= step(0.18, rnd);
        float haze = texture2D(uDetail, vWPos.xz * 0.05 + vWPos.y * 0.02).g;
        vec3 blue = mix(vec3(0.018, 0.045, 0.2), vec3(0.04, 0.09, 0.36), haze);
        blue = mix(blue, vec3(0.06, 0.12, 0.42), smoothstep(1.4, 0.3, vEdge) * 0.4);
        vec3 gold = vec3(1.0, 0.72, 0.3);
        vec3 cream = vec3(0.92, 0.88, 0.8);
        float b1 = 1.0 - smoothstep(0.1, 0.12, vEdge);
        float b2 = (1.0 - smoothstep(0.18, 0.2, vEdge)) * smoothstep(0.14, 0.16, vEdge);
        vec3 col = mix(blue, gold, st);
        col = mix(col, cream, b1);
        col = mix(col, gold, b2);
        float metal = max(st, b2);
        diffuseColor.rgb = col;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.8, 0.3, metal);',
      )
      .replace(
        '#include <metalnessmap_fragment>',
        '#include <metalnessmap_fragment>\nmetalnessFactor = metal;',
      );
  };
  mat.customProgramCacheKey = () => id;
  return mat;
}

const GLASS_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWPos;
varying vec3 vWNrm;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz;
  vWNrm = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const GLASS_FRAG = /* glsl */ `
uniform sampler2D map;
uniform float uIntensity;
uniform float uExtIntensity;
uniform vec3 uSunDir;
uniform float uSunBoost;
uniform vec3 uSkyColor;
uniform float uTime;
varying vec2 vUv;
varying vec3 vWPos;
varying vec3 vWNrm;
#include <fog_pars_fragment>
void main() {
  vec3 c = texture2D(map, vUv).rgb;
  vec3 n = normalize(vWNrm);
  vec3 col;
  if (gl_FrontFacing) {
    vec3 outward = -n;
    float sunF = pow(max(dot(outward, uSunDir), 0.0), 1.5);
    float lum = dot(c, vec3(0.3, 0.55, 0.15));
    col = c * (0.35 + c * 1.4) * uIntensity * (1.0 + uSunBoost * sunF);
    col += vec3(1.0, 0.85, 0.6) * smoothstep(0.55, 1.0, lum) * uIntensity * 0.6;
  } else {
    vec3 V = normalize(cameraPosition - vWPos);
    float fr = pow(1.0 - max(dot(V, n), 0.0), 4.0);
    col = c * (0.2 + c) * uExtIntensity + uSkyColor * (0.06 + 0.5 * fr);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;

export function glassMaterial(texture, { intensity = 3.2, extIntensity = 0.9, sunBoost = 0.8 } = {}) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: GLASS_VERT,
    fragmentShader: GLASS_FRAG,
    side: THREE.DoubleSide,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        map: { value: null },
        uIntensity: { value: intensity },
        uExtIntensity: { value: extIntensity },
        uSunDir: { value: new THREE.Vector3(-0.9, 0.3, 0.2).normalize() },
        uSunBoost: { value: sunBoost },
        uSkyColor: { value: new THREE.Color(0.8, 0.6, 0.6) },
        uTime: { value: 0 },
      },
    ]),
  });
  mat.uniforms.map.value = texture;
  mat.userData.castShadow = false;
  mat.userData.isGlass = true;
  return mat;
}

export function createMaterials() {
  const detail = marbleDetailTexture(512, 7);
  const M = { detail };

  M.stone = withDetail(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.86, 0.82, 0.76), roughness: 0.62, metalness: 0 }), detail, { scale: 0.22, amount: 0.07, veins: 0.06, rough: 0.25 });
  M.stoneWarm = withDetail(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.9, 0.8, 0.68), roughness: 0.6 }), detail, { scale: 0.22, amount: 0.07, veins: 0.05 });
  M.stoneShade = withDetail(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.55, 0.52, 0.5), roughness: 0.8 }), detail, { scale: 0.2, amount: 0.1 });
  M.marble = withDetail(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.92, 0.9, 0.86), roughness: 0.22, metalness: 0 }), detail, { scale: 0.45, amount: 0.05, veins: 0.3, veinColor: new THREE.Color(0.55, 0.55, 0.6), rough: 0.35 });
  M.marbleRose = withDetail(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.86, 0.68, 0.62), roughness: 0.2 }), detail, { scale: 0.5, amount: 0.08, veins: 0.35, veinColor: new THREE.Color(0.95, 0.9, 0.85), rough: 0.3 });
  M.marbleGreen = withDetail(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.08, 0.2, 0.15), roughness: 0.18 }), detail, { scale: 0.5, amount: 0.1, veins: 0.5, veinColor: new THREE.Color(2.5, 2.8, 2.6), rough: 0.3 });
  M.lapis = withDetail(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.03, 0.07, 0.3), roughness: 0.25 }), detail, { scale: 0.6, amount: 0.12, veins: 0.3, veinColor: new THREE.Color(2.2, 2.0, 1.4), rough: 0.3 });
  M.statue = withDetail(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.93, 0.91, 0.88), roughness: 0.35, metalness: 0 }), detail, { scale: 0.8, amount: 0.035, veins: 0.08, rough: 0.2 });
  M.gold = withDetail(new THREE.MeshStandardMaterial({ color: new THREE.Color(1.0, 0.74, 0.36), roughness: 0.24, metalness: 1 }), detail, { scale: 0.7, amount: 0.05, rough: 0.5 });
  M.goldMatte = withDetail(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.95, 0.7, 0.34), roughness: 0.42, metalness: 1 }), detail, { scale: 0.7, amount: 0.06, rough: 0.4 });
  M.bronze = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.55, 0.36, 0.18), roughness: 0.38, metalness: 1 });
  M.tin = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.9, 0.9, 0.92), roughness: 0.16, metalness: 1 });
  M.lanternGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 6, 4.4), side: THREE.DoubleSide });
  M.lanternGlow.userData.castShadow = false;
  M.iron = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.08, 0.075, 0.07), roughness: 0.5, metalness: 0.8 });
  M.slate = withDetail(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.2, 0.25, 0.36), roughness: 0.5, metalness: 0.2 }), detail, { scale: 0.4, amount: 0.12 });
  M.domeBlue = withDetail(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.2, 0.35, 0.62), roughness: 0.28, metalness: 0.65 }), detail, { scale: 0.3, amount: 0.08, rough: 0.3 });
  M.dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.02, 0.018, 0.02), roughness: 0.9 });
  M.vault = vaultMaterial(detail);

  const wood = woodTexture(3);
  wood.repeat.set(1, 1);
  M.wood = new THREE.MeshStandardMaterial({ map: wood, color: 0xffffff, roughness: 0.42, metalness: 0 });
  M.velvet = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.06, 0.1, 0.35), roughness: 0.8 });
  M.velvetRed = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.35, 0.03, 0.05), roughness: 0.8 });
  M.linen = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.95, 0.93, 0.88), roughness: 0.85 });

  const bannerTex = bannerTexture(0);
  M.banner = new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.75, side: THREE.DoubleSide });
  M.banner.userData.castShadow = false;
  const bannerTex2 = bannerTexture(1);
  M.bannerRed = new THREE.MeshStandardMaterial({ map: bannerTex2, roughness: 0.75, side: THREE.DoubleSide });

  const mosaic = goldMosaicTexture(5);
  mosaic.repeat.set(1, 1);
  M.goldMosaic = new THREE.MeshStandardMaterial({ map: mosaic, color: 0xffffff, roughness: 0.3, metalness: 0.85, emissive: new THREE.Color(0.25, 0.16, 0.05), emissiveMap: mosaic });

  const dome = domeTexture(11);
  M.domePaint = new THREE.MeshStandardMaterial({ map: dome, roughness: 0.5, metalness: 0.2, emissive: new THREE.Color(0.35, 0.3, 0.25), emissiveMap: dome, side: THREE.BackSide });

  M.crystal = new THREE.MeshStandardMaterial({ color: new THREE.Color(1, 0.98, 0.95), roughness: 0.02, metalness: 0.3, emissive: new THREE.Color(0.8, 0.7, 0.5), envMapIntensity: 3 });
  M.crystal.userData.castShadow = false;
  M.flame = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 5.2, 2.0) });
  M.flame.userData.castShadow = false;
  M.bulb = new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 4.6, 2.2) });
  M.bulb.userData.castShadow = false;
  M.glowWarm = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.2, 1.1) });
  M.glowWarm.userData.castShadow = false;
  M.wax = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.95, 0.9, 0.78), roughness: 0.5, emissive: new THREE.Color(0.25, 0.16, 0.06) });
  M.foliage = withDetail(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.09, 0.2, 0.07), roughness: 0.85 }), detail, { scale: 2.5, amount: 0.25 });
  M.foliageDark = withDetail(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.035, 0.09, 0.035), roughness: 0.9 }), detail, { scale: 1.6, amount: 0.3 });
  M.flowerWhite = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.95, 0.93, 0.88), roughness: 0.7, emissive: new THREE.Color(0.08, 0.07, 0.05) });
  M.flowerMix = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  M.grass = withDetail(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.12, 0.24, 0.07), roughness: 0.95 }), detail, { scale: 0.8, amount: 0.3 });
  M.soil = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.12, 0.08, 0.05), roughness: 1 });
  M.gravel = withDetail(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.72, 0.64, 0.54), roughness: 0.95 }), detail, { scale: 2.0, amount: 0.25 });
  return M;
}
