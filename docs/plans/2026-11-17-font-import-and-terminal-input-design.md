# Local fonts and terminal input

Add private font import in Settings instead of redistributing user downloads. Store originals in the existing private app data folder and load them through scoped font URLs with content-based CSS family names. This keeps two fonts with identical internal family names independently selectable. Imports and the selected family survive app updates; all windows receive the font catalog changes.

Remove the workspace footer and its DOM updates so the terminal receives its full remaining height. Keep session indicators and close controls in each pane header.

Command-wheel changes the existing font-size preference on macOS; Control-wheel provides the equivalent elsewhere. Coalesce small trackpad deltas and prevent simultaneous terminal scroll. Explicitly load selected fonts before refreshing terminal geometry.

Shift+Enter sends modified Enter to Codex. In ordinary shells it inserts a pasted newline with bracketed paste, or a quoted newline when bracketed paste is unavailable. Plain Enter retains submit behavior. Validate native key delivery, font loading and selection, zoom, small-pane geometry, and persistence in isolated profiles before installing the Mac update.
