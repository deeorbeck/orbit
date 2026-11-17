const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { listFonts, importFonts } = require('../src/local-fonts.cjs');

test('private font imports survive reload, keep distinct faces, and reject invalid files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-fonts-'));
  try {
    const fonts = [path.resolve(__dirname, '../assets/fonts/ibmplexmono.woff2'), path.resolve(__dirname, '../assets/fonts/Orbitron-Regular.ttf')];
    const imported = importFonts(root, fonts);
    assert.equal(imported.length, 2);
    assert.notEqual(imported[0].fontFamily, imported[1].fontFamily);
    assert.deepEqual(listFonts(root), imported);
    importFonts(root, [fonts[0]]);
    assert.equal(listFonts(root).length, 2, 'Reimporting must not duplicate a face.');
    assert.equal(fs.readFileSync(path.join(root, 'fonts', path.basename(fonts[0]))).equals(fs.readFileSync(fonts[0])), true);
    const invalid = path.join(root, 'invalid.ttf'); fs.writeFileSync(invalid, 'not a font');
    assert.throws(() => importFonts(root, [invalid]), /not a supported font/);
    if (process.platform !== 'win32') {
      fs.symlinkSync(fonts[0], path.join(root, 'fonts', 'link.ttf'));
      assert.equal(listFonts(root).length, 2, 'Font URLs must not expose symlink targets.');
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
