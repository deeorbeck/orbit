const { themes } = require('./themes.cjs');
const extraFonts = [
  { name: 'Share Tech Mono', style: 'Tech / coding', monospace: true, recommendedSize: 16 },
  { name: 'VT323', style: 'Retro terminal', monospace: true, recommendedSize: 20 },
  { name: 'MatrixType', style: 'Cyber / pixel', monospace: true, recommendedSize: 16 },
  { name: 'Asterisk Mono', style: 'Sci-fi display', monospace: true, recommendedSize: 18 },
  { name: 'Orbitron', style: 'Display', monospace: false, recommendedSize: 16 },
].map(font => ({ ...font, fontFamily: `"${font.name}", monospace` }));
const fontOptions = [...Object.values(themes).map(theme => ({ name: theme.fontName, fontFamily: theme.fontFamily, monospace: true })), ...extraFonts];
module.exports = { extraFonts, fontOptions };
