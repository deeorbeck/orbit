const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { fontProfile, rayTarget } = require('../src/effect-profiles.cjs');
const { terminalEnv, colorShell } = require('../src/platform.cjs');
const { normalize } = require('../src/config.cjs');

test('font profiles are deterministic, distinct and produce bounded edge destinations', () => {
  assert.equal(fontProfile('MatrixType').style, 'matrix'); assert.equal(fontProfile('Orbitron').style, 'cosmic');
  assert.notEqual(fontProfile('Muar Regular').seed, fontProfile('Muar Stencil').seed);
  assert.equal(fontProfile('VT323').cursorStyle, 'block'); assert.equal(fontProfile('MatrixType', 'cosmic').style, 'cosmic');
  for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
    const p = rayTarget(230, 180, angle, 900, 600);
    assert(p.x >= 0 && p.x <= 900 && p.y >= 0 && p.y <= 600);
    assert(Math.min(p.x, p.y, 900 - p.x, 600 - p.y) < 0.00001, 'Every trail must terminate on an edge.');
  }
  assert.equal(normalize().startupHome, true);
  assert.equal(normalize({ startupHome: false }).startupHome, false);
  const config = normalize({ appearance: { effectIntensity: 100, effectStyle: 'unknown', effects: false } });
  assert.equal(config.appearance.effectIntensity, 1);
  const motion = normalize({ appearance: { effectSpeed: 99, effectSize: -1, effectIntensity: 0 } });
  assert.equal(motion.appearance.effectSpeed, 3); assert.equal(motion.appearance.effectSize, 0.5); assert.equal(motion.appearance.effectIntensity, 0); assert.equal(config.appearance.effectStyle, 'auto'); assert.equal(config.appearance.effects, false);
});

test('terminal environment removes inherited no-color flags without mutating the parent', () => {
  const previous = process.env.NO_COLOR; process.env.NO_COLOR = '1';
  try { assert.equal(terminalEnv('test').NO_COLOR, undefined); assert.equal(process.env.NO_COLOR, '1'); }
  finally { if (previous === undefined) delete process.env.NO_COLOR; else process.env.NO_COLOR = previous; }
});

test('color launcher fixes new shells from an older service without restarting it', { skip: process.platform === 'win32' }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-color-'));
  try {
    const shell = path.join(directory, "a shell's path"); fs.symlinkSync('/bin/sh', shell);
    const config = colorShell({ shell }, directory);
    const result = execFileSync(config.shell, ['-c', 'printf "%s|%s|%s" "${NO_COLOR-unset}" "$TERM" "$COLORTERM"'], { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } });
    assert.equal(result, 'unset|xterm-256color|truecolor');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
