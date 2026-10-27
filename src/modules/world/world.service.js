/**
 * Мир целиком: строит улицу и гараж, живёт каждый кадр (мигание фонарей и лампочки,
 * свеча, туман), даёт остальным модулям точки и цели для заданий.
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;
  const { damp, rand, randInt } = GK.math;

  class WorldService {
    constructor(renderer, rowBuilder, garageBuilder, materials, events, loop) {
      this.renderer = renderer;
      this.rowBuilder = rowBuilder;
      this.garageBuilder = garageBuilder;
      this.materials = materials;
      this.events = events;
      this.loop = loop;
      this.ready = false;
      this.garageLightsOn = true;
      this.bulbFlicker = 0;
      this.bulbDip = 0;
    }

    onModuleInit() {
      if (!this.renderer.scene) return;
      const scene = this.renderer.scene;
      // «Лунный» свет неба. Под крышей гаража его почти нет — см. update()
      this.sky = new THREE.HemisphereLight(0x2c3a55, 0x08090c, 0.32);
      scene.add(this.sky);
      this.row = this.rowBuilder.build(scene);
      this.garage = this.garageBuilder.build(scene);
      this.dayRoot = new THREE.Group();
      this.dayRoot.name = 'day';
      scene.add(this.dayRoot);
      this.targets = Object.assign({}, this.row.targets, this.garage.targets);
      this.ready = true;
      this.loop.add('world', (dt, t) => this.update(dt, t), { states: ['*'], priority: 30 });
      this.events.emit('world.ready', { humPosition: this.garage.bulb.position });
    }

    toWorld(u, y, v) {
      return this.garage.toWorld(u, y, v);
    }

    /** Позиция из конфига: по умолчанию в координатах гаража [u, y, v]. */
    resolvePosition(pos, space) {
      return space === 'world' ? new THREE.Vector3(pos[0], pos[1], pos[2]) : this.toWorld(pos[0], pos[1], pos[2]);
    }

    isInsideGarage(x, z) {
      return GK.isInsideGarage(x, z);
    }

    surfaceAt(x, z) {
      if (!GK.isInsideGarage(x, z)) return 'snow';
      return GK.isOnPitBoards(x, z) ? 'wood' : 'concrete';
    }

    floorHeight(x, z) {
      return GK.isOnPitBoards(x, z) ? 0.085 : 0;
    }

    setGarageLights(on) {
      this.garageLightsOn = on;
      this.events.emit('world.lights', { on: on });
    }

    flickerBulb(seconds) {
      this.bulbFlicker = seconds;
    }

    get ledOn() {
      return this.garage.led.on;
    }

    setLed(on) {
      this.garage.led.on = on;
    }

    /** Внешний вид питбайка: старый/новый трос, спущенное колесо. */
    setBikeState(state) {
      const bike = this.garage.bike;
      if ('clutchNew' in state) {
        bike.clutchCable.material = this.materials.get(state.clutchNew ? 'cable' : 'greenCable');
      }
      if ('tireFlat' in state) {
        bike.rearWheel.scale.y = state.tireFlat ? 0.86 : 1;
        bike.rearWheel.position.y = state.tireFlat ? 0.27 : 0.31;
      }
    }

    clearDay() {
      while (this.dayRoot.children.length) this.dayRoot.remove(this.dayRoot.children[0]);
    }

    update(dt, t) {
      this.updateLamps(dt, t);
      this.updateGarage(dt, t);
      const cam = this.renderer.camera.position;
      const inside = GK.isInsideGarage(cam.x, cam.z);
      const fog = this.renderer.scene.fog;
      fog.density = damp(fog.density, inside ? 0.03 : 0.052, 2, dt);
      this.sky.intensity = damp(this.sky.intensity, inside ? 0.04 : 0.32, 3, dt);
    }

    updateLamps(dt, t) {
      this.row.lamps.forEach((lamp, i) => {
        if (lamp.mode === 'dead') return;
        let k;
        if (lamp.mode === 'flicker') {
          lamp.timer -= dt;
          if (lamp.timer <= 0) {
            if (lamp.stutter > 0) {
              lamp.lit = !lamp.lit;
              lamp.stutter--;
              lamp.timer = rand(0.03, 0.14);
            } else {
              lamp.lit = true;
              lamp.stutter = Math.random() < 0.55 ? randInt(2, 8) : 0;
              lamp.timer = rand(1.5, 6);
            }
          }
          k = lamp.lit ? 1 : 0.04;
        } else {
          k = 0.96 + Math.sin(t * 3.1 + i) * 0.02 + Math.sin(t * 17.3 + i) * 0.015;
        }
        lamp.light.intensity = lamp.base * k;
        lamp.glow.material.opacity = 0.45 * k;
        lamp.cone.material.opacity = 0.035 * k;
        lamp.lensMat.color.setRGB(0.15 + 0.85 * k, (0.15 + 0.85 * k) * 0.69, (0.15 + 0.85 * k) * 0.38);
      });
    }

    updateGarage(dt, t) {
      const bulb = this.garage.bulb;
      let k = 0;
      if (this.garageLightsOn) {
        k = 0.92 + Math.sin(t * 13.3) * 0.03 + Math.sin(t * 7.1) * 0.03;
        if (Math.random() < 0.004) this.bulbDip = 0.12;
        if (this.bulbDip > 0) {
          this.bulbDip -= dt;
          k *= 0.35;
        }
        if (this.bulbFlicker > 0) {
          this.bulbFlicker -= dt;
          if (Math.random() < 0.5) k *= 0.05;
        }
      }
      bulb.light.intensity = bulb.base * k;
      const glow = 0.12 + 0.88 * k;
      bulb.mat.color.setRGB(glow, glow * 0.85, glow * 0.63);
      bulb.glow.material.opacity = 0.55 * k;
      bulb.group.rotation.z = Math.sin(t * 0.6) * 0.03;
      bulb.group.rotation.x = Math.sin(t * 0.43) * 0.02;

      const led = this.garage.led;
      const target = led.on && this.garageLightsOn ? led.base : 0;
      led.light.intensity = damp(led.light.intensity, target, 18, dt);
      led.faceMat.color.setHex(target > 0 ? 0xfff3dc : 0x1a1a18);

      const candle = this.garage.candle;
      const flicker = 0.8 + Math.random() * 0.25;
      candle.glow.material.opacity = 0.6 * flicker;
      candle.flame.scale.y = 0.8 + Math.random() * 0.4;
    }
  }

  GK.WorldService = decorate([
    Injectable(),
    Dependencies(GK.RendererService, GK.GarageRowBuilder, GK.KaninGarageBuilder, GK.MaterialsService, GK.EventBus, GK.LoopService),
  ], WorldService);
})(window.GK);
