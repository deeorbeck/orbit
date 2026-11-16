const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {extraFonts, fontOptions} = require('../src/font-catalog.cjs');
test('additional fonts are bundled with original hashes, licenses and unique selectable families', () => {
 const base=path.join(__dirname,'../assets/fonts'), sources=require('../assets/fonts/sources.json');
 assert.equal(new Set(fontOptions.map(f=>f.fontFamily)).size,fontOptions.length);
 for (const font of extraFonts) {
  const source=sources.find(s=>s.family===font.name);assert(source,font.name);
  assert.equal(createHash('sha256').update(fs.readFileSync(path.join(base,source.file))).digest('hex'),source.sha256);
  assert(fs.statSync(path.join(base,source.license)).size>1000,font.name+' license');
 }
 assert.equal(extraFonts.find(f=>f.name==='Orbitron').monospace,false);
});
