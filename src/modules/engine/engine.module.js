(function (GK) {
  'use strict';

  const { Module, decorate } = GK.common;

  class EngineModule {}

  GK.EngineModule = decorate([
    Module({
      imports: [GK.SettingsModule, GK.InputModule, GK.GameStateModule],
      providers: [GK.RendererService, GK.LoopService],
      exports: [GK.RendererService, GK.LoopService],
    }),
  ], EngineModule);
})(window.GK);
