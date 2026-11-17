# Custom themes and startup persistence

Replace the built-in-only theme lookup with a catalog containing the ten bundled themes and up to fifty validated custom themes from config.json. Preserve legacy settings, imported font families, and existing workspace/session data. Custom IDs have a separate namespace, and colors accept only six-digit hex values. Invalid or deleted startup IDs fall back to Graphite.

Add New theme and Edit theme to the current Settings theme section. New theme copies the active appearance; edits operate on a draft with a live terminal preview. Expose terminal/interface colors, light mode, font, size and line height. Cancel discards the draft. Save & use as default writes the complete theme and selected appearance atomically before closing. Theme selection persists as the startup choice, and config notifications refresh other windows. Deletion requires a second click and preserves other saved themes.

Use existing Orbit typography, dialog chrome and palette. The signature is the live terminal preview, with the actual selected font and background. Keep colors in a compact two-column grid, collapsing to one column in smaller windows; keep save/cancel controls outside the scroll area.

Validate config sanitization and disk reload, then exercise create, edit, cancel, duplicate, delete and GUI restart in an isolated native app profile. Confirm that an imported font, palette and startup selection survive a full GUI quit alongside existing process IDs and nested workspaces. Install the verified Mac build in /Applications and keep backups outside app discovery.
