import * as THREE from 'three';
import { Parts, colonnette, finial } from '../../arch/components.js';
import { xf, cyl, lathe, polyLathe, TAU, rng } from '../../arch/geom.js';
import { angelParts, pedestalParts, madonnaParts } from '../props/protos.js';
import { LOGGIA } from '../cathedral/loggia.js';
import { waterMaterial } from './Terrain.js';

const M4 = (x, y, z, ry = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s));

export const GARDEN = {
  x0: LOGGIA.x1 - 0.6, // east edge (loggia arcade)
  x1: -72.4, // cliff balustrade
  z0: 2.5,
  z1: -112,
  axisZ: -33.75,
  crossX: -47,
  fountain: new THREE.Vector3(-47, 0, -33.75),
};

export function buildGarden(ctx, world) {
  const zone = 'garden';
  const inst = ctx.inst;
  const col = ctx.col;
  const G = GARDEN;
  const p = new Parts();
  const r = rng(314);
  const flames = [];

  // lawns (quadrants split by the two axes and the fountain circle)
  const lawn = (x0, z0, x1, z1) => {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), 0.08, Math.abs(z1 - z0));
    xf(g, { x: (x0 + x1) / 2, y: 0.03, z: (z0 + z1) / 2 });
    p.add('grass', g);
  };
  const ax = G.axisZ, cx = G.crossX;
  const pw = 2.6; // half path width
  lawn(G.x0 - 1.5, G.z0 - 1.5, cx + pw, ax + pw);
  lawn(cx - pw, G.z0 - 1.5, G.x1 + 1.8, ax + pw);
  lawn(G.x0 - 1.5, ax - pw, cx + pw, G.z1 + 2);
  lawn(cx - pw, ax - pw, G.x1 + 1.8, G.z1 + 2);
  // circular plaza around the fountain (paving shows through) — mask the lawns with a paved ring disc
  const plaza = new THREE.CylinderGeometry(11.5, 11.5, 0.1, 64);
  xf(plaza, { x: cx, y: 0.05, z: ax });
  p.add('marble', plaza);
  const plazaInlay = new THREE.RingGeometry(9.8, 10.4, 64);
  xf(plazaInlay, { rx: -Math.PI / 2, x: cx, y: 0.105, z: ax });
  p.add('lapis', plazaInlay);
  // paved axes on top of the lawns
  const path = (x0, z0, x1, z1) => {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), 0.1, Math.abs(z1 - z0));
    xf(g, { x: (x0 + x1) / 2, y: 0.05, z: (z0 + z1) / 2 });
    p.add('marble', g);
    const b1 = new THREE.BoxGeometry(Math.abs(x1 - x0) + 0.001, 0.12, Math.abs(z1 - z0) + 0.001);
    void b1;
  };
  path(G.x0 - 1.5, ax - pw, G.x1 + 1.8, ax + pw);
  path(cx - pw, G.z0 - 1.5, cx + pw, G.z1 + 2);

  // parterres: hedged beds full of flowers in each quadrant
  const blossom = inst.has('blossom');
  const colors = [new THREE.Color(1, 1, 0.96), new THREE.Color(1, 0.72, 0.8), new THREE.Color(0.9, 0.2, 0.25), new THREE.Color(1, 0.9, 0.7), new THREE.Color(0.75, 0.6, 1)];
  const bed = (x0, z0, x1, z1, palette) => {
    const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    for (const [bx, bz, bw, bd] of [[mx, z0, w, 0.5], [mx, z1, w, 0.5], [x0, mz, 0.5, d], [x1, mz, 0.5, d]]) {
      p.add('foliageDark', xf(new THREE.BoxGeometry(bw, 0.55, bd), { x: bx, y: 0.3, z: bz }));
    }
    p.add('soil', xf(new THREE.BoxGeometry(w - 0.4, 0.12, d - 0.4), { x: mx, y: 0.1, z: mz }));
    p.add('foliage', xf(new THREE.BoxGeometry(w - 0.6, 0.35, d - 0.6), { x: mx, y: 0.2, z: mz }));
    if (blossom) {
      const n = Math.floor(w * d * 7);
      for (let i = 0; i < n; i++) {
        const x = mx + (r() - 0.5) * (w - 0.8), z = mz + (r() - 0.5) * (d - 0.8);
        inst.add('blossom', M4(x, 0.42 + r() * 0.1, z, r() * TAU, 0.8 + r() * 0.7), zone, palette[Math.floor(r() * palette.length)].clone().multiplyScalar(0.85 + r() * 0.2));
      }
    }
    col.box(Math.min(x0, x1) - 0.25, Math.min(z0, z1) - 0.25, Math.max(x0, x1) + 0.25, Math.max(z0, z1) + 0.25, -1, 0.7);
  };
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const bx = cx + sx * 17, bz = ax + sz * 17;
      bed(bx - 6, bz - 4.5, bx + 6, bz + 4.5, sz > 0 ? [colors[0], colors[1], colors[3]] : [colors[0], colors[2], colors[4]]);
      bed(bx - 6, bz + sz * 9, bx + 6, bz + sz * 15, [colors[0], colors[1]]);
      // cypresses framing each parterre
      for (const ox of [-7.2, 7.2]) {
        for (const oz of [-5.7, 5.7]) {
          inst.add(`cypress${Math.floor(r() * 4)}`, M4(bx + ox, 0.02, bz + oz, r() * TAU, 0.7 + r() * 0.2), zone);
          col.circle(bx + ox, bz + oz, 0.7, -1, 6);
        }
      }
    }
  }

  // Tiered fountain
  const F = G.fountain;
  const fp = new Parts();
  fp.add('marble', lathe([[6.4, 0], [6.6, 0.1], [6.6, 0.75], [6.3, 0.85], [6.0, 0.85], [6.0, 0.25], [0.001, 0.25]], 72));
  fp.add('gold', xf(new THREE.TorusGeometry(6.45, 0.05, 6, 96), { rx: Math.PI / 2, y: 0.8 }));
  fp.add('marble', lathe([[1.1, 0.2], [0.8, 0.6], [0.6, 1.4], [0.9, 1.8], [2.8, 2.25], [3.0, 2.45], [2.8, 2.5]], 48));
  fp.add('marble', lathe([[0.5, 2.4], [0.35, 3.3], [0.55, 3.7], [1.6, 4.05], [1.75, 4.2], [1.6, 4.25]], 40));
  fp.add('marble', lathe([[0.3, 4.1], [0.2, 4.9], [0.4, 5.2], [0.8, 5.4], [0.85, 5.5], [0.75, 5.55]], 32));
  fp.add('gold', xf(new THREE.TorusGeometry(2.9, 0.04, 6, 64), { rx: Math.PI / 2, y: 2.46 }));
  fp.add('gold', xf(new THREE.TorusGeometry(1.68, 0.035, 6, 48), { rx: Math.PI / 2, y: 4.21 }));
  const topAngel = angelParts({ scale: 0.7, mat: 'gold', pose: 'bless' });
  fp.merge(topAngel, new THREE.Matrix4().makeTranslation(0, 5.45, 0));
  // dolphins/spouts around the lower bowl
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    fp.add('gold', xf(new THREE.SphereGeometry(0.16, 8, 6), { x: Math.cos(a) * 1.0, y: 1.25, z: Math.sin(a) * 1.0, sx: 1.6 }));
  }
  fp.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(F.x, 0, F.z));
  col.circle(F.x, F.z, 6.7, -1, 3);
  // water: basin surface, bowl surfaces and falling sheets
  const wm = waterMaterial(world, { deep: new THREE.Color(0.02, 0.07, 0.1) });
  world.waterMaterials.push(wm);
  for (const [rad, y] of [[6.0, 0.62], [2.75, 2.4], [1.55, 4.16], [0.7, 5.5]]) {
    const w = new THREE.Mesh(new THREE.CircleGeometry(rad, 48), wm);
    w.rotation.x = -Math.PI / 2;
    w.position.set(F.x, y, F.z);
    world.scene.add(w);
  }
  // thin, seamless curtains; time, light and fog uniforms stay shared with the cliff falls
  const fallMat = world.waterfallMaterial.clone();
  fallMat.uniforms = { ...world.waterfallMaterial.uniforms, uAlpha: { value: 0.45 }, uWrap: { value: 1 } };
  for (const [rad, yTop, yBot] of [[2.95, 2.45, 0.62], [1.72, 4.2, 2.42], [0.84, 5.52, 4.18]]) {
    const g = new THREE.CylinderGeometry(rad + 0.05, rad + 0.35, yTop - yBot, 64, 6, true);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), 1 - uv.getY(i));
    const m = new THREE.Mesh(g, fallMat);
    m.position.set(F.x, (yTop + yBot) / 2, F.z);
    m.renderOrder = 3;
    world.scene.add(m);
  }
  world.fountain = F.clone().setY(2);

  // cliff-edge balustrade with pedestals, urns and lanterns
  const balLine = (x0, z0, x1, z1) => {
    const bp = new Parts();
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const ang = Math.atan2(dz, dx);
    const box = (hh, yy, w) => xf(xf(xf(new THREE.BoxGeometry(len, hh, w), { x: len / 2, y: yy + hh / 2 }), { ry: -ang }), { x: x0, y: 0, z: z0 });
    bp.add('stone', box(0.18, 0, 0.4));
    bp.add('stone', box(0.16, 0.9, 0.38));
    bp.toBatcher(ctx.B, zone);
    const n = Math.floor(len / 0.3);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      inst.add('balusterMarble', new THREE.Matrix4().compose(new THREE.Vector3(x0 + dx * t, 0.18, z0 + dz * t), new THREE.Quaternion(), new THREE.Vector3(1, 0.72 / 0.72, 1)), zone);
    }
    col.wall(x0, z0, x1, z1, -1, 1.3);
  };
  balLine(G.x1, G.z0, G.x1, G.z1);
  balLine(G.x1, G.z1, -30, G.z1);
  balLine(G.x1, G.z0, -30, G.z0);
  for (let z = G.z0 - 6; z > G.z1 + 3; z -= 12) {
    inst.add('pedestal', M4(G.x1, 0, z), zone);
    if (Math.round(z / 12) % 2 === 0) {
      inst.add('lantern', M4(G.x1, 1.5, z), zone);
      ctx.anchors.extLights.push(new THREE.Vector3(G.x1, 4.7, z));
    } else inst.add('urnBig', M4(G.x1, 1.5, z, 0, 0.8), zone);
  }
  // lanterns along the axes
  for (let x = G.x0 - 4; x > G.x1 + 4; x -= 8) {
    if (Math.abs(x - cx) < 13) continue;
    for (const s of [-1, 1]) {
      inst.add('lantern', M4(x, 0, ax + s * (pw + 0.6), 0, 0.85), zone);
      ctx.anchors.extLights.push(new THREE.Vector3(x, 3.4, ax + s * (pw + 0.6)));
      col.circle(x, ax + s * (pw + 0.6), 0.25, -1, 3);
    }
  }
  // benches facing the fountain
  const bench = new Parts();
  bench.add('marble', xf(new THREE.BoxGeometry(2.2, 0.12, 0.6), { y: 0.46 }));
  for (const o of [-0.85, 0.85]) bench.add('marble', lathe([[0.14, 0], [0.1, 0.1], [0.08, 0.3], [0.18, 0.42]], 8).translate(o, 0, 0));
  bench.add('marble', xf(new THREE.BoxGeometry(2.2, 0.5, 0.08), { y: 0.78, z: -0.28, rx: -0.12 }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + TAU / 16;
    const bx = F.x + Math.cos(a) * 9.2, bz = F.z + Math.sin(a) * 9.2;
    bench.toBatcher(ctx.B, zone, M4(bx, 0.1, bz, -a - Math.PI / 2), true);
    col.circle(bx, bz, 0.9, -1, 1.2);
  }

  // Tempietto overlooking the cliffs: ring of columns, dome, angel within
  const T = new THREE.Vector3(-63, 0, -96);
  const tp = new Parts();
  tp.add('marble', lathe([[5.2, 0], [5.2, 0.3], [4.9, 0.3], [4.9, 0.6], [4.6, 0.6], [4.6, 0.9], [0.001, 0.9]], 48));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    const c = colonnette({ height: 6.2, r: 0.28, shaftMat: 'marble' });
    tp.merge(c, new THREE.Matrix4().makeTranslation(Math.cos(a) * 4.0, 0.9, Math.sin(a) * 4.0));
    col.circle(T.x + Math.cos(a) * 4.0, T.z + Math.sin(a) * 4.0, 0.4, -1, 8);
  }
  tp.add('stone', lathe([[4.7, 7.1], [4.9, 7.3], [4.9, 7.8], [4.6, 7.9], [4.6, 8.1]], 48));
  tp.add('gold', xf(new THREE.TorusGeometry(4.85, 0.06, 6, 64), { rx: Math.PI / 2, y: 7.6 }));
  const domeProf = [];
  for (let i = 0; i <= 16; i++) {
    const th = (i / 16) * Math.PI / 2;
    domeProf.push([4.5 * Math.cos(th) + 0.001, 8.1 + 3.6 * Math.sin(th)]);
  }
  tp.add('domeBlue', lathe(domeProf, 48));
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    const pts = domeProf.map(([rr, y]) => new THREE.Vector3(Math.cos(a) * (rr + 0.04), y, Math.sin(a) * (rr + 0.04)));
    for (let j = 0; j < pts.length - 1; j++) {
      const seg = new THREE.CylinderGeometry(0.06, 0.06, pts[j].distanceTo(pts[j + 1]), 5);
      seg.translate(0, pts[j].distanceTo(pts[j + 1]) / 2, 0);
      seg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pts[j + 1].clone().sub(pts[j]).normalize()));
      seg.translate(pts[j].x, pts[j].y, pts[j].z);
      tp.add('gold', seg);
    }
  }
  finial(tp, 0, 11.7, 0, 0.5, 'gold');
  const ped = pedestalParts(1.2, 0.8);
  tp.merge(ped, new THREE.Matrix4().makeTranslation(0, 0.9, 0));
  const ang = angelParts({ scale: 1.1, pose: 'pray' });
  tp.merge(ang, new THREE.Matrix4().makeTranslation(0, 2.1, 0).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2 + 0.6)));
  tp.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(T.x, 0, T.z));
  col.circle(T.x, T.z, 0.7, -1, 4);
  col.disc(T.x, T.z, 5.2, 0.9);
  col.disc(T.x, T.z, 5.25, 0.3, 4.9);
  col.disc(T.x, T.z, 4.95, 0.6, 4.6);
  world.tempietto = T;

  // round topiaries and statues along the cross axis
  for (let z = G.z0 - 8; z > G.z1 + 6; z -= 10) {
    if (Math.abs(z - ax) < 14) continue;
    for (const s of [-1, 1]) {
      const x = cx + s * (pw + 1.4);
      if (Math.abs(z) % 20 < 10) {
        inst.add('pedestal', M4(x, 0, z), zone);
        inst.add('angelStatue', M4(x, 1.5, z, s > 0 ? -Math.PI / 2 : Math.PI / 2, 0.85), zone);
      } else inst.add('roundTree', M4(x, 0, z, r() * TAU, 0.6), zone);
      col.circle(x, z, 0.7, -1, 4);
    }
  }
  p.toBatcher(ctx.B, zone);
  return flames;
}
