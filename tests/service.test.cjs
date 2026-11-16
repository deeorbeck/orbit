const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { execFileSync } = require('node:child_process');
const { SessionClient, serviceAddress } = require('../src/session-client.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn) { for (let i = 0; i < 100; i++) { const value = await fn(); if (value) return value; await delay(80); } throw new Error('Session service test timed out.'); }

test('detached PTY survives its GUI parent exit with PID, variables, cwd and alternate screen intact', { timeout: 40000 }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-service-')), data = path.join(root, 'private'), cwd = path.join(root, 'project with spaces'); fs.mkdirSync(cwd);
  let client;
  try {
    const output = path.join(root, 'parent.json');
    execFileSync(process.execPath, [path.join(__dirname, 'service-parent.cjs'), data, cwd, output], { timeout: 20000, stdio: 'pipe' });
    const original = JSON.parse(fs.readFileSync(output, 'utf8'));
    client = await new SessionClient(data).start();
    const attached = await client.request('attach', { id: original.id });
    assert.equal(attached.info.pid, original.pid);
    assert(attached.snapshot.includes('VALUE:kept'));
    const next = path.join(cwd, 'child'); fs.mkdirSync(next);
    const command = process.platform === 'win32' ? `Set-Location -LiteralPath '${next.replaceAll("'", "''")}'; Write-Output ('RESTORED:'+$global:ORBIT_KEEP)` : `cd '${next.replaceAll("'", "'\\''")}'; printf '\\nRESTORED:%s\\n' "$ORBIT_KEEP"`;
    await client.request('write', { id: original.id, data: command + '\r' });
    await until(async () => (await client.request('attach', { id: original.id })).snapshot.includes('RESTORED:kept'));
    let currentCwd; try { currentCwd = await until(async () => { const value = await client.request('cwd', { id: original.id }); return value && fs.realpathSync.native(value) === fs.realpathSync.native(next) && value; }); } catch (error) { throw new Error(error.message + ' cwd=' + await client.request('cwd', { id: original.id }) + ' snapshot=' + JSON.stringify((await client.request('attach', { id: original.id })).snapshot)); }
    assert.equal(fs.realpathSync.native(currentCwd), fs.realpathSync.native(next));
    const alternate = process.platform === 'win32' ? `& '${process.execPath.replaceAll("'", "''")}' -e "eval(Buffer.from('${Buffer.from('process.stdout.write("\\x1b[?1049hALT_STATE\\x1b[3;8H"); setTimeout(()=>{},15000)').toString('base64')}','base64').toString())"` : "printf '\\033[?1049hALT_STATE\\033[3;8H'; sleep 15";
    await client.request('write', { id: original.id, data: alternate + '\r' });
    let altSnapshot; try { await until(async () => { altSnapshot = (await client.request('attach', { id: original.id })).snapshot; return altSnapshot.includes(process.platform === 'win32' ? 'ALT_STATE' : '\x1b[?1049h'); }); } catch (error) { throw new Error(error.message + ' alternate=' + JSON.stringify(altSnapshot)); }
    client.disconnect(); client = await new SessionClient(data).start();
    const restored = await client.request('attach', { id: original.id });
    assert.equal(restored.info.pid, original.pid);
    assert(restored.snapshot.includes('ALT_STATE'));
    // ConPTY owns the alternate buffer and emits its visible contents without a 1049 mode switch.
    if (process.platform !== 'win32') assert(restored.snapshot.includes('\x1b[?1049h'), 'alternate screen must be restored');
    assert.equal(restored.snapshot, altSnapshot, 'visible content and cursor state must survive reattachment');
    await client.request('close', { id: original.id });
    assert.equal((await client.request('list')).length, 0);
  } finally {
    if (client) { try { await client.request('shutdown'); } catch {} client.disconnect(); }
    await delay(150); fs.rmSync(root, { recursive: true, force: true, maxRetries: 30, retryDelay: 100 });
  }
});
test('service rejects connections without the private per-user token', { timeout: 15000 }, async () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-auth-'));
  const client = await new SessionClient(data).start();
  try {
    const rejected = await new Promise((resolve, reject) => {
      const socket = net.createConnection(serviceAddress(data));
      const timer = setTimeout(() => { socket.destroy(); reject(new Error('unauthenticated connection was not closed')); }, 3000);
      socket.on('connect', () => socket.write(JSON.stringify({ auth: 'invalid' }) + '\n'));
      socket.on('error', () => {});
      socket.on('close', () => { clearTimeout(timer); resolve(true); });
    });
    assert(rejected);
    if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(data, 'service.token')).mode & 0o777, 0o600);
  } finally { await client.request('shutdown'); client.disconnect(); await delay(100); fs.rmSync(data, { recursive: true, force: true, maxRetries: 30, retryDelay: 100 }); }
});
test('a stopped service restores a private screen snapshot without pretending its old process is alive', { timeout: 20000 }, async () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-cold-'));
  const { defaults } = require('../src/config.cjs');
  const { randomUUID } = require('node:crypto');
  const config = { ...defaults, shell: process.platform === 'win32' ? defaults.shell : '/bin/sh' };
  let client = await new SessionClient(data).start();
  try {
    const id = randomUUID(), original = await client.request('create', { id, options: { cwd: data, projectId: 'cold', config } });
    const command = process.platform === 'win32' ? "Write-Output ('SCREEN:orbit-'+[char]0xd83c+[char]0xdf17+'-o'+[char]0x2018+'zbek')" : "printf '\\nSCREEN:%s\\n' 'orbit-🌗-o‘zbek'";
    await client.request('write', { id, data: command + '\r' });
    let lastScreen; try { await until(async () => { lastScreen = (await client.request('attach', { id })).snapshot; return lastScreen.includes('SCREEN:orbit-🌗-o‘zbek'); }); } catch (error) { throw new Error(error.message + JSON.stringify(lastScreen)); }
    await client.request('shutdown'); client.disconnect();
    await until(async () => !fs.existsSync(path.join(data, 'service.lock')));
    client = await new SessionClient(data).start();
    const recovered = await client.request('attach', { id });
    assert.equal(recovered.info.status, 'stopped'); assert.equal(recovered.info.pid, null);
    assert(recovered.snapshot.includes('SCREEN:orbit-🌗-o‘zbek'));
    const restarted = await client.request('restart', { id, config });
    assert.equal(restarted.status, 'running'); assert.notEqual(restarted.pid, original.pid);
  } finally { try { await client.request('shutdown'); } catch {} client.disconnect(); await delay(200); fs.rmSync(data, { recursive: true, force: true, maxRetries: 30, retryDelay: 100 }); }
});
