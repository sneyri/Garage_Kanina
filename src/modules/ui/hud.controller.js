/**
 * Интерфейс поверх игры: подсказка действия, кольцо удержания, список дел,
 * предмет в руках, субтитры, уведомления, телефон и визуальные эффекты испуга.
 */
(function (GK) {
  'use strict';

  const { Controller, Dependencies, decorate } = GK.common;
  const { $, escape } = GK.dom;

  const RING = 2 * Math.PI * 18;

  class HudController {
    constructor(gameState, interaction, settings, events, loop) {
      this.gameState = gameState;
      this.interaction = interaction;
      this.settings = settings;
      this.events = events;
      this.loop = loop;
      this.lastPrompt = null;
    }

    onModuleInit() {
      if (typeof document === 'undefined') return;
      this.el = {
        prompt: $('#prompt'), promptKey: $('#prompt .key'), promptText: $('#prompt-text'),
        ring: $('#hold-ring'), ringFg: $('#ring-fg'), crosshair: $('#crosshair'),
        tasksDay: $('#tasks-day'), tasksTitle: $('#tasks-title'), tasksList: $('#tasks-list'),
        hand: $('#hand'), subs: $('#subtitles'), subSpeaker: $('#sub-speaker'), subText: $('#sub-text'),
        toast: $('#toast'), scare: $('#fx-scare'),
        phone: $('#phone'), phoneName: $('#phone-name'), phoneState: $('#phone-state'), phoneClock: $('#phone-clock'),
        phoneActions: $('#phone-actions'), phonePhoto: $('#phone-photo'),
        error: $('#error'), errorText: $('#error-text'),
      };
      this.el.ringFg.style.strokeDasharray = String(RING);
      document.body.dataset.state = this.gameState.state;

      const on = (event, fn) => this.events.on(event, fn);
      on('state.changed', (e) => { document.body.dataset.state = e.to; });
      on('tasks.changed', (e) => this.renderTasks(e));
      on('hands.changed', (e) => this.renderHand(e.item));
      on('subtitle.show', (e) => this.showSubtitle(e));
      on('subtitle.hide', () => this.el.subs.classList.remove('is-visible'));
      on('task.completed', (e) => { if (e.type !== 'talk' && e.type !== 'leave') this.toast('✓ ' + e.title); });
      on('day.ready', () => this.toast('Всё сделано. Можно закрывать гараж.'));
      on('toast', (e) => this.toast(e.text));
      on('player.indoor', (e) => document.body.classList.toggle('is-indoor', e.inside));
      on('horror.scare', (e) => this.scare(e.strength));
      on('phone.ring', (e) => this.phoneRing(e.caller));
      on('phone.answered', () => this.phoneAnswered());
      on('phone.ended', (e) => this.phoneEnded(e.reason));
      on('engine.error', (e) => this.error(e.message));
      on('day.begin', (e) => this.showHints(e.day));

      this.makeGrain();
      this.loop.add('hud', (dt) => this.update(dt), { states: ['playing'], priority: 900 });
    }

    update(dt) {
      const s = this.interaction.state;
      const key = s.visible ? s.text + '|' + s.enabled + '|' + s.hold : '';
      if (key !== this.lastPrompt) {
        this.lastPrompt = key;
        this.el.prompt.classList.toggle('is-visible', s.visible);
        this.el.prompt.classList.toggle('is-disabled', s.visible && !s.enabled);
        this.el.crosshair.classList.toggle('is-active', s.visible && s.enabled);
        if (s.visible) {
          this.el.promptKey.textContent = s.hold ? 'удерживай E' : 'E';
          this.el.promptText.textContent = s.text;
        }
      }
      const showRing = s.visible && s.hold > 0 && s.progress > 0;
      this.el.ring.classList.toggle('is-visible', showRing);
      if (showRing) this.el.ringFg.style.strokeDashoffset = String(RING * (1 - s.progress));

      if (this.callStart) {
        const sec = Math.floor((Date.now() - this.callStart) / 1000);
        this.el.phoneState.textContent = 'Вызов… 00:' + String(sec).padStart(2, '0');
      }
    }

    renderTasks(e) {
      this.el.tasksDay.textContent = 'День ' + e.day;
      this.el.tasksTitle.textContent = e.title || '';
      this.el.tasksList.innerHTML = e.tasks.map((t) => (
        '<li class="task' + (t.done ? ' is-done' : '') + (t.locked ? ' is-locked' : '') + '">' +
        '<span class="task-box"></span><span class="task-label">' + escape(t.title) + '</span>' +
        (t.count > 1 ? '<span class="task-count">' + t.progress + '/' + t.count + '</span>' : '') +
        '</li>'
      )).join('');
      // Записка ярко видна, когда что-то поменялось, а потом тускнеет, чтобы не мешать
      const note = this.el.tasksList.parentNode;
      note.classList.remove('is-idle');
      clearTimeout(this.noteTimer);
      this.noteTimer = setTimeout(() => note.classList.add('is-idle'), 6000);
    }

    renderHand(item) {
      this.el.hand.textContent = item ? 'В руках: ' + item.label + '   [G] бросить' : '';
      this.el.hand.classList.toggle('is-visible', !!item);
    }

    showSubtitle(e) {
      this.el.subSpeaker.textContent = e.speaker || '';
      this.el.subText.textContent = e.text;
      this.el.subs.dataset.speaker = e.speaker === 'Канин' ? 'kanin' : e.speaker ? 'caller' : 'thought';
      this.el.subs.classList.add('is-visible');
    }

    /** Подсказки по клавишам — только в первый день и только первые полминуты. */
    showHints(day) {
      clearTimeout(this.hintsTimer);
      document.body.classList.toggle('show-hints', day === 1);
      if (day === 1) this.hintsTimer = setTimeout(() => document.body.classList.remove('show-hints'), 35000);
    }

    toast(text) {
      this.el.toast.textContent = text;
      this.el.toast.classList.add('is-visible');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => this.el.toast.classList.remove('is-visible'), 2800);
    }

    scare(strength) {
      document.body.style.setProperty('--scare', String(strength || 0.5));
      document.body.classList.remove('is-scared');
      void document.body.offsetWidth; // перезапуск CSS-анимации
      document.body.classList.add('is-scared');
      clearTimeout(this.scareTimer);
      this.scareTimer = setTimeout(() => document.body.classList.remove('is-scared'), 700);
    }

    phoneRing(caller) {
      const now = new Date();
      this.el.phoneClock.textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      this.el.phoneName.textContent = caller.name;
      this.el.phoneState.textContent = 'Входящий вызов…';
      this.el.phonePhoto.style.backgroundImage = 'url("' + caller.photo + '")';
      this.el.phoneActions.innerHTML = '<span class="phone-answer"><b>Y</b> ответить</span><span class="phone-decline"><b>N</b> сбросить</span>';
      this.el.phone.className = 'phone is-open is-ringing';
      this.callStart = null;
    }

    phoneAnswered() {
      this.el.phone.className = 'phone is-open is-talking';
      this.el.phoneActions.innerHTML = '<span class="phone-decline"><b>N</b> положить трубку</span>';
      this.callStart = Date.now();
    }

    phoneEnded(reason) {
      this.callStart = null;
      this.el.phoneState.textContent = reason === 'missed' ? 'Пропущенный' : 'Вызов завершён';
      this.el.phone.classList.remove('is-ringing', 'is-talking');
      clearTimeout(this.phoneTimer);
      this.phoneTimer = setTimeout(() => this.el.phone.classList.remove('is-open'), 900);
    }

    error(message) {
      this.el.errorText.textContent = message;
      this.el.error.classList.add('is-open');
    }

    /** Плёночное зерно: одна шумовая картинка, которая «дрожит» через CSS-анимацию. */
    makeGrain() {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 160;
      const g = canvas.getContext('2d');
      const img = g.createImageData(160, 160);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      $('#fx-grain').style.backgroundImage = 'url(' + canvas.toDataURL() + ')';
    }
  }

  GK.HudController = decorate([
    Controller('hud'),
    Dependencies(GK.GameStateService, GK.InteractionService, GK.SettingsService, GK.EventBus, GK.LoopService),
  ], HudController);
})(window.GK);
