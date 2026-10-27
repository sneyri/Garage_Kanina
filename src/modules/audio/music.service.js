/**
 * Музыка и эмбиент. Две «сцены»:
 *   menu     — гнетущий гул, сердцебиение, скрип ворот, сломанная музыкальная шкатулка;
 *   ambience — ветер (на улице громче, в гараже глуше), низкий гул, гудение лампы, далёкие машины.
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;
  const { rand } = GK.math;

  /** Планировщик случайных событий: [{ min, max, fn }] — каждое срабатывает через случайный интервал. */
  function scheduler(entries) {
    const now = () => Date.now() / 1000;
    entries.forEach((e) => { e.next = now() + (e.first != null ? e.first : rand(e.min, e.max)); });
    const id = setInterval(() => {
      const t = now();
      entries.forEach((e) => {
        if (t >= e.next) {
          e.fn();
          e.next = t + rand(e.min, e.max);
        }
      });
    }, 100);
    return () => clearInterval(id);
  }

  class MusicService {
    constructor(audio, events, gameState) {
      this.audio = audio;
      this.events = events;
      this.gameState = gameState;
      this.current = null;
      this.currentName = null;
      this.indoor = false;
      this.lightsOn = true;
      this.humPosition = null;
    }

    onModuleInit() {
      this.events.on('audio.unlocked', () => this.sync());
      this.events.on('state.changed', () => this.sync());
      this.events.on('player.indoor', (e) => {
        this.indoor = e.inside;
        if (this.current && this.current.setIndoor) this.current.setIndoor(e.inside);
      });
      this.events.on('world.lights', (e) => {
        this.lightsOn = e.on;
        if (this.current && this.current.setHum) this.current.setHum(e.on);
      });
      this.events.on('world.ready', (e) => { this.humPosition = e.humPosition; });
    }

    sync() {
      if (!this.audio.ready) return;
      const state = this.gameState.state;
      this.play(state === 'boot' || state === 'menu' || state === 'ending' ? 'menu' : 'ambience');
      this.audio.setDuck(state === 'paused' ? 0.35 : 1);
    }

    play(name) {
      if (this.currentName === name) return;
      if (this.current) this.current.stop(2.5);
      this.currentName = name;
      this.current = name === 'menu' ? this.menuTheme() : this.ambience();
    }

    output(bus, fadeIn) {
      const c = this.audio.ctx;
      const out = c.createGain();
      out.gain.value = 0;
      out.gain.setTargetAtTime(1, c.currentTime, fadeIn);
      out.connect(this.audio.bus(bus));
      return out;
    }

    stopper(out, nodes, loops, cancel) {
      const c = this.audio.ctx;
      return (fade) => {
        out.gain.setTargetAtTime(0, c.currentTime, fade / 3);
        cancel();
        loops.forEach((l) => l.stop(fade));
        setTimeout(() => {
          nodes.forEach((n) => { try { n.stop(); } catch (err) { /* уже остановлен */ } });
          out.disconnect();
        }, fade * 1000 + 200);
      };
    }

    oscillator(type, freq, detune, gainValue, dest) {
      const c = this.audio.ctx;
      const osc = c.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune || 0;
      const gain = c.createGain();
      gain.gain.value = gainValue;
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      return osc;
    }

    lfo(freq, depth, param) {
      const c = this.audio.ctx;
      const osc = c.createOscillator();
      osc.frequency.value = freq;
      const gain = c.createGain();
      gain.gain.value = depth;
      osc.connect(gain);
      gain.connect(param);
      osc.start();
      return osc;
    }

    menuTheme() {
      const a = this.audio, c = a.ctx;
      const out = this.output('music', 1.5);
      const nodes = [];

      // Гул: ля минор в самом низу, через «дышащий» фильтр
      const drone = c.createBiquadFilter();
      drone.type = 'lowpass';
      drone.frequency.value = 230;
      drone.Q.value = 3;
      const droneGain = c.createGain();
      droneGain.gain.value = 0.12;
      drone.connect(droneGain);
      droneGain.connect(out);
      [['sawtooth', 55, 0, 0.3], ['sawtooth', 55, 9, 0.25], ['sawtooth', 82.41, -5, 0.14], ['triangle', 130.81, 4, 0.08], ['sine', 27.5, 0, 0.5]]
        .forEach((o) => nodes.push(this.oscillator(o[0], o[1], o[2], o[3], drone)));
      nodes.push(this.lfo(0.045, 130, drone.frequency));

      const wind = a.loopNoise({ color: 'pink', gain: 0.05, filter: { type: 'bandpass', freq: 420, q: 0.7 }, dest: out, fadeIn: 2 });
      nodes.push(this.lfo(0.08, 0.035, wind.gain.gain));
      nodes.push(this.lfo(0.03, 160, wind.filter.frequency));

      const cancel = scheduler([
        { min: 1.9, max: 1.9, first: 1, fn: () => {
          const t = a.now;
          a.tone({ when: t, freq: 55, freqEnd: 36, attack: 0.01, decay: 0.32, gain: 0.32, dest: out });
          a.tone({ when: t + 0.3, freq: 52, freqEnd: 34, attack: 0.01, decay: 0.3, gain: 0.2, dest: out });
        } },
        { min: 9, max: 18, fn: () => {
          // Стон металлических ворот
          const t = a.now;
          for (let i = 0; i < 26; i++) {
            a.tone({ when: t + i * 0.075, type: 'sawtooth', freq: 62 - i * 0.6, attack: 0.02, decay: 0.12, gain: 0.03,
              filter: { type: 'bandpass', freq: 720, q: 7 }, dest: out, reverb: 0.6, bus: 'music' });
          }
        } },
        { min: 12, max: 22, fn: () => {
          // Высокий диссонанс (малая секунда)
          [1244.5, 1318.5].forEach((f) => a.tone({ freq: f, attack: 3, decay: 4, gain: 0.012, dest: out, reverb: 0.8, bus: 'music' }));
        } },
        { min: 20, max: 32, first: 6, fn: () => {
          // Сломанная музыкальная шкатулка
          const t = a.now;
          [440, 659.3, 523.3, 493.9, 415.3, 440].forEach((f, i) => {
            a.tone({ when: t + i * 0.62 + Math.random() * 0.05, type: 'triangle', freq: f, detune: rand(-25, 25),
              attack: 0.005, decay: 1.5, gain: 0.045, dest: out, reverb: 0.9, bus: 'music' });
          });
        } },
      ]);

      return { stop: this.stopper(out, nodes, [wind], cancel) };
    }

    ambience() {
      const a = this.audio, c = a.ctx;
      const out = this.output('ambience', 2);
      const nodes = [];

      const wind = a.loopNoise({ color: 'pink', gain: 0.09, filter: { type: 'bandpass', freq: 520, q: 0.6 }, dest: out, fadeIn: 2 });
      nodes.push(this.lfo(0.07, 0.04, wind.gain.gain));

      const drone = c.createBiquadFilter();
      drone.type = 'lowpass';
      drone.frequency.value = 150;
      const droneGain = c.createGain();
      droneGain.gain.value = 0.07;
      drone.connect(droneGain);
      droneGain.connect(out);
      nodes.push(this.oscillator('sawtooth', 41.2, 0, 0.3, drone));
      nodes.push(this.oscillator('sawtooth', 61.7, 7, 0.15, drone));
      nodes.push(this.lfo(0.02, 50, drone.frequency));

      // Гудение лампы — звучит из точки, где она висит
      let hum = null;
      if (this.humPosition) {
        hum = c.createGain();
        hum.gain.value = this.lightsOn ? 0.05 : 0;
        const panner = a.createPanner(this.humPosition);
        panner.refDistance = 0.8;
        panner.rolloffFactor = 1.6;
        hum.connect(panner);
        panner.connect(out);
        [[50, 0.5], [100, 0.35], [150, 0.15]].forEach((h) => nodes.push(this.oscillator('sine', h[0], 0, h[1], hum)));
      }

      const cancel = scheduler([
        { min: 25, max: 55, fn: () => {
          // Далёкая машина за гаражами
          const t = a.now;
          const car = a.loopNoise({ color: 'brown', gain: 0, filter: { type: 'lowpass', freq: 220 }, dest: out });
          car.gain.gain.setTargetAtTime(0.06, t, 1.5);
          car.filter.frequency.setTargetAtTime(520, t + 2, 1.5);
          setTimeout(() => car.stop(3), 5000);
        } },
      ]);

      const setIndoor = (inside) => {
        const t = c.currentTime;
        wind.gain.gain.setTargetAtTime(inside ? 0.03 : 0.09, t, 0.6);
        wind.filter.frequency.setTargetAtTime(inside ? 260 : 520, t, 0.6);
      };
      setIndoor(this.indoor);

      return {
        stop: this.stopper(out, nodes, [wind], cancel),
        setIndoor: setIndoor,
        setHum: (on) => { if (hum) hum.gain.setTargetAtTime(on ? 0.05 : 0, c.currentTime, 0.05); },
      };
    }
  }

  GK.MusicService = decorate([Injectable(), Dependencies(GK.AudioService, GK.EventBus, GK.GameStateService)], MusicService);
})(window.GK);
