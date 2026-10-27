/**
 * Фасад хранилища (в Nest это был бы репозиторий).
 *
 * Пишем в localStorage; ключи с опцией { cookie } дублируем в cookie.
 * Читаем в порядке: localStorage → cookie → память.
 * Если localStorage недоступен, cookie становится основным хранилищем,
 * а если недоступно и оно — данные живут в памяти до перезагрузки.
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, Logger, decorate } = GK.common;

  function parse(raw) {
    try {
      return JSON.parse(raw);
    } catch (err) {
      return undefined;
    }
  }

  class StorageService {
    constructor(local, cookies, memory) {
      this.local = local;
      this.cookies = cookies;
      this.memory = memory;
      this.detected = false;
      this.hasLocal = false;
      this.hasCookies = false;
      this.logger = new Logger('StorageService');
    }

    onModuleInit() {
      this.detect();
    }

    detect() {
      this.hasLocal = this.local.isAvailable();
      this.hasCookies = this.cookies.isAvailable();
      this.detected = true;
      this.logger.log('localStorage: ' + (this.hasLocal ? 'да' : 'нет') + ', cookie: ' + (this.hasCookies ? 'да' : 'нет'));
      return { local: this.hasLocal, cookies: this.hasCookies };
    }

    get mode() {
      if (!this.detected) this.detect();
      return this.hasLocal ? 'localStorage' : this.hasCookies ? 'cookie' : 'memory';
    }

    sources() {
      if (!this.detected) this.detect();
      const list = [];
      if (this.hasLocal) list.push(this.local);
      if (this.hasCookies) list.push(this.cookies);
      list.push(this.memory);
      return list;
    }

    get(key, fallback) {
      const sources = this.sources();
      for (let i = 0; i < sources.length; i++) {
        const raw = sources[i].read(key);
        if (raw === null || raw === undefined) continue;
        const value = parse(raw);
        if (value !== undefined) return value;
      }
      return fallback === undefined ? null : fallback;
    }

    /**
     * @param options.cookie true — продублировать в cookie целиком,
     *                       функция — записать в cookie её результат (компактную версию).
     * @returns true, если данные легли в постоянное хранилище, false — только в память.
     */
    set(key, value, options) {
      if (!this.detected) this.detect();
      const raw = JSON.stringify(value);
      this.memory.write(key, raw);
      let persisted = false;
      if (this.hasLocal) persisted = this.local.write(key, raw) || persisted;
      const mirror = options && options.cookie;
      if (this.hasCookies && (mirror || !this.hasLocal)) {
        const cookieRaw = typeof mirror === 'function' ? JSON.stringify(mirror(value)) : raw;
        persisted = this.cookies.write(key, cookieRaw) || persisted;
      }
      return persisted;
    }

    remove(key) {
      if (!this.detected) this.detect();
      this.memory.remove(key);
      if (this.hasLocal) this.local.remove(key);
      if (this.hasCookies) this.cookies.remove(key);
    }
  }

  GK.StorageService = decorate([
    Injectable(),
    Dependencies(GK.LocalStorageService, GK.CookieService, GK.MemoryStorageService),
  ], StorageService);
})(window.GK);
