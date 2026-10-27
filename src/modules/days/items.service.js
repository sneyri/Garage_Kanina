/**
 * Предметы дня: создаёт их по конфигу, делает «поднимаемыми», кладёт на место.
 * G — бросить предмет из рук перед собой.
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;

  class ItemsService {
    constructor(props, world, colliders, interaction, hands, player, input, sfx, loop, kinds) {
      this.props = props;
      this.world = world;
      this.colliders = colliders;
      this.interaction = interaction;
      this.hands = hands;
      this.player = player;
      this.input = input;
      this.sfx = sfx;
      this.loop = loop;
      this.kinds = kinds;
      this.items = new Map();
    }

    onModuleInit() {
      this.loop.add('items-drop', () => {
        if (this.input.wasPressed('drop')) this.drop();
      }, { priority: 21 });
    }

    spawnAll(defs) {
      defs.forEach((def) => this.spawn(def));
    }

    spawn(def) {
      const kind = this.kinds[def.kind];
      if (!kind) throw new Error('Неизвестный вид предмета: ' + def.kind);
      const object = this.props.item(def.kind, def.variant);
      object.position.copy(this.world.resolvePosition(def.pos, def.space));
      object.rotation.y = def.rotY || 0;
      this.world.dayRoot.add(object);
      const item = { id: def.id, kind: def.kind, label: kind.label, hold: kind.hold, object: object, state: 'world' };
      this.items.set(item.id, item);
      this.makePickable(item);
      return item;
    }

    /** Предмет-декорация без взаимодействия (то, что разложили в прошлые дни). */
    spawnStatic(kind, variant, position, rotY) {
      const object = this.props.item(kind, variant);
      object.position.copy(position);
      object.rotation.y = rotY || 0;
      this.world.dayRoot.add(object);
      return object;
    }

    makePickable(item) {
      this.interaction.register({
        id: 'item:' + item.id,
        object: item.object,
        range: 2.2,
        prompt: (ctx) => (ctx.held ? null : { text: 'Взять: ' + item.label }),
        onUse: () => this.pickUp(item),
      });
    }

    pickUp(item) {
      if (!this.hands.take(item)) return;
      this.interaction.unregister('item:' + item.id);
      item.state = 'hands';
    }

    drop() {
      const item = this.hands.item;
      if (!item) return false;
      const f = this.player.getForward();
      const len = Math.sqrt(f.x * f.x + f.z * f.z) || 1;
      const spot = this.colliders.resolve(this.player.position.x + (f.x / len) * 0.7, this.player.position.z + (f.z / len) * 0.7, 0.2);
      const floor = this.world.floorHeight(spot.x, spot.z) || 0.012;
      this.hands.placeAt(this.world.dayRoot, new THREE.Vector3(spot.x, floor, spot.z), this.player.yaw);
      item.state = 'world';
      this.makePickable(item);
      this.sfx.place();
      return true;
    }

    /** Поставить предмет из рук в конкретное место (полка). Больше не поднимается. */
    place(item, position, rotY) {
      this.hands.placeAt(this.world.dayRoot, position, rotY);
      item.state = 'placed';
    }

    consume(item) {
      this.hands.consume();
      this.items.delete(item.id);
      item.state = 'gone';
    }

    clear() {
      if (this.hands.item) this.hands.consume();
      this.items.forEach((item) => this.interaction.unregister('item:' + item.id));
      this.items.clear();
    }
  }

  GK.ItemsService = decorate([
    Injectable(),
    Dependencies(GK.PropsFactory, GK.WorldService, GK.CollidersService, GK.InteractionService, GK.HandsService,
      GK.PlayerService, GK.InputService, GK.SfxService, GK.LoopService, GK.TOKENS.ITEM_KINDS),
  ], ItemsService);
})(window.GK);
