const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const { EventEmitter } = require('node:events');

function serviceAddress(directory) {
  const hash = createHash('sha256').update(path.resolve(directory)).digest('hex').slice(0, 20);
  return process.platform === 'win32' ? `\\\\.\\pipe\\orbit-${hash}` : `/tmp/orbit-${process.getuid?.() || 0}-${hash}.sock`;
}
function tokenFor(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, 'service.token');
  try { fs.writeFileSync(file, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  return fs.readFileSync(file, 'utf8').trim();
}
class SessionClient extends EventEmitter {
  constructor(directory) { super(); this.directory = directory; this.pending = new Map(); this.sequence = 0; this.closed = false; }
  connect() {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(serviceAddress(this.directory));
      socket.setEncoding('utf8');
      let buffer = '', settled = false;
      const timeout = setTimeout(() => { socket.destroy(); if (!settled) reject(new Error('Session service connection timed out.')); }, 2000);
      socket.once('error', error => { clearTimeout(timeout); if (!settled) reject(error); });
      socket.on('connect', () => socket.write(JSON.stringify({ auth: tokenFor(this.directory) }) + '\n'));
      socket.on('data', chunk => {
        buffer += chunk.toString();
        if (buffer.length > 32 * 1024 * 1024) { socket.destroy(); return; }
        let index;
        while ((index = buffer.indexOf('\n')) >= 0) {
          let message; try { message = JSON.parse(buffer.slice(0, index)); } catch { socket.destroy(); return; }
          buffer = buffer.slice(index + 1);
          if (message.ready) { settled = true; clearTimeout(timeout); this.socket = socket; resolve(this); }
          else if (message.requestId) {
            const p = this.pending.get(message.requestId); if (!p) continue;
            this.pending.delete(message.requestId); clearTimeout(p.timer);
            message.error ? p.reject(new Error(message.error)) : p.resolve(message.result);
          } else if (message.event) this.emit(message.event, message.data);
        }
      });
      socket.on('close', () => {
        clearTimeout(timeout);
        for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('Session service disconnected.')); }
        this.pending.clear();
        if (settled && !this.closed) this.emit('disconnected');
      });
    });
  }
  async start() {
    tokenFor(this.directory);
    try { return await this.connect(); } catch {}
    let childExited = true;
    const launch = () => {
      childExited = false;
      const log = fs.openSync(path.join(this.directory, 'service.log'), 'a', 0o600);
      const child = spawn(process.execPath, [path.join(__dirname, 'session-service.cjs'), this.directory], { detached: true, windowsHide: true, stdio: ['ignore', log, log], env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', ORBIT_SMOKE_TEST: '' } });
      child.unref(); fs.closeSync(log);
      child.once('exit', () => childExited = true);
      child.once('error', error => { childExited = true; this.emit('service-error', error.message); });
    };
    launch();
    for (let i = 0; i < 60; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      try { return await this.connect(); } catch {}
      if (childExited && i % 10 === 9) launch();
    }
    throw new Error('Could not start the Orbit session service. Check service.log.');
  }
  request(method, args = {}) {
    if (!this.socket || this.socket.destroyed) return Promise.reject(new Error('Session service is not connected.'));
    const requestId = String(++this.sequence);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(requestId); reject(new Error(`Session request timed out: ${method}`)); }, 20000);
      this.pending.set(requestId, { resolve, reject, timer });
      this.socket.write(JSON.stringify({ requestId, method, args }) + '\n');
    });
  }
  disconnect() { this.closed = true; this.socket?.end(); }
}
module.exports = { SessionClient, serviceAddress, tokenFor };
