# Leena macOS Deliverables

Updated: 2026-06-03 13:52:48 EDT

This manifest records the current macOS artifact checkpoints. `dist/` binaries are build outputs and are not committed; the release assets are uploaded to GitHub Releases.

## Current Artifacts

| Artifact | Task | Path | SHA-256 | Size |
| --- | --- | --- | --- | --- |
| GitHub release DMG | release 0.1.2 | `dist/Leena-0.1.2-arm64.dmg` | `00c5ffc22a649180cd2e27a5657eda531d2111a7d0c2c7564552508b76cb125c` | 128496163 bytes |
| GitHub release ZIP/update package | release 0.1.2 | `dist/Leena-0.1.2-arm64-mac.zip` | `2c40cdc59ab49573fd318e3c8b4d9e9cfe757873513028ecf11ac77d98ad97bc` | 124384567 bytes |
| GitHub updater manifest | release 0.1.2 | `dist/latest-mac.yml` | `2aaec37ab46a9c74a100ba1c16e5f8e4070309bb24741261298ab61b10d9b1a9` | 499 bytes |
| DMG blockmap | release 0.1.2 | `dist/Leena-0.1.2-arm64.dmg.blockmap` | `64ddaddfccd50170fa94194f34802e8bccd6ea5c9f547014b357d3e31ed9e896` | 135142 bytes |
| ZIP blockmap | release 0.1.2 | `dist/Leena-0.1.2-arm64-mac.zip.blockmap` | `1de7d0bd5a12dedafd4ee704cf8c9691b738c659b5f764f880c81433ba57e0ee` | 130897 bytes |

GitHub release URL: `https://github.com/yasminat-codes/leena/releases/tag/v0.1.2`

## Build Gate

- Dependency gate: tasks 021, 040, 056, 065, 073, 033, 039, 100, 101, and 104 were present in `tasks/completed/`.
- Pre-build command: `npm run check` passed.
- Pre-build command: `node --test` passed with 541 passing tests.
- Visual onboarding smoke: `/tmp/leena-onboarding-permissions.png` confirmed active onboarding hides the normal shell, shows all four access grants, and keeps footer controls visible.
- Build command: `CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac` passed.
- Signing mode: unsigned/ad-hoc fallback; no Developer ID certificate used.
- Notarization: skipped by `electron-builder` because notarize options were unavailable.

## Headless Structural Verification

- `dist/Leena-0.1.2-arm64.dmg` exists and is non-zero.
- `dist/Leena-0.1.2-arm64-mac.zip` exists and is non-zero.
- `dist/latest-mac.yml` exists and points update path to `Leena-0.1.2-arm64-mac.zip`.
- `hdiutil verify dist/Leena-0.1.2-arm64.dmg`: passed, checksum valid.
- `hdiutil imageinfo dist/Leena-0.1.2-arm64.dmg`: passed, format `UDZO`.
- Read-only DMG mount: passed.
- DMG layout: `Leena.app` plus `Applications` symlink to `/Applications`.
- App executable: `Leena.app/Contents/MacOS/Leena` present and executable.
- ZIP structure: extracted with `ditto`; `Leena.app/Contents/MacOS/Leena` present and executable.

## Owner Manual GUI Checklist

These checks require an owner GUI session and are not autonomous completion gates.

- [ ] Install from `Leena-0.1.2-arm64.dmg` by dragging `Leena.app` to `/Applications`.
- [ ] If Gatekeeper blocks the unsigned build, run `xattr -cr /Applications/Leena.app`, then right-click Leena and choose Open.
- [ ] Launches from `/Applications` without Terminal.
- [ ] Shell renders with expected Leena fonts, themes, and visual polish.
- [ ] Realtime/provider setup can be reached from settings.
- [ ] Settings update controls show the installed version and can check GitHub Releases.
- [ ] Native computer-use paths do not fail because of missing unpacked addons.
