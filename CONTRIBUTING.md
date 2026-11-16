# Contributing to Orbit

Orbit is MIT licensed. Issues, fixes and pull requests are welcome.

1. Fork the repository and create a branch.
2. Use Node 24+ and the native build tools for your OS.
3. Run `npm ci`, `npm test`, `npm run build`, and `npm run smoke`.
4. Open a pull request explaining the resulting behavior and how you tested it.

## Code map

- `src/main.cjs`: native window, SSH, PTYs and file dialogs.
- `src/preload.cjs`: narrow isolated desktop bridge.
- `src/renderer.js`, `src/index.html`, `src/style.css`: interface.
- `src/themes.cjs`: all ten design palettes.
- `src/config.cjs`, `src/platform.cjs`: config and platform behavior.
- `tests/`: SSH argument safety, config, platform flags and tmux durability.
- `.github/workflows/`: CI and versioned installer releases.

Keep remote terminal output out of HTML. Use text nodes for user/server names.
Do not add telemetry, store passwords, bypass SSH host-key verification or run
server installation commands automatically. Native features stay in the main
process; the renderer stays isolated and sandboxed.

Tests use disposable local profiles and an isolated tmux socket. They must never
connect to a contributor's real servers or alter their SSH configuration.

See [RELEASING.md](docs/RELEASING.md) for release maintenance.
