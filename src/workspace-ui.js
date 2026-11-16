import navigation from './pane-navigation.cjs';
import { t } from './i18n-dom.js';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';

const $ = (selector, root = document) => root.querySelector(selector);
export const leafIds = node => !node ? [] : node.type === 'leaf' ? [node.sessionId] : [...leafIds(node.first), ...leafIds(node.second)];
function replaceLeaf(node, id, replacement) {
  if (!node) return null;
  if (node.type === 'leaf') return node.sessionId === id ? replacement : node;
  const first = replaceLeaf(node.first, id, replacement), second = replaceLeaf(node.second, id, replacement);
  return !first ? second : !second ? first : { ...node, first, second };
}
function makeButton(label, title, fn, className = 'icon-button') { const b = document.createElement('button'); b.className = className; b.textContent = label; b.title = title; b.setAttribute('aria-label', title); b.onclick = fn; return b; }

export class WorkspaceUI {
  constructor({ api, initial, icon, appearance, theme, notify, openProject, openRename }) {
    Object.assign(this, { api, icon, appearance, theme, notify, openProject, openRename });
    this.projects = initial.projects; this.window = initial.window; this.home = initial.home; this.platform = initial.platform;
    this.activeProjectId = this.window.activeProjectId;
    this.panes = new Map(); this.states = new Map(); this.loads = new Map(); this.earlyData = new Map(); this.ready = false; this.navigation = 0;
    this.knownSessions = new Map(initial.sessions.map(s => [s.id, s]));
    this.ownedIds = new Set(initial.sessions.filter(s => s.windowId === this.window.id).map(s => s.id));
    api.onData(event => this.handleData(event));
    api.onCwd(event => { const p = this.panes.get(event.id); if (p) { p.info.cwd = event.cwd; this.renderPane(p); this.updateFooter(); } });
    api.onExit(event => this.setStatus(event)); api.onStatus(event => this.setStatus(event));
    api.onRemoved(({ id }) => { if (this.panes.has(id)) this.removeLocal([id]); });
    api.onProjects(projects => { this.projects = projects; this.renderProjects(); });
    new ResizeObserver(() => requestAnimationFrame(() => this.fit())).observe($('#terminal-area'));
    this.cwdTimer = setInterval(() => { const p = this.activePane(); if (p && !p.info.serverId && p.info.status === 'running') api.cwd(p.id).catch(() => {}); }, 4000);
    window.addEventListener('beforeunload', () => clearInterval(this.cwdTimer));
    window.__orbitWorkspaceSnapshot = () => this.snapshot();
  }
  project() { return this.projects.find(p => p.id === this.activeProjectId) || this.projects[0]; }
  state() { return this.states.get(this.activeProjectId); }
  get tabs() { return this.state()?.tabs || []; }
  activeTab() { return this.tabs.find(t => t.id === this.state()?.activeTabId); }
  activePane() { return this.panes.get(this.activeTab()?.activePaneId); }
  shortPath(value) { return value?.startsWith(this.home) ? '~' + value.slice(this.home.length) : value || ''; }
  snapshot(projectId = this.activeProjectId) {
    if (!this.ready) return null;
    const state = this.states.get(projectId);
    return { activeProjectId: this.activeProjectId, projectId, activeTabId: state?.activeTabId, tabs: (state?.tabs || []).map(t => ({ id: t.id, title: t.title, customTitle: t.customTitle, layout: t.layout, activePaneId: t.activePaneId })) };
  }
  async save(projectId) { const value = this.snapshot(projectId); if (value) await this.api.saveWorkspace(value); }
  async init() {
    await this.ensureProject(this.activeProjectId);
    this.ready = true;
    if (!this.tabs.length) await this.newTab({ cwd: this.window.initialCwd || this.project().cwd });
    this.selectVisible(); this.renderProjects(); await this.save();
  }
  ensureProject(id) { if (!this.loads.has(id)) this.loads.set(id, this.loadProject(id)); return this.loads.get(id); }
  async loadProject(id) {
    if (this.states.has(id)) return;
    const saved = this.window.projects[id] || { tabs: [], activeTabId: null };
    const state = { tabs: [], activeTabId: saved.activeTabId }; this.states.set(id, state);
    for (const value of saved.tabs) {
      const group = document.createElement('div'); group.className = 'pane-group'; group.hidden = true; $('#workspaces').append(group);
      const tab = { ...value, group, projectId: id };
      state.tabs.push(tab);
      for (const sessionId of leafIds(value.layout)) {
        this.ownedIds.add(sessionId);
        const restored = await this.api.attach(sessionId);
        if (!restored) { tab.layout = replaceLeaf(tab.layout, sessionId, null); continue; }
        await this.mountPane(tab, restored.info, restored);
      }
      if (!tab.layout) { group.remove(); state.tabs = state.tabs.filter(t => t !== tab); continue; }
      if (!leafIds(tab.layout).includes(tab.activePaneId)) tab.activePaneId = leafIds(tab.layout)[0];
      this.layout(tab);
    }
    const present = new Set(state.tabs.flatMap(t => leafIds(t.layout)));
    for (const info of this.knownSessions.values()) {
      if (info.windowId !== this.window.id || info.projectId !== id || present.has(info.id)) continue;
      const restored = await this.api.attach(info.id); if (!restored) continue;
      const group = document.createElement('div'); group.className = 'pane-group'; group.hidden = true; $('#workspaces').append(group);
      const tab = { id: crypto.randomUUID(), projectId: id, title: info.label, layout: { type: 'leaf', sessionId: info.id }, activePaneId: info.id, group };
      state.tabs.push(tab); await this.mountPane(tab, restored.info, restored); this.layout(tab);
    }
    if (!state.tabs.some(t => t.id === state.activeTabId)) state.activeTabId = state.tabs[0]?.id;
  }
  async selectProject(id) {
    if (!this.projects.some(p => p.id === id)) return;
    const navigation = ++this.navigation;
    await this.save();
    if (navigation !== this.navigation) return;
    this.activeProjectId = id; await this.ensureProject(id);
    if (navigation !== this.navigation) return;
    if (!this.tabs.length) await this.newTab();
    this.selectVisible(); this.renderProjects(); await this.save();
  }
  renderProjects() {
    const p = this.project();
    $('#folder-name').textContent = p.name; $('#folder-path').textContent = this.shortPath(p.cwd); $('#choose-folder').title = t("Choose project · ") + p.cwd;
    const list = $('#project-list'); list.replaceChildren();
    for (const project of this.projects) {
      const row = document.createElement('div'); row.className = 'project-item' + (project.id === this.activeProjectId ? ' selected' : '');
      const b = document.createElement('button'); b.className = 'project-select'; b.title = project.cwd;
      const mark = document.createElement('span'); mark.className = 'project-initial'; mark.textContent = project.name.slice(0, 1).toUpperCase();
      const name = document.createElement('span'); name.textContent = project.name;
      const count = document.createElement('small'); count.textContent = String(this.states.get(project.id)?.tabs.length || this.window.projects[project.id]?.tabs.length || '');
      b.append(mark, name, count); b.onclick = () => this.run(() => this.selectProject(project.id));
      const edit = makeButton('···', t('Edit project {name}', { name: project.name }), () => this.openProject(project), 'icon-button small project-edit'); row.append(b, edit); list.append(row);
    }
    document.title = `${p.name} — Orbit Terminal`;
  }
  run(fn) { return Promise.resolve().then(fn).catch(e => this.notify(e.message)); }
  kind(p) { return p.info.serverId ? p.info.codex ? 'remote-codex' : 'ssh' : p.info.codex ? 'codex' : 'terminal'; }
  kindName(p) { return ({ terminal: 'Terminal', codex: 'Codex', ssh: 'SSH', 'remote-codex': 'SSH · Codex' })[this.kind(p)]; }
  kindIcon(p) { return this.icon(p.info.serverId ? p.info.codex ? 'remoteCodex' : 'server' : p.info.codex ? 'spark' : 'terminal'); }
  renderTabs() {
    const root = $('#tabs'); root.replaceChildren();
    for (const tab of this.tabs) {
      const p = this.panes.get(tab.activePaneId);
      const el = document.createElement('div'); el.className = 'tab'; el.tabIndex = tab.id === this.state().activeTabId ? 0 : -1; el.setAttribute('role', 'tab'); el.setAttribute('aria-selected', String(tab.id === this.state().activeTabId));
      const symbol = document.createElement('span'); symbol.className = 'tab-kind ' + (p ? this.kind(p) : 'terminal'); symbol.innerHTML = p ? this.kindIcon(p) : this.icon('terminal');
      const title = document.createElement('span'); title.className = 'tab-name'; title.textContent = tab.title;
      el.append(symbol, title);
      const count = leafIds(tab.layout).length;
      if (count > 1) { const badge = document.createElement('small'); badge.className = 'pane-count'; badge.textContent = count; el.append(badge); }
      const close = makeButton('×', t('End sessions in {name}', { name: tab.title }), event => { event.stopPropagation(); this.run(() => this.endTab(tab)); }, 'icon-button tab-close');
      el.append(close); el.onclick = () => this.selectTab(tab.id); el.ondblclick = () => this.openRename(tab);
      el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') this.selectTab(tab.id); };
      root.append(el);
    }
  }
  selectVisible() {
    for (const state of this.states.values()) for (const tab of state.tabs) tab.group.hidden = tab.projectId !== this.activeProjectId || tab.id !== this.state().activeTabId;
    this.renderTabs(); this.fit(); this.focusActive();
  }
  selectTab(id) { if (!this.tabs.some(t => t.id === id)) return; this.state().activeTabId = id; this.selectVisible(); this.run(() => this.save()); }
  focusPane(id) { const p = this.panes.get(id); if (!p) return; const tab = this.tabs.find(t => t.id === p.tabId); if (!tab) return; tab.activePaneId = id; this.renderTabs(); this.focusActive(); this.run(() => this.save()); }
  focusActive() {
    const p = this.activePane();
    for (const pane of this.panes.values()) pane.el.classList.toggle('active-pane', pane === p);
    if (p && !document.querySelector('dialog[open]') && !document.activeElement?.closest('.find-bar')) p.term.focus();
    this.updateFooter();
  }
  updateFooter() {
    const p = this.activePane();
    $('#connection-status').textContent = p ? this.kindName(p) + (p.info.status === 'running' ? t(" · running") : p.info.status === 'reconnecting' ? t(" · reconnecting") : t(" · stopped")) : t("Open a new terminal");
    $('#connection-dot').style.background = !p || p.info.status === 'running' ? '#89b8a3' : '#b99b75';
    $('#session-location').textContent = p ? this.shortPath(p.info.cwd) : this.shortPath(this.project().cwd);
    $('#terminal-size').textContent = p ? `${p.term.cols} × ${p.term.rows}` : '—';
  }
  async mountPane(tab, info, restored = null) {
    const el = document.createElement('section'); el.className = 'terminal-pane';
    const header = document.createElement('div'); header.className = 'pane-label';
    const kind = document.createElement('span'); kind.className = 'pane-kind';
    const cwd = document.createElement('span'); cwd.className = 'pane-cwd';
    const status = document.createElement('span'); status.className = 'pane-live';
    const end = makeButton('×', t("End this session"), () => this.run(() => this.endPane(info.id)), 'icon-button small end-pane');
    header.append(kind, cwd, status, end);
    const mount = document.createElement('div'); mount.className = 'terminal-mount'; el.append(header, mount);
    tab.group.append(el);
    const a = this.appearance(), term = new Terminal({ allowTransparency: true, allowProposedApi: true, fontFamily: a.fontFamily, fontSize: a.fontSize, lineHeight: a.lineHeight, cursorBlink: true, cursorStyle: 'bar', scrollback: 15000, macOptionIsMeta: true, theme: this.theme() });
    const fit = new FitAddon(), search = new SearchAddon(); term.loadAddon(fit); term.loadAddon(search); term.open(mount);
    const pane = { id: info.id, info, term, fit, search, el, mount, header, kind, cwd, status, tabId: tab.id, projectId: tab.projectId, queue: [], restoring: true, lastSeq: restored?.seq || 0 };
    // The headless service answers device reports even while every GUI is closed.
    // Suppress duplicate renderer replies; keyboard input still uses onData.
    for (const identifier of [{ final: 'n' }, { prefix: '?', final: 'n' }, { final: 'c' }, { prefix: '>', final: 'c' }, { prefix: '=', final: 'c' }, { prefix: '?', final: 'u' }, { intermediates: '$', final: 'p' }, { prefix: '?', intermediates: '$', final: 'p' }]) term.parser.registerCsiHandler(identifier, () => true);
    for (const code of [4, 10, 11, 12]) term.parser.registerOscHandler(code, data => data.includes('?'));
    for (const intermediates of ['$', '+']) term.parser.registerDcsHandler({ intermediates, final: 'q' }, () => true);
    this.panes.set(info.id, pane);
    term.onData(data => { if (pane.info.status === 'running') this.api.write(info.id, data); });
    term.onTitleChange(title => { el.title = title; });
    term.attachCustomKeyEventHandler(e => {
      const mod = this.platform === 'darwin' ? e.metaKey : e.ctrlKey;
      let navigate;
      if (e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) navigate = () => this.movePane(e.key.slice(5).toLowerCase());
      if (mod && e.shiftKey && !e.altKey && ['BracketLeft', 'BracketRight'].includes(e.code)) navigate = () => this.cycleTab(e.code === 'BracketRight' ? 1 : -1);
      if (mod && !e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key)) navigate = () => this.selectTabAt(Number(e.key) - 1);
      if (navigate) { e.preventDefault(); if (e.type === 'keydown') navigate(); return false; }

      if ((this.platform === 'darwin' ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'c' && term.hasSelection()) { if (e.type === 'keydown') navigator.clipboard.writeText(term.getSelection()).catch(error => this.notify(error.message)); return false; }
      return true;
    });
    el.addEventListener('pointerdown', e => { if (!e.target.closest('button,.find-bar')) this.focusPane(info.id); });
    const attached = restored || await this.api.attach(info.id);
    if (attached) {
      pane.info = { ...attached.info, ...pane.pendingStatus }; pane.lastSeq = attached.seq;
      if (term.cols !== attached.info.cols || term.rows !== attached.info.rows) term.resize(attached.info.cols, attached.info.rows);
      await new Promise(resolve => term.write(attached.snapshot || '', resolve));
    }
    pane.restoring = false;
    const waiting = [...(this.earlyData.get(info.id) || []), ...pane.queue]; this.earlyData.delete(info.id); pane.queue = [];
    for (const event of waiting) this.handleData(event);
    this.renderPane(pane); return pane;
  }
  renderPane(pane) {
    const end = $('.end-pane', pane.el); end.title = t('End this session'); end.setAttribute('aria-label', end.title);
    const find = $('.find-bar', pane.el);
    if (find) { const input = $('input', find); input.placeholder = t('Search terminal'); input.setAttribute('aria-label', input.placeholder); [...find.querySelectorAll('button')].forEach((b, i) => { b.title = t(['Previous match', 'Next match', 'Close search'][i]); b.setAttribute('aria-label', b.title); }); }
    pane.kind.className = 'pane-kind ' + this.kind(pane); pane.kind.innerHTML = this.kindIcon(pane);
    const label = document.createElement('span'); label.textContent = this.kindName(pane); pane.kind.append(label);
    pane.el.dataset.kind = this.kind(pane); pane.el.dataset.sessionId = pane.id;
    pane.cwd.textContent = this.shortPath(pane.info.cwd); pane.cwd.title = pane.info.cwd;
    pane.status.textContent = pane.info.status === 'running' ? '●' : pane.info.status === 'reconnecting' ? '↻' : '○';
    pane.status.title = pane.info.status === 'running' ? t("Process keeps running in the background") : t("Session stopped");
    $('.exit-banner', pane.el)?.remove();
    if (['exited', 'stopped', 'reconnecting'].includes(pane.info.status)) {
      const banner = document.createElement('div'); banner.className = 'exit-banner';
      const text = document.createElement('span'); text.textContent = pane.info.status === 'stopped' ? t("Previous screen restored. The process has stopped; you can restart it.") : pane.info.status === 'reconnecting' ? t('Reconnecting SSH · {seconds}s', { seconds: pane.info.retryIn || '' }) : t('Session ended · code {code}', { code: pane.info.exitCode ?? '—' });
      banner.append(text);
      if (pane.info.status === 'reconnecting') banner.append(makeButton(t("Stop"), t("Stop automatic reconnection"), () => this.run(() => this.api.cancelRetry(pane.id)), 'secondary-button'));
      else banner.append(makeButton(t("Restart"), t("Restart session"), () => this.run(async () => { const info = await this.api.restart(pane.id); this.setStatus(info); }), 'secondary-button'));
      pane.el.append(banner);
    }
  }
  handleData(event) {
    const p = this.panes.get(event.id);
    if (!p) { if (!this.ownedIds.has(event.id)) return; const queue = this.earlyData.get(event.id) || []; queue.push(event); if (queue.length > 200) queue.shift(); this.earlyData.set(event.id, queue); return; }
    if (p.restoring) { p.queue.push(event); return; }
    if (event.seq <= p.lastSeq) return;
    p.lastSeq = event.seq; p.term.write(event.data);
  }
  setStatus(info) { const p = this.panes.get(info.id); if (p) { if (p.restoring) p.pendingStatus = { ...p.pendingStatus, ...info }; p.info = { ...p.info, ...info }; this.renderPane(p); this.updateFooter(); } }
  layout(tab) {
    const render = node => {
      if (node.type === 'leaf') return this.panes.get(node.sessionId)?.el || document.createElement('div');
      const split = document.createElement('div'); split.className = 'split-node ' + node.direction;
      const divider = document.createElement('div'); divider.className = 'pane-divider'; divider.setAttribute('role', 'separator'); divider.setAttribute('aria-orientation', node.direction === 'horizontal' ? 'vertical' : 'horizontal'); divider.tabIndex = 0;
      const size = () => { split.style[node.direction === 'horizontal' ? 'gridTemplateColumns' : 'gridTemplateRows'] = `minmax(0, ${node.ratio}fr) 5px minmax(0, ${1 - node.ratio}fr)`; };
      size(); split.append(render(node.first), divider, render(node.second));
      divider.onpointerdown = e => { divider.setPointerCapture(e.pointerId); divider.classList.add('dragging'); divider.onpointermove = move => { const rect = split.getBoundingClientRect(); node.ratio = Math.max(0.15, Math.min(0.85, node.direction === 'horizontal' ? (move.clientX - rect.left) / rect.width : (move.clientY - rect.top) / rect.height)); size(); this.fit(); }; divider.onpointerup = () => { divider.onpointermove = null; divider.classList.remove('dragging'); this.run(() => this.save()); }; };
      divider.onkeydown = e => { if (['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(e.key)) { e.preventDefault(); node.ratio = Math.max(0.15, Math.min(0.85, node.ratio + (['ArrowLeft', 'ArrowUp'].includes(e.key) ? -0.05 : 0.05))); size(); this.fit(); this.run(() => this.save()); } };
      return split;
    };
    tab.group.replaceChildren(render(tab.layout)); tab.group.classList.toggle('split', leafIds(tab.layout).length > 1);
    requestAnimationFrame(() => this.fit());
  }
  fit() {
    const tab = this.activeTab(); if (!tab) return;
    for (const id of leafIds(tab.layout)) { const p = this.panes.get(id); if (!p || p.mount.clientWidth < 30 || p.mount.clientHeight < 30) continue; try { p.fit.fit(); if (p.info.cols !== p.term.cols || p.info.rows !== p.term.rows) { p.info.cols = p.term.cols; p.info.rows = p.term.rows; this.api.resize(id, p.term.cols, p.term.rows); } } catch {} }
    this.updateFooter();
  }
  async newTab(options = {}) {
    const projectId = this.activeProjectId, state = this.state();
    const source = this.activePane();
    const info = await this.api.create({ ...options, projectId, inheritFrom: options.cwd ? null : source?.id });
    this.ownedIds.add(info.id);
    const group = document.createElement('div'); group.className = 'pane-group'; $('#workspaces').append(group);
    const tab = { id: crypto.randomUUID(), projectId, title: info.label, layout: { type: 'leaf', sessionId: info.id }, activePaneId: info.id, group };
    state.tabs.push(tab); state.activeTabId = tab.id;
    await this.mountPane(tab, info); this.layout(tab); this.selectVisible(); this.renderProjects(); await this.save(projectId);
  }
  async split(direction = 'horizontal') {
    const tab = this.activeTab(), source = this.activePane(); if (!tab || !source) return this.newTab();
    if (leafIds(tab.layout).length >= 12) return this.notify(t("You can open up to 12 panes per tab."));
    const connectionId = source.info.aliasName ? `shell-alias:${source.info.aliasName}` : source.info.serverId?.startsWith('ssh-config:') ? source.info.serverId : null;
    const info = await this.api.create({ projectId: this.activeProjectId, inheritFrom: source.id, ...(connectionId ? { connectionId } : { serverId: source.info.serverId || null }), codex: !!source.info.codex });
    this.ownedIds.add(info.id);
    await this.mountPane(tab, info);
    tab.layout = replaceLeaf(tab.layout, source.id, { type: 'split', direction, ratio: 0.5, first: { type: 'leaf', sessionId: source.id }, second: { type: 'leaf', sessionId: info.id } });
    tab.activePaneId = info.id; this.layout(tab); this.renderTabs(); this.focusActive(); await this.save(tab.projectId);
  }
  async endPane(id) { if (await this.api.close(id)) this.removeLocal([id]); }
  async endTab(tab) { const ids = leafIds(tab.layout); if (await this.api.close(ids)) this.removeLocal(ids); }
  removeLocal(ids) {
    const changed = new Set();
    for (const id of ids) {
      const p = this.panes.get(id); if (!p) continue;
      p.term.dispose(); p.el.remove(); this.panes.delete(id);
      changed.add(p.projectId);
      const state = this.states.get(p.projectId), tab = state.tabs.find(t => t.id === p.tabId); if (!tab) continue;
      tab.layout = replaceLeaf(tab.layout, id, null);
      if (!tab.layout) { tab.group.remove(); state.tabs = state.tabs.filter(t => t !== tab); if (state.activeTabId === tab.id) state.activeTabId = state.tabs.at(-1)?.id; }
      else { if (tab.activePaneId === id) tab.activePaneId = leafIds(tab.layout)[0]; this.layout(tab); }
    }
    this.selectVisible(); this.renderProjects(); for (const id of changed) this.run(() => this.save(id));
  }
  renameTab(tab, title) { tab.title = title.trim().slice(0, 100) || tab.title; tab.customTitle = true; this.renderTabs(); this.run(() => this.save()); }
  async newWindow() { const p = this.activePane(); const cwd = p && !p.info.serverId ? await this.api.cwd(p.id) : this.project().cwd; return this.api.newWindow({ projectId: this.activeProjectId, cwd }); }
  movePane(direction) {
    const ids = leafIds(this.activeTab()?.layout);
    const rects = ids.map(id => { const r = this.panes.get(id).el.getBoundingClientRect(); return { id, left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });
    const next = navigation.adjacentPane(rects, this.activePane()?.id, direction);
    if (next) this.focusPane(next);
  }
  selectTabAt(index) { const tab = this.tabs[index]; if (tab) this.selectTab(tab.id); }
  cycleTab(delta) { const i = this.tabs.findIndex(t => t.id === this.state().activeTabId); if (this.tabs.length) this.selectTab(this.tabs[(i + delta + this.tabs.length) % this.tabs.length].id); }
  cyclePane(delta) { const ids = leafIds(this.activeTab()?.layout), i = ids.indexOf(this.activePane()?.id); if (ids.length) this.focusPane(ids[(i + delta + ids.length) % ids.length]); }
  cycleProject(delta) { const i = this.projects.findIndex(p => p.id === this.activeProjectId); return this.selectProject(this.projects[(i + delta + this.projects.length) % this.projects.length].id); }
  applyAppearance() { const a = this.appearance(); for (const p of this.panes.values()) { if (p.term.options.fontFamily !== a.fontFamily) p.term.options.fontFamily = a.fontFamily; p.term.options.fontSize = a.fontSize; p.term.options.lineHeight = a.lineHeight; p.term.options.theme = this.theme(); } document.fonts.ready.then(() => this.fit()); }
  find() {
    const p = this.activePane(); if (!p) return;
    if ($('.find-bar', p.el)) return $('.find-bar input', p.el).focus();
    const bar = document.createElement('div'); bar.className = 'find-bar'; const input = document.createElement('input'); input.placeholder = t("Search terminal"); input.setAttribute('aria-label', t("Search terminal"));
    const search = reverse => { const found = reverse ? p.search.findPrevious(input.value) : p.search.findNext(input.value); input.style.color = input.value && !found ? '#e49794' : ''; };
    input.oninput = () => search(false); input.onkeydown = e => { if (e.key === 'Enter') search(e.shiftKey); if (e.key === 'Escape') { bar.remove(); p.term.focus(); } };
    bar.append(input, makeButton('↑', t("Previous match"), () => search(true)), makeButton('↓', t("Next match"), () => search(false)), makeButton('×', t("Close search"), () => { bar.remove(); p.term.focus(); })); p.el.append(bar); input.focus();
  }
}
