# Colors belong to every terminal

Use one environment policy for every PTY and ordinary login shell, independent of whether Orbit launches Codex directly or the user types a CLI command. Clear inherited NO_COLOR, NODE_DISABLE_COLORS, ANSI_COLORS_DISABLED, PYTHON_COLORS and disabling force flags while declaring xterm-256color/truecolor and enabling standard TTY color detection. The private Unix launcher keeps this working with an older detached session service.

Do not force ANSI into redirected output: programs still decide based on their TTY/configuration. Verify Node inspection and ordinary Git diff from an interactive shell, then verify output redirected to a file stays plain. Also launch Codex by typing its command into an ordinary terminal, not through a Codex-only path.

Preserve existing processes. An already-running shell retains its inherited environment, so provide a fresh ordinary Terminal tab with the same working directory instead of injecting commands into user drafts or stopping active CLIs. Existing tabs remain available.
