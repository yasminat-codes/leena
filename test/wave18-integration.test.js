import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readProjectFile(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("Wave 18 preload bridge exposes Composio credential APIs", () => {
  const preloadSource = readProjectFile("src/preload.js");

  for (const channel of [
    "composio:get-credential-status",
    "composio:save-credential",
    "composio:clear-credential",
    "composio:test-connection",
  ]) {
    assert.ok(preloadSource.includes(`ipcRenderer.invoke("${channel}"`), `missing ${channel}`);
  }

  assert.ok(preloadSource.includes("\n  composio: {"));
});
