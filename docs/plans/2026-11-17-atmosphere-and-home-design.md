# Orbit atmosphere, home and terminal-only mode

New launches open one home window. Existing projects, layouts, dormant windows and PTY processes remain stored; Continue workspace lazily attaches the main workspace and saved windows open only on explicit selection. A startup preference can restore the previous multiwindow behavior. Clicking the Orbit wordmark returns home.

Remove inherited runner NO_COLOR flags from new PTYs. A private Unix shell launcher also fixes sessions created through an already-running older service, without killing existing shells. Existing running applications retain their environment until restarted; stored output is not recolored artificially. Verify actual RGB spans through native terminal rendering.

The selected terminal family becomes the font across the window, including Orbit branding, tabs, sidebar and settings. Theme/font previews keep their intentional preview family. Font-derived profiles select cosmic, matrix, circuit, phosphor, ember or aurora atmosphere and a matching cursor style. Each font's deterministic seed varies its environment. Explicit profile override and intensity/ambient/typing controls live in Settings; one toolbar button or shortcut disables the entire effects layer.

Render abstract typing trails from the active cursor to bounded screen-edge destinations on a transparent canvas below text. Never draw typed characters, including password input. Limit active trails to 100, render at 30 fps, cap DPR at 2, pause when hidden/unfocused and respect reduced motion. Keep particle brightness low and leave all text colors and glyph rendering intact.

Terminal-only mode hides every app header, tab strip, sidebar and pane label, enters native fullscreen, and restores the previous fullscreen state with Escape. Escape is intercepted before the PTY when leaving this mode. Preserve existing session processes during installation.

Native QA covers no-color environment cleanup, truecolor DOM output, whole-window font updates, effect emission/toggle clearing, mode/Escape, custom themes and GUI persistence, then a separate startup phase checks one home window without creating any new PTY.
