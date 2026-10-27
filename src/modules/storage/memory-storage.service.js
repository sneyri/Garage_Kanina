/** Запасное хранилище в памяти: живёт до перезагрузки страницы. */
(function (GK) {
  'use strict';

  const { Injectable, decorate } = GK.common;

  class MemoryStorageService {
    constructor() {
      this.data = new Map();
    }

    isAvailable() { return true; }
    read(key) { return this.data.has(key) ? this.data.get(key) : null; }
    write(key, raw) { this.data.set(key, raw); return true; }
    remove(key) { this.data.delete(key); }
  }

  GK.MemoryStorageService = decorate([Injectable()], MemoryStorageService);
})(window.GK);
