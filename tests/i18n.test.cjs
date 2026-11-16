const { test } = require('node:test');
const assert = require('node:assert/strict');
const { translate, uz } = require('../src/i18n.cjs');
const { normalize } = require('../src/config.cjs');
test('English is the default, Uzbek is opt-in, and unknown languages fall back safely', () => {
  assert.equal(normalize({}).language, 'en');
  assert.equal(normalize({language:'uz'}).language, 'uz');
  assert.equal(normalize({language:'unknown'}).language, 'en');
  assert.equal(translate('en', 'Hide sidebar'), 'Hide sidebar');
  assert.equal(translate('uz', 'Hide sidebar'), 'Yon panelni yopish');
  assert.equal(translate('unknown', 'Hide sidebar'), 'Hide sidebar');
});
test('translations preserve every interpolation field and do not reinterpret values', () => {
  const fields = s => [...s.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map(m=>m[1]).sort();
  for (const [key,value] of Object.entries(uz)) assert.deepEqual(fields(value), fields(key), key);
  assert.equal(translate('en', 'Edit project {name}', {name:'{count} <script>'}), 'Edit project {count} <script>');
  assert.equal(translate('uz', 'Imported {count} SSH profiles.', {count:3}), '3 ta SSH profil import qilindi.');
});
