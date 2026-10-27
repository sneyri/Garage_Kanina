/**
 * Отладочная панель (F2 или Ё): вызвать любую пугалку, пропустить день,
 * телепортироваться к гаражу, сбросить сохранение. Удобнее открывать на паузе (Esc).
 */
(function (GK) {
  'use strict';

  const { Controller, Action, Dependencies, decorate } = GK.common;
  const { $, escape } = GK.dom;

  class DebugController {
    constructor(scares, days, tasks, player, save, storage, gameState, loop, events) {
      this.scares = scares;
      this.days = days;
      this.tasks = tasks;
      this.player = player;
      this.save = save;
      this.storage = storage;
      this.gameState = gameState;
      this.loop = loop;
      this.events = events;
      this.open = false;
      this.infoTimer = 0;
    }

    onModuleInit() {
      if (typeof document === 'undefined') return;
      this.panel = $('#debug');
      this.info = $('#debug-info');
      $('#debug-buttons').innerHTML = GK.SCARE_EVENTS.map((e) => (
        '<button data-action="debug/trigger" data-id="' + e.id + '">' + escape(e.title) + '</button>'
      )).join('') +
        '<button data-action="debug/toggle-scares">Пугалки вкл/выкл</button>' +
        '<button data-action="debug/skip-day">Пропустить день</button>' +
        '<button data-action="debug/teleport">К гаражу Канина</button>' +
        '<button data-action="debug/reset-save">Удалить сохранение</button>';
      this.events.on('input.key', (e) => {
        if (e.code === 'F2' || e.code === 'Backquote') this.toggle();
      });
      if (/[?&]debug\b/.test(window.location.search)) this.toggle();
      this.loop.add('debug', (dt) => this.update(dt), { states: ['*'], priority: 960 });
    }

    /**
     * Быстрый прыжок для разработки: index.html?scene=menu | lane | garage | inside | day2
     * (вместе с ?nolock удобно смотреть сцену без захвата курсора).
     */
    onApplicationBootstrap() {
      if (typeof window === 'undefined') return;
      const match = window.location.search.match(/[?&]scene=(\w+)/);
      if (match) this.jump(match[1]);
    }

    jump(scene) {
      this.gameState.set('menu', 'debug-jump');
      if (scene === 'menu') return;
      this.days.beginDay(scene === 'day2' ? 2 : 1);
      if (scene === 'garage' || scene === 'day2') this.teleport();
      if (scene === 'inside') this.player.spawn({ x: GK.garageToWorld(5.6, 0).x, z: GK.garageToWorld(5.6, -0.3).z, yaw: Math.PI / 2 });
      this.gameState.set('playing', 'debug-jump');
    }

    toggle() {
      this.open = !this.open;
      this.panel.classList.toggle('is-open', this.open);
    }

    update(dt) {
      if (!this.open) return;
      this.infoTimer -= dt;
      if (this.infoTimer > 0) return;
      this.infoTimer = 0.25;
      const p = this.player.position;
      this.info.textContent = [
        'FPS: ' + this.loop.fps,
        'Состояние: ' + this.gameState.state,
        'День: ' + (this.tasks.dayNumber || '—'),
        'Позиция: ' + (p ? p.x.toFixed(1) + ', ' + p.z.toFixed(1) : '—'),
        'В гараже: ' + (this.player.inside ? 'да' : 'нет'),
        'Хранилище: ' + this.storage.mode,
        'Пугалки: ' + (this.scares.enabled ? 'вкл' : 'выкл'),
      ].join('\n');
    }

    trigger(payload) {
      const ok = this.scares.trigger(payload.el.dataset.id);
      this.events.emit('toast', { text: ok ? 'Событие: ' + payload.el.textContent : 'Сейчас не сработает (не то место или уже идёт)' });
    }

    toggleScares() {
      this.scares.enabled = !this.scares.enabled;
    }

    skipDay() {
      if (this.gameState.is('playing', 'paused')) this.days.skipDay();
    }

    teleport() {
      this.player.spawn({ x: 3.0, z: -6.75, yaw: -Math.PI / 2 });
    }

    resetSave() {
      this.save.reset();
      this.events.emit('toast', { text: 'Сохранение удалено' });
    }
  }

  decorate([Action('trigger')], DebugController.prototype, 'trigger');
  decorate([Action('toggle-scares')], DebugController.prototype, 'toggleScares');
  decorate([Action('skip-day')], DebugController.prototype, 'skipDay');
  decorate([Action('teleport')], DebugController.prototype, 'teleport');
  decorate([Action('reset-save')], DebugController.prototype, 'resetSave');

  GK.DebugController = decorate([
    Controller('debug'),
    Dependencies(GK.ScareDirectorService, GK.DaysService, GK.TasksService, GK.PlayerService, GK.SaveService,
      GK.StorageService, GK.GameStateService, GK.LoopService, GK.EventBus),
  ], DebugController);
})(window.GK);
