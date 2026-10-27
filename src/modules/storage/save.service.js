/**
 * Сохранение прогресса. Сохраняемся в начале и в конце каждого дня
 * (как чекпоинт): «Продолжить» начинает текущий день заново.
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;

  const SAVE_KEY = 'save';
  const SAVE_VERSION = 1;

  function defaults() {
    return {
      version: SAVE_VERSION,
      day: 1,
      completedDays: [],
      finished: false,
      stats: { scares: 0, playTime: 0 },
      savedAt: null,
    };
  }

  function numbers(source) {
    const result = {};
    Object.keys(source || {}).forEach((key) => {
      if (typeof source[key] === 'number' && isFinite(source[key])) result[key] = source[key];
    });
    return result;
  }

  class SaveService {
    constructor(storage, events) {
      this.storage = storage;
      this.events = events;
    }

    load() {
      const raw = this.storage.get(SAVE_KEY);
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
      return this.migrate(raw);
    }

    /**
     * Приводим любые данные к актуальному формату. Когда формат поменяется,
     * сюда добавляется шаг вроде: if (data.version < 2) { ... }.
     * В cookie лежит только { version, day, savedAt } — недостающее берём из defaults().
     */
    migrate(data) {
      const base = defaults();
      return {
        version: SAVE_VERSION,
        day: Number.isInteger(data.day) && data.day >= 1 ? data.day : base.day,
        completedDays: Array.isArray(data.completedDays) ? data.completedDays.filter(Number.isInteger) : base.completedDays,
        finished: data.finished === true,
        stats: Object.assign(base.stats, numbers(data.stats)),
        savedAt: typeof data.savedAt === 'number' ? data.savedAt : null,
      };
    }

    hasSave() {
      return this.load() !== null;
    }

    save(patch) {
      const current = this.load() || defaults();
      const next = Object.assign({}, current, patch, { version: SAVE_VERSION, savedAt: Date.now() });
      next.stats = Object.assign({}, current.stats, patch && patch.stats);
      this.storage.set(SAVE_KEY, next, {
        cookie: (s) => ({ version: s.version, day: s.day, finished: s.finished, savedAt: s.savedAt }),
      });
      this.events.emit('save.written', next);
      return next;
    }

    reset() {
      this.storage.remove(SAVE_KEY);
      this.events.emit('save.reset');
    }
  }

  GK.SAVE_VERSION = SAVE_VERSION;
  GK.SaveService = decorate([Injectable(), Dependencies(GK.StorageService, GK.EventBus)], SaveService);
})(window.GK);
