function fontProfile(name, override = 'auto') {
  const value = name.toLowerCase();
  let style = /matrix|asterisk/.test(value) ? 'matrix' : /vt323|cutive/.test(value) ? 'phosphor' : /orbitron|space mono|muar/.test(value) ? 'cosmic' : /betong|source code/.test(value) ? 'ember' : /victor|inconsolata/.test(value) ? 'aurora' : 'circuit';
  if (override !== 'auto') style = override;
  let seed = 2166136261; for (const char of value) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  return { style, seed, cursorStyle: style === 'matrix' || style === 'phosphor' ? 'block' : style === 'ember' ? 'underline' : 'bar', cursorWidth: style === 'cosmic' ? 2 : 1 };
}
function rayTarget(x, y, angle, width, height) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const tx = Math.abs(dx) < 1e-8 ? Infinity : ((dx > 0 ? width : 0) - x) / dx;
  const ty = Math.abs(dy) < 1e-8 ? Infinity : ((dy > 0 ? height : 0) - y) / dy;
  const distance = Math.max(0, Math.min(tx, ty));
  return { x: Math.max(0, Math.min(width, x + dx * distance)), y: Math.max(0, Math.min(height, y + dy * distance)) };
}
module.exports = { fontProfile, rayTarget };
