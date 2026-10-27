/**
 * StorageModule. Браузерные объекты (localStorage, document) подаются через
 * токены — в тестах их подменяют фейками через overrideProvider().
 */
(function (GK) {
  'use strict';

  const { Module, decorate } = GK.common;
  const { TOKENS } = GK;

  class StorageModule {}

  GK.StorageModule = decorate([
    Module({
      providers: [
        {
          provide: TOKENS.WEB_STORAGE,
          useFactory: () => {
            try {
              return typeof window !== 'undefined' ? window.localStorage : null;
            } catch (err) {
              return null; // доступ к localStorage запрещён (SecurityError)
            }
          },
        },
        { provide: TOKENS.DOCUMENT, useFactory: () => (typeof document !== 'undefined' ? document : null) },
        GK.LocalStorageService,
        GK.CookieService,
        GK.MemoryStorageService,
        GK.StorageService,
        GK.SaveService,
      ],
      exports: [GK.StorageService, GK.SaveService],
    }),
  ], StorageModule);
})(window.GK);
