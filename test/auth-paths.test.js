import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path, { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const apiKey = "sk-test-api-key-auth-path-1234567890";
const oneYearMs = 365 * 24 * 60 * 60 * 1000;

function readProjectFile(...parts) {
  return readFileSync(join(rootDir, ...parts), "utf8");
}

function extractAuthTail(source) {
  const start = source.indexOf("async function getFreshOpenAICredentials()");
  assert.notEqual(start, -1, "main.js must define getFreshOpenAICredentials");

  const isRecordStart = source.indexOf("function isRecord(", start);
  assert.notEqual(isRecordStart, -1, "main.js must define isRecord after auth helpers");
  const end = findFunctionEnd(source, isRecordStart);
  return source.slice(start, end);
}

function extractRenameMigrationTail(source) {
  const constantsStart = source.indexOf("const legacyAppName");
  assert.notEqual(constantsStart, -1, "main.js must define the legacy app name");
  const constantsEnd = source.indexOf("const openAIAuthConfig", constantsStart);
  assert.notEqual(constantsEnd, -1, "main.js must define auth config after rename constants");

  const pathsStart = source.indexOf("function getLegacyUserDataPaths(");
  assert.notEqual(pathsStart, -1, "main.js must define legacy user-data path discovery");
  const pathsEnd = findFunctionEnd(source, pathsStart);

  const credentialsStart = source.indexOf("function migrateLegacyCredentialFile(");
  assert.notEqual(credentialsStart, -1, "main.js must define legacy credential migration");
  const credentialsEnd = findFunctionEnd(source, credentialsStart);

  return [
    source.slice(constantsStart, constantsEnd),
    source.slice(pathsStart, pathsEnd),
    source.slice(credentialsStart, credentialsEnd),
  ].join("\n");
}

function findFunctionEnd(source, start) {
  const bodyStart = source.indexOf("{", start);
  assert.notEqual(bodyStart, -1, "function body start not found");
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }
  throw new Error("function body end not found");
}

async function createAuthHarness() {
  const userDataPath = await mkdtemp(path.join(tmpdir(), "leena-auth-path-"));
  const refreshCalls = [];
  const encryptedPayloads = [];
  const diagnostics = [];
  const context = {
    Buffer,
    Date,
    JSON,
    app: {
      getPath(name) {
        assert.equal(name, "userData");
        return userDataPath;
      },
    },
    fs: await import("node:fs/promises"),
    path,
    refreshOpenAICredentials(credentials) {
      refreshCalls.push(credentials);
      return { ...credentials, accessToken: "refreshed-token" };
    },
    safeStorage: {
      getSelectedStorageBackend() {
        return "test-keychain";
      },
      isEncryptionAvailable() {
        return true;
      },
      encryptString(plaintext) {
        encryptedPayloads.push(plaintext);
        return Buffer.from(`encrypted:${plaintext}`, "utf8");
      },
      decryptString(payload) {
        const plaintext = payload.toString("utf8");
        assert.ok(plaintext.startsWith("encrypted:"));
        return plaintext.slice("encrypted:".length);
      },
    },
    writeDiagnosticLog(event, details) {
      diagnostics.push({ event, details });
      return Promise.resolve();
    },
  };
  vm.createContext(context);
  vm.runInContext(
    `${extractAuthTail(readProjectFile("src", "main.js"))}
globalThis.__auth = {
  getFreshOpenAICredentials,
  loadOpenAICredentials,
  saveOpenAICredentials,
  parseCredentials,
};`,
    context,
    { filename: "src/main.js.auth-harness" },
  );
  return {
    ...context.__auth,
    diagnostics,
    encryptedPayloads,
    refreshCalls,
    userDataPath,
  };
}

async function cleanupHarness(harness) {
  await rm(harness.userDataPath, { force: true, recursive: true });
}

function assertNonRefreshingExpiry(expiresAt) {
  assert.equal(typeof expiresAt, "number");
  assert.ok(
    expiresAt === Infinity || expiresAt > Date.now() + oneYearMs,
    "API-key credentials should use a non-refreshing expiry sentinel",
  );
}

test("API key credentials round-trip through encrypted OpenAI credential storage", async () => {
  const harness = await createAuthHarness();
  try {
    await harness.saveOpenAICredentials({
      accessToken: apiKey,
      refreshToken: null,
      expiresAt: Number.MAX_SAFE_INTEGER,
    });

    const rawFile = await readFile(path.join(harness.userDataPath, "openai-credentials.json"), {
      encoding: "utf8",
    });
    assert.doesNotMatch(rawFile, new RegExp(apiKey));
    assert.equal(harness.encryptedPayloads.length, 1);
    assert.match(harness.encryptedPayloads[0], /"refreshToken":null/);

    const loaded = await harness.loadOpenAICredentials();
    assert.equal(loaded.accessToken, apiKey);
    assert.equal(loaded.refreshToken, null);
    assertNonRefreshingExpiry(loaded.expiresAt);
  } finally {
    await cleanupHarness(harness);
  }
});

test("API key credentials are returned without OAuth refresh", async () => {
  const harness = await createAuthHarness();
  try {
    await harness.saveOpenAICredentials({
      accessToken: apiKey,
      refreshToken: null,
      expiresAt: Number.MAX_SAFE_INTEGER,
    });

    const fresh = await harness.getFreshOpenAICredentials();

    assert.equal(fresh.accessToken, apiKey);
    assert.equal(fresh.refreshToken, null);
    assertNonRefreshingExpiry(fresh.expiresAt);
    assert.deepEqual(harness.refreshCalls, []);
  } finally {
    await cleanupHarness(harness);
  }
});

test("OpenAI API-key IPC path and auth type are wired in the main process", () => {
  const main = readProjectFile("src", "main.js");

  assert.match(main, /ipcMain\.handle\("openai:save-api-key"/);
  assert.match(main, /ipcMain\.handle\("openai:get-auth-type"/);
  assert.match(main, /accessToken:\s*apiKey/);
  assert.match(main, /refreshToken:\s*null/);
  assert.match(main, /const\s+API_KEY_EXPIRES_AT\s*=\s*Number\.MAX_SAFE_INTEGER/);
  assert.match(main, /expiresAt:\s*(API_KEY_EXPIRES_AT|Infinity|Number\.MAX_SAFE_INTEGER)/);
  assert.match(main, /saveOpenAICredentials\(\s*credentials\s*\)/);
  assert.match(main, /function\s+getLegacyUserDataPaths/);
  assert.match(main, /app\.getPath\("appData"\)/);
  assert.match(main, /function\s+migrateLegacyCredentialFile/);
  assert.match(main, /const\s+credentialStoreFilename\s*=\s*"openai-credentials\.json"/);
  assert.match(
    main,
    /if\s*\(\s*isOpenAIApiKeyCredentials\(credentials\)\s*\)\s*\{\s*return credentials/,
  );
  assert.match(
    main,
    /function\s+isOpenAIApiKeyCredentials\(credentials\)\s*\{\s*return credentials\.refreshToken\s*===\s*null/,
  );
  assert.match(main, /"api-key"/);
  assert.match(main, /"oauth"/);
  assert.match(main, /"none"/);
});

test("OpenAI credential file migrates from the legacy Electron user-data root", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "leena-auth-rename-"));
  const appDataPath = path.join(root, "Application Support");
  const currentUserDataPath = path.join(appDataPath, "Leena");
  const legacyUserDataPath = path.join(appDataPath, ["Br", "ah"].join(""));
  const legacyCredentialPath = path.join(legacyUserDataPath, "openai-credentials.json");
  const currentCredentialPath = path.join(currentUserDataPath, "openai-credentials.json");
  const legacyPayload = JSON.stringify({ data: "encrypted-legacy-credentials" });

  try {
    await mkdir(legacyUserDataPath, { recursive: true });
    await writeFile(legacyCredentialPath, legacyPayload);

    const warnings = [];
    const context = {
      app: {
        getPath(name) {
          assert.equal(name, "appData");
          return appDataPath;
        },
      },
      existsSync,
      mkdirSync,
      path,
      renameSync,
      safeConsole(level, message, error) {
        warnings.push({ level, message, error });
      },
    };
    vm.createContext(context);
    vm.runInContext(
      `${extractRenameMigrationTail(readProjectFile("src", "main.js"))}
globalThis.__renameMigration = {
  getLegacyUserDataPaths,
  migrateLegacyCredentialFile,
};`,
      context,
      { filename: "src/main.js.rename-migration-harness" },
    );

    const legacyPaths = [...context.__renameMigration.getLegacyUserDataPaths(currentUserDataPath)];
    assert.deepEqual(legacyPaths, [
      legacyUserDataPath,
      path.join(appDataPath, ["br", "ah"].join("")),
    ]);

    context.__renameMigration.migrateLegacyCredentialFile(currentUserDataPath, legacyPaths);

    assert.equal(await readFile(currentCredentialPath, "utf8"), legacyPayload);
    assert.equal(existsSync(legacyCredentialPath), false);
    assert.deepEqual(warnings, []);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("preload exposes API-key auth helpers on window.leena", () => {
  const preload = readProjectFile("src", "preload.js");

  assert.match(
    preload,
    /saveApiKey:\s*\(\s*apiKey\s*\)\s*=>\s*ipcRenderer\.invoke\(\s*"openai:save-api-key"\s*,\s*\{\s*apiKey\s*\}\s*\)/,
  );
  assert.match(
    preload,
    /getAuthType:\s*\(\s*\)\s*=>\s*ipcRenderer\.invoke\(\s*"openai:get-auth-type"\s*\)/,
  );
});
