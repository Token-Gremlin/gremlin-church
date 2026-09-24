import * as THREE from 'three';
import { L } from '../layout.js';
import { Parts, colonnette, rectOutline, archOpening, archivolt, gothicWindow, PROFILES, pinnacle, roseWindow, outlineWithNotches } from '../../arch/components.js';
import { xf, cyl, lathe, polyLathe, archRise, TAU } from '../../arch/geom.js';
import { WallFrame, slab, hMould, lbox, lBalustrade, addGlass } from './common.js';
import { WEST_WIN } from '../glassDesigns.js';

export const PORTAL = { span: 5.6, k: 0.72, spring: 7.2, sideX: 11.3, sideSpan: 2.8, sideSpring: 4.6 };
export const WEST_AISLE_WIN = { W: 3.2, H: 5.2, k: 0.72, y0: 7.4 };

export function buildWest(ctx) {
  const zone = 'west';
  const T = L.westT;
  // Frame on the wall centre plane; +b faces the interior (−z).
  const f = new WallFrame(new THREE.Vector3(0, 0, T / 2), new THREE.Vector3(0, 0, -1));
  const p = new Parts();
  const holes = [];
  const notches = [{ ca: 0, span: PORTAL.span, k: PORTAL.k, spring: PORTAL.spring, segs: 22 }];
  for (const s of [-1, 1]) notches.push({ ca: s * PORTAL.sideX, span: PORTAL.sideSpan, k: 0.72, spring: PORTAL.sideSpring, segs: 16 });
  const ww = gothicWindow({ W: WEST_WIN.W, H: WEST_WIN.H, k: WEST_WIN.k, lights: 4, ca: 0, y0: WEST_WIN.y0, b: -T / 2 + 0.6, wallT: 1.2, splayW: 0.4, exteriorSplay: true });
  holes.push(ww.hole);
  p.merge(ww.parts);
  const aisleWins = [];
  for (const s of [-1, 1]) {
    const w = gothicWindow({ W: WEST_AISLE_WIN.W, H: WEST_AISLE_WIN.H, k: WEST_AISLE_WIN.k, lights: 2, ca: s * PORTAL.sideX, y0: WEST_AISLE_WIN.y0, b: -T / 2 + 0.6, wallT: 1.2, splayW: 0.28 });
    holes.push(w.hole);
    p.merge(w.parts);
    aisleWins.push(w);
  }
  slab(ctx, zone, f, outlineWithNotches(-L.aisleWallC - L.aisleWallT / 2, L.aisleWallC + L.aisleWallT / 2, 0, L.eave, notches), holes, T);
  // interior splay for the deep window openings (the tracery sits near the exterior face)
  addGlass(ctx, 'west', f, ww, { ca: 0, y0: WEST_WIN.y0, kind: 'west' });
  aisleWins.forEach((w, i) => addGlass(ctx, `aisle-${i + 1}`, f, w, { ca: (i ? 1 : -1) * PORTAL.sideX, y0: WEST_AISLE_WIN.y0, kind: 'aisle' }));

  // Interior archivolts around portals
  archivolt(p, 0, PORTAL.spring, PORTAL.span, PORTAL.k, T / 2, { rolls: [0.14, 0.34], rollR: 0.08 });
  for (const s of [-1, 1]) archivolt(p, s * PORTAL.sideX, PORTAL.sideSpring, PORTAL.sideSpan, 0.72, T / 2, { rolls: [0.1], rollR: 0.05 });
  hMould(p, -L.naveFace, L.naveFace, WEST_WIN.y0 - 0.6, T / 2, PROFILES.string);
  // Tympanum closing the portal head near the exterior face, with a gilded lintel
  const tymp = new THREE.Shape();
  {
    const pts = archOpening(0, PORTAL.spring, PORTAL.span, PORTAL.k, PORTAL.spring, 22);
    tymp.moveTo(pts[0][0], pts[0][1]);
    for (const q of pts) tymp.lineTo(q[0], q[1]);
    tymp.closePath();
  }
  const tg = new THREE.ExtrudeGeometry(tymp, { depth: 0.5, bevelEnabled: false, curveSegments: 4 });
  xf(tg, { z: -T / 2 + 0.2 });
  p.add('goldMosaic', tg);
  lbox(p, 'gold', -PORTAL.span / 2, PORTAL.span / 2, PORTAL.spring - 0.35, PORTAL.spring, -T / 2 + 0.1, T / 2 - 0.2);
  // door leaves swung open against the interior wall
  const leaf = new Parts();
  const lw = PORTAL.span / 2, lh = PORTAL.spring - 0.35;
  leaf.add('bronze', xf(new THREE.BoxGeometry(lw, lh, 0.16), { x: lw / 2, y: lh / 2 }));
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 2; c++) {
      const pw = lw * 0.36, ph = lh * 0.15;
      leaf.add('gold', xf(new THREE.BoxGeometry(pw, ph, 0.05), { x: lw * (0.28 + c * 0.44), y: lh * (0.12 + r * 0.19), z: 0.09 }));
      leaf.add('gold', xf(new THREE.BoxGeometry(pw, ph, 0.05), { x: lw * (0.28 + c * 0.44), y: lh * (0.12 + r * 0.19), z: -0.09 }));
    }
  }
  p.toBatcher(ctx.B, zone, f.m);
  for (const s of [-1, 1]) {
    const m = new THREE.Matrix4().makeTranslation(s * lw, 0, -0.12).multiply(new THREE.Matrix4().makeRotationY(s > 0 ? 0.16 : Math.PI - 0.16));
    leaf.toBatcher(ctx.B, zone, m, true);
  }

  // Organ loft
  const loftZ1 = -5.2, loftY = 8.0;
  const pl = new Parts();
  pl.add('stone', xf(new THREE.BoxGeometry(L.naveFace * 2, 0.7, -loftZ1), { y: loftY + 0.35, z: loftZ1 / 2 }));
  pl.add('goldMatte', xf(new THREE.BoxGeometry(L.naveFace * 2, 0.08, 0.1), { y: loftY + 0.2, z: loftZ1 - 0.02 }));
  pl.add('stone', xf(new THREE.BoxGeometry(L.naveFace * 2, 0.35, 0.4), { y: loftY - 0.1, z: loftZ1 + 0.1 }));
  for (const x of [-5.3, -2.5, 2.5, 5.3]) {
    const c = colonnette({ height: loftY - 0.25, r: 0.24 });
    pl.merge(c, new THREE.Matrix4().makeTranslation(x, 0, loftZ1 + 0.3));
    ctx.col.circle(x, loftZ1 + 0.3, 0.45, -1, 8);
  }
  // coffered soffit
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 2; j++) {
      pl.add('lapis', xf(new THREE.BoxGeometry(1.8, 0.05, 1.8), { x: -5.6 + i * 2.25, y: loftY - 0.02, z: -1.3 - j * 2.3 }));
      pl.add('gold', xf(new THREE.BoxGeometry(0.4, 0.06, 0.4), { x: -5.6 + i * 2.25, y: loftY - 0.05, z: -1.3 - j * 2.3 }));
    }
  }
  pl.toBatcher(ctx.B, zone);
  const lf = new WallFrame(new THREE.Vector3(0, 0, loftZ1 + 0.2), new THREE.Vector3(0, 0, -1));
  lBalustrade(ctx, zone, lf, -L.naveFace + 0.2, L.naveFace - 0.2, loftY + 0.7, 0, { h: 1.0, spacing: 0.24, railW: 0.22, gold: true, proto: 'balusterMarble' });
  buildOrgan(ctx, zone, loftY + 0.7);

  // collision: west wall interior face with openings, portal passages
  const gaps = [[-PORTAL.sideX - 1.4, -PORTAL.sideX + 1.4], [-2.8, 2.8], [PORTAL.sideX - 1.4, PORTAL.sideX + 1.4]];
  let cur = -L.aisleFace;
  for (const [a, b] of gaps) {
    ctx.col.wall(cur, 0, a, 0, -10, 40);
    cur = b;
  }
  ctx.col.wall(cur, 0, L.aisleFace, 0, -10, 40);
  for (const [a, b] of gaps) {
    ctx.col.wall(a, 0, a, T, -10, 40);
    ctx.col.wall(b, 0, b, T, -10, 40);
    ctx.col.floor(a, 0, b, T + 0.2, 0);
  }
  ctx.anchors.westWindow = new THREE.Vector3(0, WEST_WIN.y0 + WEST_WIN.H / 2, T / 2);
}

function buildOrgan(ctx, zone, y0) {
  const p = new Parts();
  const z = -1.6;
  // impost case
  p.add('stone', xf(new THREE.BoxGeometry(12, 2.4, 2.4), { y: y0 + 1.2, z }));
  p.add('gold', xf(new THREE.BoxGeometry(12.1, 0.12, 2.5), { y: y0 + 2.4, z }));
  p.add('gold', xf(new THREE.BoxGeometry(12.1, 0.1, 2.5), { y: y0 + 0.1, z }));
  for (let i = 0; i < 8; i++) p.add('goldMosaic', xf(new THREE.BoxGeometry(1.1, 1.4, 0.04), { x: -5.1 + i * 1.46, y: y0 + 1.2, z: z - 1.21 }));
  // console
  p.add('wood', xf(new THREE.BoxGeometry(2.2, 1.1, 0.9), { y: y0 + 0.55, z: -4.0 }));
  // pipe towers
  const towers = [
    { x: 0, w: 2.6, h: 7.8, n: 9 },
    { x: -2.6, w: 1.6, h: 4.8, n: 7, flat: true },
    { x: 2.6, w: 1.6, h: 4.8, n: 7, flat: true },
    { x: -4.4, w: 1.8, h: 6.6, n: 7 },
    { x: 4.4, w: 1.8, h: 6.6, n: 7 },
  ];
  const pipes = [];
  for (const t of towers) {
    const base = y0 + 2.5;
    for (let i = 0; i < t.n; i++) {
      const u = (i / (t.n - 1)) * 2 - 1;
      const x = t.x + u * t.w * 0.46;
      const h = t.flat ? t.h * (0.72 + 0.28 * Math.abs(u)) : t.h * (1 - 0.35 * Math.abs(u) ** 1.4);
      const r = (t.flat ? 0.06 : 0.09) + h * 0.009;
      const zz = z - 1.0 - (t.flat ? 0 : (1 - Math.abs(u)) * 0.35);
      pipes.push({ x, y: base, z: zz, h, r });
    }
    // tower cap and crown
    if (!t.flat) {
      const capY = base + t.h + 0.25;
      p.add('stone', xf(new THREE.BoxGeometry(t.w + 0.3, 0.3, 1.2), { x: t.x, y: capY, z: z - 0.9 }));
      p.add('gold', xf(new THREE.BoxGeometry(t.w + 0.34, 0.08, 1.24), { x: t.x, y: capY - 0.15, z: z - 0.9 }));
      const pin = pinnacle({ w: 0.36, shaftH: 0.6, spireH: 1.4 });
      for (const o of [-1, 1]) pin.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(t.x + o * t.w / 2, capY + 0.15, z - 0.9), true);
      const g = new Parts();
      g.add('gold', lathe([[0.001, 0], [0.4, 0.1], [0.3, 0.5], [0.08, 0.9], [0.001, 1.4]], 12));
      g.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(t.x, capY + 0.15, z - 0.9), true);
    }
    // side posts
    for (const o of [-1, 1]) p.add('stone', xf(new THREE.BoxGeometry(0.22, t.h + 0.2, 0.9), { x: t.x + o * (t.w / 2 + 0.12), y: base + (t.h + 0.2) / 2, z: z - 0.9 }));
  }
  // pipe instances (body scaled in height, foot fixed)
  const body = new Parts();
  body.add('tin', cyl(1, 1, 1, 12, 0, 0, 0, true));
  ctx.inst.define('pipeBody', body);
  const foot = new Parts();
  foot.add('tin', lathe([[0.001, -0.02], [0.35, 0.05], [1.0, 0.55], [1.0, 0.6]], 12));
  foot.add('gold', xf(new THREE.BoxGeometry(1.0, 0.18, 0.2), { y: 0.72, z: 0.96 }));
  ctx.inst.define('pipeFoot', foot);
  for (const q of pipes) {
    const footH = Math.max(0.4, q.r * 6);
    ctx.inst.add('pipeFoot', new THREE.Matrix4().compose(new THREE.Vector3(q.x, q.y, q.z), new THREE.Quaternion(), new THREE.Vector3(q.r, footH, q.r)), zone);
    ctx.inst.add('pipeBody', new THREE.Matrix4().compose(new THREE.Vector3(q.x, q.y + footH * 0.6, q.z), new THREE.Quaternion(), new THREE.Vector3(q.r, q.h - footH * 0.6, q.r)), zone);
  }
  p.toBatcher(ctx.B, zone);
}
