function folderName(cwd = '') { return cwd.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || '/'; }
function sessionTitle(info, liveTitle = '') {
  const folder = folderName(info.cwd);
  const title = String(liveTitle || info.title || '').replace(/[\x00-\x1f\x7f]/g, '').trim();
  if (title.includes('|')) {
    const parts = title.split('|').map(part => part.trim()).filter(Boolean);
    const name = (parts.length > 2 ? parts[parts.length - 2] : parts[0]).replace(/^[\s\u2800-\u28ff]+/, '').trim();
    if (name && !/^(Action Required|Working|Idle)$/i.test(name)) return name.slice(0, 100);
  }
  if (info.serverId) return info.label || folder;
  if (title && !/[@~/:\\]/.test(title) && !/^(?:-?(?:ba|z|fi)?sh|Terminal|Codex)$/i.test(title)) return title.replace(/^[\s\u2800-\u28ff]+/, '').slice(0, 100) || folder;
  return folder;
}
module.exports = { folderName, sessionTitle };
