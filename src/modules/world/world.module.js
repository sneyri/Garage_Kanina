(function (GK) {
  'use strict';

  const { Module, decorate } = GK.common;

  class WorldModule {}

  GK.WorldModule = decorate([
    Module({
      imports: [GK.EngineModule, GK.SettingsModule],
      providers: [
        GK.TexturesService,
        GK.MaterialsService,
        GK.CollidersService,
        GK.PropsFactory,
        GK.GarageRowBuilder,
        GK.KaninGarageBuilder,
        GK.SnowService,
        GK.WorldService,
        GK.CinematicService,
      ],
      exports: [GK.WorldService, GK.CollidersService, GK.PropsFactory, GK.MaterialsService, GK.TexturesService],
    }),
  ], WorldModule);
})(window.GK);
