import assert from "node:assert/strict";
import test from "node:test";
import {
  createOsPermissionSnapshot,
  getMacOsPrivacySettingsUrl,
  getWindowsPrivacySettingsUrl,
  isKnownOsPermissionId,
  isOsPermissionActionable,
  isOsPermissionGranted,
  normalizeOsPermissionStatus,
  osPermissionDefinitions,
} from "../src/os-permissions.js";

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
  assert.match(getMacOsPrivacySettingsUrl("apple-calendar"), /Privacy_Calendars/);
  assert.match(getMacOsPrivacySettingsUrl("files"), /Privacy_FilesAndFolders/);
  assert.equal(getWindowsPrivacySettingsUrl("microphone"), "ms-settings:privacy-microphone");
});
