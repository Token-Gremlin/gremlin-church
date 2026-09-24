import * as THREE from 'three';
import { L } from '../layout.js';
import { Parts, pinnacle, finial, colonnette } from '../../arch/components.js';
import { xf, cyl, lathe, polyLathe, TAU, rng } from '../../arch/geom.js';
import {
  pewParts, chandelierParts, coronaParts, candelabrumParts, bannerParts, flowerUrnParts, angelParts, madonnaParts, pedestalParts, canopyParts,
} from './protos.js';
import { CROSS } from '../cathedral/crossing.js';

const M4 = (x, y, z, ry = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s));

export function furnishInterior(ctx) {
  const inst = ctx.inst;
  const flames = [];
  const lights = ctx.anchors.lights;
  const addLight = (pos, intensity, color = 0xffb060, radius = 18) => lights.push({ pos: pos.clone(), intensity, color: new THREE.Color(color), radius });

  // --- Pews in five groups along the nave ---------------------------------
  inst.define('pew', pewParts(4.0));
  const groups = [[-8.6, 8], [-18.4, 8], [-28.2, 8], [-38.0, 8], [-47.8, 7]];
  for (const [z0, n] of groups) {
    for (let i = 0; i < n; i++) {
      const z = z0 - i * 1.02;
      for (const s of [-1, 1]) inst.add('pew', M4(s * 4.4, 0, z, 0), 'nave');
    }
    const zEnd = z0 - (n - 1) * 1.02;
    for (const s of [-1, 1]) ctx.col.box(s * 2.35, zEnd - 0.7, s * 6.45, z0 + 0.5, -1, 1.2);
  }

  // --- Flower urns at the aisle ends and candelabra in the cross aisles ---
  inst.define('flowerUrn', flowerUrnParts(5, 1.0));
  for (const [z0, n] of groups) {
    for (const s of [-1, 1]) {
      inst.add('flowerUrn', M4(s * 2.25, 0, z0 + 0.35, 0, 0.9), 'nave');
      inst.add('flowerUrn', M4(s * 2.25, 0, z0 - (n - 1) * 1.02 - 0.45, 0, 0.9), 'nave');
    }
  }
  const cand = candelabrumParts(2.3);
  inst.define('candelabrum', cand.parts);
  for (const z of [-17.3, -27.1, -36.9, -46.7]) {
    for (const s of [-1, 1]) {
      const x = s * 2.2;
      inst.add('candelabrum', M4(x, 0, z), 'nave');
      for (const f of cand.flames) flames.push(f.clone().add(new THREE.Vector3(x, 0, z)));
      addLight(new THREE.Vector3(x, 2.3, z), 5, 0xffa850, 12);
      ctx.col.circle(x, z, 0.3, -1, 3);
    }
  }

  // --- Chandeliers --------------------------------------------------------
  const ch = chandelierParts(1, 1.0);
  inst.define('chandelier', ch.parts, { castShadow: false });
  const chain = new Parts();
  chain.add('gold', cyl(0.018, 0.018, 1, 5));
  inst.define('chain', chain, { castShadow: false });
  const hang = (x, y, z, top, zone) => {
    inst.add('chandelier', M4(x, y, z, (x + z) * 0.3), zone);
    inst.add('chain', new THREE.Matrix4().compose(new THREE.Vector3(x, y + 2.55, z), new THREE.Quaternion(), new THREE.Vector3(1, top - (y + 2.55), 1)), zone);
    const rot = (x + z) * 0.3;
    for (const f of ch.flames) flames.push(f.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rot).add(new THREE.Vector3(x, y, z)));
    addLight(new THREE.Vector3(x, y + 0.6, z), 26, 0xffb870, 26);
  };
  for (let i = 1; i < L.naveBays; i++) {
    const z = -i * L.bay - L.bay / 2;
    for (const s of [-1, 1]) hang(s * 3.4, 11.5, z, 32.2, 'nave');
  }
  for (const s of [-1, 1]) {
    for (let j = 0; j < L.transBays; j++) hang(s * (L.naveHalf + j * L.bay + L.bay / 2), 12.5, CROSS.cz, 32.2, s < 0 ? 'transN' : 'transS');
  }
  for (let i = 0; i < L.choirBays; i++) hang(0, 13, L.crossZ1 - i * L.bay - L.bay / 2, 32.5, 'choir');

  // --- Great corona beneath the dome --------------------------------------
  const cor = coronaParts(4.0);
  const coronaY = 16.5;
  cor.parts.toBatcher(ctx.B, 'crossing', new THREE.Matrix4().makeTranslation(0, coronaY, CROSS.cz), true);
  for (const f of cor.flames) flames.push(f.clone().add(new THREE.Vector3(0, coronaY, CROSS.cz)));
  const cc = new Parts();
  cc.add('gold', cyl(0.035, 0.035, CROSS.ring - coronaY - 7, 6, 0, coronaY + 7, CROSS.cz));
  cc.toBatcher(ctx.B, 'crossing');
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    addLight(new THREE.Vector3(Math.cos(a) * 3.5, coronaY + 0.5, CROSS.cz + Math.sin(a) * 3.5), 30, 0xffb870, 24);
  }

  // --- Banners on the piers above the triforium ---------------------------
  const ban = bannerParts(1.35, 5.0, 'banner');
  const banR = bannerParts(1.35, 5.0, 'bannerRed');
  inst.define('banner', ban, { castShadow: false });
  inst.define('bannerRed', banR, { castShadow: false });
  for (let i = 1; i < L.naveBays; i++) {
    for (const s of [-1, 1]) {
      const z = -i * L.bay;
      inst.add(i % 3 === 0 ? 'bannerRed' : 'banner', M4(s * (L.naveFace - 0.55), 24.6, z, s < 0 ? Math.PI / 2 : -Math.PI / 2), 'nave');
    }
  }
  for (let i = 1; i < L.choirBays; i++) {
    for (const s of [-1, 1]) inst.add('bannerRed', M4(s * (L.naveFace - 0.55), 24.6, L.crossZ1 - i * L.bay, s < 0 ? Math.PI / 2 : -Math.PI / 2), 'choir');
  }

  // --- Statues on the nave piers beneath gilded canopies -------------------
  inst.define('pierAngel', angelParts({ scale: 1.0 }));
  inst.define('pierCanopy', canopyParts(1.0), { castShadow: false });
  const corbel = new Parts();
  corbel.add('stone', lathe([[0.001, -0.7], [0.2, -0.62], [0.36, -0.4], [0.5, -0.12], [0.55, 0]], 12));
  corbel.add('gold', lathe([[0.5, -0.12], [0.57, -0.06], [0.55, 0.0]], 12));
  inst.define('corbel', corbel);
  for (let i = 1; i < L.naveBays; i++) {
    for (const s of [-1, 1]) {
      const z = -i * L.bay;
      const x = s * (L.naveHalf - 1.55);
      const ry = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      inst.add('corbel', M4(x, 9.3, z, ry), 'nave');
      inst.add('pierAngel', M4(x, 9.3, z, ry, 0.95), 'nave');
      inst.add('pierCanopy', M4(x, 11.75, z, ry, 1), 'nave');
    }
  }

  // --- Choir stalls, lectern -----------------------------------------------
  const stall = new Parts();
  const sl = 2.4;
  stall.add('wood', xf(new THREE.BoxGeometry(sl, 0.9, 0.7), { y: 0.45 }));
  stall.add('wood', xf(new THREE.BoxGeometry(sl, 2.6, 0.12), { y: 1.3, z: -0.4 }));
  stall.add('wood', xf(new THREE.BoxGeometry(sl, 0.8, 0.5), { y: 0.4, z: 0.75 }));
  stall.add('wood', xf(new THREE.BoxGeometry(sl + 0.1, 0.12, 1.1), { y: 2.7, z: -0.1 }));
  stall.add('gold', xf(new THREE.BoxGeometry(sl + 0.12, 0.05, 1.12), { y: 2.62, z: -0.1 }));
  for (let k = 0; k < 4; k++) {
    const x = -sl / 2 + 0.3 + k * 0.6;
    stall.add('wood', xf(new THREE.BoxGeometry(0.06, 0.95, 0.6), { x: x - 0.3, y: 1.35, z: -0.05 }));
    const pin = pinnacle({ w: 0.12, shaftH: 0.3, spireH: 0.55, mat: 'wood', gold: true });
    pin.transform(new THREE.Matrix4().makeTranslation(x, 2.76, 0.35));
    stall.merge(pin);
  }
  inst.define('stall', stall);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 5; k++) {
      const z = -77.8 - k * 2.45;
      inst.add('stall', M4(s * (L.naveFace - 0.55), L.choirY, z, s < 0 ? Math.PI / 2 : -Math.PI / 2), 'choir');
    }
    ctx.col.box(s * (L.naveFace - 1.3), -89.2, s * L.naveFace, -76.6, 0, 3);
  }
  const lect = new Parts();
  lect.add('gold', lathe([[0.3, 0], [0.32, 0.05], [0.12, 0.2], [0.07, 0.4], [0.06, 1.1], [0.12, 1.2], [0.05, 1.25]], 12));
  lect.add('gold', xf(new THREE.BoxGeometry(0.7, 0.04, 0.5), { y: 1.35, rx: -0.5 }));
  lect.add('gold', xf(new THREE.SphereGeometry(0.12, 10, 8), { y: 1.2 }));
  lect.add('linen', xf(new THREE.BoxGeometry(0.46, 0.06, 0.34), { y: 1.39, rx: -0.5, z: 0.02 }));
  lect.toBatcher(ctx.B, 'choir', new THREE.Matrix4().makeTranslation(0, L.choirY, -83.5), true);
  ctx.col.circle(0, -83.5, 0.45, 0, 2);

  // --- Pulpit at the north-west crossing pier ------------------------------
  const pul = new Parts();
  pul.add('marble', cyl(0.25, 0.3, 2.4, 12));
  pul.add('marble', polyLathe([[0.35, 2.3], [1.0, 2.8], [1.0, 3.9], [1.06, 4.0]], 8, Math.PI / 8));
  pul.add('gold', polyLathe([[1.02, 2.95], [1.02, 3.05]], 8, Math.PI / 8, false));
  pul.add('gold', polyLathe([[1.07, 3.9], [1.07, 4.0]], 8, Math.PI / 8, false));
  pul.add('wood', xf(new THREE.BoxGeometry(0.6, 0.05, 0.4), { y: 4.05, z: 0.65, rx: -0.4 }));
  pul.add('wood', polyLathe([[1.25, 7.2], [1.25, 7.45], [0.02, 8.6]], 8, Math.PI / 8));
  pul.add('gold', polyLathe([[1.27, 7.18], [1.27, 7.24]], 8, Math.PI / 8, false));
  finial(pul, 0, 8.6, 0, 0.25, 'gold');
  pul.toBatcher(ctx.B, 'crossing', new THREE.Matrix4().makeTranslation(-5.4, 0, -58.2).multiply(new THREE.Matrix4().makeRotationY(Math.PI * 0.75)), true);
  ctx.col.circle(-5.4, -58.2, 1.1, -1, 5);

  // --- Votive stands in the aisles ----------------------------------------
  const vot = new Parts();
  vot.add('iron', xf(new THREE.BoxGeometry(1.6, 0.05, 0.5), { y: 0.9 }));
  vot.add('iron', xf(new THREE.BoxGeometry(1.6, 0.05, 0.36), { y: 1.05, z: -0.12 }));
  vot.add('iron', xf(new THREE.BoxGeometry(1.6, 0.05, 0.22), { y: 1.2, z: -0.22 }));
  for (const x of [-0.75, 0.75]) vot.add('iron', xf(new THREE.BoxGeometry(0.04, 0.9, 0.04), { x, y: 0.45 }));
  inst.define('votiveStand', vot);
  const votiveCandle = new Parts();
  votiveCandle.add('votiveGlass', cyl(0.03, 0.028, 0.07, 8));
  inst.define('votive', votiveCandle, { castShadow: false });
  const r = rng(71);
  const votivePositions = [];
  for (const [x, z, ry] of [[-13.6, -26.25, Math.PI / 2], [13.6, -33.75, -Math.PI / 2], [-13.6, -48.75, Math.PI / 2], [13.6, -11.25, -Math.PI / 2]]) {
    inst.add('votiveStand', M4(x, 0, z, ry), 'aisles');
    ctx.col.box(x - 0.4, z - 0.85, x + 0.4, z + 0.85, -1, 1.5);
    for (let row = 0; row < 3; row++) {
      for (let k = 0; k < 11; k++) {
        const lx = -0.7 + k * 0.14;
        const lz = [0.1, -0.12, -0.24][row];
        const ly = [0.93, 1.08, 1.23][row];
        const p = new THREE.Vector3(lx, ly, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(new THREE.Vector3(x, 0, z));
        inst.add('votive', M4(p.x, p.y, p.z), 'aisles');
        const flame = p.clone().add(new THREE.Vector3(0, 0.1, 0));
        if (r() < 0.62) votivePositions.push(flame);
        else ctx.world.unlitVotives.push({ pos: flame, lit: false });
      }
    }
    addLight(new THREE.Vector3(x, 1.6, z), 5, 0xff9a40, 8);
    // Madonna above each stand
    const mad = madonnaParts({ scale: 0.8 });
    const ped = pedestalParts(1.1, 0.6);
    const off = new THREE.Vector3(0, 0, -0.55).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    ped.toBatcher(ctx.B, 'aisles', M4(x + off.x, 0, z + off.z, ry), true);
    mad.toBatcher(ctx.B, 'aisles', M4(x + off.x, 1.1, z + off.z, ry), true);
  }
  for (const p of votivePositions) flames.push(p);

  return flames;
}
