(function (GK) {
  'use strict';

  const { Module, decorate } = GK.common;

  class SettingsModule {}

  GK.SettingsModule = decorate([
    Module({
      imports: [GK.StorageModule],
      providers: [GK.SettingsService],
      exports: [GK.SettingsService],
    }),
  ], SettingsModule);
})(window.GK);
