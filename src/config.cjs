const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { themeIds } = require('./themes.cjs');
const { defaultShell } = require('./platform.cjs');

const defaults = {
  version: 1,
  appearance: { fontSize: 14, fontFamily: 'SFMono-Regular, Cascadia Mono, Menlo, Consolas, monospace', wallpaper: true, wallpaperMode: 'contain', wallpaperOpacity: 0.28, dim: 0.25, sidebar: true, theme: 'graphite' },
  shell: defaultShell(),
  startingDirectory: os.homedir(),
  codexCommand: 'codex',
  servers: []
};
function text(v, fallback = '', max = 2048) { return typeof v === 'string' && !/[\x00-\x1f]/.test(v) ? v.slice(0, max) : fallback; }
function normalize(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Config must be a JSON object.');
  const a = raw.appearance || {};
  const number = (v, d, lo, hi) => typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
  return {
    version: 1,
    appearance: {
      fontSize: number(a.fontSize, 14, 10, 28),
      fontFamily: text(a.fontFamily, defaults.appearance.fontFamily, 160),
      wallpaper: typeof a.wallpaper === 'boolean' ? a.wallpaper : true,
      wallpaperMode: ['contain', 'cover', 'fill'].includes(a.wallpaperMode) ? a.wallpaperMode : 'contain',
      wallpaperOpacity: number(a.wallpaperOpacity, 0.28, 0, 1),
      dim: number(a.dim, 0.25, 0, 0.85),
      sidebar: typeof a.sidebar === 'boolean' ? a.sidebar : true,
      theme: themeIds.includes(a.theme) ? a.theme : 'graphite'
    },
    shell: text(raw.shell, defaults.shell),
    startingDirectory: text(raw.startingDirectory, defaults.startingDirectory),
    codexCommand: text(raw.codexCommand, 'codex', 512),
    servers: (Array.isArray(raw.servers) ? raw.servers : []).slice(0, 100).map((s, i) => ({
      id: text(s.id, `server-${i}`, 80), name: text(s.name, 'Server', 80),
      host: text(s.host, '', 255).trim(), user: text(s.user, '', 80).trim(),
      port: Math.round(number(Number(s.port || 22), 22, 1, 65535)),
      identity: text(s.identity), color: ['copper', 'blue', 'green', 'violet'].includes(s.color) ? s.color : 'blue',
      persistent: s.persistent !== false,
      autoReconnect: s.persistent !== false && s.autoReconnect !== false,
      sessionName: text(s.sessionName, '', 64).replace(/[^a-zA-Z0-9_-]/g, '') || `orbit-${text(s.id, `server-${i}`, 40).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24)}`
    }))
  };
}
function sshArgs(server) {
  if (!server || !server.host || server.host.startsWith('-') || /[\s\x00-\x1f]/.test(server.host)) throw new Error('Enter a hostname, IP address, or SSH alias.');
  if (server.user && !/^[a-zA-Z0-9._-]+$/.test(server.user)) throw new Error('Invalid SSH username.');
  if (!Number.isInteger(server.port) || server.port < 1 || server.port > 65535) throw new Error('Port must be 1–65535.');
  const args = ['-t', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=6', '-o', 'TCPKeepAlive=yes', '-o', 'ConnectTimeout=20'];
  // Let SSH aliases retain a Port from ~/.ssh/config when the UI uses the default.
  if (server.port !== 22) args.push('-p', String(server.port));
  if (server.identity) args.push('-i', server.identity.replace(/^~(?=[\\/])/, os.homedir()));
  if (server.user) args.push('-l', server.user);
  args.push('--', server.host);
  return args;
}
function remoteCodexCommand(command) {
  const quoted = "'" + command.replace(/'/g, "'\\''") + "'";
  return 'exec "${SHELL:-/bin/sh}" -lc ' + quoted;
}
function remoteSessionCommand(server, codexCommand) {
  const quote = value => "'" + value.replace(/'/g, "'\\''") + "'";
  if (!server.persistent) return codexCommand ? remoteCodexCommand(`exec ${codexCommand}`) : null;
  const sessionName = (server.sessionName || 'orbit').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) + (codexCommand ? '-codex' : '');
  const missing = 'Orbit: tmux topilmadi. Sessiyani saqlash uchun serverda tmux o‘rnating (Ubuntu/Debian: sudo apt install tmux). Oddiy SSH uchun profil sozlamasidagi doimiy sessiyani o‘chiring.';
  // Fail clearly instead of silently promising durability in an ordinary shell.
  const command = `if ! command -v tmux >/dev/null 2>&1; then printf '%s\\n' ${quote(missing)}; exit 69; fi; printf '\\033]777;OrbitReady\\007'; exec tmux new-session -A -s ${quote(sessionName)}${codexCommand ? ' ' + quote(remoteCodexCommand(`exec ${codexCommand}`)) : ''}`;
  return remoteCodexCommand(command);
}
function saveConfig(file, value) {
  const normalized = normalize(value);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(normalized, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temp, file);
  return normalized;
}
module.exports = { defaults, normalize, sshArgs, saveConfig, remoteCodexCommand, remoteSessionCommand };
