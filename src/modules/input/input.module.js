(function (GK) {
  'use strict';

  const { Module, decorate } = GK.common;

  class InputModule {}

  GK.InputModule = decorate([
    Module({
      providers: [GK.InputService],
      exports: [GK.InputService],
    }),
  ], InputModule);
})(window.GK);
