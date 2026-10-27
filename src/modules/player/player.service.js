/**
 * Игрок от первого лица: мышь — взгляд, WASD — ходьба, Shift — бег.
 * Покачивание головы, шаги со звуком по поверхности (снег, бетон, доски).
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;
  const { clamp, damp } = GK.math;

  const WALK_SPEED = 2.3;
  const RUN_SPEED = 3.9;
  const EYE_HEIGHT = 1.62;
  const RADIUS = 0.3;

  class PlayerService {
    constructor(renderer, input, colliders, world, settings, sfx, audio, events, loop) {
      this.renderer = renderer;
      this.input = input;
      this.colliders = colliders;
      this.world = world;
      this.settings = settings;
      this.sfx = sfx;
      this.audio = audio;
      this.events = events;
      this.loop = loop;
      this.inside = false;
    }

    onModuleInit() {
      if (!this.renderer.camera) return;
      this.camera = this.renderer.camera;
      this.position = new THREE.Vector3();
      this.velocity = new THREE.Vector2();
      this.forward = new THREE.Vector3();
      this.yaw = 0;
      this.pitch = 0;
      this.bob = 0;
      this.bobAmount = 0;
      this.stepDistance = 0;
      this.spawn(GK.LAYOUT.spawn);
      this.loop.add('player', (dt) => this.update(dt), { priority: 10 });
      this.loop.add('listener', () => this.updateListener(), { states: ['*'], priority: 950 });
    }

    spawn(point) {
      this.position.set(point.x, this.world.floorHeight(point.x, point.z), point.z);
      this.yaw = point.yaw || 0;
      this.pitch = 0;
      this.velocity.set(0, 0);
      this.input.consumeMouse();
      this.applyCamera();
      this.setInside(GK.isInsideGarage(point.x, point.z));
    }

    /** Направление взгляда (единичный вектор). */
    getForward() {
      return this.camera.getWorldDirection(this.forward);
    }

    update(dt) {
      const s = this.settings;
      const mouse = this.input.consumeMouse();
      const sensitivity = 0.0022 * s.get('sensitivity');
      this.yaw -= mouse.dx * sensitivity;
      this.pitch = clamp(this.pitch - mouse.dy * sensitivity * (s.get('invertY') ? -1 : 1), -1.45, 1.45);

      const axis = this.input.axis();
      let ax = axis.x, az = axis.z;
      const len = Math.sqrt(ax * ax + az * az);
      if (len > 1) {
        ax /= len;
        az /= len;
      }
      const running = this.input.isDown('run') && az > 0;
      const speed = running ? RUN_SPEED : WALK_SPEED;
      // При yaw = 0 взгляд направлен в −Z
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const wishX = (-sin * az + cos * ax) * speed;
      const wishZ = (-cos * az - sin * ax) * speed;
      this.velocity.x = damp(this.velocity.x, wishX, 12, dt);
      this.velocity.y = damp(this.velocity.y, wishZ, 12, dt);

      const prevX = this.position.x, prevZ = this.position.z;
      const next = this.colliders.resolve(prevX + this.velocity.x * dt, prevZ + this.velocity.y * dt, RADIUS);
      this.position.x = next.x;
      this.position.z = next.z;
      this.position.y = damp(this.position.y, this.world.floorHeight(next.x, next.z), 14, dt);

      const moved = Math.sqrt((next.x - prevX) * (next.x - prevX) + (next.z - prevZ) * (next.z - prevZ));
      const stepLength = running ? 0.78 : 0.62;
      this.stepDistance += moved;
      if (this.stepDistance >= stepLength) {
        this.stepDistance = 0;
        this.sfx.footstep(this.world.surfaceAt(next.x, next.z), running);
      }
      this.bob += (moved / stepLength) * Math.PI;
      const speedNow = moved / Math.max(dt, 1e-4);
      this.bobAmount = damp(this.bobAmount, s.get('headBob') ? Math.min(1.3, speedNow / WALK_SPEED) : 0, 8, dt);

      this.applyCamera();
      this.setInside(GK.isInsideGarage(next.x, next.z));
    }

    applyCamera() {
      const b = this.bobAmount;
      const sway = Math.cos(this.bob) * 0.022 * b;
      this.camera.position.set(
        this.position.x + Math.cos(this.yaw) * sway,
        this.position.y + EYE_HEIGHT + Math.abs(Math.sin(this.bob)) * 0.045 * b - 0.02 * b,
        this.position.z - Math.sin(this.yaw) * sway
      );
      this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bob) * 0.008 * b, 'YXZ');
    }

    updateListener() {
      if (this.camera) this.audio.setListener(this.camera.position, this.getForward());
    }

    setInside(inside) {
      if (inside === this.inside) return;
      this.inside = inside;
      this.events.emit('player.indoor', { inside: inside });
    }
  }

  GK.PlayerService = decorate([
    Injectable(),
    Dependencies(GK.RendererService, GK.InputService, GK.CollidersService, GK.WorldService, GK.SettingsService,
      GK.SfxService, GK.AudioService, GK.EventBus, GK.LoopService),
  ], PlayerService);
})(window.GK);
