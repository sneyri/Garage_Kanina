/**
 * Реплики персонажей — субтитры по очереди. Новая реплика прерывает старую.
 * play() возвращает Promise: true — договорили, false — перебили.
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;

  class DialogueService {
    constructor(events) {
      this.events = events;
      this.active = false;
      this.timer = null;
      this.pendingResolve = null;
      /** Множитель скорости (в тестах ставим маленький, чтобы не ждать). */
      this.timeScale = 1;
    }

    get busy() {
      return this.active;
    }

    duration(text) {
      return 1.4 + text.length * 0.055;
    }

    play(speaker, lines) {
      this.cancel();
      this.active = true;
      return new Promise((resolve) => {
        this.pendingResolve = resolve;
        let index = 0;
        const next = () => {
          if (index >= lines.length) {
            this.finish(true);
            this.events.emit('subtitle.hide');
            return;
          }
          const text = lines[index++];
          const duration = this.duration(text);
          this.events.emit('subtitle.show', { speaker: speaker, text: text, duration: duration });
          this.timer = setTimeout(next, duration * 1000 * this.timeScale);
        };
        next();
      });
    }

    say(speaker, text) {
      return this.play(speaker, [text]);
    }

    stop() {
      this.cancel();
      this.events.emit('subtitle.hide');
    }

    cancel() {
      clearTimeout(this.timer);
      this.finish(false);
    }

    finish(completed) {
      this.active = false;
      const resolve = this.pendingResolve;
      this.pendingResolve = null;
      if (resolve) resolve(completed);
    }
  }

  GK.DialogueService = decorate([Injectable(), Dependencies(GK.EventBus)], DialogueService);
})(window.GK);
