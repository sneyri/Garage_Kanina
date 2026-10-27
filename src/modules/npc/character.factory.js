/**
 * Персонажи из примитивов. Лицом в +Z, ноги на y = 0.
 * rig — «кости» для простой анимации (поворачиваем группы-шарниры).
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;

  class CharacterFactory {
    constructor(props, materials) {
      this.props = props;
      this.materials = materials;
    }

    joint(parent, x, y, z) {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, z);
      parent.add(pivot);
      return pivot;
    }

    /** Канин: чёрный пуховик, широкие штаны, белые кроссовки, респиратор и налобный фонарь с красным светом. */
    kanin() {
      const P = this.props, M = this.materials;
      const g = new THREE.Group();
      g.name = 'kanin';
      const rig = {};

      [['legL', 1], ['legR', -1]].forEach((leg) => {
        const hip = this.joint(g, leg[1] * 0.1, 0.9, 0);
        P.cyl(0.1, 0.095, 0.84, M.get('pants'), 0, -0.42, 0, hip, 8);
        P.box(0.13, 0.1, 0.29, M.get('sneaker'), 0, -0.86, 0.04, hip);
        rig[leg[0]] = hip;
      });

      const torso = this.joint(g, 0, 0.9, 0);
      rig.torso = torso;
      P.mesh(new THREE.CapsuleGeometry(0.21, 0.36, 4, 12), M.get('puffer'), 0, 0.33, 0, torso).scale.set(1.15, 1, 0.8);
      P.mesh(new THREE.TorusGeometry(0.1, 0.045, 6, 14), M.get('puffer'), 0, 0.66, 0, torso).rotation.x = Math.PI / 2;
      P.box(0.012, 0.55, 0.01, M.get('metalDark'), 0, 0.33, 0.17, torso);

      [['armL', 1], ['armR', -1]].forEach((arm) => {
        const s = arm[1];
        const shoulder = this.joint(torso, s * 0.28, 0.58, 0);
        P.mesh(new THREE.CapsuleGeometry(0.075, 0.42, 4, 8), M.get('puffer'), 0, -0.27, 0, shoulder);
        P.sphere(0.06, M.get('glove'), 0, -0.56, 0.01, shoulder);
        shoulder.rotation.z = s * 0.08;
        rig[arm[0]] = shoulder;
      });

      const head = this.joint(torso, 0, 0.72, 0);
      rig.head = head;
      P.sphere(0.115, M.get('skin'), 0, 0.12, 0, head, 14, 12);
      P.sphere(0.125, M.get('hair'), 0, 0.17, -0.02, head, 14, 10).scale.set(1, 0.75, 1.05);
      P.box(0.2, 0.05, 0.05, M.get('hair'), 0, 0.21, 0.08, head).rotation.x = 0.4;

      // респиратор с двумя фильтрами
      P.sphere(0.085, M.get('mask'), 0, 0.06, 0.075, head, 12, 10).scale.set(1, 0.75, 0.85);
      [-1, 1].forEach((s) => {
        const cartridge = P.cyl(0.048, 0.048, 0.04, M.get('cartridge'), s * 0.085, 0.05, 0.1, head, 14);
        cartridge.rotation.z = Math.PI / 2;
        cartridge.rotation.y = s * 0.6;
      });
      P.mesh(new THREE.TorusGeometry(0.12, 0.006, 4, 20), M.get('strap'), 0, 0.07, -0.01, head).rotation.x = Math.PI / 2;

      // налобный фонарь
      P.mesh(new THREE.TorusGeometry(0.122, 0.012, 6, 20), M.get('strap'), 0, 0.165, 0, head).rotation.x = Math.PI / 2;
      P.box(0.07, 0.045, 0.04, M.get('blackPlastic'), 0, 0.17, 0.125, head);
      const lens = P.mesh(new THREE.CircleGeometry(0.014, 12), M.get('redLens'), 0, 0.17, 0.146, head);
      lens.castShadow = false;
      const glow = P.glowSprite(0xff3018, 0.24, 0.95);
      glow.position.set(0, 0.17, 0.15);
      head.add(glow);
      const light = new THREE.SpotLight(0xff2a14, 1.3, 7, 0.55, 0.7, 1.6);
      light.position.set(0, 0.17, 0.15);
      light.target.position.set(0, -0.3, 3);
      head.add(light);
      head.add(light.target);
      rig.lamp = { light: light, glow: glow };

      return { group: g, rig: rig };
    }

    /** «Тип»: красная футболка, бледная кожа, светящиеся белые глаза, рот открыт в крике. */
    stalker() {
      const P = this.props, M = this.materials;
      const g = new THREE.Group();
      g.name = 'stalker';
      const rig = {};

      [1, -1].forEach((s) => {
        const hip = this.joint(g, s * 0.09, 0.92, 0);
        P.cyl(0.075, 0.07, 0.86, M.get('jeans'), 0, -0.43, 0, hip, 8);
        P.box(0.11, 0.08, 0.26, M.get('pants'), 0, -0.88, 0.04, hip);
      });

      const torso = this.joint(g, 0, 0.92, 0);
      rig.torso = torso;
      P.mesh(new THREE.CapsuleGeometry(0.18, 0.38, 4, 12), M.get('redShirt'), 0, 0.33, 0, torso).scale.set(1.05, 1, 0.7);

      [['armL', 1], ['armR', -1]].forEach((arm) => {
        const s = arm[1];
        const shoulder = this.joint(torso, s * 0.24, 0.6, 0);
        P.mesh(new THREE.CapsuleGeometry(0.07, 0.12, 4, 8), M.get('redShirt'), 0, -0.1, 0, shoulder);
        P.mesh(new THREE.CapsuleGeometry(0.048, 0.46, 4, 8), M.get('paleSkin'), 0, -0.44, 0, shoulder);
        P.sphere(0.05, M.get('paleSkin'), 0, -0.74, 0.01, shoulder);
        shoulder.rotation.z = s * 0.12;
        shoulder.rotation.x = -0.12;
        rig[arm[0]] = shoulder;
      });

      const head = this.joint(torso, 0, 0.74, 0.02);
      rig.head = head;
      P.sphere(0.12, M.get('paleSkin'), 0, 0.12, 0, head, 14, 12).scale.set(0.95, 1.1, 1);
      [[0, 0.24, -0.02, 0.08], [0.07, 0.21, -0.05, 0.07], [-0.07, 0.22, -0.04, 0.07], [0.05, 0.2, 0.06, 0.06], [-0.04, 0.19, 0.07, 0.06], [0, 0.16, -0.09, 0.08]]
        .forEach((h) => P.sphere(h[3], M.get('hair'), h[0], h[1], h[2], head, 8, 6));
      P.sphere(0.045, M.get('mouth'), 0, 0.05, 0.1, head, 10, 8).scale.set(0.9, 1.4, 0.5);

      rig.eyes = [];
      [-1, 1].forEach((s) => {
        P.sphere(0.017, M.get('eyes'), s * 0.04, 0.15, 0.105, head, 8, 6).castShadow = false;
        const glow = P.glowSprite(0xffffff, 0.2, 0.95);
        glow.material.fog = false;
        glow.position.set(s * 0.04, 0.15, 0.115);
        head.add(glow);
        rig.eyes.push(glow);
      });
      head.rotation.z = 0.3;
      head.rotation.x = 0.12;

      return { group: g, rig: rig };
    }
  }

  GK.CharacterFactory = decorate([Injectable(), Dependencies(GK.PropsFactory, GK.MaterialsService)], CharacterFactory);
})(window.GK);
