/**
 * Работа с cookie. Лимит одной cookie — около 4 КБ, поэтому сюда пишем
 * только компактные данные (настройки и номер дня).
 *
 * Важно: Chrome и Edge не сохраняют cookie у страниц, открытых через file://.
 * Тогда isAvailable() вернёт false, и игра просто будет жить на localStorage.
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;

  const YEAR = 60 * 60 * 24 * 365;
  const MAX_LENGTH = 3800;

  class CookieService {
    constructor(doc) {
      this.doc = doc;
      this.prefix = 'gk_';
    }

    isAvailable() {
      if (!this.doc) return false;
      try {
        if (typeof navigator !== 'undefined' && navigator.cookieEnabled === false) return false;
        const ok = this.write('probe', '1', 60);
        this.remove('probe');
        return ok;
      } catch (err) {
        return false;
      }
    }

    read(name) {
      const key = this.prefix + name + '=';
      const parts = String(this.doc.cookie || '').split(';');
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        if (part.indexOf(key) === 0) {
          try {
            return decodeURIComponent(part.slice(key.length));
          } catch (err) {
            return null;
          }
        }
      }
      return null;
    }

    write(name, value, maxAge) {
      const encoded = encodeURIComponent(value);
      if (encoded.length > MAX_LENGTH) return false;
      this.doc.cookie = this.prefix + name + '=' + encoded + '; max-age=' + (maxAge || YEAR) + '; path=/; SameSite=Lax';
      return this.read(name) === value;
    }

    remove(name) {
      this.doc.cookie = this.prefix + name + '=; max-age=0; path=/; SameSite=Lax';
    }
  }

  GK.CookieService = decorate([Injectable(), Dependencies(GK.TOKENS.DOCUMENT)], CookieService);
})(window.GK);
