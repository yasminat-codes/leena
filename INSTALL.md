# Install Leena on macOS

Leena 0.1.1 is distributed as an unsigned macOS build. Until the app is signed and notarized with a Developer ID certificate, macOS Gatekeeper can block the first launch.

## Artifacts

- GitHub release: `https://github.com/yasminat-codes/leena/releases/tag/v0.1.1`
- DMG: `Leena-0.1.1-arm64.dmg`
- ZIP/update package: `Leena-0.1.1-arm64-mac.zip`
- Updater manifest: `latest-mac.yml`

Use the DMG for normal installation. Use the ZIP only when you need a direct app-bundle archive.

## Install from the DMG

1. Download and open `Leena-0.1.1-arm64.dmg`.
2. Drag `Leena.app` to `Applications`.
3. Eject the mounted Leena disk image.

## Updates

Leena checks the GitHub Releases feed configured in `package.json`. In Settings, use **Check**, then **Download**, then **Restart** when an update is available. Each future release must increment the app version and upload the macOS ZIP plus `latest-mac.yml` so installed apps can find it.

## Gatekeeper bypass for the unsigned build

Only run this after confirming the artifact came from the expected build source and checksum.

```sh
xattr -cr /Applications/Leena.app
```

Then right-click `/Applications/Leena.app`, choose **Open**, and confirm the macOS prompt. After the first allowed launch, Leena should open normally.

## First-run setup

1. Open Leena from `/Applications`.
2. Grant macOS permissions when prompted:
   - Microphone for voice input.
   - Screen Recording for screenshots and screen analysis.
   - Accessibility if you want OS-level computer control.
3. Configure an OpenAI API key or OAuth login in the app settings before using realtime voice features.
4. If browser automation is needed, install the Playwright browser when Leena prompts for computer-use setup.

## Notes

- This build is not notarized. A signed and notarized release should remove the `xattr` workaround.
- Auto-update delivery uses the ZIP and `latest-mac.yml`; the DMG is for fresh installs.
- The autonomous build verification checks the disk image, packaged app layout, bundled fonts, and unpacked native addons. GUI launch remains an owner/manual verification step.
