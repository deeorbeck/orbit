const themeStyles = { graphite: 'circuit', coding: 'circuit', modern: 'aurora', futuristic: 'cosmic', midnight: 'cosmic', warm: 'ember', dracula: 'aurora', nord: 'frost', solarized: 'solar', paper: 'ink' };
function fontProfile(name, override = 'auto', context = {}) {
  const value = name.toLowerCase();
  let style = /matrix|asterisk/.test(value) ? 'matrix' : /vt323|cutive/.test(value) ? 'phosphor' : /orbitron|space mono|muar/.test(value) ? 'cosmic' : /betong|source code/.test(value) ? 'ember' : /victor|inconsolata/.test(value) ? 'aurora' : 'circuit';
  if (override === 'auto' && Object.hasOwn(themeStyles, context.baseTheme || context.themeId)) style = themeStyles[context.baseTheme || context.themeId];
  else if (!['auto', 'font'].includes(override)) style = override;
  let seed = 2166136261; for (const char of value + '|' + (context.themeId || '')) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  return { style, seed, cursorStyle: style === 'matrix' || style === 'phosphor' ? 'block' : style === 'ember' || style === 'ink' ? 'underline' : 'bar', cursorWidth: style === 'cosmic' ? 2 : 1 };
}
function radialTargets(x, y, count, rotation, radius) {
  return Array.from({ length: count }, (_, index) => {
    const angle = rotation + index * 2 * Math.PI / count;
    return { x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius };
  });
}
module.exports = { fontProfile, radialTargets, themeStyles };
