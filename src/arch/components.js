import * as THREE from 'three';
import {
  xf, cyl, lathe, polyLathe, extrude, sweepPlanar, sweep, archPoints, archRise, TAU, hardProfile, boxMM,
} from './geom.js';
import { windowLayout, lightPolygon, foilPolygon, outerPolygon, roseLayout } from './windowLayout.js';

/** A bag of geometries keyed by material name. */
export class Parts {
  constructor() {
    this.map = {};
  }

  add(mat, geo) {
    if (!geo) return geo;
    (this.map[mat] ||= []).push(geo);
    return geo;
  }

  merge(other, matrix = null) {
    for (const [m, list] of Object.entries(other.map)) {
      for (const g of list) {
        const c = g.clone();
        if (matrix) c.applyMatrix4(matrix);
        this.add(m, c);
      }
    }
    return this;
  }

  transform(matrix) {
    for (const list of Object.values(this.map)) for (const g of list) g.applyMatrix4(matrix);
    return this;
  }

  toBatcher(batcher, zone, matrix = null, clone = false) {
    for (const [m, list] of Object.entries(this.map)) {
      for (const g of list) {
        const c = clone ? g.clone() : g;
        if (matrix) c.applyMatrix4(matrix);
        batcher.add(`${m}|${zone}`, c);
      }
    }
  }
}

/** Frame for wall-local building: a along the wall, y up, b toward the interior. */
export function frameMatrix(origin, n) {
  const up = new THREE.Vector3(0, 1, 0);
  const nn = n.clone().normalize();
  const u = new THREE.Vector3().crossVectors(up, nn).normalize();
  const m = new THREE.Matrix4().makeBasis(u, up, nn);
  m.setPosition(origin);
  return m;
}

// ---------------------------------------------------------------------------
// Offset arches (concentric archivolts)
// ---------------------------------------------------------------------------

/** Points of an arch concentric with (span,k) offset outward by d (d<0 = inward). */
export function archOffsetPoints(span, k, d, segs = 18) {
  const r = k * span;
  const cx = -span / 2 + r;
  const R = r + d;
  const cosA = THREE.MathUtils.clamp(-cx / R, -1, 1);
  const thA = Math.acos(cosA);
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const th = Math.PI + (thA - Math.PI) * (i / segs);
    pts.push(new THREE.Vector2(cx + R * Math.cos(th), R * Math.sin(th)));
  }
  pts[pts.length - 1].x = 0;
  const out = pts.slice();
  for (let i = pts.length - 2; i >= 0; i--) out.push(new THREE.Vector2(-pts[i].x, pts[i].y));
  return out;
}

/** Map 2D arch points (x along a, y up) to 3D at wall-depth b, with springing height and centre offset. */
export function archTo3D(pts, ca, springY, b = 0, leg = 0) {
  const out = pts.map((p) => new THREE.Vector3(ca + p.x, springY + p.y, b));
  if (leg > 0) {
    out.unshift(new THREE.Vector3(ca + pts[0].x, springY - leg, b));
    out.push(new THREE.Vector3(ca + pts[pts.length - 1].x, springY - leg, b));
  }
  return out;
}

/** Circular-section roll moulding along points. */
export function roll(points, radius, radial = 8) {
  const prof = [];
  for (let i = 0; i <= radial; i++) {
    const a = (i / radial) * TAU;
    prof.push([Math.cos(a) * radius, -Math.sin(a) * radius]);
  }
  return sweep(prof, points, (p, i, T) => {
    const up = new THREE.Vector3(0, 0, 1);
    if (Math.abs(T.z) > 0.9) up.set(0, 1, 0);
    return up;
  });
}

// ---------------------------------------------------------------------------
// Profiles (u = outward/up, v = depth). Clockwise around solid.
// ---------------------------------------------------------------------------

export const PROFILES = {
  // hood moulding over arches, sitting on wall face (v from 0 outward)
  hood: hardProfile([[0.34, 0], [0.34, 0.08], [0.28, 0.16], [0.16, 0.18], [0.06, 0.14], [0.0, 0.08], [0.0, 0]].map(([u, v]) => [u, v]).reverse()),
  // stringcourse along a wall
  string: hardProfile([[-0.18, 0], [-0.12, 0.1], [0.0, 0.16], [0.1, 0.14], [0.16, 0.06], [0.18, 0]]),
  cornice: hardProfile([[-0.5, 0], [-0.42, 0.12], [-0.3, 0.16], [-0.18, 0.3], [0.0, 0.45], [0.12, 0.55], [0.3, 0.55], [0.3, 0]]),
  rib: [[0.05, -0.24], [-0.22, -0.24], [-0.3, -0.16], [-0.38, -0.08], [-0.44, -0.04], [-0.46, 0], [-0.44, 0.04], [-0.38, 0.08], [-0.3, 0.16], [-0.22, 0.24], [0.05, 0.24]],
  ribSmall: [[0.04, -0.15], [-0.16, -0.15], [-0.24, -0.06], [-0.27, 0], [-0.24, 0.06], [-0.16, 0.15], [0.04, 0.15]],
  frame: hardProfile([[0.0, 0.0], [0.0, 0.1], [0.08, 0.16], [0.2, 0.16], [0.26, 0.08], [0.34, 0.06], [0.34, 0.0]]),
};

// ---------------------------------------------------------------------------
// Columns and piers
// ---------------------------------------------------------------------------

function leafRing(p, y, r, n, size, mat = 'gold') {
  const leaf = new THREE.IcosahedronGeometry(size, 0);
  xf(leaf, { sx: 0.7, sy: 1.25, sz: 0.45 });
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    p.add(mat, xf(leaf.clone(), { x: Math.cos(a) * r, y, z: Math.sin(a) * r, ry: -a + Math.PI / 2, rx: 0.35 }));
  }
}

/** Clustered gothic pier with base, shafts and foliage capital. */
export function clusteredPier({ height = 8.6, core = 0.72, shaftR = 0.17, shafts = 8, scale = 1, shaftMat = 'marble' } = {}) {
  const p = new Parts();
  const s = scale;
  const baseH = 1.0 * s;
  p.add('stone', polyLathe([[1.18 * s, 0], [1.18 * s, 0.42 * s], [1.1 * s, 0.48 * s], [1.1 * s, 0.56 * s]], 8, Math.PI / 8));
  p.add('stone', lathe([[1.04 * s, 0.56 * s], [1.08 * s, 0.62 * s], [1.06 * s, 0.7 * s], [0.98 * s, 0.74 * s], [0.95 * s, 0.8 * s], [1.0 * s, 0.86 * s], [0.96 * s, 0.94 * s], [0.9 * s, baseH]], 24));
  p.add('gold', lathe([[0.93 * s, 0.74 * s], [0.97 * s, 0.77 * s], [0.93 * s, 0.8 * s]], 24));
  const shaftH = height - baseH - 0.95 * s;
  p.add(shaftMat, cyl(core * s, core * s, shaftH, 24, 0, baseH, 0, true));
  const R = (core + shaftR * 0.55) * s;
  for (let i = 0; i < shafts; i++) {
    const a = (i / shafts) * TAU + Math.PI / shafts;
    p.add(shaftMat, cyl(shaftR * s, shaftR * s, shaftH, 10, Math.cos(a) * R, baseH, Math.sin(a) * R, true));
  }
  const cy = baseH + shaftH;
  p.add('gold', lathe([[(core + shaftR * 1.3) * s, cy - 0.02], [(core + shaftR * 1.5) * s, cy + 0.06 * s], [(core + shaftR * 1.3) * s, cy + 0.14 * s]], 24));
  p.add('stone', lathe([[(core + shaftR * 1.2) * s, cy + 0.12 * s], [(core + shaftR * 1.35) * s, cy + 0.35 * s], [(core + shaftR * 1.9) * s, cy + 0.62 * s], [(core + shaftR * 2.3) * s, cy + 0.7 * s]], 24));
  leafRing(p, cy + 0.42 * s, (core + shaftR * 1.7) * s, 16, 0.14 * s);
  leafRing(p, cy + 0.26 * s, (core + shaftR * 1.4) * s, 12, 0.11 * s, 'gold');
  p.add('stone', polyLathe([[(core + shaftR * 2.5) * s, cy + 0.7 * s], [(core + shaftR * 2.5) * s, cy + 0.85 * s], [(core + shaftR * 2.3) * s, cy + 0.95 * s]], 8, Math.PI / 8));
  return p;
}

/** Slender colonnette with base and capital. */
export function colonnette({ height = 3, r = 0.1, shaftMat = 'marble', capMat = 'gold', baseMat = 'stone', segs = 10 } = {}) {
  const p = new Parts();
  const bh = r * 2.2;
  const ch = r * 2.6;
  p.add(baseMat, lathe([[r * 1.8, 0], [r * 1.8, bh * 0.35], [r * 1.5, bh * 0.5], [r * 1.6, bh * 0.7], [r * 1.2, bh]], segs));
  p.add(shaftMat, cyl(r, r, height - bh - ch, segs, 0, bh, 0, true));
  p.add(capMat, lathe([[r * 1.05, height - ch], [r * 1.2, height - ch * 0.8], [r * 1.9, height - ch * 0.25], [r * 2.1, height - ch * 0.12], [r * 2.1, height]], segs));
  return p;
}

/** Vaulting shaft: long thin cylinder with a small capital at the top. */
export function vaultShaft(y0, y1, r = 0.14) {
  const p = new Parts();
  p.add('marble', cyl(r, r, y1 - y0 - 0.5, 10, 0, y0, 0, true));
  p.add('gold', lathe([[r * 1.1, y1 - 0.5], [r * 1.3, y1 - 0.42], [r * 1.1, y1 - 0.36]], 10));
  p.add('stone', lathe([[r * 1.05, y1 - 0.36], [r * 1.4, y1 - 0.2], [r * 2.0, y1 - 0.06], [r * 2.0, y1]], 10));
  return p;
}

// ---------------------------------------------------------------------------
// Walls
// ---------------------------------------------------------------------------

/**
 * Wall slab in the a–y plane extruded through thickness t (centred on b=0).
 * outline: array of [a,y]; holes: arrays of [a,y].
 */
export function wallSlab(outline, holes, t) {
  const shape = new THREE.Shape(outline.map(([a, y]) => new THREE.Vector2(a, y)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([a, y]) => new THREE.Vector2(a, y))));
  return extrude(shape, t, { curveSegments: 4 });
}

export function rectOutline(a0, a1, y0, y1) {
  return [[a0, y0], [a1, y0], [a1, y1], [a0, y1]];
}

/** Outline of a wall with an arched notch cut from the bottom (arcade spandrel). */
export function notchOutline(a0, a1, y0, y1, ca, span, k, segs = 18) {
  const pts = [[a0, y0], [ca - span / 2, y0]];
  for (const p of archPoints(span, k, segs)) pts.push([ca + p.x, y0 + p.y]);
  pts.push([ca + span / 2, y0], [a1, y0], [a1, y1], [a0, y1]);
  return pts;
}

/**
 * Rectangular wall outline whose bottom edge is notched by arched doorways
 * (openings that reach the floor cannot be holes, they must be part of the boundary).
 * notches: [{ ca, span, k, spring, segs }]
 */
export function outlineWithNotches(a0, a1, y0, y1, notches, segsDefault = 16) {
  const pts = [[a0, y0]];
  for (const n of [...notches].sort((p, q) => p.ca - q.ca)) {
    pts.push([n.ca - n.span / 2, y0]);
    for (const p of archPoints(n.span, n.k, n.segs || segsDefault)) pts.push([n.ca + p.x, n.spring + p.y]);
    pts.push([n.ca + n.span / 2, y0]);
  }
  pts.push([a1, y0], [a1, y1], [a0, y1]);
  return pts;
}

/** Polygon of an arched opening with legs from y0 up to the springing. */
export function archOpening(ca, y0, span, k, springY, segs = 18) {
  const pts = [[ca - span / 2, y0]];
  for (const p of archPoints(span, k, segs)) pts.push([ca + p.x, springY + p.y]);
  pts.push([ca + span / 2, y0]);
  return pts;
}

/** Pointed hood moulding + inner roll following an arch on a wall face at depth b. */
export function archivolt(p, ca, springY, span, k, b, { hoodMat = 'stone', rollMat = 'gold', rollR = 0.07, hood = true, rolls = [0.12], dir = 1, segs = 20, leg = 0 } = {}) {
  if (hood) {
    const hp = archTo3D(archOffsetPoints(span, k, 0.05, segs), ca, springY, b, leg);
    const prof = PROFILES.hood.map(([u, v]) => [u, v * dir]);
    const g = sweepPlanar(prof, hp, new THREE.Vector3(0, 0, 1), { flip: false });
    if (dir < 0) {
      const idx = g.index.array;
      for (let i = 0; i < idx.length; i += 3) {
        const t = idx[i + 1];
        idx[i + 1] = idx[i + 2];
        idx[i + 2] = t;
      }
      g.computeVertexNormals();
    }
    p.add(hoodMat, g);
  }
  for (const d of rolls) {
    const rp = archTo3D(archOffsetPoints(span, k, -d * 0.3, segs), ca, springY, b + dir * (d * 0.2), leg);
    p.add(rollMat, roll(rp, rollR, 6));
  }
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

function glassPlane(poly, W, H, grow = 0.06) {
  const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x + Math.sign(x) * grow, y < 0.01 ? y - grow : y + grow * 0.5)));
  const g = new THREE.ShapeGeometry(shape, 8);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + W / 2) / W, pos.getY(i) / H);
  return g;
}

/** Outline of a window opening grown outward by d (legs + concentric pointed head). */
export function outerPolygonOffset(W, H, k, d, segs = 20) {
  const springY = H - archRise(W, k);
  const pts = [[-W / 2 - d, 0]];
  for (const q of archOffsetPoints(W, k, d, segs)) pts.push([q.x, springY + q.y]);
  pts.push([W / 2 + d, 0]);
  return pts;
}

/**
 * Splayed jamb moulding following an opening outline, from the plane b (tracery face)
 * out to the wall face at b + dir*fd, growing outward by s.
 */
export function splay(p, outline, ca, y0, b, fd, s, dir = 1, goldRoll = true) {
  const path = outline.map(([x, y]) => new THREE.Vector3(ca + x, y0 + y, b));
  const prof = [[0, 0], [0, fd * 0.16], [s * 0.22, fd * 0.26], [s * 0.36, fd * 0.46], [s * 0.6, fd * 0.58], [s * 0.78, fd * 0.8], [s, fd * 0.84], [s, fd]];
  const g = sweepPlanar(prof.map(([u, v]) => [u, v * dir]), path, new THREE.Vector3(0, 0, 1));
  if (dir < 0) {
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = t;
    }
    g.computeVertexNormals();
  }
  p.add('stone', g);
  if (goldRoll) {
    const W = outline[outline.length - 1][0] - outline[0][0];
    const gp = outline.map(([x, y]) => new THREE.Vector3(ca + x + Math.sign(x) * s * 0.42, y0 + y + (y > 0.01 ? s * 0.42 : 0), b + dir * fd * 0.5));
    if (W > 0) p.add('gold', roll(gp, 0.035, 5));
  }
}

/**
 * Traceried gothic window in local coords: centred at a=ca, sill at y0, in the plane b.
 * Returns { parts, glass, layout, hole } where hole is the wall opening polygon.
 * The glass faces +b (interior) for its front side.
 */
export function gothicWindow({ W, H, k = 0.72, lights = 2, layout = null, ca = 0, y0 = 0, b = 0, depth = 0.28, gold = true, frame = true, wallT = 1.2, splayW = 0.3, exteriorSplay = true }) {
  const lay = layout || windowLayout(W, H, k, lights);
  const p = new Parts();
  const outer = outerPolygon(W, H, k, 22);
  const holes = [];
  for (const l of lay.lights) holes.push(lightPolygon(l, 12));
  for (const c of lay.circles) holes.push(foilPolygon(c, 48).reverse());
  const tracery = wallSlab(outer, holes, depth);
  xf(tracery, { x: ca, y: y0, z: b });
  p.add('stone', tracery);
  if (gold) {
    for (const l of lay.lights) {
      const pts = lightPolygon(l, 12).map(([x, y]) => new THREE.Vector3(ca + x, y0 + y, b + depth / 2 + 0.01));
      p.add('gold', roll(pts, 0.022, 4));
    }
    for (const c of lay.circles) {
      const pts = foilPolygon(c, 48).map(([x, y]) => new THREE.Vector3(ca + x, y0 + y, b + depth / 2 + 0.01));
      pts.push(pts[0].clone());
      p.add('gold', roll(pts, 0.022, 4));
    }
  }
  let hole = outer;
  if (frame) {
    const fd = Math.max(0.05, wallT / 2 - depth / 2);
    splay(p, outer, ca, y0, b + depth / 2, fd, splayW, 1, gold);
    if (exteriorSplay) splay(p, outer, ca, y0, b - depth / 2, fd, splayW, -1, false);
    hole = outerPolygonOffset(W, H, k, splayW);
    // sloped sill
    const sill = new THREE.Shape([new THREE.Vector2(-wallT / 2, 0), new THREE.Vector2(wallT / 2, 0), new THREE.Vector2(wallT / 2, -0.05), new THREE.Vector2(depth / 2, -0.05), new THREE.Vector2(depth / 2, 0.06), new THREE.Vector2(-depth / 2, 0.06), new THREE.Vector2(-depth / 2, -0.05), new THREE.Vector2(-wallT / 2, -0.05)]);
    const sg = extrude(sill, W + splayW * 2);
    xf(sg, { ry: Math.PI / 2 });
    xf(sg, { x: ca, y: y0, z: b });
    p.add('stone', sg);
  }
  const glass = glassPlane(outer, W, H);
  xf(glass, { x: ca, y: y0, z: b - 0.02 });
  return { parts: p, glass, layout: lay, hole: hole.map(([x, y]) => [ca + x, y0 + y]) };
}

/** Rose window: stone tracery disc with holes, glass disc, moulded rings. Centre at (ca, cy, b). */
export function roseWindow({ R, petals = 12, ca = 0, cy = 0, b = 0, depth = 0.35 }) {
  const p = new Parts();
  const lay = roseLayout(R, petals, 0.07);
  const shape = new THREE.Shape();
  shape.absarc(0, 0, R, 0, TAU, false);
  const c = new THREE.Path();
  c.absarc(0, 0, lay.center.r, 0, TAU, true);
  shape.holes.push(c);
  for (const poly of lay.petals) shape.holes.push(new THREE.Path(poly.slice().reverse().map(([x, y]) => new THREE.Vector2(x, y))));
  for (const rd of lay.roundels) {
    const h = new THREE.Path();
    h.absarc(rd.cx, rd.cy, rd.r, 0, TAU, true);
    shape.holes.push(h);
  }
  const tracery = extrude(shape, depth, { curveSegments: 10 });
  xf(tracery, { x: ca, y: cy, z: b });
  p.add('stone', tracery);
  const ringPts = (r, z, n = 96) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      pts.push(new THREE.Vector3(ca + Math.cos(a) * r, cy + Math.sin(a) * r, z));
    }
    return pts;
  };
  p.add('gold', roll(ringPts(R * 1.0, b + depth / 2 + 0.05), 0.06, 6));
  p.add('stone', roll(ringPts(R * 1.06, b + depth / 2 + 0.1), 0.16, 8));
  p.add('gold', roll(ringPts(R * 1.13, b + depth / 2 + 0.12), 0.05, 6));
  p.add('gold', roll(ringPts(lay.center.r + 0.02, b + depth / 2 + 0.02, 48), 0.04, 5));
  for (const rd of lay.roundels) {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * TAU;
      pts.push(new THREE.Vector3(ca + rd.cx + Math.cos(a) * (rd.r + 0.02), cy + rd.cy + Math.sin(a) * (rd.r + 0.02), b + depth / 2 + 0.02));
    }
    p.add('gold', roll(pts, 0.025, 4));
  }
  const glass = new THREE.CircleGeometry(R * 1.02, 64);
  const pos = glass.attributes.position;
  const uv = glass.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + R) / (2 * R), (pos.getY(i) + R) / (2 * R));
  xf(glass, { x: ca, y: cy, z: b - 0.03 });
  return { parts: p, glass };
}

// ---------------------------------------------------------------------------
// Ornament: pinnacles, spires, gables, crockets
// ---------------------------------------------------------------------------

function crocket(size) {
  const g = new THREE.IcosahedronGeometry(size, 0);
  return xf(g, { sx: 1.1, sy: 0.7, sz: 1.3 });
}

/** Finial: fleuron cross-shaped top. */
export function finial(p, x, y, z, size, mat = 'gold') {
  p.add(mat, xf(new THREE.SphereGeometry(size * 0.35, 8, 6), { x, y: y + size * 0.3, z }));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    p.add(mat, xf(crocket(size * 0.3), { x: x + Math.cos(a) * size * 0.35, y: y + size * 0.15, z: z + Math.sin(a) * size * 0.35, ry: -a }));
  }
  p.add(mat, xf(new THREE.ConeGeometry(size * 0.18, size * 1.2, 6), { x, y: y + size * 1.0, z }));
}

/** Octagonal spire with crockets and finial; base at y=0. */
export function spire(p, { r = 1, h = 8, sides = 8, crockets = 6, mat = 'stone', crocketMat = 'stone', finialMat = 'gold', finialSize = null } = {}) {
  p.add(mat, polyLathe([[r, 0], [r * 0.04, h]], sides, Math.PI / sides, false));
  const n = crockets;
  const cosHalf = Math.cos(Math.PI / sides);
  for (let e = 0; e < sides; e++) {
    const a = (e / sides) * TAU + Math.PI / sides;
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      const rr = (r * (1 - t) + r * 0.04 * t) / cosHalf;
      const s = r * 0.16 * (1 - t * 0.6);
      p.add(crocketMat, xf(crocket(s), { x: Math.cos(a) * rr, y: t * h, z: Math.sin(a) * rr, ry: -a }));
    }
  }
  finial(p, 0, h, 0, finialSize ?? r * 0.5, finialMat);
}

/** Pinnacle: square shaft with gablets and a crocketed spirelet. */
export function pinnacle({ w = 0.8, shaftH = 2.2, spireH = 3.2, mat = 'stone', gold = true } = {}) {
  const p = new Parts();
  const hw = w / 2;
  p.add(mat, polyLathe([[hw * 1.15, 0], [hw * 1.15, 0.2], [hw, 0.3], [hw, shaftH], [hw * 1.12, shaftH + 0.12], [hw * 1.12, shaftH + 0.2]], 4, Math.PI / 4));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const gab = new THREE.Shape([new THREE.Vector2(-hw, 0), new THREE.Vector2(hw, 0), new THREE.Vector2(0, w * 0.9)]);
    const g = extrude(gab, 0.08, { center: false });
    xf(g, { y: shaftH * 0.62, z: hw });
    xf(g, { ry: a });
    p.add(mat, g);
    const arch = new THREE.Shape(archPoints(w * 0.45, 0.8, 8).map((q) => new THREE.Vector2(q.x, q.y + shaftH * 0.3)));
    arch.lineTo(w * 0.225, shaftH * 0.05);
    arch.lineTo(-w * 0.225, shaftH * 0.05);
    const blind = extrude(arch, 0.02, { center: false });
    xf(blind, { z: hw });
    xf(blind, { ry: a });
    p.add('stoneShade', blind);
  }
  const sp = new Parts();
  spire(sp, { r: hw * 0.95, h: spireH, sides: 4, crockets: 4, mat, crocketMat: mat, finialMat: gold ? 'gold' : mat, finialSize: w * 0.35 });
  sp.transform(new THREE.Matrix4().makeTranslation(0, shaftH + 0.2, 0));
  p.merge(sp);
  return p;
}

/** Triangular gable (wimperg) with crockets along the rakes, in the a–y plane at depth b. */
export function gable(p, { ca = 0, y0 = 0, w = 4, h = 4, b = 0, t = 0.3, mat = 'stone', crocketMat = 'stone', finialMat = 'gold', trefoil = true }) {
  const shape = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
  if (trefoil) {
    const hole = new THREE.Path();
    hole.absarc(0, h * 0.38, Math.min(w, h) * 0.16, 0, TAU, true);
    shape.holes.push(hole);
  }
  const g = extrude(shape, t);
  xf(g, { x: ca, y: y0, z: b });
  p.add(mat, g);
  const n = Math.max(3, Math.round(Math.hypot(w / 2, h) / 0.7));
  for (const s of [-1, 1]) {
    for (let i = 1; i < n; i++) {
      const tt = i / n;
      p.add(crocketMat, xf(crocket(0.14 + w * 0.012), { x: ca + s * (w / 2) * (1 - tt), y: y0 + h * tt + 0.08, z: b }));
    }
  }
  finial(p, ca, y0 + h, b, 0.35 + w * 0.03, finialMat);
}

// ---------------------------------------------------------------------------
// Balustrades (instanced balusters)
// ---------------------------------------------------------------------------

export function balusterGeometry(h = 0.72) {
  const prof = [[0.07, 0], [0.07, 0.06], [0.05, 0.08], [0.055, 0.14], [0.09, 0.28], [0.08, 0.36], [0.045, 0.46], [0.04, 0.52], [0.06, 0.56], [0.045, 0.6], [0.07, 0.62], [0.07, 0.66]];
  const g = lathe(prof.map(([r, y]) => [r * (h / 0.66), y * (h / 0.66)]), 10);
  return g;
}

/**
 * Adds a straight balustrade from (x0,z0) to (x1,z1) at floor height y.
 * Rails/plinth go to the batcher parts; baluster transforms are pushed to `instances`.
 */
export function balustrade(p, instances, x0, z0, x1, z1, y, { h = 0.95, spacing = 0.26, railMat = 'stone', railW = 0.24, posts = 3.2, gold = false } = {}) {
  const dx = x1 - x0, dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  const ang = Math.atan2(dz, dx);
  const plinthH = 0.14;
  const railH = 0.14;
  const mk = (w, hh, yy) => {
    const g = new THREE.BoxGeometry(len, hh, w);
    xf(g, { x: len / 2, y: yy + hh / 2 });
    xf(g, { ry: -ang });
    xf(g, { x: x0, y, z: z0 });
    return g;
  };
  p.add(railMat, mk(railW * 1.05, plinthH, 0));
  p.add(railMat, mk(railW * 1.2, railH, h - railH));
  if (gold) p.add('gold', mk(railW * 1.22, 0.025, h - railH - 0.03));
  const balH = h - plinthH - railH;
  const n = Math.max(1, Math.floor(len / spacing));
  const postEvery = Math.max(2, Math.round(posts / spacing));
  for (let i = 0; i <= n; i++) {
    const t = (i + 0.0) / n;
    const x = x0 + dx * t, z = z0 + dz * t;
    if (i % postEvery === 0) {
      const post = new THREE.BoxGeometry(railW * 1.35, h + 0.08, railW * 1.35);
      xf(post, { x, y: y + (h + 0.08) / 2, z, ry: -ang });
      p.add(railMat, post);
      continue;
    }
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y + plinthH, z), new THREE.Quaternion(), new THREE.Vector3(1, balH / 0.72, 1));
    instances.push(m);
  }
}

/** Straight moulding along a polyline in plan at height y (profile u = up, v = outward). */
export function mouldingAlong(points2D, y, profile, closed = false) {
  const pts = points2D.map(([x, z]) => new THREE.Vector3(x, y, z));
  // Rotate so that the planar sweep plane normal is +Y: path lies in the horizontal plane.
  const prof = profile.map(([u, v]) => [v, u]);
  return sweepPlanar(prof, pts, new THREE.Vector3(0, 1, 0), { closed });
}

export { boxMM };
