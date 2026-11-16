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
