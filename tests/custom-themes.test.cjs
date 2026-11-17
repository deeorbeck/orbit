const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { normalize, saveConfig } = require('../src/config.cjs');
const { currentTheme, themes } = require('../src/themes.cjs');

test('custom theme palette, imported font and startup choice survive disk reload', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-themes-'));
  try {
    const file = path.join(root, 'config.json');
    saveConfig(file, { customThemes: [{ id: 'custom-mine', name: 'My workspace', baseTheme: 'futuristic', terminal: '#112233', foreground: '#DDEEFF', accent: '#66CCAA', fontFamily: '"Orbit Local abc123", monospace', fontName: 'Muar Regular', fontSize: 18, lineHeight: 1.5 }], appearance: { theme: 'custom-mine' } });
    const config = normalize(JSON.parse(fs.readFileSync(file)));
    assert.equal(config.appearance.theme, 'custom-mine');
    const theme = currentTheme(config);
    assert.equal(theme.name, 'My workspace'); assert.equal(theme.terminal, '#112233'); assert.equal(theme.foreground, '#ddeeff');
    assert.equal(theme.fontFamily, '"Orbit Local abc123", monospace'); assert.equal(theme.fontSize, 18); assert.equal(theme.lineHeight, 1.5);
    assert.equal(theme.side, themes.futuristic.side);
    assert.equal(currentTheme(normalize({ ...config, customThemes: [] })).name, 'Graphite', 'Deleting the startup theme must fall back safely.');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('custom theme validation prevents builtin overrides, duplicate IDs and unsafe colors', () => {
  const config = normalize({ appearance: { theme: 'custom-test' }, customThemes: [
    { id: 'graphite', name: 'Override' }, null, { id: 'custom-test', name: 'Valid', baseTheme: '__proto__', terminal: 'url(https://example.com)', fontSize: 100, lineHeight: -5 }, { id: 'custom-test', name: 'Duplicate' },
  ] });
  assert.equal(config.customThemes.length, 1);
  assert.equal(config.customThemes[0].name, 'Valid'); assert.equal(currentTheme(config).terminal, themes.graphite.terminal);
  assert.equal(currentTheme(config).fontSize, 28); assert.equal(currentTheme(config).lineHeight, 1);
  assert.equal(themes.graphite.name, 'Graphite');
  assert.equal(normalize({ appearance: { theme: 'missing' } }).appearance.theme, 'graphite');
});
