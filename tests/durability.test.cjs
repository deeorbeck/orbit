const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const pty = require('node-pty');
const { remoteSessionCommand } = require('../src/config.cjs');

const tmuxPath = ['/opt/homebrew/bin/tmux', '/usr/local/bin/tmux', '/usr/bin/tmux'].find(fs.existsSync);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) { try { const value = fn(); if (value) return value; } catch {} await delay(80); }
  throw new Error('tmux state did not reach the expected value');
}
test('a real tmux shell survives a dropped PTY and reattaches with its variables and PID', { skip: !tmuxPath, timeout: 20000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-durable-'));
  const socket = `orbit-qa-${process.pid}`;
  const session = 'orbit-durability';
  const tmux = (...args) => execFileSync(tmuxPath, ['-L', socket, '-f', '/dev/null', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  let first, second;
  try {
    fs.mkdirSync(path.join(dir, 'bin'));
    fs.writeFileSync(path.join(dir, 'bin', 'tmux'), `#!/bin/sh\nexec '${tmuxPath}' -L '${socket}' -f /dev/null "$@"\n`, { mode: 0o700 });
    fs.writeFileSync(path.join(dir, '.profile'), `export PATH='${dir}/bin:/opt/homebrew/bin:/usr/bin:/bin'\n`);
    const env = { ...process.env, HOME: dir, SHELL: '/bin/sh', TERM: 'xterm-256color', PATH: `${dir}/bin:/opt/homebrew/bin:/usr/bin:/bin` };
    delete env.TMUX;
    const command = remoteSessionCommand({ persistent: true, sessionName: session });
    const spawn = () => { const terminal = pty.spawn('/bin/sh', ['-c', command], { cwd: dir, env, cols: 100, rows: 25 }); terminal.onData(() => {}); return terminal; };
    first = spawn();
    await until(() => tmux('has-session', '-t', session) === '');
    first.write("export ORBIT_DURABILITY=kept; printf '\\nORBIT_READY\\n'\r");
    await until(() => tmux('capture-pane', '-p', '-t', session).split('\n').some(line => line.trim() === 'ORBIT_READY'));
    const before = tmux('display-message', '-p', '-t', session, '#{pane_pid}');
    first.kill();
    await until(() => tmux('list-clients', '-F', '#{session_name}') === '');
    assert.equal(tmux('has-session', '-t', session), '');
    second = spawn();
    await until(() => tmux('list-clients', '-F', '#{session_name}').includes(session));
    second.write("printf '\\nRESTORED:%s\\n' \"$ORBIT_DURABILITY\"\r");
    await until(() => tmux('capture-pane', '-p', '-t', session).split('\n').some(line => line.trim() === 'RESTORED:kept'));
    const after = tmux('display-message', '-p', '-t', session, '#{pane_pid}');
    assert.equal(after, before, 'The shell PID must remain identical across disconnection');
  } finally {
    try { first?.kill(); } catch {}
    try { second?.kill(); } catch {}
    try { tmux('kill-server'); } catch {}
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
