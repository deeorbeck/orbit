const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function atomicJSON(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temp, file);
}
function leafIds(layout) {
  if (!layout) return [];
  return layout.type === 'leaf' ? [layout.sessionId] : [...leafIds(layout.first), ...leafIds(layout.second)];
}
function cleanLayout(layout, depth = 0) {
  if (!layout || depth > 24) return null;
  if (layout.type === 'leaf' && typeof layout.sessionId === 'string') return { type: 'leaf', sessionId: layout.sessionId.slice(0, 80) };
  if (layout.type === 'split') {
    const first = cleanLayout(layout.first, depth + 1), second = cleanLayout(layout.second, depth + 1);
    if (!first) return second;
    if (!second) return first;
    return { type: 'split', direction: layout.direction === 'vertical' ? 'vertical' : 'horizontal', ratio: Math.max(0.15, Math.min(0.85, Number(layout.ratio) || 0.5)), first, second };
  }
  return null;
}
class WorkspaceStore {
  constructor(file, startingDirectory) {
    this.file = file;
    try { this.state = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) {
      if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.invalid-${Date.now()}`);
      this.state = { version: 1, projects: [{ id: 'default', name: path.basename(startingDirectory) || 'Home', cwd: startingDirectory }], windows: [] };
    }
    if (!Array.isArray(this.state.projects) || !this.state.projects.length) this.state.projects = [{ id: 'default', name: 'Home', cwd: startingDirectory }];
    if (!Array.isArray(this.state.windows)) this.state.windows = [];
    this.save();
  }
  save() { atomicJSON(this.file, this.state); }
  project(id) { return this.state.projects.find(p => p.id === id); }
  upsertProject(value) {
    if (!value || !path.isAbsolute(value.cwd) || !fs.existsSync(value.cwd) || !fs.statSync(value.cwd).isDirectory()) throw new Error('Mavjud loyiha papkasini tanlang.');
    const project = { id: this.project(value.id)?.id || randomUUID(), name: String(value.name || path.basename(value.cwd)).replace(/[\x00-\x1f]/g, '').slice(0, 80), cwd: value.cwd };
    const index = this.state.projects.findIndex(p => p.id === project.id);
    if (index < 0) this.state.projects.push(project); else this.state.projects[index] = project;
    this.save(); return project;
  }
  window(id) { return this.state.windows.find(w => w.id === id); }
  newWindow(projectId) {
    const window = { id: randomUUID(), activeProjectId: this.project(projectId)?.id || this.state.projects[0].id, projects: {} };
    this.state.windows.push(window); this.save(); return window;
  }
  saveWindow(id, value) {
    const window = this.window(id);
    if (!window) throw new Error('Ish maydoni topilmadi.');
    if (this.project(value.activeProjectId)) window.activeProjectId = value.activeProjectId;
    if (value.bounds && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(value.bounds[k]))) window.bounds = value.bounds;
    if (value.projectId && this.project(value.projectId) && Array.isArray(value.tabs)) {
      const tabs = value.tabs.slice(0, 80).map(t => ({ id: String(t.id).slice(0, 80), title: String(t.title || 'Terminal').slice(0, 100), customTitle: !!t.customTitle, layout: cleanLayout(t.layout), activePaneId: String(t.activePaneId || '').slice(0, 80) })).filter(t => t.layout && leafIds(t.layout).length <= 12);
      window.projects[value.projectId] = { tabs, activeTabId: tabs.some(t => t.id === value.activeTabId) ? value.activeTabId : tabs[0]?.id || null };
    }
    this.save(); return window;
  }
}
module.exports = { WorkspaceStore, atomicJSON, leafIds, cleanLayout };
