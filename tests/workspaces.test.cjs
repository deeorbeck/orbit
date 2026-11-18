const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { WorkspaceStore, leafIds } = require('../src/workspaces.cjs');
const { shortcuts } = require('../src/shortcuts.cjs');
const { sshHosts, shellAliasNames, directSshTarget } = require('../src/connections.cjs');

test('projects and separate windows retain independent nested layouts across disk reload', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-workspaces-'));
  try {
    const file = path.join(directory, 'workspaces.json');
    const store = new WorkspaceStore(file, directory);
    const other = store.upsertProject({ name: 'Second', cwd: os.tmpdir() });
    const firstWindow = store.newWindow('default'), secondWindow = store.newWindow(other.id);
    const layout = { type: 'split', direction: 'horizontal', ratio: .6, first: { type: 'leaf', sessionId: 'one' }, second: { type: 'split', direction: 'vertical', ratio: .4, first: { type: 'leaf', sessionId: 'two' }, second: { type: 'leaf', sessionId: 'three' } } };
    store.saveWindow(firstWindow.id, { projectId: 'default', activeTabId: 'tab', tabs: [{ id: 'tab', title: 'Build', layout, activePaneId: 'two' }] });
    store.saveWindow(secondWindow.id, { projectId: other.id, activeTabId: 'remote', tabs: [{ id: 'remote', title: 'SSH', layout: { type: 'leaf', sessionId: 'server' }, activePaneId: 'server' }] });
    const restored = new WorkspaceStore(file, directory);
    assert.equal(restored.state.windows.length, 2);
    assert.deepEqual(leafIds(restored.window(firstWindow.id).projects.default.tabs[0].layout), ['one', 'two', 'three']);
    assert.equal(restored.window(firstWindow.id).projects.default.tabs[0].layout.second.ratio, .4);
    assert.equal(restored.window(secondWindow.id).projects[other.id].tabs[0].title, 'SSH');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('SSH host includes and shell aliases are discovered without executing connection commands', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-hosts-'));
  try {
    fs.mkdirSync(path.join(dir, 'hosts'));
    fs.writeFileSync(path.join(dir, 'config'), 'Host prod stage\n HostName example.invalid\nHost *.internal !bad\nInclude hosts/*\n');
    fs.writeFileSync(path.join(dir, 'hosts', 'dev'), 'Host dev\nHost prod\n');
    assert.deepEqual(sshHosts(path.join(dir, 'config')), ['prod', 'stage', 'dev']);
    assert.deepEqual(shellAliasNames("alias api='ssh deploy@example.invalid'\nalias test='command ssh -p 2222 host'\nalias ls='ls -G'\nalias quote='echo ssh host'\n"), ['api', 'test']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('shortcuts have no collisions and preserve shell control characters', () => {
  for (const platform of ['darwin', 'win32', 'linux']) {
    const bindings = shortcuts(platform).map(s => s.accelerator);
    assert.equal(new Set(bindings).size, bindings.length);
    for (const key of ['Ctrl+C', 'Ctrl+D', 'Ctrl+W', 'Ctrl+Z']) assert(!bindings.includes(key));
  }
});

test('simple SSH aliases preserve authentication arguments without running shell commands', () => {
  assert.deepEqual(directSshTarget("'command ssh -p 22 -i ~/.ssh/work user@ssh.example'"), {
    host: 'user@ssh.example', port: 22, explicitPort: true, identity: '~/.ssh/work',
  });
  assert.deepEqual(directSshTarget("'ssh work'"), { host: 'work', port: 22, identity: '' });
  for (const command of ["'ssh work env'", "'ssh -L 4444:localhost:4444 work'", "'ssh $HOST'", "'ssh work; exit'", "'ssh -p 99999 work'"]) {
    assert.equal(directSshTarget(command), null);
  }
});
