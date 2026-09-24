import * as THREE from 'three';
import { archY, archPoints, segmentalArc, sweepPlanar, sweep, lathe, xf, TAU } from './geom.js';
import { Parts, PROFILES, finial } from './components.js';

/** k of the arch with the given rise: two-centred when rise >= span / 2, segmental when flatter. */
function kForRise(span, rise) {
  const r = (rise * rise + (span * span) / 4) / span;
  return r / span;
}

/** Inverse of archY on the right half: distance from centre where arch reaches height Y above springing. */
function archInv(Y, span, k) {
  if (k < 0.5) {
    const { R, yc } = segmentalArc(span, k);
    return Math.sqrt(Math.max(0, R * R - (Y - yc) ** 2));
  }
  const r = k * span;
  const uc = span / 2 - r;
  return uc + Math.sqrt(Math.max(0, r * r - Y * Y));
}

function gridGeometry(rows, cols, fn) {
  const pos = [];
  const uv = [];
  const edge = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const v = fn(i, j);
      pos.push(v.p.x, v.p.y, v.p.z);
      uv.push(v.u, v.v);
      edge.push(v.e);
    }
  }
  const idx = [];
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Ensure faces point downward (visible from below).
  const n = g.attributes.normal;
  let sy = 0;
  for (let i = 0; i < n.count; i++) sy += n.getY(i);
  if (sy > 0) {
    const ia = g.index.array;
    for (let i = 0; i < ia.length; i += 3) {
      const t = ia[i + 1];
      ia[i + 1] = ia[i + 2];
      ia[i + 2] = t;
    }
    g.computeVertexNormals();
  }
  return g;
}

function cumulative(fn, n) {
  const out = [0];
  let prev = fn(0);
  for (let i = 1; i <= n; i++) {
    const p = fn(i / n);
    out.push(out[i - 1] + p.distanceTo(prev));
    prev = p;
  }
  return (t) => {
    const f = t * n;
    const i = Math.min(n - 1, Math.floor(f));
    return out[i] + (out[i + 1] - out[i]) * (f - i);
  };
}

/**
 * Quadripartite rib vault over a bay. Local coords: x ∈ [−span/2, span/2], z from 0 to −len.
 * Springing y0, apex y1. Returns Parts ('vault' webbing, 'stone' ribs, 'gold' bosses).
 */
export function ribVault({ span, len, y0, y1, ribs = true, startRib = true, endRib = false, wallRibs = true, boss = true, segX = 30, segT = 10, web = 'vault' }) {
  const p = new Parts();
  const rise = y1 - y0;
  const kh = kForRise(span, rise);
  const kg = kForRise(len, rise);
  const h = (x) => y0 + archY(x, span, kh);
  const g = (d) => y0 + archY(d, len, kg); // d = offset from bay centre along z
  const dEnd = (x) => len / 2 - archInv(h(x) - y0, len, kg);
  const xCrease = (d) => archInv(g(d) - y0, span, kh);
  const xs = (i) => (-span / 2) * Math.cos((Math.PI * i) / segX);
  const arcH = cumulative((t) => new THREE.Vector3(xs(t * segX), h(xs(t * segX)), 0), segX);

  // Transverse panels at both ends
  for (const end of [0, 1]) {
    const geo = gridGeometry(segX + 1, segT + 1, (i, j) => {
      const x = xs(i);
      const de = Math.max(0, dEnd(x));
      const t = j / segT;
      const d = de * t;
      const z = end === 0 ? -d : -len + d;
      const e = Math.min(d, (de - d) * 0.75);
      return { p: new THREE.Vector3(x, h(x), z), u: arcH(i / segX), v: z, e };
    });
    p.add(web, geo);
  }
  // Wall panels on both sides
  const segZ = segX;
  const zs = (i) => -len / 2 + (len / 2) * Math.cos((Math.PI * i) / segZ);
  const arcG = cumulative((t) => new THREE.Vector3(0, g(zs(t * segZ) + len / 2), zs(t * segZ)), segZ);
  for (const side of [-1, 1]) {
    const geo = gridGeometry(segZ + 1, segT + 1, (i, j) => {
      const z = zs(i);
      const d = z + len / 2;
      const y = g(d);
      const xc = Math.max(0, xCrease(Math.abs(d)));
      const s = j / segT;
      const ax = span / 2 + (xc - span / 2) * s;
      const e = Math.min(span / 2 - ax, (ax - xc) * 0.75);
      return { p: new THREE.Vector3(side * ax, y, z), u: arcG(i / segZ), v: side * ax, e };
    });
    p.add(web, geo);
  }

  if (ribs) {
    const Z = new THREE.Vector3(0, 0, 1);
    const trans = archPoints(span, kh, 28).map((q) => new THREE.Vector3(q.x, y0 + q.y, 0));
    if (startRib) p.add('stone', sweepPlanar(PROFILES.rib, trans, Z));
    if (endRib) p.add('stone', sweepPlanar(PROFILES.rib, trans.map((v) => new THREE.Vector3(v.x, v.y, -len)), Z));
    // diagonals
    for (const sx of [-1, 1]) {
      for (const end of [0, 1]) {
        const pts = [];
        const n = 24;
        for (let i = 0; i <= n; i++) {
          const x = (span / 2) * Math.cos((i / n) * (Math.PI / 2));
          const de = Math.max(0, dEnd(x));
          const z = end === 0 ? -de : -len + de;
          pts.push(new THREE.Vector3(sx * x, h(x), z));
        }
        const up = (pt) => {
          const x = Math.abs(pt.x);
          const eps = 0.01;
          const dh = (h(Math.min(span / 2, x + eps)) - h(Math.max(0, x - eps))) / (2 * eps);
          const d = pt.z + len / 2;
          const dg = (g(Math.abs(d) + eps) - g(Math.max(0, Math.abs(d) - eps))) / (2 * eps);
          const n1 = new THREE.Vector3(-dh * Math.sign(pt.x || 1), 1, 0).normalize();
          const n2 = new THREE.Vector3(0, 1, -dg * Math.sign(d || 1)).normalize();
          return n1.add(n2).normalize();
        };
        p.add('stone', sweep(PROFILES.rib, pts, up));
      }
    }
    if (wallRibs) {
      const wall = archPoints(len, kg, 24);
      for (const side of [-1, 1]) {
        const pts = wall.map((q) => new THREE.Vector3(q.x, y0 + q.y, 0));
        const geo = sweepPlanar(PROFILES.ribSmall, pts, Z);
        xf(geo, { ry: side > 0 ? -Math.PI / 2 : Math.PI / 2 });
        xf(geo, { x: side * (span / 2), z: -len / 2 });
        p.add('stone', geo);
      }
    }
  }
  if (boss) {
    const bg = lathe([[0.001, -0.25], [0.28, -0.18], [0.42, -0.02], [0.45, 0.1]], 16);
    xf(bg, { y: y1 - 0.2, z: -len / 2 });
    p.add('gold', bg);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const leaf = new THREE.IcosahedronGeometry(0.2, 0);
      xf(leaf, { sx: 1.6, sy: 0.4, sz: 0.7 });
      xf(leaf, { x: Math.cos(a) * 0.5, y: y1 - 0.28, z: -len / 2 + Math.sin(a) * 0.5, ry: -a });
      p.add('gold', leaf);
    }
  }
  return p;
}

/**
 * Radiating vault over a polygonal apse. Centre (0,0) local, vertices on radius R at angles.
 * angles: array of vertex angles (radians, measured from +x toward −z).
 */
export function apseVault({ R, angles, y0, y1, bulge = 1.4, segS = 16, segT = 12 }) {
  const p = new Parts();
  const K = new THREE.Vector3(0, y1, 0);
  const vtx = angles.map((a) => new THREE.Vector3(Math.cos(a) * R, y0, -Math.sin(a) * R));
  for (let i = 0; i < vtx.length - 1; i++) {
    const A = vtx[i], B = vtx[i + 1];
    const side = A.distanceTo(B);
    const wallRise = Math.min(y1 - y0 - 1.5, side * 1.2);
    const kw = kForRise(side, wallRise);
    const F = (s) => {
      const x = (s - 0.5) * side;
      return A.clone().lerp(B, s).setY(y0 + archY(x, side, kw));
    };
    const geo = gridGeometry(segS + 1, segT + 1, (a, b) => {
      const s = a / segS;
      const t = b / segT;
      const f = F(s);
      const pt = f.clone().lerp(K, t);
      pt.y += Math.sin(Math.PI * t) * bulge * (0.4 + 0.6 * Math.sin(Math.PI * s));
      const eS = Math.min(s, 1 - s) * side;
      const e = Math.min(eS * (1 - t) + 2 * t, t * (y1 - y0) * 1.2);
      return { p: pt, u: s * side, v: t * 8, e: Math.max(0, Math.min(eS * (1 - t * 0.8), e + 0.4)) };
    });
    p.add('vault', geo);
    // wall rib (formeret)
    const wall = [];
    for (let j = 0; j <= 20; j++) wall.push(F(j / 20));
    const n = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3(0, 1, 0)).normalize();
    p.add('stone', sweepPlanar(PROFILES.ribSmall, wall, n));
  }
  // radiating ribs from each vertex to keystone
  for (let i = 0; i < vtx.length; i++) {
    const A = vtx[i];
    const pts = [];
    for (let j = 0; j <= 20; j++) {
      const t = j / 20;
      const pt = A.clone().lerp(K, t);
      const sEdge = i === 0 || i === vtx.length - 1 ? 0.4 : 0.0;
      pt.y += Math.sin(Math.PI * t) * bulge * (0.4 + sEdge);
      pts.push(pt);
    }
    const out = A.clone().setY(0).normalize();
    p.add('stone', sweep(PROFILES.rib, pts, (pt, j, T) => {
      const side = new THREE.Vector3().crossVectors(T, out).normalize();
      return new THREE.Vector3().crossVectors(side, T).normalize();
    }));
  }
  const bg = lathe([[0.001, -0.3], [0.35, -0.22], [0.55, -0.02], [0.6, 0.1]], 16);
  xf(bg, { y: y1 - 0.2 });
  p.add('gold', bg);
  return p;
}

export { kForRise };
