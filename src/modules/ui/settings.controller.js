/** Панель настроек — общая для главного меню и паузы. */
(function (GK) {
  'use strict';

  const { Controller, Action, Dependencies, decorate } = GK.common;
  const { $, $$ } = GK.dom;

  const STORAGE_NAMES = { localStorage: 'localStorage', cookie: 'cookie', memory: 'только память (до перезагрузки)' };

  function format(key, value) {
    if (/Volume$/.test(key) || key === 'brightness') return Math.round(value * 100) + '%';
    if (key === 'sensitivity') return value.toFixed(1);
    if (key === 'fov') return Math.round(value) + '°';
    return String(value);
  }

  class SettingsController {
    constructor(settings, storage, sfx, events) {
      this.settings = settings;
      this.storage = storage;
      this.sfx = sfx;
      this.events = events;
    }

    onModuleInit() {
      if (typeof document === 'undefined') return;
      this.panel = $('#settings');
      this.events.on('ui.settings.open', () => this.open());
      this.events.on('settings.changed', () => this.render());
    }

    onApplicationBootstrap() {
      if (this.panel) this.render();
    }

    open() {
      this.render();
      this.panel.classList.add('is-open');
    }

    render() {
      $$('[data-key]', this.panel).forEach((el) => {
        const key = el.dataset.key;
        const value = this.settings.get(key);
        if (el.type === 'checkbox') el.checked = value;
        else if (document.activeElement !== el) el.value = value;
        const output = this.panel.querySelector('output[data-for="' + key + '"]');
        if (output) output.textContent = format(key, value);
      });
      const cookies = this.storage.hasCookies
        ? 'Копия настроек и номера дня лежит в cookie.'
        : 'Cookie недоступны: Chrome и Edge не хранят их у игр, открытых как файл.';
      $('#storage-info').textContent = 'Прогресс хранится: ' + STORAGE_NAMES[this.storage.mode] + '. ' + cookies;
      document.body.classList.toggle('no-grain', !this.settings.get('grain'));
    }

    change(payload) {
      this.settings.set(payload.el.dataset.key, payload.value);
    }

    reset() {
      this.sfx.uiClick();
      this.settings.reset();
    }

    close() {
      this.sfx.uiClick();
      this.panel.classList.remove('is-open');
    }
  }

  decorate([Action('change')], SettingsController.prototype, 'change');
  decorate([Action('reset')], SettingsController.prototype, 'reset');
  decorate([Action('close')], SettingsController.prototype, 'close');

  GK.SettingsController = decorate([
    Controller('settings'),
    Dependencies(GK.SettingsService, GK.StorageService, GK.SfxService, GK.EventBus),
  ], SettingsController);
})(window.GK);
