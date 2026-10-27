(function (GK) {
  'use strict';

  const { Module, decorate } = GK.common;

  class UiModule {}

  GK.UiModule = decorate([
    Module({
      imports: [GK.GameStateModule, GK.StorageModule, GK.SettingsModule, GK.InputModule, GK.AudioModule,
        GK.EngineModule, GK.PlayerModule, GK.DaysModule, GK.HorrorModule],
      controllers: [
        GK.MenuController,
        GK.SettingsController,
        GK.PauseController,
        GK.CardController,
        GK.HudController,
        GK.DebugController,
      ],
    }),
  ], UiModule);
})(window.GK);
