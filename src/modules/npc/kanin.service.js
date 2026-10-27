/**
 * Канин. Пока не поговорили — ждёт у верстака. Потом бродит по точкам
 * (верстак, стеллаж, питбайк, ворота, проезд), поглядывает на игрока и бормочет.
 * В главном меню стоит в воротах и смотрит наружу.
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;
  const { rand, pick, wrapAngle, dist2d } = GK.math;

  const WAYPOINTS = [
    { id: 'bench', u: 5.35, v: 1.0, look: [6.5, 1.0] },
    { id: 'shelf', u: 5.45, v: -0.95, look: [6.5, -1.0] },
    { id: 'bikeR', u: 3.3, v: 1.15, look: [3.3, 0] },
    { id: 'bikeL', u: 2.9, v: -1.0, look: [3.3, 0] },
    { id: 'entry', u: 0.7, v: 0.35 },
    { id: 'door', x: 3.0, z: -6.6 },
    { id: 'lane', x: 1.2, z: -3.2 },
    { id: 'laneFar', x: -0.8, z: -12.5 },
  ];

  const EDGES = [
    ['bench', 'shelf'], ['bench', 'bikeR'], ['shelf', 'bikeL'], ['bikeR', 'entry'],
    ['bikeL', 'entry'], ['entry', 'door'], ['door', 'lane'], ['door', 'laneFar'],
  ];

  const IDLE_LINES = [
    'Ты это… в подвал не лезь. Там сыро.',
    'Свет опять моргает. Проводка старая.',
    'Респиратор не снимаю. Пыль тут… разная.',
    'Слышал? Нет? Ну и ладно.',
    'Тут раньше один пацан помогал. Потом перестал приходить.',
    'Зима в этом году длинная.',
    'Над ямой не стой. Доски гнилые.',
    'Не смотри на меня так. Работай.',
  ];

  const WALK_SPEED = 1.05;

  class KaninService {
    constructor(characters, renderer, world, player, dialogue, gameState, loop) {
      this.characters = characters;
      this.renderer = renderer;
      this.world = world;
      this.player = player;
      this.dialogue = dialogue;
      this.gameState = gameState;
      this.loop = loop;
      this.busy = false;
    }

    onModuleInit() {
      if (!this.renderer.scene) return;
      const built = this.characters.kanin();
      this.model = built.group;
      this.rig = built.rig;
      this.renderer.scene.add(this.model);

      this.points = {};
      this.looks = {};
      WAYPOINTS.forEach((w) => {
        this.points[w.id] = w.u !== undefined ? this.world.toWorld(w.u, 0, w.v) : new THREE.Vector3(w.x, 0, w.z);
        this.looks[w.id] = w.look ? this.world.toWorld(w.look[0], 0, w.look[1]) : null;
      });
      this.neighbors = {};
      EDGES.forEach((e) => {
        (this.neighbors[e[0]] = this.neighbors[e[0]] || []).push(e[1]);
        (this.neighbors[e[1]] = this.neighbors[e[1]] || []).push(e[0]);
      });

      this.yaw = 0;
      this.walkPhase = 0;
      this.startDay();
      this.loop.add('kanin', (dt, t) => this.update(dt, t), { states: ['boot', 'menu', 'ending', 'playing', 'cutscene'] });
    }

    startDay() {
      this.state = 'idle';
      this.waitForTalk = true;
      this.greeted = false;
      this.busy = false;
      this.target = null;
      this.timer = 2;
      this.mumbleTimer = rand(30, 50);
      this.placeAt('bench');
    }

    /** После разговора Канин начинает бродить. */
    release() {
      this.waitForTalk = false;
    }

    talk(lines) {
      this.busy = true;
      this.state = 'talk';
      return this.dialogue.play('Канин', lines).then((completed) => {
        this.busy = false;
        this.state = 'idle';
        this.timer = rand(2, 5);
        return completed;
      });
    }

    say(text) {
      return this.dialogue.say('Канин', text);
    }

    randomLine() {
      return pick(IDLE_LINES);
    }

    placeAt(id) {
      const p = this.points[id];
      this.model.position.set(p.x, this.world.floorHeight(p.x, p.z), p.z);
      this.at = id;
    }

    update(dt, t) {
      if (this.gameState.is('boot', 'menu', 'ending')) {
        this.menuPose(t);
        return;
      }
      const pos = this.model.position;
      const player = this.player.position;
      const toPlayer = dist2d(pos.x, pos.z, player.x, player.z);

      if (this.state === 'talk') {
        this.faceTowards(player, dt, 6);
        this.animate(dt, 0, t);
        this.rig.armR.rotation.x = -0.35 + Math.sin(t * 3) * 0.15;
      } else if (this.state === 'idle') {
        this.timer -= dt;
        const look = toPlayer < 5 ? player : this.looks[this.at];
        if (look) this.faceTowards(look, dt, 2.5);
        this.animate(dt, 0, t);
        if (this.timer <= 0 && !this.waitForTalk) {
          this.target = pick(this.neighbors[this.at]);
          this.state = 'walk';
        }
      } else if (this.state === 'walk') {
        const target = this.points[this.target];
        const dx = target.x - pos.x, dz = target.z - pos.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        // уступаем дорогу, если игрок стоит прямо по курсу
        const blocked = toPlayer < 0.9 && ((player.x - pos.x) * dx + (player.z - pos.z) * dz) > 0;
        if (!blocked && d > 0.001) {
          const step = Math.min(d, WALK_SPEED * dt);
          pos.x += (dx / d) * step;
          pos.z += (dz / d) * step;
        }
        pos.y = this.world.floorHeight(pos.x, pos.z);
        this.faceTowards(target, dt, 6);
        this.animate(dt, blocked ? 0 : 1, t);
        if (d < 0.05) {
          this.at = this.target;
          this.target = null;
          this.state = 'idle';
          this.timer = this.at === 'bench' || this.at === 'shelf' ? rand(5, 12) : rand(2, 6);
        }
      }

      if (this.waitForTalk && !this.greeted && this.player.inside && this.gameState.is('playing')) {
        this.greeted = true;
        this.say('Пришёл? Подойди.');
      }
      if (this.state !== 'talk' && toPlayer < 5.5 && !this.dialogue.busy && this.gameState.is('playing')) {
        this.mumbleTimer -= dt;
        if (this.mumbleTimer <= 0) {
          this.mumbleTimer = rand(35, 70);
          this.say(this.randomLine());
        }
      }
      this.rig.lamp.light.intensity = 1.3 * (0.9 + Math.random() * 0.1);
    }

    faceTowards(p, dt, speed) {
      const pos = this.model.position;
      const desired = Math.atan2(p.x - pos.x, p.z - pos.z);
      this.yaw += wrapAngle(desired - this.yaw) * Math.min(1, speed * dt);
      this.model.rotation.y = this.yaw;
    }

    animate(dt, walking, t) {
      const rig = this.rig;
      this.walkPhase += dt * 6.5 * walking;
      const swing = Math.sin(this.walkPhase) * 0.5 * walking;
      rig.legL.rotation.x = swing;
      rig.legR.rotation.x = -swing;
      rig.armL.rotation.x = -swing * 0.7;
      rig.armR.rotation.x = swing * 0.7;
      rig.torso.position.y = 0.9 + Math.abs(Math.cos(this.walkPhase)) * 0.025 * walking + Math.sin(t * 1.6) * 0.004;
      rig.head.rotation.x = Math.sin(t * 0.7) * 0.04;
    }

    /** Меню: стоит в воротах, смотрит на улицу, чуть поворачивает голову. */
    menuPose(t) {
      const p = this.world.toWorld(0.55, 0, -0.35);
      this.model.position.copy(p);
      this.yaw = -Math.PI / 2 + Math.sin(t * 0.2) * 0.15;
      this.model.rotation.y = this.yaw;
      this.animate(0, 0, t);
      this.rig.head.rotation.y = Math.sin(t * 0.31) * 0.25;
    }
  }

  GK.KaninService = decorate([
    Injectable(),
    Dependencies(GK.CharacterFactory, GK.RendererService, GK.WorldService, GK.PlayerService, GK.DialogueService,
      GK.GameStateService, GK.LoopService),
  ], KaninService);
})(window.GK);
