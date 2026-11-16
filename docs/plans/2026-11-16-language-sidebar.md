# English default and sidebar controls

Use English for new and existing configurations unless the user explicitly selects Uzbek. Keep translations in a shared message catalog with English keys and preserve interpolation fields. Translate only Orbit UI messages; user project names, aliases, paths and PTY output retain their original content.

Settings exposes English / O‘zbekcha and saves the choice in config.json. Language changes update all windows and native menus without reloading terminals. Add a toolbar sidebar control that stays available when the whole project/server sidebar is hidden. Reuse the existing sidebar action, shortcut and persisted appearance setting.

Validate localization fields and config fallback, then exercise real Electron UI language changes, sidebar width, saved preferences and unchanged process PIDs. Run existing native persistence and bundled font checks before releasing installers.
