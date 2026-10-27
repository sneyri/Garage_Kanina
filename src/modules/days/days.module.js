/**
 * DaysModule. Конфиг дней подаётся через токен DAYS_CONFIG — в тестах
 * его легко подменить своим набором дней через overrideProvider().
 */
(function (GK) {
  'use strict';

  const { Module, decorate } = GK.common;
  const { TOKENS } = GK;

  class DaysModule {}

  GK.DaysModule = decorate([
    Module({
      imports: [GK.StorageModule, GK.EngineModule, GK.WorldModule, GK.PlayerModule, GK.NpcModule,
        GK.AudioModule, GK.InputModule, GK.GameStateModule],
      providers: [
        { provide: TOKENS.DAYS_CONFIG, useValue: GK.DAYS },
        { provide: TOKENS.ITEM_KINDS, useValue: GK.ITEM_KINDS },
        GK.TasksService,
        GK.ItemsService,
        GK.DaysService,
      ],
      exports: [GK.TasksService, GK.ItemsService, GK.DaysService],
    }),
  ], DaysModule);
})(window.GK);
