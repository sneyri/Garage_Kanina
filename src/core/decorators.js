/**
 * Декораторы в стиле @nestjs/common.
 *
 * В NestJS (TypeScript) пишут так:
 *
 *   @Injectable()
 *   @Dependencies(StorageService)
 *   export class SettingsService {
 *     constructor(storage) {}
 *   }
 *
 * В браузере без сборщика синтаксиса @ нет, поэтому применяем декораторы вручную —
 * ровно так, как это делает компилятор TypeScript (функция __decorate):
 *
 *   const SettingsService = decorate([Injectable(), Dependencies(StorageService)],
 *     class SettingsService { constructor(storage) {} });
 */
(function (GK) {
  'use strict';

  const { Reflector } = GK.core;

  const META = Object.freeze({
    INJECTABLE: 'injectable',
    DEPENDENCIES: 'dependencies',
    MODULE: 'module',
    GLOBAL: 'global',
    CONTROLLER: 'controller',
    ACTIONS: 'actions',
  });

  const MODULE_KEYS = ['imports', 'providers', 'controllers', 'exports'];

  /** @Injectable() — класс может участвовать во внедрении зависимостей. */
  function Injectable(options) {
    return function (target) {
      Reflector.define(META.INJECTABLE, Object.assign({ scope: 'singleton' }, options), target);
      return target;
    };
  }

  /**
   * @Dependencies(A, B) — что передать в конструктор. В TypeScript Nest берёт это
   * из типов параметров, а в чистом JS для этого и существует @Dependencies().
   */
  function Dependencies() {
    const tokens = Array.prototype.slice.call(arguments);
    return function (target) {
      Reflector.define(META.DEPENDENCIES, tokens, target);
      return target;
    };
  }

  /** @Module({ imports, providers, controllers, exports }) */
  function Module(metadata) {
    metadata = metadata || {};
    Object.keys(metadata).forEach(function (key) {
      if (MODULE_KEYS.indexOf(key) === -1) {
        throw new Error('Неизвестное поле "' + key + '" в Module(). Допустимы: ' + MODULE_KEYS.join(', '));
      }
    });
    return function (target) {
      Reflector.define(META.MODULE, {
        imports: metadata.imports || [],
        providers: metadata.providers || [],
        controllers: metadata.controllers || [],
        exports: metadata.exports || [],
      }, target);
      return target;
    };
  }

  /** @Global() — экспорты модуля видны везде без импорта. */
  function Global() {
    return function (target) {
      Reflector.define(META.GLOBAL, true, target);
      return target;
    };
  }

  /** @Controller('menu') — префикс маршрутов контроллера. */
  function Controller(prefix) {
    return function (target) {
      Reflector.define(META.CONTROLLER, { prefix: prefix || '' }, target);
      return target;
    };
  }

  /**
   * @Action('new-game') — декоратор метода, аналог @Get()/@Post().
   * Вместе с Controller('menu') даёт маршрут "menu/new-game".
   */
  function Action(path) {
    return function (proto, key, descriptor) {
      const ctor = proto.constructor;
      const list = (Reflector.getOwn(META.ACTIONS, ctor) || []).slice();
      list.push({ path: path, method: key });
      Reflector.define(META.ACTIONS, list, ctor);
      return descriptor;
    };
  }

  /**
   * Аналог __decorate из TypeScript. Декораторы применяются снизу вверх.
   *   decorate([A(), B()], Cls)                        — декораторы класса
   *   decorate([Action('x')], Cls.prototype, 'method')  — декораторы метода
   */
  function decorate(decorators, target, key) {
    if (key === undefined) {
      let result = target;
      for (let i = decorators.length - 1; i >= 0; i--) {
        const next = decorators[i](result);
        if (next !== undefined) result = next;
      }
      return result;
    }
    let descriptor = Object.getOwnPropertyDescriptor(target, key);
    for (let i = decorators.length - 1; i >= 0; i--) {
      const next = decorators[i](target, key, descriptor);
      if (next !== undefined) descriptor = next;
    }
    if (descriptor) Object.defineProperty(target, key, descriptor);
    return descriptor;
  }

  Object.assign(GK.common, { META, Injectable, Dependencies, Module, Global, Controller, Action, decorate });
})(window.GK);
