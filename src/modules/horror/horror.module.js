(function (GK) {
  'use strict';

  const { Module, decorate } = GK.common;

  class HorrorModule {}

  GK.HorrorModule = decorate([
    Module({
      imports: [GK.EngineModule, GK.WorldModule, GK.PlayerModule, GK.NpcModule, GK.AudioModule,
        GK.InputModule, GK.GameStateModule, GK.DaysModule],
      providers: [GK.StalkerService, GK.PhoneCallService, GK.ScareDirectorService],
      exports: [GK.StalkerService, GK.PhoneCallService, GK.ScareDirectorService],
    }),
  ], HorrorModule);
})(window.GK);
