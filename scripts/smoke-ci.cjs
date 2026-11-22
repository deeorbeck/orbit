const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-smoke-ci-'));
const logfile = path.join(directory, 'smoke.log');
const output = fs.openSync(logfile, 'w');
// A detached Windows child can inherit the writer end of a pipe. A log
// file lets the runner exit as soon as the test process itself is done.
const result = spawnSync(process.execPath, [path.join(__dirname, 'smoke.cjs')], {
  env: { ...process.env, ORBIT_SMOKE_BACKGROUND: '1' },
  stdio: ['ignore', output, output],
  timeout: 6 * 60 * 1000,
});
fs.closeSync(output);
const log = fs.readFileSync(logfile, 'utf8');
process.stdout.write(log);
try { fs.rmSync(directory, { recursive: true }); } catch {}
if (result.status !== 0) {
  const error = log.split(/\r?\n/).find(line => line.startsWith('ORBIT_SMOKE_FAIL:'));
  const message = (error || result.error?.message || `Desktop smoke test stopped: ${result.signal || result.status}`)
    .replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  console.error(`::error title=Desktop smoke test::${message}`);
  process.exitCode = 1;
}
