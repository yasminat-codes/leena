import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function readProjectFile(...parts) {
  return readFileSync(path.join(rootDir, ...parts), "utf8");
}

test("Wave 10 settings, tray, and MCP integrations are wired through main and preload", () => {
  const main = readProjectFile("src", "main.js");
  const preload = readProjectFile("src", "preload.js");

  assert.match(main, /import \{ MCPClientManager \} from "\.\/mcp\/client-manager\.js"/);
  assert.match(main, /const mcpClientManager = new MCPClientManager\(\)/);
  assert.match(main, /const tools = await getRealtimeToolDefinitions\(mcpClientManager\);/);
  assert.match(main, /tools,/);
  assert.match(
    main,
    /ipcMain\.handle\("tools:get-definitions", \(\) => getRealtimeToolDefinitions\(mcpClientManager\)\)/,
  );
  assert.match(main, /getServerConfig: getMCPServerConfigForPermission/);

  assert.match(main, /ipcMain\.handle\("settings:get"/);
  assert.match(main, /ipcMain\.handle\("settings:set"/);
  assert.match(main, /broadcastDataChanged\("settings", \{ type: "settings", key \}\)/);
  assert.match(
    preload,
    /getSetting: \(key, defaultValue\) => ipcRenderer\.invoke\("settings:get", key, defaultValue\)/,
  );
  assert.match(
    preload,
    /setSetting: \(key, value\) => ipcRenderer\.invoke\("settings:set", key, value\)/,
  );
  assert.match(preload, /getAllSettings: \(\) => ipcRenderer\.invoke\("settings:get-all"\)/);

  assert.match(main, /createTrayController\(/);
  assert.match(main, /trayController\.createTray\(\)/);
  assert.match(main, /trayController\.wireWindowCloseToTray\(\)/);
  assert.match(main, /ipcMain\.handle\("tray:set-state"/);
  assert.match(
    preload,
    /setTrayState: \(state\) => ipcRenderer\.invoke\("tray:set-state", state\)/,
  );
  assert.match(preload, /onTrayAction: \(callback\) => onIpc\("tray:action", callback\)/);
  assert.match(
    preload,
    /onTrayStateChanged: \(callback\) => onIpc\("tray:state-changed", callback\)/,
  );
});

test("Wave 10 build config packages tray assets with dmg and zip targets", () => {
  const packageJson = JSON.parse(readProjectFile("package.json"));

  assert.deepEqual(packageJson.build.mac.target, ["dmg", "zip"]);
  assert.equal(packageJson.scripts["build:mac:dir"], "electron-builder --mac dir");
  assert.equal(
    packageJson.scripts["open:mac"],
    "npm run build:mac:dir && open dist/mac-arm64/Leena.app",
  );
  assert.equal(packageJson.build.files.includes("build/tray/**"), true);
  assert.deepEqual(packageJson.build.publish, {
    provider: "github",
    owner: "yasminat-codes",
    repo: "leena",
  });
});
