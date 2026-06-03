import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  completeOnboarding,
  createInitialOnboardingState,
  formatHotkey,
  getStepById,
  hasRequiredPermissions,
  normalizeAuthStatus,
  normalizePermissions,
  ONBOARDING_SETTING_KEY,
  ONBOARDING_STEPS,
  renderOnboardingShell,
  resetOnboarding,
  shouldShowOnboarding,
} from "../src/renderer/onboarding.js";

function formRoot(values = {}) {
  return {
    querySelector(selector) {
      const match = selector.match(/name="([^"]+)"/);
      if (!match) {
        return null;
      }
      return { value: values[match[1]] ?? "" };
    },
  };
}

test("onboarding exports the required five-step renderer contract", () => {
  assert.deepEqual(
    ONBOARDING_STEPS.map((step) => step.id),
    ["welcome", "auth", "permissions", "name", "done"],
  );
  for (const step of ONBOARDING_STEPS) {
    assert.equal(typeof step.render, "function");
    assert.equal(typeof step.validate, "function");
  }

  const authHtml = renderOnboardingShell(
    createInitialOnboardingState({
      authStatus: { connected: false },
      currentStepId: "auth",
    }),
  );

  assert.match(authHtml, /OpenAI API key/);
  assert.match(authHtml, /Save API Key/);
  assert.match(authHtml, /Use ChatGPT OAuth/);
});

test("auth step saves an API key and requires OpenAI status to become connected", async () => {
  const savedKeys = [];
  const state = createInitialOnboardingState({ currentStepId: "auth" });
  const bridge = {
    async saveApiKey(apiKey) {
      savedKeys.push(apiKey);
      return { connected: true, authType: "api-key" };
    },
    async getOpenAIStatus() {
      return { connected: savedKeys.length > 0, authType: "api-key" };
    },
  };

  await getStepById("auth").validate({
    bridge,
    root: formRoot({ apiKey: "sk-test-onboarding" }),
    state,
  });

  assert.deepEqual(savedKeys, ["sk-test-onboarding"]);
  assert.deepEqual(normalizeAuthStatus(state.authStatus), {
    connected: true,
    authType: "api-key",
  });

  await assert.rejects(
    getStepById("auth").validate({
      bridge: {
        async getOpenAIStatus() {
          return { connected: false };
        },
      },
      root: formRoot(),
      state: createInitialOnboardingState({ currentStepId: "auth" }),
    }),
    /Paste an OpenAI API key/,
  );
});

test("permissions step only blocks on missing microphone access", async () => {
  const grantedPermissions = [
    { id: "microphone", status: "granted" },
    { id: "screen", status: "denied" },
    { id: "accessibility", status: "not-determined" },
    { id: "computer", status: "unsupported" },
  ];

  assert.equal(hasRequiredPermissions(grantedPermissions), true);
  assert.deepEqual(
    normalizePermissions(grantedPermissions).map((permission) => permission.id),
    ["microphone", "screen", "accessibility"],
  );

  await getStepById("permissions").validate({
    bridge: {
      async getOsPermissions() {
        return grantedPermissions;
      },
    },
    state: createInitialOnboardingState({ currentStepId: "permissions" }),
  });

  await assert.rejects(
    getStepById("permissions").validate({
      bridge: {
        async getOsPermissions() {
          return [{ id: "microphone", status: "denied" }];
        },
      },
      state: createInitialOnboardingState({ currentStepId: "permissions" }),
    }),
    /Microphone access is required/,
  );
});

test("name step saves the optional user name without losing profile fields", async () => {
  let savedProfile = null;
  const state = createInitialOnboardingState({ currentStepId: "name" });
  const bridge = {
    async getAgentProfile() {
      return {
        about: "Builder",
        goals: ["Ship Leena"],
        persona: "leena",
        voice: "verse",
      };
    },
    async setAgentProfile(profile) {
      savedProfile = profile;
      return profile;
    },
  };

  await getStepById("name").validate({
    bridge,
    root: formRoot({ name: "Yasmin" }),
    state,
  });

  assert.equal(state.name, "Yasmin");
  assert.deepEqual(savedProfile, {
    about: "Builder",
    goals: ["Ship Leena"],
    persona: "leena",
    voice: "verse",
    name: "Yasmin",
  });
});

test("completion helpers read, set, and reset the onboardingCompleted setting", async () => {
  const settings = new Map();
  const bridge = {
    async getSetting(key, fallback) {
      return settings.has(key) ? settings.get(key) : fallback;
    },
    async setSetting(key, value) {
      settings.set(key, value);
      return value;
    },
  };

  assert.equal(await shouldShowOnboarding(bridge), true);
  assert.equal(await completeOnboarding(bridge), true);
  assert.equal(settings.get(ONBOARDING_SETTING_KEY), true);
  assert.equal(await shouldShowOnboarding(bridge), false);
  assert.equal(await resetOnboarding(bridge), false);
  assert.equal(settings.get(ONBOARDING_SETTING_KEY), false);
  assert.equal(formatHotkey("CommandOrControl+Shift+L"), "Cmd+Shift+L");
  assert.equal(formatHotkey("Control+Alt+Space"), "Ctrl+Option+Space");
});

test("runtime bootstrap mounts onboarding before the main app shell on first launch", () => {
  const mainSource = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  const rendererSource = readFileSync(
    new URL("../src/renderer/renderer.js", import.meta.url),
    "utf8",
  );

  assert.match(mainSource, /shouldLaunchOnboarding\(\) \? \{ onboarding: "1" \} : \{\}/);
  assert.match(
    rendererSource,
    /import \{ mountOnboarding, shouldShowOnboarding \} from "\.\/onboarding\.js"/,
  );
  assert.match(rendererSource, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(rendererSource, /leenaShellElement\.hidden = true/);
  assert.match(rendererSource, /mountOnboarding\(showOnboardingShell\(\)/);

  const runtimeStart = rendererSource.indexOf("function startAppRuntime()");
  const shellInit = rendererSource.indexOf("initShell();");
  const rendererStart = rendererSource.indexOf("async function startRenderer()");
  const onboardingMount = rendererSource.indexOf(
    "mountOnboarding(showOnboardingShell()",
    rendererStart,
  );
  const runtimeCall = rendererSource.indexOf("startAppRuntime();", rendererStart);

  assert.ok(runtimeStart > -1, "renderer must define a guarded app runtime initializer");
  assert.ok(shellInit > runtimeStart, "normal shell initialization must be inside app runtime");
  assert.ok(onboardingMount > rendererStart, "renderer must mount onboarding in startup path");
  assert.ok(runtimeCall > onboardingMount, "normal runtime must start only after onboarding path");
});
