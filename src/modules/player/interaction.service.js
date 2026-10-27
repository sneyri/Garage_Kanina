/**
 * Взаимодействие: луч из центра экрана ищет зарегистрированные объекты.
 *
 *   interaction.register({
 *     id: 'stain-1',
 *     object: mesh,                       // по чему «целиться»
 *     range: 2.3,                         // дальность, м
 *     prompt: (ctx) => ({ text, hold, sound, enabled }) | null,
 *     onUse: (ctx) => { ... },
 *   });
 *
 * ctx = { held, distance, point }. hold > 0 — нужно удерживать E столько секунд.
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;

  class InteractionService {
    constructor(renderer, input, hands, sfx, events, loop) {
      this.renderer = renderer;
      this.input = input;
      this.hands = hands;
      this.sfx = sfx;
      this.events = events;
      this.loop = loop;
      this.items = new Map();
      this.objects = [];
      this.dirty = false;
      this.current = null;
      this.holdTime = 0;
      this.workSound = null;
      this.state = { visible: false };
    }

    onModuleInit() {
      if (!this.renderer.camera) return;
      this.raycaster = new THREE.Raycaster();
      this.raycaster.far = 3;
      this.center = new THREE.Vector2(0, 0);
      this.events.on('state.changed', () => {
        this.resetHold();
        this.current = null;
        this.state = { visible: false };
      });
      this.loop.add('interaction', (dt) => this.update(dt), { priority: 20 });
    }

    register(def) {
      if (this.items.has(def.id)) this.unregister(def.id);
      def.object.userData.interactId = def.id;
      this.items.set(def.id, def);
      this.dirty = true;
      return () => this.unregister(def.id);
    }

    unregister(id) {
      const def = this.items.get(id);
      if (!def) return;
      if (def.object.userData.interactId === id) delete def.object.userData.interactId;
      this.items.delete(id);
      this.dirty = true;
      if (this.current === def) {
        this.resetHold();
        this.current = null;
      }
    }

    has(id) {
      return this.items.has(id);
    }

    targets() {
      if (this.dirty) {
        this.objects = Array.from(this.items.values()).map((d) => d.object);
        this.dirty = false;
      }
      return this.objects;
    }

    findDef(object) {
      let o = object;
      while (o) {
        const id = o.userData.interactId;
        if (id && this.items.has(id)) return this.items.get(id);
        o = o.parent;
      }
      return null;
    }

    update(dt) {
      this.raycaster.setFromCamera(this.center, this.renderer.camera);
      const targets = this.targets();
      const hits = targets.length ? this.raycaster.intersectObjects(targets, true) : [];
      let def = null, prompt = null, ctx = null;
      for (let i = 0; i < hits.length; i++) {
        const d = this.findDef(hits[i].object);
        if (!d || hits[i].distance > (d.range || 2.3)) continue;
        const c = { held: this.hands.item, distance: hits[i].distance, point: hits[i].point };
        const p = d.prompt(c);
        if (p) {
          def = d;
          prompt = p;
          ctx = c;
          break;
        }
      }

      if (def !== this.current) {
        this.resetHold();
        this.current = def;
      }
      if (!def) {
        this.state = { visible: false };
        return;
      }

      const enabled = prompt.enabled !== false;
      if (enabled && prompt.hold) {
        if (this.input.isDown('interact')) {
          if (!this.workSound && prompt.sound) this.workSound = this.sfx.work(prompt.sound);
          this.holdTime += dt;
          if (this.holdTime >= prompt.hold) {
            this.resetHold();
            def.onUse(ctx);
          }
        } else {
          this.resetHold();
        }
      } else if (enabled && this.input.wasPressed('interact')) {
        def.onUse(ctx);
      }

      this.state = {
        visible: true,
        text: prompt.text,
        enabled: enabled,
        hold: enabled ? prompt.hold || 0 : 0,
        progress: prompt.hold ? Math.min(1, this.holdTime / prompt.hold) : 0,
      };
    }

    resetHold() {
      this.holdTime = 0;
      if (this.workSound) {
        this.workSound.stop();
        this.workSound = null;
      }
    }
  }

  GK.InteractionService = decorate([
    Injectable(),
    Dependencies(GK.RendererService, GK.InputService, GK.HandsService, GK.SfxService, GK.EventBus, GK.LoopService),
  ], InteractionService);
})(window.GK);
