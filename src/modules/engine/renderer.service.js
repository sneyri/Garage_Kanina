/**
 * Рендерер three.js: сцена, камера, туман, качество графики.
 * Качество «низкое» специально рендерит в половинном разрешении — получается
 * грязная «пиксельная» картинка в духе старых хорроров.
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, Logger, decorate } = GK.common;

  const PIXEL_RATIO = { low: 0.5, medium: 0.8, high: 1 };
  const FOG_COLOR = 0x0b0f16;

  class RendererService {
    constructor(settings, events) {
      this.settings = settings;
      this.events = events;
      this.renderer = null;
      this.scene = null;
      this.camera = null;
      this.failed = false;
      this.logger = new Logger('RendererService');
    }

    onModuleInit() {
      if (typeof document === 'undefined' || typeof THREE === 'undefined') {
        this.failed = true;
        return;
      }
      this.canvas = document.getElementById('game');
      try {
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' });
      } catch (err) {
        this.failed = true;
        this.logger.error('WebGL не запустился: ' + err.message);
        this.events.emit('engine.error', { message: 'Браузер не смог запустить WebGL. Включите аппаратное ускорение или откройте игру в другом браузере.' });
        return;
      }
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(FOG_COLOR);
      this.scene.fog = new THREE.FogExp2(FOG_COLOR, 0.05);

      this.camera = new THREE.PerspectiveCamera(this.settings.get('fov'), 1, 0.05, 320);
      this.camera.rotation.order = 'YXZ';
      this.scene.add(this.camera);

      this.applySettings();
      window.addEventListener('resize', () => this.resize());
      this.events.on('settings.changed', (e) => {
        if (e.key === 'quality' || e.key === 'fov' || e.key === 'brightness') this.applySettings();
      });
    }

    get maxAnisotropy() {
      return this.renderer ? Math.min(8, this.renderer.capabilities.getMaxAnisotropy()) : 1;
    }

    get shadowsEnabled() {
      return this.settings.get('quality') !== 'low';
    }

    applySettings() {
      if (!this.renderer) return;
      const quality = this.settings.get('quality');
      this.renderer.setPixelRatio(PIXEL_RATIO[quality] * Math.min(window.devicePixelRatio || 1, 2));
      this.canvas.style.imageRendering = quality === 'low' ? 'pixelated' : 'auto';

      const shadows = this.shadowsEnabled;
      if (this.renderer.shadowMap.enabled !== shadows) {
        this.renderer.shadowMap.enabled = shadows;
        // Шейдеры с тенями и без — разные программы, их надо пересобрать
        this.scene.traverse((o) => {
          if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; });
        });
        this.events.emit('engine.shadows', { enabled: shadows });
      }

      this.renderer.toneMappingExposure = this.settings.get('brightness');
      this.camera.fov = this.settings.get('fov');
      this.resize();
    }

    resize() {
      if (!this.renderer) return;
      const w = window.innerWidth, h = window.innerHeight;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    render() {
      if (this.renderer) this.renderer.render(this.scene, this.camera);
    }
  }

  GK.RendererService = decorate([Injectable(), Dependencies(GK.SettingsService, GK.EventBus)], RendererService);
})(window.GK);
