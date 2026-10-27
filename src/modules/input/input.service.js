/**
 * Клавиатура и мышь. Клавиши читаются по event.code (физическая клавиша),
 * поэтому WASD работает и на русской раскладке (ЦФЫВ).
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;
  const { clamp } = GK.math;

  const BINDINGS = Object.freeze({
    forward: ['KeyW', 'ArrowUp'],
    back: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    run: ['ShiftLeft', 'ShiftRight'],
    interact: ['KeyE'],
    flashlight: ['KeyF'],
    drop: ['KeyG'],
    answer: ['KeyY'],
    decline: ['KeyN'],
    skip: ['Space', 'Enter', 'Mouse0'],
    debug: ['F2', 'Backquote'],
  });

  const GAME_KEYS = ['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

  class InputService {
    constructor(events) {
      this.events = events;
      this.down = new Set();
      this.pressed = new Set();
      this.mouseDX = 0;
      this.mouseDY = 0;
      this.locked = false;
      this.lockTarget = null;
      /** Режим без захвата курсора (?nolock): обзор — перетаскиванием с зажатой кнопкой мыши. */
      this.dragLook = false;
    }

    onModuleInit() {
      if (typeof window === 'undefined' || typeof document === 'undefined') return;
      this.dragLook = /[?&]nolock\b/.test(window.location.search);
      this.attach(window, document);
    }

    attach(win, doc) {
      win.addEventListener('keydown', (e) => {
        if (!e.repeat) this.pressed.add(e.code);
        this.down.add(e.code);
        if (this.locked && GAME_KEYS.indexOf(e.code) !== -1) e.preventDefault();
        if (!e.repeat) this.events.emit('input.key', { code: e.code });
      });
      win.addEventListener('keyup', (e) => this.down.delete(e.code));
      win.addEventListener('blur', () => this.down.clear());

      doc.addEventListener('mousemove', (e) => {
        if (!this.locked && !(this.dragLook && this.down.has('Mouse0'))) return;
        // Chrome иногда присылает гигантский скачок сразу после захвата курсора
        this.mouseDX += clamp(e.movementX || 0, -250, 250);
        this.mouseDY += clamp(e.movementY || 0, -250, 250);
      });
      doc.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
          this.pressed.add('Mouse0');
          this.down.add('Mouse0');
        }
      });
      doc.addEventListener('mouseup', (e) => {
        if (e.button === 0) this.down.delete('Mouse0');
      });

      doc.addEventListener('pointerlockchange', () => {
        this.locked = !!doc.pointerLockElement && doc.pointerLockElement === this.lockTarget;
        this.mouseDX = 0;
        this.mouseDY = 0;
        this.events.emit('input.pointerlock', { locked: this.locked });
      });
      doc.addEventListener('pointerlockerror', () => this.events.emit('input.pointerlock-error'));
    }

    /** Захват курсора. Вызывать прямо из обработчика клика — иначе браузер откажет. */
    requestLock(el) {
      if (!el) return;
      this.lockTarget = el;
      if (this.locked || this.dragLook) return;
      if (!el.requestPointerLock) {
        this.events.emit('input.pointerlock-error');
        return;
      }
      try {
        const result = el.requestPointerLock();
        if (result && typeof result.catch === 'function') {
          result.catch(() => this.events.emit('input.pointerlock-error'));
        }
      } catch (err) {
        this.events.emit('input.pointerlock-error');
      }
    }

    exitLock() {
      if (typeof document !== 'undefined' && document.exitPointerLock && document.pointerLockElement) {
        document.exitPointerLock();
      }
    }

    isDown(action) {
      return BINDINGS[action].some((code) => this.down.has(code));
    }

    wasPressed(action) {
      return BINDINGS[action].some((code) => this.pressed.has(code));
    }

    /** Вектор движения: x — вправо, z — вперёд. */
    axis() {
      return {
        x: (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0),
        z: (this.isDown('forward') ? 1 : 0) - (this.isDown('back') ? 1 : 0),
      };
    }

    consumeMouse() {
      const delta = { dx: this.mouseDX, dy: this.mouseDY };
      this.mouseDX = 0;
      this.mouseDY = 0;
      return delta;
    }

    /** Вызывается игровым циклом в конце кадра. */
    endFrame() {
      this.pressed.clear();
    }
  }

  GK.INPUT_BINDINGS = BINDINGS;
  GK.InputService = decorate([Injectable(), Dependencies(GK.EventBus)], InputService);
})(window.GK);
