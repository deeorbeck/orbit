# Orbit Terminal

An MIT-licensed desktop terminal for **coding, Codex and persistent SSH workspaces**.
Built with Electron, xterm.js and node-pty. The interface defaults to English, with Uzbek available in Settings.

[Download the latest release](https://github.com/deeorbeck/orbit/releases/latest) · [Report an issue](https://github.com/deeorbeck/orbit/issues) · [Contribute](CONTRIBUTING.md)

## Downloads

| Platform | Download | Install |
| --- | --- | --- |
| Windows 10/11 x64 | `Orbit-Terminal-*-windows-x64-setup.exe` | Run the guided installer |
| macOS Apple Silicon | `Orbit-Terminal-*-macos-arm64.dmg` | Drag Orbit Terminal to Applications |
| macOS Intel | `Orbit-Terminal-*-macos-x64.dmg` | Drag Orbit Terminal to Applications |
| Linux x64 | `Orbit-Terminal-*-linux-x86_64.AppImage` | Make executable and run |
| Debian / Ubuntu x64 | `Orbit-Terminal-*-linux-amd64.deb` | `sudo apt install ./Orbit-Terminal-*.deb` |

Installers and SHA-256 checksums are published on the [Releases page](https://github.com/deeorbeck/orbit/releases). Linux AppImage may require FUSE; the `.deb` is an alternative on Debian-based systems. Mac builds target macOS 13+.

The initial community builds have no commercial Windows certificate or Apple notarization; Mac apps are ad-hoc signed. OS trust prompts may appear. Download from this repository and check `SHA256SUMS.txt`. Automatic app updates are not implemented.

## Features

- **Project workspaces:** separate projects, each with multiple shell/Codex/SSH tabs, nested horizontal and vertical splits (up to 12 panes per tab), and additional native Orbit windows. New local panes inherit the active process’s actual working directory.
- **Surviving GUI exit:** a detached local service keeps the same shell/Codex/SSH processes running after all Orbit windows quit. Reopen to restore window layouts, tabs, screens and the same process PIDs.
- **Real terminals:** login shell on Mac/Linux, PowerShell on Windows, searchable scrollback, per-pane type icons and current-folder headers.
- **Codex:** one-click local launch in your chosen directory, or a separate Codex workspace on an SSH server. Codex is installed/authenticated separately.
- **Ready connections:** the new-session picker automatically lists your SSH-config hosts and SSH aliases from zsh/bash, alongside local terminal, Codex and manually saved profiles. Existing key/agent authentication is reused. Passwords, passphrases and host-key prompts stay in the terminal.
- **Durable remote work:** 15-second SSH keepalives, named tmux sessions, manual reattachment and bounded automatic reconnection after an established connection drops.
- **10 designs:** Graphite, Coding, Modern, Futuristic, Midnight, Warm, Dracula, Nord, Solarized and Paper. Each theme changes terminal fonts as well as colors and type/shape details. Ten open-license fonts are bundled and work offline. A font override is optional; the default follows the theme.
- **Your background:** fit the entire image, fill or stretch it; change brightness, dimming, fonts and sidebar live.
- **Easy editing:** one `config.json`, with valid external edits reloaded automatically. No cloud service or telemetry.

### Keyboard

| Action | Mac | Windows / Linux |
| --- | --- | --- |
| New local terminal | ⌘T | Ctrl+Shift+T |
| Terminal/server picker | ⌘Shift+T | Ctrl+Alt+T |
| New Codex tab | ⌘Shift+N | Ctrl+Alt+C |
| New Orbit window | ⌘N | Ctrl+Shift+N |
| Project picker | ⌘P | Ctrl+Shift+P |
| Add project | ⌘Alt+P | Ctrl+Alt+P |
| Split side by side | ⌘D | Ctrl+Shift+D |
| Split top / bottom | ⌘Shift+D | Ctrl+Alt+D |
| Next / previous pane | ⌘Alt+→ / ← | Ctrl+Alt+→ / ← |
| End pane (confirmation) | ⌘W | Ctrl+Shift+W |
| Close window, keep sessions | ⌘Shift+W | Ctrl+Alt+W |
| Rename tab | ⌘Shift+R | Ctrl+Alt+R |
| Command palette | ⌘K | Ctrl+Shift+K |
| Find in terminal | ⌘F | Ctrl+Shift+F |
| Settings | ⌘, | Ctrl+, |
| Next / previous tab | Ctrl+Tab / Ctrl+Shift+Tab | Ctrl+Tab / Ctrl+Shift+Tab |
| Next / previous project | ⌘Alt+↓ / ↑ | Ctrl+Alt+↓ / ↑ |
| Copy / paste | ⌘C / ⌘V | Ctrl+Shift+C / Ctrl+Shift+V |

On Windows/Linux, normal Ctrl+C, Ctrl+D, Ctrl+W and Ctrl+Z remain available to the shell. All shortcuts are also shown in Settings.

## Projects, windows and keeping local work alive

Add a project with its name and root folder from **PROJECTS +**. Every project keeps its own tabs and split layouts. Switch projects with the sidebar or project picker. The **+** in the tab bar opens a chooser for local terminal, Codex and existing server/alias connections. Keyboard users can open a local terminal directly.

A new local terminal, Codex process, split, or additional Orbit window inherits the active local process’s current folder. This is queried from the real process on macOS/Linux and tracked by a prompt hook on Windows PowerShell. For a manually configured SSH/tmux profile, splitting from an existing remote pane also looks up that tmux pane’s current directory. Ordinary SSH aliases retain their own startup command/directory.

**Closing a window or quitting Orbit detaches the GUI; it does not end processes.** A detached local service owns PTYs and a headless terminal per session. Reopening restores projects, windows, tabs, split ratios, screens and the same running processes. The service answers terminal device reports while the GUI is gone, allowing interactive TUIs to continue.

To stop work intentionally, use a pane’s **× / Sessiyani tugatish** and confirm, or choose **Barcha sessiyalarni tugatib chiqish** from the application menu. Multiple panes on the same server get independent remote tmux session names; reconnecting a pane reuses its own name.

This applies while your computer and the local session service remain alive. A reboot, logout, OOM kill or service crash ends local processes. In that case Orbit shows the saved screen as **stopped** and offers an explicit restart rather than silently rerunning a Codex task or claiming the process survived. A remote tmux job may still be available after a local reboot.

Workspaces and bounded terminal-screen snapshots are private local files. Warm reconnection restores the service’s recent scrollback (up to 10,000 rows); disk snapshots retain up to 3,000 rows for stopped-session recovery. Config and snapshots never go to GitHub. Processes already running under Orbit 0.2 cannot be transferred into the new 0.3 service; persistence starts with sessions opened in 0.3.

## Preventing lost SSH work

A keepalive is not an unbreakable connection. Network loss, laptop sleep, server policy or a reboot can still disconnect SSH. Orbit sends an encrypted SSH probe every 15 seconds and tolerates six unanswered probes, helping with idle NAT/firewall timeouts.

New/imported profiles enable **Doimiy sessiya** (persistent session) by default. This requires **tmux on the remote server**. For example, on Ubuntu/Debian, install it there with `sudo apt install tmux`. Orbit does not install packages or change sshd settings automatically. If tmux is absent, it reports the problem instead of silently claiming persistence; disable persistent mode for ordinary SSH.

Orbit creates or attaches a named tmux session per remote pane. Codex uses a separate `-codex` session. When SSH drops or a local tab closes, remote processes can keep running. Reopen Orbit to reattach surviving sessions, or reconnect from the sidebar. Authentication/2FA still applies. Parallel tabs and panels have independent names; reconnecting the same panel attaches to its previous workspace.

**Avtomatik qayta ulanish** retries a previously authenticated connection up to five times with 2/4/8/16/30-second backoff. It does not loop on an initial authentication failure. It can be stopped or disabled per profile. `Ctrl+B`, then `D` detaches tmux intentionally; `exit` ends the remote shell intentionally.

This does not preserve remote work through server reboot, tmux termination, OOM kills, storage loss or enforced admin policies. Local processes survive closing Orbit through the local service, as described above. Auto-discovered plain SSH/shell aliases run as originally configured; enabling remote tmux protection requires a saved profile or tmux in your alias itself.

## Configuration

Click **Open config.json** in the sidebar or settings. Config lives in:

| OS | Path |
| --- | --- |
| macOS | `~/Library/Application Support/Orbit Terminal/config.json` |
| Windows | `%APPDATA%/Orbit Terminal/config.json` |
| Linux | `${XDG_CONFIG_HOME:-~/.config}/Orbit Terminal/config.json` |

Valid edits reload automatically; malformed JSON shows an error while the last valid config keeps running. Shell/Codex/directory changes apply to new sessions. Appearance updates immediately. `codexCommand` is a trusted shell command you control.

```json
{
  "shell": "/bin/zsh",
  "codexCommand": "codex",
  "appearance": {
    "fontSize": 14,
    "theme": "coding",
    "wallpaperMode": "contain",
    "wallpaperOpacity": 0.28,
    "dim": 0.25,
    "sidebar": true,
    "wallpaper": true
  },
  "servers": [
    {
      "id": "production",
      "name": "Production",
      "host": "my-ssh-alias",
      "port": 22,
      "persistent": true,
      "autoReconnect": true,
      "sessionName": "orbit-production"
    }
  ]
}
```

This example is for Mac; Orbit selects the system shell on first run. Windows defaults to the system Windows PowerShell path; it can be changed to PowerShell 7. Port 22 respects a Port configured for an SSH alias; other ports override it. `contain` shows the whole image; `cover` may crop; `fill` stretches.

No credentials, private keys, server inventory or terminal transcripts are bundled or committed. The supplied icon and SVG wallpaper are original project assets; your own wallpapers remain local.

## Build from source

Requirements: **Node 24+**, npm, Python and native C++ build tools (Xcode Command Line Tools on Mac, Visual Studio C++ Build Tools on Windows, `build-essential` on Linux). SSH uses your OS's OpenSSH client. Codex and remote tmux are optional external tools.

```sh
git clone https://github.com/deeorbeck/orbit.git
cd orbit
npm ci
npm test
npm run build
npm run smoke
npm start
```

`npm ci` downloads Electron and rebuilds node-pty for your platform. The smoke test launches the real application twice with the same disposable profile, closes every GUI process in between, and checks identical PTY PIDs, shell variables, cwd, multiple projects, nested splits and native windows. It checks all ten bundled fonts and the connection picker as well. Linux headless CI uses Xvfb. The tmux durability test uses an isolated local socket and verifies that a shell PID and variable survive a dropped PTY and reattachment; it skips if tmux is not installed.

```sh
npm run dist:mac    # run on Mac
npm run dist:win    # run on Windows
npm run dist:linux  # run on Linux
npm run checksums
```

Installers go in `out/`. Build on the target OS for native PTY compatibility. See [release maintenance](docs/RELEASING.md) for the native GitHub Actions matrix and automatic tag-based releases.

## Source map

- `src/main.cjs`, `src/preload.cjs`: native windows, project routing and desktop bridge.
- `src/session-service.cjs`, `src/session-client.cjs`: detached authenticated PTY service.
- `src/workspaces.cjs`, `src/workspace-ui.js`: project/window metadata and nested terminal layouts.
- `src/connections.cjs`: local SSH host and shell-alias discovery.
- `src/shortcuts.cjs`: platform-specific shortcut definitions.
- `src/renderer.js`, `src/index.html`, `src/style.css`: interface.
- `src/themes.cjs`: edit all ten theme palettes here.
- `src/config.cjs`, `src/platform.cjs`: persistence, validation and OS behavior.
- `tests/`: config, SSH, shell/platform and real tmux durability checks.

[Contributions](CONTRIBUTING.md) welcome. See [security notes](SECURITY.md).

## License

[MIT](LICENSE) — Copyright © 2026 Diyorbek Ismoilov. Dependency licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

### Interface language and sidebar

Orbit starts in English. Use **Settings → Language** to switch to **O‘zbekcha** without restarting or stopping sessions. The language preference is stored as `language` (`en` or `uz`) in `config.json`. User project names, SSH aliases and terminal output are never translated.

Use the sidebar button in the top toolbar or **⌘B** on Mac / **Ctrl+Shift+B** on Windows and Linux to hide or reopen the entire project/server sidebar. The preference persists and terminal processes continue running. Theme fonts are available in 0.3 and newer; choose **Theme font · automatic** in Settings to follow each theme.

### Pane and tab navigation

Use **Option + ← / → / ↑ / ↓** to focus the pane in that direction. At the outer edge, focus stays in place. On Mac, **⌘⇧[ / ⌘⇧]** switches tabs and **⌘1–⌘9** selects a numbered tab; Windows/Linux use Ctrl in place of Command. Existing Ctrl+Tab / Ctrl+Shift+Tab shortcuts also remain available.

### Futuristic font collection

Settings → Terminal font includes Share Tech Mono (tech/coding), VT323 (retro), MatrixType (cyber/pixel), Asterisk Mono (sci-fi display) and Orbitron (display), alongside the ten theme fonts. The live preview shows code, ambiguous characters and box drawing. Four new fonts are monospace; Orbitron is proportional and best used as a stylistic display option. Each ships offline with its original license and a source URL / SHA-256 record in `assets/fonts/sources.json`. The first four were downloaded from 1001fonts; Orbitron came from Google Fonts.

### Closing a pane or tab

**⌘W** on Mac / **Ctrl+Shift+W** on Windows and Linux ends only the active pane. **⌘⇧W** / **Ctrl+Alt+Shift+W** ends the current tab and its panes. Live processes require confirmation. A local shell closes its pane on exit, even when its last command returned an error. Successful Codex/SSH exits also close their pane; failed Codex/SSH sessions retain their screen and restart action. **⌘Q** quits the GUI while preserving sessions. Closing a native window without ending its sessions uses **⌘⌥⇧W** / **Ctrl+Alt+W**.

**Ctrl+Tab** and **Ctrl+Shift+Tab** work repeatedly while the terminal input has focus; these key events are intercepted before reaching the PTY. Ordinary Tab, Ctrl+C, Ctrl+D, Ctrl+W and Ctrl+Z retain their shell behavior.

### Private fonts and multiline input

Settings → **Import font…** accepts TTF, OTF, WOFF and WOFF2 files. Imported fonts stay in the private Orbit data folder and appear in the font selector in every window. They are not added to the public source distribution. Font changes apply immediately to existing panes.

Use **Command+scroll** on macOS (**Control+scroll** elsewhere) to resize terminal text. **Shift+Enter** inserts a newline in shell input or Codex; plain **Enter** submits. The workspace footer has been removed to leave more room for terminal content.

### Create your own theme

Open **Settings → New theme** to copy the current appearance. Choose terminal/interface colors, font, size, line height and light/dark mode with a live preview. **Save & use as default** saves the theme and uses it on the next launch. Select a saved theme and choose **Edit theme** to update it. Cancel leaves your current theme unchanged; deleting a custom theme requires a second click.

Custom themes live in `config.json` under `customThemes`. The selected `appearance.theme` is the startup choice. They survive app updates and also support privately imported fonts.

### Home, atmosphere and terminal-only mode

Orbit starts with one home window. **Continue workspace** attaches your saved tabs and processes; secondary saved windows open only when selected. Click the Orbit wordmark to return home. Settings → **Start with one home window** controls this behavior.

Font selection now styles the whole app window. Settings → **Atmosphere** provides font-matched cosmic/matrix/circuit/phosphor/ember/aurora profiles, intensity and independent ambient/typing layers. The toolbar sparkle button or **⌘⌥E / Ctrl+Alt+E** toggles all effects. Abstract typing trails stay behind text, are bounded at the window edges, and never display your keystrokes. Reduced motion is respected.

The expand button or **⌘⇧F / Ctrl+Alt+F** enables **Terminal only**: no titlebar, sidebar, tabs or pane headers. **Escape** restores the previous view and fullscreen state.

New terminal sessions remove inherited runner no-color flags. Applications that were already running keep their existing environment; reopen/resume an existing Codex process when you want it to pick up the color change. Stored plain text is not retroactively recolored.

Right-click the sparkle button (or Commands → **Effect settings**) to open Atmosphere directly. **Visibility** controls brightness from 0–100%, **Motion speed** changes ambient and typing movement from 0.25–3×, and **Particle size** changes their scale from 0.5–2.5×. A live preview shows the result immediately. These settings are saved automatically.

**Trails per keystroke** controls each typing burst from 1–48 (default 16). **Match theme automatically** gives every bundled theme its own atmosphere, including Frost, Solar and Ink; custom themes follow their base theme and accent. **Match font automatically** and explicit styles are also available.

To reopen an older no-color Codex conversation in a clean terminal, choose **Resume Codex** in the new-session picker or Commands. It opens the conversation picker without stopping existing sessions.
