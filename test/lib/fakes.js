/**
 * Подделки браузерных объектов: localStorage и document.cookie.
 * С ними сервисы хранилища тестируются одинаково в Node и в браузере.
 */
(function (root) {
  'use strict';

  class FakeStorage {
    constructor() {
      this.map = new Map();
      this.broken = false; // true — любая запись бросает исключение (как переполненный localStorage)
    }

    getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }

    setItem(key, value) {
      if (this.broken) throw new Error('QuotaExceededError');
      this.map.set(key, String(value));
    }

    removeItem(key) { this.map.delete(key); }
    clear() { this.map.clear(); }
  }

  /** Банка cookie: понимает name=value и max-age=0 (удаление). */
  class FakeDocument {
    constructor(options) {
      this.jar = new Map();
      this.disabled = !!(options && options.disabled); // как Chrome у file://: запись молча игнорируется
    }

    get cookie() {
      return Array.from(this.jar.entries()).map((e) => e[0] + '=' + e[1]).join('; ');
    }

    set cookie(raw) {
      if (this.disabled) return;
      const parts = String(raw).split(';').map((p) => p.trim());
      const eq = parts[0].indexOf('=');
      const name = parts[0].slice(0, eq), value = parts[0].slice(eq + 1);
      const maxAge = parts.find((p) => /^max-age=/i.test(p));
      if (maxAge && Number(maxAge.split('=')[1]) <= 0) this.jar.delete(name);
      else this.jar.set(name, value);
    }
  }

  /** Тестовый модуль хранилища с подменёнными localStorage и document. */
  function storageApp(local, doc, extraImports) {
    return root.GK.testing.Test.createTestingModule({
      imports: [root.GK.SharedModule, root.GK.StorageModule].concat(extraImports || []),
    })
      .overrideProvider(root.GK.TOKENS.WEB_STORAGE).useValue(local)
      .overrideProvider(root.GK.TOKENS.DOCUMENT).useValue(doc)
      .compile();
  }

  root.GKFakes = { FakeStorage, FakeDocument, storageApp };
})(window);
