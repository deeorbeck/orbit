// Preserve ordinary test output and make native CI failures visible in annotations.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const files = fs.readdirSync('tests').filter(name => name.endsWith('.test.cjs')).map(name => path.join('tests', name));
const child = spawn(process.execPath, ['--test', ...files], { stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
for (const [stream, target] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) stream.on('data', data => { target.write(data); output += data.toString(); });
child.on('exit', code => {
  if (code && process.env.GITHUB_ACTIONS) {
    const detail = output.slice(-14000).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
    console.log(`::error title=Native test failure::${detail}`);
  }
  process.exitCode = code ?? 1;
});
