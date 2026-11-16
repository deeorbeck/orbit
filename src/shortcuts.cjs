const definitions = [
  ['new', "New terminal", 'Cmd+T', 'Ctrl+Shift+T'],
  ['connections', "Choose terminal or server", 'Cmd+Shift+T', 'Ctrl+Alt+T'],
  ['codex', "New Codex", 'Cmd+Shift+N', 'Ctrl+Alt+C'],
  ['newWindow', "New Orbit window", 'Cmd+N', 'Ctrl+Shift+N'],
  ['projects', "Choose project", 'Cmd+P', 'Ctrl+Shift+P'],
  ['addProject', "Add project", 'Cmd+Alt+P', 'Ctrl+Alt+P'],
  ['split', "Split side by side", 'Cmd+D', 'Ctrl+Shift+D'],
  ['splitVertical', "Split top and bottom", 'Cmd+Shift+D', 'Ctrl+Alt+D'],
  ['nextPane', "Next pane", 'Cmd+Alt+Right', 'Ctrl+Alt+Right'],
  ['previousPane', "Previous pane", 'Cmd+Alt+Left', 'Ctrl+Alt+Left'],
  ['close', "End session", 'Cmd+W', 'Ctrl+Shift+W'],
  ['closeWindow', "Close window · keep sessions", 'Cmd+Shift+W', 'Ctrl+Alt+W'],
  ['next', "Next tab", 'Ctrl+Tab', 'Ctrl+Tab'],
  ['previous', "Previous tab", 'Ctrl+Shift+Tab', 'Ctrl+Shift+Tab'],
  ['nextProject', "Next project", 'Cmd+Alt+Down', 'Ctrl+Alt+Down'],
  ['previousProject', "Previous project", 'Cmd+Alt+Up', 'Ctrl+Alt+Up'],
  ['rename', "Rename tab", 'Cmd+Shift+R', 'Ctrl+Alt+R'],
  ['palette', "Commands", 'Cmd+K', 'Ctrl+Shift+K'],
  ['find', "Search terminal", 'Cmd+F', 'Ctrl+Shift+F'],
  ['sidebar', "Sidebar", 'Cmd+B', 'Ctrl+Shift+B'],
  ['settings', "Settings", 'Cmd+,', 'Ctrl+,'],
];
function shortcuts(platform = process.platform) {
  return definitions.map(([id, label, mac, other]) => {
    const accelerator = platform === 'darwin' ? mac : other;
    let key = accelerator;
    if (platform === 'darwin') key = key.replaceAll('Cmd', '⌘').replaceAll('Ctrl', '⌃').replaceAll('Alt', '⌥').replaceAll('Shift', '⇧');
    return { id, label, accelerator, key: key.replaceAll('Right', '→').replaceAll('Left', '←').replaceAll('Down', '↓').replaceAll('Up', '↑').replaceAll('Tab', '⇥').replaceAll('+', ' ') };
  });
}
module.exports = { shortcuts };
