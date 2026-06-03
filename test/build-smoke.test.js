import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function readProjectFile(...parts) {
  return readFileSync(path.join(rootDir, ...parts), "utf8");
}

function readTask046() {
  for (const state of ["in-progress", "completed", "pending"]) {
    const taskPath = path.join(rootDir, "tasks", state, "046-mvp-dmg-build.md");

    if (existsSync(taskPath)) {
      return readFileSync(taskPath, "utf8");
    }
  }

  throw new Error("Task 046 mvp dmg build file was not found in task state folders.");
}

test("Task 046 mac build config keeps the MVP dmg and zip targets shippable", () => {
  const packageJson = JSON.parse(readProjectFile("package.json"));
  const macTargets = new Set(packageJson.build?.mac?.target ?? []);

  assert.equal(packageJson.scripts["build:mac"], "electron-builder --mac");
  assert.equal(macTargets.has("dmg"), true);
  assert.equal(macTargets.has("zip"), true);
  assert.equal(packageJson.build.mac.hardenedRuntime, true);
  assert.equal(packageJson.build.mac.gatekeeperAssess, false);
  assert.equal(packageJson.build.mac.timestamp, null);
  assert.deepEqual(packageJson.build.asarUnpack, ["**/node_modules/@nut-tree-fork/**"]);
});

test("Task 046 documents the unsigned MVP artifact convention", () => {
  const task = readTask046();

  assert.match(task, /npm run build:mac/);
  assert.match(task, /CSC_IDENTITY_AUTO_DISCOVERY=false/);
  assert.match(task, /dist\/Leena-MVP\.dmg/);
  assert.match(task, /dist\/Leena-MVP\.zip/);
  assert.match(task, /owner manual step/i);
  assert.match(task, /not block/i);
});
