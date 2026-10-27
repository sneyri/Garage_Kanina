/**
 * Главное меню и заставка. Контроллер — как в Nest: принимает «запросы»
 * (клики по кнопкам с data-action="menu/...") и передаёт работу сервисам.
 */
(function (GK) {
  'use strict';

  const { Controller, Action, Dependencies, decorate } = GK.common;
  const { $ } = GK.dom;

  class MenuController {
    constructor(gameState, save, renderer, input, audio, sfx, events) {
      this.gameState = gameState;
      this.save = save;
      this.renderer = renderer;
      this.input = input;
      this.audio = audio;
      this.sfx = sfx;
      this.events = events;
      this.confirmNew = false;
    }

    onModuleInit() {
      if (typeof document === 'undefined') return;
      this.el = {
        continueBtn: $('#btn-continue'),
        continueInfo: $('#continue-info'),
        newInfo: $('#new-info'),
        newLabel: $('#btn-new span'),
        time: $('#menu-time'),
        about: $('#about'),
      };
      const leaveBoot = () => {
        if (!this.gameState.is('boot')) return;
        this.audio.unlock();
        this.gameState.set('menu', 'boot');
      };
      window.addEventListener('keydown', leaveBoot);
      document.addEventListener('pointerdown', leaveBoot);
      document.addEventListener('mouseover', (e) => {
        const item = e.target.closest && e.target.closest('.menu-item');
        if (item && !item.contains(e.relatedTarget)) this.sfx.uiHover();
      });
      this.events.on('state.changed', (e) => {
        if (e.to === 'menu') this.render();
      });
    }

    onApplicationBootstrap() {
      if (typeof document !== 'undefined') this.render();
    }

    render() {
      const save = this.save.load();
      GK.dom.show(this.el.continueBtn, !!save);
      if (save) this.el.continueInfo.textContent = save.finished ? 'день ' + save.day + ', пройден' : 'день ' + save.day;
      this.el.newInfo.textContent = save ? 'начать с первого дня' : '';
      this.el.newLabel.textContent = 'Новая смена';
      this.confirmNew = false;
      const now = new Date();
      this.el.time.textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    }

    continueGame() {
      this.sfx.uiClick();
      this.input.requestLock(this.renderer.canvas);
      this.events.emit('game.continue');
    }

    newGame() {
      if (this.save.hasSave() && !this.confirmNew) {
        this.confirmNew = true;
        this.el.newLabel.textContent = 'Стереть прогресс?';
        this.el.newInfo.textContent = 'нажми ещё раз';
        this.sfx.uiClick();
        clearTimeout(this.confirmTimer);
        this.confirmTimer = setTimeout(() => this.render(), 3500);
        return;
      }
      this.sfx.uiClick();
      this.input.requestLock(this.renderer.canvas);
      this.events.emit('game.new');
    }

    settings() {
      this.sfx.uiClick();
      this.events.emit('ui.settings.open');
    }

    about() {
      this.sfx.uiClick();
      this.el.about.classList.add('is-open');
    }

    back() {
      this.sfx.uiClick();
      this.el.about.classList.remove('is-open');
    }
  }

  decorate([Action('continue')], MenuController.prototype, 'continueGame');
  decorate([Action('new-game')], MenuController.prototype, 'newGame');
  decorate([Action('settings')], MenuController.prototype, 'settings');
  decorate([Action('about')], MenuController.prototype, 'about');
  decorate([Action('back')], MenuController.prototype, 'back');

  GK.MenuController = decorate([
    Controller('menu'),
    Dependencies(GK.GameStateService, GK.SaveService, GK.RendererService, GK.InputService, GK.AudioService, GK.SfxService, GK.EventBus),
  ], MenuController);
})(window.GK);
