/**
 * Снегопад: облако точек «едет» вместе с камерой, снежинки заворачиваются
 * по краям. Под крышей гаража снега нет.
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;

  const COUNT = 3200;
  const BOX = { x: 34, y: 14, z: 34 };
  const DENSITY = { low: 1100, medium: 2200, high: 3200 };

  function wrap(value, center, size) {
    const half = size / 2;
    while (value < center - half) value += size;
    while (value > center + half) value -= size;
    return value;
  }

  class SnowService {
    constructor(renderer, textures, settings, events, loop) {
      this.renderer = renderer;
      this.textures = textures;
      this.settings = settings;
      this.events = events;
      this.loop = loop;
    }

    onModuleInit() {
      if (!this.renderer.scene) return;
      this.sim = new Float32Array(COUNT * 3);
      this.display = new Float32Array(COUNT * 3);
      this.speed = new Float32Array(COUNT);
      this.phase = new Float32Array(COUNT);
      for (let i = 0; i < COUNT; i++) {
        this.sim[i * 3] = (Math.random() - 0.5) * BOX.x;
        this.sim[i * 3 + 1] = Math.random() * BOX.y;
        this.sim[i * 3 + 2] = (Math.random() - 0.5) * BOX.z;
        this.speed[i] = 0.5 + Math.random() * 0.8;
        this.phase[i] = Math.random() * Math.PI * 2;
      }
      this.geometry = new THREE.BufferGeometry();
      this.geometry.setAttribute('position', new THREE.BufferAttribute(this.display, 3));
      const material = new THREE.PointsMaterial({
        size: 0.07, map: this.textures.glow(), color: 0x9aa6b5, transparent: true,
        opacity: 0.85, depthWrite: false, sizeAttenuation: true,
      });
      this.points = new THREE.Points(this.geometry, material);
      this.points.frustumCulled = false;
      this.renderer.scene.add(this.points);
      this.applyQuality();
      this.events.on('settings.changed', (e) => { if (e.key === 'quality') this.applyQuality(); });
      this.loop.add('snow', (dt, t) => this.update(dt, t), { states: ['*'], priority: 40 });
    }

    applyQuality() {
      this.count = DENSITY[this.settings.get('quality')] || DENSITY.medium;
      this.geometry.setDrawRange(0, this.count);
    }

    update(dt, t) {
      const cam = this.renderer.camera.position;
      const wind = 0.35 + Math.sin(t * 0.13) * 0.25;
      const s = this.sim, d = this.display;
      for (let i = 0; i < this.count; i++) {
        const k = i * 3;
        let x = s[k] + (Math.sin(t * 0.7 + this.phase[i]) * 0.25 + wind) * dt;
        let y = s[k + 1] - this.speed[i] * dt;
        let z = s[k + 2] + Math.cos(t * 0.5 + this.phase[i]) * 0.15 * dt;
        if (y < 0) y += BOX.y;
        x = wrap(x, cam.x, BOX.x);
        z = wrap(z, cam.z, BOX.z);
        s[k] = x;
        s[k + 1] = y;
        s[k + 2] = z;
        d[k] = x;
        d[k + 1] = y < 3.1 && GK.isInsideGarage(x, z) ? -100 : y;
        d[k + 2] = z;
      }
      this.geometry.attributes.position.needsUpdate = true;
    }
  }

  GK.SnowService = decorate([
    Injectable(),
    Dependencies(GK.RendererService, GK.TexturesService, GK.SettingsService, GK.EventBus, GK.LoopService),
  ], SnowService);
})(window.GK);
