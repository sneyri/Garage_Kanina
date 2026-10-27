/**
 * Игровой цикл. Сервисы регистрируют «системы» — функции update(dt), которые
 * вызываются каждый кадр в порядке priority и только в нужных состояниях игры.
 *
 *   loop.add('player', (dt) => this.update(dt), { priority: 10, states: ['playing'] });
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, Logger, decorate } = GK.common;

  class LoopService {
    constructor(renderer, input, gameState) {
      this.renderer = renderer;
      this.input = input;
      this.gameState = gameState;
      this.systems = [];
      this.running = false;
      this.time = 0;
      this.fps = 0;
      this.frames = 0;
      this.fpsTime = 0;
      this.logger = new Logger('LoopService');
    }

    add(name, update, options) {
      const system = {
        name: name,
        update: update,
        priority: (options && options.priority) || 0,
        states: (options && options.states) || ['playing'],
        errors: 0,
      };
      this.systems.push(system);
      this.systems.sort((a, b) => a.priority - b.priority);
      return () => {
        this.systems = this.systems.filter((s) => s !== system);
      };
    }

    /** Хук Nest: вызывается, когда всё приложение собрано. Тут «поднимается сервер» — цикл. */
    onApplicationBootstrap() {
      if (this.renderer.failed || typeof requestAnimationFrame === 'undefined') return;
      this.start();
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      const tick = (now) => {
        if (!this.running) return;
        this.frame(now);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    stop() {
      this.running = false;
    }

    onModuleDestroy() {
      this.stop();
    }

    frame(now) {
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.time += dt;
      const state = this.gameState.state;

      for (let i = 0; i < this.systems.length; i++) {
        const system = this.systems[i];
        if (system.states.indexOf('*') === -1 && system.states.indexOf(state) === -1) continue;
        try {
          system.update(dt, this.time);
        } catch (err) {
          // Одна сломанная система не должна ронять всю игру
          if (system.errors++ < 3) this.logger.error(system.name + ': ' + (err.stack || err));
        }
      }

      this.input.endFrame();
      this.renderer.render();

      this.frames++;
      this.fpsTime += dt;
      if (this.fpsTime >= 0.5) {
        this.fps = Math.round(this.frames / this.fpsTime);
        this.frames = 0;
        this.fpsTime = 0;
      }
    }
  }

  GK.LoopService = decorate([Injectable(), Dependencies(GK.RendererService, GK.InputService, GK.GameStateService)], LoopService);
})(window.GK);
