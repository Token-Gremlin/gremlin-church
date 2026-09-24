import * as THREE from 'three';
import { frameMatrix, wallSlab, Parts, PROFILES, balustrade } from '../../arch/components.js';
import { sweepPlanar, xf } from '../../arch/geom.js';

/** Local wall coordinate frame: a along the wall, y up, b toward the interior. */
export class WallFrame {
  constructor(origin, inward) {
    this.o = origin.clone();
    this.n = inward.clone().normalize();
    this.u = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), this.n).normalize();
    this.m = frameMatrix(this.o, this.n);
  }

  aOf(p) {
    return (p.x - this.o.x) * this.u.x + (p.z - this.o.z) * this.u.z;
  }

  world(a, y, b) {
    return this.o.clone().addScaledVector(this.u, a).addScaledVector(this.n, b).setY(this.o.y + y);
  }

  local(tx = 0, ty = 0, tz = 0) {
    return this.m.clone().multiply(new THREE.Matrix4().makeTranslation(tx, ty, tz));
  }
}

export function slab(ctx, zone, frame, outline, holes, t, mat = 'stone') {
  const g = wallSlab(outline, holes, t);
  g.applyMatrix4(frame.m);
  ctx.B.add(`${mat}|${zone}`, g);
  return g;
}

/** Horizontal moulding along local a at height y on face b (profile u = up, v = out of face). */
export function hMould(parts, a0, a1, y, b, profile = PROFILES.string, mat = 'stone', dir = 1) {
  const pts = [new THREE.Vector3(a0, y, b), new THREE.Vector3(a1, y, b)];
  const prof = profile.map(([u, v]) => [u, v * dir]);
  const g = sweepPlanar(prof, pts, new THREE.Vector3(0, 0, 1));
  if (dir < 0) flip(g);
  parts.add(mat, g);
  return g;
}

export function flip(g) {
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) {
    const t = idx[i + 1];
    idx[i + 1] = idx[i + 2];
    idx[i + 2] = t;
  }
  g.computeVertexNormals();
  return g;
}

/** Box in local frame coords (a,y,b ranges). */
export function lbox(parts, mat, a0, a1, y0, y1, b0, b1) {
  const g = new THREE.BoxGeometry(Math.abs(a1 - a0), Math.abs(y1 - y0), Math.abs(b1 - b0));
  xf(g, { x: (a0 + a1) / 2, y: (y0 + y1) / 2, z: (b0 + b1) / 2 });
  parts.add(mat, g);
  return g;
}

/** Balustrade in local frame along a at depth b and height y. */
export function lBalustrade(ctx, zone, frame, a0, a1, y, b, opts = {}) {
  const p0 = frame.world(a0, 0, b), p1 = frame.world(a1, 0, b);
  const parts = new Parts();
  const list = [];
  balustrade(parts, list, p0.x, p0.z, p1.x, p1.z, frame.o.y + y, opts);
  parts.toBatcher(ctx.B, zone);
  for (const m of list) ctx.inst.add(opts.proto || 'baluster', m, zone);
}

export function addGlass(ctx, key, frame, win, extra = {}) {
  const geo = win.glass.clone().applyMatrix4(frame.m);
  const lay = win.layout;
  const W = lay ? lay.W : extra.W;
  const H = lay ? lay.H : extra.H;
  const y0 = extra.y0 ?? 0;
  ctx.glass.add(key, geo, {
    center: frame.world(extra.ca ?? 0, y0 + H / 2, 0),
    normal: frame.n.clone(),
    right: frame.u.clone(),
    W,
    H,
    y0: frame.o.y + y0,
    ca: extra.ca ?? 0,
    frame,
    kind: extra.kind || 'lancet',
    shafts: extra.shafts ?? true,
  });
}
