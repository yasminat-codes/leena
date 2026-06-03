# Install Leena on macOS

Leena 0.1.2 is distributed as an unsigned macOS build. Until the app is signed and notarized with a Developer ID certificate, macOS Gatekeeper can block the first launch.

## Artifacts

- GitHub release: `https://github.com/yasminat-codes/leena/releases/tag/v0.1.2`
- DMG: `Leena-0.1.2-arm64.dmg`
- ZIP/update package: `Leena-0.1.2-arm64-mac.zip`
- Updater manifest: `latest-mac.yml`

Use the DMG for normal installation. Use the ZIP only when you need a direct app-bundle archive.

## Install from the DMG

1. Download and open `Leena-0.1.2-arm64.dmg`.
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
2. Complete the setup flow:
   - Connect OpenAI with an API key or OAuth.
   - Grant Microphone for voice input.
   - Grant Screen Recording for screenshots, screen analysis, and OS control.
   - Grant Accessibility for OS-level mouse and keyboard control.
   - Install the automation browser when Leena prompts for browser Computer Use.
3. Refresh the permissions step after making changes in System Settings, then continue.

## Notes

- This build is not notarized. A signed and notarized release should remove the `xattr` workaround.
- Auto-update delivery uses the ZIP and `latest-mac.yml`; the DMG is for fresh installs.
- The autonomous build verification checks the disk image, packaged app layout, bundled fonts, and unpacked native addons. GUI launch remains an owner/manual verification step.
