const themeStyles = { graphite: 'circuit', coding: 'circuit', modern: 'aurora', futuristic: 'cosmic', midnight: 'cosmic', warm: 'ember', dracula: 'aurora', nord: 'frost', solarized: 'solar', paper: 'ink' };
function fontProfile(name, override = 'auto', context = {}) {
  const value = name.toLowerCase();
  let style = /matrix|asterisk/.test(value) ? 'matrix' : /vt323|cutive/.test(value) ? 'phosphor' : /orbitron|space mono|muar/.test(value) ? 'cosmic' : /betong|source code/.test(value) ? 'ember' : /victor|inconsolata/.test(value) ? 'aurora' : 'circuit';
  if (override === 'auto' && Object.hasOwn(themeStyles, context.baseTheme || context.themeId)) style = themeStyles[context.baseTheme || context.themeId];
  else if (!['auto', 'font'].includes(override)) style = override;
  let seed = 2166136261; for (const char of value + '|' + (context.themeId || '')) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  return { style, seed, cursorStyle: style === 'matrix' || style === 'phosphor' ? 'block' : style === 'ember' || style === 'ink' ? 'underline' : 'bar', cursorWidth: style === 'cosmic' ? 2 : 1 };
}
function radialTargets(x, y, count, rotation, width, height) {
  return Array.from({ length: count }, (_, index) => {
    const angle = rotation + index * 2 * Math.PI / count;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const edgeX = Math.abs(dx) < 1e-8 ? Infinity : ((dx > 0 ? width : 0) - x) / dx;
    const edgeY = Math.abs(dy) < 1e-8 ? Infinity : ((dy > 0 ? height : 0) - y) / dy;
    const distance = Math.min(edgeX, edgeY);
    return {
      x: Math.max(0, Math.min(width, x + dx * distance)),
      y: Math.max(0, Math.min(height, y + dy * distance)),
    };
  });
}
module.exports = { fontProfile, radialTargets, themeStyles };
