import * as THREE from 'three';

/** Procedural interior "light probe" room: warm stone, blue vault, coloured windows, chandeliers. */
export function makeInteriorEnvironment(renderer, pmrem, night = 0) {
  const scene = new THREE.Scene();
  const k = 1 - night * 0.75;
  const wallCol = new THREE.Color(0.95, 0.84, 0.68).multiplyScalar(0.85 * k + night * 0.1);
  const room = new THREE.Mesh(new THREE.BoxGeometry(30, 36, 110), new THREE.MeshBasicMaterial({ color: wallCol, side: THREE.BackSide }));
  room.position.y = 18;
  scene.add(room);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(30, 110), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.1, 0.4).multiplyScalar(1.4 * k + 0.2) }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 35.8;
  scene.add(ceil);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 110), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.68, 0.58).multiplyScalar(0.8 * k + 0.1) }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.2;
  scene.add(floor);
  const palette = [
    new THREE.Color(0.2, 0.35, 1.0), new THREE.Color(1.0, 0.2, 0.15), new THREE.Color(1.0, 0.75, 0.25),
    new THREE.Color(0.5, 0.25, 1.0), new THREE.Color(0.2, 0.8, 0.4),
  ];
  for (let i = 0; i < 11; i++) {
    for (const s of [-1, 1]) {
      const c = palette[(i + (s > 0 ? 2 : 0)) % palette.length].clone().multiplyScalar(5 * k + 0.2);
      const w = new THREE.Mesh(new THREE.PlaneGeometry(4, 12), new THREE.MeshBasicMaterial({ color: c }));
      w.position.set(s * 14.8, 25, -50 + i * 10);
      w.rotation.y = -s * Math.PI / 2;
      scene.add(w);
    }
  }
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4, 2).multiplyScalar(0.6 + night * 0.6) });
  for (let i = 0; i < 10; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), glow);
    b.position.set(i % 2 ? 4 : -4, 13, -45 + i * 10);
    scene.add(b);
  }
  const end = new THREE.Mesh(new THREE.PlaneGeometry(14, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.3, 1.0).multiplyScalar(3 * k + 0.3) }));
  end.position.set(0, 18, -54.8);
  scene.add(end);
  const rt = pmrem.fromScene(scene, 0.035);
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  return rt.texture;
}

/**
 * Scene lighting with smooth interior/exterior blending.
 * The directional light doubles as the low sunset sun outside and a steeper
 * "stained glass" sun inside, so shafts and shadows read well in both.
 */
export class Lighting {
  constructor(scene, sky) {
    this.scene = scene;
    this.sky = sky;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    this.sunTarget = new THREE.Object3D();
    scene.add(this.sun, this.sunTarget);
    this.sun.target = this.sunTarget;
    this.inside = 1;
    this.night = 0;
    this.interiorSunDir = new THREE.Vector3(-0.62, 0.72, 0.3).normalize();
    this._dir = new THREE.Vector3();
    this.envInterior = null;
    this.envExterior = null;
    this.fog = new THREE.FogExp2(0xffffff, 0.0015);
    scene.fog = this.fog;
    this.params = {
      ext: {
        sunColor: new THREE.Color(1.0, 0.68, 0.42), sunI: 4.2,
        sky: new THREE.Color(0.55, 0.55, 0.82), ground: new THREE.Color(0.42, 0.3, 0.24), hemiI: 0.9,
        fog: new THREE.Color(0.95, 0.66, 0.55), fogD: 0.0011, env: 0.85,
      },
      int: {
        sunColor: new THREE.Color(1.0, 0.8, 0.58), sunI: 2.2,
        sky: new THREE.Color(1.0, 0.9, 0.78), ground: new THREE.Color(0.62, 0.5, 0.4), hemiI: 0.55,
        fog: new THREE.Color(1.0, 0.86, 0.66), fogD: 0.0042, env: 1.0,
      },
      nightExt: {
        sunColor: new THREE.Color(0.45, 0.55, 0.9), sunI: 0.55,
        sky: new THREE.Color(0.18, 0.22, 0.4), ground: new THREE.Color(0.06, 0.05, 0.05), hemiI: 0.35,
        fog: new THREE.Color(0.08, 0.1, 0.2), fogD: 0.0014, env: 0.5,
      },
      nightInt: {
        sunColor: new THREE.Color(0.45, 0.55, 0.9), sunI: 0.35,
        sky: new THREE.Color(0.9, 0.7, 0.45), ground: new THREE.Color(0.35, 0.25, 0.16), hemiI: 0.32,
        fog: new THREE.Color(0.55, 0.38, 0.22), fogD: 0.0038, env: 0.6,
      },
    };
    this._c = new THREE.Color();
  }

  setShadowSize(n) {
    if (this.sun.shadow.mapSize.x === n) return;
    this.sun.shadow.mapSize.set(n, n);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
  }

  /** inside: 0 (outside) .. 1 (inside); camera for shadow fitting. */
  update(camera, inside, night) {
    this.inside = inside;
    this.night = night;
    const P = this.params;
    const lerpSet = (key) => {
      const a = P.ext[key], b = P.int[key], na = P.nightExt[key], nb = P.nightInt[key];
      if (a.isColor) {
        const day = a.clone().lerp(b, inside);
        const nt = na.clone().lerp(nb, inside);
        return day.lerp(nt, night);
      }
      const day = a + (b - a) * inside;
      const nt = na + (nb - na) * inside;
      return day + (nt - day) * night;
    };
    this.sun.color.copy(lerpSet('sunColor'));
    this.sun.intensity = lerpSet('sunI');
    this.hemi.color.copy(lerpSet('sky'));
    this.hemi.groundColor.copy(lerpSet('ground'));
    this.hemi.intensity = lerpSet('hemiI');
    this.fog.color.copy(lerpSet('fog'));
    this.fog.density = lerpSet('fogD');
    this.scene.environmentIntensity = lerpSet('env');

    const extDir = night > 0.5 ? this.sky.moonDir : this.sky.sunDir;
    this._dir.copy(extDir).lerp(this.interiorSunDir, inside).normalize();
    // Fit shadow frustum: interior covers the whole church; exterior follows the camera.
    const cam = camera.position;
    const center = inside > 0.5 ? new THREE.Vector3(0, 10, -50) : new THREE.Vector3(cam.x, 0, cam.z - 20);
    const half = inside > 0.5 ? 62 : 90;
    const sc = this.sun.shadow.camera;
    sc.left = -half;
    sc.right = half;
    sc.top = half;
    sc.bottom = -half;
    sc.near = 1;
    sc.far = 420;
    sc.updateProjectionMatrix();
    this.sunTarget.position.copy(center);
    this.sun.position.copy(center).addScaledVector(this._dir, 200);
    this.sunTarget.updateMatrixWorld();
    this.sun.updateMatrixWorld();
  }
}
