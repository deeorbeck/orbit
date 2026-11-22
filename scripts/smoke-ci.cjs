const { spawnSync } = require('node:child_process');
const path = require('node:path');

const result = spawnSync(process.execPath, [path.join(__dirname, 'smoke.cjs')], {
  encoding: 'utf8',
  env: { ...process.env, ORBIT_SMOKE_BACKGROUND: '1' },
  maxBuffer: 8 * 1024 * 1024,
});
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.status !== 0) {
  const error = result.stderr?.split(/\r?\n/).find(line => line.startsWith('ORBIT_SMOKE_FAIL:'));
  const message = (error || result.error?.message || `Desktop smoke test stopped: ${result.signal || result.status}`)
    .replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  console.error(`::error title=Desktop smoke test::${message}`);
  process.exitCode = 1;
}
