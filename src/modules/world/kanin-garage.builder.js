/**
 * Гараж Канина: стены, открытые ворота, смотровая яма под досками с питбайком,
 * стеллаж, верстак, тумба с LED-панелью и свечой, лампочка на проводе, щиток,
 * мешки с цементом, шины, куртка на гвозде и люк в подвал.
 *
 * Координаты внутри: u — вглубь от ворот (0…6.5), v — поперёк (−2…2).
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;
  const { rng } = GK.math;

  class KaninGarageBuilder {
    constructor(materials, props, colliders) {
      this.materials = materials;
      this.props = props;
      this.colliders = colliders;
    }

    build(scene) {
      const G = GK.LAYOUT.garage;
      const root = new THREE.Group();
      root.name = 'kanin-garage';
      scene.add(root);

      const W = (u, y, v) => new THREE.Vector3(G.originX + u, y, G.originZ + v);
      const put = (obj, u, y, v, rotY) => {
        obj.position.copy(W(u, y, v));
        if (rotY) obj.rotation.y = rotY;
        root.add(obj);
        return obj;
      };
      const collide = (u0, u1, v0, v1, tag) => this.colliders.add(G.originX + u0, G.originX + u1, G.originZ + v0, G.originZ + v1, tag || 'garage');
      const out = { root: root, targets: {}, toWorld: W };
      const ctx = { root: root, out: out, W: W, put: put, collide: collide, r: rng(77) };

      this.shell(ctx);
      this.floorAndPit(ctx);
      this.storage(ctx);
      this.corner(ctx);
      this.walls(ctx);
      this.bike(ctx);
      this.lights(ctx);
      this.clutter(ctx);
      return out;
    }

    shell(ctx) {
      const G = GK.LAYOUT.garage, M = this.materials, P = this.props;
      const x0 = 4, x1 = 11, z0 = -9, z1 = -4.5, H = 2.95, t = 0.25;
      const wall = (minX, maxX, minZ, maxZ, minY, maxY, solid) => {
        P.mesh(GK.geo.worldBox(maxX - minX, maxY - minY, maxZ - minZ, 1), M.get('brick'), (minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2, ctx.root);
        if (solid) this.colliders.add(minX, maxX, minZ, maxZ, 'garage');
      };
      wall(x1 - t, x1, z0, z1, 0, H, true);
      wall(x0, x1, z0, z0 + t, 0, H, true);
      wall(x0, x1, z1 - t, z1, 0, H, true);
      wall(x0, x0 + t, z0 + t, G.doorMinZ, 0, H, true);
      wall(x0, x0 + t, G.doorMaxZ, z1 - t, 0, H, true);
      wall(x0, x0 + t, G.doorMinZ, G.doorMaxZ, 2.25, H, false);

      P.mesh(GK.geo.worldBox(x1 - x0, 0.06, z1 - z0, 2), M.get('ceiling'), (x0 + x1) / 2, G.height + 0.03, (z0 + z1) / 2, ctx.root);
      P.mesh(GK.geo.worldBox(x1 - x0 + 0.35, 0.12, z1 - z0 + 0.02, 2), M.get('roofing'), (x0 - 0.35 + x1) / 2, H + 0.06, (z0 + z1) / 2, ctx.root);
      P.box(x1 - x0 + 0.3, 0.16, z1 - z0 - 0.04, M.get('snowCap'), (x0 - 0.3 + x1) / 2, H + 0.2, (z0 + z1) / 2, ctx.root);
      [1.0, 2.4, 3.8, 5.2].forEach((u) => P.box(0.1, 0.12, 4.0, M.get('woodDark'), G.originX + u, G.height - 0.06, G.originZ, ctx.root));

      // Ворота: две створки распахнуты наружу
      const doorMat = M.door('#3e4a3c', GK.LAYOUT.kanin.number, 99);
      const leaf = (hingeZ, dir, angle) => {
        const pivot = new THREE.Group();
        pivot.position.set(x0 - 0.02, 0, hingeZ);
        pivot.rotation.y = angle;
        ctx.root.add(pivot);
        const mesh = P.box(0.04, 2.2, 1.3, doorMat, 0, 1.1, dir * 0.65, pivot);
        pivot.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(mesh);
        this.colliders.add(box.min.x, box.max.x, box.min.z, box.max.z, 'door');
        return mesh;
      };
      ctx.out.door = { objects: [leaf(G.doorMinZ, 1, -1.75), leaf(G.doorMaxZ, -1, 1.3)] };
      P.box(0.06, 0.08, 2.7, M.get('metalDark'), x0 - 0.03, 2.24, G.originZ, ctx.root);

      // снег, наметённый в ворота
      const drift = P.sphere(1, M.get('snowCap'), G.originX + 0.15, 0, G.originZ + 0.2, ctx.root, 12, 8);
      drift.scale.set(0.45, 0.07, 1.1);
      drift.castShadow = false;
      const pile = P.sphere(1, M.get('snowCap'), x0 - 0.5, 0, z1 - 0.5, ctx.root, 12, 8);
      pile.scale.set(0.5, 0.35, 0.6);
      pile.castShadow = false;
    }

    floorAndPit(ctx) {
      const G = GK.LAYOUT.garage, M = this.materials, P = this.props, pit = G.pit, W = ctx.W;
      const piece = (u0, u1, v0, v1) => {
        const m = P.mesh(GK.geo.worldPlane(u1 - u0, v1 - v0, 2), M.get('concrete'), 0, 0, 0, ctx.root);
        m.rotation.x = -Math.PI / 2;
        m.position.copy(W((u0 + u1) / 2, 0.012, (v0 + v1) / 2));
        m.castShadow = false;
      };
      piece(-0.25, pit.minU, -2, 2);
      piece(pit.maxU, 6.5, -2, 2);
      piece(pit.minU, pit.maxU, -2, pit.minV);
      piece(pit.minU, pit.maxU, pit.maxV, 2);

      // Яма: чёрная «бездна» под щелями между досками
      const hole = P.mesh(new THREE.PlaneGeometry(pit.maxU - pit.minU, pit.maxV - pit.minV), M.get('pit'), 0, 0, 0, ctx.root);
      hole.rotation.x = -Math.PI / 2;
      hole.position.copy(W((pit.minU + pit.maxU) / 2, 0.014, 0));
      [-1, 1].forEach((s) => P.box(pit.maxU - pit.minU + 0.2, 0.05, 0.1, M.get('woodDark'), G.originX + (pit.minU + pit.maxU) / 2, 0.025, G.originZ + s * (pit.maxV + 0.05), ctx.root));
      const plankMats = [0x5b4331, 0x4e3828, 0x66503a].map((c, i) => M.custom('plank' + i, () => M.std({ color: c, roughness: 0.9 })));
      let i = 0;
      for (let u = pit.minU + 0.1; u < pit.maxU - 0.05; u += 0.2) {
        const plank = P.box(0.18, 0.035, 1.08, plankMats[i++ % 3], G.originX + u, 0.0675, G.originZ + (ctx.r() - 0.5) * 0.04, ctx.root);
        plank.rotation.y = (ctx.r() - 0.5) * 0.04;
      }
    }

    storage(ctx) {
      const M = this.materials, P = this.props, W = ctx.W;
      // Стеллаж у задней стены
      ctx.put(P.shelf(1.8, 2.0, 0.45, [0.08, 0.58, 1.08, 1.58]), 6.24, 0, -1.05, -Math.PI / 2);
      ctx.collide(6.0, 6.5, -1.98, -0.12);
      ctx.out.targets['shelf-canisters'] = {
        label: 'Стеллаж, нижняя полка', verb: 'Поставить',
        proxy: P.proxy(0.5, 0.45, 1.8, W(6.22, 0.3, -1.05).x, 0.3, W(0, 0, -1.05).z, ctx.root),
        slots: [-1.6, -1.05, -0.5].map((v) => ({ position: W(6.2, 0.095, v), rotY: -Math.PI / 2 })),
      };
      ctx.out.targets['shelf-oil'] = {
        label: 'Стеллаж, полка для масла', verb: 'Поставить',
        proxy: P.proxy(0.5, 0.42, 1.8, W(6.22, 0, 0).x, 0.8, W(0, 0, -1.05).z, ctx.root),
        slots: [-1.7, -1.3, -0.9, -0.5].map((v) => ({ position: W(6.18, 0.595, v), rotY: -Math.PI / 2 })),
      };
      // хлам на верхних полках
      ctx.put(P.paintCan(0x4a6a8a), 6.2, 1.095, -1.85);
      ctx.put(P.paintCan(0x8a3a2a), 6.25, 1.095, -0.85);
      ctx.put(P.paintCan(0xb0a890), 6.15, 1.095, -0.5);
      ctx.put(P.cardboardBox(0.4, 0.3, 0.35), 6.24, 1.595, -1.6, 0.1);
      ctx.put(P.cardboardBox(0.35, 0.22, 0.3), 6.24, 1.595, -0.7, -0.15);

      // Верстак
      ctx.put(P.workbench(), 6.17, 0, 1.1, -Math.PI / 2);
      ctx.collide(5.84, 6.5, 0.22, 1.98);
    }

    corner(ctx) {
      const M = this.materials, P = this.props, W = ctx.W;
      // Тумба с LED-панелью и свечой (как на фото)
      ctx.put(P.cabinet(), 5.05, 0, -1.77);
      ctx.collide(4.63, 5.47, -2.0, -1.55);
      const led = P.ledPanel();
      ctx.put(led.group, 4.85, 1.0, -1.82, -0.84);
      ctx.out.ledParts = led;
      const candle = P.candle();
      ctx.put(candle.group, 5.32, 1.0, -1.7);
      ctx.out.candle = candle;
      [4.78, 4.96].forEach((u) => ctx.put(P.box(0.08, 0.08, 0.03, M.get('whitePlastic'), 0, 0, 0), u, 1.45, -1.985));
      P.tube([W(4.78, 1.42, -1.97), W(4.7, 1.2, -1.95), W(4.62, 1.0, -1.6)].map((p) => [p.x, p.y, p.z]), 0.006, M.get('cable'), ctx.root, 12);

      // Люк в подвал
      ctx.put(P.hatch(), 4.7, 0.012, -0.95);
      ctx.out.hatch = { proxy: P.proxy(0.75, 0.2, 0.75, W(4.7, 0, 0).x, 0.08, W(0, 0, -0.95).z, ctx.root), position: W(4.7, -0.4, -0.95) };
    }

    walls(ctx) {
      const M = this.materials, P = this.props, W = ctx.W;
      // Щиток с рубильником у входа
      const panel = P.electricPanel();
      ctx.put(panel.group, 1.7, 1.5, -1.93);
      ctx.out.panel = { lever: panel.lever, proxy: P.proxy(0.5, 0.6, 0.3, W(1.75, 0, 0).x, 1.5, W(0, 0, -1.88).z, ctx.root) };
      // Провод от щитка по потолку к лампочке и дальше — провисает, как на фото
      P.tube([[1.6, 1.73, -1.96], [1.6, 2.62, -1.96], [2.2, 2.5, -1.0], [2.7, 2.6, 0.2], [3.0, 2.66, 0.7], [4.5, 2.52, 1.2], [6.3, 2.64, 1.9]]
        .map((p) => { const w = W(p[0], p[1], p[2]); return [w.x, w.y, w.z]; }), 0.009, M.get('cable'), ctx.root, 60);

      // Мешки с цементом
      for (let i = 0; i < 4; i++) {
        const bag = P.cementBag();
        ctx.put(bag, 0.75 + (ctx.r() - 0.5) * 0.06, i * 0.13, -1.72, (ctx.r() - 0.5) * 0.2);
      }
      ctx.collide(0.42, 1.08, -1.98, -1.5);

      // Шины
      for (let i = 0; i < 3; i++) {
        const tire = P.tire();
        tire.position.copy(W(3.6 + (ctx.r() - 0.5) * 0.06, 0.1 + i * 0.2, -1.62));
        ctx.root.add(tire);
      }
      ctx.collide(3.3, 3.9, -1.95, -1.3);

      // Правая стена: перфорированная доска с инструментом, куртка на гвозде, коробки
      ctx.put(P.toolboard(), 2.9, 1.55, 1.98, Math.PI);
      ctx.put(P.jacketOnHook(), 0.85, 1.95, 1.9, Math.PI);
      ctx.put(P.cardboardBox(0.5, 0.35, 0.45), 4.45, 0, 1.72, 0.05);
      ctx.put(P.cardboardBox(0.4, 0.3, 0.35), 4.42, 0.35, 1.74, -0.2);
      ctx.collide(4.18, 4.72, 1.47, 1.98);
    }

    bike(ctx) {
      const bike = this.props.pitbike();
      ctx.put(bike.group, 3.3, 0.085, 0.0, Math.PI);
      ctx.collide(2.35, 4.25, -0.36, 0.36, 'bike');
      ctx.out.bike = bike;
      ctx.out.targets['bike-tank'] = { label: 'Бак питбайка', proxy: bike.proxies.tank };
      ctx.out.targets['bike-clutch'] = { label: 'Ручка сцепления', proxy: bike.proxies.clutch };
      ctx.out.targets['bike-wheel'] = { label: 'Заднее колесо', proxy: bike.proxies.wheel };
    }

    lights(ctx) {
      const G = GK.LAYOUT.garage, P = this.props, W = ctx.W;
      const bulb = P.bulbOnCord(0.5);
      ctx.put(bulb.group, 3.0, G.height - 0.02, 0.7);
      const light = new THREE.PointLight(0xff9448, 0.62, 6.5, 2);
      light.position.set(0, bulb.bulbY, 0);
      bulb.group.add(light);
      ctx.out.bulb = { group: bulb.group, light: light, mat: bulb.bulbMat, glow: bulb.glow, base: 0.62, position: W(3.0, G.height - 0.6, 0.7) };

      const spot = new THREE.SpotLight(0xffefd6, 0, 10, 1.05, 0.7, 1.5);
      spot.position.copy(W(4.82, 1.35, -1.72));
      spot.target.position.copy(W(2.4, 0.2, 0.6));
      ctx.root.add(spot);
      ctx.root.add(spot.target);
      const led = ctx.out.ledParts;
      ctx.out.led = {
        light: spot, faceMat: led.faceMat, on: false, base: 1.7,
        proxy: P.proxy(0.45, 0.42, 0.4, W(4.85, 0, 0).x, 1.28, W(0, 0, -1.8).z, ctx.root),
      };
    }

    clutter(ctx) {
      const M = this.materials, P = this.props, W = ctx.W;
      [[0.3, -1.2], [0.42, -1.05]].forEach((p) => ctx.put(P.bottle(), p[0], 0.012, p[1]));
      const lying = P.bottle();
      lying.rotation.z = Math.PI / 2;
      lying.position.copy(W(0.55, 0.05, -0.85));
      ctx.root.add(lying);
      // удлинитель от розетки к верстаку
      P.tube([[4.96, 1.42, -1.97], [4.98, 0.03, -1.97], [5.5, 0.02, -1.4], [5.7, 0.02, -0.3], [5.82, 0.02, 0.3], [5.86, 0.5, 0.3], [5.88, 0.92, 0.32]]
        .map((p) => { const w = W(p[0], p[1], p[2]); return [w.x, w.y, w.z]; }), 0.008, M.get('cordOrange'), ctx.root, 40);
    }
  }

  GK.KaninGarageBuilder = decorate([
    Injectable(),
    Dependencies(GK.MaterialsService, GK.PropsFactory, GK.CollidersService),
  ], KaninGarageBuilder);
})(window.GK);
