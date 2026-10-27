/**
 * Хранилище метаданных — упрощённый аналог пакета reflect-metadata,
 * на котором в NestJS держатся все декораторы (@Module, @Injectable и т.д.).
 *
 * Декоратор ничего «не делает» сам по себе: он только записывает метаданные
 * на класс. Потом контейнер читает их и решает, как собрать приложение.
 */
(function (global) {
  'use strict';

  const GK = global.GK || (global.GK = {});
  GK.core = GK.core || {};
  GK.common = GK.common || {};

  const store = new WeakMap();

  function bucket(target, create) {
    let map = store.get(target);
    if (!map && create) {
      map = new Map();
      store.set(target, map);
    }
    return map;
  }

  const Reflector = {
    define(key, value, target) {
      bucket(target, true).set(key, value);
    },

    /** Читает метаданные с учётом наследования классов (как Reflect.getMetadata). */
    get(key, target) {
      let current = target;
      while (current && current !== Function.prototype && current !== Object.prototype) {
        const map = bucket(current, false);
        if (map && map.has(key)) return map.get(key);
        current = Object.getPrototypeOf(current);
      }
      return undefined;
    },

    getOwn(key, target) {
      const map = bucket(target, false);
      return map ? map.get(key) : undefined;
    },
  };

  GK.core.Reflector = Reflector;
})(window);
