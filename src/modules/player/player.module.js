(function (GK) {
  'use strict';

  const { Module, decorate } = GK.common;

  class PlayerModule {}

  GK.PlayerModule = decorate([
    Module({
      imports: [GK.EngineModule, GK.WorldModule, GK.InputModule, GK.AudioModule, GK.SettingsModule, GK.GameStateModule],
      providers: [GK.PlayerService, GK.FlashlightService, GK.HandsService, GK.InteractionService],
      exports: [GK.PlayerService, GK.FlashlightService, GK.HandsService, GK.InteractionService],
    }),
  ], PlayerModule);
})(window.GK);
