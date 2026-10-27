/**
 * DI-контейнер — сердце NestJS (в оригинале это NestContainer + InstanceLoader + Injector).
 *
 * Что он делает:
 *  1. scan()            — обходит дерево модулей начиная с корневого (AppModule);
 *  2. createInstances() — создаёт по одному экземпляру каждого провайдера (singleton),
 *                         подставляя зависимости в конструктор;
 *  3. callHook()        — вызывает хуки жизненного цикла (onModuleInit и т.д.).
 *
 * Правила видимости как в Nest: провайдер доступен в своём модуле, а в других —
 * только если модуль его экспортирует и его импортировали (или модуль глобальный).
 */
(function (GK) {
  'use strict';

  const { Reflector } = GK.core;
  const { META, Logger } = GK.common;

  function tokenName(token) {
    if (typeof token === 'function') return token.name || 'анонимный класс';
    if (typeof token === 'symbol') return token.toString();
    return String(token);
  }

  function isDynamicModule(def) {
    return def !== null && typeof def === 'object' && typeof def.module === 'function';
  }

  function hasRecipe(provider) {
    return 'useClass' in provider || 'useValue' in provider || 'useFactory' in provider || 'useExisting' in provider;
  }

  /** Класс → { provide: Класс, useClass: Класс }; объект оставляем как есть. */
  function normalizeProvider(provider, moduleName) {
    if (typeof provider === 'function') return { provide: provider, useClass: provider };
    if (provider && provider.provide !== undefined && hasRecipe(provider)) return provider;
    throw new Error(
      'Некорректный провайдер в модуле ' + moduleName + ': ' + tokenName(provider) +
      '. Ожидается класс или { provide, useClass | useValue | useFactory | useExisting }. ' +
      'Если там undefined — проверь порядок подключения <script>.'
    );
  }

  class InstanceWrapper {
    constructor(def, host) {
      this.def = def;
      this.token = def.provide;
      this.host = host;
      this.instance = undefined;
      this.isResolved = false;
    }

    get name() { return tokenName(this.token); }
  }

  class ModuleWrapper {
    constructor(metatype, isGlobal) {
      this.metatype = metatype;
      this.name = metatype.name;
      this.isGlobal = isGlobal;
      this.imports = new Set();
      this.providers = new Map();
      this.controllers = new Map();
      this.exports = new Set();
      this.instance = undefined;
      this.distance = 0;
    }
  }

  class NestContainer {
    /** @param overrides Map<token, provider> — подмена провайдеров (используется в тестах). */
    constructor(overrides) {
      this.modules = new Map();
      this.globalModules = new Set();
      this.overrides = overrides || new Map();
      this.root = null;
      this.logger = new Logger('InstanceLoader');
    }

    scan(rootModule) {
      this.root = this.addModule(rootModule, []);
      this.calculateDistance(this.root, 1, new Set());
      return this.root;
    }

    addModule(definition, stack) {
      const dynamic = isDynamicModule(definition) ? definition : null;
      const metatype = dynamic ? dynamic.module : definition;
      if (typeof metatype !== 'function') {
        const where = stack.length ? stack[stack.length - 1].name : 'корневом модуле';
        throw new Error('В imports модуля ' + where + ' пришёл undefined. Скорее всего, <script> модуля подключён позже.');
      }
      if (this.modules.has(metatype)) return this.modules.get(metatype);

      const meta = Reflector.get(META.MODULE, metatype);
      if (!meta) throw new Error('Класс ' + metatype.name + ' используется как модуль, но не помечен Module().');

      const extra = dynamic || {};
      const isGlobal = !!(Reflector.get(META.GLOBAL, metatype) || extra.global);
      const wrapper = new ModuleWrapper(metatype, isGlobal);
      this.modules.set(metatype, wrapper);
      if (isGlobal) this.globalModules.add(wrapper);

      meta.providers.concat(extra.providers || []).forEach((provider) => {
        let def = normalizeProvider(provider, wrapper.name);
        if (this.overrides.has(def.provide)) {
          def = Object.assign({ provide: def.provide }, this.overrides.get(def.provide));
        }
        wrapper.providers.set(def.provide, new InstanceWrapper(def, wrapper));
      });

      meta.controllers.forEach((controller) => {
        if (typeof controller !== 'function') throw new Error('Контроллер undefined в модуле ' + wrapper.name);
        wrapper.controllers.set(controller, new InstanceWrapper({ provide: controller, useClass: controller }, wrapper));
      });

      const nextStack = stack.concat(wrapper);
      meta.imports.concat(extra.imports || []).forEach((imported) => {
        wrapper.imports.add(this.addModule(imported, nextStack));
      });

      meta.exports.concat(extra.exports || []).forEach((exported) => {
        wrapper.exports.add(isDynamicModule(exported) ? exported.module : exported);
      });

      wrapper.exports.forEach((token) => {
        const own = wrapper.providers.has(token);
        const reexport = Array.from(wrapper.imports).some((m) => m.metatype === token);
        if (!own && !reexport) {
          throw new Error('Модуль ' + wrapper.name + ' экспортирует ' + tokenName(token) + ', но не объявляет его в providers и не импортирует такой модуль.');
        }
      });

      return wrapper;
    }

    /** Глубина модуля в дереве: хуки вызываются сначала у самых глубоких. */
    calculateDistance(wrapper, distance, path) {
      if (path.has(wrapper)) return;
      wrapper.distance = Math.max(wrapper.distance, distance);
      path.add(wrapper);
      wrapper.imports.forEach((m) => this.calculateDistance(m, distance + 1, path));
      path.delete(wrapper);
    }

    /** Ищем провайдер, видимый из модуля host: свои → экспорты импортов → глобальные. */
    lookup(token, host) {
      if (host.providers.has(token)) return host.providers.get(token);
      const visited = new Set();
      for (const imported of host.imports) {
        const found = this.findExported(token, imported, visited);
        if (found) return found;
      }
      for (const globalModule of this.globalModules) {
        if (globalModule === host) continue;
        const found = this.findExported(token, globalModule, visited);
        if (found) return found;
      }
      return null;
    }

    findExported(token, wrapper, visited) {
      if (visited.has(wrapper)) return null;
      visited.add(wrapper);
      if (wrapper.exports.has(token) && wrapper.providers.has(token)) return wrapper.providers.get(token);
      for (const exported of wrapper.exports) {
        const reexported = this.modules.get(exported);
        if (reexported && wrapper.imports.has(reexported)) {
          const found = this.findExported(token, reexported, visited);
          if (found) return found;
        }
      }
      return null;
    }

    sortedModules() {
      return Array.from(this.modules.values()).sort((a, b) => b.distance - a.distance);
    }

    async createInstances() {
      for (const wrapper of this.sortedModules()) {
        for (const provider of wrapper.providers.values()) await this.loadInstance(provider, []);
        for (const controller of wrapper.controllers.values()) await this.loadInstance(controller, []);
        const deps = Reflector.get(META.DEPENDENCIES, wrapper.metatype) || [];
        const args = await this.resolveArgs(deps, { name: wrapper.name, host: wrapper }, []);
        wrapper.instance = new wrapper.metatype(...args);
        this.logger.log(wrapper.name + ' dependencies initialized');
      }
    }

    async loadInstance(wrapper, stack) {
      if (wrapper.isResolved) return wrapper.instance;
      const cycleStart = stack.indexOf(wrapper);
      if (cycleStart !== -1) {
        const chain = stack.slice(cycleStart).concat(wrapper).map((w) => w.name).join(' → ');
        throw new Error('Циклическая зависимость: ' + chain + '. Разорви цикл через EventBus или вынеси общий код в отдельный провайдер.');
      }
      const nextStack = stack.concat(wrapper);
      const def = wrapper.def;
      let instance;

      if ('useValue' in def) {
        instance = def.useValue;
      } else if ('useFactory' in def) {
        const args = await this.resolveArgs(def.inject || [], wrapper, nextStack);
        instance = await def.useFactory.apply(null, args);
      } else if ('useExisting' in def) {
        const target = this.lookup(def.useExisting, wrapper.host);
        if (!target) throw new Error('useExisting: ' + tokenName(def.useExisting) + ' не найден в контексте ' + wrapper.host.name);
        instance = await this.loadInstance(target, nextStack);
      } else {
        const Cls = def.useClass;
        if (typeof Cls !== 'function') throw new Error('useClass для ' + wrapper.name + ' не является классом');
        const deps = Reflector.get(META.DEPENDENCIES, Cls) || [];
        const injectable = Reflector.get(META.INJECTABLE, Cls) || Reflector.get(META.CONTROLLER, Cls);
        if (deps.length && !injectable) {
          this.logger.warn(Cls.name + ' имеет зависимости, но не помечен Injectable() — в NestJS это ошибка.');
        }
        if (Cls.length > deps.length) {
          throw new Error('Конструктор ' + Cls.name + ' ожидает ' + Cls.length + ' аргумент(а), а в Dependencies() перечислено ' + deps.length + '.');
        }
        const args = await this.resolveArgs(deps, wrapper, nextStack);
        instance = new Cls(...args);
      }

      wrapper.instance = instance;
      wrapper.isResolved = true;
      return instance;
    }

    async resolveArgs(tokens, wrapper, stack) {
      const args = [];
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const dependency = token === undefined ? null : this.lookup(token, wrapper.host);
        if (!dependency) throw new Error(this.unknownDependencyMessage(wrapper, tokens, i));
        args.push(await this.loadInstance(dependency, stack));
      }
      return args;
    }

    /** Сообщение в духе Nest: "Nest can't resolve dependencies of the X (?, Y)..." */
    unknownDependencyMessage(wrapper, tokens, index) {
      const list = tokens.map((t, i) => (i === index ? '?' : tokenName(t))).join(', ');
      const name = tokens[index] === undefined ? 'undefined' : tokenName(tokens[index]);
      let message = 'Не могу разрешить зависимости ' + wrapper.name + ' (' + list + '). ' +
        'Убедись, что аргумент ' + name + ' с индексом [' + index + '] доступен в контексте ' + wrapper.host.name + '.';
      if (tokens[index] === undefined) {
        message += ' Токен undefined: вероятно, <script> с этим классом подключён позже, чем ' + wrapper.name + '.';
      } else {
        message += ' Если ' + name + ' объявлен в другом модуле — добавь его в exports того модуля и импортируй модуль в ' + wrapper.host.name + '.';
      }
      return message;
    }

    async callHook(hook, arg) {
      const called = new Set();
      for (const wrapper of this.sortedModules()) {
        const instances = Array.from(wrapper.controllers.values())
          .concat(Array.from(wrapper.providers.values()))
          .map((w) => w.instance)
          .concat([wrapper.instance]);
        for (const instance of instances) {
          if (!instance || (typeof instance !== 'object' && typeof instance !== 'function')) continue;
          if (called.has(instance) || typeof instance[hook] !== 'function') continue;
          called.add(instance);
          await instance[hook](arg);
        }
      }
    }

    controllers() {
      const result = [];
      this.modules.forEach((wrapper) => wrapper.controllers.forEach((w) => result.push(w.instance)));
      return result;
    }

    get(token) {
      for (const wrapper of this.modules.values()) {
        const found = wrapper.providers.get(token) || wrapper.controllers.get(token);
        if (found) return found.instance;
      }
      throw new Error('Провайдер ' + tokenName(token) + ' не найден ни в одном модуле');
    }
  }

  Object.assign(GK.core, { NestContainer, tokenName });
})(window.GK);
