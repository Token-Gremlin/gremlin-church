import { windowLayout } from '../arch/windowLayout.js';
import { windowTexture, roseTexture, THEMES, GLASS } from '../textures/glass.js';
import { CLERE, AISLE_WIN } from './cathedral/nave.js';

export const APSE_WIN = { W: 2.3, H: 17, k: 0.8, y0: 5 };
export const WEST_WIN = { W: 10, H: 16.5, k: 0.68, y0: 17.2 };
export const TRANS_LANCET = { W: 1.7, H: 7.2, k: 0.8, y0: 10.2 };
export const DRUM_WIN = { W: 1.3, H: 6.0, k: 0.8, y0: 42.5 };
export const CHAPEL_WIN = { W: 1.6, H: 6.5, k: 0.8, y0: 2.6 };

/** Registers every stained glass design (textures are generated lazily on first use). */
export function registerGlass(glass) {
  const clereFigures = [
    ['saint', 'angel'], ['madonna', 'saint'], ['angel', 'saint'], ['saint', 'madonna'], ['angel', 'angel'], ['saint', 'saint'],
  ];
  for (let i = 0; i < 6; i++) {
    glass.ensure(`clere-${i}`, () => windowTexture(windowLayout(CLERE.W, CLERE.H, CLERE.k, 2), 101 + i * 7, { figures: clereFigures[i], figureAt: 0.34, theme: THEMES[i % THEMES.length] }));
  }
  for (let i = 0; i < 4; i++) {
    glass.ensure(`aisle-${i}`, () => windowTexture(windowLayout(AISLE_WIN.W, AISLE_WIN.H, AISLE_WIN.k, 2), 211 + i * 5, { kind: i % 2 ? 'medallions' : 'figure', theme: THEMES[(i + 2) % THEMES.length] }), { intensity: 2.6 });
  }
  const apseFig = ['angel', 'saint', 'madonna', 'christ', 'madonna', 'saint', 'angel'];
  for (let i = 0; i < 7; i++) {
    const theme = i === 3 ? { bg: GLASS.blue, border: ['#ffd040', '#f4f0ff', '#d4202a'], inner: '#b3121e' } : THEMES[(i + 1) % THEMES.length];
    glass.ensure(`apse-${i}`, () => windowTexture(windowLayout(APSE_WIN.W, APSE_WIN.H, APSE_WIN.k, 1), 307 + i * 3, { figures: [apseFig[i]], figureAt: 0.42, theme, figTheme: i === 3 ? { robe: '#fff4e0', mantle: '#c41a24' } : {} }), { intensity: 3.6 });
  }
  glass.ensure('west', () => windowTexture(windowLayout(WEST_WIN.W, WEST_WIN.H, WEST_WIN.k, 4), 409, { figures: ['saint', 'angel', 'angel', 'saint'], figureAt: 0.3, theme: THEMES[0] }), { intensity: 3.4, extIntensity: 1.3 });
  glass.ensure('rose-n', () => roseTexture(5.5, 501, { petals: 12, center: 'christ' }), { intensity: 3.8, extIntensity: 1.2 });
  glass.ensure('rose-s', () => roseTexture(5.5, 517, { petals: 12, center: 'madonna' }), { intensity: 3.4, extIntensity: 1.2 });
  glass.ensure('rose-w', () => roseTexture(3.6, 533, { petals: 12, center: 'star' }), { intensity: 3.4, extIntensity: 1.4 });
  for (let i = 0; i < 2; i++) {
    glass.ensure(`lancet-${i}`, () => windowTexture(windowLayout(TRANS_LANCET.W, TRANS_LANCET.H, TRANS_LANCET.k, 1), 601 + i * 11, { theme: THEMES[(i + 3) % THEMES.length] }), { intensity: 3.0 });
  }
  glass.ensure('drum', () => windowTexture(windowLayout(DRUM_WIN.W, DRUM_WIN.H, DRUM_WIN.k, 1), 701, { kind: 'medallions', theme: { bg: GLASS.gold, border: ['#1540c4', '#fff6dc', '#d4202a'], inner: '#1238b0' }, cell: 0.1 }), { intensity: 4.5, extIntensity: 1.5 });
  glass.ensure('chapel', () => windowTexture(windowLayout(CHAPEL_WIN.W, CHAPEL_WIN.H, CHAPEL_WIN.k, 1), 801, { figures: ['madonna'], theme: { bg: GLASS.blue, border: ['#f4f0ff', '#ffd040', '#1a48d0'], inner: '#0a2a9c' } }), { intensity: 3.0 });
  glass.ensure('chapel-b', () => windowTexture(windowLayout(CHAPEL_WIN.W, CHAPEL_WIN.H, CHAPEL_WIN.k, 1), 813, { figures: ['angel'], theme: { bg: GLASS.deepBlue, border: ['#ffd040', '#f4f0ff', '#30c0d0'], inner: '#6a22a0' } }), { intensity: 3.0 });
}
