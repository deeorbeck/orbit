const { app, BrowserWindow, ipcMain, Menu, dialog, shell, protocol, net } = require('electron');
const pty = require('node-pty');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { defaults, normalize, sshArgs, saveConfig, remoteSessionCommand } = require('./config.cjs');
const { shellArgs, sshExecutable, terminalEnv } = require('./platform.cjs');

app.setName('Orbit Terminal');
app.setPath('userData', process.env.ORBIT_TEST_DATA || path.join(app.getPath('appData'), 'Orbit Terminal'));
protocol.registerSchemesAsPrivileged([{ scheme: 'orbit', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
let win, config, configFile, wallpaperFile, watcher;
const sessions = new Map();
const action = (name) => win?.webContents.send('app:action', name);
function readConfig() {
  if (!fs.existsSync(configFile)) return saveConfig(configFile, defaults);
  return normalize(JSON.parse(fs.readFileSync(configFile, 'utf8')));
}
function safeHandle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (event.sender !== win?.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('Unknown sender');
    return fn(...args);
  });
}
function buildWindow() {
  const chrome = process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 20 } } : {};
  win = new BrowserWindow({ width: 1320, height: 860, minWidth: 740, minHeight: 480, title: 'Orbit Terminal', backgroundColor: '#111519', icon: path.join(__dirname, '..', 'assets', 'orbit.png'), ...chrome, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.loadFile(path.join(__dirname, 'index.html'));
  if (process.env.ORBIT_SMOKE_TEST === '1') require('./smoke.cjs')(win, app);
  win.on('close', (event) => {
    if (!sessions.size || process.env.ORBIT_TEST_DATA) return;
    const result = dialog.showMessageBoxSync(win, { type: 'question', buttons: ['Cancel', 'Close sessions'], defaultId: 0, cancelId: 0, message: `Close ${sessions.size} terminal session${sessions.size > 1 ? 's' : ''}?`, detail: 'Running commands and SSH connections will be stopped.' });
    if (result === 0) event.preventDefault();
  });
  win.on('closed', () => { for (const s of sessions.values()) s.kill(); sessions.clear(); win = null; });
}
app.whenReady().then(() => {
  configFile = path.join(app.getPath('userData'), 'config.json');
  wallpaperFile = path.join(app.getPath('userData'), 'wallpaper');
  try { config = readConfig(); } catch (error) {
    const backup = `${configFile}.invalid-${Date.now()}`;
    fs.copyFileSync(configFile, backup);
    config = saveConfig(configFile, defaults);
    dialog.showErrorBox('Orbit config needs attention', `${error.message}\nOriginal saved at ${backup}`);
  }
  if (!fs.existsSync(wallpaperFile)) fs.copyFileSync(path.join(__dirname, '..', 'assets', 'wallpaper.svg'), wallpaperFile);
  protocol.handle('orbit', (request) => {
    if (!request.url.startsWith('orbit://wallpaper/')) return new Response('Not found', { status: 404 });
    const bytes = fs.readFileSync(wallpaperFile);
    if (bytes.subarray(0, 512).toString().includes('<svg')) return new Response(bytes, { headers: { 'Content-Type': 'image/svg+xml' } });
    return net.fetch(pathToFileURL(wallpaperFile).href);
  });
  safeHandle('app:init', () => ({ config, home: os.homedir(), configFile, platform: process.platform, wallpaper: 'orbit://wallpaper/image', version: app.getVersion() }));
  safeHandle('terminal:create', (options = {}) => {
    if (sessions.size >= 24) throw new Error('Close a session before opening more (limit: 24).');
    const id = randomUUID();
    let executable, args, label, persistent = false, sessionName = null, autoReconnect = false;
    const cwd = typeof options.cwd === 'string' ? options.cwd : config.startingDirectory;
    if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) throw new Error(`Folder does not exist: ${cwd}`);
    if (options.serverId) {
      const server = config.servers.find(s => s.id === options.serverId);
      if (!server) throw new Error('Server profile was removed.');
      executable = sshExecutable(); args = sshArgs(server); label = server.name;
      const command = remoteSessionCommand(server, options.codex ? config.codexCommand : null);
      if (command) args.push(command);
      persistent = server.persistent;
      autoReconnect = server.autoReconnect;
      sessionName = persistent ? server.sessionName + (options.codex ? '-codex' : '') : null;
      if (options.codex) label = `Codex · ${server.name}`;
    } else {
      executable = config.shell;
      if (!path.isAbsolute(executable) || !fs.existsSync(executable)) throw new Error('Choose a valid absolute shell path in config.json.');
      args = shellArgs(executable, options.codex ? config.codexCommand : null); label = options.codex ? 'Codex' : 'Local';
    }
    const environment = terminalEnv(app.getVersion());
    const session = pty.spawn(executable, args, { name: 'xterm-256color', cols: 100, rows: 30, cwd, env: environment });
    sessions.set(id, session);
    session.onData(data => win?.webContents.send('terminal:data', { id, data }));
    session.onExit(({ exitCode, signal }) => { sessions.delete(id); win?.webContents.send('terminal:exit', { id, exitCode, signal }); });
    return { id, label, cwd, persistent, sessionName, autoReconnect, serverId: options.serverId || null };
  });
  ipcMain.on('terminal:write', (event, { id, data } = {}) => {
    if (event.sender === win?.webContents && typeof data === 'string' && data.length < 2_000_000) sessions.get(id)?.write(data);
  });
  ipcMain.on('terminal:resize', (event, { id, cols, rows } = {}) => {
    if (event.sender === win?.webContents && Number.isInteger(cols) && Number.isInteger(rows) && cols > 0 && cols <= 1000 && rows > 0 && rows <= 1000) {
      try { sessions.get(id)?.resize(cols, rows); } catch {}
    }
  });
  safeHandle('terminal:close', id => { sessions.get(id)?.kill(); sessions.delete(id); });
  safeHandle('config:save', value => { config = saveConfig(configFile, value); win.webContents.send('config:changed', config); return config; });
  safeHandle('config:open', async () => { const error = await shell.openPath(configFile); if (error) throw new Error(error); });
  safeHandle('dialog:directory', async () => (await dialog.showOpenDialog(win, { properties: ['openDirectory'], defaultPath: config.startingDirectory })).filePaths[0] || null);
  safeHandle('dialog:identity', async () => (await dialog.showOpenDialog(win, { title: 'Choose SSH private key', defaultPath: path.join(os.homedir(), '.ssh'), properties: ['openFile', 'showHiddenFiles'] })).filePaths[0] || null);
  safeHandle('dialog:wallpaper', async () => {
    const result = await dialog.showOpenDialog(win, { title: 'Choose wallpaper', properties: ['openFile'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] });
    if (result.canceled) return null;
    if (fs.statSync(result.filePaths[0]).size > 30 * 1024 * 1024) throw new Error('Choose an image smaller than 30 MB.');
    fs.copyFileSync(result.filePaths[0], wallpaperFile);
    return `orbit://wallpaper/image?v=${Date.now()}`;
  });
  safeHandle('ssh:import', () => {
    const file = path.join(os.homedir(), '.ssh', 'config');
    if (!fs.existsSync(file)) return [];
    const aliases = [];
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const match = line.match(/^\s*Host\s+([^#]+)/i);
      if (match) for (const host of match[1].trim().split(/\s+/)) {
        if (!/[!*?]/.test(host) && !host.startsWith('-')) aliases.push({ id: randomUUID(), name: host, host, user: '', port: 22, identity: '', color: 'blue' });
      }
    }
    return aliases;
  });
  let debounce;
  watcher = fs.watch(path.dirname(configFile), (_event, filename) => {
    if (String(filename) !== 'config.json') return;
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      try { config = readConfig(); win?.webContents.send('config:changed', config); }
      catch (error) { win?.webContents.send('app:error', `Config not loaded: ${error.message}. Fix config.json to apply your edits.`); }
    }, 200);
  });
  const shortcut = key => process.platform === 'darwin' ? `Cmd+${key}` : `Ctrl+Shift+${key}`;
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Orbit Terminal', submenu: [{ role: 'about' }, { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => action('settings') }, { type: 'separator' }, ...(process.platform === 'darwin' ? [{ role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }] : []), { role: 'quit' }] },
    { label: 'Session', submenu: [
      { label: 'New tab', accelerator: shortcut('T'), click: () => action('new') },
      { label: 'New Codex tab', accelerator: 'CmdOrCtrl+Shift+N', click: () => action('codex') },
      { label: 'Split pane', accelerator: shortcut('D'), click: () => action('split') },
      { label: 'Close pane', accelerator: shortcut('W'), click: () => action('close') },
      { label: 'Next tab', accelerator: 'Ctrl+Tab', click: () => action('next') },
      { label: 'Previous tab', accelerator: 'Ctrl+Shift+Tab', click: () => action('previous') }
    ] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut', accelerator: shortcut('X') }, { role: 'copy', accelerator: shortcut('C') }, { role: 'paste', accelerator: shortcut('V') }, { role: 'selectAll', accelerator: shortcut('A') }, { type: 'separator' }, { label: 'Find in terminal', accelerator: shortcut('F'), click: () => action('find') }] },
    { label: 'View', submenu: [{ label: 'Command palette', accelerator: shortcut('K'), click: () => action('palette') }, { label: 'Toggle sidebar', accelerator: shortcut('B'), click: () => action('sidebar') }, { role: 'togglefullscreen' }, { type: 'separator' }, { label: 'Increase font', accelerator: 'CmdOrCtrl+=', click: () => action('fontUp') }, { label: 'Decrease font', accelerator: 'CmdOrCtrl+-', click: () => action('fontDown') }] },
    { role: 'windowMenu' }
  ]));
  buildWindow();
  app.on('activate', () => { if (!win) buildWindow(); });
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => watcher?.close());
