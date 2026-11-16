// Run only when explicitly launched by scripts/smoke.cjs in an isolated profile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
module.exports = (win, app) => {
  const evaluate = script => win.webContents.executeJavaScript(script, true);
  const until = async script => {
    for (let i = 0; i < 150; i++) { if (await evaluate(script)) return; await delay(100); }
    throw new Error(`Timed out: ${script}`);
  };
  win.webContents.once('did-finish-load', async () => {
    try {
      await until('!!document.querySelector(".xterm-helper-textarea")');
      assert.equal(await evaluate('document.querySelectorAll("[data-theme]").length'), 10);
      for (const theme of ['graphite', 'coding', 'modern', 'futuristic', 'midnight', 'warm', 'dracula', 'nord', 'solarized', 'paper']) {
        await evaluate(`document.querySelector('[data-theme="${theme}"]').click()`);
        assert.equal(await evaluate(`document.body.classList.contains('theme-${theme}')`), true);
      }
      await evaluate('document.querySelector(".xterm-helper-textarea").focus()');
      win.webContents.insertText(process.platform === 'win32' ? "Write-Output 'ORBIT_SMOKE_OK'" : "printf '\\nORBIT_SMOKE_OK\\n'");
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
      win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
      await until('document.querySelector(".xterm-screen").innerText.split("\\n").some(line => line.trim() === "ORBIT_SMOKE_OK")');
      await evaluate('document.querySelector("#add-tab").click()');
      await until('document.querySelectorAll("[role=tab]").length === 2');
      await evaluate('document.querySelector("#split-button").click()');
      await until('document.querySelectorAll(".pane-group:not([hidden]) .terminal-pane").length === 2');
      const imageLoads = await evaluate('new Promise(resolve => {const image = new Image();image.onload = () => resolve(image.naturalWidth > 0);image.onerror = () => resolve(false);image.src = "orbit://wallpaper/image";})');
      assert(imageLoads, 'The bundled SVG wallpaper must decode in the packaged protocol.');
      await delay(300);
      const config = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'config.json'), 'utf8'));
      assert.equal(config.appearance.theme, 'paper');
      console.log('ORBIT_SMOKE_PASS: real shell, 10 themes, tabs, split panes, wallpaper, config persistence');
      app.quit();
    } catch (error) {
      console.error('ORBIT_SMOKE_FAIL:', error.stack);
      app.exit(1);
    }
  });
};
