const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { SessionClient } = require('../src/session-client.cjs');
const { defaults } = require('../src/config.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const [directory, cwd, output] = process.argv.slice(2), client = await new SessionClient(directory).start();
  const id = randomUUID();
  const info = await client.request('create', { id, options: { cwd, projectId: 'test', config: { ...defaults, shell: process.platform === 'win32' ? defaults.shell : '/bin/sh' } } });
  const command = process.platform === 'win32' ? "$global:ORBIT_KEEP='kept'; Write-Output ('VALUE:'+$global:ORBIT_KEEP)" : "export ORBIT_KEEP=kept; printf '\\nVALUE:%s\\n' \"$ORBIT_KEEP\"";
  await client.request('write', { id, data: command + '\r' });
  for (let i = 0; i < 100; i++) {
    const state = await client.request('attach', { id });
    if (state.snapshot.includes('VALUE:kept')) { fs.writeFileSync(output, JSON.stringify({ id, pid: info.pid })); process.exit(0); }
    await delay(80);
  }
  throw new Error('The detached shell did not become ready.');
})().catch(error => { console.error(error); process.exit(1); });
