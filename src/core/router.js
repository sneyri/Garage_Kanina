/**
 * Аналог RouterExplorer из NestJS.
 *
 * В Nest контроллер обрабатывает HTTP-маршруты:
 *   @Controller('cats') + @Get('profile')  →  GET /cats/profile
 *
 * У нас «запросы» приходят от интерфейса: элемент с data-action="menu/new-game"
 * вызывает метод, помеченный Action('new-game') в контроллере Controller('menu').
 * Кнопки срабатывают на click, ползунки — на input, галочки и списки — на change.
 */
(function (GK) {
  'use strict';

  const { Reflector } = GK.core;
  const { META, Logger } = GK.common;

  function joinPath(prefix, path) {
    return [prefix, path].filter(Boolean).join('/').replace(/\/+/g, '/');
  }

  function readValue(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'range' || el.type === 'number') return parseFloat(el.value);
    return el.value;
  }

  function eventFor(el) {
    if (!el.matches('input, select, textarea')) return 'click';
    return el.type === 'range' ? 'input' : 'change';
  }

  class DomRouter {
    constructor() {
      this.routes = new Map();
      this.logger = new Logger('RouterExplorer');
      this.bound = false;
    }

    register(instance) {
      const ctor = instance.constructor;
      const controller = Reflector.get(META.CONTROLLER, ctor);
      if (!controller) return;
      new Logger('RoutesResolver').log(ctor.name + ' {' + (controller.prefix || '/') + '}');
      (Reflector.get(META.ACTIONS, ctor) || []).forEach((action) => {
        const path = joinPath(controller.prefix, action.path);
        if (this.routes.has(path)) throw new Error('Действие "' + path + '" уже зарегистрировано');
        this.routes.set(path, (payload) => instance[action.method](payload));
        this.logger.log('Mapped {' + path + '} route');
      });
    }

    /** Вызов действия по пути — как запрос к маршруту. Синхронно, чтобы не терять жест пользователя. */
    dispatch(path, payload) {
      const handler = this.routes.get(path);
      if (!handler) throw new Error('Нет обработчика для действия "' + path + '" (404)');
      return handler(payload || {});
    }

    bindDom(doc) {
      if (this.bound || !doc) return;
      this.bound = true;
      const handle = (event) => {
        const el = event.target && event.target.closest ? event.target.closest('[data-action]') : null;
        if (!el || el.disabled || eventFor(el) !== event.type) return;
        try {
          const result = this.dispatch(el.getAttribute('data-action'), {
            event: event, el: el, value: readValue(el), dataset: el.dataset,
          });
          if (result && typeof result.catch === 'function') {
            result.catch((err) => this.logger.error(err.stack || err.message));
          }
        } catch (err) {
          this.logger.error(err.stack || err.message);
        }
      };
      doc.addEventListener('click', handle);
      doc.addEventListener('input', handle);
      doc.addEventListener('change', handle);
    }
  }

  GK.core.DomRouter = DomRouter;
})(window.GK);
