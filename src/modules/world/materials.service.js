/**
 * Каталог материалов. Один материал на много мешей — экономим видеопамять
 * и количество переключений шейдеров.
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;

  class MaterialsService {
    constructor(textures) {
      this.textures = textures;
      this.cache = new Map();
    }

    std(params) {
      return new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85, metalness: 0 }, params));
    }

    basic(params) {
      return new THREE.MeshBasicMaterial(params);
    }

    /** Материал по имени из каталога. */
    get(name) {
      if (!this.cache.has(name)) {
        const factory = this.catalog()[name];
        if (!factory) throw new Error('Нет материала "' + name + '"');
        this.cache.set(name, factory());
      }
      return this.cache.get(name);
    }

    catalog() {
      const T = this.textures;
      return {
        brick: () => this.std({ map: T.brick(), bumpMap: T.brick(), bumpScale: 0.02, roughness: 0.95, color: 0xb4afa4 }),
        concrete: () => this.std({ map: T.concrete(), bumpMap: T.concrete(), bumpScale: 0.01, roughness: 0.9 }),
        pit: () => this.std({ color: 0x0c0b0a, roughness: 1 }),
        snow: () => this.std({ map: T.snow(), bumpMap: T.snow(), bumpScale: 0.015, color: 0xe4ebf4, roughness: 0.82 }),
        snowCap: () => this.std({ color: 0xdfe6ef, roughness: 0.8 }),
        track: () => this.std({ map: T.track(), transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }),
        roofing: () => this.std({ map: T.roofing(), roughness: 0.95 }),
        ceiling: () => this.std({ color: 0x2a2620, roughness: 1 }),
        ice: () => this.std({ color: 0xc8defa, roughness: 0.1, transparent: true, opacity: 0.7 }),
        planks: () => this.std({ map: T.planks(), roughness: 0.85 }),
        wood: () => this.std({ color: 0x5a4030, roughness: 0.85 }),
        woodDark: () => this.std({ color: 0x2e2118, roughness: 0.9 }),
        metal: () => this.std({ color: 0x6b7075, roughness: 0.5, metalness: 0.6 }),
        metalDark: () => this.std({ color: 0x2c2f33, roughness: 0.55, metalness: 0.6 }),
        shelf: () => this.std({ color: 0x4a5258, roughness: 0.6, metalness: 0.5 }),
        chrome: () => this.std({ color: 0xb6bbc1, roughness: 0.25, metalness: 1 }),
        rust: () => this.std({ color: 0x5a3523, roughness: 0.95 }),
        rubber: () => this.std({ color: 0x121212, roughness: 0.92 }),
        yellow: () => this.std({ color: 0xe6be16, roughness: 0.42 }),
        yellowDouble: () => this.std({ color: 0xe6be16, roughness: 0.42, side: THREE.DoubleSide }),
        redPlastic: () => this.std({ color: 0xa31d14, roughness: 0.5 }),
        blackPlastic: () => this.std({ color: 0x141414, roughness: 0.55 }),
        frame: () => this.std({ color: 0x1b1d1f, roughness: 0.45, metalness: 0.5 }),
        gold: () => this.std({ color: 0xc99a2e, roughness: 0.35, metalness: 0.8 }),
        greenCable: () => this.std({ color: 0x35d43a, roughness: 0.5 }),
        seat: () => this.std({ color: 0x0e0e0e, roughness: 0.7 }),
        spokes: () => this.std({ map: T.spokes(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.7, roughness: 0.4 }),
        cardboard: () => this.std({ color: 0x8a6a45, roughness: 0.95 }),
        fence: () => this.std({ map: T.fence(), roughness: 0.95 }),
        birch: () => this.std({ map: T.birch(), roughness: 0.9 }),
        pine: () => this.std({ color: 0x0d140f, roughness: 1 }),
        dumpster: () => this.std({ color: 0x2d4a31, roughness: 0.7, metalness: 0.3 }),
        pole: () => this.std({ color: 0x3a3c3e, roughness: 0.6, metalness: 0.4 }),
        cable: () => this.std({ color: 0x0b0b0b, roughness: 0.6 }),
        cordOrange: () => this.std({ color: 0xc8571f, roughness: 0.6 }),
        whitePlastic: () => this.std({ color: 0xd8d6cf, roughness: 0.5 }),
        pet: () => this.std({ color: 0x9fc0b0, roughness: 0.15, transparent: true, opacity: 0.45 }),
        pegboard: () => this.std({ map: T.pegboard(), roughness: 0.9 }),
        trashBag: () => this.std({ color: 0x0f1012, roughness: 0.28, metalness: 0.1 }),
        rag: () => this.std({ color: 0x6d6153, roughness: 1 }),
        stain: () => this.std({ map: T.stain(), transparent: true, depthWrite: false, roughness: 0.25, polygonOffset: true, polygonOffsetFactor: -4 }),
        // персонажи
        puffer: () => this.std({ map: T.quilt(), roughness: 0.35, metalness: 0.15 }),
        pants: () => this.std({ color: 0x101114, roughness: 0.9 }),
        sneaker: () => this.std({ color: 0xd9d9d4, roughness: 0.6 }),
        skin: () => this.std({ color: 0xb98a6c, roughness: 0.7 }),
        paleSkin: () => this.std({ color: 0x8f8a86, roughness: 0.65 }),
        hair: () => this.std({ color: 0x15100c, roughness: 0.9 }),
        glove: () => this.std({ color: 0x0d0d0d, roughness: 0.7 }),
        mask: () => this.std({ color: 0xd4d4cf, roughness: 0.5 }),
        cartridge: () => this.std({ color: 0xc9cfd3, roughness: 0.2, transparent: true, opacity: 0.85 }),
        strap: () => this.std({ color: 0x3b2a18, roughness: 0.8 }),
        redShirt: () => this.std({ color: 0x8e1b15, roughness: 0.85 }),
        jeans: () => this.std({ color: 0x1a1d24, roughness: 0.9 }),
        mouth: () => this.basic({ color: 0x050302 }),
        // светящиеся (не зависят от освещения)
        eyes: () => this.basic({ color: 0xffffff, fog: false }),
        redLens: () => this.basic({ color: 0xff2a10 }),
        sodium: () => this.basic({ color: 0xffb060 }),
        bulb: () => this.basic({ color: 0xffd9a0 }),
        ledFace: () => this.basic({ color: 0xfff3dc }),
        flame: () => this.basic({ color: 0xffa040 }),
        headlightLed: () => this.basic({ color: 0x9fb4c8 }),
      };
    }

    /** Материал «под заказ» с кэшем по ключу. */
    custom(key, factory) {
      if (!this.cache.has(key)) this.cache.set(key, factory());
      return this.cache.get(key);
    }

    /** Ворота гаража: цвет и номер у каждого свои. */
    door(color, number, seed) {
      const key = 'door:' + color + ':' + number;
      if (!this.cache.has(key)) {
        this.cache.set(key, this.std({ map: this.textures.door(color, number, seed), roughness: 0.6, metalness: 0.35 }));
      }
      return this.cache.get(key);
    }

    label(text, background, foreground, params) {
      const key = 'label:' + text + background;
      if (!this.cache.has(key)) {
        this.cache.set(key, this.std(Object.assign({ map: this.textures.label(text, background, foreground) }, params)));
      }
      return this.cache.get(key);
    }

    /** Кирпич с другим тайлингом нужен не материалу, а геометрии (см. GK.geo.worldBox). */
    facade(seed) {
      const key = 'facade:' + seed;
      if (!this.cache.has(key)) {
        this.cache.set(key, this.basic({ map: this.textures.facade(seed), fog: false, color: 0x8a8a8a }));
      }
      return this.cache.get(key);
    }
  }

  GK.MaterialsService = decorate([Injectable(), Dependencies(GK.TexturesService)], MaterialsService);
})(window.GK);
