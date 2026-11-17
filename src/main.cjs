const { listFonts, importFonts, fontDirectory } = require('./local-fonts.cjs');
const { inputAction } = require('./input-shortcuts.cjs');
const { translate } = require('./i18n.cjs');
const tr = (message, values) => translate(config?.language, message, values);
const { app, BrowserWindow, ipcMain, Menu, dialog, shell, protocol, net, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { defaults, normalize, saveConfig } = require('./config.cjs');
const { SessionClient } = require('./session-client.cjs');
const { WorkspaceStore } = require('./workspaces.cjs');
const { shortcuts } = require('./shortcuts.cjs');
const { connectionCatalog } = require('./connections.cjs');

app.setName('Orbit Terminal');
app.setPath('userData', process.env.ORBIT_TEST_DATA || path.join(app.getPath('appData'), 'Orbit Terminal'));
protocol.registerSchemesAsPrivileged([{ scheme: 'orbit', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
const windows = new Map();
const subscriptions = new Map();
let config, configFile, wallpaperFile, watcher, backend, workspaces;
let smokeStarted = false;
let catalog = [], catalogAt = 0;
async function refreshCatalog() { if (Date.now() - catalogAt < 30000) return catalog; catalog = await connectionCatalog(config); catalogAt = Date.now(); return catalog; }
const broadcast = (channel, data) => { for (const win of windows.values()) if (!win.isDestroyed()) win.webContents.send(channel, data); };
const activeWindow = () => BrowserWindow.getFocusedWindow() || [...windows.values()][0];
const windowId = win => [...windows].find(([, item]) => item === win)?.[0];
const action = name => activeWindow()?.webContents.send('app:action', name);
function readConfig() { return fs.existsSync(configFile) ? normalize(JSON.parse(fs.readFileSync(configFile, 'utf8'))) : saveConfig(configFile, defaults); }
function safeHandle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!windowId(win)) { if (channel === 'workspace:save') return null; throw new Error('Unknown sender'); }
    if (event.senderFrame !== win.webContents.mainFrame) throw new Error('Unknown sender');
    return fn(win, ...args);
  });
}
function buildWindow(state) {
  const chrome = process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 20 } } : {};
  const bounds = state.bounds || {};
  const positionValid = Number.isFinite(bounds.x) && Number.isFinite(bounds.y) && screen.getAllDisplays().some(d => bounds.x >= d.bounds.x - 100 && bounds.x < d.bounds.x + d.bounds.width && bounds.y >= d.bounds.y - 50 && bounds.y < d.bounds.y + d.bounds.height);
  const win = new BrowserWindow({ ...(process.env.ORBIT_SMOKE_BACKGROUND ? { show: false } : {}), width: Math.max(740, Math.min(2400, bounds.width || 1320)), height: Math.max(480, Math.min(1600, bounds.height || 860)), ...(positionValid ? { x: bounds.x, y: bounds.y } : {}), minWidth: 740, minHeight: 480, title: 'Orbit Terminal', backgroundColor: '#111519', icon: path.join(__dirname, '..', 'assets', 'orbit.png'), ...chrome, webPreferences: { ...(process.env.ORBIT_SMOKE_BACKGROUND ? { backgroundThrottling: false } : {}), preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false } });
  windows.set(state.id, win);
  if (process.env.ORBIT_SMOKE_TEST) win.webContents.on('console-message', details => { if (details.level === 'error') console.log('ORBIT_RENDERER:', details.message); });
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' && input.type !== 'keyUp') return;
    const name = inputAction({ ...input, type: 'keyDown' });
    if (!name) return;
    event.preventDefault();
    if (process.env.ORBIT_SMOKE_TEST) console.log('ORBIT_INPUT_ACTION:', name, JSON.stringify({ key: input.key, shift: input.shift, type: input.type }));
    if (input.type === 'keyDown' && !(input.isAutoRepeat && name.startsWith('close'))) {
      if (name === 'closeWindow') win.close();
      else win.webContents.send('app:action', name);
    }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.loadFile(path.join(__dirname, 'index.html'));
  if (process.env.ORBIT_SMOKE_TEST === '1' && !smokeStarted) { smokeStarted = true; require('./smoke.cjs')(win, app); }
  let closing = false;
  win.on('close', event => {
    if (closing) return;
    event.preventDefault(); closing = true;
    const bounds = win.getBounds();
    Promise.race([win.webContents.executeJavaScript('window.__orbitWorkspaceSnapshot?.()'), new Promise(resolve => setTimeout(() => resolve(null), 1500))]).then(snapshot => {
      if (snapshot) workspaces.saveWindow(state.id, { ...snapshot, bounds });
      else workspaces.saveWindow(state.id, { bounds });
    }).catch(() => {}).finally(() => { if (!win.isDestroyed()) win.destroy(); });
  });
  win.on('closed', () => {
    windows.delete(state.id);
    const ids = [...(subscriptions.get(state.id) || [])]; subscriptions.delete(state.id);
    const remaining = new Set([...subscriptions.values()].flatMap(ids => [...ids]));
    backend?.request('detach', { ids: ids.filter(id => !remaining.has(id)) }).catch(() => {});
  });
  return win;
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const win = activeWindow(); if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(async () => {
    configFile = path.join(app.getPath('userData'), 'config.json'); wallpaperFile = path.join(app.getPath('userData'), 'wallpaper');
    try { config = readConfig(); } catch (error) {
      const backup = `${configFile}.invalid-${Date.now()}`; fs.copyFileSync(configFile, backup);
      config = saveConfig(configFile, defaults); dialog.showErrorBox('Orbit config needs attention', `${error.message}\nOriginal saved at ${backup}`);
    }
    workspaces = new WorkspaceStore(path.join(app.getPath('userData'), 'workspaces.json'), config.startingDirectory);
    backend = new SessionClient(app.getPath('userData')); await backend.start();
    for (const [event, channel] of [['data', 'terminal:data'], ['exit', 'terminal:exit'], ['cwd', 'terminal:cwd'], ['status', 'terminal:status'], ['removed', 'terminal:removed']]) backend.on(event, data => broadcast(channel, data));
    backend.on('service-error', data => broadcast('app:error', data.message || data));
    backend.on('disconnected', () => broadcast('app:error', tr("Session service disconnected. Reopen Orbit to check your sessions.")));
    if (!fs.existsSync(wallpaperFile)) fs.copyFileSync(path.join(__dirname, '..', 'assets', 'wallpaper.svg'), wallpaperFile);
    protocol.handle('orbit', request => {
      if (request.url.startsWith('orbit://font/')) {
        const file = decodeURIComponent(new URL(request.url).pathname.slice(1));
        if (!listFonts(app.getPath('userData')).some(font => font.file === file)) return new Response('Not found', { status: 404 });
        return new Response(fs.readFileSync(path.join(fontDirectory(app.getPath('userData')), file)), { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'font/' + path.extname(file).slice(1).toLowerCase() } });
      }
      if (!request.url.startsWith('orbit://wallpaper/')) return new Response('Not found', { status: 404 });
      const bytes = fs.readFileSync(wallpaperFile);
      return bytes.subarray(0, 512).toString().includes('<svg') ? new Response(bytes, { headers: { 'Content-Type': 'image/svg+xml' } }) : net.fetch(pathToFileURL(wallpaperFile).href);
    });
    safeHandle('app:init', async win => ({ config, home: os.homedir(), configFile, platform: process.platform, wallpaper: 'orbit://wallpaper/image', localFonts: listFonts(app.getPath('userData')), version: app.getVersion(), projects: workspaces.state.projects, window: workspaces.window(windowId(win)), sessions: await backend.request('list'), shortcuts: shortcuts() }));
    safeHandle('window:new', (win, value) => {
      if (workspaces.state.windows.length >= 12) throw new Error(tr("Up to 12 Orbit windows can be saved. Use tabs and panes in an existing window."));
      const state = workspaces.newWindow(value?.projectId || workspaces.window(windowId(win)).activeProjectId);
      if (value?.cwd && path.isAbsolute(value.cwd) && fs.existsSync(value.cwd) && fs.statSync(value.cwd).isDirectory()) { state.initialCwd = value.cwd; workspaces.save(); }
      buildWindow(state); return state.id;
    });
    safeHandle('workspace:save', (win, value) => workspaces.saveWindow(windowId(win), value));
    safeHandle('project:save', (_win, value) => { const p = workspaces.upsertProject(value); broadcast('projects:changed', workspaces.state.projects); return p; });
    safeHandle('terminal:create', async (win, options = {}) => {
      const project = workspaces.project(options.projectId); if (!project) throw new Error(tr("Choose a project."));
      let cwd = options.cwd || project.cwd, sourceSession = null;
      if (options.inheritFrom) {
        const sessions = await backend.request('list'), source = sessions.find(s => s.id === options.inheritFrom);
        if (source?.projectId === project.id) sourceSession = source;
        if (source && !source.serverId && source.projectId === project.id) cwd = await backend.request('cwd', { id: source.id }) || cwd;
      }
      let sessionConfig = config, serverId = options.serverId || null, aliasName = null;
      if (options.connectionId) {
        const connection = (await refreshCatalog()).find(c => c.id === options.connectionId);
        if (!connection) throw new Error(tr("Connection not found. Refresh the alias list."));
        if (connection.kind === 'shell-alias') aliasName = connection.aliasName;
        else { serverId = connection.id; sessionConfig = normalize({ ...config, servers: [...config.servers, { id: serverId, name: connection.name, host: connection.host, port: 22, persistent: false, autoReconnect: false }] }); }
      }
      const sourceRemoteSession = sourceSession?.serverId === serverId ? sourceSession?.sessionName : null;
      return backend.request('create', { id: randomUUID(), options: { projectId: project.id, windowId: windowId(win), serverId, aliasName, sourceRemoteSession, codex: !!options.codex, cwd, config: sessionConfig } });
    });
    safeHandle('font:import', async win => {
      const result = await dialog.showOpenDialog(win, { title: 'Import terminal fonts', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Fonts', extensions: ['ttf', 'otf', 'woff', 'woff2'] }] });
      if (result.canceled) return [];
      const imported = importFonts(app.getPath('userData'), result.filePaths);
      broadcast('fonts:changed', listFonts(app.getPath('userData')));
      return imported;
    });
    safeHandle('connection:list', () => refreshCatalog());
    safeHandle('terminal:attach', (win, id) => {
      const key = windowId(win); if (!subscriptions.has(key)) subscriptions.set(key, new Set()); subscriptions.get(key).add(id);
      return backend.request('attach', { id });
    });
    safeHandle('terminal:cwd', (_win, id) => backend.request('cwd', { id }));
    safeHandle('terminal:restart', async (_win, id) => {
      const session = (await backend.request('list')).find(s => s.id === id);
      let sessionConfig = config;
      if (session?.serverId?.startsWith('ssh-config:')) {
        const connection = (await refreshCatalog()).find(c => c.id === session.serverId);
        if (connection) sessionConfig = normalize({ ...config, servers: [...config.servers, { id: connection.id, name: connection.name, host: connection.host, port: 22, persistent: false, autoReconnect: false }] });
      }
      return backend.request('restart', { id, config: sessionConfig });
    });
    safeHandle('terminal:cancelRetry', (_win, id) => backend.request('cancelRetry', { id }));
    safeHandle('terminal:close', async (win, ids) => {
      ids = Array.isArray(ids) ? ids : [ids];
      if (process.env.ORBIT_SMOKE_TEST) console.log('ORBIT_CLOSE_REQUEST:', JSON.stringify(ids));
      const living = (await backend.request('list')).filter(s => ids.includes(s.id) && ['running', 'reconnecting'].includes(s.status));
      if (living.length && !process.env.ORBIT_TEST_DATA) {
        const result = await dialog.showMessageBox(win, { type: 'question', buttons: [tr("Cancel"), tr("End session")], defaultId: 0, cancelId: 0, message: tr('End {count} sessions?', { count: living.length }), detail: tr("Local processes in these panes will stop. Closing only the window keeps sessions running.") });
        if (result.response === 0) return false;
      }
      for (const id of ids) await backend.request('close', { id }); return true;
    });
    for (const channel of ['terminal:write', 'terminal:resize']) ipcMain.on(channel, (event, value = {}) => {
      const win = BrowserWindow.fromWebContents(event.sender); if (!windowId(win)) return;
      backend.request(channel === 'terminal:write' ? 'write' : 'resize', value).catch(error => broadcast('app:error', error.message));
    });
    safeHandle('config:save', (_win, value) => { const previousLanguage = config.language; config = saveConfig(configFile, value); if (previousLanguage !== config.language) rebuildMenu(); broadcast('config:changed', config); return config; });
    safeHandle('config:open', async () => { const error = await shell.openPath(configFile); if (error) throw new Error(error); });
    safeHandle('dialog:directory', async win => (await dialog.showOpenDialog(win, { properties: ['openDirectory'], defaultPath: config.startingDirectory })).filePaths[0] || null);
    safeHandle('dialog:identity', async win => (await dialog.showOpenDialog(win, { title: 'Choose SSH private key', defaultPath: path.join(os.homedir(), '.ssh'), properties: ['openFile', 'showHiddenFiles'] })).filePaths[0] || null);
    safeHandle('dialog:wallpaper', async win => {
      const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] });
      if (result.canceled) return null;
      if (fs.statSync(result.filePaths[0]).size > 30 * 1024 * 1024) throw new Error('Choose an image smaller than 30 MB.');
      fs.copyFileSync(result.filePaths[0], wallpaperFile); const url = `orbit://wallpaper/image?v=${Date.now()}`; broadcast('wallpaper:changed', url); return url;
    });
    safeHandle('ssh:import', () => {
      const file = path.join(os.homedir(), '.ssh', 'config'); if (!fs.existsSync(file)) return [];
      const aliases = [];
      for (const line of fs.readFileSync(file, 'utf8').split('\n')) { const match = line.match(/^\s*Host\s+([^#]+)/i); if (match) for (const host of match[1].trim().split(/\s+/)) if (!/[!*?]/.test(host) && !host.startsWith('-')) aliases.push({ id: randomUUID(), name: host, host, user: '', port: 22, identity: '', color: 'blue' }); }
      return aliases;
    });
    let debounce;
    watcher = fs.watch(path.dirname(configFile), (_event, filename) => { if (String(filename) !== 'config.json') return; clearTimeout(debounce); debounce = setTimeout(() => { try { const previousLanguage = config.language; config = readConfig(); if (previousLanguage !== config.language) rebuildMenu(); broadcast('config:changed', config); } catch (error) { broadcast('app:error', `Config not loaded: ${error.message}`); } }, 200); });
    const binding = id => shortcuts().find(s => s.id === id);
    const inputManaged = new Set(['next', 'previous', 'close', 'closeTab', 'closeWindow']);
    const entry = id => ({ label: tr(binding(id).label) + (inputManaged.has(id) ? ' · ' + binding(id).key : ''), accelerator: inputManaged.has(id) ? undefined : binding(id).accelerator, click: () => id === 'closeWindow' ? activeWindow()?.close() : action(id) });
    const rebuildMenu = () => Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'Orbit Terminal', submenu: [{ role: 'about' }, entry('settings'), { type: 'separator' }, ...(process.platform === 'darwin' ? [{ role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }] : []), { label: tr("Quit Orbit · keep sessions"), accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }, { label: tr("End all sessions and quit…"), click: async () => { const result = await dialog.showMessageBox(activeWindow(), { type: 'warning', buttons: [tr("Cancel"), tr("End all sessions")], defaultId: 0, cancelId: 0, message: tr("End all local sessions?"), detail: tr("Local processes and SSH connections will stop. Remote tmux jobs may continue independently.") }); if (result.response === 1) { await backend.request('shutdown'); app.quit(); } } }] },
      { label: tr('Project'), submenu: ['projects', 'addProject', 'nextProject', 'previousProject', 'newWindow'].map(entry) },
      { label: tr('Session'), submenu: ['new', 'connections', 'codex', 'split', 'splitVertical', 'nextPane', 'previousPane', 'paneLeft', 'paneRight', 'paneUp', 'paneDown', 'next', 'previous', 'previousTabBracket', 'nextTabBracket', ...Array.from({ length: 9 }, (_, i) => 'tab' + (i + 1)), 'rename', 'close', 'closeTab', 'closeWindow'].map(entry) },
      { label: tr('Edit'), submenu: [{ role: 'undo', accelerator: process.platform === 'darwin' ? 'Cmd+Z' : 'Ctrl+Alt+Z' }, { role: 'redo', accelerator: process.platform === 'darwin' ? 'Cmd+Shift+Z' : 'Ctrl+Alt+Shift+Z' }, ...['cut', 'copy', 'paste', 'selectAll'].map((role, i) => ({ role, accelerator: `${process.platform === 'darwin' ? 'Cmd' : 'Ctrl+Shift'}+${['X', 'C', 'V', 'A'][i]}` })), entry('find')] },
      { label: tr('View'), submenu: [entry('palette'), entry('sidebar'), { role: 'togglefullscreen' }, { label: tr('Increase font'), accelerator: 'CmdOrCtrl+=', click: () => action('fontUp') }, { label: tr('Decrease font'), accelerator: 'CmdOrCtrl+-', click: () => action('fontDown') }] },
      { role: 'windowMenu' }
    ]));
    rebuildMenu();
    if (!workspaces.state.windows.length) workspaces.newWindow();
    for (const state of workspaces.state.windows.slice(0, 12)) buildWindow(state);
    app.on('activate', () => { if (!windows.size) buildWindow(workspaces.state.windows[0] || workspaces.newWindow()); });
  }).catch(error => { dialog.showErrorBox('Orbit could not start', error.message); app.exit(1); });
}
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { watcher?.close(); backend?.disconnect(); });
