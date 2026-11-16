// Native integration test, enabled only with an isolated ORBIT_TEST_DATA profile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { BrowserWindow } = require('electron');
const { SessionClient } = require('./session-client.cjs');
const { themes } = require('./themes.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
module.exports = (win, app) => {
  const evaluate = script => win.webContents.executeJavaScript(script, true);
  const until = async test => {
    for (let i = 0; i < 250; i++) { if (await (typeof test === 'function' ? test() : evaluate(test))) return; await delay(100); }
    throw new Error(`Timed out: ${test}`);
  };
  const sendCommand = async command => {
    win.focus(); win.webContents.focus(); await evaluate('document.querySelector(".pane-group:not([hidden]) .active-pane .xterm-helper-textarea, .pane-group:not([hidden]) .xterm-helper-textarea").focus()');
    await win.webContents.insertText(command); win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' }); win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
  };
  win.webContents.once('did-finish-load', async () => {
    let client;
    try {
      await until('!!window.__orbitWorkspaceSnapshot?.() && !!document.querySelector(".xterm-helper-textarea")');
      const directory = app.getPath('userData'), stateFile = path.join(directory, 'smoke-state.json');
      client = await new SessionClient(directory).connect();
      if (process.env.ORBIT_SMOKE_PHASE === 'restore') {
        const expected = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        const sessions = await client.request('list');
        assert.equal(sessions.length, expected.sessions.length, 'Reopening must not create duplicate shells.');
        for (const prior of expected.sessions) { const now = sessions.find(s => s.id === prior.id); assert(now, 'Every previous session must exist.'); assert.equal(now.pid, prior.pid, 'Every process PID must survive GUI exit.'); }
        await until(() => BrowserWindow.getAllWindows().length === 2);
        await until('document.querySelectorAll("[role=tab]").length === 3 && document.querySelectorAll(".pane-group:not([hidden]) .terminal-pane").length === 3');
        assert.equal(await evaluate('document.querySelector("#folder-name").textContent'), 'QA project');
        assert.equal(await evaluate('!!document.querySelector(".pane-group:not([hidden]) .split-node.vertical")'), true);
        const command = process.platform === 'win32' ? "Write-Output ('AFTER_GUI:'+$global:ORBIT_KEEP)" : "printf '\\nAFTER_GUI:%s\\n' \"$ORBIT_KEEP\"";
        await client.request('write', { id: expected.originalId, data: command + '\r' });
        await until(async () => (await client.request('attach', { id: expected.originalId })).snapshot.includes('AFTER_GUI:kept'));
        assert.equal(fs.realpathSync.native(await client.request('cwd', { id: expected.originalId })), fs.realpathSync.native(expected.childFolder));
        console.log('ORBIT_RESTORE_PASS: same PIDs, variables, cwd, projects, tabs, nested splits and two native windows after complete GUI exit');
      } else {
        await until('document.querySelector(".xterm-screen").innerText.trim().length > 0');
        const fonts = new Set();
        for (const [id, theme] of Object.entries(themes)) {
          await evaluate(`document.querySelector('[data-theme="${id}"]').click()`);
          await until(`document.body.classList.contains('theme-${id}')`);
          await evaluate(`window.orbit.init().then(value => window.orbit.save({ ...value.config, appearance: { ...value.config.appearance, theme: '${id}' } }))`);
          await until(`document.body.classList.contains('theme-${id}')`);
          const loaded = await evaluate(`document.fonts.load('14px "${theme.fontName}"').then(faces => faces.length)`); assert(loaded > 0, `${theme.fontName} must load from the bundled fonts.`);
          assert((await evaluate('getComputedStyle(document.querySelector(".xterm-rows")).fontFamily')).includes(theme.fontName), 'The terminal must use the selected theme font, not just load it.');
          assert.equal(await evaluate(`document.body.classList.contains('theme-${id}')`), true); fonts.add(theme.fontName);
        }
        assert.equal(fonts.size, 10);
        const projectFolder = path.join(directory, 'QA project'), childFolder = path.join(projectFolder, 'active-folder'); fs.mkdirSync(childFolder, { recursive: true });
        await evaluate('document.querySelector("#add-project").click()');
        await evaluate(`document.querySelector('#project-form').elements.name.value = 'QA project'; document.querySelector('#project-form').elements.cwd.value = ${JSON.stringify(projectFolder)}; document.querySelector('#project-form').requestSubmit()`);
        await until('document.querySelector("#folder-name").textContent === "QA project" && document.querySelectorAll("[role=tab]").length === 1');
        await until('document.querySelector(".pane-group:not([hidden]) .xterm-screen").innerText.trim().length > 0');
        const originalId = await evaluate('document.querySelector(".pane-group:not([hidden]) .terminal-pane").dataset.sessionId');
        const command = process.platform === 'win32' ? `$global:ORBIT_KEEP='kept'; Set-Location -LiteralPath '${childFolder.replaceAll("'", "''")}'; Write-Output ('DESKTOP_STATE:'+$global:ORBIT_KEEP)` : `export ORBIT_KEEP=kept; cd '${childFolder.replaceAll("'", "'\\''")}'; printf '\\nDESKTOP_STATE:%s\\n' "$ORBIT_KEEP"`;
        await sendCommand(command);
        await until(async () => (await client.request('attach', { id: originalId })).snapshot.includes('DESKTOP_STATE:kept'));
        await evaluate('document.querySelector("#add-tab").click(); [...document.querySelectorAll(".palette-result")].find(el => el.textContent.includes("Local terminal")).click()');
        await until('document.querySelectorAll("[role=tab]").length === 2');
        const cloneId = await evaluate('document.querySelector(".pane-group:not([hidden]) .terminal-pane").dataset.sessionId');
        assert.equal(fs.realpathSync.native(await client.request('cwd', { id: cloneId })), fs.realpathSync.native(childFolder), 'New terminal must inherit the active shell cwd.');
        await evaluate('document.querySelector("#split-button").click()');
        await until('document.querySelectorAll(".pane-group:not([hidden]) .terminal-pane").length === 2');
        await evaluate('document.querySelector("#split-vertical-button").click()');
        await until('document.querySelectorAll(".pane-group:not([hidden]) .terminal-pane").length === 3');
        // The final row must fit above the pane edge, including padding, in small splits.
        win.setSize(900, 560);
        const screensFit = `(() => [...document.querySelectorAll('.pane-group:not([hidden]) .terminal-pane')].every(p => { const screen = p.querySelector('.xterm-screen').getBoundingClientRect(), mount = p.querySelector('.terminal-mount'), rect = mount.getBoundingClientRect(), css = getComputedStyle(mount); return screen.height > 0 && screen.bottom <= rect.bottom - parseFloat(css.paddingBottom) + 1 && screen.right <= rect.right - parseFloat(css.paddingRight) + 1; }))()`;
        await until(screensFit);
        await sendCommand(process.platform === 'win32' ? "1..40 | ForEach-Object { Write-Output 'ROW' }; Write-Output 'BOTTOM'" : "i=0; while [ $i -lt 40 ]; do echo ROW; i=$((i+1)); done; echo BOTTOM");
        try { await until('document.querySelector(".pane-group:not([hidden])").innerText.includes("BOTTOM")'); } catch (error) { throw new Error(error.message + ' visible=' + await evaluate('document.querySelector(".pane-group:not([hidden])").innerText')); }
        assert.equal(await evaluate(screensFit), true, 'Bottom input row must stay inside the small pane.');
        win.setSize(1320, 860);
        await until(screensFit);
        const paneIds = await evaluate('[...document.querySelectorAll(".pane-group:not([hidden]) .terminal-pane")].map(el => el.dataset.sessionId)');
        await evaluate('[...document.querySelectorAll(".pane-group:not([hidden]) .terminal-pane")].at(-1).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))');
        // Native menu accelerators and xterm keyboard routing must choose the same spatial pane.
        const menu = require('electron').Menu.getApplicationMenu();
        const sessionMenu = menu.items.find(item => item.submenu?.items.some(entry => entry.label === 'Focus pane above')).submenu;
        const activeId = () => evaluate('window.__orbitWorkspaceSnapshot().tabs.find(t => t.id === window.__orbitWorkspaceSnapshot().activeTabId).activePaneId');
        await until(async () => await activeId() === paneIds[2]);
        await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        sessionMenu.items.find(item => item.label === 'Focus pane above').click();
        await until(async () => await activeId() === paneIds[1]);
        sessionMenu.items.find(item => item.label === 'Focus pane below').click();
        await until(async () => await activeId() === paneIds[2]);
        win.focus(); win.webContents.focus();
        win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Up', modifiers: ['alt'] });
        win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Up', modifiers: ['alt'] });
        await until(async () => await activeId() === paneIds[1]);
        const config = await evaluate('window.orbit.init().then(value => value.config)');
        config.codexCommand = `node -e "console.log('CODEX_TEST_READY');setInterval(()=>{},1000)"`; config.appearance.theme = 'coding';
        await evaluate(`window.orbit.save(${JSON.stringify(config)})`);
        await evaluate('document.querySelector("#new-codex").click()');
        await until('!!document.querySelector(".pane-group:not([hidden]) [data-kind=codex]")');
        await until('document.querySelector(".pane-group:not([hidden]) .xterm-screen").innerText.includes("CODEX_TEST_READY")');
        await evaluate('document.querySelectorAll("[role=tab]")[1].click()');
        const imageLoads = await evaluate('new Promise(resolve => {const image = new Image();image.onload = () => resolve(image.naturalWidth > 0);image.onerror = () => resolve(false);image.src = "orbit://wallpaper/image";})'); assert(imageLoads);
        await evaluate('document.querySelector("#new-window").click()');
        await until(() => BrowserWindow.getAllWindows().length === 2);
        const second = BrowserWindow.getAllWindows().find(item => item !== win);
        await until(async () => { try { return await second.webContents.executeJavaScript('!!window.__orbitWorkspaceSnapshot?.() && !!document.querySelector(".xterm-helper-textarea")'); } catch { return false; } });
        await evaluate('window.orbit.saveWorkspace(window.__orbitWorkspaceSnapshot())');
        await second.webContents.executeJavaScript('window.orbit.saveWorkspace(window.__orbitWorkspaceSnapshot())');
        const sessions = await client.request('list');
        assert.equal(sessions.length, 7, 'Expected seven independent processes across projects and windows.');
        fs.writeFileSync(stateFile, JSON.stringify({ originalId, childFolder, sessions: sessions.map(({ id, pid }) => ({ id, pid })) }));
        if (process.env.ORBIT_SMOKE_CAPTURE) { const image = await win.webContents.capturePage(); fs.writeFileSync(process.env.ORBIT_SMOKE_CAPTURE, image.toPNG()); }
        console.log('ORBIT_SMOKE_PASS: ten bundled fonts, project isolation, inherited cwd, Codex icon, connection picker, both split directions and second window');
      }
      client.disconnect(); app.quit();
    } catch (error) {
      client?.disconnect(); console.error('ORBIT_SMOKE_FAIL:', error.stack);
      if (process.env.CI) console.error('ORBIT_SMOKE_STATE:', await evaluate('JSON.stringify({focus:document.activeElement?.className,terminal:document.querySelector(".pane-group:not([hidden]) .xterm-screen")?.innerText.slice(-1500),error:document.querySelector("#toast")?.textContent})').catch(() => 'Renderer unavailable'));
      app.exit(1);
    }
  });
};
