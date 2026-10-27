/** Мелкая математика, которая нужна почти везде. */
(function (GK) {
  'use strict';

  const M = {
    clamp(v, min, max) { return v < min ? min : v > max ? max : v; },
    lerp(a, b, t) { return a + (b - a) * t; },
    /** Плавное приближение, не зависящее от FPS. */
    damp(a, b, lambda, dt) { return a + (b - a) * (1 - Math.exp(-lambda * dt)); },
    smoothstep(edge0, edge1, v) {
      const t = M.clamp((v - edge0) / (edge1 - edge0), 0, 1);
      return t * t * (3 - 2 * t);
    },
    rand(min, max) { return min + Math.random() * (max - min); },
    randInt(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); },
    pick(list) { return list[Math.floor(Math.random() * list.length)]; },
    chance(p) { return Math.random() < p; },
    wrapAngle(a) {
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return a;
    },
    dist2d(ax, az, bx, bz) { return Math.sqrt((ax - bx) * (ax - bx) + (az - bz) * (az - bz)); },
    /** Детерминированный генератор (mulberry32): текстуры одинаковые при каждом запуске. */
    rng(seed) {
      let a = seed >>> 0;
      return function () {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    /** Взвешенный случайный выбор: [{ weight }] → элемент. */
    weightedPick(list, random) {
      const total = list.reduce((sum, item) => sum + item.weight, 0);
      let r = (random || Math.random)() * total;
      for (const item of list) {
        r -= item.weight;
        if (r <= 0) return item;
      }
      return list[list.length - 1];
    },
    /** «мм:сс» из секунд. */
    formatTime(seconds) {
      const s = Math.max(0, Math.floor(seconds));
      return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    },
  };

  GK.math = M;
})(window.GK);
