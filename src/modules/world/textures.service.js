/**
 * Процедурные текстуры: всё рисуется на <canvas> при запуске, никаких картинок.
 * Генератор случайных чисел детерминированный — мир одинаковый при каждом запуске.
 */
(function (GK) {
  'use strict';

  const { Injectable, Dependencies, decorate } = GK.common;
  const { rng, clamp } = GK.math;

  function rgba(r, g, b, a) {
    return 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + a + ')';
  }

  class TexturesService {
    constructor(renderer) {
      this.renderer = renderer;
      this.cache = new Map();
    }

    get(key, factory) {
      if (!this.cache.has(key)) this.cache.set(key, factory());
      return this.cache.get(key);
    }

    canvas(w, h) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    }

    texture(canvas, options) {
      const o = options || {};
      const t = new THREE.CanvasTexture(canvas);
      if (o.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (o.srgb !== false) t.encoding = THREE.sRGBEncoding;
      t.anisotropy = this.renderer.maxAnisotropy;
      return t;
    }

    /** Пятно, которое бесшовно заворачивается через края тайла. */
    blot(g, size, x, y, r, color) {
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const cx = x + ox * size, cy = y + oy * size;
          if (cx + r < 0 || cx - r > size || cy + r < 0 || cy - r > size) continue;
          const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
          gr.addColorStop(0, color);
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr;
          g.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
      }
    }

    /** Попиксельный шум ±amount. */
    grain(g, w, h, amount, random) {
      const img = g.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const n = (random() - 0.5) * amount;
        d[i] = clamp(d[i] + n, 0, 255);
        d[i + 1] = clamp(d[i + 1] + n, 0, 255);
        d[i + 2] = clamp(d[i + 2] + n, 0, 255);
      }
      g.putImageData(img, 0, 0);
    }

    /** Белый силикатный кирпич, как на фото: 1 тайл = 1×1 м. */
    brick() {
      return this.get('brick', () => {
        const S = 512, c = this.canvas(S, S), g = c.getContext('2d'), r = rng(11);
        g.fillStyle = '#8c877d';
        g.fillRect(0, 0, S, S);
        const rows = 12, rowH = S / rows, bw = S / 4, mortar = 5;
        for (let row = 0; row < rows; row++) {
          const offset = (row % 2) * bw / 2;
          for (let i = -1; i < 5; i++) {
            const x = i * bw + offset, y = row * rowH;
            const l = 178 + r() * 30, warm = r() * 10;
            g.fillStyle = rgba(l, l - 3 - warm, l - 10 - warm, 1);
            g.fillRect(x + mortar / 2, y + mortar / 2, bw - mortar, rowH - mortar);
            for (let k = 0; k < 16; k++) {
              g.fillStyle = r() < 0.6 ? rgba(60, 55, 48, r() * 0.18) : rgba(255, 255, 250, r() * 0.12);
              g.fillRect(x + r() * bw, y + r() * rowH, 1 + r() * 6, 1 + r() * 3);
            }
          }
        }
        for (let k = 0; k < 45; k++) this.blot(g, S, r() * S, r() * S, 12 + r() * 70, rgba(45, 36, 28, 0.06 + r() * 0.14));
        for (let k = 0; k < 18; k++) {
          // подтёки
          const x = r() * S, y = r() * S * 0.6, len = 40 + r() * 160;
          const gr = g.createLinearGradient(0, y, 0, y + len);
          gr.addColorStop(0, rgba(60, 45, 30, 0.18));
          gr.addColorStop(1, rgba(60, 45, 30, 0));
          g.fillStyle = gr;
          g.fillRect(x, y, 2 + r() * 5, len);
        }
        this.grain(g, S, S, 22, r);
        return this.texture(c);
      });
    }

    /** Бетонный пол гаража: 1 тайл = 2×2 м. */
    concrete() {
      return this.get('concrete', () => {
        const S = 512, c = this.canvas(S, S), g = c.getContext('2d'), r = rng(23);
        g.fillStyle = '#67645e';
        g.fillRect(0, 0, S, S);
        for (let k = 0; k < 70; k++) {
          const light = r() < 0.5;
          this.blot(g, S, r() * S, r() * S, 20 + r() * 90, light ? rgba(150, 146, 138, 0.06 + r() * 0.08) : rgba(30, 27, 24, 0.08 + r() * 0.12));
        }
        for (let k = 0; k < 9; k++) {
          // трещины
          let x = r() * S, y = r() * S;
          g.strokeStyle = rgba(25, 22, 20, 0.5 + r() * 0.3);
          g.lineWidth = 1 + r();
          g.beginPath();
          g.moveTo(x, y);
          for (let s = 0; s < 14; s++) {
            x += (r() - 0.5) * 30;
            y += (r() - 0.3) * 24;
            g.lineTo(x, y);
          }
          g.stroke();
        }
        for (let k = 0; k < 600; k++) {
          g.fillStyle = rgba(20, 18, 16, r() * 0.4);
          g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2);
        }
        this.grain(g, S, S, 30, r);
        return this.texture(c);
      });
    }

    /** Утоптанный снег: 1 тайл = 3×3 м. */
    snow() {
      return this.get('snow', () => {
        const S = 512, c = this.canvas(S, S), g = c.getContext('2d'), r = rng(37);
        g.fillStyle = '#cfd7e1';
        g.fillRect(0, 0, S, S);
        for (let k = 0; k < 60; k++) {
          this.blot(g, S, r() * S, r() * S, 30 + r() * 110, r() < 0.5 ? rgba(150, 165, 185, 0.12) : rgba(245, 248, 255, 0.18));
        }
        for (let k = 0; k < 24; k++) this.blot(g, S, r() * S, r() * S, 6 + r() * 14, rgba(120, 130, 150, 0.2));
        for (let k = 0; k < 700; k++) {
          g.fillStyle = rgba(255, 255, 255, 0.4 + r() * 0.6);
          g.fillRect(r() * S, r() * S, 1, 1);
        }
        this.grain(g, S, S, 14, r);
        return this.texture(c);
      });
    }

    /** Колея на снегу (прозрачная полоса). */
    track() {
      return this.get('track', () => {
        const W = 64, H = 512, c = this.canvas(W, H), g = c.getContext('2d'), r = rng(41);
        for (let y = 0; y < H; y += 2) {
          for (let x = 0; x < W; x += 2) {
            const edge = Math.abs(x - W / 2) / (W / 2);
            const a = (1 - edge * edge) * (0.25 + r() * 0.3);
            g.fillStyle = rgba(70, 72, 78, a);
            g.fillRect(x, y, 2, 2);
          }
        }
        for (let y = 0; y < H; y += 9) {
          g.fillStyle = rgba(40, 40, 45, 0.25);
          g.fillRect(8, y, W - 16, 3);
        }
        return this.texture(c);
      });
    }

    /** Крашеные металлические ворота с рёбрами, ржавчиной и номером. */
    door(color, number, seed) {
      return this.get('door:' + color + ':' + number, () => {
        const W = 256, H = 220, c = this.canvas(W, H), g = c.getContext('2d'), r = rng(seed || 7);
        g.fillStyle = color;
        g.fillRect(0, 0, W, H);
        for (let x = 0; x < W; x += 16) {
          g.fillStyle = 'rgba(255,255,255,0.06)';
          g.fillRect(x, 0, 3, H);
          g.fillStyle = 'rgba(0,0,0,0.18)';
          g.fillRect(x + 12, 0, 2, H);
        }
        g.fillStyle = 'rgba(0,0,0,0.55)';
        g.fillRect(W / 2 - 2, 0, 4, H);
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.lineWidth = 6;
        g.strokeRect(3, 3, W - 6, H - 6);
        for (let k = 0; k < 26; k++) {
          // ржавые подтёки сверху вниз
          const x = r() * W, y = r() * H * 0.5, len = 20 + r() * 120;
          const gr = g.createLinearGradient(0, y, 0, y + len);
          gr.addColorStop(0, rgba(120, 58, 28, 0.55 + r() * 0.3));
          gr.addColorStop(1, rgba(120, 58, 28, 0));
          g.fillStyle = gr;
          g.fillRect(x, y, 2 + r() * 6, len);
        }
        for (let k = 0; k < 14; k++) this.blot(g, W, r() * W, r() * H, 5 + r() * 18, rgba(95, 45, 20, 0.5));
        for (let k = 0; k < 40; k++) {
          g.strokeStyle = rgba(200, 200, 190, 0.15 + r() * 0.2);
          g.lineWidth = 1;
          g.beginPath();
          const x = r() * W, y = r() * H;
          g.moveTo(x, y);
          g.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 10);
          g.stroke();
        }
        const dirt = g.createLinearGradient(0, H * 0.75, 0, H);
        dirt.addColorStop(0, 'rgba(40,30,20,0)');
        dirt.addColorStop(1, 'rgba(40,30,20,0.7)');
        g.fillStyle = dirt;
        g.fillRect(0, 0, W, H);
        if (number) {
          g.font = 'bold 28px "Courier New", monospace';
          g.fillStyle = 'rgba(235,232,220,0.85)';
          g.fillText(number, 18, 40);
        }
        g.fillStyle = '#1a1a1a';
        g.fillRect(W / 2 + 8, H * 0.52, 14, 22);
        this.grain(g, W, H, 18, r);
        return this.texture(c, { repeat: false });
      });
    }

    /** Доски (щит над смотровой ямой). */
    planks() {
      return this.get('planks', () => {
        const S = 256, c = this.canvas(S, S), g = c.getContext('2d'), r = rng(53);
        g.fillStyle = '#1a120c';
        g.fillRect(0, 0, S, S);
        const boards = 8, bh = S / boards;
        for (let b = 0; b < boards; b++) {
          const base = 85 + r() * 40;
          g.fillStyle = rgba(base, base * 0.68, base * 0.42, 1);
          g.fillRect(0, b * bh + 1, S, bh - 3);
          for (let k = 0; k < 9; k++) {
            g.strokeStyle = rgba(40, 25, 12, 0.25 + r() * 0.25);
            g.lineWidth = 1;
            g.beginPath();
            const y = b * bh + 3 + r() * (bh - 8);
            g.moveTo(0, y);
            for (let x = 0; x <= S; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + k) * 1.5);
            g.stroke();
          }
          this.blot(g, S, r() * S, b * bh + bh / 2, 8 + r() * 10, rgba(30, 18, 8, 0.6));
        }
        this.grain(g, S, S, 24, r);
        return this.texture(c);
      });
    }

    /** Рубероид на крышах. */
    roofing() {
      return this.get('roofing', () => {
        const S = 256, c = this.canvas(S, S), g = c.getContext('2d'), r = rng(61);
        g.fillStyle = '#26241f';
        g.fillRect(0, 0, S, S);
        for (let y = 0; y < S; y += 64) {
          g.fillStyle = 'rgba(0,0,0,0.5)';
          g.fillRect(0, y, S, 3);
        }
        for (let k = 0; k < 30; k++) this.blot(g, S, r() * S, r() * S, 10 + r() * 30, rgba(10, 10, 8, 0.4));
        this.grain(g, S, S, 26, r);
        return this.texture(c);
      });
    }

    /** Бетонный забор с ромбами (ПО-2). */
    fence() {
      return this.get('fence', () => {
        const S = 256, c = this.canvas(S, S), g = c.getContext('2d'), r = rng(67);
        g.fillStyle = '#6f6c66';
        g.fillRect(0, 0, S, S);
        g.strokeStyle = 'rgba(30,28,26,0.45)';
        g.lineWidth = 3;
        for (let i = -S; i < S * 2; i += 32) {
          g.beginPath();
          g.moveTo(i, 0);
          g.lineTo(i + S, S);
          g.moveTo(i, S);
          g.lineTo(i + S, 0);
          g.stroke();
        }
        for (let k = 0; k < 30; k++) this.blot(g, S, r() * S, r() * S, 10 + r() * 50, rgba(30, 26, 22, 0.15));
        this.grain(g, S, S, 26, r);
        return this.texture(c);
      });
    }

    /** Стёганый пуховик: горизонтальные «валики» с бликом. */
    quilt() {
      return this.get('quilt', () => {
        const S = 128, c = this.canvas(S, S), g = c.getContext('2d');
        for (let y = 0; y < S; y += 16) {
          const gr = g.createLinearGradient(0, y, 0, y + 16);
          gr.addColorStop(0, '#0b0c0e');
          gr.addColorStop(0.45, '#2a2d33');
          gr.addColorStop(1, '#08090a');
          g.fillStyle = gr;
          g.fillRect(0, y, S, 16);
        }
        return this.texture(c);
      });
    }

    pegboard() {
      return this.get('pegboard', () => {
        const S = 128, c = this.canvas(S, S), g = c.getContext('2d');
        g.fillStyle = '#7d6a50';
        g.fillRect(0, 0, S, S);
        g.fillStyle = '#2a2016';
        for (let y = 4; y < S; y += 8) for (let x = 4; x < S; x += 8) g.fillRect(x - 1, y - 1, 2, 2);
        return this.texture(c);
      });
    }

    /** Берёза: белая кора с чёрными чёрточками. */
    birch() {
      return this.get('birch', () => {
        const W = 64, H = 256, c = this.canvas(W, H), g = c.getContext('2d'), r = rng(71);
        g.fillStyle = '#d9d6cc';
        g.fillRect(0, 0, W, H);
        for (let k = 0; k < 40; k++) {
          g.fillStyle = rgba(20, 20, 20, 0.6 + r() * 0.4);
          g.fillRect(r() * W, r() * H, 6 + r() * 20, 1 + r() * 3);
        }
        return this.texture(c);
      });
    }

    /** Фасад панельной девятиэтажки с редкими горящими окнами. */
    facade(seed) {
      return this.get('facade:' + seed, () => {
        const W = 256, H = 256, c = this.canvas(W, H), g = c.getContext('2d'), r = rng(seed);
        g.fillStyle = '#07080a';
        g.fillRect(0, 0, W, H);
        const cols = 12, rows = 9, cw = W / cols, rh = H / rows;
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const lit = r() < 0.14;
            const tv = lit && r() < 0.25;
            g.fillStyle = lit ? (tv ? '#6f88a8' : r() < 0.5 ? '#e0a95e' : '#c98d4a') : '#030304';
            g.fillRect(x * cw + cw * 0.25, y * rh + rh * 0.3, cw * 0.5, rh * 0.45);
          }
        }
        return this.texture(c);
      });
    }

    /** Ночное небо: сверху чернота, у горизонта рыжая засветка города. */
    sky() {
      return this.get('sky', () => {
        const c = this.canvas(4, 256), g = c.getContext('2d');
        const gr = g.createLinearGradient(0, 0, 0, 256);
        gr.addColorStop(0, '#020305');
        gr.addColorStop(0.42, '#090b10');
        gr.addColorStop(0.5, '#231a14');
        gr.addColorStop(0.53, '#0d0f13');
        gr.addColorStop(1, '#0b0d10');
        g.fillStyle = gr;
        g.fillRect(0, 0, 4, 256);
        return this.texture(c, { repeat: false });
      });
    }

    /** Масляное пятно на полу (с прозрачностью). */
    stain() {
      return this.get('stain', () => {
        const S = 128, c = this.canvas(S, S), g = c.getContext('2d'), r = rng(83);
        for (let k = 0; k < 9; k++) {
          const x = S / 2 + (r() - 0.5) * 50, y = S / 2 + (r() - 0.5) * 50, rad = 14 + r() * 28;
          const gr = g.createRadialGradient(x, y, 0, x, y, rad);
          gr.addColorStop(0, 'rgba(14,10,6,0.92)');
          gr.addColorStop(0.7, 'rgba(14,10,6,0.6)');
          gr.addColorStop(1, 'rgba(14,10,6,0)');
          g.fillStyle = gr;
          g.fillRect(0, 0, S, S);
        }
        return this.texture(c, { repeat: false });
      });
    }

    /** Спицы колеса (прозрачная текстура). */
    spokes() {
      return this.get('spokes', () => {
        const S = 128, c = this.canvas(S, S), g = c.getContext('2d');
        g.strokeStyle = '#9aa0a6';
        g.lineWidth = 1.5;
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2;
          const off = (i % 2 ? 0.3 : -0.3);
          g.beginPath();
          g.moveTo(S / 2 + Math.cos(a + off) * 8, S / 2 + Math.sin(a + off) * 8);
          g.lineTo(S / 2 + Math.cos(a) * 62, S / 2 + Math.sin(a) * 62);
          g.stroke();
        }
        return this.texture(c, { repeat: false });
      });
    }

    /** Мягкая круглая точка: снежинки и ореолы ламп. */
    glow() {
      return this.get('glow', () => {
        const S = 64, c = this.canvas(S, S), g = c.getContext('2d');
        const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
        gr.addColorStop(0, 'rgba(255,255,255,1)');
        gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, S, S);
        return this.texture(c, { repeat: false });
      });
    }

    /**
     * Вертикальный градиент для «луча» фонаря в снегопаде.
     * alphaMap читает яркость (канал G), а не альфу — поэтому градиент серый и непрозрачный.
     */
    lightCone() {
      return this.get('lightCone', () => {
        const c = this.canvas(4, 128), g = c.getContext('2d');
        const gr = g.createLinearGradient(0, 0, 0, 128);
        gr.addColorStop(0, '#ffffff');
        gr.addColorStop(0.55, '#555555');
        gr.addColorStop(1, '#000000');
        g.fillStyle = gr;
        g.fillRect(0, 0, 4, 128);
        return this.texture(c, { repeat: false, srgb: false });
      });
    }

    /** Этикетка: мешки с цементом, масло, коробки. */
    label(text, background, foreground, w, h) {
      const key = 'label:' + text + background + foreground;
      return this.get(key, () => {
        const W = w || 128, H = h || 64, c = this.canvas(W, H), g = c.getContext('2d'), r = rng(text.length * 97);
        g.fillStyle = background;
        g.fillRect(0, 0, W, H);
        g.fillStyle = foreground;
        g.font = 'bold ' + Math.floor(H * 0.32) + 'px "Arial Narrow", Arial, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        text.split('\n').forEach((line, i, all) => g.fillText(line, W / 2, H / 2 + (i - (all.length - 1) / 2) * H * 0.36));
        this.grain(g, W, H, 30, r);
        return this.texture(c, { repeat: false });
      });
    }
  }

  GK.TexturesService = decorate([Injectable(), Dependencies(GK.RendererService)], TexturesService);
})(window.GK);
