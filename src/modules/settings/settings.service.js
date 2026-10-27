/**
 * Настройки игры. Схема описывает тип и границы каждого значения —
 * всё, что пришло из хранилища или из формы, проходит через sanitize().
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;
  const { clamp } = GK.math;

  const SCHEMA = Object.freeze({
    masterVolume: { type: 'number', min: 0, max: 1, default: 0.8 },
    musicVolume: { type: 'number', min: 0, max: 1, default: 0.7 },
    sfxVolume: { type: 'number', min: 0, max: 1, default: 0.9 },
    sensitivity: { type: 'number', min: 0.2, max: 3, default: 1 },
    invertY: { type: 'boolean', default: false },
    fov: { type: 'number', min: 55, max: 95, default: 72 },
    brightness: { type: 'number', min: 0.5, max: 2, default: 1 },
    quality: { type: 'enum', values: ['low', 'medium', 'high'], default: 'medium' },
    grain: { type: 'boolean', default: true },
    headBob: { type: 'boolean', default: true },
  });

  function defaults() {
    const values = {};
    Object.keys(SCHEMA).forEach((key) => { values[key] = SCHEMA[key].default; });
    return values;
  }

  class SettingsService {
    constructor(storage, events) {
      this.storage = storage;
      this.events = events;
      this.values = defaults();
    }

    onModuleInit() {
      this.load();
    }

    load() {
      const saved = this.storage.get('settings');
      if (!saved || typeof saved !== 'object') return;
      Object.keys(SCHEMA).forEach((key) => {
        if (!(key in saved)) return;
        const value = this.sanitize(key, saved[key]);
        if (value !== undefined) this.values[key] = value;
      });
    }

    /** Возвращает корректное значение или undefined, если его нельзя принять. */
    sanitize(key, value) {
      const schema = SCHEMA[key];
      if (!schema) return undefined;
      if (schema.type === 'number') {
        const n = typeof value === 'number' ? value : parseFloat(value);
        return isFinite(n) ? clamp(n, schema.min, schema.max) : undefined;
      }
      if (schema.type === 'boolean') {
        if (typeof value === 'boolean') return value;
        if (value === 'true' || value === 1 || value === '1') return true;
        if (value === 'false' || value === 0 || value === '0') return false;
        return undefined;
      }
      if (schema.type === 'enum') return schema.values.indexOf(value) !== -1 ? value : undefined;
      return undefined;
    }

    get(key) {
      return this.values[key];
    }

    getAll() {
      return Object.assign({}, this.values);
    }

    set(key, value) {
      const next = this.sanitize(key, value);
      if (next === undefined) return false;
      if (this.values[key] === next) return true;
      this.values[key] = next;
      this.persist();
      this.events.emit('settings.changed', { key: key, value: next });
      return true;
    }

    reset() {
      const fresh = defaults();
      const changed = Object.keys(fresh).filter((key) => fresh[key] !== this.values[key]);
      this.values = fresh;
      this.persist();
      changed.forEach((key) => this.events.emit('settings.changed', { key: key, value: fresh[key] }));
    }

    persist() {
      this.storage.set('settings', this.values, { cookie: true });
    }
  }

  GK.SETTINGS_SCHEMA = SCHEMA;
  GK.SettingsService = decorate([Injectable(), Dependencies(GK.StorageService, GK.EventBus)], SettingsService);
})(window.GK);
