import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glassMaterial } from '../materials/Materials.js';
import { LAYER_NO_REFLECT } from '../engine/PlanarReflection.js';

function prep(g) {
  if (!g.index) {
    const n = g.attributes.position.count;
    const idx = new Uint32Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  g.clearGroups();
  return g;
}

/** Stained glass panes grouped per texture, plus window metadata for light effects. */
export class GlassRegistry {
  constructor() {
    this.entries = new Map();
    this.windows = [];
  }

  ensure(key, factory, matOpts = {}) {
    if (!this.entries.has(key)) {
      const tex = factory();
      const mat = glassMaterial(tex, matOpts);
      this.entries.set(key, { tex, mat, geos: [] });
    }
    return this.entries.get(key);
  }

  add(key, geometry, info = null) {
    const e = this.entries.get(key);
    e.geos.push(prep(geometry));
    if (info) this.windows.push({ ...info, key, texture: e.tex, avg: e.tex.userData.average || new THREE.Color(0.5, 0.5, 0.8) });
  }

  materials() {
    return [...this.entries.values()].map((e) => e.mat);
  }

  build() {
    const group = new THREE.Group();
    group.name = 'glass';
    for (const [key, e] of this.entries) {
      if (!e.geos.length) continue;
      const geo = mergeGeometries(e.geos, false);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, e.mat);
      mesh.name = `glass:${key}`;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
    return group;
  }
}

/** Instanced props: define a prototype (Parts), then add transforms. */
export class Instancer {
  constructor() {
    this.protos = new Map();
    this.items = new Map();
  }

  define(name, parts, { castShadow = true, reflect = true } = {}) {
    const geos = {};
    for (const [mat, list] of Object.entries(parts.map)) {
      geos[mat] = mergeGeometries(list.map((g) => prep(g.clone())), false);
    }
    this.protos.set(name, { geos, castShadow, reflect });
  }

  has(name) {
    return this.protos.has(name);
  }

  add(name, matrix, zone = 'all', color = null) {
    const key = `${name}|${zone}`;
    let it = this.items.get(key);
    if (!it) this.items.set(key, (it = { name, matrices: [], colors: [] }));
    it.matrices.push(matrix.clone ? matrix.clone() : matrix);
    if (color) it.colors.push(color);
  }

  addAt(name, x, y, z, ry = 0, s = 1, zone = 'all') {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s));
    this.add(name, m, zone);
  }

  build(mats) {
    const group = new THREE.Group();
    group.name = 'instances';
    for (const [key, it] of this.items) {
      const proto = this.protos.get(it.name);
      if (!proto) {
        console.warn('Instancer: unknown prototype', it.name);
        continue;
      }
      for (const [matName, geo] of Object.entries(proto.geos)) {
        const mat = mats[matName];
        if (!mat) {
          console.warn('Instancer: missing material', matName);
          continue;
        }
        const im = new THREE.InstancedMesh(geo, mat, it.matrices.length);
        it.matrices.forEach((m, i) => im.setMatrixAt(i, m));
        if (it.colors.length === it.matrices.length) it.colors.forEach((c, i) => im.setColorAt(i, c));
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        im.castShadow = proto.castShadow && mat.userData.castShadow !== false;
        im.receiveShadow = true;
        im.name = `${key}:${matName}`;
        if (!proto.reflect) im.layers.set(LAYER_NO_REFLECT);
        group.add(im);
      }
    }
    return group;
  }
}
