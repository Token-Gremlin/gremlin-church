// Procedural marble floor patterns (world xz in metres). Requires NOISE_GLSL.
export const FLOOR_GLSL = /* glsl */ `
struct FloorSample { vec3 albedo; float roughness; float metal; vec2 slope; };

const vec3 F_CREAM = vec3(0.80, 0.76, 0.68);
const vec3 F_WHITE = vec3(0.90, 0.87, 0.81);
const vec3 F_GRAY  = vec3(0.50, 0.49, 0.48);
const vec3 F_LAPIS = vec3(0.016, 0.04, 0.19);
const vec3 F_GREEN = vec3(0.018, 0.07, 0.045);
const vec3 F_ROSE  = vec3(0.55, 0.30, 0.25);
const vec3 F_RED   = vec3(0.36, 0.04, 0.04);
const vec3 F_GOLD  = vec3(1.0, 0.72, 0.32);

float aaIn(float d) { float w = fwidth(d) * 0.8 + 1e-5; return 1.0 - smoothstep(-w, w, d); }

void flayer(inout FloorSample s, float m, vec3 c, float rough, float metal) {
  s.albedo = mix(s.albedo, c, m);
  s.roughness = mix(s.roughness, rough, m);
  s.metal = mix(s.metal, metal, m);
}

float sdStar(vec2 p, float r, float n, float m) {
  float an = 3.141593 / n;
  float en = 3.141593 / m;
  vec2 acs = vec2(cos(an), sin(an));
  vec2 ecs = vec2(cos(en), sin(en));
  float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
  p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs;
  p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
  return length(p) * sign(p.x);
}

vec3 veined(vec3 base, vec2 p, float seed, sampler2D dt, float amt) {
  vec4 d = texture2D(dt, p * 0.09 + vec2(seed * 7.13, seed * 3.71));
  vec4 d2 = texture2D(dt, p * 0.37 + vec2(seed * 1.3, seed * 5.9));
  base *= 0.92 + 0.12 * d.g + 0.05 * (d2.b - 0.5);
  base = mix(base, base * vec3(0.62, 0.62, 0.66), (1.0 - d.r) * amt);
  return base;
}

void tiles(inout FloorSample s, vec2 p, float size, vec3 a, vec3 b, vec3 inset, sampler2D dt, float insetR) {
  vec2 tp = p / size;
  vec2 ti = floor(tp);
  vec2 tf = fract(tp);
  float h = hash12(ti);
  vec3 base = mix(a, b, step(0.5, mod(ti.x + ti.y, 2.0)));
  base = veined(base, p, h, dt, 0.5);
  flayer(s, 1.0, base, 0.07 + 0.04 * h, 0.0);
  vec2 q = abs(tf - 0.5);
  if (insetR > 0.0) {
    float dd = ((1.0 - q.x - q.y) - insetR) * size;
    flayer(s, aaIn(dd), veined(inset, p * 1.7, h + 3.0, dt, 0.4), 0.08, 0.0);
    flayer(s, aaIn(abs(dd) - 0.014), F_GOLD, 0.18, 1.0);
  }
  float g = (0.5 - max(q.x, q.y)) * size;
  float groove = 1.0 - smoothstep(0.0, 0.005, g);
  s.albedo *= 1.0 - groove * 0.45;
  s.roughness = mix(s.roughness, 0.5, groove);
  s.slope += (hash22(ti) - 0.5) * 0.007;
}

void compassRose(inout FloorSample s, vec2 p, float R, sampler2D dt) {
  float r = length(p);
  if (r > R * 1.02) return;
  float a = atan(p.y, p.x);
  flayer(s, aaIn(r - R), veined(F_WHITE, p, 11.0, dt, 0.3), 0.07, 0.0);
  flayer(s, aaIn(abs(r - R * 0.975) - R * 0.025), F_GOLD, 0.16, 1.0);
  float ring = aaIn(abs(r - R * 0.9) - R * 0.05);
  flayer(s, ring, F_LAPIS, 0.1, 0.0);
  float seg = 6.2831853 / 40.0;
  float ai = floor(a / seg + 0.5);
  vec2 sc = vec2(cos(ai * seg), sin(ai * seg)) * R * 0.9;
  flayer(s, ring * aaIn(sdStar(p - sc, R * 0.032, 5.0, 2.4)), F_GOLD, 0.16, 1.0);
  flayer(s, aaIn(abs(r - R * 0.838) - R * 0.012), F_GOLD, 0.16, 1.0);
  // radial checker band
  float band = aaIn(abs(r - R * 0.76) - R * 0.06);
  float chk = step(0.5, fract(a / (6.2831853 / 64.0)));
  flayer(s, band, mix(F_CREAM * 0.95, F_ROSE, chk), 0.08, 0.0);
  flayer(s, aaIn(abs(r - R * 0.692) - R * 0.01), F_GOLD, 0.16, 1.0);
  // compass rays, drawn short to long
  for (int pass = 0; pass < 3; pass++) {
    for (int i = 0; i < 16; i++) {
      int cls = (i % 4 == 0) ? 2 : ((i % 2 == 0) ? 1 : 0);
      if (cls != pass) continue;
      float ang = float(i) * 6.2831853 / 16.0;
      float len = cls == 2 ? R * 0.96 : (cls == 1 ? R * 0.68 : R * 0.5);
      float wid = cls == 2 ? R * 0.13 : (cls == 1 ? R * 0.1 : R * 0.07);
      vec2 dir = vec2(cos(ang), sin(ang));
      float u = dot(p, dir);
      float v = dot(p, vec2(-dir.y, dir.x));
      float kite = max(abs(v) - wid * (1.0 - u / len), -u);
      float m = aaIn(kite);
      vec3 cA = cls == 2 ? F_GOLD : (cls == 1 ? F_LAPIS : F_ROSE);
      vec3 cB = cls == 2 ? F_WHITE : F_CREAM;
      bool dark = v > 0.0;
      flayer(s, m, dark ? cA : cB, dark && cls == 2 ? 0.16 : 0.08, dark && cls == 2 ? 1.0 : 0.0);
      flayer(s, m * aaIn(abs(v) - 0.006), F_GOLD, 0.2, 1.0);
    }
  }
  flayer(s, aaIn(r - R * 0.13), F_LAPIS, 0.1, 0.0);
  flayer(s, aaIn(sdStar(p, R * 0.1, 8.0, 3.0)), F_GOLD, 0.16, 1.0);
  flayer(s, aaIn(abs(r - R * 0.13) - 0.012), F_GOLD, 0.16, 1.0);
}

void runner(inout FloorSample s, vec2 p, float hw, float period, vec3 field, vec3 accent, sampler2D dt) {
  float bx = abs(p.x);
  if (bx > hw + 0.01) return;
  float e = hw - bx;
  flayer(s, aaIn(bx - hw), veined(field, p, 5.0, dt, 0.3), 0.08, 0.0);
  flayer(s, aaIn(e - 0.06), F_GOLD, 0.18, 1.0);
  flayer(s, aaIn(abs(e - 0.12) - 0.04), F_CREAM, 0.08, 0.0);
  flayer(s, aaIn(abs(e - 0.19) - 0.012), F_GOLD, 0.18, 1.0);
  float z = mod(p.y, period) - period * 0.5;
  vec2 q = vec2(p.x, z);
  float rr = length(q);
  flayer(s, aaIn(abs(rr - hw * 0.66) - 0.028), F_GOLD, 0.18, 1.0);
  flayer(s, aaIn(rr - hw * 0.62), veined(F_WHITE, p * 2.0, 9.0, dt, 0.2), 0.07, 0.0);
  flayer(s, aaIn(sdStar(q, hw * 0.58, 8.0, 3.2)), accent, 0.1, 0.0);
  flayer(s, aaIn(sdStar(q, hw * 0.34, 8.0, 3.2)), F_GOLD, 0.16, 1.0);
  flayer(s, aaIn(rr - hw * 0.1), F_RED, 0.1, 0.0);
  vec2 q2 = vec2(p.x, mod(p.y + period * 0.5, period) - period * 0.5);
  float dia = (abs(q2.x) * 1.4 + abs(q2.y)) - hw * 0.55;
  flayer(s, aaIn(dia), F_CREAM, 0.08, 0.0);
  flayer(s, aaIn(abs(dia) - 0.02), F_GOLD, 0.18, 1.0);
  flayer(s, aaIn(dia + hw * 0.3), accent, 0.1, 0.0);
}

FloorSample floorPattern(vec2 p, int mode, sampler2D dt) {
  FloorSample s;
  s.albedo = F_CREAM;
  s.roughness = 0.1;
  s.metal = 0.0;
  s.slope = (vec2(vnoise(p * 0.7), vnoise(p * 0.7 + 17.0)) - 0.5) * 0.004;

  if (mode == 0) {
    // Cathedral interior
    bool nave = p.y > -60.0 && p.y < 0.0;
    bool crossing = p.y <= -60.0 && p.y >= -75.0;
    bool choir = p.y < -75.0;
    bool aisle = abs(p.x) > 7.5 && nave;
    if (aisle) {
      vec2 rp = vec2(p.x + p.y, p.y - p.x) * 0.70710678;
      tiles(s, rp, 1.2, F_WHITE, F_GRAY * 1.25, F_LAPIS, dt, 0.0);
    } else {
      tiles(s, p + vec2(0.0, 0.0), 1.875, F_WHITE, F_CREAM, F_LAPIS, dt, 0.22);
    }
    if (nave && abs(p.x) < 7.2) {
      // border lines framing the nave field
      float fx = abs(abs(p.x) - 6.6);
      flayer(s, aaIn(fx - 0.18), F_LAPIS, 0.1, 0.0);
      flayer(s, aaIn(abs(fx - 0.18) - 0.015), F_GOLD, 0.18, 1.0);
      runner(s, p - vec2(0.0, 0.0), 2.1, 3.75, F_LAPIS, F_ROSE, dt);
    }
    if (crossing || (abs(p.x) > 7.5 && p.y < -60.0 && p.y > -75.0)) {
      float tx = abs(p.x);
      if (tx > 9.0) {
        compassRose(s, vec2(tx - 19.0, p.y + 67.5), 4.2, dt);
      }
      compassRose(s, p - vec2(0.0, -67.5), 7.0, dt);
    }
    if (choir) {
      runner(s, p, 2.4, 4.0, F_GREEN, F_GOLD * 0.9, dt);
      vec2 q = p - vec2(0.0, -88.0);
      float R = 5.0;
      flayer(s, aaIn(abs(length(q) - R) - 0.2), F_LAPIS, 0.1, 0.0);
      flayer(s, aaIn(abs(abs(length(q) - R) - 0.2) - 0.02), F_GOLD, 0.16, 1.0);
      for (int i = 0; i < 4; i++) {
        float a = float(i) * 1.5707963 + 0.7853981;
        vec2 c = vec2(cos(a), sin(a)) * R * 0.95;
        float rr = length(q - c) - 1.1;
        flayer(s, aaIn(rr), F_ROSE, 0.08, 0.0);
        flayer(s, aaIn(abs(rr) - 0.05), F_GOLD, 0.16, 1.0);
        flayer(s, aaIn(sdStar(q - c, 0.8, 6.0, 2.8)), F_WHITE, 0.07, 0.0);
      }
    }
  } else if (mode == 1) {
    // Exterior promenade and terraces: long slabs, cross bands, central runner
    vec2 sp = vec2(p.x / 1.6, p.y / 0.8);
    float row = floor(sp.y);
    sp.x += mod(row, 2.0) * 0.5;
    vec2 si = floor(sp);
    vec2 sf = fract(sp);
    float h = hash12(si);
    vec3 base = veined(mix(F_WHITE, F_CREAM, h * 0.6), p, h, dt, 0.35);
    flayer(s, 1.0, base, 0.05 + 0.05 * h, 0.0);
    vec2 q = min(sf, 1.0 - sf) * vec2(1.6, 0.8);
    float g = min(q.x, q.y);
    float groove = 1.0 - smoothstep(0.0, 0.006, g);
    s.albedo *= 1.0 - groove * 0.45;
    s.slope += (hash22(si) - 0.5) * 0.01;
    float bz = abs(mod(p.y + 8.0, 16.0) - 8.0);
    flayer(s, aaIn(bz - 0.35), F_LAPIS, 0.06, 0.0);
    flayer(s, aaIn(abs(bz - 0.35) - 0.03), F_GOLD, 0.15, 1.0);
    runner(s, p, 1.7, 8.0, F_ROSE * 0.9, F_LAPIS, dt);
    float ex = abs(p.x);
    if (ex > 8.2 && ex < 10.5) {
      flayer(s, aaIn(abs(ex - 9.1) - 0.5), veined(F_GRAY * 1.2, p, 2.0, dt, 0.5), 0.1, 0.0);
      flayer(s, aaIn(abs(abs(ex - 9.1) - 0.5) - 0.02), F_GOLD, 0.16, 1.0);
    }
  } else if (mode == 2) {
    // Chapels and gallery: eight-point star tiles
    float size = 1.25;
    vec2 tp = p / size;
    vec2 ti = floor(tp);
    vec2 tf = fract(tp) - 0.5;
    float h = hash12(ti);
    flayer(s, 1.0, veined(F_ROSE * 1.2, p, h, dt, 0.35), 0.09, 0.0);
    float st = sdStar(tf * size, size * 0.46, 8.0, 3.0);
    flayer(s, aaIn(st), veined(F_WHITE, p, h + 2.0, dt, 0.3), 0.07, 0.0);
    flayer(s, aaIn(abs(st) - 0.012), F_GOLD, 0.16, 1.0);
    flayer(s, aaIn(length(tf * size) - 0.12), F_LAPIS, 0.08, 0.0);
    vec2 q = abs(fract(tp) - 0.5);
    float dd = ((1.0 - q.x - q.y) - 0.18) * size;
    flayer(s, aaIn(dd), F_LAPIS, 0.08, 0.0);
    s.slope += (hash22(ti) - 0.5) * 0.006;
  } else {
    // Crypt: dark worn slabs
    tiles(s, p, 1.5, F_GRAY * 0.8, F_GRAY * 0.65, F_RED, dt, 0.16);
    s.roughness = max(s.roughness, 0.18);
  }
  return s;
}
`;
