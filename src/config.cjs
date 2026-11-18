const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { themeIds, normalizeCustomThemes } = require('./themes.cjs');
const { defaultShell } = require('./platform.cjs');

const defaults = {
  version: 1,
  language: 'en',
  startupHome: true,
  appearance: { fontSize: 14, fontFamily: '', wallpaper: true, wallpaperMode: 'contain', wallpaperOpacity: 0.28, dim: 0.25, sidebar: true, theme: 'graphite', effects: true, effectStyle: 'auto', effectIntensity: 0.35, effectSpeed: 1, effectSize: 1, effectTrailCount: 16, typingEffects: true, ambientEffects: true },
  shell: defaultShell(),
  startingDirectory: os.homedir(),
  codexCommand: 'codex',
  servers: [],
  customThemes: []
};
function text(v, fallback = '', max = 2048) { return typeof v === 'string' && !/[\x00-\x1f]/.test(v) ? v.slice(0, max) : fallback; }
function normalize(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Config must be a JSON object.');
  const a = raw.appearance || {};
  const customThemes = normalizeCustomThemes(raw.customThemes);
  const number = (v, d, lo, hi) => typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
  return {
    version: 1,
    language: raw.language === 'uz' ? 'uz' : 'en',
    startupHome: raw.startupHome !== false,
    customThemes,
    appearance: {
      effects: a.effects !== false,
      effectStyle: ['auto', 'font', 'cosmic', 'matrix', 'circuit', 'phosphor', 'ember', 'aurora', 'frost', 'solar', 'ink'].includes(a.effectStyle) ? a.effectStyle : 'auto',
      effectIntensity: number(a.effectIntensity, 0.35, 0, 1),
      effectTrailCount: Math.round(number(a.effectTrailCount, 16, 1, 48)),
      effectSpeed: number(a.effectSpeed, 1, 0.25, 3), effectSize: number(a.effectSize, 1, 0.5, 2.5),
      typingEffects: a.typingEffects !== false, ambientEffects: a.ambientEffects !== false,
      fontSize: number(a.fontSize, 14, 10, 28),
      fontFamily: ['SFMono-Regular, Menlo, monospace', 'SFMono-Regular, Cascadia Mono, Menlo, Consolas, monospace'].includes(a.fontFamily) ? '' : text(a.fontFamily, '', 160),
      wallpaper: typeof a.wallpaper === 'boolean' ? a.wallpaper : true,
      wallpaperMode: ['contain', 'cover', 'fill'].includes(a.wallpaperMode) ? a.wallpaperMode : 'contain',
      wallpaperOpacity: number(a.wallpaperOpacity, 0.28, 0, 1),
      dim: number(a.dim, 0.25, 0, 0.85),
      sidebar: typeof a.sidebar === 'boolean' ? a.sidebar : true,
      theme: themeIds.includes(a.theme) || customThemes.some(theme => theme.id === a.theme) ? a.theme : 'graphite'
    },
    shell: text(raw.shell, defaults.shell),
    startingDirectory: text(raw.startingDirectory, defaults.startingDirectory),
    codexCommand: text(raw.codexCommand, 'codex', 512),
    servers: (Array.isArray(raw.servers) ? raw.servers : []).slice(0, 100).map((s, i) => ({
      id: text(s.id, `server-${i}`, 80), name: text(s.name, 'Server', 80),
      host: text(s.host, '', 255).trim(), user: text(s.user, '', 80).trim(),
      port: Math.round(number(Number(s.port || 22), 22, 1, 65535)),
      ...(s.explicitPort === true ? { explicitPort: true } : {}),
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
  if (server.explicitPort || server.port !== 22) args.push('-p', String(server.port));
  if (server.identity) args.push('-i', server.identity.replace(/^~(?=[\\/])/, os.homedir()));
  if (server.user) args.push('-l', server.user);
  args.push('--', server.host);
  return args;
}
function remoteCodexCommand(command) {
  const quoted = "'" + command.replace(/'/g, "'\\''") + "'";
  return 'exec "${SHELL:-/bin/sh}" -lc ' + quoted;
}
function remoteSessionCommand(server, codexCommand, context = {}) {
  const quote = value => "'" + value.replace(/'/g, "'\\''") + "'";
  if (!server.persistent) return codexCommand ? remoteCodexCommand(`exec ${codexCommand}`) : null;
  const sessionName = (server.sessionName || 'orbit').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) + (codexCommand ? '-codex' : '');
  const missing = 'Orbit: tmux was not found. Install tmux on the server to preserve sessions (Ubuntu/Debian: sudo apt install tmux). For plain SSH, disable persistent sessions in the profile.';
  // Fail clearly instead of silently promising durability in an ordinary shell.
  const parent = typeof context.sourceSession === 'string' && /^[a-zA-Z0-9_-]+$/.test(context.sourceSession) ? context.sourceSession : null;
  const start = parent ? `orbit_start=$(tmux display-message -p -t ${quote(parent)} '#{pane_current_path}' 2>/dev/null); [ -d "$orbit_start" ] || orbit_start="$HOME"; ` : 'orbit_start="$HOME"; ';
  const command = `if ! command -v tmux >/dev/null 2>&1; then printf '%s\\n' ${quote(missing)}; exit 69; fi; ${start}printf '\\033]7;file://localhost%s\\007' "$orbit_start"; printf '\\033]777;OrbitReady\\007'; exec tmux new-session -A -s ${quote(sessionName)} -c "$orbit_start"${codexCommand ? ' ' + quote(remoteCodexCommand(`exec ${codexCommand}`)) : ''}`;
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
