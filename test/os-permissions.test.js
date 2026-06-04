import assert from "node:assert/strict";
import { constants as fsConstants } from "node:fs";
import test from "node:test";
import {
  createOsPermissionSnapshot,
  getMacOsPrivacySettingsUrl,
  getMacOsPrivacySettingsUrls,
  getWindowsPrivacySettingsUrl,
  isKnownOsPermissionId,
  isOsPermissionActionable,
  isOsPermissionGranted,
  normalizeOsPermissionStatus,
  osPermissionDefinitions,
} from "../src/os-permissions.js";
import {
  createDefaultFullDiskAccessProbePaths,
  createDefaultTccDatabasePaths,
  detectAppleCalendarAccessStatus,
  detectFullDiskAccessStatus,
  openMacOsPrivacySettings,
} from "../src/os-permissions-main.js";

test("OS permission definitions include activation instructions", () => {
  assert.deepEqual(
    osPermissionDefinitions.map((permission) => permission.id),
    [
      "microphone",
      "screen",
      "accessibility",
      "computer",
      "full-disk-access",
      "apple-calendar",
      "files",
    ],
  );
  for (const permission of osPermissionDefinitions) {
    assert.equal(typeof permission.label, "string");
    assert.equal(typeof permission.description, "string");
    assert.equal(typeof permission.activation, "string");
    assert.equal(typeof permission.requestMode, "string");
  }
  const accessibility = osPermissionDefinitions.find((p) => p.id === "accessibility");
  assert.match(accessibility.description, /Computer Use/);
  const fullDiskAccess = osPermissionDefinitions.find((p) => p.id === "full-disk-access");
  assert.match(fullDiskAccess.description, /High-power macOS privacy grant/);
  assert.equal(fullDiskAccess.requestMode, "settings");
});

test("createOsPermissionSnapshot normalizes statuses", () => {
  assert.deepEqual(
    createOsPermissionSnapshot({
      microphone: "granted",
      screen: "weird",
      accessibility: "unsupported",
      computer: "granted",
      "full-disk-access": "stale",
      "apple-calendar": "not-determined",
      files: "denied",
    }).map(({ id, status }) => ({ id, status })),
    [
      { id: "microphone", status: "granted" },
      { id: "screen", status: "unknown" },
      { id: "accessibility", status: "unsupported" },
      { id: "computer", status: "granted" },
      { id: "full-disk-access", status: "stale" },
      { id: "apple-calendar", status: "not-determined" },
      { id: "files", status: "denied" },
    ],
  );
  assert.equal(normalizeOsPermissionStatus("denied"), "denied");
  assert.equal(normalizeOsPermissionStatus("stale"), "stale");
  assert.equal(normalizeOsPermissionStatus("nope"), "unknown");
  assert.equal(isOsPermissionGranted("granted"), true);
  assert.equal(isOsPermissionGranted("stale"), false);
  assert.equal(isOsPermissionGranted("unknown"), false);
  assert.equal(isOsPermissionGranted("unsupported"), false);
  assert.equal(isOsPermissionActionable("unsupported"), false);
  assert.equal(isOsPermissionActionable("denied"), true);
});

test("permission ids and settings URLs are mapped", () => {
  assert.equal(isKnownOsPermissionId("microphone"), true);
  assert.equal(isKnownOsPermissionId("computer"), true);
  assert.equal(isKnownOsPermissionId("full-disk-access"), true);
  assert.equal(isKnownOsPermissionId("apple-calendar"), true);
  assert.equal(isKnownOsPermissionId("files"), true);
  assert.equal(isKnownOsPermissionId("missing"), false);
  assert.match(getMacOsPrivacySettingsUrl("microphone"), /Privacy_Microphone/);
  assert.match(getMacOsPrivacySettingsUrl("screen"), /Privacy_ScreenCapture/);
  assert.match(getMacOsPrivacySettingsUrl("accessibility"), /Privacy_Accessibility/);
  assert.match(getMacOsPrivacySettingsUrl("full-disk-access"), /Privacy_AllFiles/);
  assert.deepEqual(getMacOsPrivacySettingsUrls("full-disk-access"), [
    "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_AllFiles",
    "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles",
    "x-apple.systempreferences:com.apple.preference.security?Privacy",
  ]);
  assert.deepEqual(getMacOsPrivacySettingsUrls("missing"), [
    "x-apple.systempreferences:com.apple.preference.security?Privacy",
  ]);
  assert.match(getMacOsPrivacySettingsUrl("apple-calendar"), /Privacy_Calendars/);
  assert.match(getMacOsPrivacySettingsUrl("files"), /Privacy_FilesAndFolders/);
  assert.equal(getWindowsPrivacySettingsUrl("microphone"), "ms-settings:privacy-microphone");
});

test("Full Disk Access probe returns granted from metadata-only readable checks", async () => {
  const calls = [];
  const status = await detectFullDiskAccessStatus({
    platform: "darwin",
    probePaths: ["/Users/test/Library/Mail"],
    access: async (probePath, mode) => {
      calls.push({ probePath, mode });
    },
  });
  assert.equal(status, "granted");
  assert.deepEqual(calls, [{ probePath: "/Users/test/Library/Mail", mode: fsConstants.R_OK }]);
});

test("Full Disk Access probe fails closed for denied and unknown states", async () => {
  const denied = await detectFullDiskAccessStatus({
    platform: "darwin",
    probePaths: ["/Users/test/Library/Mail"],
    access: async () => {
      throw createFsError("EACCES", "private path was denied");
    },
  });
  assert.equal(denied, "denied");
  assert.equal(isOsPermissionGranted(denied), false);

  const missingThenDenied = await detectFullDiskAccessStatus({
    platform: "darwin",
    probePaths: ["/Users/test/Library/Missing", "/Users/test/Library/Safari"],
    access: async (probePath) => {
      if (probePath.endsWith("Missing")) {
        throw createFsError("ENOENT", "missing");
      }
      throw createFsError("EPERM", "protected");
    },
  });
  assert.equal(missingThenDenied, "denied");

  const allMissing = await detectFullDiskAccessStatus({
    platform: "darwin",
    probePaths: ["/Users/test/Library/Missing"],
    access: async () => {
      throw createFsError("ENOENT", "missing");
    },
  });
  assert.equal(allMissing, "unknown");
  assert.equal(isOsPermissionGranted(allMissing), false);

  const unexpected = await detectFullDiskAccessStatus({
    platform: "darwin",
    probePaths: ["/Users/test/Library/Mail"],
    access: async () => {
      throw createFsError("EBUSY", "private content should not be returned");
    },
  });
  assert.equal(unexpected, "unknown");
});

test("Full Disk Access probe reports unsupported off macOS without probing", async () => {
  let callCount = 0;
  const status = await detectFullDiskAccessStatus({
    platform: "linux",
    probePaths: ["/Users/test/Library/Mail"],
    access: async () => {
      callCount += 1;
    },
  });
  assert.equal(status, "unsupported");
  assert.equal(callCount, 0);
});

test("Full Disk Access default probe paths stay content-free and home-scoped", () => {
  assert.deepEqual(createDefaultFullDiskAccessProbePaths("/Users/example"), [
    "/Users/example/Library/Mail",
    "/Users/example/Library/Safari",
    "/Users/example/Library/Messages",
    "/Users/example/Library/Application Support/AddressBook",
  ]);
  assert.deepEqual(createDefaultFullDiskAccessProbePaths(""), []);
});

test("Apple Calendar TCC detection checks user database before system fallback", async () => {
  const calls = [];
  const status = await detectAppleCalendarAccessStatus({
    platform: "darwin",
    homeDir: "/Users/example",
    systemDbPath: "/System/TCC.db",
    execFile: async (_command, args) => {
      calls.push(args[0]);
      if (args[0].startsWith("/Users/example/")) {
        return {
          stdout: "kTCCServiceCalendarFullAccess|com.leena.app|0|2\n",
        };
      }
      return { stdout: "" };
    },
  });

  assert.equal(status, "granted");
  assert.deepEqual(calls, [
    "/Users/example/Library/Application Support/com.apple.TCC/TCC.db",
    "/System/TCC.db",
  ]);
});

test("Apple Calendar TCC detection fails closed for denied, write-only, and unsupported states", async () => {
  const denied = await detectAppleCalendarAccessStatus({
    platform: "darwin",
    dbPaths: ["/tmp/TCC.db"],
    execFile: async () => ({ stdout: "kTCCServiceCalendar|com.leena.app|0|0\n" }),
  });
  assert.equal(denied, "denied");

  const writeOnly = await detectAppleCalendarAccessStatus({
    platform: "darwin",
    dbPaths: ["/tmp/TCC.db"],
    execFile: async () => ({ stdout: "kTCCServiceCalendarWriteOnly|com.leena.app|0|2\n" }),
  });
  assert.equal(writeOnly, "restricted");

  const unreadable = await detectAppleCalendarAccessStatus({
    platform: "darwin",
    dbPaths: ["/tmp/TCC.db"],
    execFile: async () => {
      throw createFsError("EACCES", "TCC denied");
    },
  });
  assert.equal(unreadable, "unknown");

  const unsupported = await detectAppleCalendarAccessStatus({
    platform: "linux",
    execFile: async () => {
      throw new Error("should not probe");
    },
  });
  assert.equal(unsupported, "unsupported");
});

test("Apple Calendar TCC detection lets read-capable denial beat grants", async () => {
  const status = await detectAppleCalendarAccessStatus({
    platform: "darwin",
    dbPaths: ["/Users/example/TCC.db", "/System/TCC.db"],
    execFile: async (_command, args) => {
      if (args[0].startsWith("/Users/example/")) {
        return { stdout: "kTCCServiceCalendarFullAccess|com.leena.app|0|0\n" };
      }
      return { stdout: "kTCCServiceCalendarFullAccess|com.leena.app|0|2\n" };
    },
  });

  assert.equal(status, "denied");
});

test("Apple Calendar default TCC paths include user and system databases", () => {
  assert.deepEqual(createDefaultTccDatabasePaths("/Users/example", "/System/TCC.db"), [
    "/Users/example/Library/Application Support/com.apple.TCC/TCC.db",
    "/System/TCC.db",
  ]);
});

test("macOS privacy settings opener falls back through Full Disk Access candidates", async () => {
  const openedUrls = [];
  const result = await openMacOsPrivacySettings("full-disk-access", async (url) => {
    openedUrls.push(url);
    if (openedUrls.length < 3) {
      throw new Error("deep link unavailable");
    }
  });
  assert.equal(result.opened, true);
  assert.equal(result.url, "x-apple.systempreferences:com.apple.preference.security?Privacy");
  assert.deepEqual(openedUrls, getMacOsPrivacySettingsUrls("full-disk-access"));
});

test("macOS privacy settings opener reports manual fallback when no URL opens", async () => {
  const result = await openMacOsPrivacySettings("full-disk-access", async () => {
    throw new Error("unavailable");
  });
  assert.deepEqual(result, {
    opened: false,
    message: "Open your system privacy settings manually.",
  });
});

function createFsError(code, message) {
  return Object.assign(new Error(message), { code });
}
