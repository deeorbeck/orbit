# Project workspaces and surviving application exit

## Accepted scope

Projects own multiple shell, Codex and SSH tabs. Tabs support horizontal/vertical
split trees. Additional native windows can show independent project workspaces.
Reopening Orbit restores windows, projects, layouts and the same running PTYs.
New local terminals inherit the active local shell's actual working directory.
Every pane and tab shows a session-type icon and a current folder. Keyboard
actions cover projects, windows, tabs and panes. Themes include bundled fonts.

## Approach

Saving UI JSON alone restores layout but cannot keep a local process alive.
Requiring local tmux excludes Windows and adds a system dependency. A detached,
authenticated local session service is the selected cross-platform approach.
Remote tmux remains useful when the SSH network connection itself is lost.

## Session service

An Electron Node-mode process owns node-pty and a headless xterm per session.
The GUI is a client over a private Unix socket or Windows named pipe with a
random per-user token. The service has no TCP listener. The GUI can detach and
exit without killing PTYs. Explicitly ending a pane kills that session only.
The service serializes screen, alternate buffer and terminal modes on attach.
Workspace metadata and bounded screen snapshots are atomic, private local files.
Dead sessions after a reboot/service crash are shown as stopped, not claimed to
still be running. The user can restart them explicitly with their previous cwd.

Current cwd comes from OSC 7/1337 shell output, Linux /proc, macOS lsof, and a
PowerShell prompt hook. A process-generated remote OSC path is display-only and
never becomes a local path. Remote tmux names include the pane id so parallel
server/Codex tabs are separate while reconnecting reuses the same remote name.

## Interface

Keep Orbit's graphite/copper identity. Replace the single folder button with a
project switcher and add/edit controls. Project tabs and hierarchical splits
occupy the main canvas; a persistent pane header exposes type, cwd, restart and
end actions. Terminal / Codex / SSH / SSH+Codex have distinct marks and labels.
Theme cards preview their actual bundled monospace families. Appearance controls
include an optional font override; otherwise the chosen theme selects its font.

## Verification

Service integration tests detach, exit the parent GUI, reconnect and verify the
same shell PID, variables, cwd, scrollback and alternate-screen content. GUI
tests relaunch the app using the same isolated profile and verify restored
project/window/tab/split metadata. Native CI covers Windows, Linux and Mac.
Existing private terminal sessions are not force-terminated for installation.
