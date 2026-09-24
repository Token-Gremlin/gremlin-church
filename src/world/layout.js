// Master plan of the basilica (metres). Interior floor at y = 0, the altar lies toward −z.
export const L = {
  bay: 7.5,
  naveHalf: 7.5, // nave wall centreline |x|
  wallT: 1.2, // upper nave wall thickness
  naveFace: 6.9, // interior face of nave walls
  aisleWallC: 15.2, // aisle outer wall centreline |x|
  aisleFace: 14.5, // aisle wall inner face
  aisleWallT: 1.4,
  naveZ0: 0,
  naveBays: 8,
  naveZ1: -60,
  crossZ0: -60,
  crossZ1: -75,
  choirBays: 3,
  choirZ1: -97.5,
  apseSides: 7,
  transBays: 3,
  transEnd: 30, // transept end wall centreline |x|
  westT: 3.2, // west wall thickness (façade face at z = +3.2)

  pierCap: 8.4,
  arcadeSpring: 9.0,
  triY0: 14.2,
  triY1: 18.6,
  vaultY0: 24,
  vaultY1: 34,
  eave: 35.6,
  roofRidge: 47,
  aisleVaultY0: 9.0,
  aisleVaultY1: 13.6,
  aisleEave: 16.2,

  drumY0: 34.6,
  drumY1: 44.5,
  domeY1: 57,
  domeR: 7.5,

  choirY: 0.6,
  sanctuaryY: 1.5,
  promenadeY: -3,
  terraceZ1: 26, // end of the front terrace (start of the grand stairs)
  stairsZ1: 33, // foot of the stairs
  loggiaX0: 15.9, // |x| outer face of north aisle wall (loggia inner side)
  loggiaX1: 22.5, // loggia outer arcade line
};

export const PIER_Z = (() => {
  const z = [];
  for (let i = 0; i <= L.naveBays; i++) z.push(-i * L.bay);
  return z;
})();
