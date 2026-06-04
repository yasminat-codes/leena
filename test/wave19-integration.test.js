import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readProjectFile(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("Wave 19 preload bridge exposes Composio Actions Hub APIs", () => {
  const preloadSource = readProjectFile("src/preload.js");

  for (const channel of [
    "composio:get-integration-status",
    "composio:test-connection",
    "composio:refresh-tools",
    "composio:list-toolkits",
    "composio:list-connected-apps",
    "composio:open-app-auth",
  ]) {
    assert.ok(preloadSource.includes(`ipcRenderer.invoke("${channel}"`), `missing ${channel}`);
  }
});

test("Wave 19 main process routes Composio through the integration service", () => {
  const mainSource = readProjectFile("src/main.js");

  assert.ok(mainSource.includes("createComposioIntegrationService({"));
  assert.ok(mainSource.includes("registerComposioIntegrationHandlers({"));
  assert.ok(mainSource.includes("registerComposioTestConnection: false"));
  assert.ok(mainSource.includes("composioIntegrationService.getPermissionServerConfig(serverId)"));
});

test("Wave 19 main process passes live Apple Calendar permission state to tools", () => {
  const mainSource = readProjectFile("src/main.js");

  assert.ok(mainSource.includes("async function getAppleCalendarAccessStatus()"));
  assert.ok(mainSource.includes('"apple-calendar": await getAppleCalendarAccessStatus()'));
  assert.match(
    mainSource,
    /planner:\s*{\s*appleCalendar:\s*{\s*permissionStatus: await getAppleCalendarAccessStatus\(\)/,
  );
  assert.ok(mainSource.includes("permissionStatus: await getAppleCalendarAccessStatus()"));
});
