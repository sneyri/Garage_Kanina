/**
 * Конечный автомат состояний игры.
 *   boot     — заставка «нажмите любую клавишу» (нужна, чтобы браузер разрешил звук)
 *   menu     — главное меню
 *   cutscene — карточка дня, конец смены
 *   playing  — игрок управляет персонажем
 *   paused   — пауза
 *   ending   — конец прототипа
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, Logger, decorate } = GK.common;

  const TRANSITIONS = Object.freeze({
    boot: ['menu'],
    menu: ['cutscene', 'playing'],
    cutscene: ['playing', 'menu', 'ending'],
    playing: ['paused', 'cutscene', 'menu', 'ending'],
    paused: ['playing', 'menu', 'cutscene'],
    ending: ['menu'],
  });

  class GameStateService {
    constructor(events) {
      this.events = events;
      this.current = 'boot';
      this.logger = new Logger('GameState');
    }

    get state() {
      return this.current;
    }

    is() {
      return Array.prototype.indexOf.call(arguments, this.current) !== -1;
    }

    canTransition(to) {
      return (TRANSITIONS[this.current] || []).indexOf(to) !== -1;
    }

    set(to, reason) {
      if (to === this.current) return false;
      if (!this.canTransition(to)) {
        this.logger.warn('Переход ' + this.current + ' → ' + to + ' запрещён');
        return false;
      }
      const from = this.current;
      this.current = to;
      this.events.emit('state.changed', { from: from, to: to, reason: reason });
      return true;
    }
  }

  GK.GAME_STATE_TRANSITIONS = TRANSITIONS;
  GK.GameStateService = decorate([Injectable(), Dependencies(GK.EventBus)], GameStateService);
})(window.GK);
