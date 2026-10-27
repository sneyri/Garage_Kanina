/**
 * Пауза. Браузер сам отпускает курсор по Esc — ловим это и ставим игру на паузу.
 * Обратно захватить курсор можно только по клику, поэтому «Продолжить» — кнопка.
 */
(function (GK) {
  'use strict';

  const { Controller, Action, Dependencies, decorate } = GK.common;

  class PauseController {
    constructor(gameState, input, renderer, sfx, events) {
      this.gameState = gameState;
      this.input = input;
      this.renderer = renderer;
      this.sfx = sfx;
      this.events = events;
    }

    onModuleInit() {
      this.events.on('input.pointerlock', (e) => {
        if (!e.locked && this.gameState.is('playing')) this.pause();
      });
      this.events.on('input.pointerlock-error', () => {
        if (this.gameState.is('playing') && !this.input.dragLook) this.pause();
      });
      this.events.on('input.key', (e) => {
        if (e.code === 'Escape' && this.input.dragLook && this.gameState.is('playing')) this.pause();
      });
      // Если захват курсора не удался (браузер отказал) — не оставляем игрока с «мёртвой» мышью
      this.events.on('state.changed', (e) => {
        if (e.to !== 'playing' || this.input.dragLook) return;
        clearTimeout(this.lockCheck);
        this.lockCheck = setTimeout(() => {
          if (this.gameState.is('playing') && !this.input.locked) this.pause();
        }, 800);
      });
    }

    pause() {
      this.gameState.set('paused', 'pointer-unlocked');
    }

    resume() {
      this.sfx.uiClick();
      this.input.requestLock(this.renderer.canvas);
      this.gameState.set('playing', 'resume');
    }

    settings() {
      this.sfx.uiClick();
      this.events.emit('ui.settings.open');
    }

    toMenu() {
      this.sfx.uiClick();
      this.events.emit('game.quit');
      this.gameState.set('menu', 'quit');
    }
  }

  decorate([Action('resume')], PauseController.prototype, 'resume');
  decorate([Action('settings')], PauseController.prototype, 'settings');
  decorate([Action('to-menu')], PauseController.prototype, 'toMenu');

  GK.PauseController = decorate([
    Controller('pause'),
    Dependencies(GK.GameStateService, GK.InputService, GK.RendererService, GK.SfxService, GK.EventBus),
  ], PauseController);
})(window.GK);
