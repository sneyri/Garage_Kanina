/**
 * «Режиссёр» пугалок: раз в 35–70 секунд (чем дальше день, тем чаще)
 * выбирает случайное событие из подходящих по дню, месту и перезарядке.
 * Любое событие можно вызвать вручную из отладочной панели (F2).
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;
  const { rand, pick, weightedPick } = GK.math;

  const EVENTS = Object.freeze([
    { id: 'clang', title: 'Лязг вдалеке', minDay: 1, weight: 3, cooldown: 30 },
    { id: 'creak', title: 'Скрип ворот', minDay: 1, weight: 2, cooldown: 40 },
    { id: 'knock', title: 'Стук из подвала', minDay: 1, weight: 2, cooldown: 60, inside: true },
    { id: 'flicker', title: 'Мигание лампы', minDay: 1, weight: 3, cooldown: 25, inside: true },
    { id: 'stalkerFar', title: '«Тип» вдалеке', minDay: 1, weight: 2, cooldown: 70 },
    { id: 'doorway', title: '«Тип» в воротах', minDay: 1, weight: 1, cooldown: 90, inside: true },
    { id: 'phone', title: 'Звонок', minDay: 2, weight: 3, cooldown: 9999, oncePerDay: true },
    { id: 'blackout', title: 'Выбило пробки', minDay: 2, weight: 1, cooldown: 150, inside: true },
    { id: 'stalkerBehind', title: '«Тип» за спиной', minDay: 2, weight: 1, cooldown: 120 },
  ]);

  const HATCH_LINES = ['Заперто.', 'Снизу тянет холодом.', 'Замок покрыт инеем. Изнутри.', 'Там кто-то есть?'];

  class ScareDirectorService {
    constructor(world, stalker, phone, flashlight, sfx, dialogue, interaction, player, tasks, gameState, events, loop) {
      this.world = world;
      this.stalker = stalker;
      this.phone = phone;
      this.flashlight = flashlight;
      this.sfx = sfx;
      this.dialogue = dialogue;
      this.interaction = interaction;
      this.player = player;
      this.tasks = tasks;
      this.gameState = gameState;
      this.events = events;
      this.loop = loop;
      this.enabled = true;
      this.cooldowns = {};
      this.used = {};
      this.timer = 45;
      this.menuTimer = 25;
    }

    get catalog() {
      return EVENTS;
    }

    onModuleInit() {
      if (!this.world.ready) return;
      this.events.on('day.begin', () => this.resetDay());
      this.events.on('state.changed', (e) => {
        if (e.to === 'menu') this.menuTimer = 25;
      });
      this.loop.add('scare-director', (dt) => this.update(dt), { states: ['playing', 'menu'], priority: 26 });
    }

    resetDay() {
      this.timer = rand(40, 60);
      this.cooldowns = {};
      this.used = {};
      this.hatchTries = 0;
      this.endBlackout(true);
      this.setupHatch();
    }

    update(dt) {
      if (this.gameState.is('menu')) {
        this.menuTimer -= dt;
        if (this.menuTimer <= 0) {
          this.menuTimer = rand(35, 60);
          this.stalker.spawn('menu');
        }
        return;
      }
      Object.keys(this.cooldowns).forEach((k) => { this.cooldowns[k] -= dt; });
      if (!this.enabled) return;
      this.timer -= dt;
      if (this.timer > 0) return;

      const day = this.tasks.dayNumber;
      const pool = EVENTS.filter((e) => day >= e.minDay
        && !(this.cooldowns[e.id] > 0)
        && !(e.oncePerDay && this.used[e.id])
        && (!e.inside || this.player.inside));
      if (pool.length) {
        const event = weightedPick(pool);
        if (this.trigger(event.id)) {
          this.cooldowns[event.id] = event.cooldown;
          this.used[event.id] = true;
        }
      }
      this.timer = rand(35, 70) / (1 + 0.3 * (day - 1));
    }

    /** Запустить событие по id. Возвращает true, если оно действительно произошло. */
    trigger(id) {
      switch (id) {
        case 'clang': this.sfx.clang(this.randomFar(), 1); return true;
        case 'creak': this.sfx.creak(this.randomFar()); return true;
        case 'knock': this.sfx.knock(this.world.garage.hatch.position, 3); return true;
        case 'flicker':
          this.world.flickerBulb(2.2);
          this.flashlight.flicker(0.6);
          return true;
        case 'stalkerFar': return this.stalker.spawn('far');
        case 'doorway': return this.stalker.spawn('doorway');
        case 'stalkerBehind': return this.stalker.spawn('behind');
        case 'phone': return this.phone.ring();
        case 'blackout': return this.blackout();
        default: return false;
      }
    }

    randomFar() {
      const p = this.player.position, a = Math.random() * Math.PI * 2;
      return { x: p.x + Math.cos(a) * 14, y: 1, z: p.z + Math.sin(a) * 14 };
    }

    blackout() {
      if (!this.world.garageLightsOn) return false;
      this.world.setGarageLights(false);
      this.sfx.lightOff();
      this.flashlight.flicker(0.4);
      const panel = this.world.garage.panel;
      panel.lever.rotation.z = -1.2;
      this.interaction.register({
        id: 'panel', object: panel.proxy, range: 2.4,
        prompt: () => ({ text: 'Поднять рубильник', hold: 0.6 }),
        onUse: () => this.endBlackout(false),
      });
      setTimeout(() => this.dialogue.say('Канин', 'Опять пробки выбило. Щиток у входа — подними рубильник.'), 900);
      return true;
    }

    endBlackout(silent) {
      if (this.interaction.has('panel')) this.interaction.unregister('panel');
      this.world.garage.panel.lever.rotation.z = 0;
      if (!this.world.garageLightsOn) {
        this.world.setGarageLights(true);
        if (!silent) this.sfx.switchOn();
      }
    }

    /** Тизер подвала: люк заперт, а в первый раз в ответ стучат снизу. */
    setupHatch() {
      const hatch = this.world.garage.hatch;
      this.interaction.register({
        id: 'hatch', object: hatch.proxy, range: 2.2,
        prompt: () => ({ text: 'Люк в подвал' }),
        onUse: () => {
          this.hatchTries++;
          this.sfx.place();
          if (this.hatchTries === 1) {
            this.dialogue.say('', 'Заперто. Замок ржавый, но крепкий.');
            setTimeout(() => this.sfx.knock(hatch.position, 3), 1800);
          } else {
            this.dialogue.say('', pick(HATCH_LINES));
          }
        },
      });
    }
  }

  GK.SCARE_EVENTS = EVENTS;
  GK.ScareDirectorService = decorate([
    Injectable(),
    Dependencies(GK.WorldService, GK.StalkerService, GK.PhoneCallService, GK.FlashlightService, GK.SfxService,
      GK.DialogueService, GK.InteractionService, GK.PlayerService, GK.TasksService, GK.GameStateService,
      GK.EventBus, GK.LoopService),
  ], ScareDirectorService);
})(window.GK);
