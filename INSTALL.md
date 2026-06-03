# Install Leena on macOS

Leena 0.1.0 is distributed as an unsigned macOS build. Until the app is signed and notarized with a Developer ID certificate, macOS Gatekeeper can block the first launch.

## Artifacts

- DMG: `dist/Leena-0.1.0-arm64.dmg`
- ZIP: `dist/Leena-0.1.0-arm64-mac.zip`

Use the DMG for normal installation. Use the ZIP only when you need a direct app-bundle archive.

## Install from the DMG

1. Open `Leena-0.1.0-arm64.dmg`.
2. Drag `Leena.app` to `Applications`.
3. Eject the mounted Leena disk image.

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
- The autonomous build verification checks the disk image, packaged app layout, bundled fonts, and unpacked native addons. GUI launch remains an owner/manual verification step.
