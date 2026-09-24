import * as THREE from 'three';
import { L } from '../layout.js';
import { Parts, colonnette, rectOutline, archivolt, gothicWindow, PROFILES, vaultShaft } from '../../arch/components.js';
import { ribVault, apseVault } from '../../arch/vaults.js';
import { xf } from '../../arch/geom.js';
import { WallFrame, slab, hMould, lbox, addGlass } from './common.js';
import { upperElevation, addShafts } from './nave.js';
import { APSE_WIN } from '../glassDesigns.js';

export const APSE = { cz: L.choirZ1, R: L.naveHalf, face: L.naveFace };

export function apseVertices(r = L.naveHalf) {
  const v = [];
  for (let i = 0; i <= L.apseSides; i++) {
    const a = (i / L.apseSides) * Math.PI;
    v.push({ a, x: Math.cos(a) * r, z: APSE.cz - Math.sin(a) * r });
  }
  return v;
}

export function buildChoir(ctx) {
  const zone = 'choir';
  for (const s of [-1, 1]) {
    const f = new WallFrame(new THREE.Vector3(s * L.naveHalf, 0, 0), new THREE.Vector3(-s, 0, 0));
    for (let i = 0; i < L.choirBays; i++) {
      const zA = L.crossZ1 - i * L.bay, zB = zA - L.bay;
      const aA = f.aOf(new THREE.Vector3(0, 0, zA)), aB = f.aOf(new THREE.Vector3(0, 0, zB));
      const amin = Math.min(aA, aB), amax = Math.max(aA, aB), ca = (aA + aB) / 2;
      slab(ctx, zone, f, rectOutline(amin, amax, 0, L.triY0), [], L.wallT);
      const p = new Parts();
      // blind arcade with gilded rolls above the choir stalls
      for (let k = 0; k < 3; k++) {
        const cx = ca + (k - 1) * 2.3;
        archivolt(p, cx, 6.2, 1.9, 0.75, L.wallT / 2, { rolls: [0.08], rollR: 0.045, segs: 14 });
        const col = colonnette({ height: 6.2, r: 0.09 });
        for (const o of [-1.02, 1.02]) p.merge(col, new THREE.Matrix4().makeTranslation(cx + o, 0, L.wallT / 2 + 0.09));
        lbox(p, 'goldMosaic', cx - 0.9, cx + 0.9, 2.6, 6.0, L.wallT / 2 + 0.01, L.wallT / 2 + 0.02);
      }
      hMould(p, amin, amax, 8.2, L.wallT / 2, PROFILES.string);
      hMould(p, amin, amax, 2.5, L.wallT / 2, PROFILES.string);
      const resp = colonnette({ height: L.arcadeSpring, r: 0.3 });
      p.merge(resp, new THREE.Matrix4().makeTranslation(aA, 0, L.wallT / 2 + 0.1));
      p.toBatcher(ctx.B, zone, f.m);
      upperElevation(ctx, zone, f, amin, amax, `clere-${(i + (s > 0 ? 1 : 4)) % 6}`);
      addShafts(ctx, zone, f, aA);
      ctx.col.wall(s * L.naveFace, zA, s * L.naveFace, zB, -10, 40);
    }
  }
  for (let i = 0; i < L.choirBays; i++) {
    const zA = L.crossZ1 - i * L.bay;
    const v = ribVault({ span: L.naveFace * 2, len: L.bay, y0: L.vaultY0, y1: L.vaultY1, startRib: i > 0, endRib: i === L.choirBays - 1 });
    v.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(0, 0, zA));
    ctx.anchors.vaultBosses.push(new THREE.Vector3(0, L.vaultY1 - 0.4, zA - L.bay / 2));
  }

  // Apse: seven tall lancets around the sanctuary
  const vc = apseVertices(L.naveHalf);
  const vi = apseVertices(L.naveFace);
  for (let i = 0; i < L.apseSides; i++) {
    const A = vc[i], Bv = vc[i + 1];
    const mid = new THREE.Vector3((A.x + Bv.x) / 2, 0, (A.z + Bv.z) / 2);
    const inward = new THREE.Vector3(0 - mid.x, 0, APSE.cz - mid.z).normalize();
    const f = new WallFrame(mid, inward);
    const half = Math.hypot(Bv.x - A.x, Bv.z - A.z) / 2;
    const win = gothicWindow({ W: APSE_WIN.W, H: APSE_WIN.H, k: APSE_WIN.k, lights: 1, ca: 0, y0: APSE_WIN.y0, b: 0, wallT: L.wallT, splayW: 0.22 });
    slab(ctx, 'apse', f, rectOutline(-half - 0.08, half + 0.08, 0, L.eave), [win.hole], L.wallT);
    const p = new Parts();
    p.merge(win.parts);
    hMould(p, -half, half, APSE_WIN.y0 - 0.3, L.wallT / 2, PROFILES.string);
    lbox(p, 'goldMosaic', -half + 0.15, half - 0.15, 1.6, APSE_WIN.y0 - 0.6, L.wallT / 2 + 0.01, L.wallT / 2 + 0.02);
    p.toBatcher(ctx.B, 'apse', f.m);
    addGlass(ctx, `apse-${i}`, f, win, { ca: 0, y0: APSE_WIN.y0, kind: 'apse' });
    const ia = vi[i], ib = vi[i + 1];
    ctx.col.wall(ia.x, ia.z, ib.x, ib.z, -10, 40);
  }
  // vaulting shafts at the apse vertices
  const ps = new Parts();
  for (let i = 1; i < L.apseSides; i++) {
    const v = apseVertices(L.naveFace - 0.12)[i];
    const sh = vaultShaft(0.2, L.vaultY0, 0.15);
    ps.merge(sh, new THREE.Matrix4().makeTranslation(v.x, 0, v.z));
  }
  ps.toBatcher(ctx.B, 'apse');
  const av = apseVault({ R: L.naveFace, angles: vi.map((v) => v.a), y0: L.vaultY0, y1: L.vaultY1 });
  av.toBatcher(ctx.B, 'apse', new THREE.Matrix4().makeTranslation(0, 0, APSE.cz));

  // Choir and sanctuary platforms + steps
  const pf = new Parts();
  const stepsUp = (z0, y0, n, depth, rise, w = L.naveFace * 2) => {
    for (let k = 0; k < n; k++) {
      const g = new THREE.BoxGeometry(w, rise, depth);
      xf(g, { y: y0 + rise * (k + 0.5), z: z0 - depth * (k + 0.5) });
      pf.add('marble', g);
      const nose = new THREE.BoxGeometry(w, 0.02, 0.04);
      xf(nose, { y: y0 + rise * (k + 1) - 0.01, z: z0 - depth * k - 0.02 });
      pf.add('gold', nose);
    }
  };
  // choir platform (below floor mesh at y = choirY)
  stepsUp(L.crossZ1 - 0.4, 0, 4, 0.3, L.choirY / 4);
  ctx.col.ramp(-L.naveFace, L.crossZ1 - 1.6, L.naveFace, L.crossZ1 - 0.4, 'z', L.choirY, 0);
  const sz0 = -90.2;
  stepsUp(sz0, L.choirY, 6, 0.3, (L.sanctuaryY - L.choirY) / 6);
  ctx.col.floor(-L.naveFace, L.crossZ1 - 1.6, L.naveFace, sz0, L.choirY);
  ctx.col.ramp(-L.naveFace, sz0 - 1.8, L.naveFace, sz0, 'z', L.sanctuaryY, L.choirY);
  ctx.col.floor(-L.naveFace, sz0 - 1.8, L.naveFace, APSE.cz, L.sanctuaryY);
  ctx.col.floorPoly(vi.map((v) => [v.x, v.z]), L.sanctuaryY);
  // side blocks under the raised floors
  const blk = (z0, z1, y) => {
    const g = new THREE.BoxGeometry(L.naveFace * 2, y, Math.abs(z1 - z0));
    xf(g, { y: y / 2 - 0.01, z: (z0 + z1) / 2 });
    pf.add('marble', g);
  };
  blk(L.crossZ1 - 1.6, sz0, L.choirY);
  blk(sz0 - 1.8, APSE.cz, L.sanctuaryY);
  pf.toBatcher(ctx.B, 'choir');
}
