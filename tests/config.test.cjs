const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { normalize, sshArgs, saveConfig, remoteCodexCommand } = require('../src/config.cjs');

test('config constrains appearance and preserves editable values', () => {
  const config = normalize({ appearance: { fontSize: 1000, wallpaperOpacity: -1, wallpaperMode: 'invalid' }, codexCommand: '/custom/codex --model example' });
  assert.equal(config.appearance.fontSize, 28);
  assert.equal(config.appearance.wallpaperOpacity, 0);
  assert.equal(config.appearance.wallpaperMode, 'contain');
  assert.equal(config.codexCommand, '/custom/codex --model example');
  assert.throws(() => normalize([]));
  const { themeIds } = require('../src/themes.cjs');
  assert.equal(themeIds.length, 10);
  for (const theme of themeIds) assert.equal(normalize({ appearance: { theme } }).appearance.theme, theme);
  assert.equal(normalize({ servers: [{ id: 'a', host: 'host' }] }).servers[0].persistent, true);
  assert.equal(normalize({ servers: [{ id: 'a', host: 'host', persistent: false }] }).servers[0].persistent, false);
});
test('SSH uses argument boundaries and rejects option injection', () => {
  const args = sshArgs({ host: 'example.org', user: 'deploy', port: 2200, identity: '/a path/key' });
  assert.deepEqual(args.slice(-5), ['/a path/key', '-l', 'deploy', '--', 'example.org']);
  assert(args.includes('2200'));
  for (const host of ['-oProxyCommand=touch', 'a b', 'a\nb', '']) assert.throws(() => sshArgs({ host, port: 22 }));
  assert.throws(() => sshArgs({ host: 'localhost', user: '$(whoami)', port: 22 }));
  assert.throws(() => sshArgs({ host: 'localhost', port: 70000 }));
  assert(!sshArgs({ host: 'my-alias', port: 22 }).includes('-p'));
  assert(args.includes('ServerAliveInterval=15'));
  assert(args.includes('ServerAliveCountMax=6'));
});
test('remote Codex command preserves shell quoting', { skip: process.platform === 'win32' }, () => {
  const { execFileSync } = require('node:child_process');
  const result = execFileSync('/bin/sh', ['-c', remoteCodexCommand("printf \"CODEX_QUOTE_TEST:%s\" \"it's safe\"")], { env: { ...process.env, HOME: os.tmpdir(), SHELL: '/bin/sh' }, encoding: 'utf8' });
  assert.equal(result, "CODEX_QUOTE_TEST:it's safe");
});
test('atomic config writes valid JSON with private file permissions', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-config-'));
  try {
    const file = path.join(dir, 'config.json');
    saveConfig(file, { appearance: { fontSize: 17 }, servers: [{ id: 'one', name: 'Test', host: 'localhost' }] });
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(parsed.appearance.fontSize, 17);
    assert.equal(parsed.servers[0].port, 22);
    if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert(!fs.existsSync(file + '.tmp'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
