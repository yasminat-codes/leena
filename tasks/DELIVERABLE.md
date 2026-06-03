# Leena macOS Deliverables

Updated: 2026-06-03 06:46:44 EDT

This manifest records the current local macOS artifact checkpoints. The Wave 16 MVP deliverable is intentionally named separately from the standard Electron Builder output paths; `dist/` binaries are build outputs and are not implied to be committed.

## Current Artifacts

| Artifact | Task | Path | SHA-256 | Size |
| --- | --- | --- | --- | --- |
| Standard DMG builder output | 111 / 046 rebuild | `dist/Leena-0.1.0-arm64.dmg` | `622285f88cee98384c905c70412c794fe21f6bed03683ad85c72c64ee293be8c` | 128504170 bytes |
| Standard ZIP builder output | 111 / 046 rebuild | `dist/Leena-0.1.0-arm64-mac.zip` | `f4897055756ec344ac883d5bc34a3d5a22485267e017c2df5417d16cf46043f6` | 124378932 bytes |
| MVP DMG named deliverable | 046 | `dist/Leena-MVP.dmg` | `622285f88cee98384c905c70412c794fe21f6bed03683ad85c72c64ee293be8c` | 128504170 bytes |
| MVP ZIP named deliverable | 046 | `dist/Leena-MVP.zip` | `f4897055756ec344ac883d5bc34a3d5a22485267e017c2df5417d16cf46043f6` | 124378932 bytes |

The MVP files were copied from the standard Electron Builder outputs after the final Wave 16 build:

- `dist/Leena-0.1.0-arm64.dmg` -> `dist/Leena-MVP.dmg`
- `dist/Leena-0.1.0-arm64-mac.zip` -> `dist/Leena-MVP.zip`

## Build Gate

- Dependency gate: tasks 021, 040, 056, 065, 073, 033, 039, 100, 101, and 104 were present in `tasks/completed/`.
- Pre-build command: `npm run check` passed.
- Pre-build command: `node --test` passed with 529 passing tests.
- Build command: `CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac` passed.
- Signing mode: unsigned/ad-hoc fallback; no Developer ID certificate used.
- Notarization: skipped by `electron-builder` because notarize options were unavailable.

## Headless Structural Verification

- `dist/Leena-MVP.dmg` exists and is non-zero.
- `dist/Leena-MVP.zip` exists and is non-zero.
- `hdiutil verify dist/Leena-MVP.dmg`: passed, checksum valid.
- `hdiutil imageinfo dist/Leena-MVP.dmg`: passed, format `UDZO`.
- Read-only DMG mount: passed.
- DMG layout: `Leena.app` plus `Applications` symlink to `/Applications`.
- App executable: `Leena.app/Contents/MacOS/Leena` present and executable.
- Packaged fonts: 21 font assets present under `Contents/Resources/app.asar` at `/src/renderer/assets/fonts/`.
- Native addons: 4 `@nut-tree-fork` `.node` files present under `Contents/Resources/app.asar.unpacked/node_modules/@nut-tree-fork/`.
- ZIP structure: extracted with `ditto`; `Leena.app/Contents/MacOS/Leena` present and executable.
- ZIP packaged fonts: 21 font assets present in `app.asar`.
- ZIP native addons: 4 `@nut-tree-fork` `.node` files present in `app.asar.unpacked`.

## Owner Manual GUI Checklist

These checks require an owner GUI session and are not autonomous completion gates.

- [ ] Install from `dist/Leena-MVP.dmg` by dragging `Leena.app` to `/Applications`.
- [ ] If Gatekeeper blocks the unsigned build, run `xattr -cr /Applications/Leena.app`, then right-click Leena and choose Open.
- [ ] Launches from `/Applications` without Terminal.
- [ ] Shell renders with expected Leena fonts, themes, and visual polish.
- [ ] Realtime/provider setup can be reached from settings.
- [ ] Native computer-use paths do not fail because of missing unpacked addons.
