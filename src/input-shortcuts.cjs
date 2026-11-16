// Handle these before Chromium/xterm can turn Tab into shell input.
function inputAction(input, platform = process.platform) {
  if (input.type !== 'keyDown' || input.isComposing) return null;
  const key = input.key?.toLowerCase();
  if (key === 'tab' && input.control && !input.meta && !input.alt) return input.shift ? 'previous' : 'next';
  if (key !== 'w') return null;
  if (platform === 'darwin' && input.meta && !input.control) {
    if (input.alt) return input.shift ? 'closeWindow' : null;
    return input.shift ? 'closeTab' : 'close';
  }
  if (platform !== 'darwin' && input.control && !input.meta) {
    if (input.alt) return input.shift ? 'closeTab' : 'closeWindow';
    return input.shift ? 'close' : null; // Preserve Ctrl+W for the shell.
  }
  return null;
}
module.exports = { inputAction };
