// Native integration test, enabled only with an isolated ORBIT_TEST_DATA profile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ipcMain, BrowserWindow } = require('electron');
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
    if (!process.env.ORBIT_SMOKE_BACKGROUND) { app.focus({ steal: true }); win.focus(); } win.webContents.focus(); await evaluate('document.querySelector(".pane-group:not([hidden]) .active-pane .xterm-helper-textarea, .pane-group:not([hidden]) .xterm-helper-textarea").focus()');
    await win.webContents.insertText(command); win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' }); win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
  };
  win.webContents.once('did-finish-load', async () => {
    let client;
    try {
      await until(process.env.ORBIT_SMOKE_PHASE === 'home' ? '!document.querySelector("#home-screen").hidden' : '!!window.__orbitWorkspaceSnapshot?.() && !!document.querySelector(".xterm-helper-textarea")');
      await evaluate('window.__smokeExits=[];window.__smokeRemoved=[];window.orbit.onExit(e=>window.__smokeExits.push(e));window.orbit.onRemoved(e=>window.__smokeRemoved.push(e));true');
      const directory = app.getPath('userData'), stateFile = path.join(directory, 'smoke-state.json');
      client = await new SessionClient(directory).connect();
      if (process.env.ORBIT_SMOKE_PHASE === 'home') {
        const expected = JSON.parse(fs.readFileSync(stateFile, 'utf8')), sessions = await client.request('list');
        assert.equal(BrowserWindow.getAllWindows().length, 1, 'Startup must open exactly one home window.');
        assert.equal(sessions.length, expected.sessions.length, 'Opening home must not start a new shell.');
        for (const prior of expected.sessions) assert.equal(sessions.find(s => s.id === prior.id)?.pid, prior.pid);
        assert.equal(await evaluate('document.querySelectorAll("#workspaces .terminal-pane").length'), 0);
        await evaluate('document.querySelector("#home-continue").click()');
        await until('!!window.__orbitWorkspaceSnapshot?.() && document.querySelectorAll("[role=tab]").length === 3');
        assert.equal(await evaluate('document.body.dataset.theme'), expected.customThemeId);
        console.log('ORBIT_HOME_PASS: one home window, no new PTY, saved tabs and processes available on Continue');
      } else if (process.env.ORBIT_SMOKE_PHASE === 'cold') {
        const expected = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        const { info, snapshot } = await client.request('attach', { id: expected.originalId });
        assert.equal(info.status, 'running');
        assert.notEqual(info.pid, expected.sessions.find(s => s.id === info.id).pid);
        assert.equal(fs.realpathSync.native(info.cwd), fs.realpathSync.native(expected.childFolder));
        assert(snapshot.includes('DESKTOP_STATE:kept'), 'Cold recovery must preserve scrollback.');
        const command = process.platform === 'win32' ? "Write-Output ('COLD_' + 'READY')" : "printf '\\nCOLD_%s\\n' READY";
        await client.request('write', { id: info.id, data: command + '\r' });
        await until(async () => (await client.request('attach', { id: info.id })).snapshot.includes('COLD_READY'));
        console.log('ORBIT_COLD_PASS: interrupted shell accepts input in its previous folder');
      } else if (process.env.ORBIT_SMOKE_PHASE === 'restore') {
        const expected = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        const sessions = await client.request('list');
        assert.equal(sessions.length, expected.sessions.length, 'Reopening must not create duplicate shells.');
        for (const prior of expected.sessions) { const now = sessions.find(s => s.id === prior.id); assert(now, 'Every previous session must exist.'); assert.equal(now.pid, prior.pid, 'Every process PID must survive GUI exit.'); }
        await until(() => BrowserWindow.getAllWindows().length === 2);
        await until('document.querySelectorAll("[role=tab]").length === 3 && document.querySelectorAll(".pane-group:not([hidden]) .terminal-pane").length === 3');
        assert.equal(await evaluate('document.querySelector("#folder-name").textContent'), 'QA project');
        assert.equal(await evaluate('document.body.dataset.theme'), expected.customThemeId, 'Reopening must use the saved custom default.');
        assert.equal(await evaluate('window.__orbitEffectsSnapshot().speed'), 2.25);
        assert.equal(await evaluate('window.__orbitEffectsSnapshot().visibility'), 0.8);
        assert.equal(await evaluate('window.__orbitEffectsSnapshot().size'), 1.75);
        assert.equal(await evaluate('window.__orbitEffectsSnapshot().count'), 12);
        assert.equal(await evaluate('getComputedStyle(document.body).getPropertyValue("--terminal-bg").trim()'), '#132839');
        await until(`getComputedStyle(document.querySelector('.pane-group:not([hidden]) .xterm-rows')).fontFamily.includes(${JSON.stringify(expected.customFontFace)})`);
        assert.equal(await evaluate('!!document.querySelector(".pane-group:not([hidden]) .split-node.vertical")'), true);
        const command = process.platform === 'win32' ? "Write-Output ('AFTER_GUI:'+$global:ORBIT_KEEP)" : "printf '\\nAFTER_GUI:%s\\n' \"$ORBIT_KEEP\"";
        await client.request('write', { id: expected.originalId, data: command + '\r' });
        await until(async () => (await client.request('attach', { id: expected.originalId })).snapshot.includes('AFTER_GUI:kept'));
        assert.equal(fs.realpathSync.native(await client.request('cwd', { id: expected.originalId })), fs.realpathSync.native(expected.childFolder));
        console.log('ORBIT_RESTORE_PASS: custom startup theme, imported theme font, same PIDs, projects, splits and two windows');
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
          assert.equal(await evaluate('window.__orbitEffectsSnapshot().style'), require('./effect-profiles.cjs').themeStyles[id], 'Every built-in theme must select its matching atmosphere.');
        }
        assert.equal(fonts.size, 10);
        for (const font of [...require('./font-catalog.cjs').extraFonts, ...(await evaluate('window.orbit.init().then(value => value.localFonts)'))]) {
          const loaded = await evaluate(`document.fonts.load('16px ${font.fontFamily}').then(faces => faces.length)`);
          assert(loaded > 0, `${font.name} must load offline from its bundled TTF.`);
          await evaluate(`document.querySelector('#font-family').value = ${JSON.stringify(font.fontFamily)}; document.querySelector('#font-family').dispatchEvent(new Event('change'))`);
          await until(`getComputedStyle(document.querySelector('.xterm-rows')).fontFamily.includes(${JSON.stringify(font.face || font.name)})`);
          await until(`document.querySelector('#font-preview').style.fontFamily.includes(${JSON.stringify(font.face || font.name)})`);
          assert((await evaluate('getComputedStyle(document.querySelector(".wordmark")).fontFamily')).includes(font.face || font.name), 'The selected font must also style the Orbit wordmark.');
          assert(await evaluate(`!![...document.querySelector('#font-family').options].find(option => option.value === ${JSON.stringify(font.fontFamily)})`), `Font picker must list ${font.name}.`);
        }
        await evaluate('document.querySelector("#font-family").value="";document.querySelector("#font-family").dispatchEvent(new Event("change"))');
        await until('document.querySelector("#font-family").value === ""');

        assert.equal(await evaluate('document.querySelector(".statusbar")'), null, 'The footer must not occupy terminal space.');
        const sizeBefore = await evaluate('Number(document.querySelector("#font-size").value)');
        await evaluate(`document.querySelector('#terminal-area').dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ${process.platform === 'darwin' ? 'metaKey' : 'ctrlKey'}: true, bubbles: true, cancelable: true }))`);
        await until(`Number(document.querySelector('#font-size').value) === ${sizeBefore + 1}`);
        await until(`parseFloat(getComputedStyle(document.querySelector('.xterm-rows')).fontSize) === ${sizeBefore + 1}`);
        await evaluate(`document.querySelector('#terminal-area').dispatchEvent(new WheelEvent('wheel', { deltaY: 100, ${process.platform === 'darwin' ? 'metaKey' : 'ctrlKey'}: true, bubbles: true, cancelable: true }))`);
        await until(`Number(document.querySelector('#font-size').value) === ${sizeBefore}`);
        await evaluate('document.querySelector("#effects-button").click()');
        assert.equal(await evaluate('window.__orbitEffectsSnapshot().enabled'), false);
        assert.equal(await evaluate('window.__orbitEffectsSnapshot().rays'), 0);
        await evaluate('document.querySelector("#effects-button").click()');
        await evaluate('document.querySelector(".pane-group:not([hidden]) .xterm-helper-textarea").focus()');
        win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'a' }); win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'a' });
        if (!(await evaluate('window.__orbitEffectsSnapshot().reducedMotion'))) { try { await until('window.__orbitEffectsSnapshot().rays > 0'); } catch (error) { throw new Error(error.message + ' effects=' + JSON.stringify(await evaluate('window.__orbitEffectsSnapshot()'))); } }
        win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'u', modifiers: ['control'] }); win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'u', modifiers: ['control'] });
        await evaluate('document.querySelector("#effects-button").click()');
        assert.equal(await evaluate('window.__orbitEffectsSnapshot().rays'), 0, 'Turning effects off must clear live trails immediately.');
        await evaluate('document.querySelector("#effects-button").click()');
        await evaluate('document.querySelector("#effects-button").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }))');
        await until('document.querySelector("#settings-dialog").open && document.querySelector("#effect-preview-canvas").width > 0');
        await evaluate(`(()=>{const slider=document.querySelector('#effect-speed');slider.value=25;slider.dispatchEvent(new Event('input'))})()`);
        assert.equal(await evaluate('window.__orbitEffectsSnapshot().speed'), 0.25);
        const slow = await evaluate('(()=>{window.__orbitEffectsFrame(0);const before=window.__orbitEffectsSnapshot().motionTime;window.__orbitEffectsFrame(100);return window.__orbitEffectsSnapshot().motionTime-before})()');
        await evaluate(`(()=>{const slider=document.querySelector('#effect-speed');slider.value=225;slider.dispatchEvent(new Event('input'))})()`);
        const fast = await evaluate('(()=>{window.__orbitEffectsFrame(0);const before=window.__orbitEffectsSnapshot().motionTime;window.__orbitEffectsFrame(100);return window.__orbitEffectsSnapshot().motionTime-before})()');
        if (await evaluate('window.__orbitEffectsSnapshot().reducedMotion')) {
          assert.equal(slow, 0, 'Reduced motion must stop the animation clock.');
          assert.equal(fast, 0, 'Increasing speed must respect reduced motion.');
        } else {
          assert(fast > slow * 5, `Speed must change the animation clock immediately (slow: ${slow}, fast: ${fast}).`);
        }
        await evaluate(`(()=>{const slider=document.querySelector('#effect-intensity');slider.value=0;slider.dispatchEvent(new Event('input'))})()`);
        assert.equal(await evaluate('window.__orbitEffectsSnapshot().enabled'), false, 'Zero visibility hides the effect and stops its animation.');
        await evaluate(`(()=>{const slider=document.querySelector('#effect-intensity');slider.value=80;slider.dispatchEvent(new Event('input'));const size=document.querySelector('#effect-size');size.value=175;size.dispatchEvent(new Event('input'))})()`);
        assert.equal(await evaluate('window.__orbitEffectsSnapshot().visibility'), 0.8); assert.equal(await evaluate('window.__orbitEffectsSnapshot().size'), 1.75);
        if (process.env.ORBIT_EFFECT_CONTROLS_CAPTURE) { await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))'); fs.writeFileSync(process.env.ORBIT_EFFECT_CONTROLS_CAPTURE, (await win.webContents.capturePage()).toPNG()); }
        await evaluate(`(()=>{const count=document.querySelector('#effect-count');count.value=48;count.dispatchEvent(new Event('input'));const style=document.querySelector('#effect-style');style.value='matrix';style.dispatchEvent(new Event('change'))})()`);
        await evaluate('document.querySelector("#settings-dialog").close()');
        await evaluate('document.querySelector("#effects-button").click();document.querySelector("#effects-button").click();document.querySelector(".pane-group:not([hidden]) .xterm-helper-textarea").focus()');
        win.webContents.sendInputEvent({type:'keyDown',keyCode:'a'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'a'});
        if (!(await evaluate('window.__orbitEffectsSnapshot().reducedMotion'))) await until('window.__orbitEffectsSnapshot().rays === 48');
        win.webContents.sendInputEvent({type:'keyDown',keyCode:'u',modifiers:['control']});win.webContents.sendInputEvent({type:'keyUp',keyCode:'u',modifiers:['control']});
        await evaluate(`(()=>{const count=document.querySelector('#effect-count');count.value=12;count.dispatchEvent(new Event('input'));const style=document.querySelector('#effect-style');style.value='auto';style.dispatchEvent(new Event('change'))})()`);
        await evaluate('document.querySelector("#focus-mode-button").click()');
        await until('document.body.classList.contains("terminal-only")');
        assert.equal(await evaluate('getComputedStyle(document.querySelector(".titlebar")).display'), 'none');
        assert.equal(await evaluate('getComputedStyle(document.querySelector(".tabs-bar")).display'), 'none');
        assert.equal(await evaluate('getComputedStyle(document.querySelector(".pane-label")).display'), 'none');
        win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
        await until('!document.body.classList.contains("terminal-only")');
        if (process.env.ORBIT_ATMOSPHERE_CAPTURE) {
          await evaluate(`document.querySelector('[data-theme="futuristic"]').click(); document.querySelector('#font-family').value='"Orbitron", monospace'; document.querySelector('#font-family').dispatchEvent(new Event('change'))`);
          win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'a' }); win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'a' });
          await evaluate('window.__orbitEffectsFrame(180)');
          await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
          fs.writeFileSync(process.env.ORBIT_ATMOSPHERE_CAPTURE, (await win.webContents.capturePage()).toPNG());
          win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'u', modifiers: ['control'] }); win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'u', modifiers: ['control'] });
        }

        const projectFolder = path.join(directory, 'QA project'), childFolder = path.join(projectFolder, 'active-folder'); fs.mkdirSync(childFolder, { recursive: true });
        await evaluate('document.querySelector("#add-project").click()');
        await evaluate(`document.querySelector('#project-form').elements.name.value = 'QA project'; document.querySelector('#project-form').elements.cwd.value = ${JSON.stringify(projectFolder)}; document.querySelector('#project-form').requestSubmit()`);
        await until('document.querySelector("#folder-name").textContent === "QA project" && document.querySelectorAll("[role=tab]").length === 1');
        await until('document.querySelector(".pane-group:not([hidden]) .xterm-screen").innerText.trim().length > 0');
        const originalId = await evaluate('document.querySelector(".pane-group:not([hidden]) .terminal-pane").dataset.sessionId');
        assert.equal(await evaluate('getComputedStyle(document.querySelector(".pane-group:not([hidden]) .pane-label")).display'), 'none');
        await evaluate(`document.querySelector('#font-family').value='"MatrixType", monospace';document.querySelector('#font-family').dispatchEvent(new Event('change'))`);
        await until('getComputedStyle(document.querySelector(".pane-group:not([hidden]) .xterm-rows")).fontFamily.includes("MatrixType")');
        await client.request('write', { id: originalId, data: process.platform === 'win32' ? "[Console]::Write([char]27+'[38;2;40;210;120mCOLOR_OK'+[char]27+'[0m')\r" : "printf '\\033[38;2;40;210;120mCOLOR_OK\\033[0m\\n'\r" });
        await until('document.querySelector(".pane-group:not([hidden]) .xterm-screen").innerText.includes("COLOR_OK")');
        try { await until('[...document.querySelectorAll(".pane-group:not([hidden]) .xterm-rows span")].some(el => el.textContent.trim() && getComputedStyle(el).color === "rgb(40, 210, 120)")'); } catch (error) { throw new Error(error.message + ' spans=' + JSON.stringify(await evaluate('[...document.querySelectorAll(".pane-group:not([hidden]) .xterm-rows span")].map(el => ({text:el.textContent,color:getComputedStyle(el).color}))'))); }
        if (process.env.ORBIT_MATRIX_COLOR_CAPTURE) {
          await client.request('write',{id:originalId,data:"printf '\\033[38;2;230;50;60mMATRIX_RED\\033[38;2;40;210;120m MATRIX_GREEN\\033[38;2;60;100;240m MATRIX_BLUE\\033[0m\\n'\r"});
          await until('document.querySelector(".pane-group:not([hidden]) .xterm-screen").innerText.includes("MATRIX_BLUE")');
          await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
          const pixels=await win.webContents.capturePage();fs.writeFileSync(process.env.ORBIT_MATRIX_COLOR_CAPTURE,pixels.toPNG());
          const bitmap=pixels.toBitmap();let red=0,green=0,blue=0;
          for(let n=0;n<bitmap.length;n+=4){const b=bitmap[n],g=bitmap[n+1],r=bitmap[n+2];if(r>150&&r>g+80&&r>b+80)red++;if(g>140&&g>r+60&&g>b+40)green++;if(b>150&&b>r+80&&b>g+60)blue++;}
          assert(red>10&&green>10&&blue>10,'MatrixType must render distinct red, green and blue pixels, not only correct DOM attributes.');
        }
        if (process.platform === 'darwin') {
          await win.webContents.insertText("printf '\\nSHIFT_%s\\n' ENTER_OK;");
          win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter', modifiers: ['shift'] });
          win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter', modifiers: ['shift'] });
          await win.webContents.insertText("printf '\\nNEXT_%s\\n' LINE_OK");
          await delay(150);
          assert(!(await client.request('attach', { id: originalId })).snapshot.includes('SHIFT_ENTER_OK'), 'Shift+Enter must not run the first line.');
          win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
          win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
          await until(async () => { const screen = (await client.request('attach', { id: originalId })).snapshot; return screen.includes('SHIFT_ENTER_OK') && screen.includes('NEXT_LINE_OK'); });
        }
        const command = process.platform === 'win32' ? `$global:ORBIT_KEEP='kept'; Set-Location -LiteralPath '${childFolder.replaceAll("'", "''")}'; Write-Output ('DESKTOP_STATE:'+$global:ORBIT_KEEP)` : `export ORBIT_KEEP=kept; cd '${childFolder.replaceAll("'", "'\\''")}'; printf '\\nDESKTOP_STATE:%s\\n' "$ORBIT_KEEP"`;
        await sendCommand(command);
        await until(async () => (await client.request('attach', { id: originalId })).snapshot.includes('DESKTOP_STATE:kept'));
        await until('document.querySelector("[role=tab][aria-selected=true] .tab-name").textContent === "active-folder"');
        await evaluate('document.querySelector("#add-tab").click(); [...document.querySelectorAll(".palette-result")].find(el => el.textContent.includes("Local terminal")).click()');
        await until('document.querySelectorAll("[role=tab]").length === 2');
        const cloneId = await evaluate('document.querySelector(".pane-group:not([hidden]) .terminal-pane").dataset.sessionId');
        assert.equal(fs.realpathSync.native(await client.request('cwd', { id: cloneId })), fs.realpathSync.native(childFolder), 'New terminal must inherit the active shell cwd.');
        await evaluate('document.querySelector("#split-button").click()');
        await until('(() => { const s = window.__orbitWorkspaceSnapshot(), t = s.tabs.find(t => t.id === s.activeTabId); return t.layout.type === "split" && document.querySelectorAll(".pane-group:not([hidden]) .terminal-pane").length === 2; })()');
        await evaluate('document.querySelector("#split-vertical-button").click()');
        await until('(() => { const s=window.__orbitWorkspaceSnapshot(), t=s.tabs.find(t=>t.id===s.activeTabId), count=n=>n.type==="leaf"?1:count(n.first)+count(n.second); return count(t.layout)===3 && document.querySelectorAll(".pane-group:not([hidden]) .terminal-pane").length===3; })()');
        // The final row must fit above the pane edge, including padding, in small splits.
        win.setSize(900, 560);
        const screensFit = `(() => [...document.querySelectorAll('.pane-group:not([hidden]) .terminal-pane')].every(p => { const screen = p.querySelector('.xterm-screen').getBoundingClientRect(), mount = p.querySelector('.terminal-mount'), rect = mount.getBoundingClientRect(), css = getComputedStyle(mount); return screen.height > 0 && screen.bottom <= rect.bottom - parseFloat(css.paddingBottom) + 1 && screen.right <= rect.right - parseFloat(css.paddingRight) + 1; }))()`;
        await until(screensFit);
        await sendCommand(process.platform === 'win32' ? "1..40 | ForEach-Object { Write-Output 'ROW' }; Write-Output 'BOTTOM'" : "i=0; while [ $i -lt 40 ]; do echo ROW; i=$((i+1)); done; echo BOTTOM");
        try { await until('document.querySelector(".pane-group:not([hidden])").innerText.includes("BOTTOM")'); } catch (error) { throw new Error(error.message + ' visible=' + await evaluate('document.querySelector(".pane-group:not([hidden])").innerText')); }
        assert.equal(await evaluate(screensFit), true, 'Bottom input row must stay inside the small pane.');
        win.setSize(1320, 860);
        await until(screensFit);
        const paneIds = await evaluate(`(() => { const rects = [...document.querySelectorAll('.pane-group:not([hidden]) .terminal-pane')].map(el => ({ id: el.dataset.sessionId, ...el.getBoundingClientRect().toJSON() })); const bottom = rects.toSorted((a,b) => b.top-a.top)[0]; const top = rects.find(r => r.id !== bottom.id && r.bottom <= bottom.top && r.left === bottom.left); if (!top) throw new Error('Expected a vertical pair'); return [rects.find(r => r.id !== top.id && r.id !== bottom.id).id, top.id, bottom.id]; })()`);
        if (!process.env.ORBIT_SMOKE_BACKGROUND) { app.focus({ steal: true }); win.focus(); } win.webContents.focus();
        if (!process.env.ORBIT_SMOKE_BACKGROUND) await until(() => win.isFocused());
        await evaluate(`document.querySelector('[data-session-id="${paneIds[2]}"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`);
        const activeId = () => evaluate('window.__orbitWorkspaceSnapshot().tabs.find(t => t.id === window.__orbitWorkspaceSnapshot().activeTabId).activePaneId');
        await until(async () => await activeId() === paneIds[2]);
        const arrow = keyCode => { win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers: ['alt'] }); win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers: ['alt'] }); };
        arrow('Up');
        try { await until(async () => await activeId() === paneIds[1]); } catch (error) { throw new Error(error.message + ' navigation=' + JSON.stringify(await evaluate('({snapshot: window.__orbitWorkspaceSnapshot(), rects: [...document.querySelectorAll(".pane-group:not([hidden]) .terminal-pane")].map(el => ({ id: el.dataset.sessionId, rect: el.getBoundingClientRect().toJSON() }))})'))); }
        arrow('Down');
        await until(async () => await activeId() === paneIds[2]);
        const config = await evaluate('window.orbit.init().then(value => value.config)');
        config.codexCommand = `node -e "console.log('CODEX_TEST_READY');process.stdout.write('\\x1b]2;QA conversation | project\\x07');setInterval(()=>{},1000)"`; config.appearance.theme = 'coding';
        await evaluate(`window.orbit.save(${JSON.stringify(config)})`);
        await evaluate('document.querySelector("#new-codex").click()');
        await until('!!document.querySelector(".pane-group:not([hidden]) [data-kind=codex]")');
        await until('document.querySelector(".pane-group:not([hidden]) .xterm-screen").innerText.includes("CODEX_TEST_READY")');
        await until('document.querySelector("[role=tab][aria-selected=true] .tab-name").textContent === "QA conversation"');
        const shiftWrites = [];
        const captureShift = (_event, value) => shiftWrites.push(value.data);
        ipcMain.on('terminal:write', captureShift);
        win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter', modifiers: ['shift'] });
        win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter', modifiers: ['shift'] });
        await until(() => shiftWrites.length > 0);
        ipcMain.removeListener('terminal:write', captureShift);
        assert.deepEqual(shiftWrites, ['\x1b[13;2u'], 'Shift+Enter must reach Codex as a modified Enter, never submit.');
        await evaluate('document.querySelectorAll("[role=tab]")[1].click()');
        const snapshot = () => evaluate('window.__orbitWorkspaceSnapshot()');
        let navState = await snapshot();
        const tabIds = navState.tabs.map(t => t.id);
        let navIndex = tabIds.indexOf(navState.activeTabId);
        const press = (keyCode, modifiers) => { win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers }); win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers }); };
        if (!process.env.ORBIT_SMOKE_BACKGROUND) { app.focus({ steal: true }); win.focus(); } win.webContents.focus();
        for (let n = 0; n < 8; n++) {
          await evaluate('document.querySelector(".pane-group:not([hidden]) .xterm-helper-textarea").focus()');
          const backwards = n >= 5;
          navIndex = (navIndex + (backwards ? -1 : 1) + tabIds.length) % tabIds.length;
          press('Tab', backwards ? ['control', 'shift'] : ['control']);
          await until(async () => (await snapshot()).activeTabId === tabIds[navIndex]);
          assert.equal(await evaluate('!!document.activeElement.closest(".pane-group:not([hidden])")'), true, 'Tab cycling must keep focus in the newly active terminal.');
        }
        const newDisposableTab = async () => {
          await evaluate('document.querySelector("#add-tab").click(); [...document.querySelectorAll(".palette-result")].find(el => el.textContent.includes("Local terminal")).click()');
          await until('(() => { const s = window.__orbitWorkspaceSnapshot(), t = s.tabs.find(t => t.id === s.activeTabId); return s.tabs.length === 4 && document.querySelectorAll("[role=tab]").length === 4 && document.querySelector(".pane-group:not([hidden]) .terminal-pane")?.dataset.sessionId === t.activePaneId; })()');
        };
        await newDisposableTab();
        await evaluate('document.querySelector("#split-button").click()');
        await until('(() => { const s = window.__orbitWorkspaceSnapshot(), t = s.tabs.find(t => t.id === s.activeTabId); return t.layout.type === "split" && document.querySelectorAll(".pane-group:not([hidden]) .terminal-pane").length === 2; })()');
        const beforeClose = await snapshot();
        press('w', process.platform === 'darwin' ? ['meta'] : ['control', 'shift']);
        await until('document.querySelectorAll(".pane-group:not([hidden]) .terminal-pane").length === 1');
        assert.equal((await snapshot()).tabs.length, 4, 'Closing one pane must retain its tab and other pane. ' + JSON.stringify({before:beforeClose,after:await snapshot(),events:await evaluate('({exits:window.__smokeExits,removed:window.__smokeRemoved})')}));
        await evaluate('document.querySelector("#split-button").click()');
        await until('(() => { const s = window.__orbitWorkspaceSnapshot(), t = s.tabs.find(t => t.id === s.activeTabId); return t.layout.type === "split" && document.querySelectorAll(".pane-group:not([hidden]) .terminal-pane").length === 2; })()');
        press('w', process.platform === 'darwin' ? ['meta', 'shift'] : ['control', 'alt', 'shift']);
        await until(async () => (await snapshot()).tabs.length === 3);
        await newDisposableTab();
        await until('document.querySelector(".pane-group:not([hidden]) .xterm-screen").innerText.trim().length > 0');
        const exitState = await snapshot(), exitId = exitState.tabs.find(t => t.id === exitState.activeTabId).activePaneId;
        await client.request('write', { id: exitId, data: 'exit 7\r' });
        try { await until(async () => (await snapshot()).tabs.length === 3); } catch (error) { throw new Error(error.message + ' exit=' + JSON.stringify(await client.request('attach', { id: exitId }))); }
        assert.equal(BrowserWindow.getAllWindows().length, 1, 'Pane/tab close and exit must not quit Orbit.');
        await evaluate('document.querySelectorAll("[role=tab]")[1].click()');
        const imageLoads = await evaluate('new Promise(resolve => {const image = new Image();image.onload = () => resolve(image.naturalWidth > 0);image.onerror = () => resolve(false);image.src = "orbit://wallpaper/image";})'); assert(imageLoads, 'The bundled wallpaper must load over the Orbit protocol.');
        await evaluate('document.querySelector("#new-theme").click()');
        await until('document.querySelector("#theme-dialog").open');
        const customFont = (await evaluate('window.orbit.init().then(value => value.localFonts)'))[0];
        if (process.env.ORBIT_THEME_CAPTURE) { await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))'); fs.writeFileSync(process.env.ORBIT_THEME_CAPTURE, (await win.webContents.capturePage()).toPNG()); }
        await evaluate(`document.querySelector('#theme-name').value='QA Custom'; const color=document.querySelector('[data-theme-color=terminal]'); color.value='#132839'; color.dispatchEvent(new Event('input')); document.querySelector('#theme-font').value=${JSON.stringify(customFont.fontFamily)}; document.querySelector('#theme-font-size').value=17; document.querySelector('#theme-form').requestSubmit()`);
        await until('!document.querySelector("#theme-dialog").open && document.body.dataset.theme.startsWith("custom-")');
        const customThemeId = await evaluate('document.body.dataset.theme');
        assert.equal(await evaluate('getComputedStyle(document.body).getPropertyValue("--terminal-bg").trim()'), '#132839');
        await until(`getComputedStyle(document.querySelector('.pane-group:not([hidden]) .xterm-rows')).fontFamily.includes(${JSON.stringify(customFont.face)})`);
        await evaluate('document.querySelector("#edit-theme").click()');
        await until('document.querySelector("#theme-dialog").open');
        await evaluate(`document.querySelector('#theme-name').value='QA Custom Edited'; document.querySelector('#theme-form').requestSubmit()`);
        await until('!document.querySelector("#theme-dialog").open');
        const savedThemes = await evaluate('window.orbit.init().then(value => value.config.customThemes)');
        assert.equal(savedThemes.filter(theme => theme.id === customThemeId).length, 1, 'Editing must update the existing theme.');
        assert.equal(savedThemes.find(theme => theme.id === customThemeId).name, 'QA Custom Edited');
        await evaluate('document.querySelector("#new-theme").click(); document.querySelector("#theme-dialog .close-dialog").click()');
        assert.equal(await evaluate('document.body.dataset.theme'), customThemeId, 'Cancel must keep the saved default.');
        await evaluate(`document.querySelector('#new-theme').click(); document.querySelector('#theme-name').value='Temporary theme'; document.querySelector('#theme-form').requestSubmit()`);
        await until('!document.querySelector("#theme-dialog").open');
        const temporaryId = await evaluate('document.body.dataset.theme');
        assert.notEqual(temporaryId, customThemeId, 'New theme must duplicate without overwriting its source.');
        await evaluate('document.querySelector("#edit-theme").click(); document.querySelector("#delete-theme").click()');
        assert.equal(await evaluate('document.querySelector("#theme-dialog").open'), true, 'Deleting requires a second click.');
        await evaluate('document.querySelector("#delete-theme").click()');
        await until('!document.querySelector("#theme-dialog").open');
        await until(async () => !(await evaluate('window.orbit.init().then(value => value.config.customThemes)')).some(theme => theme.id === temporaryId));
        await evaluate(`document.querySelector('[data-theme="${customThemeId}"]').click()`);
        await until(async () => (await evaluate('window.orbit.init().then(value => value.config.appearance.theme)')) === customThemeId);

        await evaluate('document.querySelector("#new-window").click()');
        await until(() => BrowserWindow.getAllWindows().length === 2);
        const second = BrowserWindow.getAllWindows().find(item => item !== win);
        await until(async () => { try { return await second.webContents.executeJavaScript('!!window.__orbitWorkspaceSnapshot?.() && !!document.querySelector(".xterm-helper-textarea")'); } catch { return false; } });
        await evaluate('window.orbit.saveWorkspace(window.__orbitWorkspaceSnapshot())');
        await second.webContents.executeJavaScript('window.orbit.saveWorkspace(window.__orbitWorkspaceSnapshot())');
        const sessions = await client.request('list');
        assert.equal(sessions.length, 7, 'Expected seven independent processes across projects and windows.');
        fs.writeFileSync(stateFile, JSON.stringify({ originalId, childFolder, customThemeId, customFontFace: customFont.face, sessions: sessions.map(({ id, pid }) => ({ id, pid })) }));
        if (process.env.ORBIT_SMOKE_CAPTURE) { const image = await win.webContents.capturePage(); fs.writeFileSync(process.env.ORBIT_SMOKE_CAPTURE, image.toPNG()); }
        console.log('ORBIT_SMOKE_PASS: truecolor, unified fonts, bounded typing effects, terminal-only/Esc, themes and navigation');
      }
      client.disconnect(); app.quit();
    } catch (error) {
      client?.disconnect(); console.error('ORBIT_SMOKE_FAIL:', error.stack);
      console.error('ORBIT_SMOKE_STATE:', await evaluate('JSON.stringify({focus:document.activeElement?.className,terminal:document.querySelector(".pane-group:not([hidden]) .xterm-screen")?.innerText.slice(-1500),error:document.querySelector("#toast")?.textContent})').catch(() => 'Renderer unavailable'));
      app.exit(1);
    }
  });
};
