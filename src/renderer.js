import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import './style.css';
import themeDefinitions from './themes.cjs';
const { themes } = themeDefinitions;

const $ = (selector, root = document) => root.querySelector(selector);
const api = window.orbit;
const icons = {
  terminal: '<path d="m4 5 6 7-6 7m9 0h7"/>', search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor" stroke="none"/><circle cx="15" cy="17" r="3" fill="currentColor" stroke="none"/>',
  folder: '<path d="M3 7V5h6l2 2h10v13H3z"/>', chevron: '<path d="m9 5 6 7-6 7"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>', download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  code: '<path d="m7 6-5 6 5 6m10-12 5 6-5 6M14 3l-4 18"/>', external: '<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>',
  split: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
  server: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.terminal}</svg>`;
function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
hydrateIcons();
const autoReconnectRow = document.createElement('label'); autoReconnectRow.className = 'persistent-toggle';
autoReconnectRow.innerHTML = '<span>Avtomatik qayta ulanish<small>Oldin ulangan tmux sessiyasi uchun</small></span><input type="checkbox" name="autoReconnect" class="switch" checked>';
$('#session-name-field').before(autoReconnectRow);
const colors = { copper: '#c9a078', blue: '#87a5c4', green: '#8cb3a2', violet: '#a89bc5' };
let config, home, folder, wallpaperUrl, activeTabId, activePaneId, saving, toastTimer, platform = 'darwin';
const tabs = [];
const panes = new Map();
const earlyData = new Map();
const earlyExit = new Map();
let paletteItems = [], paletteIndex = 0, editingServerId = null;

function notify(message) { const toast = $('#toast'); toast.textContent = String(message).replace(/^Error invoking remote method '[^']+': Error: /, ''); toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.hidden = true, 6500); }
const run = callback => Promise.resolve().then(callback).catch(error => notify(error.message));
function shortPath(value) { return value?.startsWith(home) ? '~' + value.slice(home.length) : value; }
function button(label, className, onClick) { const el = document.createElement('button'); el.className = className; el.textContent = label; el.onclick = onClick; return el; }
function shortcutLabel(value) { return platform === 'darwin' ? value : value.replaceAll('⌘', 'Ctrl Shift').replaceAll('⇧', '').replaceAll('⌃', 'Ctrl').replace(/\s+/g, ' ').trim(); }
function activeTab() { return tabs.find(t => t.id === activeTabId); }
function activePane() { return panes.get(activePaneId); }
function save() { clearTimeout(saving); saving = setTimeout(() => run(async () => { await api.save(config); }), 150); }
function applyAppearance() {
  const a = config.appearance;
  const theme = themes[a.theme] || themes.graphite;
  document.body.className = `theme-${a.theme}${a.sidebar ? '' : ' sidebar-hidden'}`;
  for (const name of ['base', 'side', 'bar', 'text', 'muted', 'faint', 'accent']) document.body.style.setProperty(`--${name}`, theme[name]);
  document.body.style.setProperty('--terminal-bg', theme.terminal);
  document.body.style.setProperty('--line', theme.light ? '#1b30441c' : '#ffffff12');
  document.body.style.setProperty('--hover', theme.light ? '#18344b08' : '#ffffff07');
  document.body.style.colorScheme = theme.light ? 'light' : 'dark';
  document.documentElement.style.setProperty('--wallpaper-opacity', a.wallpaper ? a.wallpaperOpacity : 0);
  document.documentElement.style.setProperty('--wallpaper-dim', a.dim);
  $('#wallpaper').style.backgroundImage = `url("${wallpaperUrl}")`;
  $('#wallpaper').style.backgroundSize = a.wallpaperMode === 'fill' ? '100% 100%' : a.wallpaperMode;
  $('#wallpaper-preview').style.backgroundImage = `url("${wallpaperUrl}")`;
  for (const pane of panes.values()) {
    pane.term.options.fontSize = a.fontSize;
    pane.term.options.fontFamily = a.fontFamily;
    pane.term.options.theme = terminalTheme();
  }
  $('#font-status').textContent = `${a.fontSize} px`;
  syncSettings();
  requestAnimationFrame(fitVisible);
}
function terminalTheme() {
  const t = themes[config.appearance.theme] || themes.graphite;
  return { background: '#00000000', foreground: t.foreground, cursor: t.accent, selectionBackground: t.light ? '#45749a32' : '#a2b8d13d', black: t.light ? '#263b46' : '#303840', red: t.light ? '#a43d43' : '#e69794', green: t.light ? '#3b7250' : '#a2c4aa', yellow: t.light ? '#8e6b20' : '#dcc18c', blue: t.light ? '#356aa6' : '#8db4dd', magenta: t.light ? '#82509d' : '#bca3d5', cyan: t.light ? '#2d7778' : '#91c8c8', white: t.light ? '#5f6b73' : '#d8e0e7', brightBlack: t.light ? '#64757e' : '#798693', brightRed: t.light ? '#b9363d' : '#f4a9a4', brightGreen: t.light ? '#347c48' : '#b3d9b9', brightYellow: t.light ? '#8b6b11' : '#edd5a0', brightBlue: t.light ? '#2c70b7' : '#a6c8ee', brightMagenta: t.light ? '#8f4bae' : '#cfb7e8', brightCyan: t.light ? '#1f7e82' : '#a3dddd', brightWhite: t.light ? '#1b2f3a' : '#f0f3f6' };
}
function renderThemes() {
  const container = $('#theme-options'); container.replaceChildren();
  for (const [id, t] of Object.entries(themes)) {
    const el = document.createElement('button'); el.dataset.theme = id; el.setAttribute('aria-label', `${t.name} dizayni`);
    const preview = document.createElement('span'); preview.className = 'theme-mini'; preview.style.background = t.terminal; preview.style.borderColor = t.side;
    const miniSide = document.createElement('i'); miniSide.style.background = t.side;
    const miniLines = document.createElement('span'); miniLines.style.color = t.accent; miniLines.textContent = '>_';
    preview.append(miniSide, miniLines);
    const text = document.createElement('span'); text.className = 'theme-caption';
    const title = document.createElement('strong'); title.textContent = t.name;
    const description = document.createElement('small'); description.textContent = t.description;
    text.append(title, description); el.append(preview, text);
    el.onclick = () => { config.appearance.theme = id; applyAppearance(); save(); };
    container.append(el);
  }
}
function syncSettings() {
  const a = config.appearance;
  const assign = (selector, value) => { const el = $(selector); if (document.activeElement !== el) el.value = value; };
  assign('#font-size', a.fontSize); $('#font-output').textContent = `${a.fontSize} px`;
  assign('#wallpaper-opacity', Math.round(a.wallpaperOpacity * 100)); $('#opacity-output').textContent = `${Math.round(a.wallpaperOpacity * 100)}%`;
  assign('#wallpaper-dim', Math.round(a.dim * 100)); $('#dim-output').textContent = `${Math.round(a.dim * 100)}%`;
  assign('#wallpaper-mode', a.wallpaperMode);
  $('#wallpaper-toggle').checked = a.wallpaper;
  $('#sidebar-toggle').checked = a.sidebar;
  document.querySelectorAll('[data-theme]').forEach(el => el.classList.toggle('selected', el.dataset.theme === a.theme));
}
function renderFolder() {
  $('#folder-name').textContent = folder === home ? 'Home' : folder.split(/[\\/]/).filter(Boolean).pop();
  $('#folder-path').textContent = shortPath(folder);
  $('#choose-folder').title = folder;
}
function renderServers() {
  const list = $('#server-list'); list.replaceChildren();
  if (!config.servers.length) {
    const empty = document.createElement('div'); empty.className = 'empty-servers';
    const p = document.createElement('p'); p.textContent = 'Serverlaringiz shu yerda. Bir marta saqlang, bir bosishda ulaning.';
    empty.append(p, button('+ Birinchi server', '', () => openServer())); list.append(empty); return;
  }
  for (const server of config.servers) {
    const row = document.createElement('div'); row.className = 'server-item';
    const connect = document.createElement('button'); connect.className = 'server-connect'; connect.title = `${server.user ? server.user + '@' : ''}${server.host}:${server.port}`;
    const indicator = document.createElement('span'); indicator.className = 'server-indicator'; indicator.style.setProperty('--server-color', colors[server.color]);
    const name = document.createElement('span'); name.textContent = server.name;
    connect.append(indicator, name); connect.onclick = () => run(() => newTab({ serverId: server.id }));
    const codex = button('', 'icon-button server-codex', () => run(() => newTab({ serverId: server.id, codex: true })));
    codex.innerHTML = icon('spark'); codex.title = 'Serverda Codex ochish'; codex.setAttribute('aria-label', `${server.name} · Codex ochish`);
    const edit = button('···', 'icon-button', () => openServer(server)); edit.title = 'Serverni tahrirlash'; edit.setAttribute('aria-label', `${server.name} sozlamalari`);
    row.append(connect, codex, edit); list.append(row);
  }
}
function renderTabs() {
  const root = $('#tabs'); root.replaceChildren();
  for (const tab of tabs) {
    const el = document.createElement('div'); el.className = 'tab'; el.setAttribute('role', 'tab'); el.setAttribute('aria-selected', String(tab.id === activeTabId)); el.tabIndex = tab.id === activeTabId ? 0 : -1;
    const symbol = document.createElement('span'); symbol.innerHTML = icon(tab.options.codex ? 'spark' : tab.options.serverId ? 'server' : 'terminal');
    const name = document.createElement('span'); name.className = 'tab-name'; name.textContent = tab.title;
    const close = button('', 'icon-button tab-close', event => { event.stopPropagation(); run(() => closeTab(tab)); }); close.innerHTML = icon('close'); close.setAttribute('aria-label', `${tab.title} tabini yopish`);
    el.append(symbol, name, close); el.onclick = () => selectTab(tab.id); el.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') selectTab(tab.id); };
    root.append(el);
  }
}
function selectTab(id) {
  activeTabId = id;
  for (const tab of tabs) tab.group.hidden = tab.id !== id;
  const tab = activeTab();
  if (tab) activePaneId = tab.lastPane || tab.paneIds[0];
  renderTabs(); fitVisible(); updateFocus();
}
function updateFocus() {
  for (const pane of panes.values()) pane.el.classList.toggle('active-pane', pane.id === activePaneId);
  const pane = activePane();
  if (pane) {
    $('#connection-status').textContent = pane.exited ? 'Sessiya tugadi' : pane.info.serverId ? 'SSH · ' + pane.info.label : pane.options.codex ? 'Codex · local' : 'Local · shell';
    $('#connection-dot').style.background = pane.exited ? '#9a8a76' : '#89b8a3';
    $('#session-location').textContent = pane.info.serverId ? (config.servers.find(s => s.id === pane.info.serverId)?.host || '') + (pane.info.persistent ? ' · tmux' : '') : shortPath(pane.info.cwd);
    $('#session-location').title = pane.info.sessionName ? `Doimiy sessiya: ${pane.info.sessionName}` : pane.info.cwd;
    $('#terminal-size').textContent = `${pane.term.cols} × ${pane.term.rows}`;
    if (!document.querySelector('dialog[open]')) pane.term.focus();
  }
}
function fitVisible() {
  const tab = activeTab(); if (!tab) return;
  for (const id of tab.paneIds) {
    const pane = panes.get(id);
    if (pane && pane.mount.clientWidth > 20 && pane.mount.clientHeight > 20) {
      try { pane.fit.fit(); if (!pane.exited) api.resize(id, pane.term.cols, pane.term.rows); } catch {}
    }
  }
  updateFocus();
}
function layoutPanes(tab) {
  tab.group.classList.toggle('split', tab.paneIds.length > 1);
  tab.group.querySelectorAll('.pane-divider').forEach(el => el.remove());
  tab.group.style.gridTemplateColumns = tab.paneIds.map(() => 'minmax(0, 1fr)').join(' 5px ');
  tab.paneIds.forEach((id, index) => {
    const pane = panes.get(id); pane.el.style.gridColumn = String(index * 2 + 1);
    if (index) {
      const divider = document.createElement('div'); divider.className = 'pane-divider'; divider.style.gridColumn = String(index * 2); divider.style.gridRow = '1'; divider.setAttribute('role', 'separator'); divider.setAttribute('aria-orientation', 'vertical');
      divider.onpointerdown = event => {
        divider.setPointerCapture(event.pointerId); divider.classList.add('dragging');
        const elements = tab.paneIds.map(pid => panes.get(pid).el);
        const widths = elements.map(el => el.getBoundingClientRect().width); const start = event.clientX;
        divider.onpointermove = move => {
          const delta = Math.max(120 - widths[index - 1], Math.min(widths[index] - 120, move.clientX - start));
          const next = [...widths]; next[index - 1] += delta; next[index] -= delta;
          tab.group.style.gridTemplateColumns = next.map(w => `${w}px`).join(' 5px '); fitVisible();
        };
        divider.onpointerup = () => { divider.onpointermove = null; divider.classList.remove('dragging'); const next = elements.map(el => el.getBoundingClientRect().width); tab.group.style.gridTemplateColumns = next.map(w => `minmax(0, ${w}fr)`).join(' 5px '); };
      };
      tab.group.append(divider);
    }
  });
  fitVisible();
}
async function createPane(tab, options) {
  const info = await api.create({ ...options, cwd: options.cwd || folder });
  const el = document.createElement('section'); el.className = 'terminal-pane'; el.style.gridRow = '1';
  const label = document.createElement('div'); label.className = 'pane-label';
  const labelText = document.createElement('span'); labelText.textContent = info.label;
  label.append(labelText, button('×', '', () => run(() => closePane(info.id))));
  const mount = document.createElement('div'); mount.className = 'terminal-mount'; el.append(label, mount); tab.group.append(el);
  const fit = new FitAddon(); const search = new SearchAddon();
  const term = new Terminal({ allowTransparency: true, fontSize: config.appearance.fontSize, fontFamily: config.appearance.fontFamily, lineHeight: 1.25, letterSpacing: 0, cursorBlink: true, cursorStyle: 'bar', scrollback: 15000, macOptionIsMeta: true, rightClickSelectsWord: true, theme: terminalTheme() });
  term.loadAddon(fit); term.loadAddon(search); term.open(mount);
  const pane = { id: info.id, term, fit, search, info, options, el, mount, tabId: tab.id, exited: false };
  term.parser.registerOscHandler(777, data => {
    if (data !== 'OrbitReady') return false;
    pane.wasConnected = true; pane.options = { ...pane.options, reconnectAttempts: 0, reconnecting: false }; return true;
  });
  panes.set(info.id, pane); tab.paneIds.push(info.id); if (activeTabId === tab.id) activePaneId = info.id; tab.lastPane = info.id;
  el.addEventListener('pointerdown', () => { activePaneId = info.id; tab.lastPane = info.id; updateFocus(); });
  term.onData(data => { if (!pane.exited) api.write(info.id, data); });
  term.onTitleChange(title => { el.title = title; });
  term.attachCustomKeyEventHandler(event => {
    if ((platform === 'darwin' ? event.metaKey : event.ctrlKey) && event.key === 'c' && term.hasSelection()) { if (event.type === 'keydown') navigator.clipboard.writeText(term.getSelection()).catch(error => notify(error.message)); return false; }
    return true;
  });
  if (earlyData.has(info.id)) { term.write(earlyData.get(info.id)); earlyData.delete(info.id); }
  if (earlyExit.has(info.id)) { markExited(earlyExit.get(info.id)); earlyExit.delete(info.id); }
  layoutPanes(tab); return pane;
}
async function newTab(options = {}) {
  const previous = activeTabId;
  const group = document.createElement('div'); group.className = 'pane-group'; $('#workspaces').append(group);
  const serverName = options.serverId ? config.servers.find(s => s.id === options.serverId)?.name || 'SSH' : '';
  const tab = { id: crypto.randomUUID(), group, paneIds: [], options, title: options.codex ? `Codex${serverName ? ' · ' + serverName : ''}` : serverName || 'Local' };
  tabs.push(tab); activeTabId = tab.id;
  try { await createPane(tab, options); selectTab(tab.id); }
  catch (error) { tabs.splice(tabs.indexOf(tab), 1); group.remove(); if (previous) selectTab(previous); throw error; }
}
async function split() {
  const tab = activeTab(); if (!tab) return newTab();
  if (tab.paneIds.length >= 3) return notify('Har bir tabda 3 tagacha panel ochish mumkin.');
  const current = activePane();
  await createPane(tab, current?.info.serverId ? { serverId: current.info.serverId } : {});
}
async function closePane(id) {
  const pane = panes.get(id); if (!pane) return;
  clearTimeout(pane.reconnectTimer);
  const tab = tabs.find(t => t.id === pane.tabId);
  await api.close(id); pane.term.dispose(); pane.el.remove(); panes.delete(id);
  tab.paneIds = tab.paneIds.filter(pid => pid !== id);
  if (!tab.paneIds.length) { tab.group.remove(); tabs.splice(tabs.indexOf(tab), 1); if (tabs.length) { if (activeTabId === tab.id) selectTab(tabs.at(-1).id); } else await newTab(); }
  else { if (!tab.paneIds.includes(tab.lastPane)) tab.lastPane = tab.paneIds[0]; if (activeTabId === tab.id) activePaneId = tab.lastPane; layoutPanes(tab); updateFocus(); }
  renderTabs();
}
async function closeTab(tab) {
  const ids = [...tab.paneIds];
  for (const id of ids) await closePane(id);
}
function markExited(event) {
  const pane = panes.get(event.id);
  if (!pane) { earlyExit.set(event.id, event); return; }
  pane.exited = true;
  const banner = document.createElement('div'); banner.className = 'exit-banner';
  const text = document.createElement('span'); text.textContent = `${pane.info.persistent ? 'SSH aloqa tugadi · doimiy sessiya rejimi' : 'Sessiya tugadi'} · kod ${event.exitCode}${pane.options.codex && event.exitCode === 127 ? ' · Codex topilmadi. config.json ichidagi codexCommand’ni tekshiring.' : ''}`;
  const reconnect = async (automatic = false) => {
    clearTimeout(pane.reconnectTimer);
    const tab = tabs.find(t => t.id === pane.tabId); if (!tab || !panes.has(pane.id)) return;
    await createPane(tab, { ...pane.options, reconnecting: automatic, reconnectAttempts: automatic ? (pane.options.reconnectAttempts || 0) + 1 : 0 });
    await closePane(pane.id);
  };
  const retryButton = button(pane.info.persistent ? 'Sessiyani davom ettirish' : 'Qayta ochish', '', () => run(() => reconnect()));
  banner.append(text, retryButton);
  const attempt = pane.options.reconnectAttempts || 0;
  if (pane.info.autoReconnect && event.exitCode === 255 && (pane.wasConnected || pane.options.reconnecting) && attempt < 5) {
    const delay = Math.min(30, 2 ** (attempt + 1));
    text.textContent = `Aloqa uzildi. ${delay} soniyadan keyin tmux sessiyasiga qayta ulanadi · ${attempt + 1}/5`;
    const cancel = button('To‘xtatish', '', () => { clearTimeout(pane.reconnectTimer); cancel.remove(); text.textContent = 'Avtomatik qayta ulanish to‘xtatildi. Sessiyani qo‘lda davom ettirishingiz mumkin.'; });
    banner.append(cancel);
    pane.reconnectTimer = setTimeout(() => run(() => reconnect(true)), delay * 1000);
  }
  pane.el.append(banner); updateFocus();
}
function openDialog(selector) { const dialog = $(selector); if (!dialog.open) dialog.showModal(); }
function openServer(server) {
  editingServerId = server?.id || null;
  const form = $('#server-form'); form.reset();
  for (const key of ['name', 'host', 'user', 'port', 'identity', 'sessionName']) form.elements[key].value = server?.[key] ?? (key === 'port' ? 22 : '');
  form.elements.persistent.checked = server?.persistent !== false;
  form.elements.autoReconnect.checked = server?.autoReconnect !== false;
  form.elements.autoReconnect.disabled = !form.elements.persistent.checked;
  $('#session-name-field').hidden = !form.elements.persistent.checked;
  $('#server-error').textContent = ''; $('#server-dialog-title').textContent = server ? 'Serverni tahrirlash' : 'Server qo‘shish'; $('#delete-server').hidden = !server;
  openDialog('#server-dialog');
}
function actions() {
  return [
    { name: 'Yangi terminal', icon: 'terminal', key: '⌘ T', run: () => newTab() },
    { name: 'Codex ochish', icon: 'spark', key: '⌘ ⇧ N', run: () => newTab({ codex: true }) },
    { name: 'Panelni bo‘lish', icon: 'split', key: '⌘ D', run: split },
    { name: 'Server qo‘shish', icon: 'server', run: () => openServer() },
    ...config.servers.map(s => ({ name: `${s.name} · ${s.host}`, icon: 'server', run: () => newTab({ serverId: s.id }) })),
    ...config.servers.map(s => ({ name: `${s.name} · Codex ochish`, icon: 'spark', run: () => newTab({ serverId: s.id, codex: true }) })),
    { name: 'Sozlamalar', icon: 'settings', key: '⌘ ,', run: () => openDialog('#settings-dialog') },
    { name: 'config.json’ni tahrirlash', icon: 'code', run: () => api.editConfig() },
    { name: 'SSH config’dan import', icon: 'download', run: importSSH },
    { name: 'Fon rasmini yoqish / o‘chirish', icon: 'image', run: () => { config.appearance.wallpaper = !config.appearance.wallpaper; applyAppearance(); save(); } },
    { name: 'Terminalni tozalash', icon: 'terminal', run: () => activePane()?.term.clear() },
  ];
}
function renderPalette() {
  const query = $('#palette-input').value.toLocaleLowerCase();
  paletteItems = actions().filter(a => a.name.toLocaleLowerCase().includes(query)); paletteIndex = Math.min(paletteIndex, Math.max(0, paletteItems.length - 1));
  const results = $('#palette-results'); results.replaceChildren();
  paletteItems.forEach((item, index) => {
    const el = button('', `palette-result${index === paletteIndex ? ' selected' : ''}`, () => { $('#palette-dialog').close(); run(item.run); });
    const symbol = document.createElement('span'); symbol.innerHTML = icon(item.icon); const name = document.createElement('span'); name.textContent = item.name; const key = document.createElement('kbd'); key.textContent = shortcutLabel(item.key || '');
    el.append(symbol, name, key); results.append(el);
  });
  if (!paletteItems.length) { const p = document.createElement('p'); p.textContent = 'Mos buyruq topilmadi.'; p.style.padding = '20px'; results.append(p); }
}
function openPalette() { $('#palette-input').value = ''; paletteIndex = 0; renderPalette(); openDialog('#palette-dialog'); $('#palette-input').focus(); }
async function importSSH() {
  const aliases = await api.importSSH(); const existing = new Set(config.servers.map(s => s.host)); const added = aliases.filter(s => !existing.has(s.host));
  config.servers.push(...added); config = await api.save(config); renderServers(); notify(added.length ? `${added.length} ta SSH profil import qilindi.` : 'Yangi SSH alias topilmadi. ~/.ssh/config faylini tekshiring.');
}
function find() {
  const pane = activePane(); if (!pane) return;
  if ($('.find-bar', pane.el)) return $('.find-bar input', pane.el).focus();
  const bar = document.createElement('div'); bar.className = 'find-bar';
  const input = document.createElement('input'); input.placeholder = 'Terminalda qidirish'; input.setAttribute('aria-label', 'Terminalda qidirish');
  const search = reverse => { const found = reverse ? pane.search.findPrevious(input.value) : pane.search.findNext(input.value); input.style.color = input.value && !found ? '#e49794' : ''; };
  input.oninput = () => search(false); input.onkeydown = event => { if (event.key === 'Enter') search(event.shiftKey); if (event.key === 'Escape') { bar.remove(); pane.term.focus(); } };
  bar.append(input, button('↑', '', () => search(true)), button('↓', '', () => search(false)), button('×', '', () => { bar.remove(); pane.term.focus(); })); pane.el.append(bar); input.focus();
}
function handleAction(name) {
  const handlers = { new: () => newTab(), codex: () => newTab({ codex: true }), split, close: () => closePane(activePaneId), settings: () => openDialog('#settings-dialog'), palette: openPalette, find,
    sidebar: () => { config.appearance.sidebar = !config.appearance.sidebar; applyAppearance(); save(); },
    next: () => selectTab(tabs[(tabs.findIndex(t => t.id === activeTabId) + 1) % tabs.length]?.id),
    previous: () => selectTab(tabs[(tabs.findIndex(t => t.id === activeTabId) + tabs.length - 1) % tabs.length]?.id),
    fontUp: () => { config.appearance.fontSize = Math.min(28, config.appearance.fontSize + 1); applyAppearance(); save(); },
    fontDown: () => { config.appearance.fontSize = Math.max(10, config.appearance.fontSize - 1); applyAppearance(); save(); }
  };
  if (handlers[name]) run(handlers[name]);
}
api.onData(({ id, data }) => { const pane = panes.get(id); if (pane) pane.term.write(data); else { if (earlyData.size > 25) earlyData.clear(); earlyData.set(id, ((earlyData.get(id) || '') + data).slice(-200000)); } });
api.onExit(markExited);
api.onError(notify);
api.onAction(handleAction);
api.onConfig(value => { config = value; applyAppearance(); renderServers(); });
document.querySelectorAll('.close-dialog').forEach(el => el.onclick = () => el.closest('dialog').close());
document.querySelectorAll('dialog').forEach(dialog => { dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } }); dialog.addEventListener('close', updateFocus); });
$('#new-local').onclick = $('#add-tab').onclick = () => run(() => newTab());
$('#new-codex').onclick = () => run(() => newTab({ codex: true }));
$('#split-button').onclick = () => run(split);
$('#settings-button').onclick = $('#status-settings').onclick = () => openDialog('#settings-dialog');
$('#palette-button').onclick = openPalette;
$('#add-server').onclick = () => openServer();
$('#edit-config').onclick = $('#settings-edit-config').onclick = () => run(() => api.editConfig());
$('#import-ssh').onclick = () => run(importSSH);
$('#choose-folder').onclick = () => run(async () => { const chosen = await api.chooseDirectory(); if (!chosen) return; folder = chosen; config.startingDirectory = folder; renderFolder(); save(); notify('Yangi sessiyalar shu papkada ochiladi.'); });
$('#choose-wallpaper').onclick = () => run(async () => { const chosen = await api.chooseWallpaper(); if (chosen) { wallpaperUrl = chosen; config.appearance.wallpaper = true; applyAppearance(); save(); } });
$('#choose-key').onclick = () => run(async () => { const chosen = await api.chooseIdentity(); if (chosen) $('#server-form').elements.identity.value = chosen; });
$('#server-form').onsubmit = event => { event.preventDefault(); run(async () => {
  const values = Object.fromEntries(new FormData(event.target));
  if (!values.host || values.host.startsWith('-') || /\s/.test(values.host)) { $('#server-error').textContent = 'Host maydoniga IP, domen yoki SSH alias yozing.'; return; }
  const previous = config.servers.find(s => s.id === editingServerId);
  const server = { ...values, persistent: event.target.elements.persistent.checked, autoReconnect: event.target.elements.autoReconnect.checked, id: editingServerId || crypto.randomUUID(), port: Number(values.port), color: previous?.color || 'blue' };
  const next = { ...config, servers: previous ? config.servers.map(s => s.id === editingServerId ? server : s) : [...config.servers, server] };
  config = await api.save(next); renderServers(); $('#server-dialog').close(); notify('Server profili saqlandi.');
}); };
$('#delete-server').onclick = () => run(async () => { config = await api.save({ ...config, servers: config.servers.filter(s => s.id !== editingServerId) }); renderServers(); $('#server-dialog').close(); });
for (const [selector, key, convert] of [['#font-size', 'fontSize', Number], ['#wallpaper-opacity', 'wallpaperOpacity', v => Number(v) / 100], ['#wallpaper-dim', 'dim', v => Number(v) / 100], ['#wallpaper-mode', 'wallpaperMode', v => v]]) {
  $(selector).oninput = event => { config.appearance[key] = convert(event.target.value); applyAppearance(); save(); };
}
for (const [selector, key] of [['#wallpaper-toggle', 'wallpaper'], ['#sidebar-toggle', 'sidebar']]) $(selector).onchange = event => { config.appearance[key] = event.target.checked; applyAppearance(); save(); };
$('#server-form').elements.persistent.onchange = event => { $('#session-name-field').hidden = !event.target.checked; $('#server-form').elements.autoReconnect.disabled = !event.target.checked; };
$('#palette-input').oninput = () => { paletteIndex = 0; renderPalette(); };
$('#palette-input').onkeydown = event => {
  if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); paletteIndex = (paletteIndex + (event.key === 'ArrowDown' ? 1 : -1) + paletteItems.length) % (paletteItems.length || 1); renderPalette(); $('#palette-results .selected')?.scrollIntoView({ block: 'nearest' }); }
  if (event.key === 'Enter' && paletteItems[paletteIndex]) { event.preventDefault(); const item = paletteItems[paletteIndex]; $('#palette-dialog').close(); run(item.run); }
};
new ResizeObserver(() => requestAnimationFrame(fitVisible)).observe($('#terminal-area'));
run(async () => { const initial = await api.init(); config = initial.config; home = initial.home; folder = config.startingDirectory; wallpaperUrl = initial.wallpaper; platform = initial.platform; document.documentElement.dataset.platform = platform; if (platform !== 'darwin') { document.querySelectorAll('kbd').forEach(el => el.textContent = shortcutLabel(el.textContent)); $('.local-note').lastChild.textContent = ' Shu kompyuterda ishlaydi'; } $('#version').textContent = initial.version; renderThemes(); renderFolder(); renderServers(); applyAppearance(); await newTab(); });
