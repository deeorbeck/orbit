const definitions = [
  ['new', 'Yangi terminal', 'Cmd+T', 'Ctrl+Shift+T'],
  ['connections', 'Terminal yoki server tanlash', 'Cmd+Shift+T', 'Ctrl+Alt+T'],
  ['codex', 'Yangi Codex', 'Cmd+Shift+N', 'Ctrl+Alt+C'],
  ['newWindow', 'Yangi Orbit oynasi', 'Cmd+N', 'Ctrl+Shift+N'],
  ['projects', 'Loyihani tanlash', 'Cmd+P', 'Ctrl+Shift+P'],
  ['addProject', 'Loyiha qo‘shish', 'Cmd+Alt+P', 'Ctrl+Alt+P'],
  ['split', 'Yonma-yon panel', 'Cmd+D', 'Ctrl+Shift+D'],
  ['splitVertical', 'Ustma-ust panel', 'Cmd+Shift+D', 'Ctrl+Alt+D'],
  ['nextPane', 'Keyingi panel', 'Cmd+Alt+Right', 'Ctrl+Alt+Right'],
  ['previousPane', 'Oldingi panel', 'Cmd+Alt+Left', 'Ctrl+Alt+Left'],
  ['close', 'Sessiyani tugatish', 'Cmd+W', 'Ctrl+Shift+W'],
  ['closeWindow', 'Oynani yopish · sessiyalar qoladi', 'Cmd+Shift+W', 'Ctrl+Alt+W'],
  ['next', 'Keyingi tab', 'Ctrl+Tab', 'Ctrl+Tab'],
  ['previous', 'Oldingi tab', 'Ctrl+Shift+Tab', 'Ctrl+Shift+Tab'],
  ['nextProject', 'Keyingi loyiha', 'Cmd+Alt+Down', 'Ctrl+Alt+Down'],
  ['previousProject', 'Oldingi loyiha', 'Cmd+Alt+Up', 'Ctrl+Alt+Up'],
  ['rename', 'Tab nomini o‘zgartirish', 'Cmd+Shift+R', 'Ctrl+Alt+R'],
  ['palette', 'Buyruqlar', 'Cmd+K', 'Ctrl+Shift+K'],
  ['find', 'Terminalda qidirish', 'Cmd+F', 'Ctrl+Shift+F'],
  ['sidebar', 'Yon panel', 'Cmd+B', 'Ctrl+Shift+B'],
  ['settings', 'Sozlamalar', 'Cmd+,', 'Ctrl+,'],
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
