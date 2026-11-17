import profiles from './effect-profiles.cjs';
const { fontProfile, rayTarget } = profiles;
const palettes = { cosmic: '#9acfff', matrix: '#75dca3', circuit: null, phosphor: '#a9d38c', ember: '#eeb47f', aurora: '#b8adf1' };
const ease = n => 1 - (1 - n) ** 3;
export class TerminalEffects {
  constructor(canvas, { preview = false, exposeDebug = true } = {}) {
    this.preview = preview; this.motionTime = 0; this.lastTime = null;
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.rays = []; this.frame = 0; this.burst = 0; this.nodes = []; this.active = document.hasFocus(); this.reduce = matchMedia('(prefers-reduced-motion: reduce)');
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    document.addEventListener('visibilitychange', () => this.wake());
    window.addEventListener('blur', () => { this.active = false; this.lastTime = null; cancelAnimationFrame(this.frame); this.frame = 0; this.rays = []; });
    window.addEventListener('focus', () => { this.active = true; this.lastTime = null; this.wake(); });
    this.reduce.addEventListener('change', () => this.configure(this.last));
    if (exposeDebug) window.__orbitEffectsSnapshot = () => ({ enabled: !!this.enabled, style: this.profile?.style, rays: this.rays.length, width: this.width, height: this.height, reducedMotion: this.reduce.matches, speed: this.prefs?.effectSpeed, visibility: this.prefs?.effectIntensity, size: this.prefs?.effectSize, motionTime: this.motionTime });
  }
  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect(); this.width = rect.width; this.height = rect.height;
    this.dpr = Math.min(2, devicePixelRatio || 1); this.canvas.width = Math.round(this.width * this.dpr); this.canvas.height = Math.round(this.height * this.dpr);
    this.rays = []; if (this.last) this.draw(performance.now()); this.wake();
  }
  configure(options) {
    if (!options) return; this.advance(performance.now()); this.last = options; this.prefs = options.appearance;
    const profile = fontProfile(options.fontName, this.prefs.effectStyle);
    if (this.profile?.seed !== profile.seed || this.profile?.style !== profile.style) {
      this.profile = profile; this.rays = []; let seed = profile.seed;
      const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      this.nodes = Array.from({ length: this.preview ? 24 : 54 }, () => ({ x: random(), y: random(), phase: random() * Math.PI * 2, size: 0.4 + random() * 1.2, speed: 0.02 + random() * 0.025 }));
    }
    this.enabled = this.prefs.effects && this.prefs.effectIntensity > 0 && !this.reduce.matches; this.color = options.light ? options.accent : palettes[profile.style] || options.accent; this.font = options.fontFamily;
    this.canvas.hidden = !this.enabled; this.canvas.dataset.profile = profile.style;
    if (!this.enabled) { this.rays = []; cancelAnimationFrame(this.frame); this.frame = 0; this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
    else { this.draw(performance.now()); this.wake(); }
    return profile;
  }
  wake() {
    if (!this.enabled || !this.active || document.hidden || !this.width || !this.height || this.frame) return;
    const loop = now => {
      this.frame = 0; if (!this.enabled || document.hidden || !this.width || !this.height) return;
      if (!this.lastDraw || now - this.lastDraw >= 32) { this.draw(now); this.lastDraw = now; }
      if (this.prefs.ambientEffects || this.rays.length) this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }
  advance(now) {
    if (this.lastTime !== null && this.enabled) this.motionTime += Math.max(0, Math.min(250, now - this.lastTime)) / 1000 * (this.prefs?.effectSpeed || 1);
    this.lastTime = now;
  }
  emit({ x, y }, wake = true) {
    if (!this.enabled || !this.prefs.typingEffects || !this.width || !this.height) return;
    x = Math.max(0, Math.min(this.width, x)); y = Math.max(0, Math.min(this.height, y));
    if (wake) this.advance(performance.now());
    const now = this.motionTime, rotation = (this.profile.seed % 360) / 180 * Math.PI + (++this.burst * 0.47);
    // Abstract geometry only: never copy input text into effects (including passwords).
    for (let i = 0; i < 5; i++) {
      const angle = rotation + i * Math.PI * 2 / 5, end = rayTarget(x, y, angle, this.width, this.height);
      this.rays.push({ x, y, end, start: now, duration: 1.35 + i * 0.09, bend: (i % 2 ? -1 : 1) * 0.045 });
    }
    this.rays = this.rays.slice(-100); if (wake) this.wake();
  }
  point(ray, t) {
    const { x, y, end, bend } = ray, dx = end.x - x, dy = end.y - y;
    const curve = this.profile.style === 'matrix' || this.profile.style === 'phosphor' ? 0 : Math.sin(t * Math.PI) * bend;
    return { x: x + dx * t - dy * curve, y: y + dy * t + dx * curve };
  }
  draw(now) {
    if (!this.ctx || !this.profile || !this.width) return;
    this.advance(now);
    const ctx = this.ctx, w = this.width, h = this.height, strength = this.prefs.effectIntensity, size = this.prefs.effectSize || 1;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    if (!this.enabled) return;
    const time = this.motionTime, style = this.profile.style;
    if (this.preview && (!this.lastDemo || time - this.lastDemo > 1.5) && this.prefs.typingEffects) { this.emit({ x: Math.min(100, w * 0.25), y: h * 0.6 }, false); this.lastDemo = time || 0.001; }
    ctx.fillStyle = this.color; ctx.strokeStyle = this.color; ctx.lineWidth = size * 0.9;
    if (this.prefs.ambientEffects) {
      for (let i = 0; i < this.nodes.length; i++) {
        const n = this.nodes[i], x = n.x * w, y = n.y * h;
        ctx.globalAlpha = strength * (0.18 + 0.34 * (0.5 + 0.5 * Math.sin(time * 0.4 + n.phase)));
        if (style === 'matrix') {
          if (i > (this.preview ? 7 : 24)) break; ctx.font = (10 * size) + 'px ' + this.font;
          const top = ((n.y + time * n.speed) % 1) * (h + 90) - 90;
          for (let k = 0; k < 5; k++) { ctx.globalAlpha = strength * (5 - k) * 0.075; ctx.fillText((i + k) % 2 ? '1' : '0', x, top - k * 16); }
        } else if (style === 'circuit') {
          if (i > 18) break; const next = this.nodes[(i + 1) % 19];
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (next.x * w - x) * 0.15, y); ctx.lineTo(x + (next.x * w - x) * 0.15, y + 18); ctx.stroke(); ctx.fillRect(x - size, y - size, 2 * size, 2 * size);
          const pulse = (time * 0.3 + n.phase) % 1; ctx.globalAlpha = strength * 0.45; ctx.beginPath(); ctx.arc(x + (next.x * w - x) * 0.15 * pulse, y, size, 0, Math.PI * 2); ctx.fill();
        } else if (style === 'phosphor') {
          if (i > 9) break; ctx.globalAlpha = strength * 0.12; ctx.fillRect(0, (n.y * h + time * 3) % h, w, 0.6 * size);
        } else {
          const drift = style === 'ember' ? -time * 4 * n.size : Math.sin(time * n.speed + n.phase) * 8;
          ctx.beginPath(); ctx.arc(x, ((y + drift) % h + h) % h, n.size * size * (style === 'cosmic' ? 0.9 : 0.7), 0, Math.PI * 2); ctx.fill();
          if (style === 'cosmic' && i % 13 === 0) { ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y); ctx.moveTo(x, y - 3); ctx.lineTo(x, y + 3); ctx.stroke(); }
        }
      }
    }
    if (this.prefs.ambientEffects && (style === 'aurora' || style === 'cosmic')) {
      ctx.globalAlpha = strength * 0.1;
      for (let i = 0; i < 2; i++) {
        const shift = Math.sin(time * 0.06 + i + this.profile.seed % 7) * h * 0.02;
        ctx.beginPath(); ctx.moveTo(0, h * (0.7 + i * 0.1) + shift); ctx.bezierCurveTo(w * 0.3, h * 0.95, w * 0.6, h * 0.3 + shift, w, h * 0.65 + shift); ctx.stroke();
      }
    }
    this.rays = this.rays.filter(ray => time - ray.start < ray.duration);
    for (const ray of this.rays) {
      const progress = Math.min(1, (time - ray.start) / ray.duration), t = ease(progress), head = this.point(ray, t);
      ctx.globalAlpha = strength * 0.9 * Math.sin(Math.PI * Math.min(1, progress * 1.1));
      ctx.beginPath(); const tail = this.point(ray, Math.max(0, t - 0.045)); ctx.moveTo(tail.x, tail.y); ctx.lineTo(head.x, head.y); ctx.stroke();
      ctx.globalAlpha *= 0.7; ctx.beginPath(); ctx.arc(head.x, head.y, size * (style === 'matrix' ? 1.4 : 1.2), 0, Math.PI * 2); ctx.fill();
      if (style === 'cosmic' || style === 'aurora') { ctx.globalAlpha *= 0.3; ctx.beginPath(); ctx.arc(head.x, head.y, 4 * size, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
}
