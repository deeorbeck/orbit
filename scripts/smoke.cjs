const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SessionClient } = require('../src/session-client.cjs');
const root = path.resolve(__dirname, '..');
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-smoke-'));
const testHome = path.join(data, 'home'); fs.mkdirSync(testHome);
// Isolate UI regression checks from user shell startup hooks and their locks.
const { defaults, saveConfig } = require('../src/config.cjs');
saveConfig(path.join(data, 'config.json'), { ...defaults, shell: process.platform === 'win32' ? defaults.shell : '/bin/sh' });
const { importFonts } = require('../src/local-fonts.cjs');
importFonts(data, [path.join(root, 'assets/fonts/ibmplexmono.woff2'), ...JSON.parse(process.env.ORBIT_TEST_FONT_FILES || '[]')]);
let executable = require('electron');
const args = process.env.ORBIT_PACKAGED ? [] : [root];
if (process.env.ORBIT_PACKAGED) {
  const candidates = process.platform === 'darwin' ? [path.join(root, 'out', process.arch === 'arm64' ? 'mac-arm64' : 'mac', 'Orbit Terminal.app', 'Contents', 'MacOS', 'Orbit Terminal')] : process.platform === 'win32' ? [path.join(root, 'out', 'win-unpacked', 'Orbit Terminal.exe')] : [path.join(root, 'out', 'linux-unpacked', 'orbit-terminal')];
  executable = candidates.find(fs.existsSync);
  if (!executable) throw new Error('Build the native app with npm run package or npm run dist before testing it.');
}
if (process.env.CI && process.platform === 'linux') args.push('--no-sandbox');
function launch(phase) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: root, env: { ...process.env, ...(process.platform === 'win32' ? {} : { HOME: testHome }), ORBIT_TEST_DATA: data, ORBIT_SMOKE_TEST: '1', ORBIT_SMOKE_PHASE: phase }, stdio: 'inherit' });
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Desktop ${phase} test timed out.`)); }, 120000);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Desktop ${phase} exited with code ${code}.`)); });
  });
}
(async () => {
  try { await launch('create'); await new Promise(resolve => setTimeout(resolve, 500)); await launch('restore'); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
  finally {
    try { const client = await new SessionClient(data).connect(); await client.request('shutdown'); client.disconnect(); await new Promise(resolve => setTimeout(resolve, 300)); } catch {}
    try { fs.rmSync(data, { recursive: true, force: true }); } catch {}
  }
})();
