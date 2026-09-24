import * as THREE from 'three';
import { L } from '../layout.js';
import { Parts, colonnette, clusteredPier, rectOutline, archOpening, archivolt, pinnacle, gable, PROFILES, archOffsetPoints, archTo3D, roll, outlineWithNotches } from '../../arch/components.js';
import { ribVault } from '../../arch/vaults.js';
import { xf, cyl, lathe, polyLathe, TAU, rng } from '../../arch/geom.js';
import { WallFrame, slab, hMould, lbox, lBalustrade } from './common.js';
import { madonnaParts, angelParts, pedestalParts, flowerUrnParts, candlestickParts } from '../props/protos.js';
import { lanternParts } from '../landscape/Site.js';

export const LOGGIA = {
  x0: -(L.aisleWallC + L.aisleWallT / 2), // -15.9 inner face (aisle wall exterior)
  x1: -22.5, // arcade line
  z0: -L.bay, // behind the tower
  z1: L.crossZ0 + 0.6, // transept west wall
  spring: 8.0,
  apex: 12.5,
  roof: 14.2,
};

export function buildLoggia(ctx) {
  const zone = 'loggia';
  const { x0, x1, z0, z1 } = LOGGIA;
  const span = Math.abs(x1 - x0);
  const cx = (x0 + x1) / 2;
  const flames = [];
  const bays = Math.round((z0 - z1) / L.bay);
  const blen = (z0 - z1) / bays;
  const p = new Parts();
  // outer arcade frame: +b faces the loggia interior (+x)
  const fo = new WallFrame(new THREE.Vector3(x1 - 0.5, 0, 0), new THREE.Vector3(1, 0, 0));
  for (let i = 0; i < bays; i++) {
    const zA = z0 - i * blen, zB = zA - blen;
    // vault
    const v = ribVault({ span, len: blen, y0: LOGGIA.spring, y1: LOGGIA.apex, endRib: i === bays - 1, segX: 20, segT: 8 });
    v.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(cx, 0, zA));
    // two arches per bay on the arcade
    const aA = fo.aOf(new THREE.Vector3(0, 0, zA)), aB = fo.aOf(new THREE.Vector3(0, 0, zB));
    const amin = Math.min(aA, aB), amax = Math.max(aA, aB);
    const holes = [];
    const notches = [];
    const sub = (amax - amin) / 2;
    for (let k = 0; k < 2; k++) {
      const ca = amin + sub * (k + 0.5);
      notches.push({ ca, span: sub - 0.9, k: 0.72, spring: 5.6, segs: 16 });
      archivolt(p, ca, 5.6, sub - 0.9, 0.72, 0.5, { rolls: [0.1], rollR: 0.06, segs: 16 });
      archivolt(p, ca, 5.6, sub - 0.9, 0.72, -0.5, { dir: -1, rolls: [0.1], rollR: 0.06, segs: 16 });
    }
    // oculi above the arches
    const oc = [];
    for (let j = 0; j < 20; j++) {
      const a = (j / 20) * TAU;
      oc.push([(amin + amax) / 2 + Math.cos(a) * 0.9, 10.4 + Math.sin(a) * 0.9]);
    }
    holes.push(oc);
    slab(ctx, zone, fo, outlineWithNotches(amin, amax, 0, LOGGIA.roof, notches), holes, 1.0);
    // columns between arches (clustered) and at bay lines
    for (let k = 0; k <= 2; k++) {
      if (k === 2 && i < bays - 1) continue;
      const a = amin + sub * k;
      const wp = fo.world(a, 0, 0);
      const col = clusteredPier({ height: 5.6, core: 0.3, shaftR: 0.1, shafts: 8, scale: 0.9, shaftMat: 'marble' });
      col.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(wp.x, 0, wp.z));
      ctx.col.circle(wp.x, wp.z, 0.6, -1, 10);
      // blossoms climbing the capitals
      const fl = flowerUrnParts(20 + i * 3 + k, 1.25);
      delete fl.map.gold;
      fl.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(wp.x, 5.0, wp.z), true);
    }
    // balustrades in the arch openings (the middle bay stays open onto the garden axis)
    const open = i === Math.floor(bays / 2);
    if (!open) {
      for (let k = 0; k < 2; k++) {
        const ca = amin + sub * (k + 0.5);
        lBalustrade(ctx, zone, fo, ca - (sub - 0.9) / 2 + 0.05, ca + (sub - 0.9) / 2 - 0.05, 0, 0, { h: 1.0, spacing: 0.26, railW: 0.26, proto: 'balusterMarble' });
      }
      ctx.col.wall(x1 - 0.5 + 0.55, zA, x1 - 0.5 + 0.55, zB, -1, 2);
    } else {
      for (let k = 0; k <= 2; k++) {
        const wz = zA - sub * k;
        ctx.col.wall(x1 - 0.5 + 0.55, wz + 0.45, x1 - 0.5 + 0.55, wz - 0.45, -1, 10);
      }
    }
    // hanging lantern at the boss
    ctx.inst.add('hangLantern', new THREE.Matrix4().makeTranslation(cx, LOGGIA.apex - 4.2, zA - blen / 2), zone);
    ctx.anchors.lights.push({ pos: new THREE.Vector3(cx, LOGGIA.apex - 3.8, zA - blen / 2), intensity: 9, color: new THREE.Color(0xffb366), radius: 12 });

    // inner wall furnishing between the aisle windows: saints, candles, kneelers
    const zc = zA - blen / 2;
    const zs = zA - 0.15;
    if (i > 0) {
      const ped = pedestalParts(1.3, 0.7);
      ped.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(x0 - 0.6, 0, zs).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)), true);
      const st = i % 2 ? madonnaParts({ scale: 0.95 }) : angelParts({ scale: 0.95 });
      st.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(x0 - 0.6, 1.3, zs).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)), true);
      ctx.col.circle(x0 - 0.6, zs, 0.6, -1, 4);
    }
    // candle table with candlesticks under each window
    const tbl = new Parts();
    tbl.add('marble', xf(new THREE.BoxGeometry(0.7, 0.95, 2.2), { y: 0.475 }));
    tbl.add('gold', xf(new THREE.BoxGeometry(0.72, 0.05, 2.22), { y: 0.93 }));
    tbl.add('linen', xf(new THREE.BoxGeometry(0.74, 0.02, 2.3), { y: 0.96 }));
    tbl.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(x0 - 0.45, 0, zc), true);
    ctx.col.box(x0 - 0.85, zc - 1.15, x0, zc + 1.15, -1, 1.2);
    const cs = candlestickParts(0.55);
    if (!ctx.inst.has('smallCandle')) ctx.inst.define('smallCandle', cs.parts);
    for (let k = 0; k < 5; k++) {
      const z = zc - 0.8 + k * 0.4;
      ctx.inst.addAt('smallCandle', x0 - 0.45, 0.97, z, 0, 1, zone);
      flames.push(cs.flames[0].clone().add(new THREE.Vector3(x0 - 0.45, 0.97, z)));
    }
    ctx.anchors.lights.push({ pos: new THREE.Vector3(x0 - 1.0, 1.8, zc), intensity: 4, color: new THREE.Color(0xffa050), radius: 7 });
    const fl = flowerUrnParts(40 + i, 0.8);
    fl.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(x0 - 0.45, 0.97, zc - 1.0), true);
    fl.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(x0 - 0.45, 0.97, zc + 1.0), true);
    // kneeler
    const kn = new Parts();
    kn.add('wood', xf(new THREE.BoxGeometry(0.5, 0.18, 1.4), { y: 0.09 }));
    kn.add('velvet', xf(new THREE.BoxGeometry(0.44, 0.06, 1.3), { y: 0.21 }));
    kn.add('wood', xf(new THREE.BoxGeometry(0.2, 0.95, 1.4), { x: -0.25, y: 0.48 }));
    kn.add('gold', xf(new THREE.BoxGeometry(0.22, 0.04, 1.42), { x: -0.25, y: 0.96 }));
    kn.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(x0 - 2.0, 0, zc), true);
    ctx.col.box(x0 - 2.4, zc - 0.75, x0 - 1.7, zc + 0.75, -1, 1);
    // wall responds on the aisle-wall side
    const resp = colonnette({ height: LOGGIA.spring, r: 0.22 });
    resp.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(x0 - 0.2, 0, zA), true);

    // buttress piers above the loggia roof carrying the flying buttresses
    if (i < bays) {
      const bx = x1 - 1.2, bz = zB;
      if (i < bays - 1) {
        const b = new Parts();
        b.add('stone', xf(new THREE.BoxGeometry(2.0, 8.5, 1.4), { y: LOGGIA.roof + 4.25 }));
        b.add('gold', xf(new THREE.BoxGeometry(2.04, 0.08, 1.44), { y: LOGGIA.roof + 8.1 }));
        const pn = pinnacle({ w: 1.1, shaftH: 2.6, spireH: 4 });
        pn.transform(new THREE.Matrix4().makeTranslation(0, LOGGIA.roof + 8.5, 0));
        b.merge(pn);
        b.toBatcher(ctx.B, 'ext', new THREE.Matrix4().makeTranslation(bx, 0, bz));
        flyerNorth(p, new THREE.Vector3(bx + 1.0, LOGGIA.roof + 7.0, bz), new THREE.Vector3(-L.naveHalf - L.wallT / 2 - 0.02, 29.5, bz));
      }
    }
  }
  // flat roof with parapet
  p.add('slate', xf(new THREE.BoxGeometry(span + 1.4, 0.4, z0 - z1), { x: cx - 0.2, y: LOGGIA.roof + 0.2, z: (z0 + z1) / 2 }));
  p.toBatcher(ctx.B, zone);
  // floor + collision: aisle wall outer face (doors in bays 1 and 5), transept wall with door
  ctx.col.floor(x1 - 0.2, z0, x0, z1, 0);
  const doorZ = [1, 5].map((i) => -L.bay * i - L.bay / 2);
  let zc = L.westT;
  for (const dz of doorZ) {
    ctx.col.wall(x0, zc, x0, dz + 1.3, -1, 20);
    zc = dz - 1.3;
  }
  ctx.col.wall(x0, zc, x0, z1, -1, 20);
  const tdx = -(L.naveHalf + L.bay * 1.5);
  ctx.col.wall(x0, z1, tdx + 1.2, z1, -1, 20);
  ctx.col.wall(tdx - 1.2, z1, x1 - 0.5, z1, -1, 20);
  ctx.world.loggiaFloor = [[x1 - 0.5, z0], [x0, z0], [x0, z1], [x1 - 0.5, z1]];
  // passage through the tower base from the front terrace into the loggia
  ctx.col.floor(x1 - 0.5, L.westT + 0.2, x0, z0, 0);
  return flames;
}

function flyerNorth(p, outer, inner) {
  const dx = inner.x - outer.x, dz = inner.z - outer.z;
  const run = Math.hypot(dx, dz);
  const rise = inner.y - outer.y;
  const th = 0.9;
  const top = (x) => th + (rise - th * 0.2) * (x / run);
  const thick = (x) => 0.8 + 1.5 * (1 - Math.sin((Math.PI * x) / run));
  const s = new THREE.Shape();
  s.moveTo(0, top(0) - thick(0));
  s.lineTo(0, top(0));
  s.lineTo(run, top(run));
  for (let i = 0; i <= 18; i++) {
    const x = run * (1 - i / 18);
    s.lineTo(x, top(x) - thick(x));
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.8, bevelEnabled: false });
  g.translate(0, 0, -0.4);
  xf(g, { ry: -Math.atan2(dz, dx) });
  xf(g, { x: outer.x, y: outer.y, z: outer.z });
  p.add('stone', g);
}

export function hangLanternParts() {
  const p = new Parts();
  p.add('gold', cyl(0.012, 0.012, 3.2, 4, 0, 1.0, 0));
  p.add('gold', polyLathe([[0.05, 0.9], [0.32, 0.72], [0.34, 0.66]], 6, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    p.add('gold', xf(new THREE.BoxGeometry(0.03, 0.66, 0.03), { x: Math.cos(a) * 0.3, y: 0.33, z: Math.sin(a) * 0.3 }));
  }
  p.add('lampGlass', polyLathe([[0.27, 0.02], [0.3, 0.33], [0.3, 0.64]], 6, 0, false));
  p.add('glowWarm', xf(new THREE.SphereGeometry(0.12, 10, 8), { y: 0.33 }));
  p.add('gold', polyLathe([[0.32, 0.0], [0.34, -0.04], [0.02, -0.28]], 6, 0));
  return p;
}
