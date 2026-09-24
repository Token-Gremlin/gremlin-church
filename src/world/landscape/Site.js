import * as THREE from 'three';
import { L } from '../layout.js';
import { Parts, balusterGeometry, pinnacle, finial } from '../../arch/components.js';
import { xf, cyl, lathe, polyLathe, TAU, rng } from '../../arch/geom.js';
import { angelParts, pedestalParts, flowerUrnParts } from '../props/protos.js';

const M4 = (x, y, z, ry = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s));

export const SITE = {
  terraceX: 30,
  terraceZ0: L.westT,
  terraceZ1: L.terraceZ1,
  stairsZ1: L.stairsZ1,
  stairsHalf: 8,
  promHalf: 10.5,
  promZ1: 162,
  y: L.promenadeY,
};

export function lanternParts() {
  const p = new Parts();
  p.add('iron', lathe([[0.16, 0], [0.18, 0.08], [0.1, 0.18], [0.06, 0.4], [0.05, 2.6], [0.09, 2.7], [0.05, 2.8]], 10));
  p.add('gold', xf(new THREE.TorusGeometry(0.08, 0.02, 6, 12), { rx: Math.PI / 2, y: 1.2 }));
  // lantern cage
  p.add('gold', polyLathe([[0.2, 2.8], [0.26, 2.86], [0.26, 2.9]], 6, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    p.add('gold', xf(new THREE.BoxGeometry(0.025, 0.62, 0.025), { x: Math.cos(a) * 0.24, y: 3.2, z: Math.sin(a) * 0.24 }));
  }
  p.add('lampGlass', polyLathe([[0.22, 2.9], [0.26, 3.2], [0.23, 3.5]], 6, 0, false));
  p.add('glowWarm', xf(new THREE.SphereGeometry(0.1, 10, 8), { y: 3.2 }));
  p.add('gold', polyLathe([[0.3, 3.5], [0.3, 3.55], [0.02, 3.95]], 6, 0));
  p.add('gold', xf(new THREE.SphereGeometry(0.05, 8, 6), { y: 4.0 }));
  return p;
}

export function cypressParts(seed = 1, h = 10) {
  const p = new Parts();
  const r = rng(seed);
  const prof = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const rad = Math.sin(Math.pow(t, 0.55) * Math.PI) * (0.95 + 0.25 * r()) * (1 - t * 0.45) * (h / 10);
    prof.push([Math.max(0.02, rad), t * h]);
  }
  const g = lathe(prof, 12);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + 0.14 * Math.sin(a * 5 + y * 1.7 + seed) + 0.1 * Math.sin(a * 11 - y * 3.1) + 0.06 * Math.sin(y * 7 + a * 3);
    pos.setXYZ(i, x * k, y, z * k);
  }
  g.computeVertexNormals();
  p.add('foliageDark', g);
  p.add('wood', cyl(0.12, 0.16, 0.8, 6));
  return p;
}

export function roundTreeParts(seed = 2, s = 1) {
  const p = new Parts();
  const r = rng(seed);
  p.add('wood', cyl(0.15 * s, 0.25 * s, 2.6 * s, 6));
  for (let i = 0; i < 9; i++) {
    const a = r() * TAU;
    const rr = r() * 1.3 * s;
    const g = new THREE.IcosahedronGeometry((1.1 + r() * 0.7) * s, 1);
    const pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, k);
      v.multiplyScalar(1 + 0.15 * Math.sin(v.x * 5 + v.y * 3 + i));
      pos.setXYZ(k, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    xf(g, { x: Math.cos(a) * rr, y: (3.2 + r() * 1.6) * s, z: Math.sin(a) * rr });
    p.add('foliage', g);
  }
  return p;
}

export function buildSite(ctx) {
  const zone = 'site';
  const inst = ctx.inst;
  const col = ctx.col;
  const p = new Parts();
  const S = SITE;

  inst.define('lantern', lanternParts(), { castShadow: false });
  inst.define('pedestal', pedestalParts(1.5, 0.9));
  inst.define('angelStatue', angelParts({ scale: 1.15 }));
  for (let i = 0; i < 4; i++) inst.define(`cypress${i}`, cypressParts(i + 1, 9 + i * 1.3));
  inst.define('roundTree', roundTreeParts(3, 1));
  inst.define('urnBig', flowerUrnParts(11, 1.6));

  // Terrace substructure and edge walls
  const tY = 0;
  p.add('stone', xf(new THREE.BoxGeometry(S.terraceX * 2, 3.57, S.terraceZ1 - S.terraceZ0), { y: -1.815, z: (S.terraceZ0 + S.terraceZ1) / 2 }));
  col.floor(-S.terraceX, S.terraceZ0 - 0.1, S.terraceX, S.terraceZ1, tY);
  // Podium carrying the basilica and the garden terrace
  const PX0 = -73, PX1 = 36, PZ0 = -114, PZ1 = S.terraceZ0;
  p.add('stone', xf(new THREE.BoxGeometry(PX1 - PX0, 3.57, PZ1 - PZ0), { x: (PX0 + PX1) / 2, y: -1.815, z: (PZ0 + PZ1) / 2 }));
  p.add('stoneWarm', xf(new THREE.BoxGeometry(PX1 - PX0 + 0.5, 0.35, PZ1 - PZ0 + 0.5), { x: (PX0 + PX1) / 2, y: -0.3, z: (PZ0 + PZ1) / 2 }));
  col.floor(PX0, PZ0, PX1, PZ1, tY);
  ctx.podium = { x0: PX0, x1: PX1, z0: PZ0, z1: PZ1 };
  // balustrades on the terrace
  const bal = (x0, z0, x1, z1, y, zoneName = zone) => {
    const bp = new Parts();
    const list = [];
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const ang = Math.atan2(dz, dx);
    const box = (hh, yy, w) => xf(xf(xf(new THREE.BoxGeometry(len, hh, w), { x: len / 2, y: yy + hh / 2 }), { ry: -ang }), { x: x0, y, z: z0 });
    bp.add('stone', box(0.18, 0, 0.36));
    bp.add('stone', box(0.16, 0.86, 0.34));
    const n = Math.floor(len / 0.3);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      list.push(new THREE.Matrix4().compose(new THREE.Vector3(x0 + dx * t, y + 0.18, z0 + dz * t), new THREE.Quaternion(), new THREE.Vector3(1, 0.68 / 0.72, 1)));
    }
    bp.toBatcher(ctx.B, zoneName);
    for (const m of list) inst.add('balusterMarble', m, zoneName);
    col.wall(x0, z0, x1, z1, y - 1, y + 1.2);
  };
  bal(-S.terraceX, S.terraceZ1, -S.stairsHalf - 0.6, S.terraceZ1, tY);
  bal(S.stairsHalf + 0.6, S.terraceZ1, S.terraceX, S.terraceZ1, tY);
  bal(S.terraceX, S.terraceZ1, S.terraceX, S.terraceZ0 + 4, tY);

  // Grand staircase
  const steps = 15;
  const rise = (tY - S.y) / steps;
  const run = (S.stairsZ1 - S.terraceZ1) / steps;
  for (let i = 0; i < steps; i++) {
    const z = S.terraceZ1 + run * (i + 0.5);
    const y = tY - rise * (i + 1);
    p.add('marble', xf(new THREE.BoxGeometry(S.stairsHalf * 2, rise + (y - S.y), run), { y: (y + rise + S.y) / 2 - 0.0, z }));
    p.add('gold', xf(new THREE.BoxGeometry(S.stairsHalf * 2, 0.015, 0.04), { y: y + rise - 0.005, z: z - run / 2 + 0.02 }));
  }
  col.ramp(-S.stairsHalf, S.terraceZ1, S.stairsHalf, S.stairsZ1, 'z', tY, S.y);
  // stair cheek walls with lanterns and angels
  for (const s of [-1, 1]) {
    const x = s * (S.stairsHalf + 0.5);
    const g = new THREE.BufferGeometry();
    p.add('stone', xf(new THREE.BoxGeometry(1.0, 1.2, S.stairsZ1 - S.terraceZ1), { x, y: (tY + S.y) / 2 + 0.6 - 0.9, z: (S.terraceZ1 + S.stairsZ1) / 2 }));
    void g;
    col.wall(x - s * 0.5, S.terraceZ1, x - s * 0.5, S.stairsZ1, S.y - 1, tY + 2);
    inst.add('pedestal', M4(x, tY, S.terraceZ1 + 0.4), zone);
    inst.add('angelStatue', M4(x, tY + 1.5, S.terraceZ1 + 0.4, s * -0.35 + Math.PI * 0), zone);
    inst.add('pedestal', M4(x, S.y, S.stairsZ1 + 0.4), zone);
    inst.add('lantern', M4(x, S.y + 1.5, S.stairsZ1 + 0.4), zone);
    ctx.anchors.extLights.push(new THREE.Vector3(x, S.y + 4.7, S.stairsZ1 + 0.4));
  }

  // Promenade
  col.floor(-S.promHalf, S.stairsZ1, S.promHalf, S.promZ1, S.y);
  for (const s of [-1, 1]) {
    bal(s * S.promHalf, S.stairsZ1 + 1, s * S.promHalf, S.promZ1, S.y);
    let k = 0;
    for (let z = S.stairsZ1 + 7; z < S.promZ1 - 2; z += 12, k++) {
      const x = s * (S.promHalf + 0.1);
      inst.add('pedestal', M4(x, S.y, z), zone);
      if (k % 2 === 0) {
        inst.add('lantern', M4(x, S.y + 1.5, z), zone);
        ctx.anchors.extLights.push(new THREE.Vector3(x, S.y + 4.7, z));
      } else {
        inst.add('angelStatue', M4(x, S.y + 1.5, z, s > 0 ? -Math.PI / 2 + 0.25 : Math.PI / 2 - 0.25), zone);
      }
      col.circle(x, z, 0.7, S.y - 1, S.y + 3);
      inst.add('urnBig', M4(s * (S.promHalf - 1.2), S.y, z + 6, 0, 1), zone);
      col.circle(s * (S.promHalf - 1.2), z + 6, 0.45, S.y - 1, S.y + 2);
    }
    // flower beds with hedges and cypresses beyond the balustrade
    const bedX0 = S.promHalf + 0.8, bedX1 = S.promHalf + 4.2;
    p.add('foliage', xf(new THREE.BoxGeometry(bedX1 - bedX0, 0.7, S.promZ1 - S.stairsZ1 - 2), { x: s * (bedX0 + bedX1) / 2, y: S.y + 0.25, z: (S.stairsZ1 + S.promZ1) / 2 + 1 }));
    const r = rng(s > 0 ? 7 : 13);
    for (let z = S.stairsZ1 + 3; z < S.promZ1; z += 7) {
      inst.add(`cypress${Math.floor(r() * 4)}`, M4(s * (S.promHalf + 6.5 + r() * 0.6), S.y - 0.1, z + r() * 1.2, r() * TAU, 0.9 + r() * 0.25), zone);
    }
    for (let z = S.stairsZ1 + 8; z < S.promZ1; z += 14) inst.add('roundTree', M4(s * (S.promHalf + 13 + r() * 4), S.y - 0.2, z + r() * 5, r() * TAU, 0.9 + r() * 0.4), zone);
  }
  // flowers scattered in the beds (instanced blossoms)
  const blossom = new Parts();
  blossom.add('flowerMix', new THREE.IcosahedronGeometry(0.09, 0));
  inst.define('blossom', blossom, { castShadow: false });
  const r = rng(99);
  const colors = [new THREE.Color(1, 1, 0.97), new THREE.Color(1, 0.8, 0.86), new THREE.Color(1, 0.95, 0.75), new THREE.Color(0.95, 0.6, 0.75)];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 2600; i++) {
      const x = s * (S.promHalf + 0.9 + r() * 3.2);
      const z = S.stairsZ1 + 1 + r() * (S.promZ1 - S.stairsZ1 - 4);
      const m = M4(x, S.y + 0.6 + r() * 0.12, z, r() * TAU, 0.7 + r() * 0.8);
      inst.add('blossom', m, zone, colors[Math.floor(r() * colors.length)].clone().multiplyScalar(0.85 + r() * 0.2));
    }
  }
  // terrace flower urns and trees in planters
  for (const s of [-1, 1]) {
    for (const z of [8, 14, 20]) {
      inst.add('urnBig', M4(s * 20, tY, z), zone);
      col.circle(s * 20, z, 0.5, -1, 2);
    }
  }
  p.toBatcher(ctx.B, zone);
}
