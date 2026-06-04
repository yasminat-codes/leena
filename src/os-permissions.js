export const osPermissionDefinitions = Object.freeze([
  {
    id: "microphone",
    label: "Microphone",
    description: "Needed for Realtime voice input.",
    activation: "Click Request to trigger the OS microphone prompt.",
    requestMode: "native",
  },
  {
    id: "screen",
    label: "Screen Recording",
    description:
      "Needed for screenshot and screen analysis tools, and to see the live screen during Computer Use OS control.",
    activation:
      "Click Request to trigger Electron screen capture, then allow Leena/Electron in Screen Recording settings.",
    requestMode: "guided",
  },
  {
    id: "accessibility",
    label: "Accessibility",
    description:
      "Needed for Computer Use to control the real OS mouse and keyboard outside the browser harness.",
    activation: "Click Request, then allow Leena/Electron in Accessibility settings.",
    requestMode: "guided",
  },
  {
    id: "computer",
    label: "Computer Use",
    description:
      "Needed for the computer_use_task automation browser harness (browser target). OS-level control instead requires Screen Recording and Accessibility.",
    activation: "Click Request to download the automation browser (Chromium).",
    requestMode: "native",
  },
  {
    id: "full-disk-access",
    label: "Full Disk Access",
    description:
      "High-power macOS privacy grant for broad file read/search. Leena can guide setup, but macOS keeps this grant in System Settings.",
    activation:
      "Open Full Disk Access settings, add Leena or Electron, then refresh status after macOS records the grant.",
    requestMode: "settings",
  },
  {
    id: "apple-calendar",
    label: "Apple Calendar",
    description:
      "Calendar access is permission-led. Read access and write actions stay distinct until a real adapter is implemented.",
    activation:
      "Use Request or Open Settings to review Calendar privacy access; Leena does not bypass the macOS prompt.",
    requestMode: "guided",
  },
  {
    id: "files",
    label: "Files",
    description:
      "Workspace and user-selected file scopes are separate from broad Full Disk Access.",
    activation:
      "Open Files and Folders settings for scoped app access, or use Full Disk Access for broad read/search.",
    requestMode: "settings",
  },
]);

const knownPermissionIds = new Set(osPermissionDefinitions.map((permission) => permission.id));

export const computerUseBrowserDocsUrl = "https://playwright.dev/docs/browsers#install-browsers";

const macOsPrivacySettingsUrls = Object.freeze({
  microphone: Object.freeze([
    "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
  ]),
  screen: Object.freeze([
    "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
  ]),
  accessibility: Object.freeze([
    "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
  ]),
  "full-disk-access": Object.freeze([
    "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_AllFiles",
    "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles",
    "x-apple.systempreferences:com.apple.preference.security?Privacy",
  ]),
  "apple-calendar": Object.freeze([
    "x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars",
  ]),
  files: Object.freeze([
    "x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders",
  ]),
  default: Object.freeze(["x-apple.systempreferences:com.apple.preference.security?Privacy"]),
});

export function normalizeOsPermissionStatus(status) {
  return [
    "not-determined",
    "granted",
    "denied",
    "restricted",
    "stale",
    "unknown",
    "unsupported",
  ].includes(status)
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

export function isOsPermissionGranted(status) {
  return normalizeOsPermissionStatus(status) === "granted";
}

export function isOsPermissionActionable(status) {
  return normalizeOsPermissionStatus(status) !== "unsupported";
}

export function getMacOsPrivacySettingsUrl(id) {
  return getMacOsPrivacySettingsUrls(id)[0];
}

export function getMacOsPrivacySettingsUrls(id) {
  return macOsPrivacySettingsUrls[id] ?? macOsPrivacySettingsUrls.default;
}

export function getWindowsPrivacySettingsUrl(id) {
  switch (id) {
    case "microphone":
      return "ms-settings:privacy-microphone";
    default:
      return "ms-settings:privacy";
  }
}
