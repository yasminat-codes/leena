# Gatekeeper Bypass

Leena is currently distributed without a Developer ID certificate. Until the app is signed and notarized with a Developer ID cert, macOS may block the first launch.

For an app installed in `/Applications`, clear the quarantine attribute:

```sh
xattr -cr /Applications/Leena.app
```

Then right-click `Leena.app` in Finder and choose **Open**. Confirm the prompt to allow the first launch.

This workaround is temporary and should be removed once Leena ships with a Developer ID certificate.
