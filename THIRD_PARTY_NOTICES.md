# Third-party notices

Orbit's application code, original orbital icon, and bundled SVG wallpaper are MIT licensed. User-selected wallpapers are not part of this repository or license.

Orbit uses these open-source projects. Their licenses remain applicable:

| Project | License | Source |
| --- | --- | --- |
| Electron | MIT, plus Chromium and bundled component licenses | https://github.com/electron/electron |
| xterm.js, Fit and Search addons | MIT | https://github.com/xtermjs/xterm.js |
| node-pty | MIT | https://github.com/microsoft/node-pty |
| node-addon-api | MIT | https://github.com/nodejs/node-addon-api |

Installer bundles retain Electron's `LICENSE` and `LICENSES.chromium.html` and dependency license files in `resources/app/node_modules`. The bundled renderer retains upstream license notices. Build tools are development dependencies and are not shipped as part of the application.

Ten bundled font families are distributed under their SIL Open Font License:
IBM Plex Mono, JetBrains Mono, Geist Mono, Space Mono, Fira Code, Source Code Pro,
Victor Mono, Roboto Mono, Inconsolata and Cutive Mono. Original OFL notices, source
URLs and SHA-256 hashes are in `assets/fonts/`. Font binaries are unmodified;
their own licenses apply independently of Orbit's MIT license.
