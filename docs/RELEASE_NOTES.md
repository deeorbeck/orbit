## Orbit Terminal 0.3.18 — meaningful tab names

- Name ordinary tabs after their current folder and update them when the directory changes.
- Show CLI/Codex conversation titles instead of the generic Terminal label, removing activity spinners and redundant project suffixes.
- Hide the redundant session header for a single-pane terminal. Split panes retain compact labels and close controls.
- Preserve manual names and persist CLI titles with session snapshots.

## Orbit Terminal 0.3.17 — colors for ordinary terminals and every CLI

- Clear standard inherited Node/Python/no-color flags for all PTYs, including ordinary terminal tabs and commands typed manually.
- Node, Git, Codex and other ANSI-capable CLIs share the same terminal color support; no Codex-specific rendering path is required.
- Preserve TTY-aware detection so redirected/piped output remains plain instead of forcing escape sequences into data files.
- Add an interactive shell regression test covering Node colors, Git diff colors and plain redirected output.

## Orbit Terminal 0.3.16 — denser trails and theme atmospheres

- Set Trails per keystroke from 1–48. The default now emits 16 trails, with bounded rendering and consistent lifetimes.
- All ten themes receive matching background and typing atmospheres. Custom themes follow their base design and accent; Match font and manual styles remain available.
- Add Frost, Solar and Ink styles for Nord, Solarized and Paper.
- Resume Codex from the session picker or Commands in a fresh true-color terminal while retaining conversation history.
- Native tests verify MatrixType renders actual red/green/blue pixels, all theme profiles, exact trail counts and saved preferences.

## Orbit Terminal 0.3.15 — visible, adjustable motion

- Control Visibility (0–100%), Motion speed (0.25–3×) and Particle size (0.5–2.5×) independently in Atmosphere.
- See changes in a live effect preview without typing into a terminal. Right-click the sparkle button to open these controls directly.
- Speed adjusts the shared clock for ambient motion and existing typing trails immediately; circuit profiles now include moving pulses.
- Widen the visibility range, strengthen subtle effects and stop animation entirely at zero visibility. Preferences survive restart.

## Orbit Terminal 0.3.14 — one home, immersive typing

- Start with one home window; continue projects and preserved sessions when ready. Saved secondary windows reopen only when chosen. Click the Orbit wordmark to return home.
- Prevent inherited NO_COLOR runner flags from disabling colors in new terminal/Codex sessions, including when an older session service is still running.
- Apply the selected font throughout Orbit, including branding, controls, tabs and pane headers.
- Font-matched cosmic stars, matrix streams, circuit traces, phosphor, ember and aurora ambience; abstract typing trails travel from the cursor toward window edges behind terminal text.
- Toggle effects from the toolbar or Settings; adjust intensity and ambient/typing layers independently. Rendering pauses when hidden or unfocused and respects reduced motion.
- Terminal only mode hides all chrome and enters fullscreen. Escape restores the prior view without being sent to the terminal.

## Orbit Terminal 0.3.13 — your own themes

- Create a theme from the current appearance in Settings, preview colors live, and edit saved themes.
- Customize terminal and interface colors, imported or bundled fonts, font size, line height and light/dark mode.
- Save & use as default persists the theme before closing the editor. The chosen theme loads automatically on the next launch and applies across windows.
- Cancel preserves the current appearance. Deletion requires a second click and safely falls back to a built-in theme.
- Native tests verify custom theme creation, editing, duplication, cancellation, deletion and startup restoration with an imported font.

## Orbit Terminal 0.3.12 — local fonts and more terminal space

- Import private TTF, OTF, WOFF and WOFF2 fonts in Settings; switch fonts live and keep imports across updates. Distinct CSS families avoid font metadata collisions.
- Remove the workspace footer so terminal content can use the full remaining window height.
- Command+scroll (Control+scroll on Windows/Linux) adjusts terminal font size without scrolling the terminal at the same time.
- Shift+Enter inserts a newline in shell input and sends modified Enter to Codex; ordinary Enter still submits.

## Orbit Terminal 0.3.11 — reliable tab switching and pane closing

- Ctrl+Tab / Ctrl+Shift+Tab repeatedly switch tabs while terminal input has focus, without sending the shortcut into the shell.
- Command+W closes the active pane; Command+Shift+W ends every pane in the current tab. Pane and tab buttons display these shortcuts.
- Command+Q quits Orbit while preserving sessions. Command+Option+Shift+W closes only the native window while preserving sessions.
- Local shell exit closes its pane, including a nonzero exit status or a shell that exits during initial attachment. Failed SSH/Codex sessions retain their output and restart action.
- Serialize close actions with pending pane creation, and prevent duplicate menu/input dispatch and overlapping close requests.
- Native regression checks repeat tab cycling, close a single pane, close a split tab, exit a shell and restore surviving sessions with the same process IDs.

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
