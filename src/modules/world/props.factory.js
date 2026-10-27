/**
 * Фабрика предметов: всё собирается из примитивов three.js.
 * Позже любую модель можно заменить на сделанную в Blender, не трогая остальной код.
 *
 * Соглашение: у предметов «перед» смотрит в +Z, у питбайка — вперёд по +X
 * (правая сторона седока — +Z).
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;
  const { rng } = GK.math;

  class PropsFactory {
    constructor(materials, textures) {
      this.materials = materials;
      this.textures = textures;
    }

    // ---------- примитивы ----------

    mesh(geometry, material, x, y, z, parent) {
      const m = new THREE.Mesh(geometry, material);
      m.position.set(x || 0, y || 0, z || 0);
      m.castShadow = true;
      m.receiveShadow = true;
      if (parent) parent.add(m);
      return m;
    }

    box(w, h, d, material, x, y, z, parent) {
      return this.mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z, parent);
    }

    cyl(rTop, rBottom, h, material, x, y, z, parent, segments) {
      return this.mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments || 12), material, x, y, z, parent);
    }

    sphere(r, material, x, y, z, parent, ws, hs) {
      return this.mesh(new THREE.SphereGeometry(r, ws || 12, hs || 8), material, x, y, z, parent);
    }

    /** Цилиндр между двумя точками [x, y, z]. */
    rod(from, to, radius, material, parent, segments) {
      const a = new THREE.Vector3(from[0], from[1], from[2]);
      const b = new THREE.Vector3(to[0], to[1], to[2]);
      const dir = b.clone().sub(a);
      const m = this.cyl(radius, radius, dir.length(), material, 0, 0, 0, parent, segments || 8);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      return m;
    }

    /** Гибкая трубка (провод, шланг) по точкам. */
    tube(points, radius, material, parent, segments) {
      const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
      const m = this.mesh(new THREE.TubeGeometry(curve, segments || 32, radius, 6, false), material, 0, 0, 0, parent);
      m.castShadow = false;
      return m;
    }

    /** Невидимая коробка, по которой «целится» взаимодействие. */
    proxy(w, h, d, x, y, z, parent) {
      if (!this.proxyMaterial) this.proxyMaterial = new THREE.MeshBasicMaterial({ visible: false });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.proxyMaterial);
      m.position.set(x, y, z);
      m.userData.isProxy = true;
      if (parent) parent.add(m);
      return m;
    }

    glowSprite(color, size, opacity) {
      const material = new THREE.SpriteMaterial({
        map: this.textures.glow(), color: color, transparent: true, opacity: opacity == null ? 1 : opacity,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(size, size, 1);
      return sprite;
    }

    // ---------- предметы для заданий ----------

    item(kind, variant) {
      switch (kind) {
        case 'rag': return this.rag();
        case 'canister': return this.canister(variant || 'green');
        case 'fuel': return this.canister('red');
        case 'oil': return this.oilBottle(variant || 'blue');
        case 'trash': return this.trashBag(variant);
        case 'clutch': return this.labelBox(0.32, 0.08, 0.12, 'ТРОС\nСЦЕПЛЕНИЯ', '#8a6a45', '#1d140b');
        case 'patch': return this.labelBox(0.15, 0.05, 0.09, 'РЕМ-\nКОМПЛЕКТ', '#9b1d14', '#f0e6d0');
        case 'pump': return this.pump();
        default: throw new Error('Неизвестный предмет: ' + kind);
      }
    }

    canister(variant) {
      const M = this.materials;
      const colors = { green: 0x2f4a2a, red: 0x8a1c12, gray: 0x50565b };
      const mat = M.custom('canister:' + variant, () => M.std({ color: colors[variant] || colors.green, roughness: 0.5, metalness: 0.35 }));
      const g = new THREE.Group();
      g.name = 'canister';
      this.box(0.15, 0.36, 0.27, mat, 0, 0.18, 0, g);
      this.box(0.155, 0.02, 0.2, mat, 0, 0.22, 0, g);
      [-0.07, 0, 0.07].forEach((z) => this.box(0.03, 0.04, 0.025, mat, 0, 0.38, z, g));
      this.box(0.03, 0.02, 0.17, mat, 0, 0.405, 0, g);
      this.cyl(0.024, 0.024, 0.05, M.get('metalDark'), 0, 0.385, 0.11, g);
      return g;
    }

    oilBottle(variant) {
      const M = this.materials;
      const colors = { blue: '#1d4d8f', gold: '#b8821a', black: '#1c1c1c', red: '#7d1a1a' };
      const color = colors[variant] || colors.blue;
      const body = M.custom('oil:' + variant, () => M.std({ color: color, roughness: 0.35 }));
      const label = M.label('МАСЛО\n10W-40', color, '#f2eadb', { roughness: 0.4 });
      const g = new THREE.Group();
      g.name = 'oil';
      this.box(0.17, 0.25, 0.09, body, 0, 0.125, 0, g);
      const tag = this.mesh(new THREE.PlaneGeometry(0.15, 0.12), label, 0, 0.12, 0.0455, g);
      tag.castShadow = false;
      this.cyl(0.024, 0.024, 0.04, body, 0.045, 0.27, 0, g);
      this.cyl(0.027, 0.027, 0.025, M.get('blackPlastic'), 0.045, 0.3, 0, g);
      this.box(0.03, 0.07, 0.05, body, -0.06, 0.27, 0, g);
      return g;
    }

    trashBag(seed) {
      const r = rng(seed || 3);
      const g = new THREE.Group();
      g.name = 'trash';
      const bag = this.sphere(0.21, this.materials.get('trashBag'), 0, 0.19, 0, g, 12, 10);
      bag.scale.set(1 + r() * 0.2, 0.85 + r() * 0.2, 0.9 + r() * 0.2);
      const knot = this.mesh(new THREE.ConeGeometry(0.05, 0.11, 6), this.materials.get('trashBag'), 0, 0.42, 0, g);
      knot.rotation.z = (r() - 0.5) * 0.6;
      return g;
    }

    rag() {
      const g = new THREE.Group();
      g.name = 'rag';
      for (let i = 0; i < 3; i++) {
        const layer = this.box(0.24 - i * 0.03, 0.014, 0.18 - i * 0.02, this.materials.get('rag'), (i - 1) * 0.02, 0.008 + i * 0.012, (i - 1) * 0.015, g);
        layer.rotation.y = i * 0.5;
      }
      return g;
    }

    labelBox(w, h, d, text, background, foreground) {
      const g = new THREE.Group();
      const mat = this.materials.label(text, background, foreground, { roughness: 0.9 });
      this.box(w, h, d, mat, 0, h / 2, 0, g);
      return g;
    }

    pump() {
      const M = this.materials;
      const g = new THREE.Group();
      g.name = 'pump';
      this.box(0.26, 0.02, 0.09, M.get('metalDark'), 0, 0.01, 0, g);
      this.cyl(0.032, 0.032, 0.55, M.get('redPlastic'), 0, 0.3, 0, g);
      this.cyl(0.008, 0.008, 0.1, M.get('chrome'), 0, 0.62, 0, g);
      this.rod([-0.12, 0.67, 0], [0.12, 0.67, 0], 0.016, M.get('blackPlastic'), g);
      this.tube([[0.02, 0.06, 0.03], [0.12, 0.03, 0.08], [0.2, 0.15, 0.05], [0.15, 0.3, 0.04]], 0.008, M.get('cable'), g, 16);
      return g;
    }

    // ---------- мебель и хлам гаража ----------

    shelf(w, h, d, levels) {
      const m = this.materials.get('shelf');
      const g = new THREE.Group();
      g.name = 'shelf';
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((p) => this.box(0.04, h, 0.04, m, p[0] * w / 2, h / 2, p[1] * d / 2, g));
      levels.forEach((y) => {
        this.box(w, 0.025, d, m, 0, y, 0, g);
        this.box(w, 0.05, 0.012, m, 0, y + 0.01, d / 2, g);
      });
      return g;
    }

    workbench() {
      const M = this.materials;
      const g = new THREE.Group();
      g.name = 'workbench';
      this.box(1.7, 0.06, 0.62, M.get('woodDark'), 0, 0.88, 0, g);
      [[-0.8, -0.27], [0.8, -0.27], [-0.8, 0.27], [0.8, 0.27]].forEach((p) => this.box(0.05, 0.85, 0.05, M.get('metalDark'), p[0], 0.425, p[1], g));
      this.box(1.6, 0.025, 0.55, M.get('wood'), 0, 0.22, 0, g);
      // тиски
      this.box(0.18, 0.1, 0.13, M.get('metalDark'), -0.68, 0.96, 0.2, g);
      this.box(0.04, 0.09, 0.14, M.get('metal'), -0.68, 0.96, 0.29, g);
      this.rod([-0.68, 0.96, 0.3], [-0.68, 0.96, 0.42], 0.01, M.get('chrome'), g);
      // инструменты
      const wrench = this.box(0.26, 0.012, 0.03, M.get('chrome'), 0.1, 0.917, 0.05, g);
      wrench.rotation.y = 0.4;
      this.cyl(0.012, 0.014, 0.28, M.get('wood'), -0.25, 0.925, -0.12, g).rotation.z = Math.PI / 2;
      this.box(0.05, 0.035, 0.11, M.get('metalDark'), -0.39, 0.93, -0.12, g);
      this.cyl(0.05, 0.05, 0.11, M.get('pet'), 0.55, 0.965, -0.15, g);
      this.cyl(0.045, 0.045, 0.05, M.get('rust'), 0.55, 0.935, -0.15, g);
      const screwdriver = this.cyl(0.011, 0.011, 0.11, M.get('yellow'), 0.35, 0.922, 0.18, g);
      screwdriver.rotation.z = Math.PI / 2;
      return g;
    }

    cabinet() {
      const M = this.materials;
      const g = new THREE.Group();
      this.box(0.8, 1.0, 0.42, M.get('wood'), 0, 0.5, 0, g);
      this.box(0.01, 0.9, 0.005, M.get('woodDark'), 0, 0.5, 0.212, g);
      this.box(0.02, 0.06, 0.02, M.get('metal'), 0.05, 0.62, 0.22, g);
      return g;
    }

    /** LED-панель на подставке (как на фото). Лицевая сторона — свой материал, чтобы включать/выключать. */
    ledPanel() {
      const M = this.materials;
      const g = new THREE.Group();
      this.box(0.12, 0.02, 0.1, M.get('blackPlastic'), 0, 0.01, 0, g);
      this.rod([0, 0.02, 0], [0, 0.18, 0.02], 0.008, M.get('blackPlastic'), g);
      const panel = new THREE.Group();
      panel.position.set(0, 0.28, 0.03);
      panel.rotation.x = -0.25;
      g.add(panel);
      this.box(0.34, 0.24, 0.025, M.get('blackPlastic'), 0, 0, 0, panel);
      const faceMat = new THREE.MeshBasicMaterial({ color: 0x1a1a18 });
      const face = this.mesh(new THREE.PlaneGeometry(0.3, 0.2), faceMat, 0, 0, 0.0135, panel);
      face.castShadow = false;
      return { group: g, faceMat: faceMat, panel: panel };
    }

    candle() {
      const M = this.materials;
      const g = new THREE.Group();
      this.cyl(0.045, 0.05, 0.02, M.get('whitePlastic'), 0, 0.01, 0, g);
      this.cyl(0.018, 0.018, 0.15, M.get('redPlastic'), 0, 0.095, 0, g);
      const flame = this.mesh(new THREE.ConeGeometry(0.009, 0.035, 6), M.get('flame'), 0, 0.19, 0, g);
      flame.castShadow = false;
      const glow = this.glowSprite(0xff9a40, 0.22, 0.7);
      glow.position.set(0, 0.19, 0);
      g.add(glow);
      return { group: g, flame: flame, glow: glow };
    }

    /** Голая лампочка на проводе. Возвращает материал колбы — для мигания. */
    bulbOnCord(length) {
      const M = this.materials;
      const g = new THREE.Group();
      this.cyl(0.005, 0.005, length, M.get('cable'), 0, -length / 2, 0, g, 5).castShadow = false;
      this.cyl(0.018, 0.022, 0.05, M.get('blackPlastic'), 0, -length - 0.02, 0, g);
      const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
      const bulb = this.sphere(0.035, bulbMat, 0, -length - 0.07, 0, g);
      bulb.castShadow = false;
      const glow = this.glowSprite(0xffb070, 0.9, 0.55);
      glow.position.set(0, -length - 0.07, 0);
      g.add(glow);
      return { group: g, bulbMat: bulbMat, glow: glow, bulbY: -length - 0.07 };
    }

    cementBag() {
      const M = this.materials;
      const g = new THREE.Group();
      this.box(0.62, 0.13, 0.42, M.get('cardboard'), 0, 0.065, 0, g);
      const label = this.mesh(new THREE.PlaneGeometry(0.42, 0.24), M.label('ЦЕМЕНТ\nМ500', '#b3a88f', '#3a3020', { roughness: 0.95 }), 0, 0.131, 0, g);
      label.rotation.x = -Math.PI / 2;
      label.castShadow = false;
      return g;
    }

    tire() {
      const t = this.mesh(new THREE.TorusGeometry(0.26, 0.1, 10, 24), this.materials.get('rubber'), 0, 0.1, 0);
      t.rotation.x = Math.PI / 2;
      return t;
    }

    cardboardBox(w, h, d) {
      const g = new THREE.Group();
      this.box(w, h, d, this.materials.get('cardboard'), 0, h / 2, 0, g);
      this.box(w * 0.98, 0.004, 0.05, this.materials.get('rust'), 0, h + 0.001, 0, g);
      return g;
    }

    bottle() {
      const g = new THREE.Group();
      this.cyl(0.04, 0.04, 0.24, this.materials.get('pet'), 0, 0.12, 0, g).castShadow = false;
      this.cyl(0.014, 0.014, 0.025, this.materials.get('redPlastic'), 0, 0.26, 0, g);
      return g;
    }

    paintCan(color) {
      const g = new THREE.Group();
      const mat = this.materials.custom('paint:' + color, () => this.materials.std({ color: color, roughness: 0.5, metalness: 0.4 }));
      this.cyl(0.08, 0.08, 0.13, mat, 0, 0.065, 0, g);
      return g;
    }

    /** Люк в подвал: доски, кольцо, навесной замок. */
    hatch() {
      const M = this.materials;
      const g = new THREE.Group();
      this.box(0.72, 0.03, 0.72, M.get('planks'), 0, 0.015, 0, g);
      this.box(0.76, 0.02, 0.04, M.get('metalDark'), 0, 0.012, 0.38, g);
      this.box(0.76, 0.02, 0.04, M.get('metalDark'), 0, 0.012, -0.38, g);
      const ring = this.mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 14), M.get('rust'), 0.2, 0.035, 0, g);
      ring.rotation.x = Math.PI / 2;
      this.box(0.05, 0.06, 0.025, M.get('metalDark'), -0.22, 0.05, 0.25, g);
      const shackle = this.mesh(new THREE.TorusGeometry(0.018, 0.005, 6, 10, Math.PI), M.get('chrome'), -0.22, 0.08, 0.25, g);
      shackle.castShadow = false;
      return g;
    }

    /** Электрощиток с рубильником. */
    electricPanel() {
      const M = this.materials;
      const g = new THREE.Group();
      this.box(0.36, 0.46, 0.13, M.get('metal'), 0, 0, 0, g);
      this.box(0.005, 0.42, 0.005, M.get('metalDark'), 0.05, 0, 0.066, g);
      const lever = new THREE.Group();
      lever.position.set(0.22, 0, 0);
      g.add(lever);
      this.box(0.03, 0.06, 0.06, M.get('metalDark'), 0, 0, 0, lever);
      this.box(0.025, 0.16, 0.025, M.get('redPlastic'), 0.01, 0.08, 0.02, lever);
      return { group: g, lever: lever };
    }

    /** Куртка на гвозде. В темноте очень похожа на человека. */
    jacketOnHook() {
      const M = this.materials;
      const g = new THREE.Group();
      const body = this.mesh(new THREE.CapsuleGeometry(0.19, 0.42, 4, 10), M.get('puffer'), 0, -0.42, 0, g);
      body.scale.set(1.1, 1, 0.5);
      this.sphere(0.13, M.get('puffer'), 0, -0.05, -0.02, g).scale.set(1, 1.1, 0.8);
      [-1, 1].forEach((s) => {
        const sleeve = this.mesh(new THREE.CapsuleGeometry(0.06, 0.42, 4, 8), M.get('puffer'), s * 0.2, -0.5, 0.02, g);
        sleeve.rotation.z = s * 0.08;
      });
      this.cyl(0.006, 0.006, 0.08, M.get('metalDark'), 0, 0.02, -0.04, g).rotation.x = Math.PI / 2;
      return g;
    }

    toolboard() {
      const M = this.materials;
      const g = new THREE.Group();
      this.box(1.8, 0.8, 0.02, M.get('pegboard'), 0, 0, 0, g);
      for (let i = 0; i < 7; i++) {
        const w = this.box(0.025, 0.16 + i * 0.03, 0.008, M.get('chrome'), -0.75 + i * 0.12, 0.1, 0.02, g);
        w.rotation.z = 0.08;
      }
      this.box(0.03, 0.3, 0.02, M.get('wood'), 0.25, 0.05, 0.02, g);
      this.box(0.12, 0.05, 0.03, M.get('metalDark'), 0.25, 0.2, 0.025, g);
      this.box(0.5, 0.12, 0.006, M.get('metal'), 0.6, -0.15, 0.02, g);
      this.box(0.03, 0.2, 0.02, M.get('redPlastic'), 0.5, 0.15, 0.02, g);
      return g;
    }

    // ---------- питбайк ----------

    /**
     * Питбайк по фото: жёлтый пластик, «75», зелёный трос сцепления, золотые рычаги,
     * низкое переднее крыло, зубастая резина. Вперёд — +X, правая сторона — +Z.
     */
    pitbike() {
      const M = this.materials;
      const yellow = M.get('yellow'), black = M.get('blackPlastic'), frame = M.get('frame'), metal = M.get('metal');
      const chrome = M.get('chrome'), rubber = M.get('rubber'), gold = M.get('gold'), metalDark = M.get('metalDark');
      const outer = new THREE.Group();
      outer.name = 'pitbike';
      const g = new THREE.Group();
      outer.add(g);
      const FA = [0.64, 0.34, 0], RA = [-0.62, 0.31, 0];

      const wheel = (r, at, isFront) => {
        const w = new THREE.Group();
        w.position.set(at[0], at[1], at[2]);
        g.add(w);
        this.mesh(new THREE.TorusGeometry(r - 0.055, 0.058, 8, 30), rubber, 0, 0, 0, w);
        const knobs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.032, 0.03, 0.05), rubber, 36);
        knobs.castShadow = true;
        const dummy = new THREE.Object3D();
        for (let i = 0; i < 36; i++) {
          const a = (i / 36) * Math.PI * 2;
          dummy.position.set(Math.cos(a) * r, Math.sin(a) * r, i % 2 ? 0.03 : -0.03);
          dummy.rotation.set(0, 0, a);
          dummy.updateMatrix();
          knobs.setMatrixAt(i, dummy.matrix);
        }
        w.add(knobs);
        this.mesh(new THREE.TorusGeometry(r - 0.105, 0.012, 6, 30), metalDark, 0, 0, 0, w);
        this.mesh(new THREE.CircleGeometry(r - 0.11, 24), M.get('spokes'), 0, 0, 0, w).castShadow = false;
        this.cyl(0.045, 0.045, 0.13, metal, 0, 0, 0, w).rotation.x = Math.PI / 2;
        if (isFront) this.cyl(0.1, 0.1, 0.006, chrome, 0, 0, -0.055, w, 20).rotation.x = Math.PI / 2;
        else this.cyl(0.09, 0.09, 0.006, metalDark, 0, 0, 0.09, w, 20).rotation.x = Math.PI / 2;
        return w;
      };
      wheel(0.34, FA, true);
      const rearWheel = wheel(0.31, RA, false);

      // вилка
      const head = [0.42, 0.98, 0];
      [-0.075, 0.075].forEach((z) => {
        const mid = [(FA[0] + head[0]) / 2, (FA[1] + head[1]) / 2, z];
        this.rod([FA[0], FA[1], z], mid, 0.028, frame, g);
        this.rod(mid, [head[0] - 0.03, head[1] + 0.08, z], 0.021, chrome, g);
        this.rod([FA[0] - 0.01, FA[1] + 0.06, z * 1.5], [mid[0], mid[1] - 0.04, z * 1.5], 0.018, yellow, g);
      });
      this.box(0.08, 0.04, 0.22, frame, head[0], head[1], 0, g);
      this.box(0.08, 0.04, 0.22, frame, head[0] + 0.04, head[1] - 0.12, 0, g);

      // руль, грипсы, рычаги
      const barX = 0.38, barY = 1.1;
      this.rod([barX, barY, -0.36], [barX, barY, 0.36], 0.012, frame, g);
      this.rod([head[0], head[1] + 0.02, 0], [barX, barY, 0], 0.016, frame, g);
      [-1, 1].forEach((s) => {
        this.rod([barX, barY, s * 0.24], [barX, barY, s * 0.37], 0.019, black, g);
        this.rod([barX, barY, s * 0.37], [barX, barY, s * 0.385], 0.021, M.get('redPlastic'), g);
        this.box(0.04, 0.03, 0.04, metalDark, barX, barY, s * 0.21, g);
        const lever = this.box(0.17, 0.012, 0.022, gold, barX + 0.08, barY - 0.01, s * 0.27, g);
        lever.rotation.y = s * 0.25;
      });

      // рама
      this.rod(head, [-0.02, 0.48, 0], 0.03, frame, g);
      this.rod([head[0], head[1] - 0.03, 0], [-0.22, 0.8, 0], 0.03, frame, g);
      this.rod([-0.22, 0.8, 0], [-0.78, 0.88, 0], 0.02, frame, g);
      this.rod([-0.12, 0.38, 0], [-0.22, 0.8, 0], 0.028, frame, g);
      this.rod([-0.12, 0.38, 0], [-0.78, 0.88, 0], 0.016, frame, g);

      // двигатель
      this.box(0.36, 0.26, 0.22, metal, 0.02, 0.44, 0, g);
      this.box(0.15, 0.17, 0.17, metal, 0.18, 0.6, 0, g).rotation.z = -0.5;
      for (let i = 0; i < 5; i++) {
        this.box(0.21, 0.012, 0.2, metalDark, 0.15 + i * 0.017, 0.54 + i * 0.031, 0, g).rotation.z = -0.5;
      }
      this.cyl(0.08, 0.08, 0.02, metalDark, 0.02, 0.45, -0.12, g, 16).rotation.x = Math.PI / 2;

      // маятник, амортизатор, цепь
      [-0.08, 0.08].forEach((z) => this.rod([-0.12, 0.38, z], [RA[0], RA[1], z], 0.02, frame, g));
      this.rod([-0.33, 0.44, 0], [-0.22, 0.79, 0], 0.016, chrome, g);
      this.rod([-0.31, 0.49, 0], [-0.24, 0.72, 0], 0.03, yellow, g);
      this.rod([0.0, 0.39, 0.1], [RA[0], RA[1] + 0.06, 0.1], 0.007, metalDark, g);
      this.rod([0.0, 0.33, 0.1], [RA[0], RA[1] - 0.06, 0.1], 0.007, metalDark, g);

      // выхлоп (справа)
      this.tube([[0.24, 0.62, 0.06], [0.3, 0.45, 0.12], [0.12, 0.36, 0.16], [-0.15, 0.55, 0.17], [-0.38, 0.74, 0.17]], 0.025, chrome, g, 40).castShadow = true;
      this.rod([-0.34, 0.73, 0.17], [-0.8, 0.86, 0.17], 0.05, metal, g, 12);

      // бак, пластик, сиденье
      this.sphere(1, yellow, 0.14, 0.9, 0, g, 16, 12).scale.set(0.22, 0.11, 0.14);
      this.cyl(0.025, 0.025, 0.02, black, 0.16, 1.005, 0, g);
      const numberMat = M.label('75', '#e6be16', '#111111', { roughness: 0.45 });
      [-1, 1].forEach((s) => {
        const shroud = this.box(0.34, 0.22, 0.015, yellow, 0.27, 0.8, s * 0.13, g);
        shroud.rotation.z = 0.35;
        shroud.rotation.y = s * 0.15;
        this.box(0.34, 0.17, 0.015, numberMat, -0.47, 0.76, s * 0.12, g);
      });
      this.box(0.78, 0.07, 0.2, M.get('seat'), -0.33, 0.97, 0, g).rotation.z = -0.04;
      this.box(0.5, 0.02, 0.17, yellow, -0.86, 0.96, 0, g).rotation.z = -0.22;
      const fender = this.mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.15, 18, 1, true, Math.PI * 0.55, Math.PI * 0.55), M.get('yellowDouble'), FA[0], FA[1], 0, g);
      fender.rotation.x = Math.PI / 2;

      // маска с фарой
      this.box(0.025, 0.32, 0.26, yellow, 0.52, 0.86, 0, g).rotation.z = 0.33;
      this.box(0.02, 0.12, 0.14, black, 0.535, 0.84, 0, g).rotation.z = 0.33;
      this.box(0.006, 0.02, 0.1, M.get('headlightLed'), 0.55, 0.8, 0, g).rotation.z = 0.33;

      // подножка и зелёный трос сцепления (как на фото)
      this.rod([-0.08, 0.34, -0.1], [-0.18, 0.01, -0.3], 0.01, metalDark, g);
      const clutchCable = this.tube([[barX, barY, -0.22], [0.5, 1.02, -0.2], [0.45, 0.8, -0.17], [0.25, 0.62, -0.15], [0.05, 0.5, -0.13]], 0.007, M.get('greenCable'), g, 24);

      g.rotation.x = -0.07; // стоит на подножке, чуть завален влево

      const proxies = {
        tank: this.proxy(0.5, 0.26, 0.36, 0.14, 0.92, 0, g),
        clutch: this.proxy(0.24, 0.22, 0.28, barX, barY, -0.28, g),
        wheel: this.proxy(0.72, 0.72, 0.34, RA[0], RA[1], 0, g),
      };

      return { group: outer, proxies: proxies, clutchCable: clutchCable, rearWheel: rearWheel };
    }

    // ---------- улица ----------

    lampPost(mode) {
      const M = this.materials;
      const g = new THREE.Group();
      this.cyl(0.06, 0.09, 5, M.get('pole'), 0, 2.5, 0, g);
      this.rod([0, 4.9, 0], [1.3, 5.05, 0], 0.035, M.get('pole'), g);
      this.box(0.45, 0.12, 0.24, M.get('pole'), 1.35, 5.02, 0, g);
      const lensMat = mode === 'dead' ? M.get('metalDark') : new THREE.MeshBasicMaterial({ color: 0xffb060 });
      const lens = this.mesh(new THREE.PlaneGeometry(0.36, 0.16), lensMat, 1.35, 4.955, 0, g);
      lens.rotation.x = Math.PI / 2;
      lens.castShadow = false;
      return { group: g, lightLocal: new THREE.Vector3(1.35, 4.85, 0), lensMat: lensMat };
    }

    dumpster() {
      const M = this.materials;
      const g = new THREE.Group();
      this.box(1.0, 1.0, 1.6, M.get('dumpster'), 0, 0.6, 0, g);
      const lid = new THREE.Group();
      lid.position.set(-0.5, 1.1, 0);
      lid.rotation.z = 0.45;
      g.add(lid);
      this.box(1.04, 0.04, 1.62, M.get('dumpster'), 0.52, 0.02, 0, lid);
      this.box(0.9, 0.05, 1.5, M.get('snowCap'), 0.5, 0.065, 0, lid);
      [[-0.4, -0.65], [0.4, -0.65], [-0.4, 0.65], [0.4, 0.65]].forEach((p) => {
        this.cyl(0.07, 0.07, 0.05, M.get('rubber'), p[0], 0.07, p[1], g).rotation.x = Math.PI / 2;
      });
      return g;
    }

    fencePanel(w, h) {
      const g = new THREE.Group();
      this.mesh(GK.geo.worldBox(w, h, 0.12, 2.2), this.materials.get('fence'), 0, h / 2, 0, g);
      return g;
    }

    birch(h, seed) {
      const r = rng(seed);
      const g = new THREE.Group();
      this.cyl(0.07, 0.11, h, this.materials.get('birch'), 0, h / 2, 0, g, 8);
      for (let i = 0; i < 6; i++) {
        const y = h * (0.45 + r() * 0.5), a = r() * Math.PI * 2, len = 0.6 + r() * 1.2;
        this.rod([0, y, 0], [Math.cos(a) * len, y + len * 0.8, Math.sin(a) * len], 0.02, this.materials.get('woodDark'), g, 5);
      }
      return g;
    }

    pine(h) {
      const g = new THREE.Group();
      this.cyl(0.1, 0.14, h * 0.3, this.materials.get('woodDark'), 0, h * 0.15, 0, g, 6);
      for (let i = 0; i < 4; i++) {
        const radius = (1.6 - i * 0.35) * h / 7;
        this.mesh(new THREE.ConeGeometry(radius, h * 0.32, 8), this.materials.get('pine'), 0, h * (0.32 + i * 0.17), 0, g);
      }
      return g;
    }

    building(w, h, d, seed) {
      const g = new THREE.Group();
      const m = this.mesh(GK.geo.worldBox(w, h, d, 27), this.materials.facade(seed), 0, h / 2, 0, g);
      m.castShadow = false;
      m.receiveShadow = false;
      return g;
    }
  }

  GK.PropsFactory = decorate([Injectable(), Dependencies(GK.MaterialsService, GK.TexturesService)], PropsFactory);
})(window.GK);
