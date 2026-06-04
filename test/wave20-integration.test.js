import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readProjectFile(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("Wave 20 main process passes Full Disk Access status to filesystem tools", () => {
  const mainSource = readProjectFile("src/main.js");

  assert.ok(mainSource.includes("const permissionSnapshot = await getOsPermissionStatus();"));
  assert.match(
    mainSource,
    /executeRealtimeToolWithRuntimeOptions\(name, args,\s*{\s*\.\.\.options,\s*permissionSnapshot,/,
  );
  assert.ok(
    mainSource.includes('getPermissionStatusFromSnapshot(permissionSnapshot, "full-disk-access")'),
  );
  assert.match(
    mainSource,
    /fileSystem:\s*{\s*rootPath: app\.getPath\("home"\),\s*fullDiskAccessStatus,/,
  );
});
