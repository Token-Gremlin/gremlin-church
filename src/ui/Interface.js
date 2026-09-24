import { placeAt } from '../world/places.js';

const $ = (id) => document.getElementById(id);

/** DOM side of the experience: loader, HUD, toolbar, captions, place titles, prompts. */
export class Interface {
  constructor(app) {
    this.app = app;
    this.loader = $('loader');
    this.hud = $('hud');
    this.caption = $('caption');
    this.captionTitle = this.caption.querySelector('.caption-title');
    this.captionText = this.caption.querySelector('.caption-text');
    this.placeEl = $('place-title');
    this.placeName = this.placeEl.querySelector('.place-name');
    this.placeSub = this.placeEl.querySelector('.place-sub');
    this.hint = $('interact-hint');
    this.help = $('help');
    this.tourBar = $('tour-bar');
    this.tourProgress = $('tour-progress');
    this.fps = $('fps');
    this.showFps = new URLSearchParams(location.search).has('fps');
    this.place = null;
    this.placeCandidate = null;
    this.placeSince = 0;
    this.placeHideAt = 0;
    this.lastShown = new Map();
    this.hintText = '';
    if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
    this.bind();
  }

  bind() {
    const app = this.app;
    $('btn-walk').onclick = () => app.enter('walk');
    $('btn-tour').onclick = () => app.enter('tour');
    for (const b of document.querySelectorAll('#quality-pick button')) {
      b.onclick = () => {
        app.qualityLocked = true;
        app.applyQuality(b.dataset.q);
        this.refresh();
      };
    }
    $('tb-tour').onclick = () => app.toggleTour();
    $('tb-fly').onclick = () => app.toggleFly();
    $('tb-time').onclick = () => app.toggleNight();
    $('tb-sound').onclick = () => app.toggleSound();
    $('tb-quality').onclick = () => app.cycleQuality();
    $('tb-help').onclick = () => this.toggleHelp();
    $('tour-prev').onclick = () => app.tour.prev();
    $('tour-next').onclick = () => app.tour.next();
    $('tour-exit').onclick = () => app.endTour();
    this.hint.onclick = () => app.interact();
    // keep keyboard focus off the buttons so Space never re-triggers them
    for (const b of document.querySelectorAll('button')) b.addEventListener('mousedown', (e) => e.preventDefault());
    addEventListener('keydown', (e) => this.onKey(e));
    app.renderer.domElement.addEventListener('click', () => app.onCanvasClick());
  }

  onKey(e) {
    const app = this.app;
    if (e.repeat || app.mode === 'attract' || app.mode === 'loading') return;
    const touring = app.mode === 'tour';
    switch (e.code) {
      case 'KeyT': app.toggleTour(); break;
      case 'KeyF': app.toggleFly(); break;
      case 'KeyN': app.toggleNight(); break;
      case 'KeyM': app.toggleSound(); break;
      case 'KeyQ': app.cycleQuality(); break;
      case 'KeyH': this.toggleHelp(); break;
      case 'KeyP': document.body.classList.toggle('photo'); break;
      case 'KeyE': app.interact(); break;
      case 'Backquote':
        this.showFps = !this.showFps;
        this.fps.textContent = '';
        break;
      case 'ArrowRight':
      case 'PageDown':
        if (touring) app.tour.next();
        break;
      case 'ArrowLeft':
      case 'PageUp':
        if (touring) app.tour.prev();
        break;
      case 'Escape':
        if (touring) app.endTour();
        break;
      default:
    }
  }

  showEntry() {
    this.loader.classList.add('ready');
    $('enter-buttons').hidden = false;
    $('quality-pick').hidden = false;
    $('enter-hint').hidden = false;
    $('progress-status').textContent = 'The doors are open.';
    this.refresh();
  }

  hideLoader() {
    this.loader.classList.add('gone');
    this.hud.hidden = false;
    setTimeout(() => this.loader.remove(), 1800);
  }

  toggleHelp(force) {
    this.help.hidden = force === undefined ? !this.help.hidden : !force;
    $('tb-help').classList.toggle('on', !this.help.hidden);
  }

  refresh() {
    const app = this.app;
    for (const b of document.querySelectorAll('#quality-pick button')) b.classList.toggle('active', b.dataset.q === app.qualityName);
    const q = $('tb-quality');
    q.textContent = app.qualityName[0].toUpperCase() + app.qualityName.slice(1);
    $('tb-fly').classList.toggle('on', app.player.fly);
    $('tb-time').textContent = app.nightTarget > 0.5 ? 'Night' : 'Dusk';
    $('tb-sound').classList.toggle('on', !app.muted);
    $('tb-sound').textContent = app.muted ? 'Muted' : 'Sound';
    $('tb-tour').classList.toggle('on', app.mode === 'tour');
    this.tourBar.hidden = app.mode !== 'tour';
    document.body.classList.toggle('walking', app.mode === 'walk');
  }

  // ---------------------------------------------------------- tour captions
  setCaption(title, text) {
    this.captionTitle.textContent = title;
    this.captionText.textContent = text;
  }

  setCaptionOpacity(o) {
    this.caption.style.transition = 'none';
    this.caption.style.opacity = o.toFixed(3);
    this.caption.style.transform = `translateX(-50%) translateY(${((1 - o) * 10).toFixed(1)}px)`;
  }

  clearCaption() {
    this.caption.style.opacity = '0';
  }

  setTourProgress(i, n) {
    this.tourProgress.textContent = `${i + 1} / ${n}`;
  }

  // ---------------------------------------------------------- place titles
  updatePlace(pos, now) {
    const pl = placeAt(pos);
    if (pl !== this.placeCandidate) {
      this.placeCandidate = pl;
      this.placeSince = now;
    }
    if (pl && pl !== this.place && now - this.placeSince > 0.7) {
      this.place = pl;
      const last = this.lastShown.get(pl.id);
      if (last === undefined || now - last > 25) {
        this.lastShown.set(pl.id, now);
        this.showPlace(pl.name, pl.sub, now);
      }
    }
    if (this.placeHideAt && now > this.placeHideAt) {
      this.placeEl.classList.remove('show');
      this.placeHideAt = 0;
    }
  }

  /** Show a message in the title slot, treating the current place as already announced. */
  announce(name, sub, pos, now, dur) {
    const pl = placeAt(pos);
    this.place = this.placeCandidate = pl;
    if (pl) this.lastShown.set(pl.id, now);
    this.showPlace(name, sub, now, dur);
  }

  showPlace(name, sub, now, dur = 4.5) {
    this.placeName.textContent = name;
    this.placeSub.textContent = sub;
    this.placeEl.classList.add('show');
    this.placeHideAt = now + dur;
  }

  // ---------------------------------------------------------- prompts
  setHint(text) {
    if (text === this.hintText) return;
    this.hintText = text;
    document.body.classList.toggle('can-interact', !!text);
    if (text) this.hint.innerHTML = `<b>E</b>${text}`;
  }

  setFps(text) {
    if (this.showFps) this.fps.textContent = text;
  }
}
