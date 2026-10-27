/**
 * «Тип» — прототип пугающего персонажа. Появляется там, куда игрок не смотрит,
 * и исчезает со «стингом», как только его заметили (в луче фонаря или по светящимся глазам).
 *
 * Режимы:
 *   far     — далеко в проезде или в проулке
 *   doorway — стоит снаружи в воротах, пока игрок в гараже
 *   behind  — прямо за спиной
 *   menu    — пасхалка в главном меню: глаза в конце проезда
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;
  const { pick, dist2d } = GK.math;

  const LIFETIME = { far: 18, doorway: 12, behind: 6, menu: 4.5 };

  class StalkerService {
    constructor(characters, renderer, player, world, colliders, flashlight, sfx, events, gameState, loop) {
      this.characters = characters;
      this.renderer = renderer;
      this.player = player;
      this.world = world;
      this.colliders = colliders;
      this.flashlight = flashlight;
      this.sfx = sfx;
      this.events = events;
      this.gameState = gameState;
      this.loop = loop;
      this.active = false;
      this.mode = null;
    }

    onModuleInit() {
      if (!this.renderer.scene) return;
      const built = this.characters.stalker();
      this.model = built.group;
      this.rig = built.rig;
      this.model.visible = false;
      this.renderer.scene.add(this.model);
      this.dir = new THREE.Vector3();
      this.events.on('state.changed', (e) => {
        if (e.to === 'menu' || e.from === 'menu' || e.to === 'cutscene') this.hide();
      });
      this.loop.add('stalker', (dt, t) => this.update(dt, t), { states: ['playing', 'menu'], priority: 24 });
    }

    spawn(mode) {
      if (this.active || !this.model) return false;
      const spot = this.findSpot(mode);
      if (!spot) return false;
      this.model.position.set(spot.x, this.world.floorHeight(spot.x, spot.z), spot.z);
      this.model.visible = true;
      this.active = true;
      this.mode = mode;
      this.seen = 0;
      this.life = LIFETIME[mode];
      this.faceCamera();
      if (mode === 'behind') this.breath = this.sfx.breathing({ x: spot.x, y: 1.6, z: spot.z });
      this.events.emit('horror.stalker', { mode: mode });
      return true;
    }

    findSpot(mode) {
      if (mode === 'menu') return { x: 1.8, z: -15 };
      const p = this.player.position;
      if (mode === 'doorway') return this.player.inside ? { x: 2.5, z: -6.75 } : null;
      const f = this.player.getForward();
      const len = Math.sqrt(f.x * f.x + f.z * f.z) || 1;
      const fx = f.x / len, fz = f.z / len;
      if (mode === 'behind') {
        const x = p.x - fx * 2.2, z = p.z - fz * 2.2;
        const sameZone = GK.isInsideGarage(x, z) === this.player.inside;
        return sameZone && this.colliders.isFree(x, z, 0.35) ? { x: x, z: z } : null;
      }
      // far: не ближе 6 м, не дальше 32 м, и не там, куда игрок смотрит прямо сейчас
      const candidates = this.world.row.stalkerSpots.filter((s) => {
        const d = dist2d(p.x, p.z, s.x, s.z);
        if (d < 6 || d > 32) return false;
        return ((s.x - p.x) * fx + (s.z - p.z) * fz) / d < 0.5;
      });
      const open = candidates.filter((s) => !this.colliders.segmentBlocked(p.x, p.z, s.x, s.z, 'gate'));
      return pick(open.length ? open : candidates) || null;
    }

    faceCamera() {
      const cam = this.renderer.camera.position;
      this.model.rotation.y = Math.atan2(cam.x - this.model.position.x, cam.z - this.model.position.z);
    }

    update(dt, t) {
      if (!this.active) return;
      this.life -= dt;
      this.faceCamera();
      this.rig.head.rotation.z = 0.3 + (Math.random() < 0.03 ? (Math.random() - 0.5) * 0.7 : 0);
      this.rig.armL.rotation.x = -0.12 + Math.sin(t * 9) * 0.02;

      if (this.gameState.is('menu')) {
        if (this.life <= 0) this.hide();
        return;
      }

      const cam = this.renderer.camera;
      const hx = this.model.position.x, hy = this.model.position.y + 1.65, hz = this.model.position.z;
      const tx = hx - cam.position.x, ty = hy - cam.position.y, tz = hz - cam.position.z;
      const dist = Math.sqrt(tx * tx + ty * ty + tz * tz);
      const f = cam.getWorldDirection(this.dir);
      const dot = (tx * f.x + ty * f.y + tz * f.z) / dist;
      const clear = !this.colliders.segmentBlocked(cam.position.x, cam.position.z, hx, hz, 'gate');
      const lit = this.flashlight.isLit && dist < 15 && dot > 0.86;
      const eyes = dist < 30 && dot > 0.94;

      if (clear && (lit || eyes)) this.seen += dt;
      if (this.mode === 'behind' && clear && dot > 0.5) this.seen += dt * 4;

      const threshold = this.mode === 'far' ? 0.5 : 0.12;
      if (this.seen > threshold || dist < 1.3) this.vanish(true);
      else if (this.life <= 0) this.vanish(false);
    }

    vanish(seen) {
      const mode = this.mode;
      this.hide();
      if (!seen) return;
      const strength = mode === 'behind' ? 1 : mode === 'doorway' ? 0.8 : 0.55;
      this.sfx.sting(strength);
      this.flashlight.flicker(0.5 + strength * 0.4);
      this.events.emit('horror.scare', { kind: 'stalker-' + mode, strength: strength });
    }

    hide() {
      if (this.model) this.model.visible = false;
      this.active = false;
      if (this.breath) {
        this.breath.stop();
        this.breath = null;
      }
    }
  }

  GK.StalkerService = decorate([
    Injectable(),
    Dependencies(GK.CharacterFactory, GK.RendererService, GK.PlayerService, GK.WorldService, GK.CollidersService,
      GK.FlashlightService, GK.SfxService, GK.EventBus, GK.GameStateService, GK.LoopService),
  ], StalkerService);
})(window.GK);
