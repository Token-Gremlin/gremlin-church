import * as THREE from 'three';

export const LAYER_FLOOR = 2;
export const LAYER_NO_REFLECT = 3;

/**
 * Renders the scene mirrored about a horizontal plane (y = height) into a mipmapped
 * HDR render target. Floors sample it with textureLod to blur by roughness.
 */
export class PlanarReflection {
  constructor(height = 0) {
    this.height = height;
    this.enabled = true;
    this.scale = 0.5;
    this.camera = new THREE.PerspectiveCamera();
    this.camera.layers.set(0);
    this.textureMatrix = new THREE.Matrix4();
    this.target = new THREE.WebGLRenderTarget(16, 16, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      samples: 0,
    });
    this.texture = this.target.texture;
    this._plane = new THREE.Plane();
    this._clip = new THREE.Vector4();
    this._q = new THREE.Vector4();
    this._normal = new THREE.Vector3(0, 1, 0);
    this._camPos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._rot = new THREE.Matrix4();
    this._mirrorPos = new THREE.Vector3();
  }

  setSize(w, h) {
    const tw = Math.max(16, Math.round(w * this.scale));
    const th = Math.max(16, Math.round(h * this.scale));
    if (this.target.width !== tw || this.target.height !== th) this.target.setSize(tw, th);
  }

  update(renderer, scene, camera) {
    if (!this.enabled) return;
    const normal = this._normal;
    const mirror = this._mirrorPos.set(0, this.height, 0);
    const camPos = this._camPos.setFromMatrixPosition(camera.matrixWorld);
    if (camPos.y < this.height) return;
    const reflPos = this._reflPos || (this._reflPos = new THREE.Vector3());
    reflPos.set(camPos.x, 2 * this.height - camPos.y, camPos.z);

    this._rot.extractRotation(camera.matrixWorld);
    const look = this._look.set(0, 0, -1).applyMatrix4(this._rot).add(camPos);
    const target = this._target.copy(look);
    target.y = 2 * this.height - target.y;

    const rc = this.camera;
    rc.position.copy(reflPos);
    rc.up.set(0, 1, 0).applyMatrix4(this._rot);
    rc.up.y = -rc.up.y;
    rc.lookAt(target);
    rc.far = camera.far;
    rc.near = camera.near;
    rc.updateMatrixWorld();
    rc.projectionMatrix.copy(camera.projectionMatrix);

    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.textureMatrix.multiply(rc.projectionMatrix);
    this.textureMatrix.multiply(rc.matrixWorldInverse);

    // Oblique near plane clipping (Lengyel)
    this._plane.setFromNormalAndCoplanarPoint(normal, mirror);
    this._plane.applyMatrix4(rc.matrixWorldInverse);
    const clip = this._clip.set(this._plane.normal.x, this._plane.normal.y, this._plane.normal.z, this._plane.constant);
    const pm = rc.projectionMatrix;
    const q = this._q;
    q.x = (Math.sign(clip.x) + pm.elements[8]) / pm.elements[0];
    q.y = (Math.sign(clip.y) + pm.elements[9]) / pm.elements[5];
    q.z = -1.0;
    q.w = (1.0 + pm.elements[10]) / pm.elements[14];
    clip.multiplyScalar(2.0 / clip.dot(q));
    pm.elements[2] = clip.x;
    pm.elements[6] = clip.y;
    pm.elements[10] = clip.z + 1.0 - 0.003;
    pm.elements[14] = clip.w;
    rc.projectionMatrixInverse.copy(pm).invert();

    const prevTarget = renderer.getRenderTarget();
    const prevShadow = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.target);
    renderer.clear(true, true, true);
    renderer.render(scene, rc);
    renderer.shadowMap.autoUpdate = prevShadow;
    renderer.setRenderTarget(prevTarget);
  }
}
