import * as THREE from 'three';
import { L } from '../layout.js';
import {
  Parts, colonnette, rectOutline, archOpening, archivolt, gothicWindow, PROFILES, pinnacle, spire, finial, outlineWithNotches,
  balustrade, mouldingAlong,
} from '../../arch/components.js';
import { ribVault, apseVault } from '../../arch/vaults.js';
import { xf, cyl, lathe, polyLathe, TAU, rng } from '../../arch/geom.js';
import { WallFrame, slab, hMould, lbox, lBalustrade, addGlass } from './common.js';
import { CHAPEL_WIN } from '../glassDesigns.js';
import { madonnaParts, angelParts, pedestalParts, flowerUrnParts, candlestickParts } from '../props/protos.js';
import { CROSS } from './crossing.js';

const M4 = (x, y, z, ry = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s));

// ---------------------------------------------------------------------------
// Lady Chapel: octagon off the south transept
// ---------------------------------------------------------------------------
export const CHAPEL = { cx: L.naveHalf + L.bay * 1.5, cz: -85.4, ri: 6.1, t: 1.0, spring: 9.0, apex: 14.5 };

export function buildLadyChapel(ctx) {
  const zone = 'chapel';
  const C = CHAPEL;
  const flames = [];
  const p = new Parts();
  const rc = C.ri + C.t / 2; // wall centreline apothem
  const side = 2 * rc * Math.tan(Math.PI / 8);
  const verts = [];
  for (let k = 0; k < 8; k++) {
    const th = Math.PI / 2 + (k / 8) * TAU; // k=0 faces +z (entrance)
    const o = new THREE.Vector3(C.cx + Math.cos(th) * rc, 0, C.cz + Math.sin(th) * rc);
    const f = new WallFrame(o, new THREE.Vector3(-Math.cos(th), 0, -Math.sin(th)));
    const holes = [];
    const notches = [];
    if (k === 0) notches.push({ ca: 0, span: 3.6, k: 0.72, spring: 5.0, segs: 16 });
    let win = null;
    if (k >= 2 && k <= 6) {
      win = gothicWindow({ W: CHAPEL_WIN.W, H: CHAPEL_WIN.H, k: CHAPEL_WIN.k, lights: 1, ca: 0, y0: CHAPEL_WIN.y0, b: 0, wallT: C.t, splayW: 0.2 });
      holes.push(win.hole);
      p.merge(win.parts, f.m);
    }
    slab(ctx, zone, f, outlineWithNotches(-side / 2 - 0.05, side / 2 + 0.05, 0, C.apex + 2.5, notches), holes, C.t);
    const q = new Parts();
    if (k === 0) {
      archivolt(q, 0, 5.0, 3.6, 0.72, C.t / 2, { rolls: [0.1], rollR: 0.06 });
      archivolt(q, 0, 5.0, 3.6, 0.72, -C.t / 2, { dir: -1, rolls: [0.1], rollR: 0.06 });
    } else {
      hMould(q, -side / 2, side / 2, 2.2, C.t / 2, PROFILES.string);
      lbox(q, 'goldMosaic', -side / 2 + 0.3, side / 2 - 0.3, 0.3, 2.0, C.t / 2 + 0.005, C.t / 2 + 0.015);
    }
    q.toBatcher(ctx.B, zone, f.m);
    if (win) addGlass(ctx, k % 2 ? 'chapel' : 'chapel-b', f, win, { ca: 0, y0: CHAPEL_WIN.y0, kind: 'chapel', shafts: false });
    // collision along the inner face
    const th0 = Math.PI / 2 + ((k - 0.5) / 8) * TAU, th1 = Math.PI / 2 + ((k + 0.5) / 8) * TAU;
    const R = C.ri / Math.cos(Math.PI / 8);
    const ax = C.cx + Math.cos(th0) * R, az = C.cz + Math.sin(th0) * R;
    const bx = C.cx + Math.cos(th1) * R, bz = C.cz + Math.sin(th1) * R;
    verts.push([ax, az]);
    if (k === 0) {
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const dx = (bx - ax), dz = (bz - az);
      const l = Math.hypot(dx, dz);
      const ux = dx / l, uz = dz / l;
      ctx.col.wall(ax, az, mx - ux * 1.8, mz - uz * 1.8, -1, 20);
      ctx.col.wall(mx + ux * 1.8, mz + uz * 1.8, bx, bz, -1, 20);
    } else ctx.col.wall(ax, az, bx, bz, -1, 20);
    // vaulting shaft at each vertex
    const sh = colonnette({ height: C.spring, r: 0.13, shaftMat: 'marble' });
    sh.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(C.cx + Math.cos(th0) * (R - 0.2), 0, C.cz + Math.sin(th0) * (R - 0.2)), true);
  }
  // star vault
  const angles = [];
  for (let k = 0; k <= 8; k++) angles.push(-(Math.PI / 2 + ((k - 0.5) / 8) * TAU));
  const v = apseVault({ R: C.ri / Math.cos(Math.PI / 8) - 0.05, angles, y0: C.spring, y1: C.apex, bulge: 1.0 });
  v.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(C.cx, 0, C.cz));
  // vestibule linking to the transept arch
  const vz0 = L.crossZ1 - L.wallT / 2, vz1 = C.cz + C.ri + 0.1;
  for (const s of [-1, 1]) {
    const x = C.cx + s * 2.5;
    const g = new THREE.BoxGeometry(0.8, 7.4, vz0 - vz1 + 0.2);
    xf(g, { x: x + s * 0.4, y: 3.7, z: (vz0 + vz1) / 2 });
    p.add('stone', g);
    ctx.col.wall(x, vz0, x, vz1 - 0.3, -1, 10);
  }
  p.add('stone', xf(new THREE.BoxGeometry(5.8, 0.6, vz0 - vz1 + 0.2), { x: C.cx, y: 7.1, z: (vz0 + vz1) / 2 }));
  p.add('vaultFlat', xf(new THREE.BoxGeometry(5.0, 0.05, vz0 - vz1), { x: C.cx, y: 6.78, z: (vz0 + vz1) / 2 }));
  ctx.col.floor(C.cx - 2.5, vz0 + 0.2, C.cx + 2.5, vz1 - 0.5, 0);
  ctx.col.floorPoly(verts, 0);
  // Madonna on a tall pedestal facing the entrance, framed by candles and flowers
  const far = new THREE.Vector3(C.cx, 0, C.cz - C.ri + 1.3);
  const ped = pedestalParts(2.0, 1.0);
  ped.toBatcher(ctx.B, zone, M4(far.x, 0, far.z), true);
  const mad = madonnaParts({ scale: 1.25 });
  mad.toBatcher(ctx.B, zone, M4(far.x, 2.0, far.z), true);
  // blue star-spangled niche behind her
  const niche = new THREE.Shape(archOpening(0, 0, 2.8, 0.75, 4.8, 16).map(([x, y]) => new THREE.Vector2(x, y)));
  const ng = new THREE.ShapeGeometry(niche, 8);
  xf(ng, { x: far.x, y: 1.9, z: C.cz - C.ri + 0.02 });
  p.add('lapis', ng);
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 1.3;
    const st = new THREE.OctahedronGeometry(0.05 + Math.random() * 0.04, 0);
    xf(st, { x: far.x + Math.cos(a) * r, y: 5.3 + Math.sin(a) * r * 1.4 - 0.8, z: C.cz - C.ri + 0.06, sz: 0.3 });
    p.add('gold', st);
  }
  ctx.col.circle(far.x, far.z, 1.0, -1, 5);
  // altar before her
  p.add('marble', xf(new THREE.BoxGeometry(2.8, 1.0, 0.9), { x: far.x, y: 0.5, z: far.z + 1.4 }));
  p.add('linen', xf(new THREE.BoxGeometry(2.9, 0.03, 1.0), { x: far.x, y: 1.015, z: far.z + 1.4 }));
  p.add('goldMosaic', xf(new THREE.BoxGeometry(2.6, 0.8, 0.02), { x: far.x, y: 0.5, z: far.z + 1.86 }));
  ctx.col.box(far.x - 1.45, far.z + 0.9, far.x + 1.45, far.z + 1.9, -1, 1.2);
  const cs = candlestickParts(0.6);
  if (!ctx.inst.has('smallCandle')) ctx.inst.define('smallCandle', cs.parts);
  for (let i = 0; i < 4; i++) {
    const x = far.x - 1.1 + i * 0.73;
    ctx.inst.addAt('smallCandle', x, 1.03, far.z + 1.3, 0, 1, zone);
    flames.push(cs.flames[0].clone().add(new THREE.Vector3(x, 1.03, far.z + 1.3)));
  }
  const fl = flowerUrnParts(77, 1.3);
  for (const s of [-1, 1]) fl.toBatcher(ctx.B, zone, M4(far.x + s * 1.9, 0, far.z + 0.6), true);
  // tiers of votive candles around the octagon (interactive: light a candle)
  const votives = [];
  for (const k of [2, 6]) {
    const th = Math.PI / 2 + (k / 8) * TAU;
    const px = C.cx + Math.cos(th) * (C.ri - 1.0), pz = C.cz + Math.sin(th) * (C.ri - 1.0);
    const ry = -th - Math.PI / 2;
    ctx.inst.add('votiveStand', M4(px, 0, pz, ry + Math.PI), zone);
    ctx.col.box(px - 0.8, pz - 0.8, px + 0.8, pz + 0.8, -1, 1.4);
    for (let row = 0; row < 3; row++) {
      for (let j = 0; j < 11; j++) {
        const lp = new THREE.Vector3(-0.7 + j * 0.14, [0.93, 1.08, 1.23][row], [0.1, -0.12, -0.24][row]).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry + Math.PI).add(new THREE.Vector3(px, 0, pz));
        votives.push(lp);
      }
    }
  }
  const r = rng(5);
  const lit = [];
  const unlit = [];
  for (const v of votives) (r() < 0.45 ? lit : unlit).push(v);
  for (const v of lit) {
    ctx.inst.add('votive', M4(v.x, v.y, v.z), zone);
    flames.push(v.clone().add(new THREE.Vector3(0, 0.1, 0)));
  }
  ctx.world.unlitVotives = unlit.map((v) => ({ pos: v, lit: false }));
  ctx.anchors.lights.push({ pos: new THREE.Vector3(far.x, 2.2, far.z + 1.6), intensity: 8, color: new THREE.Color(0xffa860), radius: 10 });
  ctx.anchors.lights.push({ pos: new THREE.Vector3(C.cx, 9.5, C.cz), intensity: 10, color: new THREE.Color(0xffc080), radius: 14 });
  // hanging lamp
  ctx.inst.add('hangLantern', new THREE.Matrix4().makeTranslation(C.cx, C.apex - 5.2, C.cz), zone);
  // kneelers
  const kn = new Parts();
  kn.add('wood', xf(new THREE.BoxGeometry(1.6, 0.18, 0.5), { y: 0.09 }));
  kn.add('velvet', xf(new THREE.BoxGeometry(1.5, 0.06, 0.44), { y: 0.21 }));
  kn.add('wood', xf(new THREE.BoxGeometry(1.6, 0.95, 0.2), { y: 0.48, z: -0.3 }));
  kn.add('gold', xf(new THREE.BoxGeometry(1.62, 0.04, 0.22), { y: 0.96, z: -0.3 }));
  for (const s of [-1, 1]) {
    kn.toBatcher(ctx.B, zone, M4(C.cx + s * 1.4, 0, C.cz + 1.2), true);
    ctx.col.box(C.cx + s * 1.4 - 0.85, C.cz + 0.8, C.cx + s * 1.4 + 0.85, C.cz + 1.6, -1, 1);
  }
  // exterior: octagonal roof, buttresses, lantern spire
  const rp = new Parts();
  rp.add('slate', polyLathe([[rc + 0.9, C.apex + 2.5], [0.3, C.apex + 9]], 8, Math.PI / 8, false));
  rp.add('stone', polyLathe([[rc + 0.55, C.apex + 1.8], [rc + 0.9, C.apex + 2.4], [rc + 0.9, C.apex + 2.6]], 8, Math.PI / 8));
  for (let k = 1; k < 8; k++) {
    const th = Math.PI / 2 + ((k - 0.5) / 8) * TAU;
    const R2 = (rc + C.t / 2) / Math.cos(Math.PI / 8);
    const bx = C.cx + Math.cos(th) * (R2 + 0.6), bz = C.cz + Math.sin(th) * (R2 + 0.6);
    rp.add('stone', xf(new THREE.BoxGeometry(1.0, C.apex + 1, 1.6), { x: bx, y: (C.apex + 1) / 2, z: bz, ry: -th }));
    const pn = pinnacle({ w: 0.8, shaftH: 2, spireH: 3 });
    pn.transform(new THREE.Matrix4().makeTranslation(bx, C.apex + 1, bz));
    rp.merge(pn);
    ctx.col.circle(bx, bz, 0.9, -1, 20);
  }
  const sp = new Parts();
  spire(sp, { r: 0.9, h: 4.5, crockets: 4, mat: 'domeBlue', crocketMat: 'gold' });
  rp.merge(sp, new THREE.Matrix4().makeTranslation(C.cx, C.apex + 8.6, C.cz));
  rp.toBatcher(ctx.B, 'ext');
  p.toBatcher(ctx.B, zone);
  ctx.anchors.chapel = new THREE.Vector3(C.cx, 0, C.cz);
  return flames;
}

// ---------------------------------------------------------------------------
// Crypt beneath the choir, reached by two stairs from the crossing
// ---------------------------------------------------------------------------
export const CRYPT = { y: -4.2, x0: -6.3, x1: 6.3, z0: -77.4, z1: -96.8, stairX0: 4.25, stairX1: 6.35, stairZ0: -70.8, ceil: -0.35 };

export function buildCrypt(ctx) {
  const zone = 'crypt';
  const K = CRYPT;
  const flames = [];
  const p = new Parts();
  const stepRise = 0.2;
  const n = Math.round(-K.y / stepRise);
  const run = 0.28;
  const zEnd = K.stairZ0 - n * run;
  for (const s of [-1, 1]) {
    const xa = s * K.stairX0, xb = s * K.stairX1;
    const xc = (xa + xb) / 2, w = Math.abs(xb - xa);
    for (let i = 0; i < n; i++) {
      const ty = -stepRise * (i + 1);
      const z = K.stairZ0 - run * (i + 0.5);
      p.add('marble', xf(new THREE.BoxGeometry(w, 0.2, run), { x: xc, y: ty - 0.1, z }));
      const fh = ty - 0.2 - (K.y - 0.1);
      if (fh > 0.01) p.add('stoneShade', xf(new THREE.BoxGeometry(w, fh, run), { x: xc, y: K.y - 0.1 + fh / 2, z }));
    }
    // stairwell walls
    for (const xx of [xa - s * 0.15, xb + s * 0.15]) {
      p.add('stone', xf(new THREE.BoxGeometry(0.3, 4.6, K.stairZ0 - zEnd), { x: xx, y: K.y / 2 + 0.1, z: (K.stairZ0 + zEnd) / 2 }));
      ctx.col.wall(xx - s * 0.15 * (xx === xa - s * 0.15 ? -1 : 1), K.stairZ0, xx - s * 0.15 * (xx === xa - s * 0.15 ? -1 : 1), zEnd, -6, 0.5);
    }
    p.add('stone', xf(new THREE.BoxGeometry(w + 0.6, 4.4, 0.3), { x: xc, y: K.y / 2 + 0.1, z: K.stairZ0 + 0.15 }));
    ctx.col.ramp(Math.min(xa, xb), zEnd, Math.max(xa, xb), K.stairZ0, 'z', K.y, 0);
    ctx.col.hole(Math.min(xa, xb), zEnd, Math.max(xa, xb), K.stairZ0, -0.1, 0.1);
    // balustrade around the stairwell opening in the crossing floor
    const bp = new Parts();
    const list = [];
    const zTop = Math.max(zEnd, L.crossZ1 + 0.05);
    balustrade(bp, list, xa - s * 0.12, K.stairZ0 + 0.12, xb + s * 0.12, K.stairZ0 + 0.12, 0, { h: 0.95, spacing: 0.24, railW: 0.2, gold: true });
    balustrade(bp, list, xb + s * 0.12, K.stairZ0 + 0.12, xb + s * 0.12, zTop, 0, { h: 0.95, spacing: 0.24, railW: 0.2, gold: true });
    balustrade(bp, list, xa - s * 0.12, K.stairZ0 + 0.12, xa - s * 0.12, zTop, 0, { h: 0.95, spacing: 0.24, railW: 0.2, gold: true });
    bp.toBatcher(ctx.B, 'crossing');
    for (const m of list) ctx.inst.add('balusterMarble', m, 'crossing');
    ctx.col.wall(xa, K.stairZ0 + 0.12, xb, K.stairZ0 + 0.12, -0.1, 1.2);
    ctx.col.wall(xa - s * 0.12, K.stairZ0 + 0.12, xa - s * 0.12, zTop, -0.1, 1.2);
    ctx.col.wall(xb + s * 0.12, K.stairZ0 + 0.12, xb + s * 0.12, zTop, -0.1, 1.2);
  }
  ctx.world.cryptHoles = [-1, 1].map((s) => [Math.min(s * K.stairX0, s * K.stairX1), zEnd, Math.max(s * K.stairX0, s * K.stairX1), K.stairZ0]);
  // crypt hall: groin vaults on two rows of short columns
  const bay = 3.8;
  const nb = Math.round((K.z0 - K.z1) / bay);
  const bl = (K.z0 - K.z1) / nb;
  const spans = [[K.x0, -2.1], [-2.1, 2.1], [2.1, K.x1]];
  for (let i = 0; i < nb; i++) {
    const zA = K.z0 - i * bl;
    for (const [xa, xb] of spans) {
      const v = ribVault({ span: xb - xa, len: bl, y0: K.y + 2.2, y1: K.ceil, endRib: i === nb - 1, segX: 12, segT: 6, boss: true });
      v.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation((xa + xb) / 2, 0, zA));
    }
    for (const x of [-2.1, 2.1]) {
      if (i === 0) continue;
      const c = colonnette({ height: 2.2, r: 0.26, shaftMat: 'marbleRose', capMat: 'gold' });
      c.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(x, K.y, zA), true);
      ctx.col.circle(x, zA, 0.4, K.y - 1, K.y + 3);
    }
  }
  // enclosing walls with arched niches
  const wallH = K.ceil - K.y + 0.6;
  for (const s of [-1, 1]) {
    p.add('stone', xf(new THREE.BoxGeometry(0.6, wallH, K.z0 - K.z1 + 0.6), { x: s * (K.x1 + 0.3), y: K.y + wallH / 2, z: (K.z0 + K.z1) / 2 }));
    ctx.col.wall(s * K.x1, K.z0, s * K.x1, K.z1, K.y - 1, K.y + 3);
    for (let i = 0; i < nb; i++) {
      const zc = K.z0 - i * bl - bl / 2;
      p.add('lapis', xf(new THREE.BoxGeometry(0.05, 1.8, 1.4), { x: s * (K.x1 - 0.01), y: K.y + 1.6, z: zc }));
      p.add('gold', xf(new THREE.BoxGeometry(0.06, 0.06, 1.5), { x: s * (K.x1 - 0.02), y: K.y + 2.5, z: zc }));
    }
  }
  p.add('stone', xf(new THREE.BoxGeometry(K.x1 * 2 + 1.2, wallH, 0.6), { y: K.y + wallH / 2, z: K.z1 - 0.3 }));
  ctx.col.wall(K.x0, K.z1, K.x1, K.z1, K.y - 1, K.y + 3);
  // west wall of the crypt, open to the two stair landings
  for (const [xa, xb] of [[K.x0 - 0.3, -K.stairX1], [-K.stairX0, K.stairX0], [K.stairX1, K.x1 + 0.3]]) {
    p.add('stone', xf(new THREE.BoxGeometry(xb - xa, wallH, 0.6), { x: (xa + xb) / 2, y: K.y + wallH / 2, z: K.z0 + 0.3 }));
    ctx.col.wall(xa, K.z0, xb, K.z0, K.y - 1, K.y + 3);
  }
  // landings between stair foot and the crypt
  ctx.col.floor(-K.stairX1, zEnd + 0.05, -K.stairX0, K.z0, K.y);
  ctx.col.floor(K.stairX0, zEnd + 0.05, K.stairX1, K.z0, K.y);
  ctx.col.floor(K.x0, K.z0, K.x1, K.z1, K.y);
  // Reliquary shrine at the east end
  const R = new THREE.Vector3(0, K.y, K.z1 + 1.8);
  const sh = new Parts();
  sh.add('marble', xf(new THREE.BoxGeometry(2.6, 1.0, 1.3), { y: 0.5 }));
  sh.add('gold', xf(new THREE.BoxGeometry(1.6, 0.8, 0.8), { y: 1.4 }));
  sh.add('gold', xf(new THREE.ConeGeometry(0.95, 0.6, 4), { y: 2.1, ry: Math.PI / 4, sx: 1.2, sz: 0.7 }));
  for (let i = 0; i < 4; i++) sh.add('lapis', xf(new THREE.BoxGeometry(0.3, 0.45, 0.02), { x: -0.55 + i * 0.37, y: 1.4, z: 0.41 }));
  sh.add('glowWarm', xf(new THREE.OctahedronGeometry(0.16, 0), { y: 2.55, sy: 1.6 }));
  sh.toBatcher(ctx.B, zone, M4(R.x, R.y, R.z), true);
  ctx.col.box(-1.4, R.z - 0.8, 1.4, R.z + 0.8, K.y - 1, K.y + 3);
  const cs = candlestickParts(1.1);
  if (!ctx.inst.has('cryptCandle')) ctx.inst.define('cryptCandle', cs.parts);
  for (const s of [-1, 1]) {
    for (const dz of [0.9, -0.2]) {
      const x = s * 1.9, z = R.z + dz;
      ctx.inst.addAt('cryptCandle', x, K.y, z, 0, 1, zone);
      flames.push(cs.flames[0].clone().add(new THREE.Vector3(x, K.y, z)));
    }
  }
  // reflecting pool with floating candles in the central aisle
  const pz0 = K.z0 - 5.5, pz1 = K.z1 + 5.2;
  p.add('marble', xf(new THREE.BoxGeometry(2.8, 0.35, pz0 - pz1 + 0.6), { y: K.y + 0.17, z: (pz0 + pz1) / 2 }));
  ctx.col.box(-1.4, pz1 - 0.3, 1.4, pz0 + 0.3, K.y - 1, K.y + 0.5);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2.3, pz0 - pz1), ctx.world.waterMaterials[0]);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, K.y + 0.3, (pz0 + pz1) / 2);
  ctx.world.scene.add(water);
  const rr = rng(21);
  const disc = new Parts();
  disc.add('wax', cyl(0.05, 0.06, 0.05, 10));
  ctx.inst.define('floatCandle', disc, { castShadow: false });
  for (let i = 0; i < 26; i++) {
    const x = (rr() - 0.5) * 1.9, z = pz1 + 0.3 + rr() * (pz0 - pz1 - 0.6);
    ctx.inst.add('floatCandle', M4(x, K.y + 0.29, z), zone);
    flames.push(new THREE.Vector3(x, K.y + 0.42, z));
  }
  // sarcophagi with recumbent figures between the columns
  const sarc = new Parts();
  sarc.add('marble', xf(new THREE.BoxGeometry(0.9, 0.8, 2.1), { y: 0.4 }));
  sarc.add('stone', xf(new THREE.BoxGeometry(1.0, 0.12, 2.2), { y: 0.86 }));
  for (let i = 0; i < 3; i++) sarc.add('gold', xf(new THREE.BoxGeometry(0.02, 0.4, 0.5), { x: 0.46, y: 0.4, z: -0.65 + i * 0.65 }));
  const effigy = angelParts({ scale: 0.75, wings: false, halo: false });
  const efm = new THREE.Matrix4().makeTranslation(0, 1.05, 0.8).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  sarc.merge(effigy, efm);
  for (const s of [-1, 1]) {
    for (let i = 1; i < nb - 1; i += 2) {
      const z = K.z0 - i * bl - bl / 2;
      sarc.toBatcher(ctx.B, zone, M4(s * 4.2, K.y, z), true);
      ctx.col.box(s * 4.2 - 0.5, z - 1.1, s * 4.2 + 0.5, z + 1.1, K.y - 1, K.y + 1.2);
    }
  }
  for (let i = 0; i < nb; i++) {
    const zc = K.z0 - i * bl - bl / 2;
    ctx.anchors.lights.push({ pos: new THREE.Vector3(0, K.y + 1.4, zc), intensity: 3.5, color: new THREE.Color(0xff9848), radius: 6 });
  }
  ctx.anchors.lights.push({ pos: new THREE.Vector3(0, K.y + 2.2, R.z + 1.2), intensity: 6, color: new THREE.Color(0xffa850), radius: 8 });
  p.toBatcher(ctx.B, zone);
  ctx.anchors.crypt = new THREE.Vector3(0, K.y, (K.z0 + K.z1) / 2);
  return flames;
}

// ---------------------------------------------------------------------------
// Stair turret beside the north transept, climbing to an open belvedere
// ---------------------------------------------------------------------------
export const TURRET = { x: -(L.naveHalf + L.bay / 2), z: -78.95, rOut: 2.8, rIn: 2.3, top: 40, turns: 8 };

export function buildTurret(ctx) {
  const zone = 'turret';
  const T = TURRET;
  const flames = [];
  const p = new Parts();
  const sides = 14;
  const rc = (T.rOut + T.rIn) / 2;
  const sw = 2 * rc * Math.tan(Math.PI / sides) + 0.05;
  const wallTop = T.top + 1.2;
  for (let k = 0; k < sides; k++) {
    const th = (k / sides) * TAU;
    const o = new THREE.Vector3(T.x + Math.cos(th) * rc, 0, T.z + Math.sin(th) * rc);
    const f = new WallFrame(o, new THREE.Vector3(-Math.cos(th), 0, -Math.sin(th)));
    const facesTransept = Math.sin(th) > 0.9;
    const notches = facesTransept ? [{ ca: 0, span: 1.6, k: 0.7, spring: 2.6, segs: 10 }] : [];
    const holes = [];
    // slit windows spiralling up with the stair
    for (let y = 3 + (k % 4) * 1.25; y < T.top - 2; y += 5) holes.push(archOpening(0, y, 0.28, 0.7, y + 1.1, 6));
    slab(ctx, zone, f, outlineWithNotches(-sw / 2, sw / 2, 0, wallTop, notches), holes, T.rOut - T.rIn);
    const th0 = ((k - 0.5) / sides) * TAU, th1 = ((k + 0.5) / sides) * TAU;
    const rw = T.rIn / Math.cos(Math.PI / sides);
    if (!facesTransept) ctx.col.wall(T.x + Math.cos(th0) * rw, T.z + Math.sin(th0) * rw, T.x + Math.cos(th1) * rw, T.z + Math.sin(th1) * rw, -1, T.top + 3);
    else {
      ctx.col.wall(T.x + Math.cos(th0) * rw, T.z + Math.sin(th0) * rw, T.x + Math.cos(th) * rw - 0.8, T.z + Math.sin(th) * rw, 2.4, T.top + 3);
    }
  }
  // doorway passage from the transept
  ctx.col.floor(T.x - 0.9, L.crossZ1 - 0.2, T.x + 0.9, T.z + T.rIn, 0);
  ctx.col.wall(T.x - 0.85, L.crossZ1, T.x - 0.85, T.z + T.rIn - 0.2, -1, 4);
  ctx.col.wall(T.x + 0.85, L.crossZ1, T.x + 0.85, T.z + T.rIn - 0.2, -1, 4);
  // central newel and spiral steps (landing zone at the entrance)
  p.add('marble', cyl(0.42, 0.42, T.top, 12, T.x, 0, T.z));
  ctx.col.circle(T.x, T.z, 0.5, -1, T.top + 1);
  const stepsPerTurn = 22;
  const total = stepsPerTurn * T.turns;
  const rise = T.top / total;
  const a0 = Math.PI * 1.5 + 0.5; // stair starts just past the doorway, rising away from it
  const step = new Parts();
  step.add('marble', xf(new THREE.BoxGeometry(T.rIn - 0.4, 0.14, 0.62), { x: (T.rIn - 0.4) / 2 + 0.4, y: -0.07 }));
  step.add('stoneShade', xf(new THREE.BoxGeometry(T.rIn - 0.4, 0.35, 0.5), { x: (T.rIn - 0.4) / 2 + 0.4, y: -0.3, z: -0.05 }));
  ctx.inst.define('spiralStep', step);
  for (let i = 1; i <= total; i++) {
    const a = a0 + (i / stepsPerTurn) * TAU;
    const y = i * rise;
    const m = new THREE.Matrix4().makeTranslation(T.x, y, T.z).multiply(new THREE.Matrix4().makeRotationY(a));
    ctx.inst.add('spiralStep', m, zone);
  }
  ctx.col.spiral(T.x, T.z, 0.45, T.rIn, 0, T.top, T.turns, a0, 1);
  ctx.col.disc(T.x, T.z, T.rIn, 0);
  // candle sconces on the wall every half turn
  for (let i = 0; i < T.turns * 2; i++) {
    const a = a0 + (i + 0.35) * Math.PI;
    const y = ((i + 0.35) / 2) * (T.top / T.turns) + 1.7;
    const x = T.x + Math.cos(a) * (T.rIn - 0.08), z = T.z - Math.sin(a) * (T.rIn - 0.08);
    p.add('iron', xf(new THREE.BoxGeometry(0.12, 0.06, 0.12), { x, y: y - 0.05, z }));
    p.add('wax', cyl(0.025, 0.025, 0.14, 6, x, y, z));
    flames.push(new THREE.Vector3(x, y + 0.2, z));
    ctx.anchors.lights.push({ pos: new THREE.Vector3(x - Math.cos(a) * 0.4, y + 0.3, z + Math.sin(a) * 0.4), intensity: 2.2, color: new THREE.Color(0xff9a48), radius: 5 });
  }
  // belvedere at the top: floor, balustrade, columns, ribbed dome and a bell
  const by = T.top;
  // belvedere floor ring, open over the last quarter turn of the stair
  const ring = new THREE.RingGeometry(0.42, T.rOut + 0.35, 32, 1, a0, Math.PI * 1.5);
  ring.rotateX(-Math.PI / 2);
  ring.translate(T.x, by, T.z);
  p.add('marble', ring);
  const ringUnder = ring.clone();
  ringUnder.translate(0, -0.3, 0);
  ringUnder.setIndex([...ringUnder.index.array].reverse());
  ringUnder.computeVertexNormals();
  p.add('stone', ringUnder);
  p.add('stone', xf(new THREE.CylinderGeometry(T.rOut + 0.35, T.rOut + 0.35, 0.3, 32, 1, true), { x: T.x, y: by - 0.15, z: T.z }));
  const bl = [];
  const bp = new Parts();
  const segs = 16;
  for (let k = 0; k < segs; k++) {
    const a0b = (k / segs) * TAU, a1b = ((k + 1) / segs) * TAU;
    const R = T.rOut + 0.1;
    balustrade(bp, bl, T.x + Math.cos(a0b) * R, T.z + Math.sin(a0b) * R, T.x + Math.cos(a1b) * R, T.z + Math.sin(a1b) * R, by, { h: 1.0, spacing: 0.24, railW: 0.2, posts: 100 });
    ctx.col.wall(T.x + Math.cos(a0b) * (R - 0.15), T.z + Math.sin(a0b) * (R - 0.15), T.x + Math.cos(a1b) * (R - 0.15), T.z + Math.sin(a1b) * (R - 0.15), by - 0.5, by + 1.2);
  }
  bp.toBatcher(ctx.B, zone);
  for (const m of bl) ctx.inst.add('balusterMarble', m, zone);
  ctx.col.disc(T.x, T.z, T.rOut + 0.2, by);
  ctx.col.hole(T.x - 0.1, T.z - 0.1, T.x + 0.1, T.z + 0.1, -99, -98);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + 0.3;
    const c = colonnette({ height: 3.6, r: 0.16, shaftMat: 'marble' });
    c.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(T.x + Math.cos(a) * (T.rOut - 0.1), by, T.z + Math.sin(a) * (T.rOut - 0.1)), true);
    ctx.col.circle(T.x + Math.cos(a) * (T.rOut - 0.1), T.z + Math.sin(a) * (T.rOut - 0.1), 0.25, by - 0.5, by + 4);
  }
  p.add('stone', lathe([[T.rOut + 0.2, by + 3.6], [T.rOut + 0.35, by + 3.8], [T.rOut + 0.35, by + 4.1]], 24).translate(T.x, 0, T.z));
  const dp = [];
  for (let i = 0; i <= 12; i++) {
    const th = (i / 12) * Math.PI / 2;
    dp.push([(T.rOut + 0.3) * Math.cos(th) + 0.001, by + 4.1 + 2.6 * Math.sin(th)]);
  }
  p.add('domeBlue', lathe(dp, 24).translate(T.x, 0, T.z));
  finial(p, T.x, by + 6.7, T.z, 0.35, 'gold');
  // bell hanging in the belvedere
  const bell = new Parts();
  bell.add('bronze', lathe([[0.001, 0], [0.62, 0.02], [0.56, 0.2], [0.38, 0.62], [0.3, 0.95], [0.001, 1.02]], 20));
  bell.add('iron', xf(new THREE.BoxGeometry(0.08, 0.5, 0.08), { y: 1.2 }));
  bell.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(T.x, by + 2.2, T.z), true);
  ctx.world.bell = new THREE.Vector3(T.x, by + 2.7, T.z);
  // roof collar where the turret meets the transept roof line
  p.add('gold', xf(new THREE.TorusGeometry(T.rOut + 0.02, 0.06, 6, 32), { rx: Math.PI / 2, x: T.x, y: 35.6, z: T.z }));
  p.toBatcher(ctx.B, zone);
  ctx.anchors.turret = new THREE.Vector3(T.x, 0, T.z);
  return flames;
}
