# Releasing Orbit

## Build locally

Use Node 24+. `npm ci` downloads Electron and rebuilds native PTY dependencies for the host OS. Install Xcode Command Line Tools on macOS, Visual Studio C++ Build Tools/Python on Windows, or `build-essential`/Python on Linux.

```sh
npm test
npm run smoke
npm run dist:mac    # run on macOS
npm run dist:win    # run on Windows
npm run dist:linux  # run on Linux
npm run checksums
```

Build artifacts are written to `out/`. Native PTY binaries must be built for the target platform and architecture. Use native CI runners rather than copying a Mac binary into a Windows/Linux installer.

## Publish all platforms

1. Update `package.json` and the root version in `package-lock.json` together (`npm version patch --no-git-tag-version` is useful).
2. Update `docs/RELEASE_NOTES.md`.
3. Commit to `main` and wait for CI.
4. Create and push a matching tag, e.g. `git tag v0.3.0 && git push origin v0.3.0`.
5. The Release workflow builds on native macOS ARM/Intel, Windows x64 and Linux x64 runners. Each job runs unit tests and a real two-launch desktop/PTY smoke test, builds installers, then repeats the persistence test against the packaged application.
6. After every build succeeds, a single publish job creates the GitHub Release, uploads all installers and publishes `SHA256SUMS.txt`. Only that job has `contents: write` permission; no personal access token is needed.

A failed platform job prevents publication of a partial new release. Fix the issue in a new patch version/tag. Existing tags are not force-moved. To rebuild the same existing tag after an infrastructure failure, run the Release workflow manually with its tag input.

## Signing

Current Mac builds are ad-hoc signed, Windows installers are unsigned. This is stated on the download page. Proper public trust requires the maintainer's Apple Developer ID/notarization and Windows signing credentials. No credentials are committed. Add signing via GitHub Actions secrets and update the builder configuration before promising notarized/signed downloads. Automatic app updates are not implemented; users download new releases from GitHub.
