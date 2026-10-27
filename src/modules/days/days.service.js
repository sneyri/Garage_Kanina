/**
 * Распорядок дня — связывает конфиг, задания, предметы и мир:
 *   начало дня → разговор с Каниным → задания → «закрыть гараж» → конец дня → следующий день.
 * Сохраняемся в начале и в конце каждого дня.
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;
  const { pick } = GK.math;

  class DaysService {
    constructor(tasks, items, world, materials, interaction, hands, player, kanin, save, gameState, events, sfx, loop, days) {
      this.tasks = tasks;
      this.items = items;
      this.world = world;
      this.materials = materials;
      this.interaction = interaction;
      this.hands = hands;
      this.player = player;
      this.kanin = kanin;
      this.save = save;
      this.gameState = gameState;
      this.events = events;
      this.sfx = sfx;
      this.loop = loop;
      this.days = days;
      this.registered = [];
      this.fading = [];
      this.slotsUsed = {};
      this.elapsed = 0;
      this.scares = 0;
    }

    onModuleInit() {
      this.events.on('game.new', () => this.newGame());
      this.events.on('game.continue', () => this.continueGame());
      this.events.on('day.next', () => this.nextDay());
      this.events.on('game.quit', () => this.quit());
      this.events.on('task.completed', () => this.sfx.taskDone());
      this.events.on('horror.scare', () => { this.scares++; });
      this.loop.add('day', (dt) => this.update(dt), { priority: 5 });
    }

    get lastDay() {
      return this.days[this.days.length - 1].day;
    }

    newGame() {
      this.save.reset();
      this.beginDay(1);
    }

    continueGame() {
      const saved = this.save.load();
      this.beginDay(saved ? Math.min(saved.day, this.lastDay) : 1);
    }

    beginDay(number) {
      this.teardown();
      const config = this.tasks.startDay(number);
      this.world.clearDay();
      this.world.setGarageLights(true);
      this.world.setLed(false);
      this.world.setBikeState(Object.assign({ tireFlat: true, clutchNew: false }, config.bike));
      this.slotsUsed = {};
      this.restoreProgress(number);
      this.items.spawnAll(config.items || []);
      this.setupTasks(config);
      this.player.spawn(GK.LAYOUT.spawn);
      this.kanin.startDay(number);
      this.elapsed = 0;
      this.scares = 0;
      this.save.save({ day: number });
      this.gameState.set('cutscene', 'day-begin');
      this.events.emit('day.begin', { day: number, title: config.title, time: config.time });
    }

    /** То, что разложили в прошлые дни, остаётся на полках. */
    restoreProgress(number) {
      this.days.filter((d) => d.day < number).forEach((d) => {
        d.tasks.filter((t) => t.type === 'deliver').forEach((task) => {
          const target = this.world.targets[task.target];
          if (!target || !target.slots) return;
          const sources = (d.items || []).filter((i) => i.kind === task.kind);
          for (let k = 0; k < task.count && k < target.slots.length; k++) {
            const slot = target.slots[k];
            this.items.spawnStatic(task.kind, sources[k] && sources[k].variant, slot.position, slot.rotY);
          }
          this.slotsUsed[task.target] = Math.min(task.count, target.slots.length);
        });
      });
    }

    reg(def) {
      this.interaction.register(def);
      this.registered.push(def.id);
    }

    unreg(id) {
      this.interaction.unregister(id);
      this.registered = this.registered.filter((r) => r !== id);
    }

    setupTasks(config) {
      this.reg({
        id: 'kanin', object: this.kanin.model, range: 2.6,
        prompt: () => (this.kanin.busy ? null : { text: 'Поговорить с Каниным' }),
        onUse: () => this.talkToKanin(config),
      });
      const byTarget = {};
      config.tasks.forEach((task) => {
        if (task.type === 'clean') this.setupClean(task);
        else if (task.type === 'leave') this.setupLeave(task);
        else if (task.type === 'deliver' || task.type === 'use') (byTarget[task.target] = byTarget[task.target] || []).push(task);
      });
      Object.keys(byTarget).forEach((id) => this.setupTarget(id, byTarget[id]));
      this.setupLamp();
    }

    talkToKanin(config) {
      const talk = config.tasks.find((t) => t.type === 'talk');
      if (talk && !this.tasks.isDone(talk.id)) {
        this.kanin.talk(config.intro).then((completed) => {
          if (!completed) return;
          this.tasks.advance(talk.id);
          this.kanin.release();
        });
        return;
      }
      const open = this.tasks.nextOpenTask();
      const line = open && open.type !== 'leave' ? 'Ещё не всё. ' + open.title + '.' : this.kanin.randomLine();
      this.kanin.talk([line]);
    }

    setupClean(task) {
      const base = this.materials.get('stain');
      task.spots.forEach((spot, i) => {
        const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), base.clone());
        decal.rotation.x = -Math.PI / 2;
        decal.rotation.z = i * 1.7;
        decal.position.copy(this.world.toWorld(spot[0], 0.016, spot[1]));
        decal.receiveShadow = true;
        this.world.dayRoot.add(decal);
        const id = 'stain:' + task.id + ':' + i;
        this.reg({
          id: id, object: decal, range: 2.5,
          prompt: (ctx) => {
            if (this.tasks.isLocked(task.id)) return { text: 'Масляное пятно', enabled: false };
            if (!ctx.held || ctx.held.kind !== 'rag') return { text: 'Масляное пятно — нужна тряпка', enabled: false };
            return { text: 'Оттереть пятно', hold: 2.2, sound: 'wipe' };
          },
          onUse: () => {
            this.unreg(id);
            this.fading.push({ mesh: decal, t: 0 });
            this.tasks.advance(task.id);
          },
        });
      });
    }

    setupTarget(targetId, tasks) {
      const target = this.world.targets[targetId];
      if (!target) throw new Error('Цель "' + targetId + '" не найдена в мире');
      this.reg({
        id: 'target:' + targetId, object: target.proxy, range: 2.4,
        prompt: (ctx) => this.targetPrompt(target, tasks, ctx),
        onUse: (ctx) => this.targetUse(targetId, target, tasks, ctx),
      });
    }

    targetPrompt(target, tasks, ctx) {
      const held = ctx.held;
      const active = held && tasks.find((t) => !this.tasks.isDone(t.id) && t.kind === held.kind);
      if (active) {
        if (this.tasks.isLocked(active.id)) return { text: this.tasks.lockReason(active.id), enabled: false };
        if (active.type === 'deliver') return { text: (target.verb || 'Положить') + ': ' + held.label.toLowerCase() };
        return { text: active.verb, hold: active.hold, sound: active.sound };
      }
      if (held) return null;
      const pending = tasks.find((t) => !this.tasks.isDone(t.id));
      if (!pending) return { text: target.label + ' — готово', enabled: false };
      return { text: pending.type === 'use' && !this.tasks.isLocked(pending.id) ? pending.need : target.label, enabled: false };
    }

    targetUse(targetId, target, tasks, ctx) {
      const held = ctx.held;
      if (!held) return;
      const task = tasks.find((t) => !this.tasks.isDone(t.id) && !this.tasks.isLocked(t.id) && t.kind === held.kind);
      if (!task) return;
      if (task.type === 'deliver') {
        if (target.consume) {
          this.items.consume(held);
          this.sfx.trash(target.position);
        } else {
          const used = this.slotsUsed[targetId] || 0;
          const slot = target.slots[used % target.slots.length];
          this.slotsUsed[targetId] = used + 1;
          this.items.place(held, slot.position, slot.rotY);
          this.sfx.place();
        }
      } else {
        if (task.consume) this.items.consume(held);
        else if (task.relabel) {
          held.label = task.relabel;
          this.events.emit('hands.changed', { item: held });
        }
        if (task.effect) this.world.setBikeState(task.effect);
      }
      this.tasks.advance(task.id);
    }

    setupLeave(task) {
      this.world.garage.door.objects.forEach((object, i) => {
        this.reg({
          id: 'door:' + i, object: object, range: 2.6,
          prompt: () => (this.tasks.isLocked(task.id)
            ? { text: 'Уйти можно, когда всё сделано', enabled: false }
            : { text: 'Закрыть гараж и уйти', hold: 1.2, sound: 'creak' }),
          onUse: () => {
            if (this.tasks.advance(task.id)) this.endDay();
          },
        });
      });
    }

    setupLamp() {
      this.reg({
        id: 'led', object: this.world.garage.led.proxy, range: 2.4,
        prompt: () => ({ text: this.world.ledOn ? 'Выключить лампу' : 'Включить лампу' }),
        onUse: () => {
          this.world.setLed(!this.world.ledOn);
          this.sfx.switchOn();
        },
      });
    }

    endDay() {
      const day = this.tasks.dayNumber;
      const next = this.tasks.hasNextDay() ? day + 1 : null;
      const saved = this.save.load();
      const completed = (saved ? saved.completedDays : []).filter((d) => d !== day).concat([day]);
      const stats = saved ? saved.stats : { scares: 0, playTime: 0 };
      this.save.save({
        day: next || day,
        completedDays: completed,
        finished: !next,
        stats: { playTime: stats.playTime + this.elapsed, scares: stats.scares + this.scares },
      });
      this.teardown();
      this.gameState.set('cutscene', 'day-end');
      this.sfx.dayEnd();
      this.events.emit('day.end', {
        day: day, next: next, title: this.tasks.day.title, outro: this.tasks.day.outro,
        elapsed: this.elapsed, scares: this.scares,
      });
    }

    nextDay() {
      const saved = this.save.load();
      if (saved && saved.finished) {
        this.gameState.set('ending', 'prototype-end');
        this.events.emit('game.completed', { stats: saved.stats });
        return;
      }
      this.beginDay(saved ? saved.day : 1);
    }

    /** Для отладки: засчитать всё и закончить день. */
    skipDay() {
      if (!this.tasks.day) return;
      this.tasks.day.tasks.forEach((t) => this.tasks.forceComplete(t.id));
      this.endDay();
    }

    quit() {
      this.teardown();
      this.world.clearDay();
    }

    teardown() {
      this.registered.slice().forEach((id) => this.interaction.unregister(id));
      this.registered = [];
      this.fading = [];
      this.items.clear();
    }

    update(dt) {
      this.elapsed += dt;
      this.fading = this.fading.filter((f) => {
        f.t += dt;
        f.mesh.material.opacity = Math.max(0, 1 - f.t / 0.6);
        if (f.t < 0.6) return true;
        if (f.mesh.parent) f.mesh.parent.remove(f.mesh);
        return false;
      });
    }
  }

  GK.DaysService = decorate([
    Injectable(),
    Dependencies(GK.TasksService, GK.ItemsService, GK.WorldService, GK.MaterialsService, GK.InteractionService,
      GK.HandsService, GK.PlayerService, GK.KaninService, GK.SaveService, GK.GameStateService, GK.EventBus,
      GK.SfxService, GK.LoopService, GK.TOKENS.DAYS_CONFIG),
  ], DaysService);
})(window.GK);
