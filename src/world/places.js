import { L } from './layout.js';
import { CHAPEL, TURRET, CRYPT } from './cathedral/chapels.js';
import { LOGGIA } from './cathedral/loggia.js';
import { GARDEN } from './landscape/Garden.js';

const d2 = (p, x, z) => Math.hypot(p.x - x, p.z - z);
const inChapel = (p) => d2(p, CHAPEL.cx, CHAPEL.cz) < CHAPEL.ri + 0.4 || (Math.abs(p.x - CHAPEL.cx) < 2.6 && p.z < L.crossZ1 && p.z > CHAPEL.cz + CHAPEL.ri - 0.2);
const inLoggia = (p) => p.x < LOGGIA.x0 + 0.1 && p.x > LOGGIA.x1 - 0.6 && p.z < LOGGIA.z0 + 0.2 && p.z > LOGGIA.z1 - 0.2;
const inTurret = (p) => d2(p, TURRET.x, TURRET.z) < TURRET.rIn + 0.2;
const inCrypt = (p) => p.y < -1.0 && p.z < CRYPT.stairZ0 + 0.2 && p.z > CRYPT.z1 - 1 && Math.abs(p.x) < CRYPT.x1 + 0.5;
const TEMPIETTO = { x: -63, z: -96 };

/** Named places, first match wins. `p` is the eye position. */
export const PLACES = [
  { id: 'belvedere', name: 'The Belvedere', sub: 'Above the roofs, beside the bell', test: (p) => p.y > TURRET.top && d2(p, TURRET.x, TURRET.z) < TURRET.rOut + 0.6 },
  { id: 'turret', name: 'The Stair of Bells', sub: 'One hundred and seventy-six steps to the sky', test: inTurret },
  { id: 'crypt', name: 'The Crypt', sub: 'Candlelight beneath the choir', test: inCrypt },
  { id: 'chapel', name: 'The Lady Chapel', sub: 'Our Lady of the Stars', test: inChapel },
  { id: 'sanctuary', name: 'The Sanctuary', sub: 'The high altar beneath seven lancets', test: (p) => p.z < -90 && Math.abs(p.x) < L.naveHalf && p.y < 30 },
  { id: 'choir', name: 'The Choir', sub: 'Where the hours are sung', test: (p) => p.z < L.crossZ1 && p.z >= -90 && Math.abs(p.x) < L.naveHalf && p.y < 30 },
  { id: 'crossing', name: 'The Crossing', sub: 'Beneath the dome of heaven', test: (p) => p.z <= L.crossZ0 && p.z >= L.crossZ1 && Math.abs(p.x) < L.naveHalf && p.y < 60 },
  { id: 'north-transept', name: 'The North Transept', sub: 'The Rose of Creation', test: (p) => p.z <= L.crossZ0 && p.z >= L.crossZ1 && p.x < 0 && p.x > -L.transEnd && p.y < 36 },
  { id: 'south-transept', name: 'The South Transept', sub: 'The Rose of the Heavens', test: (p) => p.z <= L.crossZ0 && p.z >= L.crossZ1 && p.x > 0 && p.x < L.transEnd && p.y < 36 },
  { id: 'nave', name: 'The Nave', sub: 'Eight bays beneath a vault of stars', test: (p) => p.z <= L.westT && p.z > L.crossZ0 && Math.abs(p.x) < L.naveHalf && p.y < 36 },
  { id: 'north-aisle', name: 'The North Aisle', sub: 'Candles before the saints', test: (p) => p.z <= 0 && p.z > L.crossZ0 && p.x < 0 && p.x > -L.aisleWallC && p.y < 16 },
  { id: 'south-aisle', name: 'The South Aisle', sub: 'Candles before the saints', test: (p) => p.z <= 0 && p.z > L.crossZ0 && p.x > 0 && p.x < L.aisleWallC && p.y < 16 },
  { id: 'loggia', name: 'The Gallery of Saints', sub: 'An arcade open to the garden', test: inLoggia },
  { id: 'tempietto', name: 'The Tempietto', sub: 'A shrine above the valley', test: (p) => d2(p, TEMPIETTO.x, TEMPIETTO.z) < 9 },
  { id: 'garden', name: 'The Garden of Paradise', sub: 'Roses, cypress and falling water', test: (p) => p.x < LOGGIA.x1 && p.x > GARDEN.x1 - 2 && p.z < GARDEN.z0 + 2 && p.z > GARDEN.z1 - 2 },
  { id: 'terrace', name: 'The West Terrace', sub: 'Before the Portal of Kings', test: (p) => p.z > L.westT && p.z <= L.terraceZ1 + 1 && Math.abs(p.x) < 31 },
  { id: 'promenade', name: 'The Promenade', sub: 'An avenue of angels and lanterns', test: (p) => p.z > L.terraceZ1 + 1 && Math.abs(p.x) < 14 },
];

export function placeAt(p) {
  for (const pl of PLACES) if (pl.test(p)) return pl;
  return null;
}

/** 1 deep inside the basilica, 0 outside, graded through the portals. */
export function insideFactor(p) {
  if (p.y > TURRET.top - 1 && d2(p, TURRET.x, TURRET.z) < TURRET.rOut + 1) return 0;
  if (p.y > L.eave + 1.5 || p.y < -8) return p.y < -8 ? 1 : 0;
  if (inTurret(p) || inCrypt(p) || inChapel(p)) return 1;
  if (inLoggia(p)) return 0.3;
  const x = Math.abs(p.x), z = p.z;
  if (z <= 0 && z >= L.crossZ0 && x < L.aisleFace) return 1;
  if (z < L.crossZ0 && z >= L.crossZ1 && x < L.transEnd - 0.6) return 1;
  if (z < L.crossZ1 && z > L.choirZ1 - L.naveHalf - 1 && x < L.naveHalf) return 1;
  if (z > 0 && z < L.westT + 0.5) {
    const inPortal = x < 2.8 || (x > 9.9 && x < 12.7);
    if (inPortal) return 1 - z / (L.westT + 0.5);
  }
  return 0;
}

/** How enclosed and candlelit the space is: 1 in the crypt, partly in the bell stair. */
export function darkFactor(p) {
  if (inCrypt(p)) return Math.min(1, Math.max(0, (-0.4 - p.y) / 1.6));
  if (inTurret(p) && p.y < TURRET.top) return 0.5;
  return 0;
}

/** Surface under the feet, for footsteps. */
export function surfaceAt(p) {
  if (p.x < LOGGIA.x1 - 0.5 && p.x > GARDEN.x1 && p.z < GARDEN.z0 && p.z > GARDEN.z1) {
    const onPath = Math.abs(p.z - GARDEN.axisZ) < 2.7 || Math.abs(p.x - GARDEN.crossX) < 2.7 || d2(p, GARDEN.fountain.x, GARDEN.fountain.z) < 11.6;
    return onPath ? 'stone' : 'grass';
  }
  return 'stone';
}
