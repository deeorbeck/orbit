## Orbit Terminal 0.3.9 — reliable tab switching and pane closing

- Intercept Ctrl+Tab / Ctrl+Shift+Tab before Chromium or xterm forwards them to the shell, including after focus moves into a different terminal.
- Command+W closes the active pane; Command+Shift+W closes the current tab. Closing a native window while keeping its sessions uses Command+Option+Shift+W.
- Local shell exit closes its pane automatically, including a nonzero last status. Failed Codex/SSH and stopped sessions keep their screen and restart action.
- Track keyboard focus inside a pane and show close shortcuts on pane/tab buttons.
- Native regression checks cycle through tabs eight times with terminal input focused, then close a pane, tab and shell without quitting Orbit.

## Orbit Terminal 0.3.8 — futuristic font collection

- Bundle Share Tech Mono, VT323, MatrixType and Asterisk Mono from 1001fonts, plus Orbitron from Google Fonts. All original license notices are included.
- Choose among 15 fonts in Settings with a live code preview. Orbitron is labeled as a display face because it is proportional.
- Native smoke tests load and apply each additional font offline, then verify existing workspace persistence and pane navigation.

## Orbit Terminal 0.3.7 — small-pane input and iTerm-style navigation

- Includes visible input in small splits, live-bottom restoration, Option-arrow pane navigation and Command bracket / number tab shortcuts.
- Verify navigation using actual panel geometry, including layouts whose nested split is on the left.
- Includes pending-preference protection from 0.3.6.

## Orbit Terminal 0.3.6 — terminal input, navigation and reliable preferences

- Includes visible input in small panes, restored live-bottom position, directional Option-arrow navigation and numbered / bracket tab shortcuts.
- Preserve pending local preferences when an older config notification arrives. Rebuild native menus only when the interface language changes.

## Orbit Terminal 0.3.5 — terminal input and navigation

- Includes all small-pane input, live-bottom restoration and keyboard navigation fixes.
- Wait for saved theme and source-pane activation in native smoke tests to avoid racing asynchronous UI updates on slower runners.

## Orbit Terminal 0.3.4 — verified pane navigation and visible input

- Includes the small-pane input geometry, live-bottom restoration and Option-arrow / tab navigation fixes from 0.3.2–0.3.3.
- Native navigation tests explicitly activate their source pane before exercising the shortcut.

## Orbit Terminal 0.3.3 — restore the visible input position

- Reattached sessions open at the live terminal bottom. Resizing follows the bottom when already there, while preserving intentional scrollback browsing.
- Includes the small-pane geometry and Option-arrow / numbered-tab navigation fixes from 0.3.2.

## Orbit Terminal 0.3.2 — small-pane input and terminal navigation

- Fix terminal geometry counting the mount padding as usable rows and columns. The bottom prompt and cursor now fit inside small nested splits.
- Option + arrow keys focus the pane in that direction. Command + Shift + brackets switches tabs; Command + 1–9 selects a numbered tab.
- Exercise a 900 × 560 window, nested panes and scrolling output in the native desktop smoke test.

## Orbit Terminal 0.3.1 — English interface and sidebar control

- English is now the default interface language, with Uzbek available in Settings. Language changes apply live across windows and are saved locally.
- Menus, settings, dialogs, commands, session status and accessibility labels use the selected language. Project names, aliases and terminal output stay untouched.
- A toolbar button hides or reopens the entire left sidebar. The existing keyboard shortcut and saved preference use the same action.
- Theme fonts require 0.3 or newer; legacy default system font settings migrate to automatic theme fonts.

### Also included from 0.3.0

- Multiple projects, each with shell, Codex and SSH tabs.
- Nested side-by-side and top/bottom splits, up to 12 panes per tab, plus additional native Orbit windows.
- A detached authenticated local service keeps the same terminal processes alive when all Orbit GUI windows quit. Reopening restores projects, windows, layouts, terminal screens and live PIDs.
- New local terminals/Codex/splits/windows inherit the active process’s actual cwd. Remote tmux splits inherit the source remote pane directory.
- Existing SSH Host aliases and zsh/bash SSH aliases automatically appear in the new-session chooser. Existing SSH keys/agents are reused; no passwords or keys are copied into the app.
- Distinct Terminal, Codex, SSH and SSH+Codex icons, cwd headers, renamed tabs and expanded shortcuts.
- Ten themes now include ten bundled open-license fonts, with a per-user font override option.
- Expanded native tests close and relaunch the GUI, checking the same process PIDs, variables, cwd, nested layouts and two native windows. Packaged applications are tested before release too.

### Download

- Windows x64: `windows-x64-setup.exe`.
- Apple Silicon / Intel Mac: `macos-arm64.dmg` / `macos-x64.dmg`.
- Linux x64: `linux-x86_64.AppImage` or `linux-amd64.deb`.
- Alternative Mac ZIP bundles and `SHA256SUMS.txt` are included.

### Important behavior

Closing Orbit now keeps local processes running. End a pane explicitly or use **Barcha sessiyalarni tugatib chiqish** to stop them. A reboot/logout/service crash still ends local processes; stopped sessions show their saved screen and require an explicit restart. Private bounded screen snapshots are stored locally. Sessions opened by 0.2 cannot be transferred into the new service; persistence begins with sessions opened by 0.3.

Remote tmux protection still requires tmux on the server. Ordinary discovered aliases run exactly as configured, without automatic tmux injection. Codex is installed/authenticated separately. The UI defaults to English, with Uzbek available in Settings. Mac builds are ad-hoc signed without Apple notarization; Windows installers have no commercial signing certificate. Source code is MIT licensed; bundled fonts carry their own OFL notices.
