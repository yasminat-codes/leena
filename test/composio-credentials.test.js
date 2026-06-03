import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  COMPOSIO_CREDENTIAL_KEY,
  clearComposioCredential,
  loadComposioCredential,
  saveComposioCredential,
} from "../src/providers/provider-settings.js";
import { closeDatabase, getDatabase } from "../src/realtime/tools/database.js";
import { ProviderError } from "../src/utils/errors.js";

const testSecretCodec = {
  protect(secret) {
    return Buffer.from(`sealed:${secret}`, "utf8").toString("base64");
  },
  reveal(payload) {
    return Buffer.from(String(payload), "base64")
      .toString("utf8")
      .replace(/^sealed:/, "");
  },
};

async function withProviderDb(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "leena-composio-credentials-"));
  const filePath = path.join(directory, "lena.db");
  try {
    await callback(filePath);
  } finally {
    closeDatabase(filePath);
    await rm(directory, { force: true, recursive: true });
  }
}

function readStoredSetting(filePath, key) {
  const row = getDatabase(filePath).prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row?.value ?? null;
}

test("composio credential settings require protected storage", async () => {
  await withProviderDb((filePath) => {
    assert.throws(
      () => saveComposioCredential("composio-test-secret-1234567890", filePath),
      (error) =>
        error instanceof ProviderError &&
        error.code === "COMPOSIO_CREDENTIAL_STORAGE_UNAVAILABLE" &&
        error.provider === "composio",
    );
    assert.equal(readStoredSetting(filePath, COMPOSIO_CREDENTIAL_KEY), null);
    assert.equal(loadComposioCredential(filePath), null);

    assert.throws(
      () =>
        saveComposioCredential("composio-test-secret-1234567890", filePath, {
          protect: (secret) => secret,
        }),
      (error) =>
        error instanceof ProviderError &&
        error.code === "UNSAFE_COMPOSIO_CREDENTIAL_PAYLOAD" &&
        error.provider === "composio",
    );
    assert.equal(readStoredSetting(filePath, COMPOSIO_CREDENTIAL_KEY), null);
  });
});

test("composio credential settings save load and clear protected payloads", async () => {
  await withProviderDb((filePath) => {
    const credential = "composio-test-secret-abcdef123456";
    const protectedCredential = testSecretCodec.protect(credential);

    assert.equal(
      saveComposioCredential(`  ${credential}  `, filePath, testSecretCodec),
      protectedCredential,
    );

    const storedCredential = readStoredSetting(filePath, COMPOSIO_CREDENTIAL_KEY);
    assert.equal(storedCredential, protectedCredential);
    assert.equal(storedCredential.includes(credential), false);
    assert.equal(loadComposioCredential(filePath), null);
    assert.equal(loadComposioCredential(filePath, testSecretCodec), credential);

    assert.equal(clearComposioCredential(filePath), null);
    assert.equal(readStoredSetting(filePath, COMPOSIO_CREDENTIAL_KEY), null);
    assert.equal(loadComposioCredential(filePath, testSecretCodec), null);
  });
});
