import * as THREE from 'three';
import { rng } from '../arch/geom.js';
import { windowLayout, lightPolygon, foilPolygon, roseLayout } from '../arch/windowLayout.js';

const TAU = Math.PI * 2;

export const GLASS = {
  blue: ['#0a2a9c', '#1540c4', '#0b2078', '#2257e0', '#123aa8', '#1a48d0'],
  deepBlue: ['#08186a', '#0c2490', '#061258'],
  ruby: ['#b3121e', '#d4202a', '#8c0c18', '#e03a2c'],
  gold: ['#f0b020', '#ffd040', '#e09010', '#ffe070'],
  amber: ['#f08a10', '#ffa020', '#d86a08'],
  green: ['#12803a', '#20a048', '#0d6028', '#3cb85a'],
  emerald: ['#0a7050', '#10906a'],
  purple: ['#6a22a0', '#8a36c4', '#4c1678'],
  rose: ['#e05090', '#f070a8', '#c03070'],
  white: ['#fff6dc', '#fffbee', '#f4e6c4'],
  pale: ['#e8f0ff', '#fff4e0', '#f0e8ff'],
  flesh: ['#f8dcc4', '#f2cfb4'],
  turquoise: ['#10a0b8', '#30c0d0'],
};

function pick(arr, r) {
  return arr[Math.floor(r() * arr.length) % arr.length];
}

function hash2(x, y, s) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

/**
 * A canvas painter working in metres (y up). Maintains a mosaic mask so
 * background areas get irregular glass pieces with lead cames.
 */
export class GlassPainter {
  constructor(W, H, ppm, seed = 1) {
    this.W = W;
    this.H = H;
    this.ppm = ppm;
    this.cw = Math.max(8, Math.ceil(W * ppm));
    this.ch = Math.max(8, Math.ceil(H * ppm));
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.cw;
    this.canvas.height = this.ch;
    this.mcanvas = document.createElement('canvas');
    this.mcanvas.width = this.cw;
    this.mcanvas.height = this.ch;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.mctx = this.mcanvas.getContext('2d', { willReadFrequently: true });
    for (const c of [this.ctx, this.mctx]) {
      c.setTransform(this.cw / W, 0, 0, -this.ch / H, (W / 2) * (this.cw / W), this.ch);
      c.lineJoin = 'round';
      c.lineCap = 'round';
    }
    this.leads = [];
    this.r = rng(seed);
    this.seed = seed;
  }

  static polyBuilder(pts) {
    return (c) => {
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.closePath();
    };
  }

  static ellipseBuilder(x, y, rx, ry, rot = 0) {
    return (c) => c.ellipse(x, y, rx, ry, rot, 0, TAU);
  }

  /** Fill a path on colour canvas and mark mosaic mask. */
  fill(build, style, { mosaic = false, lead = 0.022, alpha = 1 } = {}) {
    const c = this.ctx;
    c.save();
    c.globalAlpha = alpha;
    c.beginPath();
    build(c);
    c.fillStyle = style;
    c.fill();
    c.restore();
    const m = this.mctx;
    m.beginPath();
    build(m);
    m.fillStyle = mosaic ? '#fff' : '#000';
    m.fill();
    if (lead > 0) this.leads.push({ build, width: lead });
  }

  /** Deferred dark painted line (drawn after the mosaic pass). */
  line(pts, width = 0.02, color = 'rgba(25,18,14,0.9)') {
    this.leads.push({
      build: (c) => {
        c.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      },
      width,
      color,
      open: true,
    });
  }

  curve(p0, p1, p2, width = 0.015, color = 'rgba(30,20,16,0.75)') {
    this.leads.push({
      build: (c) => {
        c.moveTo(p0[0], p0[1]);
        c.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]);
      },
      width,
      color,
      open: true,
    });
  }

  clip(build) {
    for (const c of [this.ctx, this.mctx]) {
      c.save();
      c.beginPath();
      build(c);
      c.clip();
    }
  }

  unclip() {
    this.ctx.restore();
    this.mctx.restore();
  }

  radial(x, y, r0, r1, stops) {
    const g = this.ctx.createRadialGradient(x, y, r0, x, y, r1);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    return g;
  }

  linear(x0, y0, x1, y1, stops) {
    const g = this.ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    return g;
  }

  /** Voronoi glass pieces + lead cames within masked regions. */
  mosaic(cellM = 0.14, leadM = 0.02) {
    const { cw, ch } = this;
    const img = this.ctx.getImageData(0, 0, cw, ch);
    const mask = this.mctx.getImageData(0, 0, cw, ch).data;
    const d = img.data;
    const cell = cellM * (cw / this.W);
    const lead = Math.max(1.1, leadM * (cw / this.W));
    const gw = Math.ceil(cw / cell) + 3;
    const gh = Math.ceil(ch / cell) + 3;
    const jx = new Float32Array(gw * gh);
    const jy = new Float32Array(gw * gh);
    const shade = new Float32Array(gw * gh);
    const hueS = new Float32Array(gw * gh);
    const s = this.seed;
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const i = y * gw + x;
        jx[i] = 0.12 + 0.76 * hash2(x, y, s);
        jy[i] = 0.12 + 0.76 * hash2(x, y, s + 17);
        shade[i] = 0.8 + 0.4 * hash2(x, y, s + 31);
        hueS[i] = hash2(x, y, s + 47) - 0.5;
      }
    }
    let sr = 0, sg = 0, sb = 0, sn = 0;
    for (let py = 0; py < ch; py++) {
      const gy = py / cell;
      const iy = Math.floor(gy);
      for (let px = 0; px < cw; px++) {
        const gx = px / cell;
        const ix = Math.floor(gx);
        let f1 = 1e9, f2 = 1e9, id = 0;
        for (let oy = -1; oy <= 1; oy++) {
          const cy = iy + oy + 1;
          if (cy < 0 || cy >= gh) continue;
          for (let ox = -1; ox <= 1; ox++) {
            const cx = ix + ox + 1;
            if (cx < 0 || cx >= gw) continue;
            const ci = cy * gw + cx;
            const dx = gx - (ix + ox + jx[ci]);
            const dy = gy - (iy + oy + jy[ci]);
            const dd = dx * dx + dy * dy;
            if (dd < f1) {
              f2 = f1;
              f1 = dd;
              id = ci;
            } else if (dd < f2) f2 = dd;
          }
        }
        const e = (Math.sqrt(f2) - Math.sqrt(f1)) * cell;
        const p = (py * cw + px) * 4;
        const inMask = mask[p] > 127;
        let k = shade[id];
        const cf = Math.sqrt(f1);
        k *= 1.06 - 0.14 * Math.min(1, cf * 1.3);
        const hs = hueS[id] * 0.12;
        let r = d[p] * k * (1 + hs);
        let g = d[p + 1] * k;
        let b = d[p + 2] * k * (1 - hs);
        const grain = 0.94 + 0.12 * hash2(px, py, s + 3);
        r *= grain;
        g *= grain;
        b *= grain;
        if (inMask) {
          if (e < lead) {
            r = 22; g = 18; b = 16;
          } else if (e < lead * 2.4) {
            const t = 0.55 + 0.45 * ((e - lead) / (lead * 1.4));
            r *= t; g *= t; b *= t;
          }
        }
        d[p] = r > 255 ? 255 : r;
        d[p + 1] = g > 255 ? 255 : g;
        d[p + 2] = b > 255 ? 255 : b;
        sr += d[p]; sg += d[p + 1]; sb += d[p + 2]; sn++;
      }
    }
    this.ctx.putImageData(img, 0, 0);
    this.average = sn ? [sr / sn / 255, sg / sn / 255, sb / sn / 255] : [0.5, 0.5, 0.8];
  }

  finish({ bars = 0.75, barWidth = 0.028 } = {}) {
    const c = this.ctx;
    for (const l of this.leads) {
      c.beginPath();
      l.build(c);
      c.strokeStyle = l.color || '#171310';
      c.lineWidth = l.width;
      c.stroke();
    }
    if (bars > 0) {
      c.strokeStyle = 'rgba(20,16,14,0.95)';
      c.lineWidth = barWidth;
      for (let y = bars; y < this.H; y += bars) {
        c.beginPath();
        c.moveTo(-this.W / 2, y);
        c.lineTo(this.W / 2, y);
        c.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(this.canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.userData.average = new THREE.Color().setRGB(...this.average.map((v) => Math.pow(v, 2.2)));
    return tex;
  }
}

// ---------------------------------------------------------------------------
// Motifs
// ---------------------------------------------------------------------------

function starPoly(cx, cy, rOut, rIn, n, rot = Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i / (n * 2)) * TAU;
    const r = i % 2 === 0 ? rOut : rIn;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

function drawHalo(p, x, y, r, cruciform = false, stars = false) {
  p.fill(GlassPainter.ellipseBuilder(x, y, r * 1.18, r * 1.18), p.radial(x, y, 0, r * 1.18, [[0, 'rgba(255,240,170,0.9)'], [1, 'rgba(255,200,80,0.0)']]), { lead: 0 });
  p.fill(GlassPainter.ellipseBuilder(x, y, r, r), p.radial(x, y, r * 0.1, r, [[0, '#fffbe0'], [0.55, '#ffd850'], [1, '#e89818']]), { lead: 0.02 });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    p.line([[x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62], [x + Math.cos(a) * r * 0.97, y + Math.sin(a) * r * 0.97]], r * 0.035, 'rgba(160,90,20,0.6)');
  }
  if (cruciform) {
    const w = r * 0.22;
    p.fill(GlassPainter.polyBuilder([[x - w / 2, y + r * 0.35], [x + w / 2, y + r * 0.35], [x + w / 2, y + r * 0.95], [x - w / 2, y + r * 0.95]]), '#d42a2a', { lead: 0.012 });
    p.fill(GlassPainter.polyBuilder([[x - r * 0.95, y - w / 2 + r * 0.1], [x - r * 0.5, y - w / 2 + r * 0.1], [x - r * 0.5, y + w / 2 + r * 0.1], [x - r * 0.95, y + w / 2 + r * 0.1]]), '#d42a2a', { lead: 0.012 });
    p.fill(GlassPainter.polyBuilder([[x + r * 0.5, y - w / 2 + r * 0.1], [x + r * 0.95, y - w / 2 + r * 0.1], [x + r * 0.95, y + w / 2 + r * 0.1], [x + r * 0.5, y + w / 2 + r * 0.1]]), '#d42a2a', { lead: 0.012 });
  }
  if (stars) {
    for (let i = 0; i < 12; i++) {
      const a = Math.PI / 2 + ((i - 5.5) / 12) * Math.PI * 1.3;
      p.fill(GlassPainter.polyBuilder(starPoly(x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86, r * 0.1, r * 0.04, 5)), '#fff6c0', { lead: 0.006 });
    }
  }
}

function drawWings(p, X, Y, h, col) {
  for (const s of [-1, 1]) {
    const pts = [
      [X(s * 0.06), Y(0.74)],
      [X(s * 0.2), Y(0.93)],
      [X(s * 0.33), Y(1.02)],
      [X(s * 0.36), Y(0.9)],
      [X(s * 0.32), Y(0.62)],
      [X(s * 0.27), Y(0.36)],
      [X(s * 0.2), Y(0.3)],
      [X(s * 0.12), Y(0.5)],
    ];
    p.fill(GlassPainter.polyBuilder(pts), p.linear(X(0), Y(0.3), X(s * 0.35), Y(1.0), [[0, col[0]], [0.6, col[1]], [1, col[2]]]), { lead: 0.022 });
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      p.curve([X(s * (0.1 + t * 0.1)), Y(0.6 + t * 0.2)], [X(s * (0.2 + t * 0.08)), Y(0.62 + t * 0.12)], [X(s * (0.24 + t * 0.09)), Y(0.34 + t * 0.26)], h * 0.004, 'rgba(90,60,20,0.8)');
    }
  }
}

/**
 * Standing haloed figure. Coordinates: figure base at y0, height h.
 * kind: 'saint' | 'angel' | 'madonna' | 'christ'
 */
export function drawFigure(p, cx, y0, h, kind, r, theme = {}) {
  const X = (u) => cx + u * h;
  const Y = (v) => y0 + v * h;
  const robe = theme.robe || pick([GLASS.white[0], GLASS.ruby[1], GLASS.green[1], GLASS.gold[0], GLASS.purple[1]], r);
  const mantle = theme.mantle || pick([GLASS.blue[1], GLASS.ruby[0], GLASS.green[0], GLASS.purple[0]], r);
  const lw = h * 0.009;

  if (kind === 'christ') {
    // radiant mandorla
    p.fill(GlassPainter.ellipseBuilder(X(0), Y(0.52), h * 0.3, h * 0.56), p.radial(X(0), Y(0.6), h * 0.05, h * 0.56, [[0, '#fffbe6'], [0.45, '#ffe08a'], [0.8, '#f5a52a'], [1, '#e07818']]), { lead: 0.025 });
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU;
      p.line([[X(Math.cos(a) * 0.12), Y(0.6 + Math.sin(a) * 0.22)], [X(Math.cos(a) * 0.29), Y(0.52 + Math.sin(a) * 0.54)]], lw * 0.8, 'rgba(200,120,30,0.5)');
    }
  }
  if (kind === 'angel') drawWings(p, X, Y, h, theme.wings || ['#fff4d0', '#ffd66a', '#f0a030']);

  drawHalo(p, X(0), Y(0.875), h * 0.1, kind === 'christ', kind === 'madonna');

  // under robe
  const hemWave = (u) => Y(0.035 + 0.012 * Math.sin(u * 40));
  const robePts = [[X(-0.09), Y(0.79)], [X(0.09), Y(0.79)], [X(0.12), Y(0.55)], [X(0.19), Y(0.05)]];
  for (let i = 0; i <= 8; i++) {
    const u = 0.19 - (i / 8) * 0.38;
    robePts.push([X(u), hemWave(u)]);
  }
  robePts.push([X(-0.12), Y(0.55)]);
  p.fill(GlassPainter.polyBuilder(robePts), p.linear(X(-0.2), Y(0.5), X(0.2), Y(0.5), [[0, shade(robe, 0.7)], [0.45, robe], [1, shade(robe, 0.6)]]), { lead: 0.024 });
  for (let i = 0; i < 5; i++) {
    const u = -0.12 + i * 0.06;
    p.curve([X(u * 0.6), Y(0.52)], [X(u * 0.95), Y(0.3)], [X(u * 1.35), Y(0.07)], lw, 'rgba(40,20,20,0.55)');
  }

  if (kind === 'christ') {
    // outstretched blessing arms
    for (const s of [-1, 1]) {
      const arm = [[X(s * 0.08), Y(0.76)], [X(s * 0.26), Y(0.7)], [X(s * 0.3), Y(0.64)], [X(s * 0.25), Y(0.62)], [X(s * 0.1), Y(0.64)]];
      p.fill(GlassPainter.polyBuilder(arm), shade(robe, 0.85), { lead: 0.02 });
      p.fill(GlassPainter.ellipseBuilder(X(s * 0.31), Y(0.68), h * 0.022, h * 0.03), GLASS.flesh[0], { lead: 0.012 });
    }
  }

  // mantle
  const dir = r() < 0.5 ? 1 : -1;
  const mantlePts = kind === 'madonna'
    ? [[X(-0.07), Y(0.96)], [X(0.07), Y(0.96)], [X(0.13), Y(0.78)], [X(0.16), Y(0.5)], [X(0.22), Y(0.06)], [X(0.08), Y(0.1)], [X(0.07), Y(0.55)], [X(0.0), Y(0.7)], [X(-0.07), Y(0.55)], [X(-0.08), Y(0.1)], [X(-0.22), Y(0.06)], [X(-0.16), Y(0.5)], [X(-0.13), Y(0.78)]]
    : [[X(-0.1 * dir), Y(0.8)], [X(0.05 * dir), Y(0.79)], [X(0.13 * dir), Y(0.6)], [X(0.17 * dir), Y(0.26)], [X(0.07 * dir), Y(0.14)], [X(-0.2 * dir), Y(0.07)], [X(-0.15 * dir), Y(0.48)]];
  p.fill(GlassPainter.polyBuilder(mantlePts), p.linear(X(-0.2), Y(0.3), X(0.2), Y(0.7), [[0, shade(mantle, 0.6)], [0.5, mantle], [1, shade(mantle, 0.75)]]), { lead: 0.026 });
  for (let i = 0; i < 4; i++) {
    const u = (-0.08 + i * 0.05) * dir;
    p.curve([X(u), Y(0.7 - i * 0.05)], [X(u + 0.05 * dir), Y(0.42)], [X(u - 0.04 * dir), Y(0.12)], lw * 1.1, 'rgba(10,10,40,0.6)');
  }
  p.line(mantlePts.concat([mantlePts[0]]).map(([x, y]) => [x, y]), lw * 0.8, 'rgba(255,215,90,0.55)');

  // neck + head
  p.fill(GlassPainter.polyBuilder([[X(-0.022), Y(0.78)], [X(0.022), Y(0.78)], [X(0.02), Y(0.83)], [X(-0.02), Y(0.83)]]), GLASS.flesh[1], { lead: 0.012 });
  if (kind === 'madonna') {
    p.fill(GlassPainter.ellipseBuilder(X(0), Y(0.872), h * 0.068, h * 0.08), GLASS.white[1], { lead: 0.016 });
  } else {
    const hair = theme.hair || pick(['#a0602a', '#d8a040', '#6a3a1a', '#e8c070'], r);
    p.fill(GlassPainter.ellipseBuilder(X(0), Y(0.885), h * 0.06, h * 0.07), hair, { lead: 0.016 });
  }
  p.fill(GlassPainter.ellipseBuilder(X(0), Y(0.868), h * 0.047, h * 0.06), p.radial(X(-0.01), Y(0.88), 0, h * 0.07, [[0, '#fff0e2'], [1, '#e8bea0']]), { lead: 0.016 });
  // face
  const fw = h * 0.004;
  p.line([[X(-0.03), Y(0.885)], [X(-0.01), Y(0.89)]], fw, 'rgba(70,40,30,0.8)');
  p.line([[X(0.03), Y(0.885)], [X(0.01), Y(0.89)]], fw, 'rgba(70,40,30,0.8)');
  p.line([[X(0), Y(0.883)], [X(-0.004), Y(0.86)], [X(0.004), Y(0.857)]], fw * 0.8, 'rgba(90,50,40,0.6)');
  p.line([[X(-0.012), Y(0.842)], [X(0.012), Y(0.842)]], fw, 'rgba(120,40,40,0.6)');

  // hands and attribute
  if (kind !== 'christ') {
    const att = theme.attribute || pick(['book', 'lily', 'palm', 'staff', 'pray', 'trumpet'], r);
    if (att === 'pray' || kind === 'madonna') {
      p.fill(GlassPainter.polyBuilder([[X(-0.018), Y(0.58)], [X(0.018), Y(0.58)], [X(0.006), Y(0.66)], [X(-0.006), Y(0.66)]]), GLASS.flesh[0], { lead: 0.014 });
    } else if (att === 'book') {
      p.fill(GlassPainter.polyBuilder([[X(-0.05), Y(0.55)], [X(0.05), Y(0.57)], [X(0.05), Y(0.65)], [X(-0.05), Y(0.63)]]), '#c82828', { lead: 0.016 });
      p.fill(GlassPainter.polyBuilder([[X(-0.04), Y(0.565)], [X(0.04), Y(0.582)], [X(0.04), Y(0.635)], [X(-0.04), Y(0.62)]]), '#ffd860', { lead: 0.008 });
      p.fill(GlassPainter.ellipseBuilder(X(-0.055), Y(0.58), h * 0.018, h * 0.022), GLASS.flesh[0], { lead: 0.01 });
    } else if (att === 'lily' || att === 'palm') {
      const green = att === 'palm' ? '#28a040' : '#3a9a40';
      p.line([[X(0.05), Y(0.5)], [X(0.07), Y(0.8)], [X(0.09), Y(0.98)]], h * 0.012, green);
      if (att === 'lily') {
        for (let i = 0; i < 3; i++) p.fill(GlassPainter.ellipseBuilder(X(0.085 + (i - 1) * 0.025), Y(0.93 + i * 0.02), h * 0.018, h * 0.028), '#fffaf0', { lead: 0.008 });
      } else {
        for (let i = 0; i < 7; i++) {
          const yy = 0.78 + i * 0.03;
          p.line([[X(0.075 + i * 0.002), Y(yy)], [X(0.12), Y(yy + 0.03)]], h * 0.008, '#30b048');
          p.line([[X(0.075 + i * 0.002), Y(yy)], [X(0.035), Y(yy + 0.03)]], h * 0.008, '#30b048');
        }
      }
      p.fill(GlassPainter.ellipseBuilder(X(0.05), Y(0.6), h * 0.02, h * 0.024), GLASS.flesh[0], { lead: 0.01 });
    } else if (att === 'staff') {
      p.line([[X(-0.07), Y(0.04)], [X(-0.07), Y(1.0)]], h * 0.012, '#ffd24a');
      p.line([[X(-0.1), Y(0.95)], [X(-0.04), Y(0.95)]], h * 0.012, '#ffd24a');
      p.fill(GlassPainter.ellipseBuilder(X(-0.07), Y(0.62), h * 0.02, h * 0.024), GLASS.flesh[0], { lead: 0.01 });
    } else if (att === 'trumpet') {
      p.fill(GlassPainter.polyBuilder([[X(0.02), Y(0.84)], [X(0.22), Y(0.98)], [X(0.25), Y(0.94)], [X(0.04), Y(0.82)]]), '#ffc830', { lead: 0.012 });
      p.fill(GlassPainter.ellipseBuilder(X(0.04), Y(0.78), h * 0.02, h * 0.024), GLASS.flesh[0], { lead: 0.01 });
    }
  } else {
    p.fill(GlassPainter.polyBuilder([[X(-0.02), Y(0.02)], [X(0.02), Y(0.02)], [X(0.015), Y(0.045)], [X(-0.015), Y(0.045)]]), GLASS.flesh[0], { lead: 0.01 });
  }
  // feet
  p.fill(GlassPainter.ellipseBuilder(X(-0.05), Y(0.03), h * 0.03, h * 0.014), GLASS.flesh[1], { lead: 0.01 });
  p.fill(GlassPainter.ellipseBuilder(X(0.05), Y(0.03), h * 0.03, h * 0.014), GLASS.flesh[1], { lead: 0.01 });
}

function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
}

/** Gothic micro-architecture canopy over a figure. */
function drawCanopy(p, cx, yBase, w, h, r) {
  const white = '#fff4d8';
  const gold = '#ffcc40';
  const legW = w * 0.08;
  for (const s of [-1, 1]) {
    const x = cx + s * (w / 2 - legW / 2);
    p.fill(GlassPainter.polyBuilder([[x - legW / 2, yBase - h * 0.9], [x + legW / 2, yBase - h * 0.9], [x + legW / 2, yBase + h * 0.55], [x - legW / 2, yBase + h * 0.55]]), white, { lead: 0.016 });
    p.fill(GlassPainter.polyBuilder([[x - legW * 0.7, yBase + h * 0.55], [x + legW * 0.7, yBase + h * 0.55], [x, yBase + h * 0.95]]), gold, { lead: 0.014 });
  }
  const archPts = [];
  const span = w - legW * 2;
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = Math.PI - t * Math.PI;
    archPts.push([cx + Math.cos(a) * span / 2, yBase + Math.pow(Math.sin(a), 0.8) * h * 0.4 + (1 - Math.abs(Math.cos(a))) * h * 0.05]);
  }
  const outer = archPts.map(([x, y]) => [x + (x - cx) * 0.1, y + h * 0.12]);
  p.fill(GlassPainter.polyBuilder(outer.concat(archPts.slice().reverse())), white, { lead: 0.016 });
  const gable = [[cx - w * 0.36, yBase + h * 0.42], [cx + w * 0.36, yBase + h * 0.42], [cx, yBase + h * 1.05]];
  p.fill(GlassPainter.polyBuilder(gable), p.linear(cx, yBase + h * 0.4, cx, yBase + h, [[0, gold], [1, white]]), { lead: 0.018 });
  p.fill(GlassPainter.ellipseBuilder(cx, yBase + h * 0.62, w * 0.09, w * 0.09), '#d42a2a', { lead: 0.012 });
}

function drawMedallion(p, cx, cy, rad, r, palette) {
  const ring = pick([GLASS.ruby[0], GLASS.gold[0], GLASS.white[0]], r);
  p.fill(GlassPainter.ellipseBuilder(cx, cy, rad, rad), ring, { lead: 0.022 });
  const beads = 18;
  for (let i = 0; i < beads; i++) {
    const a = (i / beads) * TAU;
    p.fill(GlassPainter.ellipseBuilder(cx + Math.cos(a) * rad * 0.9, cy + Math.sin(a) * rad * 0.9, rad * 0.06, rad * 0.06), '#fff5d0', { lead: 0.008 });
  }
  p.fill(GlassPainter.ellipseBuilder(cx, cy, rad * 0.8, rad * 0.8), palette.inner, { mosaic: true, lead: 0.02 });
  const motif = Math.floor(r() * 4);
  if (motif === 0) {
    p.fill(GlassPainter.polyBuilder(starPoly(cx, cy, rad * 0.62, rad * 0.26, 8)), p.radial(cx, cy, 0, rad * 0.6, [[0, '#fffce8'], [0.5, '#ffd84a'], [1, '#f09a20']]), { lead: 0.016 });
  } else if (motif === 1) {
    const w = rad * 0.16;
    p.fill(GlassPainter.polyBuilder([[cx - w, cy - rad * 0.6], [cx + w, cy - rad * 0.6], [cx + w, cy + rad * 0.62], [cx - w, cy + rad * 0.62]]), '#ffd040', { lead: 0.016 });
    p.fill(GlassPainter.polyBuilder([[cx - rad * 0.45, cy + rad * 0.12], [cx + rad * 0.45, cy + rad * 0.12], [cx + rad * 0.45, cy + rad * 0.12 + w * 2], [cx - rad * 0.45, cy + rad * 0.12 + w * 2]]), '#ffd040', { lead: 0.016 });
  } else if (motif === 2) {
    drawFigure(p, cx, cy - rad * 0.7, rad * 1.35, r() < 0.5 ? 'angel' : 'saint', r, { attribute: 'pray' });
  } else {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 2;
      p.fill(GlassPainter.ellipseBuilder(cx + Math.cos(a) * rad * 0.38, cy + Math.sin(a) * rad * 0.38, rad * 0.24, rad * 0.14, a), i % 2 ? '#ffd040' : '#f4f0ff', { lead: 0.014 });
    }
    p.fill(GlassPainter.ellipseBuilder(cx, cy, rad * 0.18, rad * 0.18), '#d42a2a', { lead: 0.014 });
  }
}

function drawRosette(p, c, r, colors) {
  const { cx, cy } = c;
  const R = c.r * 1.05;
  p.fill(GlassPainter.ellipseBuilder(cx, cy, R, R), colors.bg, { mosaic: true, lead: 0.02 });
  const petals = c.foils || 6;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * TAU + Math.PI / 2;
    const pc = [cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.55];
    p.fill(GlassPainter.ellipseBuilder(pc[0], pc[1], R * 0.33, R * 0.2, a), i % 2 ? colors.a : colors.b, { lead: 0.02 });
    p.fill(GlassPainter.ellipseBuilder(pc[0], pc[1], R * 0.12, R * 0.08, a), '#fff2c0', { lead: 0.01 });
  }
  p.fill(GlassPainter.polyBuilder(starPoly(cx, cy, R * 0.32, R * 0.14, 8, r() * 0.5)), p.radial(cx, cy, 0, R * 0.3, [[0, '#ffffff'], [0.4, '#ffe070'], [1, '#f09020']]), { lead: 0.016 });
}

function drawBorder(p, poly, width, r, colors) {
  // wide stroke along the inner edge of the light, then beads
  p.leads.push({ build: GlassPainter.polyBuilder(poly), width: 0.02 });
  const c = p.ctx;
  c.save();
  c.beginPath();
  GlassPainter.polyBuilder(poly)(c);
  c.clip();
  c.beginPath();
  GlassPainter.polyBuilder(poly)(c);
  c.lineWidth = width * 2;
  c.strokeStyle = colors[0];
  c.stroke();
  c.restore();
  // beads along the edge
  let acc = 0;
  const step = width * 1.25;
  let k = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
    while (acc < len) {
      const t = acc / len;
      const x = x0 + (x1 - x0) * t - nx * width * 0.5;
      const y = y0 + (y1 - y0) * t - ny * width * 0.5;
      p.fill(GlassPainter.ellipseBuilder(x, y, width * 0.32, width * 0.32), colors[1 + (k++ % (colors.length - 1))], { lead: 0.01 });
      acc += step;
    }
    acc -= len;
  }
}

const THEMES = [
  { bg: GLASS.blue, border: ['#b8141e', '#ffd040', '#f4f0ff'], inner: '#b3121e', robe: null },
  { bg: GLASS.ruby, border: ['#0c2a9a', '#ffd040', '#f4f0ff'], inner: '#1238b0', robe: null },
  { bg: GLASS.blue, border: ['#12803a', '#ffd040', '#e03a2c'], inner: '#6a22a0', robe: null },
  { bg: GLASS.purple, border: ['#ffd040', '#f4f0ff', '#1540c4'], inner: '#0a2a9c', robe: null },
  { bg: GLASS.deepBlue, border: ['#d4202a', '#ffe070', '#30c0d0'], inner: '#12803a', robe: null },
];

function fillBackground(p, build, colors, r) {
  p.fill(build, colors[0], { mosaic: true, lead: 0 });
  // tint scatter: overlay random tints before mosaic so pieces vary in hue
  const c = p.ctx;
  c.save();
  c.beginPath();
  build(c);
  c.clip();
  for (let i = 0; i < 140; i++) {
    const x = (r() - 0.5) * p.W;
    const y = r() * p.H;
    c.beginPath();
    c.arc(x, y, 0.06 + r() * 0.14, 0, TAU);
    c.fillStyle = pick(colors, r);
    c.globalAlpha = 0.55;
    c.fill();
  }
  c.restore();
}

function drawLight(p, l, kind, r, theme, opts = {}) {
  const poly = lightPolygon(l);
  const build = GlassPainter.polyBuilder(poly);
  const bleed = 0.05;
  const bleedPoly = lightPolygon({ ...l, w: l.w + bleed * 2, y0: l.y0 - bleed, springY: l.springY });
  fillBackground(p, GlassPainter.polyBuilder(bleedPoly), theme.bg, r);
  p.clip(build);
  const topY = l.springY + l.rise;
  const hTotal = topY - l.y0;
  if (kind === 'medallions' || hTotal < l.w * 2.2) {
    const n = Math.max(1, Math.floor((l.springY - l.y0) / (l.w * 1.15)));
    const step = (l.springY - l.y0) / n;
    for (let i = 0; i < n; i++) {
      drawMedallion(p, l.cx, l.y0 + step * (i + 0.5), Math.min(l.w * 0.38, step * 0.4), r, theme);
    }
  } else {
    const figH = Math.min(hTotal * 0.5, l.w * 3.6);
    const figBase = l.y0 + (l.springY - l.y0) * (opts.figureAt ?? 0.36);
    // niche background behind figure
    const nicheW = l.w * 0.86;
    p.fill(GlassPainter.polyBuilder([[l.cx - nicheW / 2, figBase - figH * 0.06], [l.cx + nicheW / 2, figBase - figH * 0.06], [l.cx + nicheW / 2, figBase + figH * 1.02], [l.cx - nicheW / 2, figBase + figH * 1.02]]), theme.inner, { mosaic: true, lead: 0.02 });
    drawCanopy(p, l.cx, figBase + figH * 1.02, l.w * 0.9, figH * 0.32, r);
    // pedestal
    p.fill(GlassPainter.polyBuilder([[l.cx - nicheW * 0.42, figBase - figH * 0.06], [l.cx + nicheW * 0.42, figBase - figH * 0.06], [l.cx + nicheW * 0.34, figBase + figH * 0.02], [l.cx - nicheW * 0.34, figBase + figH * 0.02]]), '#2a9a48', { lead: 0.016 });
    drawFigure(p, l.cx, figBase, figH, opts.figure || pick(['saint', 'saint', 'angel', 'madonna'], r), r, opts.figTheme || {});
    // medallions beneath
    const below = figBase - figH * 0.1 - l.y0;
    const n = Math.max(0, Math.floor(below / (l.w * 1.05)));
    for (let i = 0; i < n; i++) {
      const step = below / n;
      drawMedallion(p, l.cx, l.y0 + step * (i + 0.5), Math.min(l.w * 0.36, step * 0.42), r, theme);
    }
    // star in the head
    const headY = figBase + figH * 1.45;
    if (headY + l.w * 0.2 < topY - l.w * 0.1) {
      p.fill(GlassPainter.polyBuilder(starPoly(l.cx, (headY + topY) / 2, l.w * 0.2, l.w * 0.08, 8)), '#ffd040', { lead: 0.012 });
    }
  }
  drawBorder(p, poly, Math.min(0.13, l.w * 0.07), r, theme.border);
  p.unclip();
}

/**
 * Builds a stained glass texture for a window layout.
 * options.figures: array of figure kinds per light (or null for automatic)
 */
export function windowTexture(layout, seed, options = {}) {
  const { W, H } = layout;
  const ppm = options.ppm ?? Math.min(96, 1100 / H);
  const p = new GlassPainter(W, H, ppm, seed);
  const r = p.r;
  const theme = options.theme ?? THEMES[seed % THEMES.length];
  p.fill(GlassPainter.polyBuilder([[-W / 2, 0], [W / 2, 0], [W / 2, H], [-W / 2, H]]), shade(theme.bg[0], 0.5), { lead: 0 });
  layout.lights.forEach((l, i) => {
    const fig = options.figures ? options.figures[i % options.figures.length] : null;
    drawLight(p, l, options.kind || 'figure', r, theme, { figure: fig, figureAt: options.figureAt, figTheme: options.figTheme });
  });
  for (const c of layout.circles) {
    const poly = foilPolygon({ ...c, r: c.r * 1.06 });
    p.clip(GlassPainter.polyBuilder(poly));
    drawRosette(p, c, r, { bg: theme.inner, a: theme.bg[0], b: theme.border[1] });
    p.unclip();
    p.leads.push({ build: GlassPainter.polyBuilder(foilPolygon(c)), width: 0.02 });
  }
  p.mosaic(options.cell ?? 0.13, 0.018);
  return p.finish({ bars: options.bars ?? 0.8 });
}

/** Rose window texture (square). Rings: centre medallion, petals, outer roundels. */
export function roseTexture(R, seed, { petals = 12, ppm = null, center = 'christ' } = {}) {
  const size = R * 2;
  const p = new GlassPainter(size, size, ppm ?? Math.min(90, 1024 / size), seed);
  const r = p.r;
  const cx = 0, cy = R;
  p.fill(GlassPainter.ellipseBuilder(cx, cy, R, R), '#0a1e70', { mosaic: true, lead: 0 });
  const lay = roseLayout(R, petals, -0.04);
  lay.roundels.forEach((rd, i) => {
    const x = cx + rd.cx, y = cy + rd.cy;
    const a = Math.atan2(rd.cy, rd.cx);
    p.fill(GlassPainter.ellipseBuilder(x, y, rd.r, rd.r), i % 2 ? '#c41a24' : '#1a48d0', { mosaic: true, lead: 0.02 });
    p.fill(GlassPainter.polyBuilder(starPoly(x, y, rd.r * 0.6, rd.r * 0.25, 4, a)), i % 2 ? '#ffd040' : '#fff6dc', { lead: 0.012 });
  });
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * TAU + Math.PI / 2;
    const pts = lay.petals[i].map(([x, y]) => [cx + x, cy + y]);
    const col = [GLASS.blue[1], GLASS.ruby[1], GLASS.purple[1], GLASS.green[1]][i % 4];
    p.fill(GlassPainter.polyBuilder(pts), col, { mosaic: true, lead: 0.024 });
    const mx = cx + Math.cos(a) * R * 0.52, my = cy + Math.sin(a) * R * 0.52;
    if (i % 2 === 0) {
      drawFigure(p, mx, my - R * 0.13, R * 0.27, 'angel', r, { attribute: 'trumpet' });
    } else {
      p.fill(GlassPainter.ellipseBuilder(mx, my, R * 0.085, R * 0.085), '#ffd040', { lead: 0.016 });
      p.fill(GlassPainter.polyBuilder(starPoly(mx, my, R * 0.07, R * 0.03, 6, a)), '#fffbe8', { lead: 0.01 });
    }
  }
  // centre
  p.fill(GlassPainter.ellipseBuilder(cx, cy, R * 0.28, R * 0.28), p.radial(cx, cy, 0, R * 0.28, [[0, '#fffbe6'], [0.5, '#ffd860'], [1, '#e88a18']]), { lead: 0.026 });
  if (center === 'christ') drawFigure(p, cx, cy - R * 0.22, R * 0.42, 'christ', r, { robe: '#fff4e0', mantle: '#c41a24' });
  else if (center === 'madonna') drawFigure(p, cx, cy - R * 0.22, R * 0.42, 'madonna', r, { robe: '#fff4e0', mantle: '#1540c4' });
  else p.fill(GlassPainter.polyBuilder(starPoly(cx, cy, R * 0.25, R * 0.1, 12)), '#fffbe0', { lead: 0.016 });
  p.mosaic(0.16, 0.02);
  return p.finish({ bars: 0 });
}

/** Simple lancet (single light) pattern for small windows (drum, chapels). */
export function simpleLancetTexture(w, h, k, seed, { figure = null, theme = null } = {}) {
  const layout = windowLayout(w, h, k, 1, { mullion: Math.max(0.06, w * 0.06) });
  return { layout, texture: windowTexture(layout, seed, { theme: theme ?? THEMES[seed % THEMES.length], figures: figure ? [figure] : null, ppm: Math.min(110, 700 / h), cell: 0.11 }) };
}

export { THEMES };
