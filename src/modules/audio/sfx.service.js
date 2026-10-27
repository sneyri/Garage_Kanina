/**
 * Библиотека звуковых эффектов. Короткие звуки «выстрелил и забыл»,
 * длинные (работа, звонок, дыхание) возвращают { stop() }.
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;
  const { rand } = GK.math;

  const SILENT = { stop() {} };

  class SfxService {
    constructor(audio) {
      this.audio = audio;
    }

    get ok() {
      return this.audio.ready;
    }

    footstep(surface, run) {
      if (!this.ok) return;
      const a = this.audio, t = a.now, loud = run ? 1.3 : 1;
      if (surface === 'snow') {
        for (let i = 0; i < 6; i++) {
          a.noise({ when: t + i * 0.016 + Math.random() * 0.012, attack: 0.002, decay: 0.025 + Math.random() * 0.035,
            gain: 0.06 * loud * (0.5 + Math.random()), filter: { type: 'bandpass', freq: rand(1500, 4000), q: 1.4 } });
        }
        a.noise({ color: 'brown', when: t, attack: 0.01, decay: 0.14, gain: 0.3 * loud, filter: { type: 'lowpass', freq: 600 } });
      } else if (surface === 'wood') {
        a.tone({ freq: 120, freqEnd: 75, attack: 0.003, decay: 0.13, gain: 0.22 * loud });
        a.noise({ attack: 0.002, decay: 0.05, gain: 0.07 * loud, filter: { type: 'bandpass', freq: 800, q: 2 }, reverb: 0.2 });
      } else {
        a.noise({ attack: 0.002, decay: 0.07, gain: 0.1 * loud, filter: { type: 'bandpass', freq: rand(1100, 1700), q: 1.3 }, reverb: 0.35 });
        a.tone({ freq: 85, freqEnd: 55, attack: 0.002, decay: 0.08, gain: 0.12 * loud });
      }
    }

    click() {
      if (!this.ok) return;
      const t = this.audio.now;
      [0, 0.045].forEach((d, i) => this.audio.noise({ when: t + d, attack: 0.001, decay: 0.018, gain: i ? 0.12 : 0.18, filter: { type: 'highpass', freq: 2500 } }));
    }

    pickup() {
      if (!this.ok) return;
      this.audio.noise({ attack: 0.01, decay: 0.12, gain: 0.08, filter: { type: 'bandpass', freq: 2400, q: 0.8 } });
      this.audio.tone({ freq: 140, freqEnd: 90, attack: 0.004, decay: 0.09, gain: 0.12 });
    }

    place() {
      if (!this.ok) return;
      this.audio.tone({ type: 'square', freq: 150, freqEnd: 95, attack: 0.002, decay: 0.12, gain: 0.08, filter: { type: 'lowpass', freq: 700 }, reverb: 0.3 });
      this.audio.noise({ attack: 0.001, decay: 0.05, gain: 0.08, filter: { type: 'bandpass', freq: 1200, q: 1 } });
    }

    trash(position) {
      if (!this.ok) return;
      this.audio.noise({ attack: 0.01, decay: 0.25, gain: 0.15, filter: { type: 'bandpass', freq: 1800, q: 0.7 }, position: position });
      this.clang(position, 0.6);
    }

    /** Металлический удар: негармонические обертоны, как у листа железа. */
    clang(position, power) {
      if (!this.ok) return;
      const base = rand(140, 220), p = power == null ? 1 : power;
      [1, 2.76, 5.4, 8.93].forEach((ratio, i) => {
        this.audio.tone({ freq: base * ratio, attack: 0.002, decay: 1.6 / (i + 1), gain: 0.08 * p / (i + 1), position: position, reverb: 0.6, bus: 'ambience' });
      });
      this.audio.noise({ attack: 0.001, decay: 0.08, gain: 0.12 * p, filter: { type: 'bandpass', freq: 3000, q: 1 }, position: position, bus: 'ambience' });
    }

    taskDone() {
      if (!this.ok) return;
      this.audio.tone({ freq: 196, attack: 0.01, decay: 2.2, gain: 0.08, reverb: 0.5 });
      this.audio.tone({ freq: 293.7, attack: 0.01, decay: 1.6, gain: 0.04, reverb: 0.5, detune: 8 });
    }

    dayEnd() {
      if (!this.ok) return;
      [73.4, 110, 155.6].forEach((f) => this.audio.tone({ type: 'triangle', freq: f, attack: 1.5, hold: 0.5, decay: 3, gain: 0.07, reverb: 0.6 }));
    }

    /** Хоррор-«стинг»: диссонансный кластер + шумовой удар + визг. */
    sting(power) {
      if (!this.ok) return;
      const p = power == null ? 1 : power;
      [98, 103.8, 146.8, 155.6, 207.7].forEach((f) => {
        this.audio.tone({ type: 'sawtooth', freq: f, freqEnd: f * 0.92, attack: 0.02, decay: 2.2, gain: 0.05 * p, filter: { type: 'lowpass', freq: 1800 }, reverb: 0.5 });
      });
      this.audio.noise({ attack: 0.004, decay: 0.7, gain: 0.25 * p, filter: { type: 'highpass', freq: 900 }, reverb: 0.4 });
      this.audio.tone({ freq: 1900, freqEnd: 1250, attack: 0.02, decay: 1.3, gain: 0.04 * p, detune: 30 });
      this.audio.tone({ freq: 62, freqEnd: 28, attack: 0.005, decay: 1.1, gain: 0.55 * p });
    }

    /** Стук снизу — например, из подвала. */
    knock(position, times) {
      if (!this.ok) return;
      const t = this.audio.now;
      for (let i = 0; i < (times || 3); i++) {
        const when = t + i * 0.34 + Math.random() * 0.05;
        this.audio.tone({ when: when, freq: 78, freqEnd: 52, attack: 0.003, decay: 0.22, gain: 0.5, position: position, reverb: 0.4 });
        this.audio.noise({ when: when, color: 'brown', attack: 0.002, decay: 0.1, gain: 0.5, filter: { type: 'lowpass', freq: 380 }, position: position });
      }
    }

    /** Скрип металлической двери — зернистый синтез. */
    creak(position) {
      if (!this.ok) return;
      const t = this.audio.now;
      for (let i = 0; i < 16; i++) {
        this.audio.tone({ when: t + i * 0.065, type: 'sawtooth', freq: rand(55, 85), attack: 0.01, decay: 0.08, gain: 0.07,
          filter: { type: 'bandpass', freq: rand(550, 950), q: 8 }, position: position, reverb: 0.3 });
      }
    }

    lightOff() {
      if (!this.ok) return;
      this.audio.noise({ attack: 0.001, decay: 0.04, gain: 0.3, filter: { type: 'bandpass', freq: 3000, q: 1 }, reverb: 0.4 });
      this.audio.tone({ type: 'square', freq: 50, freqEnd: 30, attack: 0.001, decay: 0.4, gain: 0.06, filter: { type: 'lowpass', freq: 300 } });
    }

    switchOn() {
      if (!this.ok) return;
      this.audio.noise({ attack: 0.001, decay: 0.03, gain: 0.25, filter: { type: 'bandpass', freq: 2500, q: 1.2 }, reverb: 0.3 });
    }

    uiHover() {
      if (!this.ok) return;
      this.audio.tone({ freq: 1700, attack: 0.002, decay: 0.03, gain: 0.015 });
    }

    uiClick() {
      if (!this.ok) return;
      this.audio.tone({ freq: 520, freqEnd: 260, attack: 0.002, decay: 0.08, gain: 0.05 });
      this.audio.noise({ attack: 0.001, decay: 0.02, gain: 0.04, filter: { type: 'highpass', freq: 2000 } });
    }

    /** Звук долгого действия (удержание E). */
    work(kind) {
      if (!this.ok) return SILENT;
      const a = this.audio;
      const timers = [];
      const repeat = (fn, ms) => { fn(); timers.push(setInterval(fn, ms)); };
      let loop = null;

      if (kind === 'wipe') {
        let up = false;
        repeat(() => {
          up = !up;
          a.noise({ attack: 0.04, decay: 0.18, gain: 0.1, filter: { type: 'bandpass', freq: up ? 2200 : 1500, q: 0.9 } });
        }, 260);
      } else if (kind === 'pour') {
        loop = a.loopNoise({ color: 'brown', gain: 0.25, filter: { type: 'lowpass', freq: 900 } });
        repeat(() => {
          loop.gain.gain.setTargetAtTime(0.12 + Math.random() * 0.25, a.now, 0.03);
          if (Math.random() < 0.6) a.tone({ freq: rand(250, 700), freqEnd: rand(500, 900), attack: 0.005, decay: 0.06, gain: 0.04 });
        }, 70);
      } else if (kind === 'ratchet') {
        let n = 0;
        repeat(() => {
          if (n++ % 6 > 3) return;
          a.noise({ attack: 0.001, decay: 0.02, gain: 0.18, filter: { type: 'bandpass', freq: 4200, q: 4 } });
          a.tone({ type: 'square', freq: 2300, attack: 0.001, decay: 0.012, gain: 0.03 });
        }, 120);
      } else if (kind === 'pump') {
        repeat(() => {
          a.noise({ attack: 0.06, decay: 0.32, gain: 0.12, filter: { type: 'bandpass', freq: 2600, q: 1.2 } });
          a.tone({ type: 'sawtooth', freq: 70, attack: 0.05, decay: 0.2, gain: 0.03, filter: { type: 'bandpass', freq: 600, q: 6 } });
        }, 700);
      } else if (kind === 'patch') {
        repeat(() => a.noise({ attack: 0.01, decay: 0.12, gain: 0.06, filter: { type: 'highpass', freq: 3000 } }), 180);
      } else if (kind === 'creak') {
        this.creak();
      } else {
        repeat(() => a.noise({ attack: 0.02, decay: 0.1, gain: 0.06, filter: { type: 'bandpass', freq: 1500, q: 1 } }), 300);
      }

      return {
        stop() {
          timers.forEach(clearInterval);
          if (loop) loop.stop(0.15);
        },
      };
    }

    /** Мелодия входящего звонка + вибрация. */
    ring() {
      if (!this.ok) return SILENT;
      const a = this.audio;
      const melody = [659.3, 784, 987.8, 784, 659.3, 0, 523.3, 659.3];
      const play = () => {
        const t = a.now;
        melody.forEach((f, i) => {
          if (f) a.tone({ when: t + i * 0.14, type: 'triangle', freq: f, attack: 0.005, decay: 0.16, gain: 0.07 });
        });
        a.noise({ when: t, color: 'brown', attack: 0.02, hold: 0.45, decay: 0.05, gain: 0.25, filter: { type: 'lowpass', freq: 160 } });
      };
      play();
      const id = setInterval(play, 2300);
      return { stop() { clearInterval(id); } };
    }

    /** Тяжёлое дыхание. */
    breathing(position) {
      if (!this.ok) return SILENT;
      const a = this.audio;
      let inhale = true;
      const breath = () => {
        a.noise({ attack: inhale ? 0.7 : 0.25, hold: 0.15, decay: inhale ? 0.4 : 0.9, gain: inhale ? 0.07 : 0.1,
          filter: { type: 'bandpass', freq: inhale ? 1100 : 700, q: 0.9 }, position: position });
        inhale = !inhale;
      };
      breath();
      const id = setInterval(breath, 1300);
      return { stop() { clearInterval(id); } };
    }

    /** Помехи в трубке. */
    staticNoise() {
      if (!this.ok) return SILENT;
      const a = this.audio;
      const hiss = a.loopNoise({ gain: 0.035, filter: { type: 'highpass', freq: 1800 } });
      const id = setInterval(() => {
        if (Math.random() < 0.35) a.noise({ attack: 0.001, decay: 0.02, gain: 0.12, filter: { type: 'highpass', freq: 2500 } });
      }, 90);
      return {
        stop() {
          clearInterval(id);
          hiss.stop(0.2);
        },
      };
    }
  }

  GK.SfxService = decorate([Injectable(), Dependencies(GK.AudioService)], SfxService);
})(window.GK);
