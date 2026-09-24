import * as THREE from 'three';
import { L } from '../layout.js';
import {
  Parts, clusteredPier, colonnette, rectOutline, notchOutline, archOpening, archivolt, gothicWindow, roseWindow,
  archOffsetPoints, archTo3D, roll, PROFILES, mouldingAlong, outlineWithNotches,
} from '../../arch/components.js';
import { ribVault, kForRise } from '../../arch/vaults.js';
import { xf, lathe, sweep, TAU, archY } from '../../arch/geom.js';
import { WallFrame, slab, hMould, lbox, addGlass } from './common.js';
import { upperElevation, addShafts, ARCADE, AISLE_WIN } from './nave.js';
import { DRUM_WIN, TRANS_LANCET } from '../glassDesigns.js';

export const CROSS = {
  cz: (L.crossZ0 + L.crossZ1) / 2,
  c: 6.7,
  archT: 1.6,
  ring: 40,
  drumTop: 50,
  domeH: 13,
  oculus: 1.4,
};

function crossingPier(ctx, x, z) {
  const p = clusteredPier({ height: L.vaultY0, core: 0.92, shaftR: 0.22, shafts: 12 });
  // secondary leaf band where the arcades spring
  const band = lathe([[1.22, L.arcadeSpring - 0.5], [1.32, L.arcadeSpring - 0.35], [1.32, L.arcadeSpring - 0.05], [1.2, L.arcadeSpring]], 24);
  p.add('gold', band);
  p.toBatcher(ctx.B, 'crossing', new THREE.Matrix4().makeTranslation(x, 0, z));
  ctx.col.circle(x, z, 1.45, -10, 40);
}

export function buildCrossing(ctx) {
  const zone = 'crossing';
  const { cz, c, archT, ring } = CROSS;
  for (const x of [-L.naveHalf, L.naveHalf]) for (const z of [L.crossZ0, L.crossZ1]) crossingPier(ctx, x, z);

  const kx = kForRise(2 * c, L.vaultY1 - L.vaultY0);
  // Four crossing arches with tympanum walls up to the ring
  const arches = [
    new WallFrame(new THREE.Vector3(0, 0, L.crossZ0), new THREE.Vector3(0, 0, -1)),
    new WallFrame(new THREE.Vector3(0, 0, L.crossZ1), new THREE.Vector3(0, 0, 1)),
    new WallFrame(new THREE.Vector3(-L.naveHalf, 0, cz), new THREE.Vector3(1, 0, 0)),
    new WallFrame(new THREE.Vector3(L.naveHalf, 0, cz), new THREE.Vector3(-1, 0, 0)),
  ];
  for (const f of arches) {
    slab(ctx, zone, f, notchOutline(-8.4, 8.4, L.vaultY0, ring + 0.6, 0, 2 * c, kx, 26), [], archT);
    const p = new Parts();
    archivolt(p, 0, L.vaultY0, 2 * c, kx, archT / 2, { rolls: [0.18], rollR: 0.1, segs: 26 });
    archivolt(p, 0, L.vaultY0, 2 * c, kx, -archT / 2, { dir: -1, rolls: [0.18], rollR: 0.1, segs: 26 });
    for (const b of [-0.4, 0.4]) p.add('stone', roll(archTo3D(archOffsetPoints(2 * c, kx, -0.08, 30), 0, L.vaultY0, b), 0.2, 10));
    p.add('gold', roll(archTo3D(archOffsetPoints(2 * c, kx, -0.3, 30), 0, L.vaultY0, 0), 0.07, 6));
    p.toBatcher(ctx.B, zone, f.m);
  }

  // Pendentives: vertically stretched sphere between the square and the ring
  {
    const seg = 128, rs = 14;
    const pos = [], uv = [], edge = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const phi = (i / seg) * TAU;
      const cp = Math.cos(phi), sp = Math.sin(phi);
      const rmax = c / Math.max(Math.abs(cp), Math.abs(sp));
      for (let j = 0; j <= rs; j++) {
        const t = j / rs;
        const rho = rmax + (c - rmax) * t;
        const y = L.vaultY0 + (ring - L.vaultY0) * Math.sqrt(Math.max(0, 2 * c * c - rho * rho)) / c;
        pos.push(cp * rho, Math.min(y, ring), cz + sp * rho);
        uv.push(phi * c, y);
        edge.push(Math.min((rmax - rho) * 2.5 + (y > ring - 0.3 ? 0 : 0.3), (ring - y) * 1.2));
      }
    }
    for (let i = 0; i < seg; i++) {
      for (let j = 0; j < rs; j++) {
        const a = i * (rs + 1) + j, b = a + 1, d = a + rs + 1, e = d + 1;
        idx.push(a, b, d, b, e, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
    g.setIndex(idx);
    g.computeVertexNormals();
    let sy = 0;
    const n = g.attributes.normal;
    for (let i = 0; i < n.count; i++) sy += n.getY(i);
    if (sy > 0) {
      const ia = g.index.array;
      for (let i = 0; i < ia.length; i += 3) [ia[i + 1], ia[i + 2]] = [ia[i + 2], ia[i + 1]];
      g.computeVertexNormals();
    }
    ctx.B.add(`vault|${zone}`, g);
  }

  // Ring cornice
  const ringPoly = (r, n = 64) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = -(i / n) * TAU;
      pts.push([Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
    return pts;
  };
  const pr = new Parts();
  pr.add('stone', mouldingAlong(ringPoly(c), ring, PROFILES.cornice.map(([u, v]) => [u * 0.8, v * 0.8]), true));
  pr.add('gold', mouldingAlong(ringPoly(c - 0.35), ring + 0.3, [[-0.05, 0], [-0.05, 0.06], [0.05, 0.06], [0.05, 0]], true));

  // Drum: 16 walls with windows
  const drumR = c + 0.55;
  const nSides = 16;
  const sideW = 2 * drumR * Math.tan(Math.PI / nSides);
  for (let k = 0; k < nSides; k++) {
    const th = (k / nSides) * TAU;
    const o = new THREE.Vector3(Math.cos(th) * drumR, 0, cz + Math.sin(th) * drumR);
    const f = new WallFrame(o, new THREE.Vector3(-Math.cos(th), 0, -Math.sin(th)));
    const win = gothicWindow({ W: DRUM_WIN.W, H: DRUM_WIN.H, k: DRUM_WIN.k, lights: 1, ca: 0, y0: DRUM_WIN.y0, b: 0, wallT: 1.1, splayW: 0.16 });
    slab(ctx, zone, f, rectOutline(-sideW / 2 - 0.02, sideW / 2 + 0.02, ring, CROSS.drumTop), [win.hole], 1.1);
    const p = new Parts();
    p.merge(win.parts);
    const col = colonnette({ height: DRUM_WIN.H + 0.8, r: 0.1 });
    p.merge(col, new THREE.Matrix4().makeTranslation(sideW / 2, DRUM_WIN.y0 - 0.4, 0.55 + 0.05));
    p.toBatcher(ctx.B, zone, f.m);
    addGlass(ctx, 'drum', f, win, { ca: 0, y0: DRUM_WIN.y0, kind: 'drum', shafts: false });
  }
  pr.add('stone', mouldingAlong(ringPoly(c), CROSS.drumTop - 0.6, PROFILES.cornice.map(([u, v]) => [u * 0.7, v * 0.7]), true));
  pr.add('gold', mouldingAlong(ringPoly(c - 0.1), DRUM_WIN.y0 - 0.35, [[-0.06, 0], [-0.06, 0.12], [0.06, 0.12], [0.06, 0]], true));
  pr.toBatcher(ctx.B, zone);

  // Dome: painted celestial shell, gilded ribs, oculus and lantern
  const { domeH, oculus } = CROSS;
  const th0 = Math.asin(oculus / c);
  const dome = new THREE.SphereGeometry(1, 72, 24, 0, TAU, th0, Math.PI / 2 - th0);
  const duv = dome.attributes.uv;
  const dpos = dome.attributes.position;
  for (let i = 0; i < dpos.count; i++) {
    const y = dpos.getY(i);
    const th = Math.acos(THREE.MathUtils.clamp(y, -1, 1));
    duv.setY(i, 1 - (th - th0) / (Math.PI / 2 - th0));
  }
  xf(dome, { sx: c + 0.05, sy: domeH, sz: c + 0.05, y: CROSS.drumTop, z: cz });
  ctx.B.add(`domePaint|${zone}`, dome);
  const pd = new Parts();
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU;
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const th = Math.PI / 2 - (i / 24) * (Math.PI / 2 - th0);
      const r = Math.sin(th) * (c - 0.05);
      pts.push(new THREE.Vector3(Math.cos(a) * r, CROSS.drumTop + Math.cos(th) * domeH, cz + Math.sin(a) * r));
    }
    const center = new THREE.Vector3(0, CROSS.drumTop, cz);
    pd.add('gold', sweep(PROFILES.ribSmall.map(([u, v]) => [u * 0.8, v * 0.8]), pts, (pt) => pt.clone().sub(center).multiply(new THREE.Vector3(1 / (c * c), 1 / (domeH * domeH), 1 / (c * c))).normalize()));
  }
  const ocY = CROSS.drumTop + Math.cos(th0) * domeH;
  const torus = new THREE.TorusGeometry(oculus + 0.1, 0.18, 8, 48);
  xf(torus, { rx: Math.PI / 2, y: ocY, z: cz });
  pd.add('gold', torus);
  // lantern
  const lan = new THREE.CylinderGeometry(oculus + 0.05, oculus + 0.05, 7, 24, 1, true);
  xf(lan, { y: ocY + 3.5, z: cz });
  const lanMesh = lan;
  lanMesh.index && null;
  pd.add('lanternGlow', lan);
  const lanTop = new THREE.CircleGeometry(oculus + 0.1, 24);
  xf(lanTop, { rx: Math.PI / 2, y: ocY + 7, z: cz });
  pd.add('lanternGlow', lanTop);
  pd.toBatcher(ctx.B, zone);
  ctx.anchors.lantern = new THREE.Vector3(0, ocY + 6, cz);
  ctx.anchors.domeCenter = new THREE.Vector3(0, CROSS.drumTop, cz);

  buildTransepts(ctx);
}

export function buildTransepts(ctx) {
  const { cz } = CROSS;
  for (const s of [-1, 1]) {
    const zone = s < 0 ? 'transN' : 'transS';
    const fW = new WallFrame(new THREE.Vector3(0, 0, L.crossZ0), new THREE.Vector3(0, 0, -1));
    const fE = new WallFrame(new THREE.Vector3(0, 0, L.crossZ1), new THREE.Vector3(0, 0, 1));
    for (let j = 0; j < L.transBays; j++) {
      const x0 = s * (L.naveHalf + j * L.bay), x1 = s * (L.naveHalf + (j + 1) * L.bay);
      for (const f of [fW, fE]) {
        const isWest = f === fW;
        const a0 = f.aOf(new THREE.Vector3(x0, 0, 0)), a1 = f.aOf(new THREE.Vector3(x1, 0, 0));
        const amin = Math.min(a0, a1), amax = Math.max(a0, a1), ca = (a0 + a1) / 2;
        const p = new Parts();
        let lowerDone = false;
        if (isWest && j === 0) {
          // open to the aisle
          slab(ctx, zone, f, notchOutline(amin, amax, L.arcadeSpring, L.triY0, ca, ARCADE.span, ARCADE.k), [], L.wallT);
          archivolt(p, ca, L.arcadeSpring, ARCADE.span, ARCADE.k, L.wallT / 2, { rolls: [0.14], rollR: 0.08 });
          archivolt(p, ca, L.arcadeSpring, ARCADE.span, ARCADE.k, -L.wallT / 2, { dir: -1, rolls: [0.14], rollR: 0.08 });
          lowerDone = true;
        }
        if (!lowerDone) {
          const doorKind = (!isWest && j === 0 && s < 0) ? 'tower' : (!isWest && j === 1 && s > 0) ? 'chapel' : (isWest && j === 1 && s < 0) ? 'loggia' : null;
          const holes = [];
          const notches = [];
          let win = null;
          if (doorKind === 'chapel') {
            notches.push({ ca, span: 5.0, k: 0.72, spring: 6.2, segs: 18 });
            archivolt(p, ca, 6.2, 5.0, 0.72, L.wallT / 2, { rolls: [0.12], rollR: 0.07 });
            archivolt(p, ca, 6.2, 5.0, 0.72, -L.wallT / 2, { dir: -1, rolls: [0.12], rollR: 0.07 });
          } else if (doorKind) {
            notches.push({ ca, span: 2.4, k: 0.72, spring: 3.4, segs: 14 });
            archivolt(p, ca, 3.4, 2.4, 0.72, L.wallT / 2, { rolls: [0.1], rollR: 0.05 });
            archivolt(p, ca, 3.4, 2.4, 0.72, -L.wallT / 2, { dir: -1, rolls: [0.1], rollR: 0.05 });
          }
          if (doorKind !== 'chapel') {
            win = gothicWindow({ W: AISLE_WIN.W, H: AISLE_WIN.H, k: AISLE_WIN.k, lights: 2, ca, y0: doorKind ? 5.8 : AISLE_WIN.y0, b: 0, wallT: L.wallT, splayW: 0.28 });
            holes.push(win.hole);
            p.merge(win.parts);
          }
          slab(ctx, zone, f, outlineWithNotches(amin, amax, 0, L.triY0, notches), holes, L.wallT);
          if (win) addGlass(ctx, `aisle-${(j + (isWest ? 1 : 3) + (s > 0 ? 1 : 0)) % 4}`, f, win, { ca, y0: doorKind ? 5.8 : AISLE_WIN.y0, kind: 'aisle' });
          hMould(p, amin, amax, 3.0, L.wallT / 2, PROFILES.string);
          // collision along the wall face with door gaps
          const zc = f.o.z + f.n.z * (L.wallT / 2);
          const gaps = doorKind === 'chapel' ? [[ca - 2.5, ca + 2.5]] : doorKind ? [[ca - 1.2, ca + 1.2]] : [];
          let cur = amin;
          for (const [g0, g1] of gaps) {
            const pA = f.world(cur, 0, L.wallT / 2), pB = f.world(g0, 0, L.wallT / 2);
            ctx.col.wall(pA.x, zc, pB.x, zc, -10, 40);
            cur = g1;
          }
          const pA = f.world(cur, 0, L.wallT / 2), pB = f.world(amax, 0, L.wallT / 2);
          ctx.col.wall(pA.x, zc, pB.x, zc, -10, 40);
          // responds at bay boundaries
          const resp = colonnette({ height: L.arcadeSpring, r: 0.26 });
          p.merge(resp, new THREE.Matrix4().makeTranslation(a0, 0, L.wallT / 2 + 0.05));
          hMould(p, amin, amax, 11.2, L.wallT / 2, PROFILES.string);
        } else {
          const zc = f.o.z + f.n.z * 0;
          ctx.col.circle(s * 15, zc, 0.8, -10, 40);
        }
        p.toBatcher(ctx.B, zone, f.m);
        upperElevation(ctx, zone, f, amin, amax, `clere-${(j * 2 + (isWest ? 0 : 1) + (s > 0 ? 3 : 0)) % 6}`);
        addShafts(ctx, zone, f, a0);
        if (j === L.transBays - 1) addShafts(ctx, zone, f, a1);
      }
      // vault
      const v = ribVault({ span: L.naveFace * 2, len: L.bay, y0: L.vaultY0, y1: L.vaultY1, startRib: j > 0, endRib: j === L.transBays - 1 });
      const m = new THREE.Matrix4().makeRotationY(-s * Math.PI / 2);
      m.setPosition(x0, 0, cz);
      v.toBatcher(ctx.B, zone, m);
      ctx.anchors.vaultBosses.push(new THREE.Vector3((x0 + x1) / 2, L.vaultY1 - 0.4, cz));
    }

    // End wall with rose window, lancet gallery and (north) garden portal
    const fN = new WallFrame(new THREE.Vector3(s * L.transEnd, 0, cz), new THREE.Vector3(-s, 0, 0));
    const t = 1.6;
    const roseR = 5.5, roseY = 25.4;
    const holes = [];
    const circle = [];
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * TAU;
      circle.push([Math.cos(a) * (roseR + 0.25), roseY + Math.sin(a) * (roseR + 0.25)]);
    }
    holes.push(circle);
    const p = new Parts();
    const lancets = [];
    for (let i = 0; i < 5; i++) {
      const ca = (i - 2) * 2.35;
      const win = gothicWindow({ W: TRANS_LANCET.W, H: TRANS_LANCET.H, k: TRANS_LANCET.k, lights: 1, ca, y0: TRANS_LANCET.y0, b: 0, wallT: t, splayW: 0.2 });
      holes.push(win.hole);
      p.merge(win.parts);
      lancets.push({ win, ca });
    }
    const portal = s < 0;
    const endOutline = outlineWithNotches(-8.3, 8.3, 0, L.eave, portal ? [{ ca: 0, span: 3.6, k: 0.72, spring: 5.2, segs: 18 }] : []);
    slab(ctx, s < 0 ? 'transN' : 'transS', fN, endOutline, holes, t);
    const rose = roseWindow({ R: roseR, petals: 12, ca: 0, cy: roseY, b: 0 });
    p.merge(rose.parts);
    const rg = rose.glass.clone().applyMatrix4(fN.m);
    ctx.glass.add(s < 0 ? 'rose-n' : 'rose-s', rg, {
      center: fN.world(0, roseY, 0), normal: fN.n.clone(), right: fN.u.clone(), W: roseR * 2, H: roseR * 2, y0: roseY - roseR, ca: 0, frame: fN, kind: 'rose', shafts: true, radius: roseR,
    });
    for (const { win, ca } of lancets) addGlass(ctx, `lancet-${s < 0 ? 0 : 1}`, fN, win, { ca, y0: TRANS_LANCET.y0, kind: 'lancet' });
    if (portal) {
      archivolt(p, 0, 5.2, 3.6, 0.72, t / 2, { rolls: [0.12, 0.3], rollR: 0.07 });
      archivolt(p, 0, 5.2, 3.6, 0.72, -t / 2, { dir: -1, rolls: [0.12, 0.3], rollR: 0.07 });
    } else {
      for (let k = 0; k < 5; k++) {
        const ca = (k - 2) * 2.6;
        archivolt(p, ca, 4.2, 2.1, 0.72, t / 2, { rolls: [0.08], rollR: 0.04, segs: 12 });
        const col = colonnette({ height: 4.2, r: 0.08 });
        for (const o of [-1.1, 1.1]) p.merge(col, new THREE.Matrix4().makeTranslation(ca + o, 0, t / 2 + 0.08));
      }
    }
    hMould(p, -6.9, 6.9, TRANS_LANCET.y0 - 0.5, t / 2, PROFILES.string);
    hMould(p, -6.9, 6.9, 18.8, t / 2, PROFILES.string);
    p.toBatcher(ctx.B, s < 0 ? 'transN' : 'transS', fN.m);
    const xw = s * (L.transEnd - t / 2);
    if (portal) {
      ctx.col.wall(xw, L.crossZ0, xw, cz - 1.8, -10, 40);
      ctx.col.wall(xw, cz + 1.8, xw, L.crossZ1, -10, 40);
    } else ctx.col.wall(xw, L.crossZ0, xw, L.crossZ1, -10, 40);
  }
  ctx.col.floor(-L.transEnd, L.crossZ0 + 0.4, L.transEnd, L.crossZ1 - 0.4, 0);
}
