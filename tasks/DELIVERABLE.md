# Leena macOS Deliverables

Updated: 2026-06-04 01:49:45 EDT

This manifest records macOS artifact checkpoints. `dist/` binaries are ignored local build outputs and are not committed. Wave 23 rebuilt the current `0.1.2` artifacts after the post-MVP UI and integration gates. The Wave 23 build is unsigned/ad-hoc, not notarized, and was not GUI-launched by automation.

## Current Local Post-MVP Build

| Artifact | Task | Path | SHA-256 | Size |
| --- | --- | --- | --- | --- |
| Local DMG | task 146 | `dist/Leena-0.1.2-arm64.dmg` | `2cbc7ed5f696941a9e4c63bded6daf7c0c5d5855b7a9cab28c7a645ef009d906` | 128566660 bytes |
| Local ZIP/update package | task 146 | `dist/Leena-0.1.2-arm64-mac.zip` | `5b7fbd7f908d4a4f4b63d08b13220a4ebfbe40eb21b2c6f43654e45c9c29972b` | 124425803 bytes |
| Local updater manifest | task 146 | `dist/latest-mac.yml` | `b1d4cf7af5c32a773c60c0a9d25f50a92278230fdd9ff3c3f504544122fd7734` | 499 bytes |
| Local DMG blockmap | task 146 | `dist/Leena-0.1.2-arm64.dmg.blockmap` | `47f01a2e83dbd49954ff5492bf1dc160956c31995254a38e27e0bde3109c5da7` | 135136 bytes |
| Local ZIP blockmap | task 146 | `dist/Leena-0.1.2-arm64-mac.zip.blockmap` | `9a2e24f574e7fd0650851e296c658e9531304f6e515123c6e7450b4d50914f1c` | 131269 bytes |

`dist/latest-mac.yml` points its update path to `Leena-0.1.2-arm64-mac.zip` and records release date `2026-06-04T05:47:16.925Z`.

## Previous Published Release Checkpoint

These values are retained because Wave 23 regenerated the same standard `dist/` filenames with new local hashes. This table identifies the earlier GitHub release lane, not the current local files.

| Artifact | Task | Path | SHA-256 | Size |
| --- | --- | --- | --- | --- |
| GitHub release DMG | release 0.1.2 | `dist/Leena-0.1.2-arm64.dmg` | `00c5ffc22a649180cd2e27a5657eda531d2111a7d0c2c7564552508b76cb125c` | 128496163 bytes |
| GitHub release ZIP/update package | release 0.1.2 | `dist/Leena-0.1.2-arm64-mac.zip` | `2c40cdc59ab49573fd318e3c8b4d9e9cfe757873513028ecf11ac77d98ad97bc` | 124384567 bytes |
| GitHub updater manifest | release 0.1.2 | `dist/latest-mac.yml` | `2aaec37ab46a9c74a100ba1c16e5f8e4070309bb24741261298ab61b10d9b1a9` | 499 bytes |
| DMG blockmap | release 0.1.2 | `dist/Leena-0.1.2-arm64.dmg.blockmap` | `64ddaddfccd50170fa94194f34802e8bccd6ea5c9f547014b357d3e31ed9e896` | 135142 bytes |
| ZIP blockmap | release 0.1.2 | `dist/Leena-0.1.2-arm64-mac.zip.blockmap` | `1de7d0bd5a12dedafd4ee704cf8c9691b738c659b5f764f880c81433ba57e0ee` | 130897 bytes |

GitHub release URL: `https://github.com/yasminat-codes/leena/releases/tag/v0.1.2`

## Dependency Handoff Confirmation

- Task 144 is completed. `tasks/artifacts/post-mvp-ui-regression/manifest.json` and 16 PNG screenshots are present under `tasks/artifacts/post-mvp-ui-regression/`. The task handoff records focused screenshot proof passed 2/2 and full `node --test` passed 631/631; permission-prompt-specific screenshots remain outside that suite.
- Task 145 is completed. `tasks/artifacts/post-mvp-integration-test-matrix.md` and `test/post-mvp-integration-matrix.test.js` are present. The task handoff records fake-only resources, no real owner credentials or Apple Calendar mutations, focused matrix suite 6/6, `npm run check`, full `node --test` 637/637, and `git diff --check`.

## Search And Build Gates

- `kencode-search`: run before file edits. It found only generic external `CSC_IDENTITY_AUTO_DISCOVERY=false` and `hdiutil imageinfo` references, with no reusable snippet for this repo; this task follows the local Wave 16 packaging convention.
- `npm run check`: first attempt failed because the clean worktree had no installed local `biome` binary. After `npm ci`, rerun passed: Biome checked 187 files with no fixes applied.
- `node --test`: passed 637/637.
- `git diff --check`: passed before build.
- `CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac`: passed. Electron Builder used ad-hoc signing and skipped notarization because notarize options were unavailable.
- `codesign -dv --verbose=4 dist/mac-arm64/Leena.app`: `Signature=adhoc`, `TeamIdentifier=not set`, flags include `adhoc,runtime`.
- `codesign --verify --deep --strict --verbose=2 dist/mac-arm64/Leena.app`: passed, valid on disk.
- Owner GUI launch smoke was not run by automation.

## Headless Structural Verification

- `dist/Leena-0.1.2-arm64.dmg` exists and is non-zero.
- `dist/Leena-0.1.2-arm64-mac.zip` exists and is non-zero.
- `dist/latest-mac.yml` exists and points update path to `Leena-0.1.2-arm64-mac.zip`.
- `hdiutil verify dist/Leena-0.1.2-arm64.dmg`: passed, checksum valid, CRC32 `$E6A32A57`.
- `hdiutil imageinfo dist/Leena-0.1.2-arm64.dmg`: passed, format `UDZO`, read-only compressed zlib image, encrypted `false`, software license agreement `false`.
- Read-only DMG mount: passed.
- DMG layout: `Leena.app` plus `Applications` symlink to `/Applications`.
- DMG app executable: `Leena.app/Contents/MacOS/Leena` present and executable.
- DMG package contents: `app.asar` present, 21 renderer fonts packaged inside `app.asar`, and 5 unpacked native binaries under `app.asar.unpacked`.
- ZIP structure: extracted with `ditto`; `Leena.app/Contents/MacOS/Leena` present and executable.
- ZIP package contents: `app.asar` present, 21 renderer fonts packaged inside `app.asar`, and 5 unpacked native binaries under `app.asar.unpacked`.
- Unpacked native binaries: `@nut-tree-fork/libnut-darwin/build/Release/libnut.node`, `@nut-tree-fork/libnut-linux/build/Release/libnut.node`, `@nut-tree-fork/libnut-win32/build/Release/libnut.node`, `@nut-tree-fork/node-mac-permissions/build/Release/permissions.node`, and `fsevents/fsevents.node`.

## Owner Manual GUI Smoke Checklist

These checks require an owner GUI session and are not autonomous completion gates. Leave them unchecked until the owner performs them.

- [ ] Install from `Leena-0.1.2-arm64.dmg` by dragging `Leena.app` to `/Applications`.
- [ ] If Gatekeeper blocks the unsigned build, run `xattr -cr /Applications/Leena.app`, then right-click Leena and choose Open.
- [ ] Launches from `/Applications` without Terminal.
- [ ] Voice startup enters the expected starting state without crashing.
- [ ] Voice listening state captures the expected microphone/session affordance.
- [ ] Voice error state gives a clear recoverable error path.
- [ ] Chat can send a message, append streamed output, update history, and reopen a conversation detail.
- [ ] Composio credential save/load path works with owner credentials and refreshes tool metadata without exposing secrets.
- [ ] Custom MCP can add a server, test/connect it, list tools, and route calls through the confirmation path.
- [ ] Full Disk Access status reflects the owner grant state and broad file access stays scoped to approved paths.
- [ ] Apple Calendar grant/read path works with owner calendar data.
- [ ] Apple Calendar create flow shows owner confirmation before mutation.
- [ ] Visual regression artifacts in `tasks/artifacts/post-mvp-ui-regression/` are manually reviewed for Home, Chat, Settings, Integrations, and voice states.
