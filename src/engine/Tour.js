import * as THREE from 'three';

/**
 * The guided tour: chapters of camera keyframes (eye position p, look target t).
 * Within a chapter the camera glides along centripetal Catmull-Rom splines at a
 * walking pace; between distant chapters the view fades through dusk-dark.
 */
export const TOUR = [
  {
    title: 'The Approach',
    text: 'Between lanterns and white angels the promenade climbs toward the Basilica of Celestial Light, its stone warming in the last hour of the sun.',
    night: 0,
    speed: 3.2,
    keys: [
      { p: [0, -1.05, 104], t: [0, 24, 0] },
      { p: [0, -1.15, 74], t: [0, 25, 0] },
      { p: [0, -1.3, 44], t: [0, 20, 2], hold: 1.2 },
    ],
  },
  {
    title: 'The Portal of Kings',
    text: 'Saints stand in the deep jambs of the great portal. Above, the west window catches the last of the evening.',
    speed: 2.4,
    keys: [
      { p: [0, -1.3, 44], t: [0, 20, 2] },
      { p: [0, -0.2, 31], t: [0, 15, 3] },
      { p: [0, 1.66, 22], t: [0, 12, 3] },
      { p: [0, 1.66, 15.5], t: [0, 8.2, 3], hold: 2.5 },
    ],
  },
  {
    title: 'The Nave',
    text: 'Eight bays of clustered piers lift a vault of lapis and gold thirty-four metres above the marble floor.',
    speed: 2.2,
    keys: [
      { p: [0, 1.66, 15.5], t: [0, 8.2, 3] },
      { p: [0, 1.66, 5], t: [0, 4.5, -10] },
      { p: [0, 1.66, -5], t: [0, 11, -60], hold: 1.5 },
      { p: [0, 1.66, -24], t: [0, 17, -60], hold: 1 },
    ],
  },
  {
    title: 'Rivers of Colour',
    text: 'The low sun pours through the north clerestory, and every window lays its saints upon the floor in coloured light.',
    speed: 1.1,
    keys: [
      { p: [5.2, 1.66, -45], t: [-5, 14, -31] },
      { p: [5.2, 1.66, -39], t: [-6, 12, -26], hold: 1 },
    ],
  },
  {
    title: 'Beneath the Dome',
    text: 'Twelve windows ring the drum. Above them a painted heaven turns around a single eye of light.',
    speed: 2.2,
    keys: [
      { p: [0, 1.66, -48], t: [0, 12, -75] },
      { p: [0, 1.66, -62], t: [0, 30, -69] },
      { p: [0, 1.66, -66.2], t: [0, 50, -69.6], hold: 2.5 },
    ],
  },
  {
    title: 'The High Altar',
    text: 'Seven lancets crown the sanctuary, where a reredos of gilded niches keeps the saints about the altar.',
    speed: 1.8,
    keys: [
      { p: [0, 1.66, -68], t: [0, 7, -97] },
      { p: [0, 2.26, -79], t: [0, 7, -98] },
      { p: [0, 2.26, -83.5], t: [0, 6, -98], hold: 2.5 },
    ],
  },
  {
    title: 'The Lady Chapel',
    text: 'An octagon of blue and gold where candles keep vigil at the feet of the Madonna. Light one, if you wish.',
    speed: 1.9,
    keys: [
      { p: [18.75, 1.66, -67.5], t: [18.75, 3, -90] },
      { p: [18.75, 1.66, -77], t: [18.75, 3.4, -91] },
      { p: [18.75, 1.66, -81.8], t: [18.75, 3.8, -91], hold: 2.5 },
    ],
  },
  {
    title: 'The Crypt',
    text: 'Beneath the choir, rose-marble columns stand in candlelight around a still pool of floating flames.',
    speed: 1.6,
    keys: [
      { p: [5.3, 1.66, -68.6], t: [5.3, -1.5, -78] },
      { p: [5.3, 0.86, -71.8], t: [5.3, -2.2, -79] },
      { p: [5.3, -1.54, -75.2], t: [5.3, -2.6, -84] },
      { p: [5.0, -2.54, -78.6], t: [1, -2.9, -90] },
      { p: [3.1, -2.54, -80.6], t: [0, -3.1, -96], hold: 2.5 },
    ],
  },
  {
    title: 'The Gallery of Saints',
    text: 'A white arcade opens onto the garden. Saints and candles line the wall beneath vaults of blue and gold.',
    speed: 1.7,
    keys: [
      { p: [-19.2, 1.66, -11], t: [-19.2, 4, -60] },
      { p: [-19.2, 1.66, -27], t: [-21, 3.5, -45] },
      { p: [-19.6, 1.66, -32.4], t: [-32, 3, -34] },
    ],
  },
  {
    title: 'The Garden of Paradise',
    text: 'Cypress and roses frame a fountain of three basins crowned by a golden angel. Beyond the balustrade the land falls away to the valley.',
    speed: 0.9,
    keys: [
      { p: [-63, 1.7, -28], t: [-20, 15, -42] },
      { p: [-61, 1.7, -38], t: [-18, 16, -46], hold: 3 },
    ],
  },
  {
    title: 'The Tempietto',
    text: 'At the edge of the garden a ring of columns shelters a praying angel, and waterfalls pour into the valley below.',
    speed: 1.2,
    keys: [
      { p: [-48.5, 1.7, -99.5], t: [-63, 5, -96] },
      { p: [-54, 1.7, -103.5], t: [-63, 5.5, -96], hold: 3 },
    ],
  },
  {
    title: 'The Belvedere',
    text: 'One hundred and seventy-six steps above the transept, the bell tower looks across the roofs to the mountains and up to the dome.',
    speed: 0.8,
    keys: [
      { p: [-9.9, 41.66, -79.9], t: [-60, 36, -43.7], hold: 2 },
      { p: [-11.8, 41.66, -80.6], t: [0, 70, -67.5], hold: 2.5 },
    ],
  },
  {
    title: 'Vespers',
    text: 'When night falls the basilica glows from within, a lantern of glass above the sleeping valley.',
    night: 1,
    speed: 2.4,
    keys: [
      { p: [30, 4, 72], t: [0, 26, 0] },
      { p: [9, -1.3, 54], t: [0, 24, 0], hold: 4 },
    ],
  },
];

const _v = new THREE.Vector3();

const easeIn = (t) => 2 * t * t - t * t * t; // starts at rest, leaves at unit speed
const easeOut = (t) => 1 - easeIn(1 - t);
const easeBoth = (t) => t * t * (3 - 2 * t);

class Chapter {
  constructor(def, index) {
    this.def = def;
    this.index = index;
    this.keys = def.keys.map((k) => ({ p: new THREE.Vector3(...k.p), t: new THREE.Vector3(...k.t), hold: k.hold || 0 }));
    const pts = this.keys.map((k) => k.p);
    const tgs = this.keys.map((k) => k.t);
    if (pts.length === 1) {
      pts.push(pts[0].clone());
      tgs.push(tgs[0].clone());
      this.keys.push({ ...this.keys[0], hold: 0 });
    }
    this.pCurve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.tCurve = new THREE.CatmullRomCurve3(tgs, false, 'centripetal');
    const n = pts.length - 1;
    const div = 60 * n;
    this.pCurve.arcLengthDivisions = div;
    const lengths = this.pCurve.getLengths(div);
    this.total = lengths[div];
    this.segs = [];
    let time = this.keys[0].hold;
    for (let i = 0; i < n; i++) {
      const l0 = lengths[i * 60], l1 = lengths[(i + 1) * 60];
      const len = l1 - l0;
      const a = this.keys[i].t.clone().sub(this.keys[i].p).normalize();
      const b = this.keys[i + 1].t.clone().sub(this.keys[i + 1].p).normalize();
      const turn = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
      const dur = Math.max(len / (def.speed || 2), turn / 0.42, 0.6);
      const easeA = i === 0 || this.keys[i].hold > 0;
      const easeB = i === n - 1 || this.keys[i + 1].hold > 0;
      const ease = easeA && easeB ? easeBoth : easeA ? easeIn : easeB ? easeOut : (t) => t;
      this.segs.push({ i, t0: time, dur, l0, len, ease });
      time += dur + this.keys[i + 1].hold;
    }
    this.duration = time;
  }

  /** Evaluate eye and target at chapter-local time. */
  sample(time, eye, target) {
    const n = this.segs.length;
    let seg = this.segs[0];
    let f = 0;
    if (time <= seg.t0) f = 0;
    else {
      for (let k = 0; k < n; k++) {
        const s = this.segs[k];
        if (time < s.t0) break;
        seg = s;
        f = Math.min(1, (time - s.t0) / s.dur);
      }
    }
    const e = seg.ease(f);
    const u = this.total > 1e-4 ? (seg.l0 + e * seg.len) / this.total : 0;
    eye.copy(this.pCurve.getPointAt(THREE.MathUtils.clamp(u, 0, 1)));
    target.copy(this.tCurve.getPoint((seg.i + e) / n));
  }

  get first() {
    return this.keys[0];
  }

  get last() {
    return this.keys[this.keys.length - 1];
  }
}

export class Tour {
  constructor(defs = TOUR, { fadeTime = 0.9 } = {}) {
    this.chapters = defs.map((d, i) => new Chapter(d, i));
    this.fadeTime = fadeTime;
    this.active = false;
    this.index = 0;
    this.time = 0;
    this.eye = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.fade = 0;
    this.caption = 0;
    this.onChapter = null;
    this.onEnd = null;
    this.onNight = null;
    // chapters that continue from the previous one's last key need no fade
    this.chapters.forEach((c, i) => {
      const prev = this.chapters[i - 1];
      c.joined = !!prev && prev.last.p.distanceTo(c.first.p) < 0.05;
    });
  }

  get chapter() {
    return this.chapters[this.index];
  }

  /** Total running time of the tour (seconds), including fades. */
  get duration() {
    let t = 0;
    for (const c of this.chapters) t += c.duration + (c.joined ? 0 : this.fadeTime * 2);
    return t;
  }

  start(index = 0, fadeOut = false) {
    this.active = true;
    this.forceFade = true;
    this.go(index, fadeOut);
  }

  stop() {
    this.active = false;
    this.fade = 0;
    this.caption = 0;
  }

  go(index, fadeOut = true) {
    index = THREE.MathUtils.clamp(index, 0, this.chapters.length - 1);
    this.pending = index;
    this.fadingOut = fadeOut;
    if (!fadeOut) this._enter(index);
  }

  _enter(index) {
    this.index = index;
    const c = this.chapter;
    this.time = c.joined && !this.forceFade ? 0 : -this.fadeTime;
    this.forceFade = false;
    this.pending = null;
    this.fadingOut = false;
    if (c.def.night !== undefined) this.onNight?.(c.def.night);
    this.onChapter?.(c, index);
  }

  next() {
    if (this.index >= this.chapters.length - 1) return this.finish();
    this.forceFade = true;
    this.go(this.index + 1);
  }

  prev() {
    this.forceFade = true;
    this.go(this.index - 1);
  }

  finish() {
    this.stop();
    this.onEnd?.();
  }

  update(dt) {
    if (!this.active) return;
    const c = this.chapter;
    if (this.fadingOut) {
      this.fade = Math.min(1, this.fade + dt / this.fadeTime);
      this.caption = Math.max(0, this.caption - dt * 2);
      if (this.fade >= 1) this._enter(this.pending);
      return;
    }
    this.time += dt;
    const t = this.time;
    c.sample(Math.max(0, t), this.eye, this.target);
    // fade in from a cut; fade out before a cut
    const next = this.chapters[this.index + 1];
    const cutAfter = !next || !next.joined;
    let f = t < 0 ? -t / this.fadeTime : 0;
    if (cutAfter && next) f = Math.max(f, (t - c.duration) / this.fadeTime);
    this.fade = THREE.MathUtils.clamp(f, 0, 1);
    // captions ease in after arrival and out before leaving
    const capIn = THREE.MathUtils.clamp((t - 0.3) / 1.2, 0, 1);
    const capOut = THREE.MathUtils.clamp((c.duration - t) / 0.9, 0, 1);
    this.caption = next ? Math.min(capIn, capOut) : capIn;
    const end = c.duration + (cutAfter && next ? this.fadeTime : 0);
    if (t >= end) {
      if (!next) {
        if (t >= c.duration + 1.5) this.finish();
      } else this._enter(this.index + 1);
    }
  }

  /** Aim a camera from the current sample. */
  apply(camera) {
    camera.position.copy(this.eye);
    _v.copy(this.target);
    camera.up.set(0, 1, 0);
    camera.lookAt(_v);
  }
}
