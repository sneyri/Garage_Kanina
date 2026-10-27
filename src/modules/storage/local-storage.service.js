/**
 * Обёртка над localStorage. Хранит строки, JSON разбирает StorageService.
 * Любая операция может бросить исключение (приватный режим Safari, переполнение,
 * запрет сайта), поэтому всё завёрнуто в try/catch.
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;

  class LocalStorageService {
    constructor(webStorage) {
      this.backend = webStorage;
      this.prefix = 'gk:';
    }

    isAvailable() {
      if (!this.backend) return false;
      try {
        const key = this.prefix + '__probe__';
        this.backend.setItem(key, '1');
        const ok = this.backend.getItem(key) === '1';
        this.backend.removeItem(key);
        return ok;
      } catch (err) {
        return false;
      }
    }

    read(key) {
      try {
        const raw = this.backend.getItem(this.prefix + key);
        return raw === undefined ? null : raw;
      } catch (err) {
        return null;
      }
    }

    write(key, raw) {
      try {
        this.backend.setItem(this.prefix + key, raw);
        return true;
      } catch (err) {
        return false;
      }
    }

    remove(key) {
      try {
        this.backend.removeItem(this.prefix + key);
      } catch (err) {
        /* хранилище недоступно — удалять нечего */
      }
    }
  }

  GK.LocalStorageService = decorate([Injectable(), Dependencies(GK.TOKENS.WEB_STORAGE)], LocalStorageService);
})(window.GK);
