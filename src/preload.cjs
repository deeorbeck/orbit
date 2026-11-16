const { contextBridge, ipcRenderer } = require('electron');
const subscribe = (channel, callback) => {
  const listener = (_event, value) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};
contextBridge.exposeInMainWorld('orbit', {
  init: () => ipcRenderer.invoke('app:init'),
  create: (options) => ipcRenderer.invoke('terminal:create', options),
  attach: id => ipcRenderer.invoke('terminal:attach', id),
  cwd: id => ipcRenderer.invoke('terminal:cwd', id),
  restart: id => ipcRenderer.invoke('terminal:restart', id),
  cancelRetry: id => ipcRenderer.invoke('terminal:cancelRetry', id),
  newWindow: projectId => ipcRenderer.invoke('window:new', projectId),
  saveWorkspace: value => ipcRenderer.invoke('workspace:save', value),
  saveProject: value => ipcRenderer.invoke('project:save', value),
  connections: () => ipcRenderer.invoke('connection:list'),
  write: (id, data) => ipcRenderer.send('terminal:write', { id, data }),
  resize: (id, cols, rows) => ipcRenderer.send('terminal:resize', { id, cols, rows }),
  close: (id) => ipcRenderer.invoke('terminal:close', id),
  save: (config) => ipcRenderer.invoke('config:save', config),
  editConfig: () => ipcRenderer.invoke('config:open'),
  chooseDirectory: () => ipcRenderer.invoke('dialog:directory'),
  chooseIdentity: () => ipcRenderer.invoke('dialog:identity'),
  chooseWallpaper: () => ipcRenderer.invoke('dialog:wallpaper'),
  importSSH: () => ipcRenderer.invoke('ssh:import'),
  onData: (callback) => subscribe('terminal:data', callback),
  onExit: (callback) => subscribe('terminal:exit', callback),
  onCwd: callback => subscribe('terminal:cwd', callback),
  onStatus: callback => subscribe('terminal:status', callback),
  onRemoved: callback => subscribe('terminal:removed', callback),
  onProjects: callback => subscribe('projects:changed', callback),
  onWallpaper: callback => subscribe('wallpaper:changed', callback),
  onConfig: (callback) => subscribe('config:changed', callback),
  onAction: (callback) => subscribe('app:action', callback),
  onError: (callback) => subscribe('app:error', callback),
});
