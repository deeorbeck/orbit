# Orbit Terminal

Personal macOS desktop terminal for Diyorbek: Codex, SSH servers, easy editing.

## Architecture
Electron main process owns node-pty sessions, file dialogs, SSH profiles and config.
Sandboxed isolated renderer uses xterm.js through a narrow preload API.
No network UI, telemetry, password storage or automatic server connections.
SSH uses the system OpenSSH client with argument arrays and its normal host-key prompts.

## Interface
Graphite canvas, cool slate navigation, warm copper accents tied to the black-hole wallpaper.
System UI typography, SF Mono/Menlo terminal. Compact titlebar, server sidebar,
workspace tabs, resizable split panes, status footer. Real terminal takes almost all space.
Settings drawer updates wallpaper fit/opacity, terminal font and sidebar immediately.
Command palette exposes keyboard actions. JSON configuration can be opened in an editor.

## Persistence
Atomic config.json under Electron userData. Validate all loaded and edited values.
File watcher reloads valid external edits; preserve last valid state on invalid edits.
Persist server definitions and appearance, never terminal content or passwords.

## Verification
Node tests cover normalization and SSH argument safety. Desktop integration checks
real PTY input/output, resize, tabs/split, settings persistence, JSON live edits,
and Codex availability. SSH is tested against an isolated local test server if available;
never contact the user's servers during automated checks.

## Scope
Deliver installable local arm64 app and editable source. v0.1 is a focused working
terminal, not a claim of feature/performance parity with every iTerm capability.
