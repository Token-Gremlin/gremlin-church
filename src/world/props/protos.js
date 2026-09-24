import * as THREE from 'three';
import { Parts, colonnette, pinnacle, finial } from '../../arch/components.js';
import { xf, cyl, lathe, polyLathe, extrude, TAU, rng, archPoints, sweep } from '../../arch/geom.js';

// ---------------------------------------------------------------------------
// Pew
// ---------------------------------------------------------------------------
export function pewParts(len = 4.0) {
  const p = new Parts();
  p.add('wood', xf(new THREE.BoxGeometry(len, 0.06, 0.44), { y: 0.45, z: 0.02 }));
  p.add('wood', xf(new THREE.BoxGeometry(len, 0.55, 0.05), { y: 0.78, z: 0.26, rx: -0.12 }));
  p.add('wood', xf(new THREE.BoxGeometry(len, 0.12, 0.28), { y: 1.0, z: 0.36 }));
  p.add('wood', xf(new THREE.BoxGeometry(len, 0.3, 0.03), { y: 0.3, z: -0.2 }));
  p.add('wood', xf(new THREE.BoxGeometry(len, 0.08, 0.22), { y: 0.14, z: 0.55 }));
  p.add('gold', xf(new THREE.BoxGeometry(len, 0.02, 0.03), { y: 1.065, z: 0.49 }));
  // carved end panels
  const endShape = new THREE.Shape();
  endShape.moveTo(-0.32, 0);
  endShape.lineTo(0.52, 0);
  endShape.lineTo(0.52, 1.0);
  endShape.quadraticCurveTo(0.5, 1.12, 0.36, 1.12);
  endShape.lineTo(0.1, 1.12);
  endShape.quadraticCurveTo(-0.05, 1.12, -0.12, 0.95);
  endShape.lineTo(-0.3, 0.6);
  endShape.quadraticCurveTo(-0.34, 0.5, -0.32, 0.4);
  endShape.closePath();
  const hole = new THREE.Path();
  const ap = archPoints(0.3, 0.8, 8);
  hole.moveTo(0.1 - 0.15, 0.25);
  for (const q of ap) hole.lineTo(0.1 + q.x, 0.62 + q.y);
  hole.lineTo(0.1 + 0.15, 0.25);
  hole.closePath();
  endShape.holes.push(hole);
  const endGeo = extrude(endShape, 0.07, { bevel: 0.012, curveSegments: 6 });
  for (const s of [-1, 1]) {
    p.add('wood', xf(endGeo.clone(), { ry: -Math.PI / 2, x: s * (len / 2 + 0.035) }));
    const gp = xf(new THREE.BoxGeometry(0.02, 0.36, 0.26), { x: s * (len / 2 + 0.075), y: 0.62, z: 0.1 });
    p.add('gold', gp);
    p.add('gold', xf(new THREE.SphereGeometry(0.045, 10, 8), { x: s * (len / 2 + 0.035), y: 1.14, z: 0.23 }));
  }
  return p;
}

// ---------------------------------------------------------------------------
// Candles and flames
// ---------------------------------------------------------------------------
export function flameGeometry() {
  const g = lathe([[0.001, 0], [0.018, 0.02], [0.022, 0.045], [0.014, 0.08], [0.001, 0.12]], 8);
  return g;
}

export function candleParts(h = 0.3, r = 0.03) {
  const p = new Parts();
  p.add('wax', cyl(r, r, h, 10));
  return p;
}

// ---------------------------------------------------------------------------
// Chandelier (tiered, crystal)
// ---------------------------------------------------------------------------
export function chandelierParts(seed = 1, scale = 1) {
  const p = new Parts();
  const r = rng(seed);
  const s = scale;
  const flames = [];
  p.add('gold', lathe([[0.001, -0.3], [0.1, -0.25], [0.16, -0.1], [0.08, 0.0], [0.06, 0.4], [0.12, 0.55], [0.06, 0.7], [0.05, 1.3], [0.1, 1.45], [0.05, 1.6], [0.04, 2.3], [0.08, 2.4], [0.02, 2.5]].map(([a, b]) => [a * s, b * s]), 14));
  const tiers = [{ y: 0.35, R: 1.05, n: 10, drop: 0.25 }, { y: 1.35, R: 0.7, n: 8, drop: 0.2 }, { y: 2.1, R: 0.38, n: 6, drop: 0.12 }];
  const crystal = new THREE.OctahedronGeometry(0.035 * s, 0);
  xf(crystal, { sy: 1.8 });
  const drop = new THREE.OctahedronGeometry(0.06 * s, 0);
  xf(drop, { sy: 2.2 });
  for (const t of tiers) {
    const ring = new THREE.TorusGeometry(t.R * 0.55 * s, 0.018 * s, 6, 32);
    xf(ring, { rx: Math.PI / 2, y: t.y * s });
    p.add('gold', ring);
    for (let i = 0; i < t.n; i++) {
      const a = (i / t.n) * TAU;
      const ca = Math.cos(a), sa = Math.sin(a);
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const u = k / 8;
        const rr = (0.08 + u * (t.R - 0.08)) * s;
        const yy = (t.y - Math.sin(u * Math.PI) * t.drop + u * 0.18) * s;
        pts.push(new THREE.Vector3(ca * rr, yy, sa * rr));
      }
      p.add('gold', sweep([[0.02 * s, 0], [0, 0.02 * s], [-0.02 * s, 0], [0, -0.02 * s], [0.02 * s, 0]], pts, () => new THREE.Vector3(0, 1, 0)));
      const tip = pts[pts.length - 1];
      p.add('gold', xf(lathe([[0.001, 0], [0.05, 0.02], [0.07, 0.07], [0.045, 0.09]].map(([a, b]) => [a * s, b * s]), 10), { x: tip.x, y: tip.y, z: tip.z }));
      p.add('wax', xf(cyl(0.022 * s, 0.022 * s, 0.16 * s, 8), { x: tip.x, y: tip.y + 0.08 * s, z: tip.z }));
      flames.push(new THREE.Vector3(tip.x, tip.y + 0.24 * s, tip.z));
      // crystal pendant beneath each cup
      for (let k = 0; k < 3; k++) p.add('crystal', xf(crystal.clone(), { x: tip.x, y: tip.y - (0.05 + k * 0.075) * s, z: tip.z }));
      p.add('crystal', xf(drop.clone(), { x: tip.x, y: tip.y - 0.32 * s, z: tip.z }));
      // swag of crystals to next arm
      const a2 = ((i + 1) / t.n) * TAU;
      const rr = t.R * 0.92 * s;
      for (let k = 1; k < 8; k++) {
        const u = k / 8;
        const aa = a + (a2 - a) * u;
        const sag = Math.sin(u * Math.PI) * 0.22 * s;
        p.add('crystal', xf(crystal.clone(), { x: Math.cos(aa) * rr, y: (t.y + 0.1) * s - sag, z: Math.sin(aa) * rr }));
      }
    }
  }
  p.add('crystal', xf(new THREE.OctahedronGeometry(0.12 * s, 0), { y: -0.5 * s, sy: 2.4 }));
  const crown = new THREE.TorusGeometry(0.3 * s, 0.03 * s, 6, 24);
  xf(crown, { rx: Math.PI / 2, y: 2.55 * s });
  p.add('gold', crown);
  return { parts: p, flames };
}

/** Great circular corona for the crossing. */
export function coronaParts(R = 4.2) {
  const p = new Parts();
  const flames = [];
  for (const [rr, yy, th] of [[R, 0, 0.1], [R * 0.72, 0.9, 0.07]]) {
    const ring = new THREE.TorusGeometry(rr, th, 10, 96);
    xf(ring, { rx: Math.PI / 2, y: yy });
    p.add('gold', ring);
    const band = new THREE.CylinderGeometry(rr, rr, 0.32, 96, 1, true);
    xf(band, { y: yy - 0.2 });
    p.add('goldMatte', band);
    const n = Math.round(rr * 7);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      p.add('gold', xf(lathe([[0.001, 0], [0.06, 0.03], [0.07, 0.08], [0.05, 0.1]], 8), { x, y: yy + th, z }));
      p.add('wax', xf(cyl(0.025, 0.025, 0.22, 8), { x, y: yy + th + 0.08, z }));
      flames.push(new THREE.Vector3(x, yy + th + 0.36, z));
      if (i % 2 === 0) p.add('crystal', xf(new THREE.OctahedronGeometry(0.07, 0), { x, y: yy - 0.55, z, sy: 2.2 }));
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      p.add('gold', xf(new THREE.ConeGeometry(0.12, 0.6, 6), { x: Math.cos(a) * rr, y: yy + 0.35, z: Math.sin(a) * rr }));
    }
  }
  // suspension chains to a central ring
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const pts = [new THREE.Vector3(Math.cos(a) * R, 0.05, Math.sin(a) * R), new THREE.Vector3(0, 7, 0)];
    const len = pts[0].distanceTo(pts[1]);
    const g = new THREE.CylinderGeometry(0.025, 0.025, len, 5);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pts[1].clone().sub(pts[0]).normalize());
    g.applyQuaternion(q);
    g.translate(pts[0].x, pts[0].y, pts[0].z);
    p.add('gold', g);
  }
  return { parts: p, flames };
}

// ---------------------------------------------------------------------------
// Standing candelabrum (seven branches)
// ---------------------------------------------------------------------------
export function candelabrumParts(h = 2.2) {
  const p = new Parts();
  const flames = [];
  p.add('gold', lathe([[0.3, 0], [0.32, 0.05], [0.22, 0.12], [0.12, 0.2], [0.08, 0.35], [0.1, 0.45], [0.05, 0.55], [0.045, h * 0.7], [0.08, h * 0.72], [0.04, h * 0.75], [0.04, h * 0.8]], 16));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    p.add('gold', xf(new THREE.SphereGeometry(0.07, 8, 6), { x: Math.cos(a) * 0.3, y: 0.05, z: Math.sin(a) * 0.3, sy: 0.6 }));
  }
  const top = h * 0.8;
  const cups = [[0, 0.32]];
  for (let k = 1; k <= 3; k++) cups.push([-k * 0.2, 0.3 - k * 0.07], [k * 0.2, 0.3 - k * 0.07]);
  for (const [x, dy] of cups) {
    if (x !== 0) {
      const pts = [];
      for (let t = 0; t <= 10; t++) {
        const u = t / 10;
        pts.push(new THREE.Vector3(x * u, top - 0.18 + Math.sin(u * Math.PI * 0.5) * (dy + 0.18) - (1 - u) * 0.02, 0));
      }
      p.add('gold', sweep([[0.018, 0], [0, 0.018], [-0.018, 0], [0, -0.018], [0.018, 0]], pts, () => new THREE.Vector3(0, 0, 1)));
    }
    const cy = top + dy;
    p.add('gold', xf(lathe([[0.001, 0], [0.04, 0.02], [0.055, 0.06], [0.04, 0.08]], 10), { x, y: cy }));
    p.add('wax', xf(cyl(0.02, 0.02, 0.18, 8), { x, y: cy + 0.07 }));
    flames.push(new THREE.Vector3(x, cy + 0.26, 0));
  }
  return { parts: p, flames };
}

/** Tall altar candlestick. */
export function candlestickParts(h = 1.2) {
  const p = new Parts();
  p.add('gold', lathe([[0.16, 0], [0.17, 0.04], [0.1, 0.1], [0.05, 0.2], [0.07, 0.3], [0.035, 0.4], [0.035, h * 0.85], [0.07, h * 0.88], [0.08, h * 0.93], [0.03, h * 0.95]], 14));
  p.add('wax', xf(cyl(0.035, 0.035, 0.45, 10), { y: h * 0.95 }));
  return { parts: p, flames: [new THREE.Vector3(0, h * 0.95 + 0.53, 0)] };
}

// ---------------------------------------------------------------------------
// Banner hanging from a gilded rod
// ---------------------------------------------------------------------------
export function bannerParts(w = 1.4, h = 5.2, mat = 'banner') {
  const p = new Parts();
  const g = new THREE.PlaneGeometry(w, h, 8, 24);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const t = (h / 2 - y) / h;
    pos.setZ(i, Math.sin((x / w) * Math.PI * 3) * 0.04 * (0.4 + t));
    if (y < -h / 2 + 0.6) {
      const tip = 1 - Math.abs(x) / (w / 2);
      pos.setY(i, y - tip * 0.45 * (1 - (y + h / 2) / 0.6));
    }
  }
  g.computeVertexNormals();
  g.translate(0, -h / 2, 0);
  p.add(mat, g);
  p.add('gold', xf(new THREE.CylinderGeometry(0.035, 0.035, w + 0.4, 8), { rz: Math.PI / 2, y: 0.05 }));
  for (const s of [-1, 1]) p.add('gold', xf(new THREE.SphereGeometry(0.07, 8, 6), { x: s * (w / 2 + 0.22), y: 0.05 }));
  p.add('gold', xf(new THREE.CylinderGeometry(0.01, 0.01, 1.2, 4), { y: 0.65 }));
  return p;
}

// ---------------------------------------------------------------------------
// Flowers in urns
// ---------------------------------------------------------------------------
export function flowerUrnParts(seed = 3, size = 1, flowerMat = 'flowerWhite') {
  const p = new Parts();
  const r = rng(seed);
  const s = size;
  p.add('gold', lathe([[0.16, 0], [0.18, 0.04], [0.09, 0.1], [0.07, 0.2], [0.14, 0.32], [0.2, 0.45], [0.22, 0.52], [0.19, 0.56]].map(([a, b]) => [a * s, b * s]), 14));
  const leaf = new THREE.IcosahedronGeometry(0.07 * s, 0);
  xf(leaf, { sx: 0.5, sy: 0.18, sz: 1.3 });
  const bloom = new THREE.IcosahedronGeometry(0.055 * s, 1);
  for (let i = 0; i < 26; i++) {
    const a = r() * TAU;
    const rr = Math.pow(r(), 0.6) * 0.3 * s;
    const y = (0.6 + (0.34 - rr / s) * 0.9 + r() * 0.1) * s;
    p.add('foliage', xf(leaf.clone(), { x: Math.cos(a) * rr * 1.1, y: y - 0.05 * s, z: Math.sin(a) * rr * 1.1, ry: -a, rx: -0.5 + r() * 0.4 }));
  }
  for (let i = 0; i < 22; i++) {
    const a = r() * TAU;
    const rr = Math.pow(r(), 0.7) * 0.28 * s;
    const y = (0.66 + (0.3 - rr / s) * 0.9 + r() * 0.08) * s;
    p.add(flowerMat, xf(bloom.clone(), { x: Math.cos(a) * rr, y, z: Math.sin(a) * rr, s: 0.8 + r() * 0.5 }));
  }
  return p;
}

// ---------------------------------------------------------------------------
// Statues
// ---------------------------------------------------------------------------
function robeGeometry(profile, folds = 14, foldAmt = 0.018, seed = 1, squash = 0.82) {
  const g = lathe(profile, 40);
  const pos = g.attributes.position;
  const ymax = profile[profile.length - 1][1];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const t = 1 - Math.min(1, y / (ymax * 0.8));
    const f = Math.sin(a * folds + y * 2.5 + seed) * 0.6 + Math.sin(a * folds * 0.5 + 1.7 * seed) * 0.4;
    const k = 1 + f * foldAmt * (0.3 + 2.2 * t * t) / Math.max(0.1, Math.hypot(x, z));
    pos.setXYZ(i, x * k, y, z * k * squash);
  }
  g.computeVertexNormals();
  return g;
}

function feather(len, width) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(width, len * 0.3, width * 0.6, len * 0.85);
  s.quadraticCurveTo(width * 0.2, len * 1.02, 0, len);
  s.quadraticCurveTo(-width * 0.4, len * 0.5, 0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: 5 });
  return g;
}

function wingParts(p, side, scale = 1, mat = 'statue') {
  const root = new THREE.Vector3(side * 0.1, 1.46, -0.1).multiplyScalar(scale);
  const rows = [
    { n: 11, len: 0.95, w: 0.1, off: 0.0 },
    { n: 9, len: 0.6, w: 0.09, off: 0.03 },
    { n: 7, len: 0.32, w: 0.08, off: 0.06 },
  ];
  // leading edge arc: rises up and out, then sweeps down
  const edge = (u) => new THREE.Vector3(
    side * (0.1 + Math.sin(u * Math.PI * 0.62) * 0.62),
    1.46 + Math.sin(u * Math.PI * 0.9) * 0.62 - u * 0.25,
    -0.12 - u * 0.3,
  ).multiplyScalar(scale);
  for (const row of rows) {
    for (let i = 0; i < row.n; i++) {
      const u = 0.08 + (i / (row.n - 1)) * 0.9;
      const e = edge(u);
      const len = row.len * (0.55 + 0.6 * u) * scale;
      const f = feather(len, row.w * scale);
      // feathers hang down and back, fanning with u
      const fan = -Math.PI + (u - 0.2) * 0.9 * side * -1;
      f.rotateY(side > 0 ? Math.PI / 2 : -Math.PI / 2);
      f.rotateX(Math.PI);
      f.rotateZ(side * (0.15 + u * 0.55));
      f.rotateY(side * 0.35);
      f.translate(e.x, e.y + row.off * scale, e.z - row.off * scale);
      p.add(mat, f);
      void fan;
    }
  }
  // wing bone
  const bone = [];
  for (let k = 0; k <= 12; k++) bone.push(edge(k / 12));
  bone.unshift(root);
  p.add(mat, sweep([[0.05 * scale, 0], [0, 0.04 * scale], [-0.05 * scale, 0], [0, -0.04 * scale], [0.05 * scale, 0]], bone, () => new THREE.Vector3(0, 0, 1)));
}

/** Praying angel (height ≈ 2.1m at scale 1). */
export function angelParts({ scale = 1, halo = true, mat = 'statue', wings = true, pose = 'pray' } = {}) {
  const p = new Parts();
  const s = scale;
  const robe = robeGeometry([[0.001, 0], [0.34, 0.0], [0.36, 0.05], [0.3, 0.35], [0.25, 0.8], [0.2, 1.08], [0.22, 1.3], [0.25, 1.46], [0.2, 1.54], [0.08, 1.6], [0.055, 1.66], [0.001, 1.67]].map(([a, b]) => [a * s, b * s]), 13, 0.02 * s, 1.3);
  p.add(mat, robe);
  // belt
  p.add('gold', xf(new THREE.TorusGeometry(0.2 * s, 0.018 * s, 6, 24), { rx: Math.PI / 2, y: 1.08 * s, sz: 0.82 }));
  // head and hair
  p.add(mat, xf(new THREE.SphereGeometry(0.1 * s, 16, 12), { y: 1.77 * s, z: 0.015 * s, sx: 0.92, sy: 1.12, rx: 0.2 }));
  p.add(mat, xf(new THREE.SphereGeometry(0.108 * s, 14, 10, 0, TAU, 0, Math.PI * 0.62), { y: 1.8 * s, z: -0.015 * s, rx: -0.5, sz: 1.05 }));
  // arms
  const armPts = (sx) => pose === 'pray'
    ? [new THREE.Vector3(sx * 0.22, 1.47, -0.01), new THREE.Vector3(sx * 0.24, 1.25, 0.04), new THREE.Vector3(sx * 0.12, 1.3, 0.18), new THREE.Vector3(sx * 0.03, 1.4, 0.23)]
    : [new THREE.Vector3(sx * 0.22, 1.47, -0.01), new THREE.Vector3(sx * 0.3, 1.25, 0.05), new THREE.Vector3(sx * 0.38, 1.12, 0.2), new THREE.Vector3(sx * 0.42, 1.1, 0.32)];
  for (const sx of [-1, 1]) {
    const pts = armPts(sx).map((v) => v.multiplyScalar(s));
    const prof = [];
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * TAU;
      prof.push([Math.cos(a) * 0.055 * s, -Math.sin(a) * 0.055 * s]);
    }
    p.add(mat, sweep(prof, new THREE.CatmullRomCurve3(pts).getPoints(12), () => new THREE.Vector3(0, 0, 1)));
    const w = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const dir = w.clone().sub(prev).normalize();
    const sleeve = new THREE.CylinderGeometry(0.06 * s, 0.1 * s, 0.14 * s, 12, 1, true);
    sleeve.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    sleeve.translate(w.x - dir.x * 0.08 * s, w.y - dir.y * 0.08 * s, w.z - dir.z * 0.08 * s);
    p.add(mat, sleeve);
  }
  if (pose === 'pray') p.add(mat, xf(new THREE.SphereGeometry(0.05 * s, 10, 8), { y: 1.43 * s, z: 0.25 * s, sx: 0.8, sy: 1.5, sz: 0.6, rx: -0.3 }));
  else for (const sx of [-1, 1]) p.add(mat, xf(new THREE.SphereGeometry(0.045 * s, 8, 6), { x: sx * 0.43 * s, y: 1.1 * s, z: 0.35 * s, sy: 0.6 }));
  if (wings) {
    wingParts(p, 1, s, mat);
    wingParts(p, -1, s, mat);
  }
  if (halo) p.add('gold', xf(new THREE.TorusGeometry(0.16 * s, 0.012 * s, 6, 32), { y: 1.86 * s, z: -0.1 * s }));
  return p;
}

/** Madonna with veil and crown of stars. */
export function madonnaParts({ scale = 1, mat = 'statue' } = {}) {
  const p = new Parts();
  const s = scale;
  p.add(mat, robeGeometry([[0.001, 0], [0.36, 0], [0.37, 0.05], [0.3, 0.4], [0.24, 0.9], [0.2, 1.1], [0.22, 1.32], [0.24, 1.46], [0.18, 1.55], [0.07, 1.6], [0.001, 1.62]].map(([a, b]) => [a * s, b * s]), 16, 0.016 * s, 2.1, 0.85));
  // veil / mantle flowing from head down the back
  const veil = robeGeometry([[0.001, 1.95], [0.1, 1.92], [0.14, 1.82], [0.2, 1.62], [0.29, 1.4], [0.33, 0.9], [0.38, 0.3], [0.4, 0.04]].reverse().map(([a, b]) => [a * s, b * s]), 11, 0.024 * s, 4.2, 0.9);
  // open the veil at the front
  const vp = veil.attributes.position;
  for (let i = 0; i < vp.count; i++) {
    const x = vp.getX(i), y = vp.getY(i), z = vp.getZ(i);
    if (z > 0 && y < 1.6 * s) {
      const k = Math.max(0.6, 1 - (z / (0.4 * s)) * 0.5);
      vp.setXYZ(i, x * (1 + (1 - k) * 0.4), y, z * k - (1 - k) * 0.12 * s);
    }
  }
  veil.computeVertexNormals();
  p.add(mat, veil);
  p.add(mat, xf(new THREE.SphereGeometry(0.095 * s, 16, 12), { y: 1.78 * s, z: 0.03 * s, sx: 0.9, sy: 1.12, rx: 0.15 }));
  for (const sx of [-1, 1]) {
    const pts = [new THREE.Vector3(sx * 0.2, 1.45, 0.0), new THREE.Vector3(sx * 0.22, 1.24, 0.06), new THREE.Vector3(sx * 0.1, 1.3, 0.2), new THREE.Vector3(sx * 0.03, 1.38, 0.24)].map((v) => v.multiplyScalar(s));
    const prof = [];
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * TAU;
      prof.push([Math.cos(a) * 0.05 * s, -Math.sin(a) * 0.05 * s]);
    }
    p.add(mat, sweep(prof, new THREE.CatmullRomCurve3(pts).getPoints(12), () => new THREE.Vector3(0, 0, 1)));
  }
  p.add(mat, xf(new THREE.SphereGeometry(0.05 * s, 10, 8), { y: 1.42 * s, z: 0.26 * s, sx: 0.8, sy: 1.5, sz: 0.6, rx: -0.3 }));
  // crown of twelve stars
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const st = new THREE.OctahedronGeometry(0.035 * s, 0);
    xf(st, { x: Math.cos(a) * 0.2 * s, y: 2.0 * s, z: Math.sin(a) * 0.2 * s - 0.03 * s, sy: 1.4 });
    p.add('gold', st);
  }
  p.add('gold', xf(new THREE.TorusGeometry(0.2 * s, 0.01 * s, 6, 40), { rx: Math.PI / 2, y: 2.0 * s, z: -0.03 * s }));
  // globe and crescent at feet
  p.add('gold', xf(new THREE.TorusGeometry(0.34 * s, 0.03 * s, 6, 32, Math.PI), { y: 0.02 * s, z: 0.1 * s, rx: -Math.PI / 2 + 0.2, sy: 0.4 }));
  return p;
}

/** Square pedestal with mouldings and gold bands. */
export function pedestalParts(h = 1.4, w = 0.8, mat = 'marble') {
  const p = new Parts();
  const hw = w / 2;
  p.add('stone', polyLathe([[hw * 1.25, 0], [hw * 1.25, 0.18], [hw * 1.12, 0.24], [hw * 1.12, 0.3], [hw, 0.36]], 4, Math.PI / 4));
  p.add(mat, polyLathe([[hw, 0.36], [hw, h - 0.3]], 4, Math.PI / 4, false));
  p.add('gold', polyLathe([[hw * 1.02, 0.4], [hw * 1.02, 0.45]], 4, Math.PI / 4, false));
  p.add('gold', polyLathe([[hw * 1.02, h - 0.38], [hw * 1.02, h - 0.33]], 4, Math.PI / 4, false));
  p.add('stone', polyLathe([[hw, h - 0.3], [hw * 1.12, h - 0.24], [hw * 1.12, h - 0.16], [hw * 1.25, h - 0.1], [hw * 1.25, h]], 4, Math.PI / 4));
  return p;
}

/** Gilded canopy (baldachin) above a pier statue. */
export function canopyParts(w = 0.9) {
  const p = new Parts();
  const hw = w / 2;
  p.add('gold', polyLathe([[hw * 1.1, 0], [hw * 1.1, 0.12], [hw * 0.95, 0.18]], 6, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const pin = pinnacle({ w: 0.12, shaftH: 0.35, spireH: 0.5, mat: 'gold', gold: true });
    pin.transform(new THREE.Matrix4().makeTranslation(Math.cos(a) * hw, 0.12, Math.sin(a) * hw));
    p.merge(pin);
  }
  const sp = new Parts();
  sp.add('gold', polyLathe([[hw * 0.8, 0], [0.02, 1.1]], 6, 0, false));
  sp.transform(new THREE.Matrix4().makeTranslation(0, 0.18, 0));
  p.merge(sp);
  finial(p, 0, 1.28, 0, 0.12, 'gold');
  return p;
}
