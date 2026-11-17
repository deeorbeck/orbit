// All ten complete themes live here. Edit a palette, then run npm run package.
const themes = {
  graphite: { name: 'Graphite', description: 'Orbit original', base: '#111519', side: '#151a1f', bar: '#181d22', terminal: '#0e1318', text: '#dce0e4', muted: '#98a4af', faint: '#7d8a96', accent: '#d6a574', foreground: '#d8e0e7' },
  coding: { name: 'Coding', description: 'Code, no distractions', base: '#0d1117', side: '#10161d', bar: '#161e27', terminal: '#0a0f14', text: '#d3e3d8', muted: '#9bb6a6', faint: '#769184', accent: '#8dcea4', foreground: '#d1e9d9', font: 'SFMono-Regular, Menlo, monospace' },
  modern: { name: 'Modern', description: 'Clean, bright, precise', light: true, base: '#f1f4f7', side: '#e9eef3', bar: '#ffffff', terminal: '#f9fbfd', text: '#263746', muted: '#526777', faint: '#6e8293', accent: '#386ba3', foreground: '#243d51' },
  futuristic: { name: 'Futuristic', description: 'Deep space console', base: '#09121d', side: '#0b1825', bar: '#112438', terminal: '#050d17', text: '#c3f1ef', muted: '#8cb9bd', faint: '#668b9e', accent: '#6ddfd1', foreground: '#c4efed', radius: '2px' },
  midnight: { name: 'Midnight', description: 'Quiet blue hours', base: '#101423', side: '#141a2a', bar: '#1a2235', terminal: '#0b1020', text: '#dce1f3', muted: '#a1adc9', faint: '#7e8baa', accent: '#a5b8ed', foreground: '#d6e0fa' },
  warm: { name: 'Warm', description: 'Soft copper & charcoal', base: '#1a1816', side: '#211e1a', bar: '#29251f', terminal: '#151310', text: '#e4d9cb', muted: '#b9aa96', faint: '#948674', accent: '#dbb485', foreground: '#e7dac6' },
  dracula: { name: 'Dracula', description: 'Violet after dark', base: '#232330', side: '#282837', bar: '#303042', terminal: '#1e1e2b', text: '#efedf8', muted: '#b5a7cc', faint: '#9688b0', accent: '#bd93f9', foreground: '#f8f8f2' },
  nord: { name: 'Nord', description: 'Arctic blue & frost', base: '#2e3440', side: '#323b49', bar: '#3b4555', terminal: '#272e39', text: '#eceff4', muted: '#b1bdce', faint: '#98a8bc', accent: '#88c0d0', foreground: '#e5e9f0' },
  solarized: { name: 'Solarized', description: 'Low contrast, long focus', base: '#002b36', side: '#073642', bar: '#0d3e49', terminal: '#00252f', text: '#c6d6ce', muted: '#a2b7af', faint: '#809c98', accent: '#c4b26b', foreground: '#b9cdc6' },
  paper: { name: 'Paper', description: 'A calm light workspace', light: true, base: '#f4f1e9', side: '#eae6dc', bar: '#fdfbf5', terminal: '#faf7ef', text: '#353d3b', muted: '#626e68', faint: '#7b857a', accent: '#85714b', foreground: '#364b43' },
};
const typography = {
  graphite: ['IBM Plex Mono', '-apple-system, BlinkMacSystemFont, sans-serif', 1.25],
  coding: ['JetBrains Mono', '"IBM Plex Mono", monospace', 1.3],
  modern: ['Geist Mono', '-apple-system, BlinkMacSystemFont, sans-serif', 1.3],
  futuristic: ['Space Mono', '"Space Mono", monospace', 1.35],
  midnight: ['Fira Code', '-apple-system, BlinkMacSystemFont, sans-serif', 1.3],
  warm: ['Source Code Pro', '"Source Code Pro", monospace', 1.3],
  dracula: ['Victor Mono', '"Victor Mono", monospace', 1.35],
  nord: ['Roboto Mono', '-apple-system, BlinkMacSystemFont, sans-serif', 1.35],
  solarized: ['Inconsolata', '"Inconsolata", monospace', 1.3],
  paper: ['Cutive Mono', '"Cutive Mono", monospace', 1.3],
};
for (const [id, [fontName, uiFont, lineHeight]] of Object.entries(typography)) Object.assign(themes[id], { fontName, fontFamily: `"${fontName}", monospace`, uiFont, lineHeight });
const colorKeys = ['base', 'side', 'bar', 'terminal', 'text', 'muted', 'faint', 'accent', 'foreground'];
const cleanText = (value, fallback, max = 160) => typeof value === 'string' && !/[\x00-\x1f]/.test(value) ? value.trim().slice(0, max) || fallback : fallback;
function normalizeCustomThemes(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).slice(0, 50).filter(value => {
    if (!value || typeof value !== 'object' || !/^custom-[a-zA-Z0-9-]{1,64}$/.test(value.id) || seen.has(value.id)) return false;
    seen.add(value.id); return true;
  }).map(value => {
    const baseTheme = Object.hasOwn(themes, value.baseTheme) ? value.baseTheme : 'graphite', base = themes[baseTheme];
    const fontFamily = cleanText(value.fontFamily, base.fontFamily);
    return {
      id: value.id, custom: true, baseTheme, name: cleanText(value.name, 'My theme', 60), description: 'Custom theme',
      light: typeof value.light === 'boolean' ? value.light : !!base.light,
      ...Object.fromEntries(colorKeys.map(key => [key, /^#[0-9a-f]{6}$/i.test(value[key]) ? value[key].toLowerCase() : base[key]])),
      fontFamily, fontName: cleanText(value.fontName, fontFamily.split(',')[0].replaceAll('"', ''), 60), uiFont: base.uiFont,
      fontSize: Number.isFinite(value.fontSize) ? Math.max(10, Math.min(28, value.fontSize)) : 14,
      lineHeight: Number.isFinite(value.lineHeight) ? Math.max(1, Math.min(2, value.lineHeight)) : base.lineHeight,
    };
  });
}
function themeCatalog(config = {}) { return { ...themes, ...Object.fromEntries(normalizeCustomThemes(config.customThemes).map(theme => [theme.id, theme])) }; }
function currentTheme(config = {}) { return themeCatalog(config)[config.appearance?.theme] || themes.graphite; }
module.exports = { themes, themeIds: Object.keys(themes), colorKeys, normalizeCustomThemes, themeCatalog, currentTheme };
