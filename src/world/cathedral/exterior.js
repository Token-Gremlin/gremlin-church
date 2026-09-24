import * as THREE from 'three';
import { L } from '../layout.js';
import {
  Parts, pinnacle, spire, gable, finial, archOpening, archivolt, rectOutline, wallSlab, colonnette, gothicWindow, roseWindow,
  archOffsetPoints, archTo3D, roll, PROFILES, mouldingAlong,
} from '../../arch/components.js';
import { xf, cyl, lathe, polyLathe, extrude, TAU, archPoints, archRise, sweepPlanar } from '../../arch/geom.js';
import { WallFrame, slab, hMould, lbox, lBalustrade, addGlass } from './common.js';
import { CROSS } from './crossing.js';
import { apseVertices, APSE } from './choir.js';
import { PORTAL } from './west.js';
import { angelParts, madonnaParts } from '../props/protos.js';

const RIDGE = 41.5;
const EAVE = L.eave;
const OUT = L.naveHalf + L.wallT / 2; // 8.1

/** Gable roof along an axis. Local: x across (±halfW at eave), running from s0 to s1 along the axis. */
function gableRoof(p, { axis = 'z', c = 0, s0, s1, halfW = OUT + 0.35, eave = EAVE + 0.1, ridge = RIDGE, t = 0.35 }) {
  const len = Math.abs(s1 - s0);
  const mid = (s0 + s1) / 2;
  const slope = Math.atan2(ridge - eave, halfW);
  const w = Math.hypot(halfW, ridge - eave);
  for (const side of [-1, 1]) {
    const g = new THREE.BoxGeometry(w + 0.3, t, len);
    xf(g, { x: side * (halfW / 2), y: (eave + ridge) / 2 - t / 2, rz: side * slope });
    if (axis === 'z') xf(g, { x: c, z: mid });
    else {
      xf(g, { ry: Math.PI / 2 });
      xf(g, { x: mid, z: c });
    }
    p.add('slate', g);
  }
  const crest = new THREE.BoxGeometry(0.3, 0.3, len);
  xf(crest, { y: ridge + 0.05 });
  if (axis === 'z') xf(crest, { x: c, z: mid });
  else xf(crest, { ry: Math.PI / 2, x: mid, z: c });
  p.add('gold', crest);
  // gilded cresting ornaments along the ridge
  const n = Math.floor(len / 1.2);
  for (let i = 0; i <= n; i++) {
    const s = s0 + (s1 - s0) * (i / n);
    const orn = new THREE.OctahedronGeometry(0.22, 0);
    xf(orn, { sy: 2.0, y: ridge + 0.55 });
    if (axis === 'z') xf(orn, { x: c, z: s });
    else xf(orn, { x: s, z: c });
    p.add('gold', orn);
  }
}

/** Stepped buttress pier with setbacks, crowned by a pinnacle. dir = outward unit (x,z). */
function buttress(p, x, z, dx, dz, { w = 1.4, depth = 2.6, h = 20, pin = 6, y0 = 0 } = {}) {
  const ang = Math.atan2(dx, dz);
  const q = new Parts();
  const steps = [[depth, h * 0.42], [depth * 0.8, h * 0.72], [depth * 0.6, h]];
  let yPrev = 0;
  for (const [d, yTop] of steps) {
    q.add('stone', xf(new THREE.BoxGeometry(w, yTop - yPrev, d), { y: (yPrev + yTop) / 2, z: d / 2 }));
    // sloped weathering
    const wedge = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(d, 0), new THREE.Vector2(0, 0.7)]);
    const wg = extrude(wedge, w);
    xf(wg, { ry: -Math.PI / 2 });
    xf(wg, { y: yTop, x: 0 });
    q.add('stone', wg);
    yPrev = yTop;
  }
  q.add('gold', xf(new THREE.BoxGeometry(w + 0.04, 0.08, depth * 0.6 + 0.04), { y: h - 0.4, z: depth * 0.3 }));
  const pn = pinnacle({ w: w * 0.8, shaftH: pin * 0.4, spireH: pin * 0.6 });
  pn.transform(new THREE.Matrix4().makeTranslation(0, h + 0.1, depth * 0.3));
  q.merge(pn);
  // statue niche on the face
  const m = new THREE.Matrix4().makeRotationY(ang);
  m.setPosition(x, y0, z);
  p.merge(q, m);
}

/** Flying buttress from pier top (outer) to wall (inner). Both are world points; width along perpendicular. */
function flyer(p, outer, inner, w = 0.8) {
  const dx = inner.x - outer.x, dz = inner.z - outer.z;
  const run = Math.hypot(dx, dz);
  const rise = inner.y - outer.y;
  const shape = new THREE.Shape();
  const th = 0.9;
  const top = (x) => th + (rise - th * 0.2) * (x / run);
  const thick = (x) => 0.75 + 1.3 * (1 - Math.sin((Math.PI * x) / run));
  shape.moveTo(0, top(0) - thick(0));
  shape.lineTo(0, top(0));
  shape.lineTo(run, top(run));
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const x = run * (1 - i / n);
    shape.lineTo(x, top(x) - thick(x));
  }
  const g = extrude(shape, w);
  const ang = Math.atan2(dz, dx);
  xf(g, { ry: -ang });
  xf(g, { x: outer.x, y: outer.y, z: outer.z });
  p.add('stone', g);
  // crockets along the top
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const c = new THREE.IcosahedronGeometry(0.18, 0);
    xf(c, { x: outer.x + dx * t, y: outer.y + th + (rise - th * 0.2) * t + 0.1, z: outer.z + dz * t, sy: 0.7 });
    p.add('stone', c);
  }
}

function parapet(ctx, zone, x0, z0, x1, z1, y, h = 1.0) {
  const f = new Parts();
  const list = [];
  const dx = x1 - x0, dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  const ang = Math.atan2(dz, dx);
  const box = (hh, yy, w) => {
    const g = new THREE.BoxGeometry(len, hh, w);
    xf(g, { x: len / 2, y: yy + hh / 2 });
    xf(g, { ry: -ang });
    xf(g, { x: x0, y, z: z0 });
    return g;
  };
  f.add('stone', box(0.16, 0, 0.5));
  f.add('stone', box(0.16, h - 0.16, 0.45));
  f.add('gold', box(0.04, h - 0.2, 0.47));
  const n = Math.floor(len / 0.32);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    list.push(new THREE.Matrix4().compose(new THREE.Vector3(x0 + dx * t, y + 0.16, z0 + dz * t), new THREE.Quaternion(), new THREE.Vector3(1, (h - 0.32) / 0.72, 1)));
  }
  f.toBatcher(ctx.B, zone);
  for (const m of list) ctx.inst.add('baluster', m, zone);
}

export function buildExterior(ctx) {
  const zone = 'ext';
  const p = new Parts();
  const towerZ1 = -L.bay; // towers occupy the first aisle bay
  // ---------------------------------------------------------------- Roofs
  gableRoof(p, { axis: 'z', s0: L.westT - 0.2, s1: L.crossZ0 - 0.3 });
  gableRoof(p, { axis: 'z', s0: L.crossZ1 + 0.3, s1: APSE.cz });
  for (const s of [-1, 1]) gableRoof(p, { axis: 'x', c: CROSS.cz, s0: s * (OUT + 0.3), s1: s * (L.transEnd + 0.8) });
  // apse half-pyramid
  {
    const vs = apseVertices(OUT + 0.35);
    for (let i = 0; i < vs.length - 1; i++) {
      const a = vs[i], b = vs[i + 1];
      const g = new THREE.BufferGeometry();
      const pos = [a.x, EAVE + 0.1, a.z, b.x, EAVE + 0.1, b.z, 0, RIDGE, APSE.cz];
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex([0, 2, 1]);
      g.computeVertexNormals();
      if (g.attributes.normal.getY(0) < 0) g.setIndex([0, 1, 2]);
      g.computeVertexNormals();
      p.add('slate', g);
      const g2 = g.clone();
      g2.translate(0, -0.3, 0);
      g2.setIndex([...g.index.array].reverse());
      g2.computeVertexNormals();
      p.add('slate', g2);
    }
    finial(p, 0, RIDGE + 0.2, APSE.cz, 0.8, 'gold');
  }
  // aisle lean-to roofs (behind the towers)
  for (const s of [-1, 1]) {
    const x0 = s * (L.aisleWallC + L.aisleWallT / 2 + 0.2), x1 = s * (OUT + 0.05);
    const y0 = L.aisleEave + 0.1, y1 = 18.9;
    const run = Math.abs(x1 - x0);
    const w = Math.hypot(run, y1 - y0);
    const len = towerZ1 - L.crossZ0;
    const g = new THREE.BoxGeometry(w, 0.3, len);
    xf(g, { rz: -s * Math.atan2(y1 - y0, run) * -1 });
    xf(g, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (towerZ1 + L.crossZ0) / 2 });
    p.add('slate', g);
  }
  // crossing platform and parapet around the drum, open over the drum so the dome shows from the floor
  const platform = new THREE.Shape([new THREE.Vector2(-8.3, -8.3), new THREE.Vector2(8.3, -8.3), new THREE.Vector2(8.3, 8.3), new THREE.Vector2(-8.3, 8.3)]);
  platform.holes.push(new THREE.Path().absarc(0, 0, CROSS.c + 0.4, 0, TAU, true));
  p.add('slate', xf(extrude(platform, 0.4, { curveSegments: 48 }), { rx: -Math.PI / 2, y: CROSS.ring + 0.2, z: CROSS.cz }));
  for (const [ax, az, bx, bz] of [[-8.3, -59.2, 8.3, -59.2], [8.3, -59.2, 8.3, -75.8], [8.3, -75.8, -8.3, -75.8], [-8.3, -75.8, -8.3, -59.2]]) parapet(ctx, zone, ax, az, bx, bz, CROSS.ring + 0.4, 1.0);
  for (const [x, z] of [[-8.3, -59.2], [8.3, -59.2], [8.3, -75.8], [-8.3, -75.8]]) {
    const pn = pinnacle({ w: 1.1, shaftH: 3.2, spireH: 5.5 });
    pn.transform(new THREE.Matrix4().makeTranslation(x, CROSS.ring + 0.4, z));
    p.merge(pn);
  }

  // --------------------------------------------------------- Parapets & gables
  for (const s of [-1, 1]) {
    parapet(ctx, zone, s * OUT, towerZ1, s * OUT, L.crossZ0 - 0.6, EAVE, 1.0);
    parapet(ctx, zone, s * OUT, L.crossZ1 + 0.6, s * OUT, APSE.cz, EAVE, 1.0);
    parapet(ctx, zone, s * (L.aisleWallC + L.aisleWallT / 2 - 0.25), towerZ1, s * (L.aisleWallC + L.aisleWallT / 2 - 0.25), L.crossZ0 + 0.1, L.aisleEave, 0.9);
    for (const zz of [L.crossZ0 + 0.6, L.crossZ1 - 0.6]) parapet(ctx, zone, s * (OUT + 0.4), zz, s * (L.transEnd + 0.8), zz, EAVE, 1.0);
  }
  {
    const vs = apseVertices(OUT - 0.25);
    for (let i = 0; i < vs.length - 1; i++) parapet(ctx, zone, vs[i].x, vs[i].z, vs[i + 1].x, vs[i + 1].z, EAVE, 1.0);
  }
  // transept end gables with small rose-like oculus and pinnacled corners
  for (const s of [-1, 1]) {
    const f = new WallFrame(new THREE.Vector3(s * L.transEnd, 0, CROSS.cz), new THREE.Vector3(-s, 0, 0));
    const gp = new Parts();
    gable(gp, { ca: 0, y0: EAVE, w: 17.2, h: RIDGE - EAVE + 2.2, b: 0, t: 1.4, trefoil: true });
    gp.toBatcher(ctx.B, zone, f.m);
    for (const zz of [L.crossZ0 + 0.1, L.crossZ1 - 0.1]) {
      const t = new Parts();
      t.add('stone', polyLathe([[1.3, 0], [1.3, EAVE + 5]], 8, Math.PI / 8, true));
      for (let k = 0; k < 4; k++) t.add('stoneShade', polyLathe([[1.32, 12 + k * 7], [1.32, 15 + k * 7]], 8, Math.PI / 8, false));
      t.add('gold', polyLathe([[1.34, EAVE - 0.4], [1.34, EAVE - 0.2]], 8, Math.PI / 8, false));
      const sp = new Parts();
      spire(sp, { r: 1.25, h: 7.5, crockets: 5 });
      t.merge(sp, new THREE.Matrix4().makeTranslation(0, EAVE + 5, 0));
      t.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(s * (L.transEnd + 0.9), 0, zz + (zz > CROSS.cz ? 0.9 : -0.9)));
    }
  }

  // ------------------------------------------------------ Buttresses & flyers
  for (const s of [-1, 1]) {
    for (let i = 1; i <= L.naveBays; i++) {
      const z = -i * L.bay;
      if (s < 0) continue; // north side buttresses stand on the loggia (built with the loggia)
      const x = s * (L.aisleWallC + L.aisleWallT / 2);
      buttress(p, x, z, s, 0, { h: 21, pin: 6.5, depth: 2.6 });
      if (i < L.naveBays) flyer(p, new THREE.Vector3(x + s * 1.2, 20.2, z), new THREE.Vector3(s * (OUT + 0.02), 29.5, z), 0.8);
    }
    // choir buttresses
    for (let i = 1; i < L.choirBays; i++) {
      const z = L.crossZ1 - i * L.bay;
      buttress(p, s * OUT, z, s, 0, { h: 31, pin: 7, depth: 2.4, w: 1.3 });
    }
    // transept wall buttresses
    for (let j = 1; j < L.transBays; j++) {
      const x = s * (L.naveHalf + j * L.bay);
      if (!(s > 0 && j === 1)) buttress(p, x, L.crossZ1 - 0.6, 0, -1, { h: 31, pin: 7, depth: 2.2, w: 1.3 });
      if (!(s < 0 && j === 1)) buttress(p, x, L.crossZ0 + 0.6, 0, 1, { h: 31, pin: 7, depth: 2.2, w: 1.3 });
    }
  }
  {
    const vs = apseVertices(OUT);
    for (let i = 1; i < vs.length - 1; i++) {
      const v = vs[i];
      const d = new THREE.Vector2(v.x, v.z - APSE.cz).normalize();
      buttress(p, v.x, v.z, d.x, d.y, { h: 31, pin: 7.5, depth: 2.8, w: 1.2 });
    }
  }

  // --------------------------------------------------------- Drum & dome
  buildDome(ctx, p);

  // ------------------------------------------------------------- Façade
  buildFacade(ctx, p, towerZ1);

  p.toBatcher(ctx.B, zone);
}

function buildDome(ctx, p) {
  const cz = CROSS.cz;
  let R = CROSS.c + 1.15;
  // outer drum: 16 buttress-columns with pinnacles and gilded cornice
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU + TAU / 32;
    const x = Math.cos(a) * (R + 0.3), z = cz + Math.sin(a) * (R + 0.3);
    const c = colonnette({ height: CROSS.drumTop - CROSS.ring - 0.6, r: 0.32, shaftMat: 'stone' });
    c.transform(new THREE.Matrix4().makeTranslation(x, CROSS.ring + 0.6, z));
    p.merge(c);
  }
  const ring = (r, y, n = 96) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = -(i / n) * TAU;
      pts.push([Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
    return pts;
  };
  p.add('stone', mouldingAlong(ring(R, 0), CROSS.drumTop, PROFILES.cornice, true));
  p.add('gold', mouldingAlong(ring(R + 0.2, 0), CROSS.drumTop + 0.55, [[-0.05, 0], [-0.05, 0.1], [0.05, 0.1], [0.05, 0]], true));
  // upper drum (outer shell only) on a corbelled cornice: blind arcade with gilded oculi
  const R0 = R;
  R = CROSS.c + 3.0;
  p.add('stone', xf(lathe([[R0 - 0.3, CROSS.drumTop - 0.2], [R0 + 0.4, CROSS.drumTop + 0.1], [R - 0.6, CROSS.drumTop + 0.9], [R + 0.35, CROSS.drumTop + 1.2], [R + 0.35, CROSS.drumTop + 1.5]], 64), { z: cz }));
  p.add('gold', xf(new THREE.TorusGeometry(R + 0.36, 0.07, 6, 96), { rx: Math.PI / 2, y: CROSS.drumTop + 1.35, z: cz }));
  const y2 = CROSS.drumTop + 1.5, h2 = 7.5;
  p.add('stone', xf(new THREE.CylinderGeometry(R - 0.2, R - 0.2, h2, 48, 1, true), { y: y2 + h2 / 2, z: cz }));
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU;
    const x = Math.cos(a) * (R + 0.05), z = cz + Math.sin(a) * (R + 0.05);
    const c = colonnette({ height: h2 - 0.2, r: 0.22, shaftMat: 'marble' });
    c.transform(new THREE.Matrix4().makeTranslation(x, y2, z));
    p.merge(c);
    const a2 = a + TAU / 32;
    const ox = Math.cos(a2) * (R - 0.15), oz = cz + Math.sin(a2) * (R - 0.15);
    const ocu = new THREE.TorusGeometry(0.55, 0.09, 6, 16);
    xf(ocu, { ry: -a2 + Math.PI / 2, x: ox, y: y2 + h2 * 0.62, z: oz });
    p.add('gold', ocu);
    const disc = new THREE.CircleGeometry(0.5, 16);
    xf(disc, { ry: -a2 + Math.PI / 2, x: ox + Math.cos(a2) * 0.02, y: y2 + h2 * 0.62, z: oz + Math.sin(a2) * 0.02 });
    p.add('lampGlass', disc);
  }
  p.add('stone', mouldingAlong(ring(R + 0.1, 0), y2 + h2, PROFILES.cornice, true));
  p.add('gold', mouldingAlong(ring(R + 0.3, 0), y2 + h2 + 0.5, [[-0.05, 0], [-0.05, 0.1], [0.05, 0.1], [0.05, 0]], true));
  // outer dome: tall, slightly pointed, blue with gilded ribs
  const H = 27;
  const RD = R + 0.1;
  const prof = [];
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const th = t * Math.PI / 2;
    const r = RD * Math.cos(th) * (1 - 0.06 * Math.sin(th * 2));
    const y = y2 + h2 + 0.6 + H * Math.pow(Math.sin(th), 0.9);
    prof.push([Math.max(r, 1.6), y]);
  }
  prof.push([1.6, prof[prof.length - 1][1]]);
  const domeGeo = lathe(prof, 64);
  xf(domeGeo, { z: cz });
  p.add('domeBlue', domeGeo);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU;
    const pts = prof.slice(0, -1).map(([r, y]) => new THREE.Vector3(Math.cos(a) * (r + 0.05), y, cz + Math.sin(a) * (r + 0.05)));
    p.add('gold', roll(pts, 0.14, 6));
  }
  for (let j = 1; j < 4; j++) {
    const [r, y] = prof[j * 6];
    const t = new THREE.TorusGeometry(r + 0.06, 0.08, 6, 96);
    xf(t, { rx: Math.PI / 2, y, z: cz });
    p.add('gold', t);
  }
  // lantern
  const topY = prof[prof.length - 1][1];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    const c = colonnette({ height: 5.2, r: 0.16, shaftMat: 'stone' });
    c.transform(new THREE.Matrix4().makeTranslation(Math.cos(a) * 1.8, topY, cz + Math.sin(a) * 1.8));
    p.merge(c);
  }
  p.add('lanternGlow', xf(new THREE.CylinderGeometry(1.45, 1.45, 5.2, 16, 1, true), { y: topY + 2.6, z: cz }));
  p.add('stone', xf(new THREE.CylinderGeometry(2.3, 2.3, 0.5, 24), { y: topY + 5.4, z: cz }));
  p.add('gold', xf(new THREE.CylinderGeometry(2.32, 2.32, 0.1, 24), { y: topY + 5.2, z: cz }));
  const sp = new Parts();
  spire(sp, { r: 1.7, h: 9, sides: 8, crockets: 6, mat: 'domeBlue', crocketMat: 'gold', finialSize: 1.0 });
  p.merge(sp, new THREE.Matrix4().makeTranslation(0, topY + 5.65, cz));
  // cross/star finial glow
  p.add('gold', xf(new THREE.OctahedronGeometry(0.6, 0), { y: topY + 16.5, z: cz, sy: 1.6 }));
}

function buildFacade(ctx, p, towerZ1) {
  const zone = 'facade';
  const fz = L.westT; // façade face z
  const q = new Parts();
  // Portal frontispiece: splayed archivolts with jamb statues
  for (let k = 0; k < 4; k++) {
    const d = 0.22 + k * 0.36;
    const pts = archTo3D(archOffsetPoints(PORTAL.span, PORTAL.k, d, 24), 0, PORTAL.spring, fz + 0.2 + k * 0.4, 0);
    q.add(k % 2 ? 'gold' : 'stone', roll(pts, k % 2 ? 0.09 : 0.18, 8));
    for (const s of [-1, 1]) {
      const c = colonnette({ height: PORTAL.spring, r: 0.15, shaftMat: 'marble' });
      c.transform(new THREE.Matrix4().makeTranslation(s * (PORTAL.span / 2 + d), 0, fz + 0.2 + k * 0.4));
      q.merge(c);
    }
  }
  // jamb statues on tall pedestals
  const js = angelParts({ scale: 0.85 });
  for (const s of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      const x = s * (PORTAL.span / 2 + 0.4 + k * 0.72);
      const m = new THREE.Matrix4().makeTranslation(x, 3.2, fz + 0.55 + k * 0.4).multiply(new THREE.Matrix4().makeRotationY(-s * 0.9));
      js.toBatcher(ctx.B, zone, m, true);
      const ped = new Parts();
      ped.add('stone', polyLathe([[0.22, 0], [0.22, 3.1], [0.3, 3.2]], 6, 0));
      ped.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(x, 0, fz + 0.55 + k * 0.4));
    }
  }
  const porchW = 12;
  const porchH = PORTAL.spring + 6.0;
  const off = 1.5;
  const outline = [[-porchW / 2, 0], [-PORTAL.span / 2 - off, 0]];
  for (const v of archOffsetPoints(PORTAL.span, PORTAL.k, off, 24)) outline.push([v.x, PORTAL.spring + v.y]);
  outline.push([PORTAL.span / 2 + off, 0], [porchW / 2, 0], [porchW / 2, porchH], [-porchW / 2, porchH]);
  const porch = wallSlab(outline, [], 1.6);
  xf(porch, { z: fz + 0.8 });
  q.add('stone', porch);
  q.add('gold', xf(new THREE.BoxGeometry(porchW + 0.04, 0.1, 1.64), { y: porchH - 0.3, z: fz + 0.8 }));
  // wimperg over the portal
  gable(q, { ca: 0, y0: porchH, w: porchW, h: 3.8, b: fz + 1.4, t: 0.45, crocketMat: 'gold' });
  for (const s of [-1, 1]) {
    const pn = pinnacle({ w: 1.0, shaftH: 4.2, spireH: 4.6 });
    pn.transform(new THREE.Matrix4().makeTranslation(s * (porchW / 2 + 0.2), porchH, fz + 0.9));
    q.merge(pn);
  }
  const angel = angelParts({ scale: 1.2 });
  angel.transform(new THREE.Matrix4().makeTranslation(0, PORTAL.spring, fz - 0.12));
  q.merge(angel);
  // Gallery of statues (angels) across the central bay
  const gy = 14.6;
  q.add('stone', xf(new THREE.BoxGeometry(16.4, 0.5, 1.4), { y: gy, z: fz + 0.7 }));
  q.add('gold', xf(new THREE.BoxGeometry(16.44, 0.08, 1.44), { y: gy + 0.26, z: fz + 0.7 }));
  const ga = angelParts({ scale: 0.95 });
  for (let i = 0; i < 7; i++) {
    const x = -6.3 + i * 2.1;
    if (Math.abs(x) < 3.2) continue;
    ga.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(x, gy + 0.25, fz + 0.9), true);
    const c = new Parts();
    archivolt(c, x, gy + 2.3, 1.6, 0.8, fz + 0.5, { hood: true, rolls: [0.08], rollR: 0.05, segs: 10 });
    c.toBatcher(ctx.B, zone);
  }
  // hood with crockets over the great west window
  const ww = { W: 10, H: 16.5, k: 0.68, y0: 17.2 };
  const hoodPts = archTo3D(archOffsetPoints(ww.W, ww.k, 0.55, 30), 0, ww.y0 + ww.H - archRise(ww.W, ww.k), fz + 0.1, 0);
  q.add('stone', roll(hoodPts, 0.26, 8));
  q.add('gold', roll(archTo3D(archOffsetPoints(ww.W, ww.k, 0.25, 30), 0, ww.y0 + ww.H - archRise(ww.W, ww.k), fz + 0.12, 0), 0.1, 6));
  for (let i = 3; i < hoodPts.length - 3; i += 3) {
    const c = new THREE.IcosahedronGeometry(0.28, 0);
    xf(c, { x: hoodPts[i].x, y: hoodPts[i].y + 0.3, z: hoodPts[i].z, sy: 0.7 });
    q.add('stone', c);
  }
  finial(q, 0, ww.y0 + ww.H + 0.8, fz + 0.1, 0.9, 'gold');
  // central gable with rose
  const gf = new WallFrame(new THREE.Vector3(0, 0, fz - 0.7), new THREE.Vector3(0, 0, -1));
  const rose = roseWindow({ R: 2.5, petals: 12, ca: 0, cy: EAVE + 2.9, b: 0, depth: 0.3 });
  const circle = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU;
    circle.push([Math.cos(a) * 2.75, EAVE + 2.9 + Math.sin(a) * 2.75]);
  }
  const gshape = [[-OUT - 0.4, EAVE], [OUT + 0.4, EAVE], [0, RIDGE + 3.4]];
  slab(ctx, zone, gf, gshape, [circle], 1.4);
  rose.parts.toBatcher(ctx.B, zone, gf.m);
  ctx.glass.add('rose-w', rose.glass.clone().applyMatrix4(gf.m), null);
  // gable crockets and crowning angel
  const gp = new Parts();
  const gl = Math.hypot(OUT + 0.4, RIDGE + 3.4 - EAVE);
  for (const s of [-1, 1]) {
    for (let i = 1; i < 12; i++) {
      const t = i / 12;
      gp.add('stone', xf(new THREE.IcosahedronGeometry(0.3, 0), { x: s * (OUT + 0.4) * (1 - t), y: EAVE + (RIDGE + 3.4 - EAVE) * t + 0.3, z: fz - 0.7, sy: 0.7 }));
    }
  }
  gp.toBatcher(ctx.B, zone);
  void gl;
  const topAngel = angelParts({ scale: 1.5, mat: 'gold' });
  topAngel.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(0, RIDGE + 3.4, fz - 0.7), true);
  // buttresses flanking the central bay
  for (const s of [-1, 1]) {
    const x = s * (OUT + 0.5);
    const b = new Parts();
    b.add('stone', xf(new THREE.BoxGeometry(1.5, EAVE + 2, 2.2), { y: (EAVE + 2) / 2, z: 1.1 }));
    for (let k = 0; k < 4; k++) {
      const y = 6 + k * 8;
      b.add('gold', xf(new THREE.BoxGeometry(1.54, 0.08, 2.24), { y, z: 1.1 }));
      const niche = angelParts({ scale: 0.7 });
      if (k > 0 && k < 4) b.merge(niche, new THREE.Matrix4().makeTranslation(0, y + 0.1, 2.25));
    }
    const pn = pinnacle({ w: 1.3, shaftH: 4.5, spireH: 7 });
    pn.transform(new THREE.Matrix4().makeTranslation(0, EAVE + 2, 1.1));
    b.merge(pn);
    b.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(x, 0, fz));
  }
  // side portals: archivolts and small gables
  for (const s of [-1, 1]) {
    const x = s * PORTAL.sideX;
    for (let k = 0; k < 3; k++) {
      const d = 0.2 + k * 0.3;
      q.add(k % 2 ? 'gold' : 'stone', roll(archTo3D(archOffsetPoints(PORTAL.sideSpan, 0.72, d, 18), x, PORTAL.sideSpring, fz + 0.1 + k * 0.15, PORTAL.sideSpring), k % 2 ? 0.07 : 0.14, 8));
    }
    gable(q, { ca: x, y0: PORTAL.sideSpring + 2.4, w: 4.6, h: 4.2, b: fz + 0.4, t: 0.4, crocketMat: 'gold' });
  }
  q.toBatcher(ctx.B, zone);

  // Twin towers over the first aisle bays
  for (const s of [-1, 1]) buildTower(ctx, s, towerZ1);
}

function buildTower(ctx, s, towerZ1) {
  const zone = 'towers';
  const x0 = s * OUT, x1 = s * (L.aisleWallC + L.aisleWallT / 2 + 0.5);
  const xc = (x0 + x1) / 2;
  const hw = Math.abs(x1 - x0) / 2;
  const z0 = L.westT, z1 = towerZ1;
  const zc = (z0 + z1) / 2;
  const hd = Math.abs(z0 - z1) / 2;
  const yA = L.aisleEave, yB = 47;
  const t = new Parts();
  // tower walls with tall paired belfry openings
  const faces = [
    { o: new THREE.Vector3(xc, 0, z0 - 0.6), n: new THREE.Vector3(0, 0, -1), w: hw },
    { o: new THREE.Vector3(xc, 0, z1 + 0.6), n: new THREE.Vector3(0, 0, 1), w: hw },
    { o: new THREE.Vector3(x1 - s * 0.6, 0, zc), n: new THREE.Vector3(-s, 0, 0), w: hd },
    { o: new THREE.Vector3(x0 + s * 0.6, 0, zc), n: new THREE.Vector3(s, 0, 0), w: hd },
  ];
  for (const fc of faces) {
    const f = new WallFrame(fc.o, fc.n);
    const holes = [];
    for (const off of [-1.3, 1.3]) holes.push(archOpening(off, 36.5, 1.7, 0.8, 42.5, 14));
    const blind = [];
    slab(ctx, zone, f, rectOutline(-fc.w - 0.6, fc.w + 0.6, yA, yB), holes, 1.2);
    const fp = new Parts();
    for (const off of [-1.3, 1.3]) {
      archivolt(fp, off, 42.5, 1.7, 0.8, -0.6, { dir: -1, rolls: [0.1], rollR: 0.06, segs: 14 });
      // blind lancets on the middle stage
      archivolt(fp, off, 30.5, 1.7, 0.8, -0.6, { dir: -1, rolls: [0.08], rollR: 0.05, segs: 14, leg: 9 });
    }
    gable(fp, { ca: 0, y0: 45.2, w: fc.w * 2 - 0.4, h: 4.4, b: -0.7, t: 0.35, crocketMat: 'gold' });
    hMould(fp, -fc.w - 0.6, fc.w + 0.6, 34.2, -0.6, PROFILES.string, 'stone', -1);
    hMould(fp, -fc.w - 0.6, fc.w + 0.6, 21.5, -0.6, PROFILES.string, 'stone', -1);
    lbox(fp, 'dark', -2.4, 2.4, 36.4, 44.6, 0.4, 0.5);
    fp.toBatcher(ctx.B, zone, f.m);
    void blind;
  }
  t.add('stone', xf(new THREE.BoxGeometry(hw * 2 + 1.4, 0.8, hd * 2 + 1.4), { x: xc, y: yB + 0.4, z: zc }));
  t.add('gold', xf(new THREE.BoxGeometry(hw * 2 + 1.44, 0.1, hd * 2 + 1.44), { x: xc, y: yB + 0.2, z: zc }));
  // corner pinnacles
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const pn = pinnacle({ w: 1.2, shaftH: 4.5, spireH: 6 });
    pn.transform(new THREE.Matrix4().makeTranslation(xc + dx * (hw + 0.2), yB + 0.8, zc + dz * (hd + 0.2)));
    t.merge(pn);
    // angle buttresses down the corners
    const bx = xc + dx * (hw + 0.55), bz = zc + dz * (hd + 0.55);
    t.add('stone', xf(new THREE.BoxGeometry(1.1, yB - 0.5, 1.1), { x: bx, y: (yB - 0.5) / 2, z: bz }));
    for (let k = 1; k < 5; k++) t.add('gold', xf(new THREE.BoxGeometry(1.14, 0.08, 1.14), { x: bx, y: k * 9.5, z: bz }));
  }
  // octagonal belfry lantern
  const R = Math.min(hw, hd) * 0.9;
  const yL = yB + 0.8, hL = 9;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + Math.PI / 8;
    const c = colonnette({ height: hL, r: 0.3, shaftMat: 'stone' });
    c.transform(new THREE.Matrix4().makeTranslation(xc + Math.cos(a) * R, yL, zc + Math.sin(a) * R));
    t.merge(c);
    const a2 = ((k + 0.5) / 8) * TAU + Math.PI / 8;
    const side = 2 * R * Math.sin(Math.PI / 8);
    const f = new WallFrame(new THREE.Vector3(xc + Math.cos(a2) * R * Math.cos(Math.PI / 8), 0, zc + Math.sin(a2) * R * Math.cos(Math.PI / 8)), new THREE.Vector3(-Math.cos(a2), 0, -Math.sin(a2)));
    const fp = new Parts();
    gable(fp, { ca: 0, y0: yL + hL, w: side, h: 2.4, b: 0, t: 0.25, crocketMat: 'gold' });
    archivolt(fp, 0, yL + hL - 2.2, side - 0.5, 0.8, 0, { hood: false, rolls: [0.0], rollR: 0.08, segs: 12 });
    fp.toBatcher(ctx.B, zone, f.m);
  }
  t.add('dark', xf(new THREE.CylinderGeometry(R * 0.55, R * 0.55, hL, 8), { x: xc, y: yL + hL / 2, z: zc }));
  // bells visible in the lantern
  t.add('bronze', xf(lathe([[0.001, 0], [0.9, 0.05], [0.8, 0.3], [0.55, 0.9], [0.45, 1.4], [0.001, 1.5]], 16), { x: xc, y: yL + 3.5, z: zc }));
  // spire
  const sp = new Parts();
  spire(sp, { r: R * 1.02, h: 17, sides: 8, crockets: 9, finialSize: 1.2 });
  t.merge(sp, new THREE.Matrix4().makeTranslation(xc, yL + hL + 0.2, zc));
  for (let k = 0; k < 3; k++) {
    const y = yL + hL + 3 + k * 4;
    const r = R * (1 - (3 + k * 4) / 17);
    const tor = new THREE.TorusGeometry(r + 0.04, 0.07, 6, 8);
    xf(tor, { rx: Math.PI / 2, rz: Math.PI / 8, x: xc, y, z: zc });
    t.add('gold', tor);
  }
  t.toBatcher(ctx.B, zone);
}

/** Outer faces of the basilica for walking around it outside. */
export function exteriorCollision(ctx) {
  const c = ctx.col;
  const A = L.aisleWallC + L.aisleWallT / 2; // 15.9
  const fz = L.westT;
  // façade with portal gaps
  const gaps = [[-PORTAL.sideX - 1.4, -PORTAL.sideX + 1.4], [-2.8, 2.8], [PORTAL.sideX - 1.4, PORTAL.sideX + 1.4]];
  let cur = -A - 0.5;
  for (const [a, b] of gaps) {
    c.wall(cur, fz, a, fz, -5, 60);
    cur = b;
  }
  c.wall(cur, fz, A + 0.5, fz, -5, 60);
  // south aisle, transepts, choir (the north aisle side is handled by the loggia)
  c.wall(A, fz, A, L.crossZ0 + 0.6, -5, 60);
  for (let i = 1; i <= L.naveBays; i++) c.box(A, -i * L.bay - 0.7, A + 2.7, -i * L.bay + 0.7, -5, 30);
  for (const s of [-1, 1]) {
    const xe = s * (L.transEnd + 0.8);
    c.wall(s * A, L.crossZ0 + 0.6, xe, L.crossZ0 + 0.6, -5, 60);
    if (s < 0) {
      c.wall(xe, L.crossZ0 + 0.6, xe, CROSS.cz + 1.8, -5, 60);
      c.wall(xe, CROSS.cz - 1.8, xe, L.crossZ1 - 0.6, -5, 60);
    } else c.wall(xe, L.crossZ0 + 0.6, xe, L.crossZ1 - 0.6, -5, 60);
    c.wall(xe, L.crossZ1 - 0.6, s * OUT, L.crossZ1 - 0.6, -5, 60);
    c.wall(s * OUT, L.crossZ1 - 0.6, s * OUT, APSE.cz, -5, 60);
    for (let i = 1; i < L.choirBays; i++) c.box(Math.min(s * OUT, s * (OUT + 2.4)), L.crossZ1 - i * L.bay - 0.65, Math.max(s * OUT, s * (OUT + 2.4)), L.crossZ1 - i * L.bay + 0.65, -5, 40);
    for (const zz of [L.crossZ0 + 0.1, L.crossZ1 - 0.1]) c.circle(s * (L.transEnd + 0.9), zz + (zz > CROSS.cz ? 0.9 : -0.9), 1.4, -5, 60);
  }
  const vs = apseVertices(OUT);
  for (let i = 0; i < vs.length - 1; i++) c.wall(vs[i].x, vs[i].z, vs[i + 1].x, vs[i + 1].z, -5, 60);
  for (let i = 1; i < vs.length - 1; i++) {
    const v = vs[i];
    const d = new THREE.Vector2(v.x, v.z - APSE.cz).normalize();
    c.circle(v.x + d.x * 1.4, v.z + d.y * 1.4, 1.2, -5, 40);
  }
  // porch and flanking buttresses on the façade
  c.box(-6, fz, -4.3, fz + 1.6, -5, 20);
  c.box(4.3, fz, 6, fz + 1.6, -5, 20);
  for (const s of [-1, 1]) c.box(s * (OUT + 0.5) - 0.75, fz, s * (OUT + 0.5) + 0.75, fz + 2.2, -5, 40);
}

export { RIDGE, OUT };
