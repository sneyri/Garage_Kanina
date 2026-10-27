/**
 * Налобный фонарь с красноватым светом (как на фото). F — включить/выключить.
 * Узкий луч с тенями + слабая «подсветка» вокруг, чтобы видеть свои руки.
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;

  const COLOR = 0xff5a3c;
  const INTENSITY = 1.6;

  class FlashlightService {
    constructor(renderer, input, sfx, gameState, events, loop) {
      this.renderer = renderer;
      this.input = input;
      this.sfx = sfx;
      this.gameState = gameState;
      this.events = events;
      this.loop = loop;
      this.on = true;
      this.level = 0;
      this.flickerTime = 0;
    }

    onModuleInit() {
      if (!this.renderer.camera) return;
      const camera = this.renderer.camera;
      this.spot = new THREE.SpotLight(COLOR, 0, 14, 0.44, 0.55, 2);
      this.spot.position.set(0, 0.1, 0.05);
      this.spot.target.position.set(0, -0.15, -4);
      this.spot.shadow.mapSize.set(1024, 1024);
      this.spot.shadow.camera.near = 0.1;
      this.spot.shadow.camera.far = 14;
      this.spot.shadow.bias = -0.0006;
      this.spot.shadow.normalBias = 0.02;
      camera.add(this.spot);
      camera.add(this.spot.target);

      this.fill = new THREE.PointLight(0xff4a30, 0, 3.2, 2);
      this.fill.position.set(0.1, -0.05, -0.2);
      camera.add(this.fill);

      this.spot.castShadow = this.renderer.shadowsEnabled;
      this.events.on('engine.shadows', (e) => { this.spot.castShadow = e.enabled; });
      this.loop.add('flashlight', (dt) => this.update(dt), { states: ['*'], priority: 12 });
    }

    toggle() {
      this.on = !this.on;
      this.sfx.click();
      this.events.emit('flashlight.toggled', { on: this.on });
    }

    /** Помигать (используется пугалками). */
    flicker(seconds) {
      this.flickerTime = Math.max(this.flickerTime, seconds);
    }

    get isLit() {
      return this.level > 0.3;
    }

    update(dt) {
      if (this.gameState.is('playing') && this.input.wasPressed('flashlight')) this.toggle();
      let level = this.on && this.gameState.is('playing', 'cutscene', 'paused') ? 1 : 0;
      if (this.flickerTime > 0) {
        this.flickerTime -= dt;
        if (Math.random() < 0.45) level *= 0.06;
      }
      this.level = level;
      this.spot.intensity = INTENSITY * level;
      this.fill.intensity = 0.3 * level;
    }
  }

  GK.FlashlightService = decorate([
    Injectable(),
    Dependencies(GK.RendererService, GK.InputService, GK.SfxService, GK.GameStateService, GK.EventBus, GK.LoopService),
  ], FlashlightService);
})(window.GK);
