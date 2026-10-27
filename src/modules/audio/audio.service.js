/**
 * Звуковой движок на Web Audio API. Никаких файлов — всё синтезируется.
 *
 * Граф: источники → шины (music / sfx / ambience) → master → компрессор → колонки.
 * Браузеры запрещают звук до первого действия пользователя, поэтому контекст
 * создаётся в unlock(), который вызывается по нажатию на заставке.
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;

  const BUSES = ['music', 'sfx', 'ambience'];

  function setParam(param, value, time) {
    if (param.setTargetAtTime && time) param.setTargetAtTime(value, time, 0.05);
    else param.value = value;
  }

  function setPosition(node, pos, prefix) {
    if (node[prefix + 'X']) {
      node[prefix + 'X'].value = pos.x;
      node[prefix + 'Y'].value = pos.y;
      node[prefix + 'Z'].value = pos.z;
      return true;
    }
    return false;
  }

  class AudioService {
    constructor(events, settings) {
      this.events = events;
      this.settings = settings;
      this.ctx = null;
      this.unlocked = false;
      this.buses = {};
      this.reverbs = {};
      this.noiseCache = {};
      this.duck = 1;
    }

    onModuleInit() {
      this.events.on('settings.changed', (e) => {
        if (/Volume$/.test(e.key)) this.applyVolumes();
      });
    }

    get supported() {
      return typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
    }

    get ready() {
      return !!this.ctx && this.unlocked;
    }

    get now() {
      return this.ctx ? this.ctx.currentTime : 0;
    }

    unlock() {
      if (!this.supported) return false;
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new Ctx();
        this.buildGraph();
      }
      if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume();
      if (!this.unlocked) {
        this.unlocked = true;
        this.events.emit('audio.unlocked');
      }
      return true;
    }

    buildGraph() {
      const c = this.ctx;
      this.master = c.createGain();
      const compressor = c.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 12;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.3;
      this.master.connect(compressor);
      compressor.connect(c.destination);
      BUSES.forEach((name) => {
        const gain = c.createGain();
        gain.connect(this.master);
        this.buses[name] = gain;
      });
      this.applyVolumes();
    }

    applyVolumes() {
      if (!this.ctx) return;
      const s = this.settings;
      const t = this.ctx.currentTime;
      setParam(this.master.gain, s.get('masterVolume'), t);
      setParam(this.buses.music.gain, s.get('musicVolume') * this.duck, t);
      setParam(this.buses.sfx.gain, s.get('sfxVolume'), t);
      setParam(this.buses.ambience.gain, s.get('sfxVolume') * 0.9 * this.duck, t);
    }

    /** Приглушить музыку и эмбиент (пауза). 1 — без приглушения. */
    setDuck(factor) {
      this.duck = factor;
      this.applyVolumes();
    }

    bus(name) {
      return this.buses[name || 'sfx'];
    }

    /** Вход ревербератора конкретной шины (гулкий гараж, пустой двор). */
    reverbIn(busName) {
      const name = busName || 'sfx';
      if (!this.reverbs[name]) {
        const convolver = this.ctx.createConvolver();
        convolver.buffer = this.impulse(3.2, 2.4);
        convolver.connect(this.bus(name));
        this.reverbs[name] = convolver;
      }
      return this.reverbs[name];
    }

    noiseBuffer(color) {
      const type = color || 'white';
      if (this.noiseCache[type]) return this.noiseCache[type];
      const c = this.ctx;
      const length = c.sampleRate * 2;
      const buffer = c.createBuffer(1, length, c.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        if (type === 'pink') {
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        } else if (type === 'brown') {
          last = (last + 0.02 * white) / 1.02;
          data[i] = last * 3.5;
        } else {
          data[i] = white;
        }
      }
      this.noiseCache[type] = buffer;
      return buffer;
    }

    impulse(seconds, decay) {
      const c = this.ctx;
      const length = Math.floor(c.sampleRate * seconds);
      const buffer = c.createBuffer(2, length, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
      return buffer;
    }

    envelope(t, attack, hold, decay, peak) {
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(peak, t + attack);
      if (hold) gain.gain.setValueAtTime(peak, t + attack + hold);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay);
      return gain;
    }

    /** Источник → [фильтр] → огибающая → (панорама) → шина [+ реверб]. */
    route(source, envelope, o) {
      let node = source;
      if (o.filter) {
        const filter = this.ctx.createBiquadFilter();
        filter.type = o.filter.type || 'lowpass';
        filter.frequency.value = o.filter.freq;
        if (o.filter.q) filter.Q.value = o.filter.q;
        node.connect(filter);
        node = filter;
      }
      node.connect(envelope);
      let panner = null;
      if (o.position) {
        panner = this.createPanner(o.position);
        envelope.connect(panner);
        panner.connect(o.dest || this.bus(o.bus));
      } else {
        envelope.connect(o.dest || this.bus(o.bus));
      }
      if (o.reverb) {
        const send = this.ctx.createGain();
        send.gain.value = o.reverb;
        (panner || envelope).connect(send);
        send.connect(this.reverbIn(o.bus));
      }
      source.onended = () => {
        envelope.disconnect();
        if (panner) panner.disconnect();
      };
    }

    /** Тон с огибающей: { type, freq, freqEnd, attack, hold, decay, gain, when, filter, position, reverb, bus } */
    tone(o) {
      if (!this.ready) return null;
      const t = o.when || this.ctx.currentTime;
      const attack = o.attack || 0.005, hold = o.hold || 0, decay = o.decay || 0.3;
      const osc = this.ctx.createOscillator();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.freq, t);
      if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), t + attack + hold + decay);
      if (o.detune) osc.detune.value = o.detune;
      this.route(osc, this.envelope(t, attack, hold, decay, o.gain == null ? 0.2 : o.gain), o);
      osc.start(t);
      osc.stop(t + attack + hold + decay + 0.05);
      return osc;
    }

    /** Шумовой всплеск: { color: white|pink|brown, rate, ...как у tone } */
    noise(o) {
      if (!this.ready) return null;
      const t = o.when || this.ctx.currentTime;
      const attack = o.attack || 0.005, hold = o.hold || 0, decay = o.decay || 0.2;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer(o.color);
      src.loop = true;
      if (o.rate) src.playbackRate.value = o.rate;
      this.route(src, this.envelope(t, attack, hold, decay, o.gain == null ? 0.2 : o.gain), o);
      src.start(t, Math.random() * 1.5);
      src.stop(t + attack + hold + decay + 0.05);
      return src;
    }

    /** Бесконечный шум с фильтром (ветер, шипение). Возвращает { gain, filter, stop(fade) }. */
    loopNoise(o) {
      const c = this.ctx;
      const src = c.createBufferSource();
      src.buffer = this.noiseBuffer(o.color);
      src.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = (o.filter && o.filter.type) || 'lowpass';
      filter.frequency.value = (o.filter && o.filter.freq) || 1000;
      if (o.filter && o.filter.q) filter.Q.value = o.filter.q;
      const gain = c.createGain();
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(o.gain, c.currentTime, o.fadeIn || 0.3);
      src.connect(filter);
      filter.connect(gain);
      let panner = null;
      if (o.position) {
        panner = this.createPanner(o.position);
        gain.connect(panner);
        panner.connect(o.dest || this.bus(o.bus));
      } else {
        gain.connect(o.dest || this.bus(o.bus));
      }
      src.start(c.currentTime, Math.random() * 1.5);
      return {
        gain: gain,
        filter: filter,
        stop: (fade) => {
          const f = fade == null ? 0.3 : fade;
          gain.gain.setTargetAtTime(0, c.currentTime, Math.max(0.01, f / 3));
          setTimeout(() => {
            try { src.stop(); } catch (err) { /* уже остановлен */ }
            gain.disconnect();
            if (panner) panner.disconnect();
          }, f * 1000 + 100);
        },
      };
    }

    createPanner(pos) {
      const panner = this.ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 1.2;
      panner.maxDistance = 60;
      panner.rolloffFactor = 1.1;
      if (!setPosition(panner, pos, 'position')) panner.setPosition(pos.x, pos.y, pos.z);
      return panner;
    }

    /** Ухо игрока: позиция и направление взгляда (вызывается каждый кадр). */
    setListener(pos, forward) {
      if (!this.ctx) return;
      const l = this.ctx.listener;
      if (setPosition(l, pos, 'position') && l.forwardX) {
        l.forwardX.value = forward.x;
        l.forwardY.value = forward.y;
        l.forwardZ.value = forward.z;
        l.upX.value = 0;
        l.upY.value = 1;
        l.upZ.value = 0;
      } else if (l.setPosition) {
        l.setPosition(pos.x, pos.y, pos.z);
        l.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
      }
    }
  }

  GK.AudioService = decorate([Injectable(), Dependencies(GK.EventBus, GK.SettingsService)], AudioService);
})(window.GK);
