/**
 * Раскладка локации в метрах. Y — вверх, проезд между рядами гаражей идёт вдоль оси Z.
 *
 *            z = -27 (забор, тупик)
 *     левый ряд  |  проезд  |  правый ряд
 *    x: -11..-4  |  -4..4   |  4..11
 *                |          |  [гараж Канина: z -9..-4.5]
 *   [проулок с баком: z -4.5..0]
 *            z = +27 (ворота, отсюда приходим)
 *
 * Внутри гаража Канина удобнее своя система координат:
 *   u — вглубь от ворот (0…6.5), v — поперёк (−2…2, плюс — справа от входа).
 */
(function (GK) {
  'use strict';

  const garage = Object.freeze({
    minX: 4.25, maxX: 10.75, minZ: -8.75, maxZ: -4.75, height: 2.7,
    doorMinZ: -8.05, doorMaxZ: -5.45, originX: 4.25, originZ: -6.75,
    pit: Object.freeze({ minU: 1.3, maxU: 5.3, minV: -0.45, maxV: 0.45 }),
  });

  GK.LAYOUT = Object.freeze({
    lane: Object.freeze({ halfWidth: 4, minZ: -27, maxZ: 27 }),
    row: Object.freeze({ depth: 7, height: 2.8, garageWidth: 4.5, count: 12, startZ: -27 }),
    kanin: Object.freeze({ side: 'right', index: 4, number: '13' }),
    alley: Object.freeze({ side: 'left', index: 5, endX: -11.2 }),
    garage: garage,
    spawn: Object.freeze({ x: 0, z: 23.5, yaw: 0 }),
    menuCamera: Object.freeze({ x: -2.4, y: 1.5, z: -3.0, lookX: 3.8, lookY: 1.3, lookZ: -10.8 }),
    /** Цели заданий, которые обязан создать мир (проверяется тестами). */
    targetIds: Object.freeze(['shelf-canisters', 'shelf-oil', 'dumpster', 'bike-tank', 'bike-clutch', 'bike-wheel']),
    slots: Object.freeze({ 'shelf-canisters': 3, 'shelf-oil': 4 }),
  });

  /** Координаты гаража (u, v) → мировые (x, z). */
  GK.garageToWorld = function (u, v) {
    return { x: garage.originX + u, z: garage.originZ + v };
  };

  GK.isInsideGarage = function (x, z) {
    return x > garage.minX - 0.1 && x < garage.maxX && z > garage.minZ && z < garage.maxZ;
  };

  GK.isOnPitBoards = function (x, z) {
    const u = x - garage.originX, v = z - garage.originZ;
    return u > garage.pit.minU && u < garage.pit.maxU && v > garage.pit.minV - 0.05 && v < garage.pit.maxV + 0.05;
  };
})(window.GK);
