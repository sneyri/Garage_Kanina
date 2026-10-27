/** Камера главного меню: медленно «дышит», глядя на открытые ворота гаража Канина. */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;

  class CinematicService {
    constructor(renderer, loop) {
      this.renderer = renderer;
      this.loop = loop;
    }

    onModuleInit() {
      if (!this.renderer.camera) return;
      this.target = new THREE.Vector3();
      this.loop.add('cinematic', (dt, t) => this.update(dt, t), { states: ['boot', 'menu', 'ending'], priority: 15 });
    }

    update(dt, t) {
      const c = GK.LAYOUT.menuCamera, cam = this.renderer.camera;
      cam.position.set(c.x + Math.sin(t * 0.07) * 0.5, c.y + Math.sin(t * 0.11) * 0.04, c.z + Math.sin(t * 0.05) * 0.9);
      this.target.set(c.lookX + Math.sin(t * 0.09) * 0.25, c.lookY + Math.sin(t * 0.13) * 0.08, c.lookZ);
      cam.lookAt(this.target);
    }
  }

  GK.CinematicService = decorate([Injectable(), Dependencies(GK.RendererService, GK.LoopService)], CinematicService);
})(window.GK);
