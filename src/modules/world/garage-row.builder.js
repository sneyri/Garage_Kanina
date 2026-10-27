/**
 * Улица: два ряда гаражей, проезд, проулок с мусорным баком, фонари,
 * заборы, деревья, девятиэтажки на горизонте и небо.
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;
  const { rng } = GK.math;

  const DOOR_COLORS = ['#5d2a22', '#4f5559', '#3d4a3a', '#34465a', '#5b4a32', '#6a3b2a', '#45484a', '#2f3b45'];

  class GarageRowBuilder {
    constructor(materials, props, colliders, textures) {
      this.materials = materials;
      this.props = props;
      this.colliders = colliders;
      this.textures = textures;
    }

    build(scene) {
      const root = new THREE.Group();
      root.name = 'garages';
      scene.add(root);
      const r = rng(1337);
      const result = { root: root, lamps: [], targets: {}, stalkerSpots: [] };

      this.ground(root);
      this.rows(root, r);
      this.lampPosts(root, result);
      this.fences(root);
      this.alley(root, result, r);
      this.backdrop(scene, root, r);

      // Где может появиться «Тип»: по всему проезду, в проулке и за решёткой въездных ворот
      result.stalkerSpots = [
        { x: -9.9, z: -1.1, zone: 'alley' },
        { x: -4.6, z: -2.4, zone: 'alley' },
        { x: 0.4, z: -25.3, zone: 'lane' },
        { x: -2.9, z: -18.5, zone: 'lane' },
        { x: 3.0, z: -14.5, zone: 'lane' },
        { x: 2.9, z: -21, zone: 'lane' },
        { x: -2.8, z: -8, zone: 'lane' },
        { x: 3.2, z: 5.5, zone: 'lane' },
        { x: -3.0, z: 8, zone: 'lane' },
        { x: 2.6, z: 12.5, zone: 'lane' },
        { x: -1.5, z: 25.6, zone: 'lane' },
        { x: 0.6, z: 30.5, zone: 'gate' },
      ];
      return result;
    }

    ground(root) {
      const M = this.materials;
      const ground = new THREE.Mesh(GK.geo.worldPlane(160, 160, 3), M.get('snow'));
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      root.add(ground);
      [-0.85, 0.85].forEach((x) => {
        const track = new THREE.Mesh(GK.geo.scaleUV(new THREE.PlaneGeometry(0.42, 54), 1, 13), M.get('track'));
        track.rotation.x = -Math.PI / 2;
        track.position.set(x, 0.008, 0);
        track.receiveShadow = true;
        root.add(track);
      });
    }

    rows(root, r) {
      const L = GK.LAYOUT, M = this.materials, P = this.props;
      const icicles = [];
      ['left', 'right'].forEach((side) => {
        const s = side === 'right' ? 1 : -1;
        const frontX = s * L.lane.halfWidth, backX = s * (L.lane.halfWidth + L.row.depth);
        for (let i = 0; i < L.row.count; i++) {
          const z0 = L.row.startZ + i * L.row.garageWidth, z1 = z0 + L.row.garageWidth, zc = (z0 + z1) / 2;
          if (side === L.alley.side && i === L.alley.index) continue;
          if (side === L.kanin.side && i === L.kanin.index) {
            // сам гараж строит KaninGarageBuilder, отсюда — только сосульки
            for (let k = 0; k < 5; k++) icicles.push({ x: frontX - s * 0.31, y: 2.95, z: z0 + 0.4 + k * 0.9 + r() * 0.3, len: 0.15 + r() * 0.4, rad: 0.02 + r() * 0.025 });
            continue;
          }
          const h = L.row.height + (r() - 0.5) * 0.24;
          P.mesh(GK.geo.worldBox(L.row.depth, h, L.row.garageWidth, 1), M.get('brick'), (frontX + backX) / 2, h / 2, zc, root);
          this.colliders.add(frontX, backX, z0, z1, 'row');

          const number = String(side === 'right' ? 5 + i * 2 : 4 + i * 2);
          const color = DOOR_COLORS[Math.floor(r() * DOOR_COLORS.length)];
          const door = P.mesh(new THREE.PlaneGeometry(2.6, 2.2), M.door(color, number, i * 7 + (s > 0 ? 3 : 1)), frontX - s * 0.012, 1.1, zc, root);
          door.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
          door.castShadow = false;
          this.doorFrame(root, frontX - s * 0.03, zc);

          this.roof(root, frontX, backX, z0, z1, h, s, r, icicles);
          if (r() < 0.65) this.snowPile(root, frontX - s * (0.35 + r() * 0.3), z0 + 0.3 + r() * (L.row.garageWidth - 0.6), r);
        }
      });
      this.icicles(root, icicles);
    }

    doorFrame(root, x, zc) {
      const m = this.materials.get('metalDark'), P = this.props;
      P.box(0.06, 0.08, 2.8, m, x, 2.24, zc, root);
      P.box(0.06, 2.25, 0.08, m, x, 1.12, zc - 1.36, root);
      P.box(0.06, 2.25, 0.08, m, x, 1.12, zc + 1.36, root);
    }

    roof(root, frontX, backX, z0, z1, h, s, r, icicles) {
      const M = this.materials, P = this.props;
      const overhang = 0.35, depth = Math.abs(backX - frontX) + overhang, width = z1 - z0;
      const cx = (frontX - s * overhang + backX) / 2, zc = (z0 + z1) / 2;
      P.mesh(GK.geo.worldBox(depth, 0.12, width + 0.02, 2), M.get('roofing'), cx, h + 0.06, zc, root);
      const capH = 0.12 + r() * 0.1;
      P.box(depth - 0.06, capH, width - 0.04, M.get('snowCap'), cx, h + 0.12 + capH / 2, zc, root);
      const n = Math.floor(r() * 7);
      for (let k = 0; k < n; k++) {
        icicles.push({ x: frontX - s * (overhang - 0.04), y: h, z: z0 + 0.15 + r() * (width - 0.3), len: 0.1 + r() * 0.45, rad: 0.02 + r() * 0.03 });
      }
    }

    icicles(root, list) {
      const geometry = new THREE.ConeGeometry(1, 1, 5);
      geometry.rotateX(Math.PI);
      geometry.translate(0, -0.5, 0);
      const mesh = new THREE.InstancedMesh(geometry, this.materials.get('ice'), list.length);
      const dummy = new THREE.Object3D();
      list.forEach((c, i) => {
        dummy.position.set(c.x, c.y, c.z);
        dummy.scale.set(c.rad, c.len, c.rad);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      root.add(mesh);
    }

    snowPile(root, x, z, r) {
      const pile = this.props.sphere(1, this.materials.get('snowCap'), x, 0, z, root, 12, 8);
      pile.scale.set(0.35 + r() * 0.35, 0.18 + r() * 0.22, 0.6 + r() * 0.9);
      pile.castShadow = false;
      return pile;
    }

    lampPosts(root, result) {
      const specs = [
        { x: -3.7, z: 15, mode: 'steady' },
        { x: 3.7, z: 0.6, mode: 'flicker' },
        { x: -3.7, z: -16, mode: 'dead' },
      ];
      specs.forEach((spec) => {
        const lamp = this.props.lampPost(spec.mode);
        lamp.group.position.set(spec.x, 0, spec.z);
        lamp.group.rotation.y = spec.x < 0 ? 0 : Math.PI;
        root.add(lamp.group);
        this.colliders.addCentered(spec.x, spec.z, 0.22, 0.22, 'lamp');
        lamp.group.updateMatrixWorld(true);
        const position = lamp.group.localToWorld(lamp.lightLocal.clone());
        const entry = { mode: spec.mode, lensMat: lamp.lensMat, position: position, base: 1.6, lit: true, timer: 2, stutter: 0 };
        if (spec.mode !== 'dead') {
          const light = new THREE.PointLight(0xff9a40, entry.base, 11, 2);
          light.position.copy(position);
          root.add(light);
          const glow = this.props.glowSprite(0xffa050, 1.8, 0.45);
          glow.position.copy(position).y += 0.06;
          root.add(glow);
          const cone = new THREE.Mesh(
            new THREE.ConeGeometry(2.2, 4.8, 24, 1, true),
            new THREE.MeshBasicMaterial({
              color: 0xffa050, alphaMap: this.textures.lightCone(), transparent: true, opacity: 0.035,
              blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
            })
          );
          cone.position.set(position.x, position.y - 2.4, position.z);
          root.add(cone);
          Object.assign(entry, { light: light, glow: glow, cone: cone });
        }
        result.lamps.push(entry);
      });
    }

    fences(root) {
      const P = this.props, M = this.materials;
      [-27.6, 27.6].forEach((z, idx) => {
        for (let x = -11; x < 11; x += 2.5) {
          if (idx === 1 && x > -4 && x < 4) continue; // въезд: здесь ворота
          const panel = P.fencePanel(2.5, 2.3);
          panel.position.set(x + 1.25, 0, z);
          root.add(panel);
        }
        if (idx === 1) {
          // решётку ворот видно насквозь — отдельный тег для проверки прямой видимости
          this.colliders.add(-11.5, -3.6, z - 0.2, z + 0.2, 'fence');
          this.colliders.add(-3.6, 4.1, z - 0.2, z + 0.2, 'gate');
          this.colliders.add(4.1, 11.5, z - 0.2, z + 0.2, 'fence');
        } else {
          this.colliders.add(-11.5, 11.5, z - 0.2, z + 0.2, 'fence');
        }
      });
      // решётчатые ворота на въезде
      const bars = [];
      for (let x = -3.4; x <= 3.95; x += 0.22) bars.push(x);
      const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.014, 0.014, 2.0, 5), M.get('metalDark'), bars.length);
      const dummy = new THREE.Object3D();
      bars.forEach((x, i) => {
        dummy.position.set(x, 1.05, 27.6);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.castShadow = true;
      root.add(mesh);
      [0.2, 1.9].forEach((y) => P.rod([-3.5, y, 27.6], [4, y, 27.6], 0.025, M.get('metalDark'), root));
      [-3.6, 4.1].forEach((x) => P.box(0.3, 2.5, 0.3, M.get('brick'), x, 1.25, 27.6, root));
    }

    alley(root, result, r) {
      const L = GK.LAYOUT, P = this.props, M = this.materials;
      const z0 = L.row.startZ + L.alley.index * L.row.garageWidth, z1 = z0 + L.row.garageWidth, zc = (z0 + z1) / 2;
      const fence = P.fencePanel(L.row.garageWidth, 2.3);
      fence.rotation.y = Math.PI / 2;
      fence.position.set(L.alley.endX, 0, zc);
      root.add(fence);
      this.colliders.add(L.alley.endX - 0.2, L.alley.endX + 0.2, z0, z1, 'fence');

      const dumpster = P.dumpster();
      dumpster.position.set(-8.4, 0, zc);
      root.add(dumpster);
      this.colliders.addCentered(-8.4, zc, 1.05, 1.65, 'dumpster');
      result.targets.dumpster = {
        label: 'Мусорный бак', verb: 'Выбросить', consume: true,
        proxy: P.proxy(1.3, 1.5, 1.8, -8.4, 0.75, zc, root),
        position: new THREE.Vector3(-8.4, 1, zc),
      };

      [[-9.6, zc + 1.2], [-9.3, zc - 1.4], [-7.5, zc + 1.3]].forEach((p, i) => {
        const bag = P.trashBag(20 + i);
        bag.position.set(p[0], 0, p[1]);
        root.add(bag);
      });
      const tire = P.tire();
      tire.position.set(-10.3, 0, zc - 0.6);
      tire.rotation.set(0.3, 0, 1.2);
      root.add(tire);
      for (let k = 0; k < 4; k++) this.snowPile(root, -5 - r() * 6, z0 + 0.4 + r() * 0.3 + (k % 2) * 3.4, r);
    }

    backdrop(scene, root, r) {
      const P = this.props;
      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(220, 24, 12),
        new THREE.MeshBasicMaterial({ map: this.textures.sky(), side: THREE.BackSide, fog: false, depthWrite: false })
      );
      sky.renderOrder = -10;
      scene.add(sky);

      [[-40, -95, 60, 27, 14, 0.1], [45, -80, 50, 30, 14, -0.3], [-85, 10, 14, 27, 60, 0],
        [90, -10, 14, 33, 55, 0], [10, 100, 70, 27, 14, 0.05], [-60, 75, 40, 24, 14, 0.6]].forEach((b, i) => {
        const building = P.building(b[2], b[3], b[4], 100 + i);
        building.position.set(b[0], 0, b[1]);
        building.rotation.y = b[5];
        scene.add(building);
      });

      for (let i = 0; i < 16; i++) {
        const side = i % 2 ? 1 : -1;
        const tree = P.birch(6 + r() * 4, 300 + i);
        tree.position.set(side * (13 + r() * 8), 0, -30 + r() * 60);
        root.add(tree);
      }
      for (let i = 0; i < 10; i++) {
        const tree = P.birch(5 + r() * 4, 400 + i);
        tree.position.set(-12 + r() * 24, 0, -30 - r() * 8);
        root.add(tree);
      }
      for (let i = 0; i < 14; i++) {
        const tree = P.pine(7 + r() * 5);
        const angle = r() * Math.PI * 2;
        tree.position.set(Math.cos(angle) * (34 + r() * 12), 0, Math.sin(angle) * (36 + r() * 12));
        root.add(tree);
      }
    }
  }

  GK.GarageRowBuilder = decorate([
    Injectable(),
    Dependencies(GK.MaterialsService, GK.PropsFactory, GK.CollidersService, GK.TexturesService),
  ], GarageRowBuilder);
})(window.GK);
