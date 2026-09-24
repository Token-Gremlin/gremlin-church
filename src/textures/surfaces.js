import * as THREE from 'three';
import { rng } from '../arch/geom.js';

const TAU = Math.PI * 2;

function periodicNoise(size, period, seed) {
  const r = rng(seed);
  const lat = new Float32Array(period * period);
  for (let i = 0; i < lat.length; i++) lat[i] = r();
  return (x, y) => {
    const fx = (x / size) * period, fy = (y / size) * period;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy;
    const ux = tx * tx * (3 - 2 * tx), uy = ty * ty * (3 - 2 * ty);
    const x0 = ((ix % period) + period) % period, y0 = ((iy % period) + period) % period;
    const x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
    const a = lat[y0 * period + x0], b = lat[y0 * period + x1];
    const c = lat[y1 * period + x0], d = lat[y1 * period + x1];
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
}

function periodicFbm(size, basePeriod, octaves, seed) {
  const layers = [];
  for (let o = 0; o < octaves; o++) layers.push(periodicNoise(size, basePeriod << o, seed + o * 101));
  return (x, y) => {
    let s = 0, a = 0.5, n = 0;
    for (let o = 0; o < octaves; o++) {
      s += layers[o](x, y) * a;
      n += a;
      a *= 0.5;
    }
    return s / n;
  };
}

/**
 * Tileable detail texture: R = marble veins, G = soft cloudiness, B = fine grain.
 */
export function marbleDetailTexture(size = 512, seed = 7) {
  const warp = periodicFbm(size, 4, 5, seed);
  const cloud = periodicFbm(size, 3, 5, seed + 50);
  const grain = periodicFbm(size, 32, 3, seed + 90);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const w = warp(x, y);
      const v = Math.abs(Math.sin(((x + y * 0.35) / size) * TAU * 2 + w * 9.0));
      const vein = Math.pow(v, 0.18);
      const w2 = warp((x * 2.3 + 71) % size, (y * 2.3 + 13) % size);
      const v2 = Math.pow(Math.abs(Math.sin(((y - x * 0.6) / size) * TAU * 3 + w2 * 7.0)), 0.3);
      const i = (y * size + x) * 4;
      data[i] = Math.round(255 * Math.min(vein, 0.35 + 0.65 * v2));
      data[i + 1] = Math.round(255 * cloud(x, y));
      data[i + 2] = Math.round(255 * grain(x, y));
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function finishCanvas(c, { repeat = false, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function woodTexture(seed = 3) {
  const size = 512;
  const [c, ctx] = canvas(size, size);
  const img = ctx.createImageData(size, size);
  const n = periodicFbm(size, 4, 4, seed);
  const fine = periodicFbm(size, 64, 2, seed + 9);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const w = n(x, y);
      const ring = 0.5 + 0.5 * Math.sin((x / size) * TAU * 14 + w * 10 + Math.sin((y / size) * TAU) * 1.5);
      const f = fine(x, (y * 0.1) % size);
      const k = 0.55 + 0.25 * ring + 0.2 * f;
      const i = (y * size + x) * 4;
      img.data[i] = 92 * k + 18;
      img.data[i + 1] = 46 * k + 10;
      img.data[i + 2] = 26 * k + 6;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finishCanvas(c, { repeat: true });
}

function drawStar(ctx, x, y, rOut, rIn, n, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i / (n * 2)) * TAU;
    const r = i % 2 === 0 ? rOut : rIn;
    ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

/** Deep blue velvet banner with gold border and star emblem. */
export function bannerTexture(variant = 0) {
  const w = 256, h = 1024;
  const [c, ctx] = canvas(w, h);
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#0a1440');
  g.addColorStop(0.5, variant === 1 ? '#6a0e1c' : '#13266e');
  g.addColorStop(1, '#0a1440');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 3);
  }
  const gold = ctx.createLinearGradient(0, 0, w, h);
  gold.addColorStop(0, '#f8e08a');
  gold.addColorStop(0.5, '#c8902a');
  gold.addColorStop(1, '#f5d070');
  ctx.strokeStyle = gold;
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, w - 28, h - 110);
  ctx.lineWidth = 3;
  ctx.strokeRect(30, 30, w - 60, h - 142);
  ctx.fillStyle = gold;
  drawStar(ctx, w / 2, h * 0.36, 86, 30, 8);
  ctx.fill();
  drawStar(ctx, w / 2, h * 0.36, 44, 16, 8, -Math.PI / 2 + Math.PI / 8);
  ctx.fillStyle = '#fff4c8';
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    drawStar(ctx, w / 2, h * 0.6 + i * 80, 20, 8, 8);
    ctx.fillStyle = gold;
    ctx.fill();
  }
  // fringe
  for (let x = 8; x < w - 8; x += 6) {
    ctx.fillStyle = gold;
    ctx.fillRect(x, h - 96, 3, 60 + Math.sin(x) * 4);
  }
  return finishCanvas(c);
}

/** Gold mosaic tesserae (tympanum, apse). */
export function goldMosaicTexture(seed = 5) {
  const size = 512;
  const [c, ctx] = canvas(size, size);
  const r = rng(seed);
  ctx.fillStyle = '#6a4a18';
  ctx.fillRect(0, 0, size, size);
  const s = 8;
  for (let y = 0; y < size; y += s) {
    const off = (y / s) % 2 ? s / 2 : 0;
    for (let x = -s; x < size; x += s) {
      const k = 0.75 + r() * 0.35;
      ctx.fillStyle = `rgb(${Math.min(255, 235 * k)},${Math.min(255, 180 * k)},${Math.min(255, 80 * k)})`;
      ctx.fillRect(x + off + 0.6, y + 0.6, s - 1.2, s - 1.2);
    }
  }
  return finishCanvas(c, { repeat: true });
}

/** Celestial painting for the interior of the dome (u = azimuth, v = elevation). */
export function domeTexture(seed = 11) {
  const w = 2048, h = 1024;
  const [c, ctx] = canvas(w, h);
  const r = rng(seed);
  const g = ctx.createLinearGradient(0, h, 0, 0);
  g.addColorStop(0, '#0a1a5c');
  g.addColorStop(0.55, '#10287a');
  g.addColorStop(0.85, '#1a3a9a');
  g.addColorStop(1, '#fff0c0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // concentric gold bands
  const band = (v, width) => {
    const gg = ctx.createLinearGradient(0, (1 - v) * h - width, 0, (1 - v) * h + width);
    gg.addColorStop(0, '#8a5a14');
    gg.addColorStop(0.5, '#ffe08a');
    gg.addColorStop(1, '#8a5a14');
    ctx.fillStyle = gg;
    ctx.fillRect(0, (1 - v) * h - width, w, width * 2);
  };
  band(0.03, 10);
  band(0.34, 6);
  band(0.66, 6);
  band(0.9, 8);
  // stars of different sizes, denser towards the top
  ctx.fillStyle = '#ffe6a0';
  for (let i = 0; i < 1400; i++) {
    const v = Math.pow(r(), 0.8) * 0.88 + 0.05;
    const x = r() * w;
    const y = (1 - v) * h;
    const s = 3 + r() * 9 * (1.1 - v * 0.5);
    ctx.fillStyle = r() < 0.15 ? '#fffaf0' : '#ffd97a';
    drawStar(ctx, x, y, s, s * 0.38, r() < 0.3 ? 4 : 8, r() * TAU);
    ctx.fill();
  }
  // radiating rays near the oculus
  for (let i = 0; i < 64; i++) {
    const x = (i / 64) * w;
    const gg = ctx.createLinearGradient(0, 0, 0, h * 0.35);
    gg.addColorStop(0, 'rgba(255,236,170,0.8)');
    gg.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.moveTo(x - 10, 0);
    ctx.lineTo(x + 10, 0);
    ctx.lineTo(x + 2, h * 0.35);
    ctx.lineTo(x - 2, h * 0.35);
    ctx.fill();
  }
  // angels / medallions in the middle band
  for (let i = 0; i < 16; i++) {
    const x = (i + 0.5) / 16 * w;
    const y = h * 0.5;
    const rg = ctx.createRadialGradient(x, y, 4, x, y, 70);
    rg.addColorStop(0, '#fff6d0');
    rg.addColorStop(0.5, '#f0c050');
    rg.addColorStop(1, 'rgba(160,110,30,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x, y, 70, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#10287a';
    ctx.beginPath();
    ctx.arc(x, y, 44, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffe08a';
    drawStar(ctx, x, y, 36, 14, 8, (i % 2) * Math.PI / 8);
    ctx.fill();
  }
  // lower zone: gold arcade pattern
  for (let i = 0; i < 48; i++) {
    const x = (i / 48) * w;
    ctx.strokeStyle = '#e8c060';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x + w / 96, h * 0.97, w / 96 - 4, Math.PI, 0);
    ctx.stroke();
  }
  const t = finishCanvas(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Soft radial glow sprite (flames, light pools). */
export function glowTexture(size = 128, stops = [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,240,200,0.6)'], [1, 'rgba(255,200,120,0)']]) {
  const [c, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finishCanvas(c, { srgb: false });
}

/** Leaf/foliage alpha sprite. */
export function leafTexture() {
  const size = 128;
  const [c, ctx] = canvas(size, size);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(size / 2, 4);
  ctx.quadraticCurveTo(size - 10, size / 2, size / 2, size - 4);
  ctx.quadraticCurveTo(10, size / 2, size / 2, 4);
  ctx.fill();
  return finishCanvas(c, { srgb: false });
}
