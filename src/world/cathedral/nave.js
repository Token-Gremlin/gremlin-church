import * as THREE from 'three';
import { L } from '../layout.js';
import {
  Parts, clusteredPier, colonnette, vaultShaft, rectOutline, notchOutline, archOpening, archivolt, gothicWindow,
  archOffsetPoints, archTo3D, roll, PROFILES, pinnacle, outlineWithNotches,
} from '../../arch/components.js';
import { ribVault } from '../../arch/vaults.js';
import { xf, lathe, polyLathe } from '../../arch/geom.js';
import { WallFrame, slab, hMould, lbox, lBalustrade, addGlass } from './common.js';

export const ARCADE = { span: 5.6, k: 0.72 };
export const CLERE = { W: 4.4, H: 13, k: 0.72, y0: 19.2 };
export const AISLE_WIN = { W: 3.6, H: 8.2, k: 0.72, y0: 3.6 };

/** Upper elevation (triforium + clerestory) for one bay in a wall frame. */
export function upperElevation(ctx, zone, f, amin, amax, glassKey, { balcony = true, clerestory = true, triforium = true } = {}) {
  const ca = (amin + amax) / 2;
  const p = new Parts();
  const t = L.wallT;
  if (triforium) {
    const holes = [-2.2, 0, 2.2].map((o) => archOpening(ca + o, 14.5, 1.6, 0.72, 17.0, 12));
    slab(ctx, zone, f, rectOutline(amin, amax, L.triY0, L.triY1), holes, t);
    for (const o of [-2.2, 0, 2.2]) {
      archivolt(p, ca + o, 17.0, 1.6, 0.72, t / 2, { rolls: [0.08], rollR: 0.045, segs: 12 });
    }
    for (const o of [-1.1, 1.1]) {
      const c = colonnette({ height: 2.7, r: 0.09 });
      c.transform(new THREE.Matrix4().makeTranslation(ca + o, 14.3, t / 2 + 0.1));
      p.merge(c);
    }
    // dark passage behind
    lbox(p, 'stoneShade', amin, amax, L.triY0, L.triY1, -t / 2 - 1.6, -t / 2 - 1.3);
    lbox(p, 'stoneShade', amin, amax, L.triY0 - 0.2, L.triY0, -t / 2 - 1.6, -t / 2);
    if (balcony) {
      lbox(p, 'stone', amin, amax, L.triY0 - 0.32, L.triY0 + 0.04, t / 2, t / 2 + 0.95);
      lbox(p, 'gold', amin, amax, L.triY0 - 0.22, L.triY0 - 0.14, t / 2 + 0.95, t / 2 + 0.98);
      hMould(p, amin, amax, L.triY0 - 0.5, t / 2, PROFILES.string, 'stone');
      for (let a = amin + 0.45; a < amax - 0.3; a += 0.9) {
        const cb = new THREE.BoxGeometry(0.22, 0.42, 0.75);
        xf(cb, { x: a, y: L.triY0 - 0.53, z: t / 2 + 0.38 });
        p.add('stone', cb);
        const gb = new THREE.SphereGeometry(0.07, 8, 6);
        xf(gb, { x: a, y: L.triY0 - 0.74, z: t / 2 + 0.72 });
        p.add('gold', gb);
      }
    }
  } else {
    slab(ctx, zone, f, rectOutline(amin, amax, L.triY0, L.triY1), [], t);
  }
  if (clerestory) {
    const win = gothicWindow({ W: CLERE.W, H: CLERE.H, k: CLERE.k, lights: 2, ca, y0: CLERE.y0, b: 0, wallT: t, splayW: 0.3 });
    slab(ctx, zone, f, rectOutline(amin, amax, L.triY1, L.eave), [win.hole], t);
    p.merge(win.parts);
    addGlass(ctx, glassKey, f, win, { ca, y0: CLERE.y0, kind: 'clerestory' });
  } else {
    slab(ctx, zone, f, rectOutline(amin, amax, L.triY1, L.eave), [], t);
  }
  hMould(p, amin, amax, L.triY1, t / 2, PROFILES.string, 'stone');
  hMould(p, amin, amax, L.triY1 + 0.2, t / 2 + 0.05, [[-0.02, 0], [-0.02, 0.05], [0.02, 0.05], [0.02, 0]], 'gold');
  p.toBatcher(ctx.B, zone, f.m);
  if (balcony && triforium) lBalustrade(ctx, zone, f, amin + 0.15, amax - 0.15, L.triY0 + 0.04, t / 2 + 0.78, { h: 0.9, spacing: 0.24, railW: 0.2, gold: true });
}

export function addPier(ctx, zone, x, z, opts = {}) {
  const pier = clusteredPier({ height: L.arcadeSpring, ...opts });
  pier.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(x, 0, z));
  ctx.col.circle(x, z, 1.15 * (opts.scale || 1), -10, 30);
}

export function addShafts(ctx, zone, f, a, y0 = L.arcadeSpring, y1 = L.vaultY0) {
  const p = new Parts();
  for (const o of [-0.34, 0, 0.34]) {
    const vs = vaultShaft(y0, y1, 0.13);
    vs.transform(new THREE.Matrix4().makeTranslation(a + o, 0, L.wallT / 2 + 0.12 - Math.abs(o) * 0.25));
    p.merge(vs);
  }
  p.toBatcher(ctx.B, zone, f.m);
}

export function buildNave(ctx) {
  const zone = 'nave';
  const bays = L.naveBays;
  for (const s of [-1, 1]) {
    const aisleZone = s < 0 ? 'aisleN' : 'aisleS';
    const f = new WallFrame(new THREE.Vector3(s * L.naveHalf, 0, 0), new THREE.Vector3(-s, 0, 0));
    const fa = new WallFrame(new THREE.Vector3(s * L.aisleWallC, 0, 0), new THREE.Vector3(-s, 0, 0));
    for (let i = 0; i < bays; i++) {
      const zA = -i * L.bay, zB = zA - L.bay;
      const aA = f.aOf(new THREE.Vector3(0, 0, zA)), aB = f.aOf(new THREE.Vector3(0, 0, zB));
      const amin = Math.min(aA, aB), amax = Math.max(aA, aB), ca = (aA + aB) / 2;

      // piers (the crossing piers at z = -60 are built by the crossing)
      if (i > 0) addPier(ctx, zone, s * L.naveHalf, zA);
      else addPier(ctx, zone, s * L.naveHalf, zA + 0.4, { scale: 0.9 });

      // arcade spandrel with archivolts
      slab(ctx, zone, f, notchOutline(amin, amax, L.arcadeSpring, L.triY0, ca, ARCADE.span, ARCADE.k), [], L.wallT);
      const p = new Parts();
      archivolt(p, ca, L.arcadeSpring, ARCADE.span, ARCADE.k, L.wallT / 2, { dir: 1, rolls: [0.14], rollR: 0.08 });
      archivolt(p, ca, L.arcadeSpring, ARCADE.span, ARCADE.k, -L.wallT / 2, { dir: -1, rolls: [0.14], rollR: 0.08 });
      p.add('stone', roll(archTo3D(archOffsetPoints(ARCADE.span, ARCADE.k, -0.06, 22), ca, L.arcadeSpring, 0), 0.2, 10));
      p.add('gold', roll(archTo3D(archOffsetPoints(ARCADE.span, ARCADE.k, -0.24, 22), ca, L.arcadeSpring, 0), 0.05, 6));
      p.toBatcher(ctx.B, zone, f.m);

      upperElevation(ctx, zone, f, amin, amax, `clere-${(i + (s > 0 ? 3 : 0)) % 6}`);
      addShafts(ctx, zone, f, aA);
      if (i === bays - 1) addShafts(ctx, zone, f, aB);

      // aisle vault
      const av = ribVault({ span: L.aisleFace - (L.naveHalf + L.wallT / 2), len: L.bay, y0: L.aisleVaultY0, y1: L.aisleVaultY1, endRib: i === bays - 1, segX: 20, segT: 8 });
      av.toBatcher(ctx.B, aisleZone, new THREE.Matrix4().makeTranslation(s * (L.naveHalf + L.wallT / 2 + L.aisleFace) / 2, 0, zA));

      // aisle outer wall with window (loggia doors on the north side)
      const faA = fa.aOf(new THREE.Vector3(0, 0, zA)), faB = fa.aOf(new THREE.Vector3(0, 0, zB));
      const famin = Math.min(faA, faB), famax = Math.max(faA, faB), fca = (faA + faB) / 2;
      const door = s < 0 && (i === 1 || i === 5);
      const win = gothicWindow({ W: AISLE_WIN.W, H: AISLE_WIN.H, k: AISLE_WIN.k, lights: 2, ca: fca, y0: door ? 6.2 : AISLE_WIN.y0, b: 0, wallT: L.aisleWallT, splayW: 0.28 });
      const outline = door
        ? outlineWithNotches(famin, famax, 0, L.aisleEave, [{ ca: fca, span: 2.6, k: 0.7, spring: 3.6, segs: 14 }])
        : rectOutline(famin, famax, 0, L.aisleEave);
      slab(ctx, aisleZone, fa, outline, [win.hole], L.aisleWallT);
      const wp = new Parts();
      wp.merge(win.parts);
      if (door) {
        archivolt(wp, fca, 3.6, 2.6, 0.7, L.aisleWallT / 2, { rolls: [0.1], rollR: 0.05 });
        archivolt(wp, fca, 3.6, 2.6, 0.7, -L.aisleWallT / 2, { dir: -1, rolls: [0.1], rollR: 0.05 });
        lbox(wp, 'stone', fca - 1.3, fca + 1.3, 0, 0.02, -L.aisleWallT / 2, L.aisleWallT / 2);
      } else {
        // blind arcade dado
        for (let k = 0; k < 3; k++) {
          const cx = fca + (k - 1) * 2.1;
          archivolt(wp, cx, 2.0, 1.7, 0.72, L.aisleWallT / 2, { hood: true, rolls: [0.08], rollR: 0.04, segs: 12 });
          const c = colonnette({ height: 2.0, r: 0.07 });
          for (const o of [-0.92, 0.92]) wp.merge(c, new THREE.Matrix4().makeTranslation(cx + o, 0, L.aisleWallT / 2 + 0.07));
        }
        hMould(wp, famin, famax, 3.2, L.aisleWallT / 2, PROFILES.string);
      }
      // wall responds at bay boundaries
      const resp = colonnette({ height: L.aisleVaultY0, r: 0.26, shaftMat: 'marble' });
      wp.merge(resp, new THREE.Matrix4().makeTranslation(faA, 0, L.aisleWallT / 2 + 0.05));
      if (i === bays - 1) wp.merge(resp, new THREE.Matrix4().makeTranslation(faB, 0, L.aisleWallT / 2 + 0.05));
      wp.toBatcher(ctx.B, aisleZone, fa.m);
      addGlass(ctx, `aisle-${(i + (s > 0 ? 2 : 0)) % 4}`, fa, win, { ca: fca, y0: door ? 6.2 : AISLE_WIN.y0, kind: 'aisle' });

      // collision: aisle wall (with door gap)
      const x = s * L.aisleFace;
      if (door) {
        const zc = (zA + zB) / 2;
        ctx.col.wall(x, zA, x, zc + 1.3, -10, 30);
        ctx.col.wall(x, zc - 1.3, x, zB, -10, 30);
      } else ctx.col.wall(x, zA, x, zB, -10, 30);
      ctx.col.circle(s * L.aisleFace, zA, 0.4, -10, 30);
    }
    // nave vaults (one set per bay, built once)
  }
  for (let i = 0; i < bays; i++) {
    const zA = -i * L.bay;
    const v = ribVault({ span: L.naveFace * 2, len: L.bay, y0: L.vaultY0, y1: L.vaultY1, endRib: i === bays - 1 });
    v.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(0, 0, zA));
    ctx.anchors.vaultBosses.push(new THREE.Vector3(0, L.vaultY1 - 0.4, zA - L.bay / 2));
  }
  ctx.col.floor(-L.aisleFace, 0.5, L.aisleFace, L.naveZ1, 0);
}
