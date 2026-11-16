const { test } = require('node:test');
const assert = require('node:assert/strict');
const { defaultShell, shellArgs, terminalEnv } = require('../src/platform.cjs');

test('chooses a real platform-specific shell', () => {
  assert.equal(defaultShell('darwin', {}), '/bin/zsh');
  assert.equal(defaultShell('linux', {}), '/bin/bash');
  assert.equal(defaultShell('linux', { SHELL: '/usr/bin/fish' }), '/usr/bin/fish');
  assert.equal(defaultShell('win32', { SystemRoot: 'C:\\Windows' }), 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
});
test('uses the correct login/command flags on Unix and Windows', () => {
  assert.deepEqual(shellArgs('/bin/zsh', 'codex', 'darwin'), ['-l', '-c', 'exec codex']);
  assert.deepEqual(shellArgs('C:\\Windows\\powershell.exe', null, 'win32'), ['-NoLogo']);
  assert.deepEqual(shellArgs('C:\\Program Files\\PowerShell\\7\\pwsh.exe', 'codex', 'win32'), ['-NoLogo', '-Command', 'codex']);
  assert.deepEqual(shellArgs('C:\\Windows\\cmd.exe', 'codex', 'win32'), ['/d', '/s', '/c', 'codex']);
});
test('terminal environment declares truecolor without leaking Electron mode', () => {
  const env = terminalEnv('test');
  assert.equal(env.TERM, 'xterm-256color');
  assert.equal(env.COLORTERM, 'truecolor');
  assert.equal(env.ELECTRON_RUN_AS_NODE, undefined);
});
