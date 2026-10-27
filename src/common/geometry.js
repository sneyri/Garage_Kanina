/** Помощники для геометрии three.js. THREE используется только внутри функций. */
(function (GK) {
  'use strict';

  function scaleUV(geometry, su, sv) {
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    uv.needsUpdate = true;
    return geometry;
  }

  /**
   * Коробка с UV «в метрах»: tile — сколько метров приходится на один повтор
   * текстуры, поэтому кирпич на длинной стене не растягивается.
   */
  function worldBox(w, h, d, tile) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const uv = geometry.attributes.uv;
    // Порядок граней BoxGeometry: +x, -x, +y, -y, +z, -z (по 4 вершины на грань).
    const sizes = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let face = 0; face < 6; face++) {
      for (let i = 0; i < 4; i++) {
        const idx = face * 4 + i;
        uv.setXY(idx, uv.getX(idx) * sizes[face][0] / tile, uv.getY(idx) * sizes[face][1] / tile);
      }
    }
    uv.needsUpdate = true;
    return geometry;
  }

  function worldPlane(w, h, tile) {
    return scaleUV(new THREE.PlaneGeometry(w, h), w / tile, h / tile);
  }

  function setShadows(object, cast, receive) {
    object.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = cast;
        o.receiveShadow = receive;
      }
    });
    return object;
  }

  GK.geo = { scaleUV, worldBox, worldPlane, setShadows };
})(window.GK);
