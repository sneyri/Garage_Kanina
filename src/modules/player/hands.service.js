/**
 * Руки игрока: можно нести один предмет. Предмет «прикрепляется» к камере
 * и снова становится частью мира, когда его кладут.
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;

  class HandsService {
    constructor(renderer, events, sfx, loop) {
      this.renderer = renderer;
      this.events = events;
      this.sfx = sfx;
      this.loop = loop;
      this.held = null;
    }

    onModuleInit() {
      if (!this.renderer.camera) return;
      this.holder = new THREE.Group();
      this.holder.position.set(0.28, -0.3, -0.55);
      this.renderer.camera.add(this.holder);
      this.loop.add('hands', (dt, t) => { this.holder.position.y = -0.3 + Math.sin(t * 1.7) * 0.006; }, { priority: 13 });
    }

    get item() {
      return this.held;
    }

    isHolding(kind) {
      return !!this.held && (!kind || this.held.kind === kind);
    }

    take(item) {
      if (this.held) return false;
      this.held = item;
      const hold = item.hold || {};
      this.holder.add(item.object);
      item.object.position.set(hold.x || 0, hold.y || 0, hold.z || 0);
      item.object.rotation.set(hold.rx || 0, hold.ry || 0, hold.rz || 0);
      GK.geo.setShadows(item.object, false, false);
      this.sfx.pickup();
      this.events.emit('hands.changed', { item: item });
      return true;
    }

    release() {
      const item = this.held;
      if (!item) return null;
      this.held = null;
      this.events.emit('hands.changed', { item: null });
      return item;
    }

    /** Положить предмет в мир. */
    placeAt(parent, position, rotY) {
      const item = this.release();
      if (!item) return null;
      parent.add(item.object);
      item.object.position.copy(position);
      item.object.rotation.set(0, rotY || 0, 0);
      GK.geo.setShadows(item.object, true, true);
      return item;
    }

    /** Предмет израсходован (выброшен, установлен). */
    consume() {
      const item = this.release();
      if (item && item.object.parent) item.object.parent.remove(item.object);
      return item;
    }
  }

  GK.HandsService = decorate([
    Injectable(),
    Dependencies(GK.RendererService, GK.EventBus, GK.SfxService, GK.LoopService),
  ], HandsService);
})(window.GK);
