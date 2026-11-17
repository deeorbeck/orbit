const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const fontDirectory = directory => path.join(directory, 'fonts');
function listFonts(directory) {
  const root = fontDirectory(directory);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).filter(file => /\.(ttf|otf|woff2?)$/i.test(file) && fs.lstatSync(path.join(root, file)).isFile()).sort().map(file => {
    const hash = createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex').slice(0, 20);
    const name = path.parse(file).name.replace(/[-_]+/g, ' ');
    return { name, file, fontFamily: `"Orbit Local ${hash}", monospace`, face: `Orbit Local ${hash}`, url: `orbit://font/${encodeURIComponent(file)}?v=${hash}`, local: true, monospace: false };
  });
}
function importFonts(directory, files) {
  const root = fontDirectory(directory);
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const imported = [];
  for (const file of files) {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > 20 * 1024 * 1024 || !/\.(ttf|otf|woff2?)$/i.test(file)) throw new Error('Choose a TTF, OTF, WOFF or WOFF2 font smaller than 20 MB.');
    const bytes = fs.readFileSync(file), signature = bytes.subarray(0, 4).toString('hex');
    if (!['00010000', '4f54544f', '774f4646', '774f4632', '74727565'].includes(signature)) throw new Error('This file is not a supported font.');
    const name = path.basename(file);
    fs.writeFileSync(path.join(root, name), bytes, { mode: 0o600 }); imported.push(name);
  }
  return listFonts(directory).filter(font => imported.includes(font.file));
}
module.exports = { listFonts, importFonts, fontDirectory };
