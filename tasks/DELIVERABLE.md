# Leena 0.1.0 macOS Deliverable

Generated: 2026-06-03 06:10:17 EDT
Task: 111, Final DMG build with Gatekeeper bypass docs

## Artifacts

| Artifact | Path | SHA-256 |
| --- | --- | --- |
| DMG | `dist/Leena-0.1.0-arm64.dmg` | `eb82e79a4dd974999c0a4a645335916e70a37741c5da3887a9891b6ad8392463` |
| ZIP | `dist/Leena-0.1.0-arm64-mac.zip` | `fb1530e7b778360ec24082c00c78f586126b779a92c0fde6fb3c47015e7bb849` |

## Build Gate

- Command: `CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac`
- Result: passed, produced both DMG and ZIP.
- Signing mode: ad-hoc fallback, no Developer ID certificate used.
- Notarization: skipped by `electron-builder` because notarize options were unavailable.

## Headless Structural Verification

- `hdiutil verify dist/Leena-0.1.0-arm64.dmg`: passed, checksum valid.
- Read-only mount path used: `<temp-dmg-mount>` (detached after verification).
- DMG layout: `Leena.app` plus `Applications` symlink to `/Applications`.
- App executable: `Leena.app/Contents/MacOS/Leena` present and executable.
- Packaged fonts: 21 font assets present under `Contents/Resources/app.asar` at `/src/renderer/assets/fonts/`.
- Native addons: `@nut-tree-fork` `.node` files present under `Contents/Resources/app.asar.unpacked/node_modules/@nut-tree-fork/`.
- ZIP structure: extracted with `ditto`, executable present, 21 packaged fonts present, and `@nut-tree-fork` native addons unpacked.

## Owner Manual GUI Checklist

These checks require an owner GUI session and are not autonomous completion gates.

- [ ] Install from `dist/Leena-0.1.0-arm64.dmg` by dragging `Leena.app` to `/Applications`.
- [ ] If Gatekeeper blocks the unsigned build, run `xattr -cr /Applications/Leena.app`, then right-click Leena and choose **Open**.
- [ ] Launches from `/Applications` without Terminal.
- [ ] Shell renders with expected Leena fonts, themes, and visual polish.
- [ ] Realtime/provider setup can be reached from settings.
- [ ] Native computer-use paths do not fail because of missing unpacked addons.
- [ ] Update check does not throw in packaged app; current source returns `Update check started.` for packaged builds.
- [ ] If testing the development app separately, `update:check` returns the guard string `Updates are checked only in packaged builds.`
