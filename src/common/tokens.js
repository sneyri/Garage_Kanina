/**
 * Строковые токены для провайдеров, которые не являются классами
 * (в Nest для этого пишут { provide: 'TOKEN', useValue } и @Inject('TOKEN')).
 */
(function (GK) {
  'use strict';

  GK.TOKENS = Object.freeze({
    WEB_STORAGE: 'WEB_STORAGE',
    DOCUMENT: 'DOCUMENT',
    DAYS_CONFIG: 'DAYS_CONFIG',
    ITEM_KINDS: 'ITEM_KINDS',
  });
})(window.GK);
