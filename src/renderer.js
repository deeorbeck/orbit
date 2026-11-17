import { TerminalEffects } from './terminal-effects.js';
import effectProfiles from './effect-profiles.cjs';
const { fontProfile } = effectProfiles;
import fontCatalog from './font-catalog.cjs';
const { extraFonts, fontOptions } = fontCatalog;
import { t, setLanguage, translateDocument } from './i18n-dom.js';
import { installThemeEditor } from './theme-editor.js';
import { WorkspaceUI } from './workspace-ui.js';
import './style.css';
import themeDefinitions from './themes.cjs';
const { currentTheme, themeCatalog } = themeDefinitions;

const $ = (selector, root = document) => root.querySelector(selector);
const api = window.orbit;
const icons = {
  focus: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
  terminal: '<path d="m4 5 6 7-6 7m9 0h7"/>', search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor" stroke="none"/><circle cx="15" cy="17" r="3" fill="currentColor" stroke="none"/>',
  folder: '<path d="M3 7V5h6l2 2h10v13H3z"/>', chevron: '<path d="m9 5 6 7-6 7"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>', download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  code: '<path d="m7 6-5 6 5 6m10-12 5 6-5 6M14 3l-4 18"/>', external: '<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>',
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M5.5 8h1M5.5 12h1M5.5 16h1"/>',
  split: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
  remoteCodex: '<path d="M3 5h11v14H3zM6 9h4m-4 4h4m9-10 1.5 4L23 9l-2.5 2L19 15l-1.5-4L15 9l2.5-2z"/>',
  server: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.terminal}</svg>`;
function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
hydrateIcons();
const effects = new TerminalEffects($('#effects-canvas'));
const effectPreview = new TerminalEffects($('#effect-preview-canvas'), { preview: true, exposeDebug: false });
let focusMode = false;
const autoReconnectRow = document.createElement('label'); autoReconnectRow.className = 'persistent-toggle';
autoReconnectRow.innerHTML = '<span><span data-i18n="Reconnect automatically">Reconnect automatically</span><small data-i18n="For a previously connected tmux session">For a previously connected tmux session</small></span><input type="checkbox" name="autoReconnect" class="switch" checked>';
$('#session-name-field').before(autoReconnectRow);
const colors = { copper: '#c9a078', blue: '#87a5c4', green: '#8cb3a2', violet: '#a89bc5' };
let localFonts = [];
const loadedLocalFonts = new Map();
const allFontOptions = () => [...fontOptions, ...localFonts];
async function loadLocalFonts(fonts) {
  localFonts = fonts;
  await Promise.all(fonts.map(font => {
    if (!loadedLocalFonts.has(font.face)) {
      const face = new FontFace(font.face, `url("${font.url}")`);
      loadedLocalFonts.set(font.face, face.load().then(loaded => document.fonts.add(loaded)));
    }
    return loadedLocalFonts.get(font.face).catch(error => { localFonts = localFonts.filter(item => item.face !== font.face); notify(`${font.name}: ${error.message}`); });
  }));
}
let config, home, wallpaperUrl, saving, toastTimer, platform = 'darwin', workspace, shortcutMap = {}, projectFilter = false, connectionsOnly = false, savedConnections = [];
let paletteItems = [], paletteIndex = 0, editingServerId = null, editingProjectId = null, renamingTab = null;
const newTab = options => workspace?.newTab(options);
const split = direction => workspace?.split(direction);
const find = () => workspace?.find();
const activePane = () => workspace?.activePane();
const activeTab = () => workspace?.activeTab();
const updateFocus = () => workspace?.focusActive();
const fitVisible = () => workspace?.fit();
function renderFolder() { workspace?.renderProjects(); }
function effectiveFont() { return config.appearance.fontFamily || currentTheme(config).fontFamily; }
function effectContext() { return { themeId: config.appearance.theme, baseTheme: currentTheme(config).baseTheme }; }
function selectedFontName() { return allFontOptions().find(font => font.fontFamily === effectiveFont())?.name || effectiveFont(); }
function appearance() { return { ...config.appearance, ...fontProfile(selectedFontName(), config.appearance.effectStyle, effectContext()), fontFamily: effectiveFont(), lineHeight: currentTheme(config).lineHeight }; }
async function setFocusMode(enabled) {
  if (enabled && workspace?.inHome) await workspace.resume();
  focusMode = enabled;
  if (enabled) document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  document.body.classList.toggle('terminal-only', enabled);
  await api.focusMode(enabled); requestAnimationFrame(fitVisible); updateFocus();
}
window.addEventListener('keydown', event => { if (event.key === 'Escape' && focusMode) { event.preventDefault(); event.stopImmediatePropagation(); run(() => setFocusMode(false)); } }, true);
function notify(message) { const toast = $('#toast'); toast.textContent = String(message).replace(/^Error invoking remote method '[^']+': Error: /, ''); toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.hidden = true, 6500); }
const run = callback => Promise.resolve().then(callback).catch(error => notify(error.message));
function shortPath(value) { return value?.startsWith(home) ? '~' + value.slice(home.length) : value; }
function button(label, className, onClick) { const el = document.createElement('button'); el.className = className; el.textContent = label; el.onclick = onClick; return el; }
function shortcutLabel(value) { return platform === 'darwin' ? value : value.replaceAll('⌘', 'Ctrl Shift').replaceAll('⇧', '').replaceAll('⌃', 'Ctrl').replace(/\s+/g, ' ').trim(); }
function save() { clearTimeout(saving); const pending = structuredClone(config); saving = setTimeout(() => { saving = null; run(async () => { await api.save(pending); }); }, 150); }
function applyAppearance() {
  const a = config.appearance;
  const theme = currentTheme(config);
  const sidebarButton = $('#sidebar-button');
  const sidebarLabel = a.sidebar ? t("Hide sidebar") : t("Show sidebar");
  sidebarButton.setAttribute('aria-expanded', String(a.sidebar));
  sidebarButton.setAttribute('aria-label', sidebarLabel);
  sidebarButton.title = `${sidebarLabel} · ${shortcutMap.sidebar?.key || '⌘B'}`;
  document.body.dataset.theme = a.theme;
  document.body.className = `${focusMode ? "terminal-only " : ""}${workspace?.inHome ? "home-visible " : ""}theme-${a.theme}${theme.custom ? " theme-" + theme.baseTheme : ""}${a.sidebar ? '' : ' sidebar-hidden'}`;
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
  document.body.style.setProperty('--ui-font', effectiveFont());
  document.body.style.setProperty('--orbit-font', effectiveFont());
  const profile = fontProfile(selectedFontName(), a.effectStyle, effectContext()); document.body.dataset.effectStyle = profile.style; document.body.dataset.effects = String(a.effects);
  const effectOptions = { appearance: a, fontName: selectedFontName(), fontFamily: effectiveFont(), accent: theme.accent, light: theme.light, ...effectContext() };
  effects.configure(effectOptions); effectPreview.configure(effectOptions);
  $('#effects-button').setAttribute('aria-pressed', String(a.effects));
  $('#effects-button').title = t(a.effects ? 'Effects on · click to turn off' : 'Effects off · click to turn on') + ' · ' + t('Right-click for effect settings') + ' · ' + (shortcutMap.effects?.key || '');
  $('#focus-mode-button').title = t('Terminal only · Esc to return') + ' · ' + (shortcutMap.focusMode?.key || '');
  workspace?.applyAppearance();
  $('#font-preview').style.fontFamily = effectiveFont();
  const selectedFont = allFontOptions().find(font => font.fontFamily === effectiveFont());
  $('#font-preview').style.fontSize = `${Math.max(16, config.appearance.fontSize)}px`;
  $('#font-description').textContent = selectedFont?.monospace === false ? t('Display font · styled terminal text; fixed-width fonts align code more precisely.') : t('Monospace · aligned columns for code and terminal output.');
  syncSettings();
  requestAnimationFrame(fitVisible);
}
function terminalTheme() {
  const t = currentTheme(config);
  return { background: '#00000000', foreground: t.foreground, cursor: t.accent, selectionBackground: t.light ? '#45749a32' : '#a2b8d13d', black: t.light ? '#263b46' : '#303840', red: t.light ? '#a43d43' : '#e69794', green: t.light ? '#3b7250' : '#a2c4aa', yellow: t.light ? '#8e6b20' : '#dcc18c', blue: t.light ? '#356aa6' : '#8db4dd', magenta: t.light ? '#82509d' : '#bca3d5', cyan: t.light ? '#2d7778' : '#91c8c8', white: t.light ? '#5f6b73' : '#d8e0e7', brightBlack: t.light ? '#64757e' : '#798693', brightRed: t.light ? '#b9363d' : '#f4a9a4', brightGreen: t.light ? '#347c48' : '#b3d9b9', brightYellow: t.light ? '#8b6b11' : '#edd5a0', brightBlue: t.light ? '#2c70b7' : '#a6c8ee', brightMagenta: t.light ? '#8f4bae' : '#cfb7e8', brightCyan: t.light ? '#1f7e82' : '#a3dddd', brightWhite: t.light ? '#1b2f3a' : '#f0f3f6' };
}
const messagesTheme = name => t('{name} theme', { name });
function localizeUI() {
  setLanguage(config.language); translateDocument();
  $('#language').value = config.language;
  $('#server-dialog-title').textContent = t(editingServerId ? 'Edit server' : 'Add server');
  $('#project-title').textContent = t(editingProjectId ? 'Edit project' : 'Add project');
  $('#palette-input').placeholder = t(connectionsOnly ? 'Choose a terminal, Codex or server…' : projectFilter ? 'Choose a project…' : 'Search commands or servers…');
  $('#new-local>span:nth-child(2)').textContent = t('New session');
  $('.local-note').lastChild.textContent = t('Sessions keep running when the window closes');
  const grid = $('.shortcut-grid'); grid.replaceChildren();
  for (const item of Object.values(shortcutMap)) { const name = document.createElement('span'); name.textContent = t(item.label); const key = document.createElement('kbd'); key.textContent = item.key; grid.append(name, key); }
  renderThemes(); renderFontOptions(); renderServers();
  workspace?.renderProjects(); workspace?.renderTabs();
  if (workspace) for (const pane of workspace.panes.values()) workspace.renderPane(pane);
  if ($('#palette-dialog').open) renderPalette();
}
function renderThemes() {
  const container = $('#theme-options'); container.replaceChildren();
  for (const [id, t] of Object.entries(themeCatalog(config))) {
    const el = document.createElement('button'); el.dataset.theme = id; el.setAttribute('aria-label', messagesTheme(t.name));
    const preview = document.createElement('span'); preview.className = 'theme-mini'; preview.style.background = t.terminal; preview.style.borderColor = t.side;
    const miniSide = document.createElement('i'); miniSide.style.background = t.side;
    const miniLines = document.createElement('span'); miniLines.style.color = t.accent; miniLines.textContent = '>_';
    preview.style.fontFamily = t.fontFamily; miniLines.style.fontFamily = t.fontFamily; preview.append(miniSide, miniLines);
    const text = document.createElement('span'); text.className = 'theme-caption';
    const title = document.createElement('strong'); title.textContent = t.name;
    const description = document.createElement('small'); description.textContent = t.fontName;
    text.append(title, description); el.append(preview, text);
    el.onclick = () => { config.appearance.theme = id; if (t.custom) { config.appearance.fontFamily = ''; config.appearance.fontSize = t.fontSize; } applyAppearance(); save(); };
    container.append(el);
  }
}
function syncSettings() {
  const a = config.appearance;
  $('#edit-theme').disabled = !currentTheme(config).custom;
  const assign = (selector, value) => { const el = $(selector); if (document.activeElement !== el) el.value = value; };
  $('#language').value = config.language;
  if ($('#font-family')) $('#font-family').value = a.fontFamily;
  assign('#font-size', a.fontSize); $('#font-output').textContent = `${a.fontSize} px`;
  assign('#wallpaper-opacity', Math.round(a.wallpaperOpacity * 100)); $('#opacity-output').textContent = `${Math.round(a.wallpaperOpacity * 100)}%`;
  assign('#wallpaper-dim', Math.round(a.dim * 100)); $('#dim-output').textContent = `${Math.round(a.dim * 100)}%`;
  assign('#wallpaper-mode', a.wallpaperMode);
  $('#wallpaper-toggle').checked = a.wallpaper;
  $('#sidebar-toggle').checked = a.sidebar;
  $('#effects-toggle').checked = a.effects; $('#typing-effects').checked = a.typingEffects; $('#ambient-effects').checked = a.ambientEffects;
  $('#startup-home').checked = config.startupHome; assign('#effect-style', a.effectStyle); assign('#effect-intensity', Math.round(a.effectIntensity * 100)); $('#effect-output').textContent = Math.round(a.effectIntensity * 100) + '%';
  assign('#effect-speed', Math.round(a.effectSpeed * 100)); $('#effect-speed-output').textContent = a.effectSpeed.toFixed(2).replace(/0$/, '') + '×';
  assign('#effect-count', a.effectTrailCount); $('#effect-count-output').textContent = String(a.effectTrailCount);
  assign('#effect-size', Math.round(a.effectSize * 100)); $('#effect-size-output').textContent = a.effectSize.toFixed(2).replace(/0$/, '') + '×';
  document.querySelectorAll('[data-theme]').forEach(el => el.classList.toggle('selected', el.dataset.theme === a.theme));
}
function renderServers() {
  const list = $('#server-list'); list.replaceChildren();
  if (!config.servers.length && !savedConnections.length) {
    const empty = document.createElement('div'); empty.className = 'empty-servers';
    const p = document.createElement('p'); p.textContent = t("Your servers live here. Save once, connect with one click.");
    empty.append(p, button(t("+ Add your first server"), '', () => openServer())); list.append(empty); return;
  }
  for (const server of config.servers) {
    const row = document.createElement('div'); row.className = 'server-item';
    const connect = document.createElement('button'); connect.className = 'server-connect'; connect.title = `${server.user ? server.user + '@' : ''}${server.host}:${server.port}`;
    const indicator = document.createElement('span'); indicator.className = 'server-indicator'; indicator.style.setProperty('--server-color', colors[server.color]);
    const name = document.createElement('span'); name.textContent = server.name;
    connect.append(indicator, name); connect.onclick = () => run(() => newTab({ serverId: server.id }));
    const codex = button('', 'icon-button server-codex', () => run(() => newTab({ serverId: server.id, codex: true })));
    codex.innerHTML = icon('spark'); codex.title = t("Open Codex on server"); codex.setAttribute('aria-label', t('Open Codex · {name}', { name: server.name }));
    const edit = button('···', 'icon-button', () => openServer(server)); edit.title = t("Edit server"); edit.setAttribute('aria-label', t('{name} settings', { name: server.name }));
    row.append(connect, codex, edit); list.append(row);
  }
  for (const connection of savedConnections) {
    const row = document.createElement('div'); row.className = 'server-item discovered-connection';
    const connect = document.createElement('button'); connect.className = 'server-connect'; connect.title = connection.source + ' · ' + connection.name;
    const symbol = document.createElement('span'); symbol.innerHTML = icon('server');
    const name = document.createElement('span'); name.textContent = connection.name;
    const source = document.createElement('small'); source.className = 'connection-source'; source.textContent = connection.kind === 'shell-alias' ? 'alias' : 'SSH';
    connect.append(symbol, name, source); connect.onclick = () => run(() => newTab({ connectionId: connection.id })); row.append(connect); list.append(row);
  }
}
async function refreshConnections() { savedConnections = await api.connections(); renderServers(); if ($('#palette-dialog').open && connectionsOnly) renderPalette(); }
function openConnections() { projectFilter = false; connectionsOnly = true; $('#palette-input').value = ''; $('#palette-input').placeholder = t("Choose a terminal, Codex or server…"); paletteIndex = 0; renderPalette(); openDialog('#palette-dialog'); $('#palette-input').focus(); run(refreshConnections); }
function openDialog(selector) { const dialog = $(selector); if (!dialog.open) dialog.showModal(); }
function openServer(server) {
  editingServerId = server?.id || null;
  const form = $('#server-form'); form.reset();
  for (const key of ['name', 'host', 'user', 'port', 'identity', 'sessionName']) form.elements[key].value = server?.[key] ?? (key === 'port' ? 22 : '');
  form.elements.persistent.checked = server?.persistent !== false;
  form.elements.autoReconnect.checked = server?.autoReconnect !== false;
  form.elements.autoReconnect.disabled = !form.elements.persistent.checked;
  $('#session-name-field').hidden = !form.elements.persistent.checked;
  $('#server-error').textContent = ''; $('#server-dialog-title').textContent = server ? t("Edit server") : t("Add server"); $('#delete-server').hidden = !server;
  openDialog('#server-dialog');
}
function openProject(project) {
  editingProjectId = project?.id || null;
  const form = $('#project-form'); form.elements.name.value = project?.name || ''; form.elements.cwd.value = project?.cwd || '';
  $('#project-title').textContent = project ? t("Edit project") : t("Add project"); openDialog('#project-dialog');
}
function openRename(tab) { if (!tab) return; renamingTab = tab; $('#rename-name').value = tab.title; openDialog('#rename-dialog'); }
function renderFontOptions() {
  const select = $('#font-family'); select.replaceChildren(); const auto = document.createElement('option'); auto.value = ''; auto.textContent = t("Theme font · automatic"); select.append(auto);
  for (const font of allFontOptions()) { const option = document.createElement('option'); option.value = font.fontFamily; option.textContent = font.name + (font.style ? ' · ' + t(font.style) : ''); option.style.fontFamily = font.fontFamily; select.append(option); }
  if (config.appearance.fontFamily && !allFontOptions().some(font => font.fontFamily === config.appearance.fontFamily)) { const option = document.createElement('option'); option.value = config.appearance.fontFamily; option.textContent = t("Custom font"); select.append(option); }
  select.value = config.appearance.fontFamily;
}
function actions() {
  const projectActions = (workspace?.projects || []).map(p => ({ name: p.name + t(" · project"), icon: 'folder', run: () => workspace.selectProject(p.id) }));
  const connectionActions = [...config.servers.map(s => ({ name: s.name + ' · SSH', icon: 'server', run: () => newTab({ serverId: s.id }) })), ...savedConnections.map(s => ({ name: s.name + ' · ' + s.source, icon: 'server', run: () => newTab({ connectionId: s.id }) }))];
  if (connectionsOnly) return [{ name: t("Local terminal"), icon: 'terminal', run: () => newTab() }, { name: 'Codex', icon: 'spark', run: () => newTab({ codex: true }) }, { name: t('Resume Codex'), icon: 'spark', run: () => newTab({ codex: true, resume: true }) }, ...connectionActions, { name: t("Add a new server"), icon: 'plus', run: () => openServer() }];
  if (projectFilter) return [...projectActions, { name: t("Add a new project"), icon: 'plus', run: () => openProject() }];
  return [
    ...['new', 'codex', 'newWindow', 'split', 'splitVertical', 'projects', 'addProject', 'rename', 'close', 'closeTab', 'sidebar', 'settings'].map(id => ({ name: t(shortcutMap[id]?.label || id), icon: id === 'codex' ? 'spark' : id === 'newWindow' ? 'external' : id.toLowerCase().includes('project') ? 'folder' : id.startsWith('split') ? 'split' : 'terminal', key: shortcutMap[id]?.key, run: () => handleAction(id) })),
    ...projectActions,
    ...savedConnections.map(s => ({ name: s.name + ' · ' + s.source, icon: 'server', run: () => newTab({ connectionId: s.id }) })),
    { name: t("Add server"), icon: 'server', run: () => openServer() },
    ...config.servers.map(s => ({ name: `${s.name} · SSH`, icon: 'server', run: () => newTab({ serverId: s.id }) })),
    ...config.servers.map(s => ({ name: `${s.name} · SSH Codex`, icon: 'remoteCodex', run: () => newTab({ serverId: s.id, codex: true }) })),
    { name: t('Resume Codex'), icon: 'spark', run: () => newTab({ codex: true, resume: true }) },
    { name: t("Effect settings"), icon: 'spark', run: openAtmosphere },
    { name: t("Edit config.json"), icon: 'code', run: () => api.editConfig() },
    { name: t("Import SSH config"), icon: 'download', run: importSSH },
    { name: t("Clear terminal"), icon: 'terminal', run: () => activePane()?.term.clear() },
  ];
}
function renderPalette() {
  const query = $('#palette-input').value.toLocaleLowerCase();
  paletteItems = actions().filter(a => a.name.toLocaleLowerCase().includes(query)); paletteIndex = Math.min(paletteIndex, Math.max(0, paletteItems.length - 1));
  const results = $('#palette-results'); results.replaceChildren();
  paletteItems.forEach((item, index) => {
    const el = button('', `palette-result${index === paletteIndex ? ' selected' : ''}`, () => { $('#palette-dialog').close(); run(item.run); });
    const symbol = document.createElement('span'); symbol.innerHTML = icon(item.icon); const name = document.createElement('span'); name.textContent = item.name; const key = document.createElement('kbd'); key.textContent = item.key || '';
    el.append(symbol, name, key); results.append(el);
  });
  if (!paletteItems.length) { const p = document.createElement('p'); p.textContent = t("No matching commands."); p.style.padding = '20px'; results.append(p); }
}
function openPalette(projectsOnly = false) { connectionsOnly = false; projectFilter = projectsOnly; $('#palette-input').placeholder = projectsOnly ? t("Choose a project…") : t("Search commands or servers…"); $('#palette-input').value = ''; paletteIndex = 0; renderPalette(); openDialog('#palette-dialog'); $('#palette-input').focus(); }
async function importSSH() {
  const aliases = await api.importSSH(); const existing = new Set(config.servers.map(s => s.host)); const added = aliases.filter(s => !existing.has(s.host));
  config.servers.push(...added); config = await api.save(config); renderServers(); notify(added.length ? t('Imported {count} SSH profiles.', { count: added.length }) : t("No new SSH aliases found. Check ~/.ssh/config."));
}
function openAtmosphere() { if (!$('#settings-dialog').open) openDialog('#settings-dialog'); requestAnimationFrame(() => $('#atmosphere-settings').scrollIntoView({ block: 'start' })); }
function handleAction(name) {
  const handlers = {
    new: () => newTab(), connections: openConnections, codex: () => newTab({ codex: true }), split: () => split('horizontal'), splitVertical: () => split('vertical'),
    close: () => workspace.endPane(activePane()?.id), closeTab: () => activeTab() && workspace.endTab(activeTab()), settings: () => openDialog('#settings-dialog'), palette: () => openPalette(false),
    projects: () => openPalette(true), addProject: () => openProject(), newWindow: () => workspace.newWindow(),
    paneLeft: () => workspace.movePane('left'), paneRight: () => workspace.movePane('right'), paneUp: () => workspace.movePane('up'), paneDown: () => workspace.movePane('down'),
    previousTabBracket: () => workspace.cycleTab(-1), nextTabBracket: () => workspace.cycleTab(1),
    ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => ['tab' + (i + 1), () => workspace.selectTabAt(i)])),
    next: () => workspace.cycleTab(1), previous: () => workspace.cycleTab(-1), nextPane: () => workspace.cyclePane(1), previousPane: () => workspace.cyclePane(-1),
    nextProject: () => workspace.cycleProject(1), previousProject: () => workspace.cycleProject(-1), rename: () => openRename(activeTab()), find,
    focusMode: () => setFocusMode(!focusMode), exitFocus: () => setFocusMode(false), effects: () => { config.appearance.effects = !config.appearance.effects; applyAppearance(); save(); },
    sidebar: () => { config.appearance.sidebar = !config.appearance.sidebar; applyAppearance(); save(); },
    fontUp: () => { config.appearance.fontSize = Math.min(28, config.appearance.fontSize + 1); applyAppearance(); save(); },
    fontDown: () => { config.appearance.fontSize = Math.max(10, config.appearance.fontSize - 1); applyAppearance(); save(); }
  };
  if (handlers[name]) run(handlers[name]);
}
api.onError(notify);
api.onAction(handleAction);
api.onConfig(value => { if (saving) return; const changed = config?.language !== value.language; config = value; if (changed) localizeUI(); else renderThemes(); applyAppearance(); renderServers(); renderFontOptions(); });
api.onWallpaper(url => { wallpaperUrl = url; applyAppearance(); });
document.querySelectorAll('.close-dialog').forEach(el => el.onclick = () => el.closest('dialog').close());
document.querySelectorAll('dialog').forEach(dialog => { dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } }); dialog.addEventListener('close', updateFocus); });
$('#new-local').onclick = $('#add-tab').onclick = openConnections;
$('#new-codex').onclick = () => run(() => newTab({ codex: true }));
$('#split-button').onclick = () => run(() => split('horizontal'));
$('#split-vertical-button').onclick = () => run(() => split('vertical'));
$('#sidebar-button').onclick = () => handleAction('sidebar');
$('#home-button').onclick = () => run(async () => { await workspace.save(); workspace.initial.savedWindows = (await api.init()).savedWindows; workspace.showHome(); });
$('#focus-mode-button').onclick = $('#settings-focus-mode').onclick = () => handleAction('focusMode');
$('#effects-button').onclick = () => handleAction('effects');
$('#effects-button').oncontextmenu = event => { event.preventDefault(); openAtmosphere(); };
$('#effect-style').onchange = event => { config.appearance.effectStyle = event.target.value; applyAppearance(); save(); };
$('#effect-intensity').oninput = event => { config.appearance.effectIntensity = Number(event.target.value) / 100; applyAppearance(); save(); };
for (const [selector, key] of [['#effect-speed','effectSpeed'],['#effect-size','effectSize']]) $(selector).oninput = event => { config.appearance[key] = Number(event.target.value) / 100; applyAppearance(); save(); };
$('#effect-count').oninput = event => { config.appearance.effectTrailCount = Number(event.target.value); applyAppearance(); save(); };
$('#startup-home').onchange = event => { config.startupHome = event.target.checked; save(); };
for (const [selector, key] of [['#effects-toggle','effects'],['#typing-effects','typingEffects'],['#ambient-effects','ambientEffects']]) $(selector).onchange = event => { config.appearance[key] = event.target.checked; applyAppearance(); save(); };
$('#new-window').onclick = () => run(() => workspace.newWindow());
$('#add-project').onclick = () => openProject();
$('#settings-button').onclick = () => openDialog('#settings-dialog');
$('#palette-button').onclick = () => openPalette(false);
$('#add-server').onclick = () => openServer();
$('#edit-config').onclick = $('#settings-edit-config').onclick = () => run(() => api.editConfig());
$('#import-ssh').onclick = () => run(importSSH);
$('#choose-folder').onclick = () => openPalette(true);
$('#choose-wallpaper').onclick = () => run(async () => { const chosen = await api.chooseWallpaper(); if (chosen) { wallpaperUrl = chosen; config.appearance.wallpaper = true; applyAppearance(); save(); } });
$('#choose-key').onclick = () => run(async () => { const chosen = await api.chooseIdentity(); if (chosen) $('#server-form').elements.identity.value = chosen; });
$('#server-form').onsubmit = event => { event.preventDefault(); run(async () => {
  const values = Object.fromEntries(new FormData(event.target));
  if (!values.host || values.host.startsWith('-') || /\s/.test(values.host)) { $('#server-error').textContent = t("Enter an IP address, hostname or SSH alias."); return; }
  const previous = config.servers.find(s => s.id === editingServerId);
  const server = { ...values, persistent: event.target.elements.persistent.checked, autoReconnect: event.target.elements.autoReconnect.checked, id: editingServerId || crypto.randomUUID(), port: Number(values.port), color: previous?.color || 'blue' };
  const next = { ...config, servers: previous ? config.servers.map(s => s.id === editingServerId ? server : s) : [...config.servers, server] };
  config = await api.save(next); renderServers(); $('#server-dialog').close(); notify(t("Server profile saved."));
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
installThemeEditor({
  getConfig: () => config, fontOptions: allFontOptions, notify,
  onSave: async value => {
    clearTimeout(saving); saving = -1;
    try { config = await api.save(value); } finally { saving = null; }
    renderThemes(); renderFontOptions(); applyAppearance();
  }
});
$('#language').onchange = event => { config.language = event.target.value; localizeUI(); applyAppearance(); save(); };
$('#import-font').onclick = () => run(async () => {
  const imported = await api.importFonts(); if (!imported.length) return;
  await loadLocalFonts((await api.init()).localFonts || []);
  config.appearance.fontFamily = imported[0].fontFamily;
  renderFontOptions(); applyAppearance(); save();
});
api.onFonts(fonts => run(async () => { await loadLocalFonts(fonts); renderFontOptions(); applyAppearance(); }));
let wheelDelta = 0, wheelTime = 0;
$('#terminal-area').addEventListener('wheel', event => {
  if (!(platform === 'darwin' ? event.metaKey : event.ctrlKey) || !event.deltaY) return;
  event.preventDefault(); event.stopPropagation();
  const now = performance.now(); if (now - wheelTime > 180 || Math.sign(wheelDelta) !== Math.sign(event.deltaY)) wheelDelta = 0;
  wheelTime = now; wheelDelta += event.deltaY * (event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? 100 : 1);
  if (Math.abs(wheelDelta) >= 20) { handleAction(wheelDelta < 0 ? 'fontUp' : 'fontDown'); wheelDelta = 0; }
}, { capture: true, passive: false });
$('#font-family').onchange = event => { config.appearance.fontFamily = event.target.value; applyAppearance(); save(); };
$('#project-choose-folder').onclick = () => run(async () => { const cwd = await api.chooseDirectory(); if (!cwd) return; const form = $('#project-form'); form.elements.cwd.value = cwd; if (!form.elements.name.value) form.elements.name.value = cwd.split(/[\\/]/).filter(Boolean).pop(); });
$('#project-form').onsubmit = event => { event.preventDefault(); run(async () => { const form = event.target; const project = await api.saveProject({ id: editingProjectId, name: form.elements.name.value, cwd: form.elements.cwd.value }); $('#project-dialog').close(); await workspace.selectProject(project.id); }); };
$('#rename-form').onsubmit = event => { event.preventDefault(); if (renamingTab) workspace.renameTab(renamingTab, $('#rename-name').value); $('#rename-dialog').close(); };
run(async () => {
  const initial = await api.init(); config = initial.config; home = initial.home; wallpaperUrl = initial.wallpaper; platform = initial.platform;
  if (initial.testing) window.__orbitEffectsFrame = offset => effects.draw(performance.now() + offset);
  document.documentElement.dataset.platform = platform;
  shortcutMap = Object.fromEntries(initial.shortcuts.map(s => [s.id, s]));
  await loadLocalFonts(initial.localFonts || []);
  const shortcutGrid = $('.shortcut-grid'); shortcutGrid.replaceChildren();
  for (const item of initial.shortcuts) { const name = document.createElement('span'); name.textContent = item.label; const key = document.createElement('kbd'); key.textContent = item.key; shortcutGrid.append(name, key); }
  $('#new-local kbd').textContent = shortcutMap.connections.key;
  $('#new-local>span:nth-child(2)').textContent = t("New session");
  $('#palette-button kbd').textContent = shortcutMap.palette.key;
  for (const [selector, action] of [['#add-tab','new'],['#split-button','split'],['#split-vertical-button','splitVertical'],['#new-window','newWindow'],['#choose-folder','projects']]) $(selector).title += ' · ' + shortcutMap[action].key;
  localizeUI();
  workspace = new WorkspaceUI({ api, initial, icon, appearance, theme: terminalTheme, notify, openProject, openRename, onTyping: position => effects.emit(position) });
  applyAppearance(); await workspace.init(); run(refreshConnections);
});
