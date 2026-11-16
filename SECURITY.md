# Security

Orbit executes the commands you type with your operating-system account's permissions, like any terminal. Treat shell commands, SSH profiles, `codexCommand`, and config edits as trusted local input.

Orbit does not store passwords or private key contents, disable SSH host-key checks, or send telemetry. Private key paths are stored in your own config; protect that file as you would your SSH configuration. Renderer isolation, sandboxing, local-only UI assets and a narrow preload bridge are enabled.

From 0.3, the local session service keeps PTYs alive after all GUI windows exit.
It communicates only through a Unix socket or Windows named pipe and authenticates
with a private per-user random token; it has no TCP listener. Workspace metadata
and bounded terminal-screen snapshots are stored in Orbit's local data directory
with private file permissions. Terminal output may contain sensitive information;
protect the data directory accordingly. Explicitly end a pane or choose the
application menu's "Barcha sessiyalarni tugatib chiqish" to stop local processes.

SSH Host aliases and local shell SSH aliases are discovered on your machine.
They are not sent to GitHub. Selecting a shell alias runs that named alias through
your own interactive login shell, preserving your existing agent/key setup.

For a security report, use GitHub's private vulnerability reporting on the repository if enabled. Do not post credentials, tokens or private server details in a public issue. Maintainers can enable private vulnerability reporting at repository Settings → Code security → Private vulnerability reporting.

The initial community installers are not signed with a commercial Windows certificate or notarized by Apple. macOS builds are ad-hoc signed. Download only from this repository's Releases page and verify the published SHA-256 checksums. These checksums confirm file integrity, not an independent audit of the software.
