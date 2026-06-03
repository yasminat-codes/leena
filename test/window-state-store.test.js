import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { closeDatabase } from "../src/realtime/tools/database.js";
import {
  loadWindowPosition,
  normalizeWindowPosition,
  saveWindowPosition,
} from "../src/realtime/tools/window-state-store.js";

async function withStore(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "leena-window-"));
  const filePath = path.join(directory, "lena.db");
  try {
    await callback(filePath);
  } finally {
    closeDatabase(filePath);
    await rm(directory, { force: true, recursive: true });
  }
}

test("missing window position returns null", async () => {
  await withStore((filePath) => {
    assert.equal(loadWindowPosition(filePath), null);
  });
});

test("window position round-trips and rounds to integers", async () => {
  await withStore((filePath) => {
    const saved = saveWindowPosition({ x: 120.6, y: 40.2 }, filePath);
    assert.deepEqual(saved, { x: 121, y: 40 });

    closeDatabase(filePath);
    assert.deepEqual(loadWindowPosition(filePath), { x: 121, y: 40 });
  });
});

test("invalid positions are rejected", async () => {
  await withStore((filePath) => {
    assert.equal(saveWindowPosition({ x: "left", y: 10 }, filePath), null);
    assert.equal(saveWindowPosition(null, filePath), null);
    assert.equal(loadWindowPosition(filePath), null);
  });
});

test("normalizeWindowPosition guards non-finite coordinates", () => {
  assert.equal(normalizeWindowPosition({ x: Number.NaN, y: 1 }), null);
  assert.equal(normalizeWindowPosition({ x: 1, y: Number.POSITIVE_INFINITY }), null);
  assert.deepEqual(normalizeWindowPosition({ x: -5, y: 9 }), { x: -5, y: 9 });
});
