/**
 * Шина событий — аналог EventEmitter2 из @nestjs/event-emitter.
 * Модули общаются событиями, а не прямыми ссылками друг на друга,
 * поэтому не возникает циклических зависимостей.
 */
(function (GK) {
  'use strict';

  const { Injectable, Logger, decorate } = GK.common;

  class EventBus {
    constructor() {
      this.listeners = new Map();
      this.logger = new Logger('EventBus');
      /** В тестах удобно, чтобы ошибки обработчиков не глотались. */
      this.rethrow = false;
    }

    on(event, handler) {
      if (!this.listeners.has(event)) this.listeners.set(event, new Set());
      this.listeners.get(event).add(handler);
      return () => this.off(event, handler);
    }

    once(event, handler) {
      const off = this.on(event, (payload, name) => {
        off();
        handler(payload, name);
      });
      return off;
    }

    off(event, handler) {
      const set = this.listeners.get(event);
      if (set) set.delete(handler);
    }

    emit(event, payload) {
      this.run(this.listeners.get(event), event, payload);
      this.run(this.listeners.get('*'), event, payload);
    }

    run(set, event, payload) {
      if (!set) return;
      Array.from(set).forEach((handler) => {
        try {
          handler(payload, event);
        } catch (err) {
          if (this.rethrow) throw err;
          this.logger.error('Обработчик "' + event + '" упал: ' + (err.stack || err));
        }
      });
    }

    listenerCount(event) {
      const set = this.listeners.get(event);
      return set ? set.size : 0;
    }
  }

  GK.EventBus = decorate([Injectable()], EventBus);
})(window.GK);
