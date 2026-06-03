export const osPermissionDefinitions = Object.freeze([
  {
    id: "microphone",
    label: "Microphone",
    description: "Needed for Realtime voice input.",
    activation: "Click Request to trigger the OS microphone prompt.",
  },
  {
    id: "screen",
    label: "Screen Recording",
    description:
      "Needed for screenshot and screen analysis tools, and to see the live screen during Computer Use OS control.",
    activation:
      "Click Request to trigger Electron screen capture, then allow Leena/Electron in Screen Recording settings.",
  },
  {
    id: "accessibility",
    label: "Accessibility Control",
    description:
      "Needed for Computer Use to control the real OS mouse and keyboard outside the browser harness.",
    activation: "Click Request, then allow Leena/Electron in Accessibility settings.",
  },
  {
    id: "computer",
    label: "Computer Use",
    description:
      "Needed for the computer_use_task automation browser harness (browser target). OS-level control instead requires Screen Recording and Accessibility.",
    activation: "Click Request to download the automation browser (Chromium).",
  },
]);

const knownPermissionIds = new Set(osPermissionDefinitions.map((permission) => permission.id));

export const computerUseBrowserDocsUrl = "https://playwright.dev/docs/browsers#install-browsers";

export function normalizeOsPermissionStatus(status) {
  return ["not-determined", "granted", "denied", "restricted", "unknown", "unsupported"].includes(
    status,
  )
    ? status
    : "unknown";
}

export function createOsPermissionSnapshot(statuses) {
  return osPermissionDefinitions.map((permission) => ({
    ...permission,
    status: normalizeOsPermissionStatus(statuses?.[permission.id]),
  }));
}

export function isKnownOsPermissionId(id) {
  return knownPermissionIds.has(id);
}

export function getMacOsPrivacySettingsUrl(id) {
  switch (id) {
    case "microphone":
      return "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone";
    case "screen":
      return "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture";
    case "accessibility":
      return "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";
    default:
      return "x-apple.systempreferences:com.apple.preference.security?Privacy";
  }
}

export function getWindowsPrivacySettingsUrl(id) {
  switch (id) {
    case "microphone":
      return "ms-settings:privacy-microphone";
    default:
      return "ms-settings:privacy";
  }
}
