import * as THREE from 'three';
import { L } from '../layout.js';
import { Parts, pinnacle, gable, finial, archOpening, wallSlab, archivolt, colonnette } from '../../arch/components.js';
import { xf, cyl, lathe, polyLathe, TAU, archPoints } from '../../arch/geom.js';
import { angelParts, madonnaParts, candlestickParts, flowerUrnParts, candelabrumParts } from './protos.js';

/** High altar, reredos and their furnishings. Returns flame positions. */
export function buildSanctuary(ctx) {
  const zone = 'apse';
  const flames = [];
  const y0 = L.sanctuaryY;
  const p = new Parts();

  // Altar platform and altar
  const az = -94.6;
  p.add('marble', xf(new THREE.BoxGeometry(6.2, 0.3, 3.4), { y: y0 + 0.15, z: az }));
  p.add('gold', xf(new THREE.BoxGeometry(6.22, 0.03, 0.05), { y: y0 + 0.29, z: az + 1.71 }));
  p.add('marble', xf(new THREE.BoxGeometry(4.2, 1.05, 1.35), { y: y0 + 0.3 + 0.525, z: az }));
  p.add('marbleRose', xf(new THREE.BoxGeometry(4.4, 0.1, 1.5), { y: y0 + 1.4, z: az }));
  p.add('linen', xf(new THREE.BoxGeometry(4.5, 0.03, 1.56), { y: y0 + 1.465, z: az }));
  p.add('linen', xf(new THREE.BoxGeometry(4.5, 0.32, 0.02), { y: y0 + 1.32, z: az + 0.79 }));
  p.add('gold', xf(new THREE.BoxGeometry(4.5, 0.05, 0.025), { y: y0 + 1.17, z: az + 0.8 }));
  // gilded antependium with arcade
  p.add('goldMosaic', xf(new THREE.BoxGeometry(3.9, 0.8, 0.02), { y: y0 + 0.75, z: az + 0.69 }));
  const fr = new Parts();
  for (let i = 0; i < 5; i++) {
    const cx = -1.56 + i * 0.78;
    archivolt(fr, cx, 0.55, 0.6, 0.75, 0, { hood: false, rolls: [0.0], rollR: 0.025, segs: 10, leg: 0.4 });
  }
  fr.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(0, y0 + 0.36, az + 0.71));
  // tabernacle
  const tab = new Parts();
  tab.add('gold', xf(new THREE.BoxGeometry(0.7, 0.8, 0.5), { y: 0.4 }));
  gable(tab, { ca: 0, y0: 0.8, w: 0.75, h: 0.5, b: 0.25, t: 0.06, mat: 'gold', crocketMat: 'gold' });
  tab.add('gold', polyLathe([[0.2, 0.8], [0.01, 1.5]], 8, 0, false));
  finial(tab, 0, 1.5, 0, 0.1, 'gold');
  tab.add('lapis', xf(new THREE.BoxGeometry(0.4, 0.5, 0.02), { y: 0.42, z: 0.26 }));
  tab.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(0, y0 + 1.48, az - 0.35));
  // crucifix
  const cross = new Parts();
  cross.add('gold', lathe([[0.18, 0], [0.16, 0.05], [0.06, 0.15], [0.04, 0.3]], 12));
  cross.add('gold', xf(new THREE.BoxGeometry(0.07, 1.3, 0.05), { y: 0.95 }));
  cross.add('gold', xf(new THREE.BoxGeometry(0.62, 0.07, 0.05), { y: 1.25 }));
  for (const [x, y] of [[0, 1.62], [0.33, 1.25], [-0.33, 1.25]]) cross.add('gold', xf(new THREE.OctahedronGeometry(0.06, 0), { x, y }));
  cross.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(0, y0 + 1.48, az - 0.1));
  // six altar candlesticks
  const cs = candlestickParts(0.8);
  if (!ctx.inst.has('altarCandle')) ctx.inst.define('altarCandle', cs.parts);
  for (let i = 0; i < 6; i++) {
    const x = (i < 3 ? -1 : 1) * (0.7 + (i % 3) * 0.55);
    ctx.inst.addAt('altarCandle', x, y0 + 1.48, az - 0.3, 0, 1, zone);
    flames.push(cs.flames[0].clone().add(new THREE.Vector3(x, y0 + 1.48, az - 0.3)));
  }
  // great candelabra flanking the altar
  const cb = candelabrumParts(2.6);
  if (!ctx.inst.has('candelabrumTall')) ctx.inst.define('candelabrumTall', cb.parts);
  for (const s of [-1, 1]) {
    const x = s * 3.6, z = az + 0.3;
    ctx.inst.addAt('candelabrumTall', x, y0, z, 0, 1, zone);
    for (const f of cb.flames) flames.push(f.clone().add(new THREE.Vector3(x, y0, z)));
    ctx.col.circle(x, z, 0.35, y0 - 1, y0 + 3);
  }
  // adoring angels kneeling beside the altar
  const kneel = angelParts({ scale: 0.72, pose: 'pray' });
  kneel.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(-2.6, y0 + 0.3, az + 0.1).multiply(new THREE.Matrix4().makeRotationY(0.6)), true);
  kneel.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(2.6, y0 + 0.3, az + 0.1).multiply(new THREE.Matrix4().makeRotationY(-0.6)), true);
  // flowers
  const fl = flowerUrnParts(9, 1.2);
  for (const x of [-2.0, 2.0]) fl.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(x, y0 + 0.3, az + 1.35), true);
  for (const x of [-5.2, 5.2]) fl.toBatcher(ctx.B, zone, new THREE.Matrix4().makeTranslation(x, y0, -91.4), true);
  ctx.col.box(-3.1, az - 1.7, 3.1, az + 1.7, y0 - 1, y0 + 2);

  // Reredos
  const rz = -99.2;
  const rp = new Parts();
  const W = 11.2;
  rp.add('marble', xf(new THREE.BoxGeometry(W, 1.7, 1.2), { y: y0 + 0.85, z: rz }));
  for (let i = 0; i < 7; i++) rp.add('goldMosaic', xf(new THREE.BoxGeometry(1.2, 0.9, 0.02), { x: -4.8 + i * 1.6, y: y0 + 0.85, z: rz + 0.61 }));
  rp.add('gold', xf(new THREE.BoxGeometry(W + 0.05, 0.08, 1.25), { y: y0 + 1.72, z: rz }));
  const baseY = y0 + 1.76;
  const niches = [
    { x: 0, w: 2.2, h: 5.6, k: 0.75, spring: 4.6, fig: 'christ' },
    { x: -2.75, w: 1.4, h: 4.4, k: 0.8, spring: 3.5, fig: 'saint' },
    { x: 2.75, w: 1.4, h: 4.4, k: 0.8, spring: 3.5, fig: 'saint' },
    { x: -4.6, w: 1.3, h: 3.8, k: 0.8, spring: 3.0, fig: 'angel' },
    { x: 4.6, w: 1.3, h: 3.8, k: 0.8, spring: 3.0, fig: 'angel' },
  ];
  const holes = niches.map((n) => archOpening(n.x, 0.3, n.w, n.k, n.spring, 14));
  const screen = wallSlab([[-W / 2, 0], [W / 2, 0], [W / 2, 6.2], [-W / 2, 6.2]], holes, 0.7);
  xf(screen, { y: baseY, z: rz });
  rp.add('stone', screen);
  // niche backs: lapis with gold stars (glow for the centre)
  for (const n of niches) {
    const back = new THREE.Shape(archOpening(n.x, 0.3, n.w + 0.1, n.k, n.spring, 14).map(([x, y]) => new THREE.Vector2(x, y)));
    const bg = new THREE.ShapeGeometry(back, 6);
    xf(bg, { y: baseY, z: rz - 0.32 });
    rp.add(n.fig === 'christ' ? 'glowWarm' : 'lapis', bg);
    archivolt(rp, n.x, baseY + n.spring, n.w, n.k, rz + 0.35, { rolls: [0.08], rollR: 0.05, segs: 14, rollMat: 'gold', hoodMat: 'gold' });
    for (const sx of [-1, 1]) {
      const c = colonnette({ height: n.spring + 0.1, r: 0.07, shaftMat: 'gold' });
      c.transform(new THREE.Matrix4().makeTranslation(n.x + sx * (n.w / 2 + 0.08), baseY + 0.25, rz + 0.4));
      rp.merge(c);
    }
    const gh = n.w * 1.25;
    const gy = baseY + n.spring + n.w * 0.45;
    gable(rp, { ca: n.x, y0: gy, w: n.w + 0.5, h: gh, b: rz + 0.3, t: 0.2, mat: 'stone', crocketMat: 'gold', finialMat: 'gold' });
    for (const sx of [-1, 1]) {
      const pin = pinnacle({ w: 0.34, shaftH: 1.3 + n.w * 0.4, spireH: 1.6 + n.w * 0.5 });
      pin.transform(new THREE.Matrix4().makeTranslation(n.x + sx * (n.w / 2 + 0.36), baseY + n.spring, rz + 0.1));
      rp.merge(pin);
    }
    // statue inside the niche
    const sc = n.fig === 'christ' ? 1.25 : 0.95;
    let fig;
    if (n.fig === 'christ') fig = angelParts({ scale: sc, wings: false, pose: 'bless', mat: 'gold', halo: true });
    else if (n.fig === 'angel') fig = angelParts({ scale: sc * 0.9, pose: 'pray' });
    else fig = madonnaParts({ scale: sc * 0.95 });
    fig.transform(new THREE.Matrix4().makeTranslation(n.x, baseY + 0.3, rz - 0.05));
    rp.merge(fig);
  }
  // central spire rising above the screen
  const sp = new Parts();
  sp.add('stone', polyLathe([[0.9, 0], [0.9, 1.4], [0.7, 1.6]], 8, Math.PI / 8));
  sp.add('gold', polyLathe([[0.72, 1.6], [0.02, 6.2]], 8, Math.PI / 8, false));
  finial(sp, 0, 6.2, 0, 0.35, 'gold');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    const pin = pinnacle({ w: 0.2, shaftH: 0.8, spireH: 1.1 });
    pin.transform(new THREE.Matrix4().makeTranslation(Math.cos(a) * 0.95, 1.2, Math.sin(a) * 0.95));
    sp.merge(pin);
  }
  sp.transform(new THREE.Matrix4().makeTranslation(0, baseY + 6.2 + 1.5, rz));
  rp.merge(sp);
  rp.add('stone', xf(new THREE.BoxGeometry(W, 0.35, 0.9), { y: baseY + 6.35, z: rz }));
  rp.add('gold', xf(new THREE.BoxGeometry(W + 0.04, 0.06, 0.94), { y: baseY + 6.2, z: rz }));
  for (let i = 0; i < 12; i++) {
    const pin = pinnacle({ w: 0.24, shaftH: 0.6, spireH: 0.9 });
    pin.transform(new THREE.Matrix4().makeTranslation(-W / 2 + 0.3 + i * ((W - 0.6) / 11), baseY + 6.52, rz + 0.3));
    rp.merge(pin);
  }
  rp.toBatcher(ctx.B, zone);
  ctx.col.box(-W / 2, rz - 0.7, W / 2, rz + 0.7, y0 - 1, y0 + 8);
  ctx.anchors.altar = new THREE.Vector3(0, y0 + 1.5, az);
  ctx.anchors.reredosGlow = new THREE.Vector3(0, baseY + 3, rz + 0.2);
  p.toBatcher(ctx.B, zone);
  return flames;
}
