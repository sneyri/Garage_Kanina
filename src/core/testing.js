/**
 * Аналог @nestjs/testing:
 *
 *   const app = await Test.createTestingModule({ imports: [StorageModule] })
 *     .overrideProvider(TOKENS.WEB_STORAGE).useValue(fakeStorage)
 *     .compile();
 *   const save = app.get(SaveService);
 */
(function (GK) {
  'use strict';

  const { Module, decorate } = GK.common;
  const { NestFactory } = GK.core;

  class TestingModuleBuilder {
    constructor(metadata) {
      this.metadata = metadata;
      this.overrides = new Map();
    }

    overrideProvider(token) {
      const builder = this;
      return {
        useValue(value) { builder.overrides.set(token, { useValue: value }); return builder; },
        useClass(cls) { builder.overrides.set(token, { useClass: cls }); return builder; },
        useFactory(options) { builder.overrides.set(token, { useFactory: options.factory, inject: options.inject || [] }); return builder; },
      };
    }

    async compile() {
      const TestingRoot = decorate([Module(this.metadata)], class TestingModule {});
      const app = await NestFactory.create(TestingRoot, { logger: false, bindDom: false, overrides: this.overrides });
      await app.init();
      return app;
    }
  }

  GK.testing = {
    Test: {
      createTestingModule(metadata) {
        return new TestingModuleBuilder(metadata);
      },
    },
  };
})(window.GK);
