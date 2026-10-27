describe('Ядро в стиле NestJS', () => {
  const { Injectable, Dependencies, Module, Global, Controller, Action, decorate } = GK.common;
  const { NestFactory } = GK.core;
  const { Test } = GK.testing;
  const options = { logger: false, bindDom: false };

  function service(name, deps, body) {
    const Cls = ({ [name]: class { constructor() { this.args = Array.prototype.slice.call(arguments); } } })[name];
    if (body) Object.assign(Cls.prototype, body);
    return decorate([Injectable(), Dependencies.apply(null, deps || [])], Cls);
  }

  function mod(name, metadata, global) {
    const Cls = ({ [name]: class {} })[name];
    return decorate(global ? [Global(), Module(metadata)] : [Module(metadata)], Cls);
  }

  describe('внедрение зависимостей', () => {
    it('создаёт провайдеры и передаёт зависимости в конструктор', async () => {
      const A = service('A');
      const B = service('B', [A]);
      const app = await NestFactory.create(mod('M', { providers: [A, B] }), options);
      expect(app.get(B).args[0]).toBe(app.get(A));
    });

    it('провайдер — одиночка: все получают один и тот же экземпляр', async () => {
      const Shared = service('Shared');
      const X = service('X', [Shared]);
      const Y = service('Y', [Shared]);
      const app = await NestFactory.create(mod('M', { providers: [Shared, X, Y] }), options);
      expect(app.get(X).args[0]).toBe(app.get(Y).args[0]);
    });

    it('не даёт взять провайдер, который модуль не экспортирует', async () => {
      const Secret = service('Secret');
      const User = service('User', [Secret]);
      const Hidden = mod('HiddenModule', { providers: [Secret] });
      const Root = mod('RootModule', { imports: [Hidden], providers: [User] });
      await expect(NestFactory.create(Root, options)).rejects.toThrow('Не могу разрешить зависимости User (?)');
    });

    it('видит экспорт импортированного модуля и реэкспорт', async () => {
      const Db = service('Db');
      const DbModule = mod('DbModule', { providers: [Db], exports: [Db] });
      const CoreModule = mod('CoreModule', { imports: [DbModule], exports: [DbModule] });
      const Repo = service('Repo', [Db]);
      const app = await NestFactory.create(mod('AppModule', { imports: [CoreModule], providers: [Repo] }), options);
      expect(app.get(Repo).args[0]).toBe(app.get(Db));
    });

    it('глобальный модуль виден без импорта', async () => {
      const Bus = service('Bus');
      const Bus2 = mod('BusModule', { providers: [Bus], exports: [Bus] }, true);
      const Feature = service('Feature', [Bus]);
      const FeatureModule = mod('FeatureModule', { providers: [Feature] });
      const app = await NestFactory.create(mod('AppModule', { imports: [Bus2, FeatureModule] }), options);
      expect(app.get(Feature).args[0]).toBe(app.get(Bus));
    });

    it('умеет useValue, useFactory, useClass и useExisting', async () => {
      const Real = service('Real');
      const app = await NestFactory.create(mod('M', {
        providers: [
          { provide: 'CONFIG', useValue: { days: 2 } },
          { provide: 'DOUBLE', useFactory: (cfg) => cfg.days * 2, inject: ['CONFIG'] },
          { provide: 'IMPL', useClass: Real },
          { provide: 'ALIAS', useExisting: 'IMPL' },
        ],
      }), options);
      expect(app.get('CONFIG')).toEqual({ days: 2 });
      expect(app.get('DOUBLE')).toBe(4);
      expect(app.get('IMPL')).toBeInstanceOf(Real);
      expect(app.get('ALIAS')).toBe(app.get('IMPL'));
    });

    it('асинхронная фабрика ждёт результат', async () => {
      const app = await NestFactory.create(mod('M', {
        providers: [{ provide: 'ASYNC', useFactory: () => new Promise((r) => setTimeout(() => r('готово'), 5)) }],
      }), options);
      expect(app.get('ASYNC')).toBe('готово');
    });

    it('находит циклическую зависимость и называет цепочку', async () => {
      const Root = mod('M', {
        providers: [
          { provide: 'A', useFactory: (b) => b, inject: ['B'] },
          { provide: 'B', useFactory: (a) => a, inject: ['A'] },
        ],
      });
      await expect(NestFactory.create(Root, options)).rejects.toThrow('Циклическая зависимость: A → B → A');
    });

    it('подсказывает про порядок <script>, если вместо класса пришёл undefined', async () => {
      const Broken = service('Broken', [undefined]);
      await expect(NestFactory.create(mod('M', { providers: [Broken] }), options)).rejects.toThrow('подключён позже');
    });

    it('ругается, если конструктор ждёт больше аргументов, чем указано в Dependencies()', async () => {
      const Greedy = decorate([Injectable()], class Greedy { constructor(a, b) { this.a = a; this.b = b; } });
      await expect(NestFactory.create(mod('M', { providers: [Greedy] }), options)).rejects.toThrow('ожидает 2');
    });

    it('нельзя экспортировать то, чего нет в providers', async () => {
      const Ghost = service('Ghost');
      await expect(NestFactory.create(mod('M', { exports: [Ghost] }), options)).rejects.toThrow('не объявляет его в providers');
    });

    it('Module() не принимает опечатки в полях', () => {
      expect(() => Module({ provider: [] })).toThrow('Неизвестное поле "provider"');
    });

    it('динамический модуль добавляет провайдеры (как forRoot в Nest)', async () => {
      const Base = mod('ConfigModule', {});
      const dynamic = { module: Base, providers: [{ provide: 'TOKEN', useValue: 7 }], exports: ['TOKEN'] };
      const User = service('User', ['TOKEN']);
      const app = await NestFactory.create(mod('AppModule', { imports: [dynamic], providers: [User] }), options);
      expect(app.get(User).args[0]).toBe(7);
    });
  });

  describe('жизненный цикл', () => {
    it('onModuleInit идёт от глубоких модулей к корню, потом onApplicationBootstrap', async () => {
      const order = [];
      const Deep = service('Deep', [], { onModuleInit() { order.push('deep:init'); }, onApplicationBootstrap() { order.push('deep:boot'); } });
      const Top = service('Top', [Deep], { onModuleInit() { order.push('top:init'); }, onApplicationBootstrap() { order.push('top:boot'); } });
      const DeepModule = mod('DeepModule', { providers: [Deep], exports: [Deep] });
      const app = await NestFactory.create(mod('AppModule', { imports: [DeepModule], providers: [Top] }), options);
      await app.listen();
      expect(order).toEqual(['deep:init', 'top:init', 'deep:boot', 'top:boot']);
    });

    it('хуки вызываются один раз, даже если экземпляр доступен под двумя токенами', async () => {
      const calls = fnCounter();
      const S = service('S', [], { onModuleInit: calls });
      const app = await NestFactory.create(mod('M', { providers: [S, { provide: 'ALIAS', useExisting: S }] }), options);
      await app.init();
      await app.init();
      expect(calls.count).toBe(1);
    });

    it('close() вызывает onModuleDestroy', async () => {
      const destroyed = fnCounter();
      const S = service('S', [], { onModuleDestroy: destroyed });
      const app = await NestFactory.create(mod('M', { providers: [S] }), options);
      await app.init();
      await app.close();
      expect(destroyed.count).toBe(1);
    });

    function fnCounter() {
      const f = function () { f.count++; };
      f.count = 0;
      return f;
    }
  });

  describe('контроллеры и действия', () => {
    it('Action регистрирует маршрут, dispatch вызывает метод контроллера', async () => {
      class MenuCtrl {
        constructor() { this.calls = []; }
        start(payload) { this.calls.push(payload.value); return 'ок'; }
      }
      decorate([Action('start')], MenuCtrl.prototype, 'start');
      const Ctrl = decorate([Controller('menu')], MenuCtrl);
      const app = await NestFactory.create(mod('M', { controllers: [Ctrl] }), options);
      await app.init();
      expect(app.dispatch('menu/start', { value: 5 })).toBe('ок');
      expect(app.get(Ctrl).calls).toEqual([5]);
      expect(() => app.dispatch('menu/nope')).toThrow('404');
    });

    it('два одинаковых маршрута — ошибка', async () => {
      class A { x() {} }
      class B { y() {} }
      decorate([Action('go')], A.prototype, 'x');
      decorate([Action('go')], B.prototype, 'y');
      const app = await NestFactory.create(mod('M', { controllers: [decorate([Controller('dup')], A), decorate([Controller('dup')], B)] }), options);
      await expect(app.init()).rejects.toThrow('уже зарегистрировано');
    });
  });

  describe('Test.createTestingModule', () => {
    it('overrideProvider подменяет зависимость', async () => {
      const Clock = service('Clock', [], { now() { return 'реальное время'; } });
      const Report = service('Report', [Clock]);
      const ReportModule = mod('ReportModule', { providers: [Clock, Report], exports: [Report] });
      const app = await Test.createTestingModule({ imports: [ReportModule] })
        .overrideProvider(Clock).useValue({ now: () => 'фейковое время' })
        .compile();
      expect(app.get(Report).args[0].now()).toBe('фейковое время');
    });
  });
});
