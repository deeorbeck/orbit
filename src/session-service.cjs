const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { timingSafeEqual } = require('node:crypto');
const { execFile } = require('node:child_process');
const pty = require('node-pty');
const { Terminal } = require('@xterm/headless');
const { SerializeAddon } = require('@xterm/addon-serialize');
const { serviceAddress, tokenFor } = require('./session-client.cjs');
const { atomicJSON } = require('./workspaces.cjs');
const { normalize, sshArgs, remoteSessionCommand } = require('./config.cjs');
const { shellArgs, sshExecutable, terminalEnv } = require('./platform.cjs');

async function main(directory) {
  if (!directory || !path.isAbsolute(directory)) throw new Error('A private service directory is required.');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const lock = path.join(directory, 'service.lock');
  try { fs.mkdirSync(lock, { mode: 0o700 }); } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let live = false;
    try { process.kill(Number(fs.readFileSync(path.join(lock, 'pid'), 'utf8')), 0); live = true; } catch (e) { if (e.code === 'EPERM') live = true; }
    if (live || (!fs.existsSync(path.join(lock, 'pid')) && Date.now() - fs.statSync(lock).mtimeMs < 10000)) return;
    fs.rmSync(lock, { recursive: true }); fs.mkdirSync(lock, { mode: 0o700 });
  }
  fs.writeFileSync(path.join(lock, 'pid'), String(process.pid), { mode: 0o600 });
  const address = serviceAddress(directory), token = Buffer.from(tokenFor(directory));
  const storage = path.join(directory, 'screens'); fs.mkdirSync(storage, { recursive: true, mode: 0o700 });
  const sessions = new Map(), clients = new Set();
  let idleTimer;
  const send = (client, message) => {
    if (client.destroyed) return;
    if (client.writableLength > 16 * 1024 * 1024) { client.destroy(); return; }
    client.write(JSON.stringify(message) + '\n');
  };
  const emit = (event, data) => { for (const c of clients) if (!data.id || c.attached.has(data.id)) send(c, { event, data }); };
  const info = s => ({ ...s.info, cwd: s.cwd, pid: s.pty?.pid || null, status: s.status, exitCode: s.exitCode, seq: s.seq, cols: s.terminal.cols, rows: s.terminal.rows });
  const screenFile = id => path.join(storage, `${id}.json`);
  const persist = s => {
    if (s.deleted) return;
    try { atomicJSON(screenFile(s.info.id), { info: info(s), options: s.options, snapshot: s.serialize.serialize({ scrollback: 3000 }) }); } catch (error) { console.error('Snapshot:', error.message); }
  };
  const schedulePersist = s => { if (!s.saveTimer) s.saveTimer = setTimeout(() => { s.saveTimer = null; persist(s); }, 1500); };
  const flush = s => new Promise(resolve => s.terminal.write('', resolve));
  const applyCwd = (s, value) => {
    if (typeof value !== 'string' || value.length > 4096 || /[\x00-\x1f]/.test(value)) return;
    if (!s.options.serverId && !s.options.aliasName && !path.isAbsolute(value)) return;
    s.cwd = value; emit('cwd', { id: s.info.id, cwd: value }); schedulePersist(s);
  };
  const makeRecord = (metadata, options, snapshot) => {
    const terminal = new Terminal({ cols: metadata.cols || 100, rows: metadata.rows || 30, allowProposedApi: true, scrollback: 10000, logLevel: 'off' });
    const serialize = new SerializeAddon(); terminal.loadAddon(serialize);
    const s = { info: metadata, options, terminal, serialize, cwd: metadata.cwd, status: 'stopped', seq: 0, exitCode: metadata.exitCode, clients: new Set(), wasConnected: false, reconnectAttempts: 0 };
    terminal.onTitleChange(title => { if (s.deleted) return; s.info.title = title; emit('status', info(s)); schedulePersist(s); });
    terminal.onData(data => { try { s.pty?.write(data); } catch {} });
    terminal.parser.registerOscHandler(7, value => { try { const uri = new URL(value); if (uri.protocol === 'file:') { let cwd = decodeURIComponent(uri.pathname); if (process.platform === 'win32' && !options.serverId && !options.aliasName) cwd = cwd.replace(/^\/([A-Za-z]:)/, '$1').replaceAll('/', '\\'); applyCwd(s, cwd); } } catch {} return true; });
    terminal.parser.registerOscHandler(9, value => { if (value.startsWith('9;')) applyCwd(s, value.slice(2).replace(/^"|"$/g, '')); return true; });
    terminal.parser.registerOscHandler(1337, value => { if (value.startsWith('CurrentDir=')) applyCwd(s, value.slice(11)); return false; });
    terminal.parser.registerOscHandler(777, value => { if (value !== 'OrbitReady') return false; s.wasConnected = true; s.reconnectAttempts = 0; return true; });
    if (snapshot) terminal.write(snapshot);
    sessions.set(metadata.id, s); return s;
  };
  for (const file of fs.readdirSync(storage).filter(f => /^[a-f0-9-]{36}\.json$/.test(f))) {
    try { const saved = JSON.parse(fs.readFileSync(path.join(storage, file), 'utf8')); const s = makeRecord(saved.info, saved.options, saved.snapshot); s.status = saved.info.status === 'exited' ? 'exited' : 'stopped'; } catch (e) { console.error('Read snapshot:', e.message); }
  }
  const checkIdle = () => {
    clearTimeout(idleTimer);
    if (!clients.size && ![...sessions.values()].some(s => s.status === 'running' || s.status === 'reconnecting')) idleTimer = setTimeout(() => shutdown(false), 10000);
  };
  function spawnSession(s) {
    const config = normalize(s.options.config);
    let executable, args;
    const cwd = s.options.cwd || config.startingDirectory;
    if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) throw new Error(`Folder does not exist: ${cwd}`);
    if (s.options.aliasName) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(s.options.aliasName)) throw new Error('Invalid SSH alias name.');
      executable = config.shell; args = ['-l', '-i', '-c', s.options.aliasName];
      s.info.label = s.options.aliasName; s.info.serverId = `shell-alias:${s.options.aliasName}`; s.info.aliasName = s.options.aliasName;
      s.info.persistent = false; s.info.autoReconnect = false;
    } else if (s.options.serverId) {
      const server = config.servers.find(server => server.id === s.options.serverId);
      if (!server) throw new Error("Server profile not found.");
      const baseName = s.options.remoteSession || `${server.sessionName}-${s.info.id.slice(0, 8)}`;
      s.options.remoteSession = baseName;
      executable = sshExecutable(); args = sshArgs(server);
      const command = remoteSessionCommand({ ...server, sessionName: baseName }, s.options.codex ? config.codexCommand : null, { sourceSession: s.options.sourceRemoteSession });
      if (command) args.push(command);
      s.info.persistent = server.persistent; s.info.autoReconnect = server.autoReconnect;
      s.info.sessionName = server.persistent ? baseName + (s.options.codex ? '-codex' : '') : null;
      s.info.label = s.options.codex ? `Codex · ${server.name}` : server.name;
    } else {
      executable = config.shell;
      if (!path.isAbsolute(executable) || !fs.existsSync(executable)) throw new Error("Set a valid shell path in config.json.");
      args = shellArgs(executable, s.options.codex ? config.codexCommand : null);
      s.info.label = s.options.codex ? 'Codex' : 'Terminal';
      if (process.platform === 'win32' && !s.options.codex && /powershell|pwsh/i.test(path.basename(executable))) {
        s.cwdFile = path.join(storage, `${s.info.id}.cwd`);
        fs.writeFileSync(s.cwdFile, cwd, { mode: 0o600 });
        const reportPath = s.cwdFile.replaceAll("'", "''");
        args = ['-NoLogo', '-NoExit', '-Command', "$global:__OrbitCwdFile = '" + reportPath + "'; $global:__OrbitOriginalPrompt = (Get-Item Function:\\prompt).ScriptBlock; function global:prompt { $p = (Get-Location).ProviderPath; if ($p) { [System.IO.File]::WriteAllText($global:__OrbitCwdFile, $p, (New-Object System.Text.UTF8Encoding($false))); [Console]::Write([char]27 + ']9;9;' + $p + [char]7) }; & $global:__OrbitOriginalPrompt }"];
      }
    }
    const environment = terminalEnv(require('../package.json').version);
    delete environment.ORBIT_SMOKE_TEST;
    const child = pty.spawn(executable, args, { name: 'xterm-256color', cols: s.terminal.cols, rows: s.terminal.rows, cwd, env: environment });
    if (s.status === 'stopped' && s.terminal.buffer.active.type === 'alternate') {
      s.terminal.write('\x1b[?1049l');
    }
    s.pty = child; s.status = 'running'; s.exitCode = null; clearTimeout(s.reconnectTimer);
    emit('status', { id: s.info.id, ...info(s) }); persist(s);
    child.onData(data => {
      if (s.deleted) return;
      s.terminal.write(data, () => { if (s.deleted) return; s.seq++; emit('data', { id: s.info.id, data, seq: s.seq }); schedulePersist(s); });
    });
    child.onExit(({ exitCode, signal }) => {
      if (s.deleted || s.pty !== child) return;
      s.pty = null; s.exitCode = exitCode; s.status = 'exited';
      if (s.info.autoReconnect && exitCode === 255 && s.wasConnected && s.reconnectAttempts < 5) {
        const delay = Math.min(30, 2 ** (++s.reconnectAttempts)); s.status = 'reconnecting';
        emit('status', { id: s.info.id, ...info(s), retryIn: delay, attempt: s.reconnectAttempts });
        s.reconnectTimer = setTimeout(() => { try { spawnSession(s); } catch (error) { s.status = 'exited'; emit('service-error', { id: s.info.id, message: error.message }); } }, delay * 1000);
      } else emit('exit', { id: s.info.id, exitCode, signal, ...info(s) });
      flush(s).then(() => persist(s)); checkIdle();
    });
  }
  const cwdOf = async s => {
    if (s.options.serverId || s.options.aliasName || !s.pty) return s.cwd;
    if (process.platform === 'win32' && s.cwdFile) { try { applyCwd(s, fs.readFileSync(s.cwdFile, 'utf8')); } catch {} }
    if (process.platform === 'linux') { try { applyCwd(s, fs.readlinkSync(`/proc/${s.pty.pid}/cwd`)); } catch {} }
    if (process.platform === 'darwin') {
      await new Promise(resolve => execFile('/usr/sbin/lsof', ['-a', '-p', String(s.pty.pid), '-d', 'cwd', '-Fn'], { timeout: 2500 }, (_e, stdout) => { const line = stdout?.split('\n').find(line => line.startsWith('n/')); if (line) applyCwd(s, line.slice(1)); resolve(); }));
    }
    return s.cwd;
  };
  const handlers = {
    list: () => [...sessions.values()].map(info),
    create: ({ id, options }) => {
      if (!/^[a-f0-9-]{36}$/.test(id) || sessions.has(id)) throw new Error('Invalid session id.');
      if ([...sessions.values()].filter(s => s.status === 'running').length >= 64) throw new Error("Up to 64 sessions can run at the same time.");
      const s = makeRecord({ id, projectId: options.projectId, windowId: options.windowId, serverId: options.serverId || null, codex: !!options.codex, cwd: options.serverId || options.aliasName ? '~' : options.cwd, label: 'Terminal', cols: 100, rows: 30 }, options);
      try { spawnSession(s); } catch (error) { sessions.delete(id); s.terminal.dispose(); throw error; }
      return info(s);
    },
    attach: async ({ id }, client) => {
      const s = sessions.get(id); if (!s) return null;
      await cwdOf(s); await flush(s);
      // Queue the snapshot before any later output frame on this socket.
      client.attached.add(id);
      return { info: info(s), snapshot: s.serialize.serialize({ scrollback: 10000 }), seq: s.seq, options: { codex: s.options.codex, serverId: s.options.serverId, cwd: s.options.cwd, projectId: s.options.projectId } };
    },
    cwd: async ({ id }) => { const s = sessions.get(id); return s ? await cwdOf(s) : null; },
    detach: ({ ids }, client) => { for (const id of ids || []) client.attached.delete(id); return true; },
    write: ({ id, data }) => { const s = sessions.get(id); if (typeof data === 'string' && data.length < 2_000_000 && s?.pty) s.pty.write(data); return true; },
    resize: ({ id, cols, rows }) => {
      const s = sessions.get(id); if (!s || !Number.isInteger(cols) || !Number.isInteger(rows) || cols < 2 || rows < 1 || cols > 1000 || rows > 1000) return;
      s.terminal.resize(cols, rows); try { s.pty?.resize(cols, rows); } catch {} schedulePersist(s);
    },
    restart: ({ id, config }) => {
      const s = sessions.get(id); if (!s) throw new Error("Session not found.");
      if (s.pty) throw new Error("The session is still running.");
      s.options.config = config; if (!s.options.serverId && fs.existsSync(s.cwd)) s.options.cwd = s.cwd;
      s.reconnectAttempts = 0; s.wasConnected = false; spawnSession(s); return info(s);
    },
    cancelRetry: ({ id }) => { const s = sessions.get(id); if (s) { clearTimeout(s.reconnectTimer); s.status = s.pty ? 'running' : 'exited'; emit('status', info(s)); } },
    close: ({ id }) => {
      const s = sessions.get(id); if (!s) return;
      s.deleted = true; clearTimeout(s.reconnectTimer); clearTimeout(s.saveTimer);
      try { s.pty?.kill(); } catch {} s.terminal.dispose(); sessions.delete(id);
      try { fs.unlinkSync(screenFile(id)); } catch {} emit('removed', { id }); checkIdle();
    },
    shutdown: () => { setTimeout(() => shutdown(true), 50); return true; }
  };
  const server = net.createServer(client => {
    client.setEncoding('utf8');
    client.attached = new Set(); let authenticated = false, buffer = '';
    const authTimer = setTimeout(() => client.destroy(), 3000);
    client.on('error', () => {});
    client.on('data', chunk => {
      buffer += chunk.toString(); if (buffer.length > 8 * 1024 * 1024) { client.destroy(); return; }
      let i;
      while ((i = buffer.indexOf('\n')) >= 0) {
        let message; try { message = JSON.parse(buffer.slice(0, i)); } catch { client.destroy(); return; } buffer = buffer.slice(i + 1);
        if (!authenticated) {
          const candidate = Buffer.from(typeof message.auth === 'string' ? message.auth : '');
          if (candidate.length !== token.length || !timingSafeEqual(candidate, token)) { client.destroy(); return; }
          authenticated = true; clearTimeout(authTimer); clients.add(client); clearTimeout(idleTimer); send(client, { ready: true, protocol: 1 }); continue;
        }
        if (!message.requestId || !handlers[message.method]) { client.destroy(); return; }
        Promise.resolve().then(() => handlers[message.method](message.args || {}, client)).then(result => send(client, { requestId: message.requestId, result })).catch(error => send(client, { requestId: message.requestId, error: error.message }));
      }
    });
    client.on('close', () => { clearTimeout(authTimer); clients.delete(client); checkIdle(); });
  });
  function shutdown(kill) {
    for (const s of sessions.values()) {
      clearTimeout(s.saveTimer);
      clearTimeout(s.reconnectTimer);
      if (kill) s.status = 'exited';
      persist(s);
      if (kill) {
        s.deleted = true;
        try { s.pty?.kill(); } catch {}
      }
    }
    for (const client of clients) client.destroy();
    server.close(() => { try { fs.rmSync(lock, { recursive: true }); } catch {} process.exit(0); });
  }
  process.on('SIGTERM', () => shutdown(true)); process.on('SIGINT', () => shutdown(true));
  if (process.platform !== 'win32') { try { fs.unlinkSync(address); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  server.listen(address, () => { if (process.platform !== 'win32') fs.chmodSync(address, 0o600); checkIdle(); });
  server.on('error', error => { console.error(error.message); try { fs.rmSync(lock, { recursive: true }); } catch {} process.exit(1); });
}
if (require.main === module) main(process.argv[2]).catch(error => { console.error(error.stack); process.exit(1); });
module.exports = { main };
