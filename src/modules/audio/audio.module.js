(function (GK) {
  'use strict';

  const { Module, decorate } = GK.common;

  class AudioModule {}

  GK.AudioModule = decorate([
    Module({
      imports: [GK.SettingsModule, GK.GameStateModule],
      providers: [GK.AudioService, GK.SfxService, GK.MusicService],
      exports: [GK.AudioService, GK.SfxService, GK.MusicService],
    }),
  ], AudioModule);
})(window.GK);
