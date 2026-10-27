/**
 * Аналог Logger из @nestjs/common: один формат логов с контекстом.
 *   [GK] 21:40:12  LOG   [InstanceLoader] StorageModule dependencies initialized
 */
(function (GK) {
  'use strict';

  class Logger {
    constructor(context) {
      this.context = context || 'App';
    }

    log(message, context) { Logger.print('LOG', message, context || this.context); }
    warn(message, context) { Logger.print('WARN', message, context || this.context); }
    error(message, context) { Logger.print('ERROR', message, context || this.context); }

    debug(message, context) {
      if (Logger.level === 'debug') Logger.print('DEBUG', message, context || this.context);
    }

    static print(level, message, context) {
      if (Logger.silent && level !== 'ERROR') return;
      const time = new Date().toTimeString().slice(0, 8);
      const line = '[GK] ' + time + '  ' + (level + '     ').slice(0, 5) + ' [' + context + '] ' + message;
      const method = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log';
      console[method](line);
    }
  }

  Logger.silent = false;
  Logger.level = 'log';

  GK.common.Logger = Logger;
})(window.GK);
