/**
 * Lightweight walking collision: vertical walls as 2D segments/circles with a height
 * range, and analytic walkable surfaces (flat rects, ramps, polygons, discs, spirals).
 */
export class Collision {
  constructor(cell = 4) {
    this.cell = cell;
    this.grid = new Map();
    this.floors = [];
    this.nSeg = 0;
  }

  _key(ix, iz) {
    return ix * 73856093 ^ iz * 19349663;
  }

  _insert(item, x0, z0, x1, z1) {
    const c = this.cell;
    const ix0 = Math.floor(Math.min(x0, x1) / c), ix1 = Math.floor(Math.max(x0, x1) / c);
    const iz0 = Math.floor(Math.min(z0, z1) / c), iz1 = Math.floor(Math.max(z0, z1) / c);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const k = this._key(ix, iz);
        let list = this.grid.get(k);
        if (!list) this.grid.set(k, (list = []));
        list.push(item);
      }
    }
  }

  wall(ax, az, bx, bz, y0 = -1e4, y1 = 1e4) {
    const s = { t: 0, ax, az, bx, bz, y0, y1, id: this.nSeg++ };
    this._insert(s, ax, az, bx, bz);
    return s;
  }

  /** Polyline wall. */
  poly(points, closed = false, y0 = -1e4, y1 = 1e4) {
    for (let i = 0; i < points.length - (closed ? 0 : 1); i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      this.wall(a[0], a[1], b[0], b[1], y0, y1);
    }
  }

  /** Axis-aligned solid box (all four sides). */
  box(x0, z0, x1, z1, y0 = -1e4, y1 = 1e4) {
    this.poly([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], true, y0, y1);
  }

  /** Oriented box centred at (cx,cz) with half extents, rotated by ang around Y. */
  obox(cx, cz, hw, hd, ang, y0 = -1e4, y1 = 1e4) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const pts = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, z]) => [cx + x * c + z * s, cz - x * s + z * c]);
    this.poly(pts, true, y0, y1);
  }

  circle(x, z, r, y0 = -1e4, y1 = 1e4) {
    const s = { t: 1, x, z, r, y0, y1, id: this.nSeg++ };
    this._insert(s, x - r, z - r, x + r, z + r);
    return s;
  }

  // --- walkable surfaces -------------------------------------------------

  floor(x0, z0, x1, z1, y) {
    this.floors.push({ t: 0, x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), y });
  }

  /** Ramp over a rect; height goes from yA at the min side to yB at the max side of the axis. */
  ramp(x0, z0, x1, z1, axis, yA, yB) {
    this.floors.push({ t: 1, x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), axis, yA, yB });
  }

  floorPoly(points, y) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const [x, z] of points) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
    this.floors.push({ t: 2, pts: points, x0, z0, x1, z1, y });
  }

  disc(cx, cz, r, y, rIn = 0) {
    this.floors.push({ t: 3, cx, cz, r, rIn, y, x0: cx - r, x1: cx + r, z0: cz - r, z1: cz + r });
  }

  /** Spiral stair: ground rises with angle. dir = +1 counter-clockwise seen from above. */
  spiral(cx, cz, rIn, rOut, y0, y1, turns, a0 = 0, dir = 1) {
    this.floors.push({ t: 4, cx, cz, rIn, rOut, y0, y1, turns, a0, dir, x0: cx - rOut, x1: cx + rOut, z0: cz - rOut, z1: cz + rOut });
  }

  _floorHeight(f, x, z, yRef) {
    if (x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) return null;
    switch (f.t) {
      case 0: return f.y;
      case 1: {
        const t = f.axis === 'x' ? (x - f.x0) / (f.x1 - f.x0 || 1) : (z - f.z0) / (f.z1 - f.z0 || 1);
        return f.yA + (f.yB - f.yA) * t;
      }
      case 2: return pointInPoly(x, z, f.pts) ? f.y : null;
      case 3: {
        const d = Math.hypot(x - f.cx, z - f.cz);
        return d <= f.r && d >= f.rIn ? f.y : null;
      }
      case 4: {
        const d = Math.hypot(x - f.cx, z - f.cz);
        if (d < f.rIn || d > f.rOut) return null;
        let a = Math.atan2(-(z - f.cz), x - f.cx) * f.dir - f.a0;
        a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const rise = (f.y1 - f.y0) / f.turns;
        let best = null;
        for (let k = 0; k < Math.ceil(f.turns) + 1; k++) {
          const y = f.y0 + (a / (Math.PI * 2) + k) * rise;
          if (y > f.y1 + 0.01) break;
          if (best === null || Math.abs(y - yRef) < Math.abs(best - yRef)) best = y;
        }
        return best;
      }
      default: return null;
    }
  }

  /** Cut a hole through floors whose height lies in [yMin, yMax] (stairwells). */
  hole(x0, z0, x1, z1, yMin = -0.1, yMax = 0.1) {
    (this.holes ||= []).push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), yMin, yMax });
  }

  _inHole(x, z, y) {
    if (!this.holes) return false;
    for (const h of this.holes) {
      if (x >= h.x0 && x <= h.x1 && z >= h.z0 && z <= h.z1 && y >= h.yMin && y <= h.yMax) return true;
    }
    return false;
  }

  /** Highest walkable height at (x,z) not above yRef + stepUp. */
  groundAt(x, z, yRef, stepUp = 0.55) {
    let best = -Infinity;
    for (const f of this.floors) {
      const y = this._floorHeight(f, x, z, yRef);
      if (y !== null && y <= yRef + stepUp && y > best && !(f.t !== 1 && f.t !== 4 && this._inHole(x, z, y))) best = y;
    }
    return best;
  }

  /** Push a circle (pos.x,pos.z,radius) out of walls overlapping [feetY, headY]. */
  resolve(pos, feetY, headY, radius) {
    const c = this.cell;
    const ix = Math.floor(pos.x / c), iz = Math.floor(pos.z / c);
    const seen = new Set();
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const list = this.grid.get(this._key(ix + dx, iz + dz));
          if (!list) continue;
          for (const s of list) {
            if (iter === 0) {
              if (seen.has(s.id)) continue;
              seen.add(s.id);
            }
            if (s.y1 < feetY + 0.3 || s.y0 > headY) continue;
            if (s.t === 0) {
              const ex = s.bx - s.ax, ez = s.bz - s.az;
              const l2 = ex * ex + ez * ez || 1e-9;
              let t = ((pos.x - s.ax) * ex + (pos.z - s.az) * ez) / l2;
              t = Math.max(0, Math.min(1, t));
              const px = s.ax + ex * t, pz = s.az + ez * t;
              const ddx = pos.x - px, ddz = pos.z - pz;
              const d2 = ddx * ddx + ddz * ddz;
              if (d2 < radius * radius) {
                const d = Math.sqrt(d2) || 1e-6;
                const push = radius - d;
                pos.x += (ddx / d) * push;
                pos.z += (ddz / d) * push;
                moved = true;
              }
            } else {
              const ddx = pos.x - s.x, ddz = pos.z - s.z;
              const d = Math.hypot(ddx, ddz) || 1e-6;
              const rr = radius + s.r;
              if (d < rr) {
                pos.x += (ddx / d) * (rr - d);
                pos.z += (ddz / d) * (rr - d);
                moved = true;
              }
            }
          }
        }
      }
      if (!moved) break;
    }
  }
}

export function pointInPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
