# Leena macOS Deliverables

Updated: 2026-06-03 13:21:58 EDT

This manifest records the current macOS artifact checkpoints. `dist/` binaries are build outputs and are not committed; the release assets are uploaded to GitHub Releases.

## Current Artifacts

| Artifact | Task | Path | SHA-256 | Size |
| --- | --- | --- | --- | --- |
| GitHub release DMG | release 0.1.1 | `dist/Leena-0.1.1-arm64.dmg` | `316192c0022aeb956ae87d74eb58b03f0b19339104adc31050e32b6a1b4a3376` | 128505223 bytes |
| GitHub release ZIP/update package | release 0.1.1 | `dist/Leena-0.1.1-arm64-mac.zip` | `fb2341d520915501156eecbe3d349a3046d3b663f1adf3efdb74f86d4935080a` | 124383083 bytes |
| GitHub updater manifest | release 0.1.1 | `dist/latest-mac.yml` | `1077301e6ae7ac15851918a8971e30bedeff451dde10cabd9b5451ab9cc5a761` | 499 bytes |
| DMG blockmap | release 0.1.1 | `dist/Leena-0.1.1-arm64.dmg.blockmap` | `0503929465e2ac9a645537690ec425e9dd8de2fee373f47a5b5b54c542d619e0` | 135618 bytes |
| ZIP blockmap | release 0.1.1 | `dist/Leena-0.1.1-arm64-mac.zip.blockmap` | `5a93705a87048b04de2c0e0f970fe7daa2559d172616112ea6e720c0c8b7c7d5` | 131028 bytes |

GitHub release URL: `https://github.com/yasminat-codes/leena/releases/tag/v0.1.1`

## Build Gate

- Dependency gate: tasks 021, 040, 056, 065, 073, 033, 039, 100, 101, and 104 were present in `tasks/completed/`.
- Pre-build command: `npm run check` passed.
- Pre-build command: `node --test` passed with 536 passing tests.
- Build command: `CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac` passed.
- Signing mode: unsigned/ad-hoc fallback; no Developer ID certificate used.
- Notarization: skipped by `electron-builder` because notarize options were unavailable.

## Headless Structural Verification

- `dist/Leena-0.1.1-arm64.dmg` exists and is non-zero.
- `dist/Leena-0.1.1-arm64-mac.zip` exists and is non-zero.
- `dist/latest-mac.yml` exists and points update path to `Leena-0.1.1-arm64-mac.zip`.
- `hdiutil verify dist/Leena-0.1.1-arm64.dmg`: passed, checksum valid.
- `hdiutil imageinfo dist/Leena-0.1.1-arm64.dmg`: passed, format `UDZO`.
- Read-only DMG mount: passed.
- DMG layout: `Leena.app` plus `Applications` symlink to `/Applications`.
- App executable: `Leena.app/Contents/MacOS/Leena` present and executable.
- ZIP structure: extracted with `ditto`; `Leena.app/Contents/MacOS/Leena` present and executable.

## Owner Manual GUI Checklist

These checks require an owner GUI session and are not autonomous completion gates.

- [ ] Install from `Leena-0.1.1-arm64.dmg` by dragging `Leena.app` to `/Applications`.
- [ ] If Gatekeeper blocks the unsigned build, run `xattr -cr /Applications/Leena.app`, then right-click Leena and choose Open.
- [ ] Launches from `/Applications` without Terminal.
- [ ] Shell renders with expected Leena fonts, themes, and visual polish.
- [ ] Realtime/provider setup can be reached from settings.
- [ ] Settings update controls show the installed version and can check GitHub Releases.
- [ ] Native computer-use paths do not fail because of missing unpacked addons.
