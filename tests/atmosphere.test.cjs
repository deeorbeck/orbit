const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { fontProfile, radialTargets, themeStyles } = require('../src/effect-profiles.cjs');
const { terminalEnv, colorShell } = require('../src/platform.cjs');
const { normalize } = require('../src/config.cjs');

test('font profiles are deterministic and distinct', () => {
  assert.equal(fontProfile('MatrixType').style, 'matrix'); assert.equal(fontProfile('Orbitron').style, 'cosmic');
  assert.notEqual(fontProfile('Muar Regular').seed, fontProfile('Muar Stencil').seed);
  assert.equal(Object.keys(themeStyles).length, 10);
  assert.equal(fontProfile('MatrixType', 'auto', { themeId: 'nord' }).style, 'frost');
  assert.equal(fontProfile('MatrixType', 'font', { themeId: 'nord' }).style, 'matrix');
  assert.equal(fontProfile('Muar', 'auto', { themeId: 'custom-my', baseTheme: 'paper' }).style, 'ink');
  assert.equal(normalize().appearance.effectTrailCount, 16);
  assert.equal(normalize({ appearance: { effectTrailCount: 99 } }).appearance.effectTrailCount, 48);
  assert.equal(normalize({ appearance: { effectTrailCount: -4 } }).appearance.effectTrailCount, 1);
  assert.equal(fontProfile('VT323').cursorStyle, 'block'); assert.equal(fontProfile('MatrixType', 'cosmic').style, 'cosmic');
  assert.equal(normalize().startupHome, true);
  assert.equal(normalize({ startupHome: false }).startupHome, false);
  const config = normalize({ appearance: { effectIntensity: 100, effectStyle: 'unknown', effects: false } });
  assert.equal(config.appearance.effectIntensity, 1);
  const motion = normalize({ appearance: { effectSpeed: 99, effectSize: -1, effectIntensity: 0 } });
  assert.equal(motion.appearance.effectSpeed, 3); assert.equal(motion.appearance.effectSize, 0.5); assert.equal(motion.appearance.effectIntensity, 0); assert.equal(config.appearance.effectStyle, 'auto'); assert.equal(config.appearance.effects, false);
});

test('typing bursts expand in evenly spaced directions from a corner', () => {
  const x = 7, y = 354, radius = 290;
  for (const count of [1, 3, 7, 16, 48]) {
    const targets = radialTargets(x, y, count, 0.37, radius);
    const spacing = 2 * radius * Math.sin(Math.PI / count);
    for (const [index, point] of targets.entries()) {
      const next = targets[(index + 1) % count];
      assert(Math.abs(Math.hypot(point.x - x, point.y - y) - radius) < 0.00001);
      assert(Math.abs(Math.hypot(point.x - next.x, point.y - next.y) - spacing) < 0.00001);
    }
  }
});

test('terminal environment removes inherited no-color flags without mutating the parent', () => {
  const flags = ['NO_COLOR', 'NODE_DISABLE_COLORS', 'ANSI_COLORS_DISABLED', 'PYTHON_COLORS'];
  const previous = Object.fromEntries(flags.map(key => [key, process.env[key]]));
  for (const key of flags) process.env[key] = key === 'PYTHON_COLORS' ? '0' : '1';
  try { const child = terminalEnv('test'); for (const key of flags) { assert.equal(child[key], undefined); assert.notEqual(process.env[key], undefined); } }
  finally { for (const key of flags) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } }
});

test('color launcher fixes new shells from an older service without restarting it', { skip: process.platform === 'win32' }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-color-'));
  try {
    const shell = path.join(directory, "a shell's path"); fs.symlinkSync('/bin/sh', shell);
    const config = colorShell({ shell }, directory);
    const result = execFileSync(config.shell, ['-c', 'printf "%s|%s|%s|%s|%s|%s" "${NO_COLOR-unset}" "${NODE_DISABLE_COLORS-unset}" "${ANSI_COLORS_DISABLED-unset}" "${PYTHON_COLORS-unset}" "$TERM" "$COLORTERM"'], { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1', NODE_DISABLE_COLORS: '1', ANSI_COLORS_DISABLED: '1', PYTHON_COLORS: '0', FORCE_COLOR: '0' } });
    assert.equal(result, 'unset|unset|unset|unset|xterm-256color|truecolor');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
