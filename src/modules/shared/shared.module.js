/** Глобальный модуль: EventBus доступен всем модулям без импорта. */
(function (GK) {
  'use strict';

  const { Module, Global, decorate } = GK.common;

  class SharedModule {}

  GK.SharedModule = decorate([
    Global(),
    Module({
      providers: [GK.EventBus],
      exports: [GK.EventBus],
    }),
  ], SharedModule);
})(window.GK);
