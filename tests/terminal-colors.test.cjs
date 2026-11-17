const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const pty = require('node-pty');
const { colorShell } = require('../src/platform.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";

test('ordinary interactive shell gives Node and Git colors while redirected output stays plain', { skip: process.platform === 'win32', timeout: 20000 }, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-cli-colors-'));
  let child, output = '';
  const until = async check => { for (let i = 0; i < 120; i++) { if (check()) return; await delay(50); } throw new Error('Interactive CLI color test timed out.'); };
  try {
    fs.writeFileSync(path.join(directory, 'before.txt'), 'OLD_LINE\n'); fs.writeFileSync(path.join(directory, 'after.txt'), 'NEW_LINE\n');
    const config = colorShell({ shell: '/bin/sh' }, directory);
    child = pty.spawn(config.shell, ['-l'], { name: 'xterm-256color', cols: 120, rows: 30, cwd: directory, env: { ...process.env, HOME: directory, NO_COLOR: '1', NODE_DISABLE_COLORS: '1', ANSI_COLORS_DISABLED: '1', PYTHON_COLORS: '0' } });
    child.onData(data => output += data);
    child.write(quote(process.execPath) + " -p '({ cli: \"NODE_COLOR_OK\", count: 42 })'\r");
    await until(() => output.includes('NODE_COLOR_OK') && /\x1b\[3[0-7]m/.test(output));
    output = '';
    child.write('git --no-pager diff --no-index before.txt after.txt\r');
    await until(() => output.includes('NEW_LINE') && /\x1b\[31m/.test(output) && /\x1b\[32m/.test(output));
    output = '';
    child.write(quote(process.execPath) + " -p '({ cli: \"PLAIN_PIPE\" })' > plain.txt\r");
    await until(() => fs.existsSync(path.join(directory, 'plain.txt')) && fs.readFileSync(path.join(directory, 'plain.txt'), 'utf8').includes('PLAIN_PIPE'));
    assert(!fs.readFileSync(path.join(directory, 'plain.txt'), 'utf8').includes('\x1b['), 'Color support must not force ANSI into pipelines.');
  } finally { child?.kill(); await delay(100); fs.rmSync(directory, { recursive: true, force: true }); }
});
