# Orbit Terminal

An MIT-licensed desktop terminal for **coding, Codex and persistent SSH workspaces**.
Built with Electron, xterm.js and node-pty. The interface is currently in Uzbek.

[Download the latest release](https://github.com/deeorbeck/orbit/releases/latest) · [Report an issue](https://github.com/deeorbeck/orbit/issues) · [Contribute](CONTRIBUTING.md)

## Downloads

| Platform | Download | Install |
| --- | --- | --- |
| Windows 10/11 x64 | `Orbit-Terminal-*-windows-x64-setup.exe` | Run the guided installer |
| macOS Apple Silicon | `Orbit-Terminal-*-macos-arm64.dmg` | Drag Orbit Terminal to Applications |
| macOS Intel | `Orbit-Terminal-*-macos-x64.dmg` | Drag Orbit Terminal to Applications |
| Linux x64 | `Orbit-Terminal-*-linux-x64.AppImage` | Make executable and run |
| Debian / Ubuntu x64 | `Orbit-Terminal-*-linux-x64.deb` | `sudo apt install ./Orbit-Terminal-*.deb` |

Installers and SHA-256 checksums are published on the [Releases page](https://github.com/deeorbeck/orbit/releases). Linux AppImage may require FUSE; the `.deb` is an alternative on Debian-based systems. Mac builds target macOS 13+.

The initial community builds have no commercial Windows certificate or Apple notarization; Mac apps are ad-hoc signed. OS trust prompts may appear. Download from this repository and check `SHA256SUMS.txt`. Automatic app updates are not implemented.

## Features

- **Real terminals:** login shell on Mac/Linux, PowerShell on Windows, 15,000-line scrollback, terminal search, tabs and up to three resizable split panes.
- **Codex:** one-click local launch in your chosen directory, or a separate Codex workspace on an SSH server. Codex is installed/authenticated separately.
- **Servers:** saved SSH profiles, private-key path selection, system SSH agent/config support and Host alias import. Passwords, passphrases and host-key prompts stay in the terminal.
- **Durable remote work:** 15-second SSH keepalives, named tmux sessions, manual reattachment and bounded automatic reconnection after an established connection drops.
- **10 designs:** Graphite, Coding, Modern, Futuristic, Midnight, Warm, Dracula, Nord, Solarized and Paper. Themes change UI/terminal colors and selected type/shape details.
- **Your background:** fit the entire image, fill or stretch it; change brightness, dimming, fonts and sidebar live.
- **Easy editing:** one `config.json`, with valid external edits reloaded automatically. No cloud service or telemetry.

### Keyboard

| Action | Mac | Windows / Linux |
| --- | --- | --- |
| New terminal | ⌘T | Ctrl+Shift+T |
| New Codex tab | ⌘Shift+N | Ctrl+Shift+N |
| Split pane | ⌘D | Ctrl+Shift+D |
| Close pane | ⌘W | Ctrl+Shift+W |
| Command palette | ⌘K | Ctrl+Shift+K |
| Find in terminal | ⌘F | Ctrl+Shift+F |
| Settings | ⌘, | Ctrl+, |
| Next tab | Ctrl+Tab | Ctrl+Tab |
| Copy / paste | ⌘C / ⌘V | Ctrl+Shift+C / Ctrl+Shift+V |

On Windows/Linux, normal Ctrl+C, Ctrl+D and Ctrl+W remain available to the shell. Closing a pane stops local commands in it; remote tmux work continues if the server is alive.

## Preventing lost SSH work

A keepalive is not an unbreakable connection. Network loss, laptop sleep, server policy or a reboot can still disconnect SSH. Orbit sends an encrypted SSH probe every 15 seconds and tolerates six unanswered probes, helping with idle NAT/firewall timeouts.

New/imported profiles enable **Doimiy sessiya** (persistent session) by default. This requires **tmux on the remote server**. For example, on Ubuntu/Debian, install it there with `sudo apt install tmux`. Orbit does not install packages or change sshd settings automatically. If tmux is absent, it reports the problem instead of silently claiming persistence; disable persistent mode for ordinary SSH.

Orbit creates or attaches a named tmux session per server profile. Codex uses a separate `-codex` session. When SSH drops or a local tab closes, remote processes can keep running. Reconnect from the sidebar or click **Sessiyani davom ettirish** to reattach. Authentication/2FA still applies. Multiple tabs for one profile share the same named workspace; use separate profile/session names for independent workspaces.

**Avtomatik qayta ulanish** retries a previously authenticated connection up to five times with 2/4/8/16/30-second backoff. It does not loop on an initial authentication failure. It can be stopped or disabled per profile. `Ctrl+B`, then `D` detaches tmux intentionally; `exit` ends the remote shell intentionally.

This does not preserve work through server reboot, tmux termination, OOM kills, storage loss or enforced admin policies. Local processes are not restored after quitting Orbit.

## Configuration

Click **config.json’ni ochish** in the sidebar or settings. Config lives in:

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

`npm ci` downloads Electron and rebuilds node-pty for your platform. The smoke test launches the real application with a disposable profile and checks a real shell, all themes, tabs, splits, the wallpaper and config persistence. Linux headless CI uses Xvfb. The tmux durability test uses an isolated local socket and verifies that a shell PID and variable survive a dropped PTY and reattachment; it skips if tmux is not installed.

```sh
npm run dist:mac    # run on Mac
npm run dist:win    # run on Windows
npm run dist:linux  # run on Linux
npm run checksums
```

Installers go in `out/`. Build on the target OS for native PTY compatibility. See [release maintenance](docs/RELEASING.md) for the native GitHub Actions matrix and automatic tag-based releases.

## Source map

- `src/main.cjs`, `src/preload.cjs`: desktop bridge and PTY/SSH lifecycle.
- `src/renderer.js`, `src/index.html`, `src/style.css`: interface.
- `src/themes.cjs`: edit all ten theme palettes here.
- `src/config.cjs`, `src/platform.cjs`: persistence, validation and OS behavior.
- `tests/`: config, SSH, shell/platform and real tmux durability checks.

[Contributions](CONTRIBUTING.md) welcome. See [security notes](SECURITY.md).

## License

[MIT](LICENSE) — Copyright © 2026 Diyorbek Ismoilov. Dependency licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
