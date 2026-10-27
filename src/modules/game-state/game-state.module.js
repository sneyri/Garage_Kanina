(function (GK) {
  'use strict';

  const { Module, decorate } = GK.common;

  class GameStateModule {}

  GK.GameStateModule = decorate([
    Module({
      providers: [GK.GameStateService],
      exports: [GK.GameStateService],
    }),
  ], GameStateModule);
})(window.GK);
