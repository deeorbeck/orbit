const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

function defaultShell(platform = process.platform, env = process.env) {
  if (platform === 'win32') return path.win32.join(env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return env.SHELL || (platform === 'darwin' ? '/bin/zsh' : '/bin/bash');
}
function shellArgs(executable, command, platform = process.platform) {
  if (platform === 'win32') {
    const name = path.win32.basename(executable).toLowerCase();
    if (name === 'cmd.exe' || name === 'cmd') return command ? ['/d', '/s', '/c', command] : [];
    if (name.includes('powershell') || name.startsWith('pwsh')) return command ? ['-NoLogo', '-Command', command] : ['-NoLogo'];
  }
  return command ? ['-l', '-c', `exec ${command}`] : ['-l'];
}
function sshExecutable() {
  if (process.platform === 'win32') {
    const ssh = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'OpenSSH', 'ssh.exe');
    return fs.existsSync(ssh) ? ssh : 'ssh.exe';
  }
  return fs.existsSync('/usr/bin/ssh') ? '/usr/bin/ssh' : 'ssh';
}
function terminalEnv(version) {
  const env = { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', TERM_PROGRAM: 'Orbit', TERM_PROGRAM_VERSION: version, LANG: process.env.LANG || 'en_US.UTF-8' };
  const pathKey = Object.keys(env).find(key => key.toUpperCase() === 'PATH') || 'PATH';
  const extras = process.platform === 'win32' ? [path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm')] : [path.join(os.homedir(), '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin'];
  env[pathKey] = [...extras, env[pathKey] || ''].join(path.delimiter);
  env.CLICOLOR = '1';
  for (const key of ['NO_COLOR', 'FORCE_COLOR', 'CLICOLOR_FORCE', 'ELECTRON_RUN_AS_NODE', 'ORBIT_TEST_DATA']) delete env[key];
  return env;
}
// A running session service may predate the color fix. A private launcher also
// clears inherited runner flags without replacing or stopping any existing PTY.
function colorShell(config, directory) {
  if (process.platform === 'win32') return config;
  const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
  const file = path.join(directory, 'color-shell');
  fs.writeFileSync(file, '#!/bin/sh\nexec /usr/bin/env -u NO_COLOR -u FORCE_COLOR -u CLICOLOR_FORCE CLICOLOR=1 TERM=xterm-256color COLORTERM=truecolor ' + quote(config.shell) + ' "$@"\n', { mode: 0o700 });
  return { ...config, shell: file };
}
module.exports = { defaultShell, shellArgs, sshExecutable, terminalEnv, colorShell };
