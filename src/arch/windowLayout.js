import { archRise, archPoints } from './geom.js';

/**
 * Computes the tracery layout of a gothic window. Coordinates are in metres with
 * x ∈ [−W/2, W/2], y ∈ [0, H]. The same layout drives both the stone tracery
 * geometry and the stained-glass texture so the glass lines up with the openings.
 */
export function windowLayout(W, H, k = 0.75, nLights = 2, opts = {}) {
  const m = opts.mullion ?? Math.max(0.12, W * 0.04);
  const outerRise = archRise(W, k);
  const springY = H - outerRise;
  const layout = { W, H, k, m, springY, outerRise, lights: [], circles: [], subArches: [] };

  if (nLights === 1) {
    const w = W - 2 * m;
    const kl = k;
    const rise = archRise(w, kl);
    const top = H - m * 1.2;
    layout.lights.push({ cx: 0, w, k: kl, springY: top - rise, y0: m, rise });
    return layout;
  }

  if (nLights === 4) {
    const subW = (W - 3 * m) / 2;
    const bigR = W * 0.2;
    const bigCy = H - m * 1.5 - bigR;
    const subH = Math.min(bigCy - bigR * 0.25, H - outerRise * 0.35);
    for (const s of [-1, 1]) {
      const cx = s * (subW / 2 + m / 2);
      const sub = windowLayout(subW, subH, k, 2, { mullion: m * 0.8 });
      layout.subArches.push({ cx, W: subW, H: subH, k, springY: sub.springY });
      for (const l of sub.lights) layout.lights.push({ ...l, cx: l.cx + cx });
      for (const c of sub.circles) layout.circles.push({ ...c, cx: c.cx + cx });
    }
    layout.circles.push({ cx: 0, cy: bigCy, r: bigR, foils: 8, big: true });
    return layout;
  }

  const w = (W - (nLights + 1) * m) / nLights;
  const kl = Math.max(0.62, k * 0.95);
  const riseL = archRise(w, kl);
  const rc = nLights === 2 ? W * 0.25 : W * 0.21;
  const cy = H - m * 1.5 - rc;
  let springL = Infinity;
  for (let i = 0; i < nLights; i++) {
    const cx = -W / 2 + m + w / 2 + i * (w + m);
    const need = rc + m * 1.35;
    const dx = Math.abs(cx);
    const dy = need > dx ? Math.sqrt(need * need - dx * dx) : 0;
    springL = Math.min(springL, cy - dy - riseL * 0.92);
  }
  springL = Math.min(springL, springY - m * 0.3);
  for (let i = 0; i < nLights; i++) {
    const cx = -W / 2 + m + w / 2 + i * (w + m);
    layout.lights.push({ cx, w, k: kl, springY: springL, y0: m, rise: riseL });
  }
  layout.circles.push({ cx: 0, cy, r: rc, foils: nLights === 2 ? 6 : 5 });
  // small spandrel trefoils beside the circle when there is room
  if (opts.spandrels !== false && nLights === 3) {
    for (const s of [-1, 1]) {
      const r2 = rc * 0.36;
      layout.circles.push({ cx: s * (rc + r2 + m * 0.6), cy: cy - rc * 0.35, r: r2, foils: 3 });
    }
  }
  return layout;
}

/** Polygon points [[x,y],...] of a lancet light (legs + pointed head). */
export function lightPolygon(l, segs = 14) {
  const pts = [[l.cx - l.w / 2, l.y0]];
  for (const p of archPoints(l.w, l.k, segs)) pts.push([l.cx + p.x, l.springY + p.y]);
  pts.push([l.cx + l.w / 2, l.y0]);
  return pts;
}

/** Polygon for a foiled circle. */
export function foilPolygon(c, segs = 72) {
  const pts = [];
  const f = c.foils || 0;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2 + Math.PI / 2;
    let r = c.r;
    if (f > 0) {
      const lobe = Math.abs(Math.cos((f * (a - Math.PI / 2)) / 2));
      r = c.r * (0.8 + 0.2 * Math.pow(lobe, 0.5));
    }
    pts.push([c.cx + Math.cos(a) * r, c.cy + Math.sin(a) * r]);
  }
  return pts;
}

/**
 * Rose window layout centred at (0,0): centre disc, radial petals, outer roundels.
 * shrink > 0 insets shapes (used for stone tracery holes).
 */
export function roseLayout(R, petals = 12, shrink = 0) {
  const center = { r: R * 0.28 - shrink };
  const petalPolys = [];
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 + Math.PI / 2;
    const r0 = R * 0.3 + shrink, r1 = R * 0.74 - shrink;
    const half = (Math.PI / petals) * 0.78 - shrink / (R * 0.5);
    const pts = [];
    for (let j = 0; j <= 10; j++) {
      const aa = a - half + (j / 10) * half * 2;
      pts.push([Math.cos(aa) * r0, Math.sin(aa) * r0]);
    }
    const shoulderR = r1 * 0.82;
    pts.push([Math.cos(a + half) * shoulderR, Math.sin(a + half) * shoulderR]);
    pts.push([Math.cos(a) * r1, Math.sin(a) * r1]);
    pts.push([Math.cos(a - half) * shoulderR, Math.sin(a - half) * shoulderR]);
    petalPolys.push(pts);
  }
  const roundels = [];
  for (let i = 0; i < petals * 2; i++) {
    const a = (i / (petals * 2)) * Math.PI * 2 + Math.PI / 2;
    roundels.push({ cx: Math.cos(a) * R * 0.86, cy: Math.sin(a) * R * 0.86, r: R * 0.1 - shrink });
  }
  return { R, center, petals: petalPolys, roundels };
}

/** Outline of the whole window opening. */
export function outerPolygon(W, H, k, segs = 20) {
  const springY = H - archRise(W, k);
  const pts = [[-W / 2, 0]];
  for (const p of archPoints(W, k, segs)) pts.push([p.x, springY + p.y]);
  pts.push([W / 2, 0]);
  return pts;
}
