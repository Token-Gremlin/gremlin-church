import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

export const TAU = Math.PI * 2;

/** Seeded PRNG (mulberry32). */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Apply a transform to a geometry in place. */
export function xf(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, sx = s, sy = s, sz = s, order = 'XYZ' } = {}) {
  _e.set(rx, ry, rz, order);
  _q.setFromEuler(_e);
  _v.set(x, y, z);
  _s.set(sx, sy, sz);
  _m.compose(_v, _q, _s);
  geo.applyMatrix4(_m);
  return geo;
}

export function mat4({ x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, sx = s, sy = s, sz = s } = {}) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.clone(), new THREE.Vector3(sx, sy, sz));
}

export function box(w, h, d, x = 0, y = 0, z = 0, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  return xf(g, { x, y, z, ry });
}

/** Box given by min/max corners. */
export function boxMM(x0, y0, z0, x1, y1, z1) {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  return xf(g, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 });
}

export function cyl(rTop, rBot, h, seg = 16, x = 0, y = 0, z = 0, open = false) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open);
  return xf(g, { x, y: y + h / 2, z });
}

// ---------------------------------------------------------------------------
// Pointed arches
// ---------------------------------------------------------------------------

/**
 * Below k = 0.5 an arch is segmental: a single arc through both springers whose centre lies
 * below the springing line, with rise = span * sqrt(k - 1/4), so the rise stays continuous with
 * the two-centred family at the semicircle.
 */
export function segmentalArc(span, k) {
  const rise = span * Math.sqrt(Math.max(1e-6, k - 0.25));
  const R = (rise * rise + (span * span) / 4) / (2 * rise);
  return { rise, R, yc: rise - R };
}

/** Rise of a two-centred arch of given span. k = radius / span (0.5 = semicircle). */
export function archRise(span, k) {
  if (k < 0.5) return segmentalArc(span, k).rise;
  const r = k * span;
  return Math.sqrt(Math.max(0, r * r - (r - span / 2) ** 2));
}

/** Height of the arch intrados at horizontal offset x from its centre. */
export function archY(x, span, k) {
  const ax = Math.abs(x);
  if (ax >= span / 2) return 0;
  if (k < 0.5) {
    const { R, yc } = segmentalArc(span, k);
    return Math.max(0, yc + Math.sqrt(Math.max(0, R * R - ax * ax)));
  }
  const r = k * span;
  const c = span / 2 - r; // centre of the opposite arc (x of centre for the right half is -(r - span/2))
  const dx = ax - c;
  return Math.sqrt(Math.max(0, r * r - dx * dx));
}

/**
 * Points (Vector2) along a pointed arch from the left springer (−span/2, 0)
 * through the apex to the right springer. Optional straight legs below the springing.
 */
export function archPoints(span, k, segs = 16, leg = 0) {
  const pts = [];
  if (leg > 0) pts.push(new THREE.Vector2(-span / 2, -leg));
  if (k < 0.5) {
    const { R, yc } = segmentalArc(span, k);
    const th0 = Math.atan2(-yc, -span / 2);
    for (let i = 0; i <= segs; i++) {
      const th = th0 + (Math.PI / 2 - th0) * (i / segs);
      pts.push(new THREE.Vector2(R * Math.cos(th), yc + R * Math.sin(th)));
    }
  } else {
    const r = k * span;
    const cx = -span / 2 + r; // centre of left arc
    const cosA = THREE.MathUtils.clamp((0 - cx) / r, -1, 1);
    const thA = Math.acos(cosA);
    for (let i = 0; i <= segs; i++) {
      const th = Math.PI + (thA - Math.PI) * (i / segs);
      pts.push(new THREE.Vector2(cx + r * Math.cos(th), r * Math.sin(th)));
    }
  }
  const right = [];
  for (let i = pts.length - 2; i >= 0; i--) right.push(new THREE.Vector2(-pts[i].x, pts[i].y));
  pts[pts.length - 1].x = 0;
  return pts.concat(right);
}

/** Closed THREE.Shape of an arched opening (rectangle below springing + pointed head). */
export function archShape(span, k, legHeight, segs = 16, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  const pts = archPoints(span, k, segs);
  s.moveTo(cx - span / 2, cy - legHeight);
  for (const p of pts) s.lineTo(cx + p.x, cy + p.y);
  s.lineTo(cx + span / 2, cy - legHeight);
  s.closePath();
  return s;
}

export function archPath(span, k, legHeight, segs = 16, cx = 0, cy = 0) {
  const p = new THREE.Path();
  const pts = archPoints(span, k, segs);
  p.moveTo(cx - span / 2, cy - legHeight);
  for (const q of pts) p.lineTo(cx + q.x, cy + q.y);
  p.lineTo(cx + span / 2, cy - legHeight);
  p.closePath();
  return p;
}

export function circlePath(cx, cy, r, segs = 32, clockwise = true) {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, TAU, clockwise);
  return p;
}

// ---------------------------------------------------------------------------
// Sweeps
// ---------------------------------------------------------------------------

/**
 * Duplicate every point so each profile segment gets flat (hard-edged) shading.
 */
export function hardProfile(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    out.push(pts[i]);
    if (i > 0 && i < pts.length - 1) out.push(pts[i]);
  }
  return out;
}

function buildGrid(positions, uvs, rows, cols, closedRows = false) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  const idx = [];
  const rr = closedRows ? rows : rows - 1;
  for (let i = 0; i < rr; i++) {
    const i2 = (i + 1) % rows;
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j, b = i * cols + j + 1, c = i2 * cols + j, d = i2 * cols + j + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Sweep a 2D profile along a planar polyline with mitred joints.
 * profile: [[u, v], ...] where u offsets along the in-plane normal (left of travel), v along planeNormal.
 */
export function sweepPlanar(profile, path, planeNormal = new THREE.Vector3(0, 0, 1), { closed = false, flip = false } = {}) {
  const P = path.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(p.x, p.y, 0)));
  const n = P.length;
  const B = planeNormal.clone().normalize();
  const pos = [];
  const uvs = [];
  let along = 0;
  const profLen = [0];
  for (let j = 1; j < profile.length; j++) {
    profLen.push(profLen[j - 1] + Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]));
  }
  const segDir = [];
  for (let i = 0; i < n - 1; i++) segDir.push(P[i + 1].clone().sub(P[i]).normalize());
  if (closed) segDir.push(P[0].clone().sub(P[n - 1]).normalize());
  for (let i = 0; i < n; i++) {
    let dPrev, dNext;
    if (closed) {
      dPrev = segDir[(i - 1 + n) % n];
      dNext = segDir[i % segDir.length];
    } else {
      dPrev = segDir[Math.max(0, i - 1)];
      dNext = segDir[Math.min(n - 2, i)];
    }
    const T = dPrev.clone().add(dNext).normalize();
    if (T.lengthSq() < 1e-8) T.copy(dNext);
    const N = new THREE.Vector3().crossVectors(B, T).normalize();
    const Nseg = new THREE.Vector3().crossVectors(B, dNext).normalize();
    const miter = 1 / Math.max(0.25, N.dot(Nseg));
    if (i > 0) along += P[i].distanceTo(P[i - 1]);
    for (let j = 0; j < profile.length; j++) {
      const [u, v] = profile[j];
      const q = P[i].clone().addScaledVector(N, (flip ? -u : u) * miter).addScaledVector(B, v);
      pos.push(q.x, q.y, q.z);
      uvs.push(profLen[j], along);
    }
  }
  const g = buildGrid(pos, uvs, n, profile.length, closed);
  if (flip) flipFaces(g);
  return g;
}

/**
 * General sweep along 3D points using an "up" hint per point (profile u along up, v along side).
 */
export function sweep(profile, points, upFn = () => new THREE.Vector3(0, 1, 0), { closed = false } = {}) {
  const n = points.length;
  const pos = [];
  const uvs = [];
  let along = 0;
  const profLen = [0];
  for (let j = 1; j < profile.length; j++) {
    profLen.push(profLen[j - 1] + Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]));
  }
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(n - 1, i + 1)];
    const T = b.clone().sub(a).normalize();
    const up = upFn(points[i], i, T).clone();
    const N = up.sub(T.clone().multiplyScalar(up.dot(T))).normalize();
    const S = new THREE.Vector3().crossVectors(T, N).normalize();
    if (i > 0) along += points[i].distanceTo(points[i - 1]);
    for (let j = 0; j < profile.length; j++) {
      const [u, v] = profile[j];
      const q = points[i].clone().addScaledVector(N, u).addScaledVector(S, v);
      pos.push(q.x, q.y, q.z);
      uvs.push(profLen[j], along);
    }
  }
  return buildGrid(pos, uvs, n, profile.length, closed);
}

export function flipFaces(g) {
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) {
    const t = idx[i + 1];
    idx[i + 1] = idx[i + 2];
    idx[i + 2] = t;
  }
  g.index.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Tube along points with circular cross-section. */
export function tube(points, radius = 0.05, radial = 6, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed);
  return new THREE.TubeGeometry(curve, Math.max(4, points.length * 4), radius, radial, closed);
}

// ---------------------------------------------------------------------------
// Lathes
// ---------------------------------------------------------------------------

/** Smooth lathe. profile: [[r, y], ...] from bottom to top. */
export function lathe(profile, segs = 24, phiStart = 0, phiLength = TAU) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y));
  return new THREE.LatheGeometry(pts, segs, phiStart, phiLength);
}

/**
 * Sharp-edged polygonal lathe (square pedestals, octagonal spires...).
 * profile: [[r, y], ...] where r is the apothem (distance to face).
 */
export function polyLathe(profile, sides = 4, phase = Math.PI / 4, capTop = true, capBottom = false) {
  const pos = [];
  const uvs = [];
  const idx = [];
  const cosHalf = Math.cos(Math.PI / sides);
  for (let s = 0; s < sides; s++) {
    const a0 = phase + (s / sides) * TAU;
    const a1 = phase + ((s + 1) / sides) * TAU;
    const base = pos.length / 3;
    let v = 0;
    for (let j = 0; j < profile.length; j++) {
      const [r, y] = profile[j];
      const R = r / cosHalf;
      if (j > 0) v += Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]);
      const side = 2 * R * Math.sin(Math.PI / sides);
      pos.push(Math.cos(a0) * R, y, Math.sin(a0) * R, Math.cos(a1) * R, y, Math.sin(a1) * R);
      uvs.push(0, v, side, v);
    }
    for (let j = 0; j < profile.length - 1; j++) {
      const a = base + j * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d);
    }
  }
  const addCap = (j, up) => {
    const [r, y] = profile[j];
    if (r < 1e-4) return;
    const R = r / cosHalf;
    const c = pos.length / 3;
    pos.push(0, y, 0);
    uvs.push(0, 0);
    for (let s = 0; s <= sides; s++) {
      const a = phase + (s / sides) * TAU;
      pos.push(Math.cos(a) * R, y, Math.sin(a) * R);
      uvs.push(Math.cos(a) * R, Math.sin(a) * R);
    }
    for (let s = 0; s < sides; s++) {
      if (up) idx.push(c, c + s + 2, c + s + 1);
      else idx.push(c, c + s + 1, c + s + 2);
    }
  };
  if (capTop) addCap(profile.length - 1, true);
  if (capBottom) addCap(0, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  return ng;
}

/** Extrude a shape along +z by depth, optionally centred. */
export function extrude(shape, depth, { bevel = 0, bevelSegs = 1, curveSegments = 12, center = true } = {}) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: bevelSegs,
    curveSegments,
  });
  if (center) g.translate(0, 0, -depth / 2);
  return g;
}

// ---------------------------------------------------------------------------
// Batching
// ---------------------------------------------------------------------------

function normalizeGeometry(g) {
  let geo = g;
  if (!geo.index) {
    const n = geo.attributes.position.count;
    const idx = new Uint32Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (!geo.attributes.uv) {
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  }
  geo.clearGroups();
  return geo;
}

/**
 * Collects geometries by key (material + zone) and merges each bucket into one mesh.
 */
export class Batcher {
  constructor() {
    this.buckets = new Map();
  }

  add(key, geometry, matrix = null) {
    if (!geometry) return;
    const g = normalizeGeometry(geometry);
    if (matrix) g.applyMatrix4(matrix);
    let b = this.buckets.get(key);
    if (!b) this.buckets.set(key, (b = []));
    b.push(g);
  }

  /** Add a geometry with transform params, cloning so the source can be reused. */
  addClone(key, geometry, params) {
    const g = geometry.clone();
    if (params) xf(g, params);
    this.add(key, g);
  }

  merge(key) {
    const list = this.buckets.get(key);
    if (!list || !list.length) return null;
    const names = new Set();
    for (const g of list) for (const n of Object.keys(g.attributes)) names.add(n);
    for (const g of list) {
      for (const n of names) {
        if (!g.attributes[n]) {
          const ref = list.find((o) => o.attributes[n]).attributes[n];
          g.setAttribute(n, new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * ref.itemSize), ref.itemSize));
        }
      }
      for (const n of Object.keys(g.morphAttributes)) delete g.morphAttributes[n];
    }
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    return merged;
  }

  /**
   * materials: map from material name (key prefix before '|') to THREE.Material.
   * Returns a Group of meshes.
   */
  build(materials, { castShadow = true, receiveShadow = true, name = 'batch' } = {}) {
    const group = new THREE.Group();
    group.name = name;
    for (const key of this.buckets.keys()) {
      const matName = key.split('|')[0];
      const mat = materials[matName];
      if (!mat) {
        console.warn('Batcher: missing material', matName);
        continue;
      }
      const geo = this.merge(key);
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = key;
      mesh.castShadow = castShadow && mat.userData.castShadow !== false;
      mesh.receiveShadow = receiveShadow;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      group.add(mesh);
    }
    this.buckets.clear();
    return group;
  }
}
