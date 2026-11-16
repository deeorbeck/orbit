## Orbit Terminal 0.2.1

Open-source terminal for coding, Codex and persistent SSH workspaces.

- Real local shell, tabs, split panes, search and a command palette.
- One-click local and remote Codex launch (Codex is installed separately).
- Ten themes: Graphite, Coding, Modern, Futuristic, Midnight, Warm, Dracula, Nord, Solarized and Paper.
- Custom wallpapers with fit/fill/stretch and live brightness controls.
- SSH profiles, key selection, SSH config import and editable live JSON configuration.
- 15-second SSH keepalives, named remote tmux sessions, and bounded automatic reconnection after an established connection drops.
- Cross-platform desktop tests wait for shell readiness and completed text insertion before submitting commands.

### Download

Choose a file for your operating system:

- **Windows x64:** `windows-x64-setup.exe` — guided installer.
- **Apple Silicon Mac:** `macos-arm64.dmg` — drag Orbit to Applications.
- **Intel Mac:** `macos-x64.dmg`.
- **Linux x64:** `.AppImage` (portable) or `.deb` (Debian/Ubuntu).
- `.zip` files are alternative Mac application bundles. `SHA256SUMS.txt` contains download checksums.

### Requirements and current limits

The Windows build uses PowerShell; Mac/Linux use a login shell. OpenSSH must be installed for SSH. Codex must be installed/authenticated separately, including on a remote server when used there. Persistent remote sessions require `tmux` on the server; Orbit reports a missing tmux instead of silently claiming durability. Keepalive cannot guarantee a network connection; tmux allows reattachment while the server and its processes remain alive.

These initial community installers have no commercial Windows code signature or Apple notarization; macOS apps use an ad-hoc signature. OS trust dialogs may appear. Source, tests and build workflows are included under the MIT license.

UI language is currently Uzbek. Running local processes are not restored after closing the app. Remote tmux workspaces can be reattached.
