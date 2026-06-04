import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, isAbsolute, join, normalize, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import pngjs from "pngjs";

const { PNG } = pngjs;

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(repoRoot, "src");
const artifactDir = join(repoRoot, "tasks", "artifacts", "post-mvp-ui-regression");
const rendererUrl = "/renderer/index.html";
const fixedNow = "2026-06-03T21:08:47.000Z";
const viewport = Object.freeze({ width: 1060, height: 712 });
const narrowViewport = Object.freeze({ width: 720, height: 712 });
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

const voiceStateMap = Object.freeze({
  error: Object.freeze({
    commandCenterState: "error",
    hint: "Use Retry, Open Settings, or Configure Provider from the voice failure action.",
    notice: "Voice startup failed before listening. Retry to start a new session.",
    orbState: "error",
    preview: "Voice startup needs attention",
    status: "VOICE ERROR",
    transcript: "Voice startup failed before listening.",
    voiceStartup: "session",
  }),
  listening: Object.freeze({
    commandCenterState: "listening",
    hint: "Keep speaking naturally.",
    notice: "Listening",
    orbState: "listening",
    preview: "Listening for your request",
    status: "LISTENING",
    transcript: "Listening...",
    voiceStartup: "listening",
  }),
  starting: Object.freeze({
    commandCenterState: "thinking",
    hint: "Creating voice session and keeping the dock visible.",
    notice: "Starting...",
    orbState: "starting",
    preview: "Voice startup preflight",
    status: "STARTING",
    transcript: "Starting voice...",
    voiceStartup: "starting",
  }),
});

const regressionStates = Object.freeze([
  Object.freeze({
    id: "home",
    filename: "home.png",
    nav: "Home",
    readySelector: ".home-screen [data-home-recent-list]:not([aria-busy])",
    nonOverlapBoundary: "[data-home-suggested-slot]",
    nonOverlapSelectors: Object.freeze(["[data-home-recent-list]"]),
    requiredSelectors: Object.freeze([
      "#leena-shell",
      ".home-screen",
      ".home-command__surface",
      ".home-command__input",
      ".cc[data-state='idle']",
    ]),
  }),
  Object.freeze({
    id: "settings-overview",
    filename: "settings-overview.png",
    nav: "Settings",
    readySelector: ".settings-screen[data-settings-active-detail='overview']",
    requiredSelectors: Object.freeze([
      "#leena-shell",
      ".settings-screen",
      "[data-settings-detail='overview']",
      "[data-settings-detail-target='general']",
      "[data-settings-detail-target='theme']",
      "[data-settings-detail-target='providers']",
      "[data-settings-detail-target='updates']",
      "[data-settings-detail-target='mac-access']",
      "[data-settings-detail-target='integrations-health']",
      ".cc[data-state='idle']",
    ]),
  }),
  Object.freeze({
    detailTarget: "general",
    id: "settings-general",
    filename: "settings-general.png",
    nav: "Settings",
    readySelector: ".settings-screen[data-settings-active-detail='general']",
    requiredSelectors: Object.freeze([
      "#leena-shell",
      ".settings-identity",
      "[data-agent-name]",
      "[data-persona-select]",
      "[data-persona-tone]",
      "[data-settings-detail-back='general']",
      ".cc[data-state='idle']",
    ]),
  }),
  Object.freeze({
    detailTarget: "theme",
    id: "settings-theme",
    filename: "settings-theme.png",
    nav: "Settings",
    readySelector: ".settings-screen[data-settings-active-detail='theme']",
    requiredSelectors: Object.freeze([
      "#leena-shell",
      "#settings-theme-title",
      "[data-appearance-key='theme']",
      "[data-appearance-key='treatment']",
      "[data-appearance-key='density']",
      "[data-settings-detail-back='theme']",
      ".cc[data-state='idle']",
    ]),
  }),
  Object.freeze({
    detailTarget: "updates",
    id: "settings-updates",
    filename: "settings-updates.png",
    nav: "Settings",
    readySelector: ".settings-screen[data-settings-active-detail='updates']",
    requiredSelectors: Object.freeze([
      "#leena-shell",
      "[data-settings-detail='updates']",
      "[data-update-state]",
      "[data-update-version]",
      "[data-update-check]",
      "[data-update-download]",
      "[data-update-install]",
      "[data-settings-detail-back='updates']",
      ".cc[data-state='idle']",
    ]),
  }),
  Object.freeze({
    detailTarget: "providers",
    id: "settings-providers",
    filename: "settings-providers.png",
    nav: "Settings",
    nonOverlapBoundary: ".command-center-mount",
    nonOverlapSelectors: Object.freeze([
      "[data-provider-card]",
      ".settings-capability-row",
      "[data-ollama-pull-panel]",
    ]),
    readySelector:
      ".settings-screen[data-settings-active-detail='providers'] [data-provider-detail]",
    requiredSelectors: Object.freeze([
      "#leena-shell",
      "[data-settings-detail='providers']",
      "[data-provider-card='openai']",
      "[data-provider-card='openrouter']",
      "[data-provider-card='ollama']",
      "[data-provider-refresh='openai']",
      "[data-capability-provider='chat']",
      "[data-capability-model='chat']",
      "[data-ollama-pull-panel]",
      ".cc[data-state='idle']",
    ]),
  }),
  Object.freeze({
    detailTarget: "mac-access",
    id: "settings-mac-access",
    filename: "settings-mac-access.png",
    nav: "Settings",
    readySelector: ".settings-screen[data-settings-active-detail='mac-access']",
    requiredSelectors: Object.freeze([
      "#leena-shell",
      "[data-settings-detail='mac-access']",
      "[data-wake-enabled]",
      "[data-wake-muted]",
      "[data-wake-status]",
      "[data-settings-detail-back='mac-access']",
      ".cc[data-state='idle']",
    ]),
  }),
  Object.freeze({
    detailTarget: "integrations-health",
    id: "settings-integrations-health",
    filename: "settings-integrations-health.png",
    nav: "Settings",
    readySelector: ".settings-screen[data-settings-active-detail='integrations-health']",
    requiredSelectors: Object.freeze([
      "#leena-shell",
      "[data-settings-detail='integrations-health']",
      "[data-settings-detail-back='integrations-health']",
      "[data-settings-detail='integrations-health'] [data-settings-primitive='status-callout']",
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
    id: "integrations-composio",
    filename: "integrations-composio.png",
    integrationDetail: "composio",
    nav: "Integrations",
    readySelector: "[data-integrations-detail-panel][data-integrations-detail-active='composio']",
    requiredSelectors: Object.freeze([
      "#leena-shell",
      ".integrations-screen[data-integrations-detail='composio']",
      "[data-integrations-detail-card][data-integrations-detail='composio'][aria-pressed='true']",
      "[data-integrations-detail-panel][data-integrations-detail-active='composio']",
      "[data-integrations-list]",
      ".cc[data-state='idle']",
    ]),
  }),
  Object.freeze({
    id: "integrations-mcp",
    filename: "integrations-mcp.png",
    integrationDetail: "custom-mcp",
    nav: "Integrations",
    nonOverlapBoundary: ".command-center-mount",
    nonOverlapSelectors: Object.freeze(["[data-integrations-list]"]),
    readySelector: "[data-integrations-detail-panel][data-integrations-detail-active='custom-mcp']",
    requiredSelectors: Object.freeze([
      "#leena-shell",
      ".integrations-screen[data-integrations-detail='custom-mcp']",
      "[data-integrations-detail-card][data-integrations-detail='custom-mcp'][aria-pressed='true']",
      "[data-integrations-field='name']",
      "[data-integrations-field='transport']",
      "[data-integrations-list]",
      ".cc[data-state='idle']",
    ]),
  }),
  Object.freeze({
    id: "integrations-mac-access",
    filename: "integrations-mac-access.png",
    integrationDetail: "full-disk-access",
    nav: "Integrations",
    readySelector:
      "[data-integrations-detail-panel][data-integrations-detail-active='full-disk-access']",
    scrollSelector: "[data-integrations-permission-actions='full-disk-access']",
    requiredSelectors: Object.freeze([
      "#leena-shell",
      ".integrations-screen[data-integrations-detail='full-disk-access']",
      "[data-integrations-detail-card][data-integrations-detail='full-disk-access'][aria-pressed='true']",
      "[data-integrations-permission-actions='full-disk-access']",
      "[data-integrations-action='open-permission-settings'][data-permission-id='full-disk-access']",
      ".cc[data-state='idle']",
    ]),
  }),
  Object.freeze({
    id: "chat",
    filename: "chat.png",
    nav: "Chat",
    readySelector: "[data-chat-workspace]",
    requiredSelectors: Object.freeze([
      "#leena-shell",
      "[data-chat-workspace]",
      "[data-chat-history-rail]",
      "[data-chat-conversation-list]",
      "[data-chat-transcript]",
      "[data-chat-send-path='window.leena.chat.send']",
      ".cc[data-state='idle']",
    ]),
  }),
  Object.freeze({
    id: "voice-starting",
    filename: "voice-starting.png",
    clipSelector: ".command-center-mount",
    nav: "Home",
    readySelector: ".cc.cc--compact[data-state='thinking']",
    requiredSelectors: Object.freeze([
      ".command-center-mount",
      "#app-shell.leena[data-orb-state='starting']",
      "#app-shell.leena[data-voice-startup='starting']",
      ".cc.cc--compact[data-state='thinking']",
      ".cc__orb",
      ".cc__transcript",
    ]),
    voiceState: voiceStateMap.starting,
  }),
  Object.freeze({
    id: "voice-listening",
    filename: "voice-listening.png",
    clipSelector: ".command-center-mount",
    nav: "Home",
    readySelector: ".cc.cc--compact[data-state='listening']",
    requiredSelectors: Object.freeze([
      ".command-center-mount",
      "#app-shell.leena[data-orb-state='listening']",
      "#app-shell.leena[data-voice-startup='listening']",
      ".cc.cc--compact[data-state='listening']",
      ".cc__orb",
      ".cc__transcript",
    ]),
    voiceState: voiceStateMap.listening,
  }),
  Object.freeze({
    id: "voice-error",
    filename: "voice-error.png",
    clipSelector: ".command-center-mount",
    nav: "Home",
    readySelector: ".cc.cc--compact[data-state='error']",
    requiredSelectors: Object.freeze([
      ".command-center-mount",
      "#app-shell.leena[data-orb-state='error']",
      "#app-shell.leena[data-voice-startup='session']",
      ".cc.cc--compact[data-state='error']",
      ".cc__orb",
      ".cc__transcript",
    ]),
    voiceState: voiceStateMap.error,
  }),
]);

test("captures deterministic post-MVP UI regression screenshots", { timeout: 90_000 }, async () => {
  await rm(artifactDir, { force: true, recursive: true });
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

    for (const state of regressionStates) {
      await prepareRegressionState(page, state);
      await page.waitForSelector(state.readySelector, { state: "visible", timeout: 10_000 });
      await assertSelectorsInsideViewport(page, state.requiredSelectors, state.id);
      await assertNoHorizontalOverflow(page, state.id);
      if (state.nonOverlapBoundary && state.nonOverlapSelectors) {
        await assertSelectorsDoNotOverlap(
          page,
          state.nonOverlapSelectors,
          state.nonOverlapBoundary,
          state.id,
        );
      }
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
        nav: state.nav,
        orbState: state.voiceState?.orbState ?? null,
        selector: state.clipSelector ?? null,
        voiceState: state.voiceState
          ? {
              commandCenterState: state.voiceState.commandCenterState,
              requestedState: state.id.replace("voice-", ""),
            }
          : null,
      });
    }

    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await server.close();
  }

  await writeRegressionManifest(screenshots);
});

test("keeps Chat rail and composer separated at narrow panel widths", {
  timeout: 30_000,
}, async () => {
  const server = await startStaticServer(srcRoot);
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ deviceScaleFactor, viewport: narrowViewport });
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
    await selectScreen(page, "Chat");
    await page.waitForSelector("[data-chat-workspace]", { state: "visible", timeout: 10_000 });
    await assertNoHorizontalOverflow(page, "chat-narrow", narrowViewport);

    await assertSelectorsInsideViewport(
      page,
      [
        "[data-chat-history-rail]",
        ".chat-screen__workspace",
        "[data-chat-transcript]",
        "[data-chat-send-path='window.leena.chat.send']",
        "[data-chat-message]",
        "[data-chat-send-button]",
      ],
      "chat-narrow",
      narrowViewport,
    );
    await assertSelectorsDoNotOverlap(
      page,
      [".chat-screen__workspace"],
      "[data-chat-history-rail]",
      "chat-narrow",
    );
    await assertSelectorsDoNotOverlap(
      page,
      [".chat-screen__composer"],
      ".command-center-mount",
      "chat-narrow",
    );

    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await server.close();
  }
});

async function prepareRegressionState(page, state) {
  await selectScreen(page, state.nav);

  if (state.detailTarget) {
    await selectSettingsDetail(page, state.detailTarget);
  }

  if (state.integrationDetail) {
    await selectIntegrationDetail(page, state.integrationDetail);
  }

  if (state.scrollSelector) {
    await page.locator(state.scrollSelector).first().scrollIntoViewIfNeeded();
  }

  if (state.voiceState) {
    await applyVoiceState(page, state.voiceState);
  } else {
    await resetVoiceState(page);
  }
}

async function selectScreen(page, screen) {
  await page.locator(`[data-screen="${screen}"]`).click();
}

async function selectSettingsDetail(page, detailTarget) {
  await page.locator(`[data-settings-detail-target="${detailTarget}"]`).first().click();
}

async function selectIntegrationDetail(page, detailId) {
  await page
    .locator(`[data-integrations-detail-card][data-integrations-detail="${detailId}"]`)
    .first()
    .click();
}

async function applyVoiceState(page, voiceState) {
  await page.evaluate((state) => {
    const appShell = document.querySelector("#app-shell.leena");
    if (appShell) {
      appShell.dataset.mode = state.orbState === "error" ? "failed" : state.orbState;
      appShell.dataset.orbState = state.orbState;
      appShell.dataset.voiceStartup = state.voiceStartup;
    }

    const commandCenter = document.querySelector(".command-center-mount .cc");
    if (commandCenter) {
      commandCenter.dataset.state = state.commandCenterState;
      commandCenter.dataset.hasTool = "false";
      commandCenter.querySelector(".cc__status").textContent = state.status;
      commandCenter.querySelector(".cc__transcript").textContent = state.transcript;
      commandCenter.querySelector(".cc__hint").textContent = state.hint;
      commandCenter.querySelector(".cc__preview-text").textContent = state.preview;
    }

    const toolActivity = document.querySelector("#tool-activity");
    const toolActivityLabel = document.querySelector("#tool-activity-label");
    if (toolActivity && toolActivityLabel) {
      toolActivity.hidden = false;
      toolActivityLabel.textContent = state.notice;
    }

    const callEnd = document.querySelector("#call-end");
    if (callEnd) {
      callEnd.disabled = state.orbState !== "error";
      callEnd.tabIndex = state.orbState === "error" ? 0 : -1;
      callEnd.setAttribute(
        "aria-label",
        state.orbState === "error" ? "Retry: Voice startup failed" : "End call",
      );
      const label = callEnd.querySelector("span:last-child");
      if (label) {
        label.textContent = state.orbState === "error" ? "Retry" : "End";
      }
    }
  }, voiceState);
}

async function resetVoiceState(page) {
  await page.evaluate(() => {
    const appShell = document.querySelector("#app-shell.leena");
    if (appShell) {
      appShell.dataset.mode = "idle";
      appShell.dataset.orbState = "idle";
      delete appShell.dataset.voiceStartup;
    }

    const commandCenter = document.querySelector(".command-center-mount .cc");
    if (commandCenter) {
      commandCenter.dataset.state = "idle";
      commandCenter.dataset.hasTool = "false";
      commandCenter.querySelector(".cc__status").textContent = "READY";
      commandCenter.querySelector(".cc__transcript").textContent = "Ready when you are.";
      commandCenter.querySelector(".cc__hint").textContent =
        "Ask Leena to search, plan, or control your computer.";
      commandCenter.querySelector(".cc__preview-text").textContent = "Computer control preview";
    }

    const toolActivity = document.querySelector("#tool-activity");
    if (toolActivity) {
      toolActivity.hidden = true;
    }

    const callEnd = document.querySelector("#call-end");
    if (callEnd) {
      callEnd.disabled = true;
      callEnd.tabIndex = -1;
      callEnd.setAttribute("aria-label", "End call");
      const label = callEnd.querySelector("span:last-child");
      if (label) {
        label.textContent = "End";
      }
    }
  });
}

async function assertSelectorsInsideViewport(page, selectors, stateId, activeViewport = viewport) {
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
      box.x + box.width <= activeViewport.width + 1,
      `${stateId}: ${selector} fits viewport width`,
    );
    assert.ok(
      box.y + Math.min(box.height, activeViewport.height) <= activeViewport.height + 1,
      `${stateId}: ${selector} fits viewport height (${JSON.stringify(box)})`,
    );
  }
}

async function assertNoHorizontalOverflow(page, stateId, activeViewport = viewport) {
  const result = await page.evaluate(() => {
    const candidates = [
      ["document", document.documentElement],
      ["body", document.body],
      ["#app-shell", document.querySelector("#app-shell")],
      ["#leena-shell", document.querySelector("#leena-shell")],
      ["#shell-content", document.querySelector("#shell-content")],
    ].filter(([, element]) => Boolean(element));

    const viewportWidth = window.innerWidth;
    const overflows = candidates
      .map(([selector, element]) => {
        const rect = element.getBoundingClientRect();
        const clientWidth =
          element === document.documentElement
            ? document.documentElement.clientWidth
            : element.clientWidth;
        return {
          clientWidth,
          rectLeft: Number(rect.left.toFixed(2)),
          rectRight: Number(rect.right.toFixed(2)),
          rectWidth: Number(rect.width.toFixed(2)),
          scrollWidth: element.scrollWidth,
          selector,
        };
      })
      .filter(
        (item) =>
          item.scrollWidth > item.clientWidth + 2 ||
          item.scrollWidth > item.rectWidth + 2 ||
          item.rectLeft < -2 ||
          item.rectRight > viewportWidth + 2,
      );

    return { overflows, viewportWidth };
  });

  assert.equal(
    result.viewportWidth,
    activeViewport.width,
    `${stateId}: viewport width matches expected capture width`,
  );
  assert.deepEqual(result.overflows, [], `${stateId}: no horizontal overflow`);
}

async function assertSelectorsDoNotOverlap(page, selectors, boundarySelector, stateId) {
  const boundaryBox = await page.locator(boundarySelector).first().boundingBox();
  assert.ok(boundaryBox, `${stateId}: ${boundarySelector} has a bounding box`);

  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count();
    assert.ok(count > 0, `${stateId}: ${selector} has elements`);

    for (let index = 0; index < count; index += 1) {
      const box = await locator.nth(index).boundingBox();
      if (!box) {
        continue;
      }
      assert.equal(
        boxesOverlap(box, boundaryBox),
        false,
        `${stateId}: ${selector}[${index}] does not overlap ${boundarySelector}`,
      );
    }
  }
}

function boxesOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
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

async function writeRegressionManifest(screenshots) {
  const manifest = {
    commands: {
      full: "node --test",
      regression: "node --test test/ui-baseline-smoke.test.js",
      staticCheck: "npm run check",
    },
    coverage: regressionStates.map((state) => ({
      file: state.filename,
      id: state.id,
      nav: state.nav,
      selectors: [...state.requiredSelectors],
    })),
    deviceScaleFactor,
    fixedNow,
    narrowViewport,
    rendererUrl,
    screenshots,
    suite: "post-mvp-ui-regression",
    viewport,
    voiceStateNotes: {
      starting:
        "Renderer orb state uses data-orb-state='starting'; command-center visual state maps to thinking.",
    },
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
