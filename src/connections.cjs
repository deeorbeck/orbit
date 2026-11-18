const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');

function sshHosts(file, seen = new Set()) {
  if (seen.has(file) || seen.size > 30 || !fs.existsSync(file)) return [];
  seen.add(file); const hosts = [];
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const host = line.match(/^\s*Host\s+([^#]+)/i);
    if (host) hosts.push(...host[1].trim().split(/\s+/).filter(h => h && !/[!*?\s]/.test(h) && !h.startsWith('-')));
    const include = line.match(/^\s*Include\s+([^#]+)/i);
    if (include) for (let entry of include[1].trim().split(/\s+/)) {
      entry = entry.replace(/^~(?=[\\/])/, os.homedir()); if (!path.isAbsolute(entry)) entry = path.join(path.dirname(file), entry);
      if (!entry.includes('*')) hosts.push(...sshHosts(entry, seen));
      else {
        const parent = path.dirname(entry), pattern = path.basename(entry);
        if (!fs.existsSync(parent)) continue;
        const matcher = new RegExp('^' + pattern.split('*').map(v => v.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
        for (const name of fs.readdirSync(parent)) if (matcher.test(name)) hosts.push(...sshHosts(path.join(parent, name), seen));
      }
    }
  }
  return [...new Set(hosts)];
}
function directSshTarget(definition) {
  const command = definition.replace(/^(?:'([^']*)'|"([^"]*)")$/, '$1$2');
  const tokens = command.trim().split(/\s+/);
  if (tokens[0] === 'command' || tokens[0] === 'exec') tokens.shift();
  if (tokens.shift() !== 'ssh') return null;

  const target = { port: 22, identity: '' };
  while (tokens.length > 1) {
    const flag = tokens.shift();
    if (flag === '--') break;
    const value = tokens.shift();
    if (flag === '-p' && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 65535) {
      target.port = Number(value);
      target.explicitPort = true;
    } else if (flag === '-i' && /^(?:~\/)?[A-Za-z0-9_./-]+$/.test(value)) {
      target.identity = value;
    } else {
      return null;
    }
  }
  if (tokens.length !== 1 || !/^(?:[A-Za-z0-9_.-]+@)?(?:[A-Za-z0-9_][A-Za-z0-9_.-]*|[A-Fa-f0-9:]+:[A-Fa-f0-9:]+)$/.test(tokens[0])) return null;
  return { ...target, host: tokens[0] };
}

function shellAliasEntries(output) {
  const entries = new Map();
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^(?:alias\s+(?:--\s+)?)?([a-zA-Z_][a-zA-Z0-9_.-]*)=(.+)$/);
    if (match && /(?:^|['";&|]\s*)(?:(?:command|exec)\s+)?ssh\s/.test(match[2])) {
      const [, name, definition] = match;
      entries.set(name, { name, target: directSshTarget(definition) });
    }
  }
  return [...entries.values()];
}
function shellAliasNames(output) { return shellAliasEntries(output).map(entry => entry.name); }
function discoverShellAliases(executable) {
  const shell = path.basename(executable).toLowerCase();
  let args;
  if (shell.includes('zsh')) args = ['-l', '-i', '-c', 'alias -L'];
  else if (shell.includes('bash')) args = ['-l', '-i', '-c', 'alias -p'];
  else return Promise.resolve([]);
  return new Promise(resolve => execFile(executable, args, { timeout: 6000, maxBuffer: 2 * 1024 * 1024, windowsHide: true }, (_error, output) => resolve(shellAliasEntries(output || ''))));
}
async function connectionCatalog(config) {
  const hosts = sshHosts(path.join(os.homedir(), '.ssh', 'config'));
  const aliases = await discoverShellAliases(config.shell);
  return [
    ...hosts.map(name => ({ id: `ssh-config:${name}`, name, source: 'SSH config', kind: 'ssh-config', host: name })),
    ...aliases.map(({ name, target }) => ({ id: `shell-alias:${name}`, name, source: 'Shell alias', kind: 'shell-alias', aliasName: name, target })),
  ];
}
module.exports = { sshHosts, shellAliasNames, directSshTarget, connectionCatalog };
