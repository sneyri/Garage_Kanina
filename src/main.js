/**
 * Точка входа — как main.ts в NestJS:
 *
 *   async function bootstrap() {
 *     const app = await NestFactory.create(AppModule);
 *     await app.listen(3000);
 *   }
 */
(function (GK) {
  'use strict';

  function fail(message) {
    const box = document.getElementById('error');
    document.getElementById('error-text').textContent = message;
    box.classList.add('is-open');
  }

  async function bootstrap() {
    if (typeof THREE === 'undefined') {
      fail('Не загрузилась библиотека three.js (vendor/three.min.js). Проверь, что папка vendor на месте.');
      return;
    }
    const app = await GK.core.NestFactory.create(GK.AppModule);
    await app.listen();
    // Для отладки из консоли: app.get(GK.DaysService), app.dispatch('debug/skip-day') и т.д.
    window.app = app;
  }

  bootstrap().catch((err) => {
    console.error(err);
    fail(err.message);
  });
})(window.GK);
