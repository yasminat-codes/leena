import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { closeDatabase } from "../src/realtime/tools/database.js";
import {
  loadMicrophoneDeviceId,
  normalizeDeviceId,
  saveMicrophoneDeviceId,
} from "../src/realtime/tools/microphone-store.js";

async function withStore(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "leena-mic-"));
  const filePath = path.join(directory, "lena.db");
  try {
    await callback(filePath);
  } finally {
    closeDatabase(filePath);
    await rm(directory, { force: true, recursive: true });
  }
}

test("missing microphone preference returns null", async () => {
  await withStore((filePath) => {
    assert.equal(loadMicrophoneDeviceId(filePath), null);
  });
});

test("a specific device id round-trips", async () => {
  await withStore((filePath) => {
    assert.equal(saveMicrophoneDeviceId("  hw-mic-123  ", filePath), "hw-mic-123");
    closeDatabase(filePath);
    assert.equal(loadMicrophoneDeviceId(filePath), "hw-mic-123");
  });
});

test("system-default aliases are not pinned and clear any saved device", async () => {
  await withStore((filePath) => {
    saveMicrophoneDeviceId("hw-mic-123", filePath);
    assert.equal(saveMicrophoneDeviceId("default", filePath), null);
    assert.equal(loadMicrophoneDeviceId(filePath), null);
  });
});

test("normalizeDeviceId treats blank, default, and communications as null", () => {
  assert.equal(normalizeDeviceId(""), null);
  assert.equal(normalizeDeviceId("default"), null);
  assert.equal(normalizeDeviceId("communications"), null);
  assert.equal(normalizeDeviceId(42), null);
  assert.equal(normalizeDeviceId("usb-mic"), "usb-mic");
});
