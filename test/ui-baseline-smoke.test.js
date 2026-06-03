import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, isAbsolute, join, normalize, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import pngjs from "pngjs";

const { PNG } = pngjs;

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(repoRoot, "src");
const artifactDir = join(repoRoot, "tasks", "artifacts", "post-mvp-ui-baseline");
const rendererUrl = "/renderer/index.html";
const fixedNow = "2026-06-03T21:08:47.000Z";
const viewport = Object.freeze({ width: 1060, height: 712 });
const deviceScaleFactor = 1;

const mimeTypes = Object.freeze({
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
});

const baselineStates = Object.freeze([
  Object.freeze({
    id: "home",
    filename: "home.png",
    nav: "Home",
    readySelector: ".home-screen [data-home-recent-list]:not([aria-busy])",
    requiredSelectors: Object.freeze([
      "#leena-shell",
      ".home-screen",
      ".home-command__surface",
      ".home-command__input",
      ".cc[data-state='idle']",
    ]),
  }),
  Object.freeze({
    id: "settings",
    filename: "settings.png",
    nav: "Settings",
    readySelector: ".settings-screen",
    requiredSelectors: Object.freeze([
      "#leena-shell",
      ".settings-screen",
      ".settings-identity",
      "#settings-appearance-title",
      ".cc[data-state='idle']",
    ]),
  }),
  Object.freeze({
    id: "integrations",
    filename: "integrations.png",
    nav: "Integrations",
    readySelector: ".integrations-screen[data-integrations-state='ready']",
    requiredSelectors: Object.freeze([
      "#leena-shell",
      ".integrations-screen",
      ".integrations-header",
      "[data-integrations-list]",
      ".cc[data-state='idle']",
    ]),
  }),
  Object.freeze({
    id: "voice-dock-start",
    filename: "voice-dock-start.png",
    clipSelector: ".command-center-mount",
    nav: "Home",
    readySelector: ".cc.cc--compact[data-state='idle']",
    requiredSelectors: Object.freeze([
      ".command-center-mount",
      ".cc.cc--compact[data-state='idle']",
      ".cc__orb",
      ".cc__transcript",
    ]),
  }),
]);

test("captures deterministic post-MVP UI baseline screenshots", { timeout: 60_000 }, async () => {
  await mkdir(artifactDir, { recursive: true });
  const server = await startStaticServer(srcRoot);
  const browser = await chromium.launch({ headless: true });
  const screenshots = [];

  try {
    const page = await browser.newPage({ deviceScaleFactor, viewport });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") {
        pageErrors.push(message.text());
      }
    });

    await page.addInitScript(installBaselineBridge, { fixedNow });
    await page.goto(`${server.url}${rendererUrl}`, { waitUntil: "networkidle" });
    await page.waitForSelector("#app-shell[data-onboarding='complete']", { timeout: 10_000 });
    await page.waitForSelector(".cc.cc--compact[data-state='idle']", { timeout: 10_000 });

    for (const state of baselineStates) {
      await selectScreen(page, state.nav);
      await page.waitForSelector(state.readySelector, { state: "visible", timeout: 10_000 });
      await assertSelectorsInsideViewport(page, state.requiredSelectors, state.id);
      const outputPath = join(artifactDir, state.filename);
      const buffer = state.clipSelector
        ? await page.locator(state.clipSelector).first().screenshot({ path: outputPath })
        : await page.screenshot({ fullPage: false, path: outputPath, type: "png" });
      const stats = assertNonblankPng(buffer, state.id);
      screenshots.push({
        ...stats,
        capture: state.clipSelector ? "clip" : "viewport",
        file: state.filename,
        id: state.id,
        selector: state.clipSelector ?? null,
      });
    }

    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await server.close();
  }

  await writeBaselineManifest(screenshots);
});

async function selectScreen(page, screen) {
  await page.locator(`[data-screen="${screen}"]`).click();
}

async function assertSelectorsInsideViewport(page, selectors, stateId) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    await locator.waitFor({ state: "visible", timeout: 10_000 });
    const box = await locator.boundingBox();
    assert.ok(box, `${stateId}: ${selector} has a bounding box`);
    assert.ok(box.width > 0, `${stateId}: ${selector} has positive width`);
    assert.ok(box.height > 0, `${stateId}: ${selector} has positive height`);
    assert.ok(box.x >= 0, `${stateId}: ${selector} starts inside viewport horizontally`);
    assert.ok(box.y >= 0, `${stateId}: ${selector} starts inside viewport vertically`);
    assert.ok(
      box.x + box.width <= viewport.width + 1,
      `${stateId}: ${selector} fits viewport width`,
    );
    assert.ok(
      box.y + Math.min(box.height, viewport.height) <= viewport.height + 1,
      `${stateId}: ${selector} fits viewport height`,
    );
  }
}

function assertNonblankPng(buffer, stateId) {
  const image = PNG.sync.read(buffer);
  const pixelCount = image.width * image.height;
  let visiblePixels = 0;
  let minLuminance = Number.POSITIVE_INFINITY;
  let maxLuminance = Number.NEGATIVE_INFINITY;
  const colorBuckets = new Set();

  for (let index = 0; index < image.data.length; index += 4) {
    const alpha = image.data[index + 3];
    if (alpha < 10) {
      continue;
    }

    const red = image.data[index];
    const green = image.data[index + 1];
    const blue = image.data[index + 2];
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    visiblePixels += 1;
    minLuminance = Math.min(minLuminance, luminance);
    maxLuminance = Math.max(maxLuminance, luminance);
    colorBuckets.add(`${red >> 4}:${green >> 4}:${blue >> 4}:${alpha >> 4}`);
  }

  const visibleRatio = visiblePixels / pixelCount;
  const luminanceRange = maxLuminance - minLuminance;

  assert.equal(image.width > 0, true, `${stateId}: PNG has width`);
  assert.equal(image.height > 0, true, `${stateId}: PNG has height`);
  assert.ok(visibleRatio > 0.05, `${stateId}: screenshot has visible pixels`);
  assert.ok(luminanceRange > 12, `${stateId}: screenshot is not flat-color blank`);
  assert.ok(colorBuckets.size > 12, `${stateId}: screenshot has color variance`);

  return {
    colorBuckets: colorBuckets.size,
    height: image.height,
    luminanceRange: Number(luminanceRange.toFixed(2)),
    visibleRatio: Number(visibleRatio.toFixed(4)),
    width: image.width,
  };
}

async function writeBaselineManifest(screenshots) {
  const manifest = {
    baseline: "post-mvp-ui-baseline",
    commands: {
      focused: "node --test test/ui-baseline-smoke.test.js",
      full: "node --test",
      staticCheck: "npm run check",
    },
    deviceScaleFactor,
    fixedNow,
    rendererUrl,
    screenshots,
    viewport,
  };

  await writeFile(join(artifactDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function startStaticServer(root) {
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(
      requestUrl.pathname === "/" ? rendererUrl : requestUrl.pathname,
    );
    const filePath = normalize(join(root, pathname));
    const relativePath = relative(root, filePath);

    if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
      response.writeHead(403).end();
      return;
    }

    try {
      const fileStats = await stat(filePath);
      if (!fileStats.isFile()) {
        response.writeHead(404).end();
        return;
      }
      response.setHeader(
        "content-type",
        mimeTypes[extname(filePath)] ?? "application/octet-stream",
      );
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404).end("not found");
    }
  });

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  assert.equal(typeof address, "object");
  assert.ok(address?.port);

  return {
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
    url: `http://127.0.0.1:${address.port}`,
  };
}

function installBaselineBridge({ fixedNow: fixedTimestamp }) {
  const RealDate = Date;
  const fixedTime = new RealDate(fixedTimestamp).getTime();
  class FixedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(fixedTime);
      } else {
        super(...args);
      }
    }

    static now() {
      return fixedTime;
    }
  }
  Object.defineProperty(globalThis, "Date", {
    configurable: true,
    value: FixedDate,
    writable: true,
  });

  const settings = {
    active_persona_id: "default",
    density: "comfortable",
    hotkey: "CommandOrControl+Shift+L",
    launchOnLogin: false,
    notificationsEnabled: true,
    onboardingCompleted: true,
    proactiveNudges: true,
    theme: "workspace",
    treatment: "workspace",
    wakeEnabled: false,
    wakeMuted: false,
  };
  const profile = {
    about: "",
    goals: [],
    name: "Yasmine",
    persona: "default",
    personaId: "default",
    voice: "marin",
  };
  const activity = [
    {
      detail: "Remembered premium UI proof requirements",
      id: "activity-baseline-1",
      kind: "memory",
      timestamp: fixedTimestamp,
      title: "Saved product note",
    },
    {
      detail: "Reviewed upcoming tasks for today",
      id: "activity-baseline-2",
      kind: "tool",
      timestamp: fixedTimestamp,
      title: "Checked planner",
    },
  ];
  const planner = [
    {
      detail: "Capture proof before UI changes",
      id: "planner-baseline-1",
      time: "15:30",
      title: "Wave 17 visual baseline",
      type: "Task",
    },
    {
      detail: "Compare access and provider groups",
      id: "planner-baseline-2",
      time: "16:15",
      title: "Review settings IA",
      type: "Review",
    },
  ];
  const permissions = [
    {
      activation: "Allowed",
      description: "Voice input is available for the baseline shell.",
      id: "microphone",
      label: "Microphone",
      status: "granted",
    },
    {
      activation: "Open macOS Privacy & Security to grant access.",
      description: "Screen analysis requires Screen Recording permission.",
      id: "screen",
      label: "Screen Recording",
      status: "missing",
    },
  ];
  const providers = [
    {
      capabilities: { chat: true, embeddings: true, realtime: true, stt: true, tts: true },
      id: "openai",
      name: "OpenAI",
      status: "missing",
    },
    {
      capabilities: { chat: true, embeddings: true, realtime: false, stt: false, tts: false },
      id: "openrouter",
      name: "OpenRouter",
      status: "missing",
    },
    {
      capabilities: { chat: true, embeddings: true, realtime: false, stt: false, tts: false },
      id: "ollama",
      name: "Ollama",
      status: "missing",
    },
  ];
  const mcpServers = [
    {
      command: "node tools.js",
      enabled: true,
      id: "local-tools",
      name: "Local Tools",
      transport: "stdio",
    },
    {
      enabled: true,
      id: "calendar",
      name: "Calendar MCP",
      transport: "http",
      url: "https://mcp.example.test",
    },
  ];
  const mcpStatuses = {
    calendar: { connected: false, toolCount: 3 },
    "local-tools": { connected: true, toolCount: 8 },
  };
  const noop = () => null;

  async function invoke(channel, ...args) {
    if (channel === "activity:get-recent" || channel === "activity:list") {
      return activity;
    }
    if (channel === "memory:recall") {
      return [
        {
          entry: {
            createdAt: fixedTimestamp,
            id: "memory-baseline-1",
            summary: "Baseline harness should fail blank screenshots.",
            type: "proof",
          },
        },
      ];
    }
    if (channel === "planner:get-upcoming" || channel === "planner:list-tasks") {
      return planner;
    }
    if (channel === "settings:get-all") {
      return settings;
    }
    if (channel === "settings:get") {
      return settings[args[0]] ?? args[1];
    }
    if (channel === "settings:get-hotkey") {
      return settings.hotkey;
    }
    if (channel.startsWith("update:")) {
      return { message: "Updates have not been checked yet.", state: "idle" };
    }
    if (channel === "wake:get-status") {
      return { available: false, enabled: false, muted: false };
    }
    return null;
  }

  window.leena = {
    cancelComputerUse: async () => ({}),
    chat: { send: async () => ({ content: "Stub response", ok: true }) },
    completePlannerTasks: async () => ({}),
    createPersonaSessionUpdate: async () => ({}),
    createRealtimeSecret: async () => ({ value: "baseline-secret" }),
    deleteCalendarItems: async () => ({}),
    deletePlannerTasks: async () => ({}),
    deleteScreenshots: async () => ({}),
    executeRealtimeTool: async () => ({}),
    getActivity: async () => activity,
    getAgentProfile: async () => profile,
    getAllSettings: async () => settings,
    getAppVersion: async () => "0.1.2",
    getCalendarItems: async () => planner,
    getDiagnosticLogPath: async () => "",
    getHotkey: async () => settings.hotkey,
    getMicrophoneDevice: async () => null,
    getOpenAIStatus: async () => ({ connected: false }),
    getOsPermissions: async () => permissions,
    getPlannerTasks: async () => planner,
    getPrivacyDiagnostics: async () => ({}),
    getRealtimeTools: async () => [],
    getSetting: async (key, fallback) => settings[key] ?? fallback,
    getTrayState: async () => "idle",
    getWindowState: async () => ({ ...viewport }),
    identity: {
      listPersonas: async () => [{ id: "default", name: "Leena" }],
      switchPersona: async () => profile,
    },
    invoke,
    isDevelopment: async () => false,
    listScreenshots: async () => [],
    loginOpenAI: async () => ({ connected: true }),
    logoutOpenAI: async () => ({ connected: false }),
    mcp: {
      addServer: async (config) => ({ id: "new-server", ...config }),
      connect: async (id) => ({ connected: true, id }),
      disconnect: async (id) => ({ connected: false, id }),
      getStatus: async () => mcpStatuses,
      listServers: async () => mcpServers,
      listTools: async () => [],
      offStatusChanged: noop,
      onStatusChanged: noop,
      removeServer: async (id) => ({ id, removed: true }),
      testConnection: async () => ({ ok: true }),
      updateServer: async () => ({}),
    },
    memory: {
      consolidate: async () => ({}),
      getConversation: async () => [],
      recall: async () => invoke("memory:recall"),
      remember: async () => ({}),
    },
    minimizeWindow: async () => null,
    nudges: {
      dismiss: async () => ({}),
      list: async () => ({
        enabled: true,
        nudges: [
          {
            detail: "Store objective screenshot proof.",
            id: "nudge-baseline-1",
            meta: "Now",
            source: "UI",
            title: "Capture baseline",
            type: "proof",
          },
        ],
        visibleLimit: 2,
      }),
      offChanged: noop,
      onChanged: noop,
      refresh: async () => ({}),
    },
    offChatChunk: noop,
    offDataChanged: noop,
    offRealtimeError: noop,
    offRealtimeResponseComplete: noop,
    offRealtimeStateChanged: noop,
    offRealtimeToolExecuting: noop,
    ollama: {
      offPullProgress: noop,
      onPullProgress: noop,
      pullModel: async () => ({}),
    },
    onChatChunk: noop,
    onDataChanged: noop,
    onRealtimeError: noop,
    onRealtimeResponseComplete: noop,
    onRealtimeStateChanged: noop,
    onRealtimeToolExecuting: noop,
    openDiagnosticLog: async () => null,
    openOsPermissionSettings: async () => null,
    providers: {
      getConfig: async () => ({}),
      getModels: async () => [{ id: "gpt-5", name: "GPT-5" }],
      list: async () => providers,
      setConfig: async (_providerId, config) => config,
      testConnection: async () => ({ message: "Test passed.", ok: true }),
    },
    quitApp: async () => null,
    requestOsPermission: async () => permissions,
    revealScreenshot: async () => null,
    sendChat: async () => ({ content: "Stub response", ok: true }),
    setAgentProfile: async () => profile,
    setHotkey: async (accelerator) => {
      settings.hotkey = accelerator;
      return accelerator;
    },
    setLaunchOnLogin: async (enabled) => {
      settings.launchOnLogin = Boolean(enabled);
      return settings.launchOnLogin;
    },
    setMicrophoneDevice: async () => null,
    setSetting: async (key, value) => {
      settings[key] = value;
      return value;
    },
    setTrayState: async () => null,
    setWindowFocusable: async () => null,
    setWindowMode: async () => null,
    setWindowState: async () => null,
    updates: {
      check: async () => ({ message: "No update checked.", state: "idle" }),
      download: async () => ({ message: "No update checked.", state: "idle" }),
      getStatus: async () => ({ message: "Updates have not been checked yet.", state: "idle" }),
      install: async () => ({ message: "No update checked.", state: "idle" }),
      offStatus: noop,
      onStatus: noop,
    },
    writeDiagnosticLog: async () => null,
  };
}
