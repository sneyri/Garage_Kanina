/**
 * NestFactory и NestApplication — точка входа, как в @nestjs/core:
 *
 *   const app = await NestFactory.create(AppModule);
 *   await app.listen();
 *
 * В Nest listen() поднимает HTTP-сервер. Серверов у нас нет: listen() запускает
 * хуки жизненного цикла, а игровой цикл стартует в onApplicationBootstrap().
 */
(function (GK) {
  'use strict';

  const { NestContainer, DomRouter, tokenName } = GK.core;
  const { Logger } = GK.common;

  class NestApplication {
    constructor(container, options) {
      this.container = container;
      this.router = new DomRouter();
      this.options = options || {};
      this.isInitialized = false;
      this.logger = new Logger('NestApplication');
    }

    /** app.get(SomeService) — достать экземпляр из контейнера. */
    get(token) {
      return this.container.get(token);
    }

    async init() {
      if (this.isInitialized) return this;
      await this.container.callHook('onModuleInit');
      this.container.controllers().forEach((controller) => this.router.register(controller));
      if (this.options.bindDom !== false && typeof document !== 'undefined') this.router.bindDom(document);
      await this.container.callHook('onApplicationBootstrap');
      this.isInitialized = true;
      this.logger.log('Nest application successfully started');
      return this;
    }

    listen() {
      return this.init();
    }

    /** Вызвать действие контроллера из кода — удобно в тестах, как supertest в Nest. */
    dispatch(path, payload) {
      return this.router.dispatch(path, payload);
    }

    async close() {
      await this.container.callHook('onModuleDestroy');
      await this.container.callHook('beforeApplicationShutdown');
      await this.container.callHook('onApplicationShutdown');
      this.isInitialized = false;
    }
  }

  const NestFactory = {
    /**
     * @param rootModule корневой модуль (AppModule)
     * @param options { logger: false, bindDom: false, overrides: Map }
     */
    async create(rootModule, options) {
      options = options || {};
      if ('logger' in options) Logger.silent = options.logger === false;
      new Logger('NestFactory').log('Starting Nest application...');
      const container = new NestContainer(options.overrides);
      container.scan(rootModule);
      await container.createInstances();
      return new NestApplication(container, options);
    },
  };

  Object.assign(GK.core, { NestFactory, NestApplication, tokenName });
})(window.GK);
