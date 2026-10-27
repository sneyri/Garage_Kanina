/**
 * Звонок от «Смерть В Нищете» (как на скриншоте). Y — ответить, N — сбросить.
 * Если ответить — в трубке дыхание, а после разговора кто-то стоит за спиной.
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;

  const CALLER = Object.freeze({ name: 'Смерть В Нищете', photo: 'assets/img/caller.jpg' });
  const RING_TIME = 14;
  const TALK_TIME = 9.5;

  class PhoneCallService {
    constructor(sfx, dialogue, stalker, input, gameState, events, loop) {
      this.sfx = sfx;
      this.dialogue = dialogue;
      this.stalker = stalker;
      this.input = input;
      this.gameState = gameState;
      this.events = events;
      this.loop = loop;
      this.state = 'idle';
      this.sounds = [];
    }

    onModuleInit() {
      this.events.on('state.changed', (e) => {
        if (e.to === 'menu' || e.to === 'cutscene') this.end('interrupted');
      });
      this.loop.add('phone', (dt) => this.update(dt), { priority: 25 });
    }

    get caller() {
      return CALLER;
    }

    ring() {
      if (this.state !== 'idle') return false;
      this.state = 'ringing';
      this.time = 0;
      this.sounds = [this.sfx.ring()];
      this.events.emit('phone.ring', { caller: CALLER });
      return true;
    }

    answer() {
      if (this.state !== 'ringing') return;
      this.stopSounds();
      this.state = 'talking';
      this.time = 0;
      this.sounds = [this.sfx.staticNoise(), this.sfx.breathing()];
      this.events.emit('phone.answered', { caller: CALLER });
      this.dialogue.play(CALLER.name, ['…', '*тяжёлое дыхание*', '…ты один в гараже?', '…обернись.']);
    }

    update(dt) {
      if (this.state === 'ringing') {
        this.time += dt;
        if (this.input.wasPressed('answer')) this.answer();
        else if (this.input.wasPressed('decline')) this.end('declined');
        else if (this.time > RING_TIME) this.end('missed');
      } else if (this.state === 'talking') {
        this.time += dt;
        if (this.time > TALK_TIME || this.input.wasPressed('decline')) this.end('hangup');
      }
    }

    end(reason) {
      if (this.state === 'idle') return;
      const wasTalking = this.state === 'talking';
      this.stopSounds();
      this.state = 'idle';
      if (wasTalking) this.dialogue.stop();
      this.events.emit('phone.ended', { reason: reason, caller: CALLER });
      if (reason === 'missed') this.events.emit('toast', { text: 'Пропущенный вызов: ' + CALLER.name });
      if (wasTalking && reason === 'hangup') {
        setTimeout(() => {
          if (this.gameState.is('playing')) this.stalker.spawn('behind');
        }, 1200);
      }
    }

    stopSounds() {
      this.sounds.forEach((s) => s.stop());
      this.sounds = [];
    }
  }

  GK.PHONE_CALLER = CALLER;
  GK.PhoneCallService = decorate([
    Injectable(),
    Dependencies(GK.SfxService, GK.DialogueService, GK.StalkerService, GK.InputService, GK.GameStateService, GK.EventBus, GK.LoopService),
  ], PhoneCallService);
})(window.GK);
