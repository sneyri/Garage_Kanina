(function (GK) {
  'use strict';

  const { Module, decorate } = GK.common;

  class NpcModule {}

  GK.NpcModule = decorate([
    Module({
      imports: [GK.EngineModule, GK.WorldModule, GK.PlayerModule, GK.GameStateModule],
      providers: [GK.CharacterFactory, GK.DialogueService, GK.KaninService],
      exports: [GK.CharacterFactory, GK.DialogueService, GK.KaninService],
    }),
  ], NpcModule);
})(window.GK);
