/**
 * Простая физика столкновений на плоскости XZ: стены и предметы — это
 * прямоугольники (AABB), игрок — круг. Без THREE, поэтому легко тестируется.
 */
(function (GK) {
  'use strict';

  const { Injectable, decorate } = GK.common;
  const { clamp } = GK.math;

  class CollidersService {
    constructor() {
      this.boxes = [];
    }

    add(minX, maxX, minZ, maxZ, tag) {
      const box = {
        minX: Math.min(minX, maxX), maxX: Math.max(minX, maxX),
        minZ: Math.min(minZ, maxZ), maxZ: Math.max(minZ, maxZ),
        tag: tag || 'static',
      };
      this.boxes.push(box);
      return box;
    }

    /** Прямоугольник по центру и размерам. */
    addCentered(x, z, w, d, tag) {
      return this.add(x - w / 2, x + w / 2, z - d / 2, z + d / 2, tag);
    }

    removeTag(tag) {
      this.boxes = this.boxes.filter((b) => b.tag !== tag);
    }

    clear() {
      this.boxes = [];
    }

    /** Выталкивает круг радиуса r из всех прямоугольников. Возвращает новую позицию. */
    resolve(x, z, r) {
      for (let iteration = 0; iteration < 4; iteration++) {
        let moved = false;
        for (let i = 0; i < this.boxes.length; i++) {
          const b = this.boxes[i];
          const cx = clamp(x, b.minX, b.maxX), cz = clamp(z, b.minZ, b.maxZ);
          const dx = x - cx, dz = z - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 >= r * r) continue;
          if (d2 > 1e-10) {
            const d = Math.sqrt(d2), push = (r - d) / d;
            x += dx * push;
            z += dz * push;
          } else {
            // Центр внутри прямоугольника — выталкиваем по кратчайшей оси
            const left = x - b.minX, right = b.maxX - x, back = z - b.minZ, front = b.maxZ - z;
            const m = Math.min(left, right, back, front);
            if (m === left) x = b.minX - r;
            else if (m === right) x = b.maxX + r;
            else if (m === back) z = b.minZ - r;
            else z = b.maxZ + r;
          }
          moved = true;
        }
        if (!moved) break;
      }
      return { x: x, z: z };
    }

    isFree(x, z, r) {
      return this.boxes.every((b) => {
        const dx = x - clamp(x, b.minX, b.maxX), dz = z - clamp(z, b.minZ, b.maxZ);
        return dx * dx + dz * dz >= r * r;
      });
    }

    /** Пересекает ли отрезок хоть один прямоугольник (проверка прямой видимости). */
    segmentBlocked(x1, z1, x2, z2, ignoreTag) {
      const dx = x2 - x1, dz = z2 - z1;
      for (let i = 0; i < this.boxes.length; i++) {
        const b = this.boxes[i];
        if (ignoreTag && b.tag === ignoreTag) continue;
        let tMin = 0, tMax = 1;
        const axes = [[dx, x1, b.minX, b.maxX], [dz, z1, b.minZ, b.maxZ]];
        let hit = true;
        for (let a = 0; a < 2; a++) {
          const d = axes[a][0], o = axes[a][1], lo = axes[a][2], hi = axes[a][3];
          if (Math.abs(d) < 1e-9) {
            if (o < lo || o > hi) { hit = false; break; }
          } else {
            let t1 = (lo - o) / d, t2 = (hi - o) / d;
            if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
            tMin = Math.max(tMin, t1);
            tMax = Math.min(tMax, t2);
            if (tMin > tMax) { hit = false; break; }
          }
        }
        if (hit) return true;
      }
      return false;
    }
  }

  GK.CollidersService = decorate([Injectable()], CollidersService);
})(window.GK);
