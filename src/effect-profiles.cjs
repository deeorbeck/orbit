const themeStyles = { graphite: 'circuit', coding: 'circuit', modern: 'aurora', futuristic: 'cosmic', midnight: 'cosmic', warm: 'ember', dracula: 'aurora', nord: 'frost', solarized: 'solar', paper: 'ink' };
function fontProfile(name, override = 'auto', context = {}) {
  const value = name.toLowerCase();
  let style = /matrix|asterisk/.test(value) ? 'matrix' : /vt323|cutive/.test(value) ? 'phosphor' : /orbitron|space mono|muar/.test(value) ? 'cosmic' : /betong|source code/.test(value) ? 'ember' : /victor|inconsolata/.test(value) ? 'aurora' : 'circuit';
  if (override === 'auto' && Object.hasOwn(themeStyles, context.baseTheme || context.themeId)) style = themeStyles[context.baseTheme || context.themeId];
  else if (!['auto', 'font'].includes(override)) style = override;
  let seed = 2166136261; for (const char of value + '|' + (context.themeId || '')) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  return { style, seed, cursorStyle: style === 'matrix' || style === 'phosphor' ? 'block' : style === 'ember' || style === 'ink' ? 'underline' : 'bar', cursorWidth: style === 'cosmic' ? 2 : 1 };
}
// Give each edge its own evenly spaced slots. Rotate the first edge so
// small bursts and counts that aren't divisible by four balance over time.
function trailTargets(count, width, height, burst) {
  const offset = (burst * 0.618034) % 1;
  return Array.from({ length: count }, (_, index) => {
    const edge = (index + burst) % 4;
    const slots = Math.ceil((count - index % 4) / 4);
    const position = 0.06 + 0.88 * (Math.floor(index / 4) + 0.22 + 0.56 * offset) / slots;
    switch (edge) {
      case 0: return { x: width * position, y: 0 };
      case 1: return { x: width, y: height * position };
      case 2: return { x: width * position, y: height };
      default: return { x: 0, y: height * position };
    }
  });
}
module.exports = { fontProfile, trailTargets, themeStyles };
