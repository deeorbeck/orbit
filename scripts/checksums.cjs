const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const directory = process.argv[2] || 'out';
const files = fs.readdirSync(directory).filter(name => /\.(exe|dmg|zip|AppImage|deb)$/.test(name)).sort();
if (!files.length) throw new Error('No release installers found.');
const lines = files.map(name => `${createHash('sha256').update(fs.readFileSync(path.join(directory, name))).digest('hex')}  ${name}`);
fs.writeFileSync(path.join(directory, 'SHA256SUMS.txt'), lines.join('\n') + '\n');
console.log(`Wrote checksums for ${files.length} files.`);
