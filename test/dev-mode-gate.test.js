import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

function readProjectFile(...parts) {
  return readFileSync(join(rootDir, ...parts), "utf8");
}

test("command center demo mode is gated by trusted app development IPC", () => {
  const main = readProjectFile("src", "main.js");
  const preload = readProjectFile("src", "preload.js");
  const renderer = readProjectFile("src", "renderer", "renderer.js");

  assert.match(main, /ipcMain\.handle\("app:is-development", \(\) => isDevelopment\)/);
  assert.match(preload, /isDevelopment: \(\) => ipcRenderer\.invoke\("app:is-development"\)/);
  assert.match(renderer, /window\.leena\.isDevelopment\(\)\.then/);
  assert.doesNotMatch(renderer, /location\.protocol\s*===\s*["']file:/);
});
