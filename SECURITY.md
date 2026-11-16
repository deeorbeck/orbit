# Security

Orbit executes the commands you type with your operating-system account's permissions, like any terminal. Treat shell commands, SSH profiles, `codexCommand`, and config edits as trusted local input.

Orbit does not store passwords or private key contents, disable SSH host-key checks, or send telemetry. Private key paths are stored in your own config; protect that file as you would your SSH configuration. Renderer isolation, sandboxing, local-only UI assets and a narrow preload bridge are enabled.

For a security report, use GitHub's private vulnerability reporting on the repository if enabled. Do not post credentials, tokens or private server details in a public issue. Maintainers can enable private vulnerability reporting at repository Settings → Code security → Private vulnerability reporting.

The initial community installers are not signed with a commercial Windows certificate or notarized by Apple. macOS builds are ad-hoc signed. Download only from this repository's Releases page and verify the published SHA-256 checksums. These checksums confirm file integrity, not an independent audit of the software.
