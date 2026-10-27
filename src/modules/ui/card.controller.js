/** Карточки: «День 1 · Уборка» в начале, итоги в конце дня, конец прототипа. */
(function (GK) {
  'use strict';

  const { Controller, Action, Dependencies, decorate } = GK.common;
  const { $ } = GK.dom;
  const { formatTime } = GK.math;

  class CardController {
    constructor(gameState, input, renderer, sfx, events, loop) {
      this.gameState = gameState;
      this.input = input;
      this.renderer = renderer;
      this.sfx = sfx;
      this.events = events;
      this.loop = loop;
      this.mode = null;
    }

    onModuleInit() {
      if (typeof document === 'undefined') return;
      this.el = {
        card: $('#card'), kicker: $('#card-kicker'), title: $('#card-title'),
        text: $('#card-text'), button: $('#card-button'),
      };
      this.events.on('day.begin', (e) => this.showDayBegin(e));
      this.events.on('day.end', (e) => this.showDayEnd(e));
      this.events.on('game.completed', (e) => this.showEnding(e));
      this.events.on('state.changed', (e) => {
        if (e.to === 'menu' || e.to === 'playing') this.close();
      });
      this.loop.add('card', (dt) => this.update(dt), { states: ['cutscene'], priority: 30 });
    }

    show(kicker, title, text, button, variant) {
      this.el.kicker.textContent = kicker;
      this.el.title.textContent = title;
      this.el.text.textContent = text;
      GK.dom.show(this.el.button, !!button);
      if (button) this.el.button.textContent = button;
      this.el.card.className = 'screen screen-card is-open card-' + variant;
    }

    close() {
      this.mode = null;
      if (this.el) this.el.card.classList.remove('is-open');
    }

    showDayBegin(e) {
      this.mode = 'begin';
      this.timer = 3.8;
      this.show('День ' + e.day, e.title, 'Вечер, ' + e.time + '. На улице минус двадцать четыре.', null, 'begin');
    }

    showDayEnd(e) {
      this.mode = 'end';
      this.input.exitLock();
      const stats = 'Смена длилась ' + formatTime(e.elapsed) + '.' + (e.scares ? ' Испугов: ' + e.scares + '.' : '');
      this.show('День ' + e.day + ' завершён', e.title, e.outro + '\n\n' + stats, e.next ? 'Следующий день' : 'Дальше', 'end');
    }

    showEnding(e) {
      this.mode = 'ending';
      this.input.exitLock();
      const scares = e.stats && e.stats.scares ? '\nИспугов за всё время: ' + e.stats.scares : '';
      this.show('Конец прототипа', 'Подвал', 'Дальше — люк в полу. День 3 в разработке.' + scares, 'В главное меню', 'ending');
    }

    update(dt) {
      if (this.mode !== 'begin') return;
      this.timer -= dt;
      if (this.timer <= 0 || (this.timer < 3 && this.input.wasPressed('skip'))) {
        this.close();
        this.gameState.set('playing', 'day-start');
      }
    }

    proceed() {
      this.sfx.uiClick();
      if (this.mode === 'end') {
        this.close();
        this.input.requestLock(this.renderer.canvas);
        this.events.emit('day.next');
      } else if (this.mode === 'ending') {
        this.close();
        this.gameState.set('menu', 'ending');
      }
    }
  }

  decorate([Action('continue')], CardController.prototype, 'proceed');

  GK.CardController = decorate([
    Controller('card'),
    Dependencies(GK.GameStateService, GK.InputService, GK.RendererService, GK.SfxService, GK.EventBus, GK.LoopService),
  ], CardController);
})(window.GK);
