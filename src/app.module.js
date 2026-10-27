/**
 * Корневой модуль — как AppModule в NestJS. Отсюда контейнер начинает
 * обход дерева модулей и собирает всё приложение.
 */
(function (GK) {
  'use strict';

  const { Module, decorate } = GK.common;

  class AppModule {}

  GK.AppModule = decorate([
    Module({
      imports: [
        GK.SharedModule,
        GK.StorageModule,
        GK.SettingsModule,
        GK.GameStateModule,
        GK.InputModule,
        GK.AudioModule,
        GK.EngineModule,
        GK.WorldModule,
        GK.PlayerModule,
        GK.NpcModule,
        GK.DaysModule,
        GK.HorrorModule,
        GK.UiModule,
      ],
    }),
  ], AppModule);
})(window.GK);
