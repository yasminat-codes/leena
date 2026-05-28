import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  safeStorage,
  screen,
  shell,
  systemPreferences,
} from "electron";
import electronUpdater from "electron-updater";
import {
  createOsPermissionSnapshot,
  getMacOsPrivacySettingsUrl,
  getWindowsPrivacySettingsUrl,
  isKnownOsPermissionId,
} from "./os-permissions.js";
import { buildRealtimeInstructions } from "./realtime/prompts.js";
import { executeRealtimeTool, getRealtimeToolDefinitions } from "./realtime/tools/index.js";

const { autoUpdater } = electronUpdater;
const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDevelopment = !app.isPackaged;

const openAIAuthConfig = Object.freeze({
  clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
  authorizeUrl: "https://auth.openai.com/oauth/authorize",
  tokenUrl: "https://auth.openai.com/oauth/token",
  scope: "openid profile email offline_access api.connectors.read api.connectors.invoke",
  redirectHost: "localhost",
  redirectPort: 1455,
  redirectPath: "/auth/callback",
});

const realtimeDefaults = Object.freeze({
  model: "gpt-realtime-2",
  voice: "marin",
  sampleRate: 24_000,
});

let mainWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 172,
    height: 188,
    minWidth: 172,
    minHeight: 188,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  positionMainWindowAsFab(mainWindow);
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function positionMainWindowAsFab(window) {
  const display = screen.getPrimaryDisplay();
  const { width, height } = window.getBounds();
  const x = Math.round(display.workArea.x + display.workArea.width - width - 24);
  const y = Math.round(display.workArea.y + display.workArea.height - height - 24);
  window.setPosition(x, y, false);
}

function wireUpdateEvents() {
  autoUpdater.autoDownload = false;

  autoUpdater.on("checking-for-update", () => {
    mainWindow?.webContents.send("update:status", "Checking for updates…");
  });

  autoUpdater.on("update-available", () => {
    mainWindow?.webContents.send("update:status", "Update available. Downloading…");
    autoUpdater.downloadUpdate();
  });

  autoUpdater.on("update-not-available", () => {
    mainWindow?.webContents.send("update:status", "You are running the latest version.");
  });

  autoUpdater.on("error", (error) => {
    mainWindow?.webContents.send("update:status", `Update error: ${error.message}`);
  });

  autoUpdater.on("update-downloaded", () => {
    mainWindow?.webContents.send("update:status", "Update downloaded. It will install on restart.");
  });
}

ipcMain.handle("app:get-version", () => app.getVersion());
ipcMain.handle("update:check", async () => {
  if (isDevelopment) {
    return "Updates are checked only in packaged builds.";
  }

  await autoUpdater.checkForUpdates();
  return "Update check started.";
});

ipcMain.handle("openai:get-status", async () => {
  const credentials = await getFreshOpenAICredentials();
  return credentials ? credentialsToStatus(credentials) : { connected: false };
});

ipcMain.handle("openai:login", async () => {
  const credentials = await loginOpenAI();
  return credentialsToStatus(credentials);
});

ipcMain.handle("openai:logout", async () => {
  await clearOpenAICredentials();
  return { connected: false };
});

ipcMain.handle("openai:create-realtime-secret", async (_event, options = {}) => {
  const credentials = await getFreshOpenAICredentials();
  if (!credentials) {
    throw new Error("Sign in to OpenAI before starting Realtime.");
  }

  return createRealtimeClientSecret(credentials, {
    ...options,
    instructions: buildRealtimeInstructions(),
  });
});

ipcMain.handle("permissions:get-status", () => getOsPermissionStatus());
ipcMain.handle("permissions:request", async (_event, id) => requestOsPermission(id));
ipcMain.handle("permissions:open-settings", async (_event, id) => openOsPermissionSettings(id));
ipcMain.handle("diagnostics:get-log-path", () => getDiagnosticLogPath());
ipcMain.handle("diagnostics:open-log", async () => {
  await shell.openPath(getDiagnosticLogPath());
  return getDiagnosticLogPath();
});
ipcMain.handle("diagnostics:write", async (_event, event, details = {}) => {
  await writeDiagnosticLog(`renderer.${event}`, sanitizeDiagnosticValue(details));
  return { ok: true };
});
ipcMain.handle("diagnostics:privacy", async () => collectPrivacyDiagnostics());
ipcMain.handle("tools:get-definitions", () => getRealtimeToolDefinitions());
ipcMain.handle("tools:execute", async (_event, name, args = {}) => {
  if (typeof name !== "string" || !name.trim()) {
    return {
      status: "invalid_arguments",
      message: "Tool name must be a non-empty string.",
    };
  }
  const startedAt = Date.now();
  await writeDiagnosticLog("tool.execute.start", {
    tool: name,
    args: sanitizeDiagnosticValue(args),
    permissions: summarizePermissionSnapshot(getOsPermissionStatus()),
  });
  try {
    const needsOpenAI = name === "computer_use_task";
    const credentials = needsOpenAI ? await getFreshOpenAICredentials() : null;
    const screenshotOptions = {
      desktopCapturer,
      screen,
      userDataPath: app.getPath("userData"),
      logger: createToolLogger(name),
      ...(credentials ? { openAI: { accessToken: credentials.accessToken } } : {}),
    };
    const result = await executeRealtimeTool(name, args, {
      screenshot: screenshotOptions,
      computerUse: credentials
        ? { openAI: { accessToken: credentials.accessToken }, logger: createToolLogger(name) }
        : { logger: createToolLogger(name) },
    });
    await writeDiagnosticLog("tool.execute.finish", {
      tool: name,
      elapsedMs: Date.now() - startedAt,
      result: summarizeToolResult(result),
    });
    return result;
  } catch (error) {
    await writeDiagnosticLog("tool.execute.error", {
      tool: name,
      elapsedMs: Date.now() - startedAt,
      error: formatDiagnosticError(error),
    });
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Tool execution failed.",
    };
  }
});

app.whenReady().then(() => {
  wireUpdateEvents();
  createMainWindow();

  if (!isDevelopment) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function getDiagnosticLogPath() {
  return path.join(app.getPath("userData"), "diagnostics.log");
}

async function writeDiagnosticLog(event, details = {}) {
  const entry = {
    time: new Date().toISOString(),
    event,
    pid: process.pid,
    appPath: app.getAppPath(),
    isPackaged: app.isPackaged,
    details,
  };
  const line = `${JSON.stringify(entry)}\n`;
  try {
    await fs.mkdir(path.dirname(getDiagnosticLogPath()), { recursive: true });
    await fs.appendFile(getDiagnosticLogPath(), line);
  } catch (error) {
    console.error("diagnostic log write failed", error);
  }
  console.info("diagnostic", event, details);
}

function createToolLogger(tool) {
  return async (event, details = {}) => {
    await writeDiagnosticLog(event, { tool, ...details });
  };
}

function summarizePermissionSnapshot(permissions) {
  return Object.fromEntries(permissions.map((permission) => [permission.id, permission.status]));
}

function summarizeToolResult(result) {
  if (!result || typeof result !== "object") {
    return result;
  }
  const summary = {
    status: result.status,
    message: typeof result.message === "string" ? result.message.slice(0, 500) : undefined,
    path: result.path,
    dimensions: result.dimensions,
    source: result.source,
    resultCount: result.resultCount,
  };
  return Object.fromEntries(Object.entries(summary).filter(([, value]) => value !== undefined));
}

function sanitizeDiagnosticValue(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeDiagnosticValue);
  }
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? value.slice(0, 500) : value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      key.toLowerCase().includes("token") ? "[redacted]" : sanitizeDiagnosticValue(item),
    ]),
  );
}

function formatDiagnosticError(error) {
  return error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { message: String(error) };
}

async function collectPrivacyDiagnostics() {
  const diagnostics = {
    appPath: app.getAppPath(),
    executablePath: app.getPath("exe"),
    isPackaged: app.isPackaged,
    bundleIdentifier: app.getApplicationNameForProtocol("file") || null,
    statuses: Object.fromEntries(
      getOsPermissionStatus().map((permission) => [permission.id, permission.status]),
    ),
    tccRows: process.platform === "darwin" ? await readMacOsTccRows() : [],
  };
  await writeDiagnosticLog("privacy.diagnostics", diagnostics);
  return diagnostics;
}

async function readMacOsTccRows() {
  const dbPath = "/Library/Application Support/com.apple.TCC/TCC.db";
  try {
    const { stdout } = await execFileAsync("sqlite3", [
      dbPath,
      "select service,client,client_type,auth_value,auth_reason,flags,last_modified from access where client like '%brah%' or client like '%Brah%' or client='com.unstablemind.brah' order by service,client;",
    ]);
    return stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [service, client, clientType, authValue, authReason, flags, lastModified] =
          line.split("|");
        return { service, client, clientType, authValue, authReason, flags, lastModified };
      });
  } catch (error) {
    return [{ error: error instanceof Error ? error.message : String(error) }];
  }
}

function getOsPermissionStatus() {
  return createOsPermissionSnapshot({
    microphone: getMediaAccessStatus("microphone"),
    screen: getMediaAccessStatus("screen"),
    accessibility: getAccessibilityStatus(),
  });
}

async function requestOsPermission(id) {
  if (!isKnownOsPermissionId(id)) {
    throw new Error("Unknown OS permission.");
  }
  if (id === "microphone") {
    if (process.platform === "darwin") {
      await systemPreferences.askForMediaAccess("microphone");
    }
    return getOsPermissionStatus();
  }
  if (id === "screen") {
    await requestScreenRecordingAccess();
    return getOsPermissionStatus();
  }
  if (id === "accessibility" && process.platform === "darwin") {
    systemPreferences.isTrustedAccessibilityClient(true);
    return getOsPermissionStatus();
  }
  await openOsPermissionSettings(id);
  return getOsPermissionStatus();
}

async function openOsPermissionSettings(id) {
  if (!isKnownOsPermissionId(id)) {
    throw new Error("Unknown OS permission.");
  }
  if (process.platform === "darwin") {
    await shell.openExternal(getMacOsPrivacySettingsUrl(id));
    return { opened: true };
  }
  if (process.platform === "win32") {
    await shell.openExternal(getWindowsPrivacySettingsUrl(id));
    return { opened: true };
  }
  return { opened: false, message: "Open your system privacy settings manually." };
}

async function requestScreenRecordingAccess() {
  try {
    await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1, height: 1 },
      fetchWindowIcons: false,
    });
  } catch {
    // The status check below reports the meaningful permission state.
  }
  if (process.platform === "darwin" && getMediaAccessStatus("screen") !== "granted") {
    await openOsPermissionSettings("screen");
  }
}

function getMediaAccessStatus(mediaType) {
  try {
    return systemPreferences.getMediaAccessStatus(mediaType);
  } catch {
    return process.platform === "linux" ? "unsupported" : "unknown";
  }
}

function getAccessibilityStatus() {
  if (process.platform !== "darwin") {
    return "unsupported";
  }
  return systemPreferences.isTrustedAccessibilityClient(false) ? "granted" : "not-determined";
}

async function loginOpenAI() {
  const redirectUri = createOpenAIRedirectUri();
  const verifier = createPkceVerifier();
  const challenge = createPkceChallenge(verifier);
  const state = randomBytes(24).toString("base64url");
  const callbackServer = await startOAuthCallbackServer({ state });
  const authUrl = new URL(openAIAuthConfig.authorizeUrl);
  authUrl.searchParams.set("client_id", openAIAuthConfig.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", openAIAuthConfig.scope);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("id_token_add_organizations", "true");
  authUrl.searchParams.set("codex_cli_simplified_flow", "true");
  authUrl.searchParams.set("originator", "ggcoder");

  try {
    await shell.openExternal(authUrl.toString());
    const callback = await callbackServer.waitForCallback;
    if (callback.error) {
      throw new Error(`OpenAI login failed: ${callback.error}`);
    }
    if (!callback.code) {
      throw new Error("OpenAI login did not return an authorization code.");
    }

    const credentials = await exchangeOpenAICode({
      code: callback.code,
      codeVerifier: verifier,
      redirectUri,
    });
    await saveOpenAICredentials(credentials);
    return credentials;
  } finally {
    callbackServer.close();
  }
}

function createOpenAIRedirectUri() {
  return `http://localhost:${openAIAuthConfig.redirectPort}${openAIAuthConfig.redirectPath}`;
}

function createPkceVerifier() {
  return randomBytes(48).toString("base64url");
}

function createPkceChallenge(verifier) {
  return createHash("sha256").update(verifier).digest("base64url");
}

async function startOAuthCallbackServer({ state }) {
  let server;
  let timeout;
  let resolveCallback;
  let rejectCallback;
  const waitForCallback = new Promise((resolve, reject) => {
    resolveCallback = resolve;
    rejectCallback = reject;
  });

  await new Promise((resolve, reject) => {
    server = http.createServer((request, response) => {
      try {
        const callback = parseOAuthCallbackRequest(request.url ?? "/");
        const responseBody = callback.error
          ? "<html><body><h1>OpenAI login failed</h1><p>You can close this tab.</p></body></html>"
          : "<html><body><h1>OpenAI login complete</h1><p>You can return to Brah.</p></body></html>";
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": Buffer.byteLength(responseBody),
          Connection: "close",
        });
        response.end(responseBody);
        if (callback.state !== state) {
          rejectCallback(new Error("OpenAI login state mismatch."));
          return;
        }
        resolveCallback(callback);
      } catch (error) {
        response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Invalid OpenAI login callback.");
        rejectCallback(error);
      }
    });

    server.once("error", reject);
    server.listen(openAIAuthConfig.redirectPort, "127.0.0.1", () => {
      server.off("error", reject);
      timeout = setTimeout(() => {
        rejectCallback(new Error("OpenAI login callback timed out."));
        server.close();
      }, 120_000);
      resolve();
    });
  });

  return {
    waitForCallback,
    close() {
      clearTimeout(timeout);
      server?.close();
    },
  };
}

function parseOAuthCallbackRequest(rawUrl) {
  const url = new URL(rawUrl, createOpenAIRedirectUri());
  if (url.pathname !== openAIAuthConfig.redirectPath) {
    throw new Error(`Unexpected OpenAI OAuth callback path: ${url.pathname}`);
  }

  return {
    code: url.searchParams.get("code") ?? undefined,
    state: url.searchParams.get("state") ?? undefined,
    error: url.searchParams.get("error") ?? undefined,
  };
}

async function exchangeOpenAICode({ code, codeVerifier, redirectUri }) {
  return tokenJsonToCredentials(
    await postOpenAIForm(
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: openAIAuthConfig.clientId,
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
      "OpenAI token exchange",
    ),
  );
}

async function refreshOpenAICredentials(credentials) {
  const refreshed = tokenJsonToCredentials(
    await postOpenAIForm(
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credentials.refreshToken,
        client_id: openAIAuthConfig.clientId,
      }),
      "OpenAI token refresh",
    ),
    credentials.refreshToken,
  );
  await saveOpenAICredentials(refreshed);
  return refreshed;
}

async function postOpenAIForm(body, label) {
  const response = await fetch(openAIAuthConfig.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return parseJsonResponse(response, label);
}

async function createRealtimeClientSecret(credentials, options) {
  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ session: buildRealtimeSessionConfig(options) }),
  });
  const raw = await parseJsonResponse(response, "Realtime client secret request");
  const value = typeof raw.value === "string" ? raw.value : undefined;
  if (!value) {
    throw new Error("Realtime client secret response did not include a value.");
  }

  return {
    value,
    expiresAt: parseExpiresAt(raw.expires_at),
    raw,
  };
}

function buildRealtimeSessionConfig(options) {
  const model = typeof options.model === "string" ? options.model : realtimeDefaults.model;
  const voice = typeof options.voice === "string" ? options.voice : realtimeDefaults.voice;
  const instructions =
    typeof options.instructions === "string" && options.instructions.trim()
      ? options.instructions.trim()
      : buildRealtimeInstructions();

  return {
    type: "realtime",
    model,
    instructions,
    output_modalities: ["audio"],
    audio: {
      input: {
        format: { type: "audio/pcm", rate: realtimeDefaults.sampleRate },
        noise_reduction: { type: "near_field" },
        transcription: { model: "gpt-4o-transcribe" },
        turn_detection: {
          type: "semantic_vad",
          eagerness: "high",
          create_response: true,
          interrupt_response: true,
        },
      },
      output: {
        format: { type: "audio/pcm", rate: realtimeDefaults.sampleRate },
        voice,
        speed: 1.0,
      },
    },
    max_output_tokens: 4096,
    reasoning: { effort: "minimal" },
    tools: getRealtimeToolDefinitions(),
    tool_choice: "auto",
    tracing: "auto",
  };
}

async function parseJsonResponse(response, label) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${label} failed (${response.status}): ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
}

async function getFreshOpenAICredentials() {
  const credentials = await loadOpenAICredentials();
  if (!credentials) {
    return null;
  }
  const refreshMarginMs = 5 * 60 * 1000;
  if (credentials.expiresAt - refreshMarginMs > Date.now()) {
    return credentials;
  }
  return refreshOpenAICredentials(credentials);
}

async function loadOpenAICredentials() {
  try {
    const raw = await fs.readFile(credentialsPath(), "utf8");
    const payload = JSON.parse(raw);
    const serialized = typeof payload.data === "string" ? payload.data : undefined;
    if (!serialized) {
      return null;
    }
    const json = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(Buffer.from(serialized, "base64"))
      : Buffer.from(serialized, "base64").toString("utf8");
    return parseCredentials(JSON.parse(json));
  } catch {
    return null;
  }
}

async function saveOpenAICredentials(credentials) {
  await fs.mkdir(path.dirname(credentialsPath()), { recursive: true });
  const json = JSON.stringify(credentials);
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(json).toString("base64")
    : Buffer.from(json, "utf8").toString("base64");
  await fs.writeFile(credentialsPath(), JSON.stringify({ data }, null, 2), { mode: 0o600 });
}

async function clearOpenAICredentials() {
  await fs.rm(credentialsPath(), { force: true });
}

function credentialsPath() {
  return path.join(app.getPath("userData"), "openai-credentials.json");
}

function tokenJsonToCredentials(response, fallbackRefreshToken) {
  if (!isRecord(response)) {
    throw new Error("OpenAI token response was not an object.");
  }
  if (typeof response.access_token !== "string") {
    throw new Error("OpenAI token response did not include an access token.");
  }
  const refreshToken = response.refresh_token ?? fallbackRefreshToken;
  if (typeof refreshToken !== "string") {
    throw new Error("OpenAI token response did not include a refresh token.");
  }
  if (typeof response.expires_in !== "number") {
    throw new Error("OpenAI token response did not include expires_in.");
  }
  const credentials = {
    accessToken: response.access_token,
    refreshToken,
    expiresAt: Date.now() + response.expires_in * 1000,
  };
  const accountId = getAccountId(response.access_token);
  return accountId ? { ...credentials, accountId } : credentials;
}

function parseCredentials(value) {
  if (
    !isRecord(value) ||
    typeof value.accessToken !== "string" ||
    typeof value.refreshToken !== "string" ||
    typeof value.expiresAt !== "number"
  ) {
    return null;
  }
  return {
    accessToken: value.accessToken,
    refreshToken: value.refreshToken,
    expiresAt: value.expiresAt,
    ...(typeof value.accountId === "string" ? { accountId: value.accountId } : {}),
  };
}

function credentialsToStatus(credentials) {
  return {
    connected: true,
    expiresAt: credentials.expiresAt,
    accountId: credentials.accountId ?? null,
  };
}

function getAccountId(accessToken) {
  const payload = decodeJwt(accessToken);
  const auth = isRecord(payload?.["https://api.openai.com/auth"])
    ? payload["https://api.openai.com/auth"]
    : null;
  return typeof auth?.chatgpt_account_id === "string" ? auth.chatgpt_account_id : undefined;
}

function decodeJwt(token) {
  try {
    const parts = token.split(".");
    const payload = parts[1];
    if (parts.length !== 3 || !payload) {
      return null;
    }
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function parseExpiresAt(value) {
  if (typeof value !== "number") {
    return undefined;
  }
  return value > 10_000_000_000 ? value : value * 1000;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
