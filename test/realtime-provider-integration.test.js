import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { BaseProvider } from "../src/providers/base-provider.js";
import { ProviderRegistry } from "../src/providers/index.js";
import { createOpenAIProvider } from "../src/providers/openai-provider.js";
import { CHAT, REALTIME } from "../src/providers/types.js";
import { closeDatabase } from "../src/realtime/tools/database.js";

const apiKey = "sk-test-realtime-provider-1234567890";

const noRealtimeProviderResponse = Object.freeze({
  error: "NO_REALTIME_PROVIDER",
  message: "Configure an OpenAI API key to use voice mode",
});

test("realtime provider session uses registry default and provider-sourced defaults", async () => {
  await withProviderDb(async (storePath) => {
    const fetchImpl = createMockFetch([
      jsonResponse({ value: "rt-provider-secret", expires_at: 1_800_000_001 }),
    ]);
    const registry = new ProviderRegistry({ storePath });
    const provider = createOpenAIProvider({ apiKey, fetchImpl, retryOptions: testRetryOptions() });
    registry.register(provider);

    const session = await createRealtimeSessionFromRegistry(registry, {
      instructions: "Use the registry-backed realtime provider.",
      voice: "verse",
      tools: [{ type: "function", name: "registry_tool", parameters: { type: "object" } }],
    });

    assert.deepEqual(session, {
      value: "rt-provider-secret",
      expiresAt: 1_800_000_001_000,
      raw: { value: "rt-provider-secret", expires_at: 1_800_000_001 },
    });
    assert.equal(fetchImpl.calls.length, 1);

    const call = fetchImpl.calls[0];
    assert.equal(call.url, "https://api.openai.com/v1/realtime/client_secrets");
    assert.equal(call.init.headers.Authorization, `Bearer ${apiKey}`);

    const body = parseJsonBody(call);
    assert.equal(body.session.model, "gpt-realtime-2");
    assert.equal(body.session.audio.output.voice, "verse");
    assert.equal(body.session.instructions, "Use the registry-backed realtime provider.");
    assert.deepEqual(body.session.tools, [
      { type: "function", name: "registry_tool", parameters: { type: "object" } },
    ]);
  });
});

test("realtime provider session honors explicit model override", async () => {
  await withProviderDb(async (storePath) => {
    const fetchImpl = createMockFetch([
      jsonResponse({ value: "rt-model-override", expires_at: 1_800_000_002 }),
    ]);
    const registry = new ProviderRegistry({ storePath });
    registry.register(
      createOpenAIProvider({ apiKey, fetchImpl, retryOptions: testRetryOptions() }),
    );

    const session = await createRealtimeSessionFromRegistry(registry, {
      model: "gpt-realtime-preview",
      instructions: "Use the explicit model.",
    });

    assert.equal(session.value, "rt-model-override");
    assert.equal(parseJsonBody(fetchImpl.calls[0]).session.model, "gpt-realtime-preview");
  });
});

test("deprecated OpenAI realtime alias can share the same provider session handler", async () => {
  await withProviderDb(async (storePath) => {
    const fetchImpl = createMockFetch([
      jsonResponse({ value: "rt-new-channel", expires_at: 1_800_000_003 }),
      jsonResponse({ value: "rt-deprecated-alias", expires_at: 1_800_000_004 }),
    ]);
    const registry = new ProviderRegistry({ storePath });
    registry.register(
      createOpenAIProvider({ apiKey, fetchImpl, retryOptions: testRetryOptions() }),
    );
    const handlers = createRealtimeIpcHarness(registry);

    const newChannel = await handlers.invoke("realtime:create-session", {
      instructions: "Use the new realtime channel.",
    });
    const alias = await handlers.invoke("openai:create-realtime-secret", {
      instructions: "Use the deprecated alias.",
    });

    assert.equal(newChannel.value, "rt-new-channel");
    assert.equal(alias.value, "rt-deprecated-alias");
    assert.equal(fetchImpl.calls.length, 2);
    assert.equal(
      parseJsonBody(fetchImpl.calls[0]).session.instructions,
      "Use the new realtime channel.",
    );
    assert.equal(
      parseJsonBody(fetchImpl.calls[1]).session.instructions,
      "Use the deprecated alias.",
    );
  });
});

test("missing realtime provider returns the structured no-provider response", async () => {
  await withProviderDb(async (storePath) => {
    const registry = new ProviderRegistry({ storePath });
    registry.register(
      new BaseProvider({
        name: "chat-only",
        displayName: "Chat Only",
        capabilities: { [CHAT]: true, [REALTIME]: false },
        models: { [CHAT]: ["chat-only-model"] },
      }),
    );

    assert.deepEqual(await createRealtimeSessionFromRegistry(registry), noRealtimeProviderResponse);
  });
});

async function withProviderDb(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "leena-realtime-provider-"));
  const storePath = path.join(directory, "lena.db");
  try {
    await callback(storePath);
  } finally {
    closeDatabase(storePath);
    await rm(directory, { force: true, recursive: true });
  }
}

function createRealtimeIpcHarness(registry) {
  const createSession = (options) => createRealtimeSessionFromRegistry(registry, options);
  return {
    invoke(channel, options) {
      if (channel !== "realtime:create-session" && channel !== "openai:create-realtime-secret") {
        throw new Error(`Unhandled IPC channel: ${channel}`);
      }
      return createSession(options);
    },
  };
}

function createRealtimeSessionFromRegistry(registry, options = {}) {
  const provider = registry.getDefault(REALTIME);
  if (!provider || typeof provider.createRealtimeSession !== "function") {
    return noRealtimeProvider();
  }

  const model =
    typeof options.model === "string"
      ? options.model
      : (provider.getDefaultModel?.(REALTIME) ?? provider.models?.[REALTIME]?.[0]);

  return provider.createRealtimeSession({ ...options, model });
}

function noRealtimeProvider() {
  return { ...noRealtimeProviderResponse };
}

function createMockFetch(responses) {
  const queue = [...responses];
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const response = queue.shift();
    assert.ok(response, `Unexpected fetch call to ${url}`);
    return response;
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function parseJsonBody(call) {
  return JSON.parse(call.init.body);
}

function testRetryOptions(overrides = {}) {
  return { maxAttempts: 1, baseDelay: 0, maxDelay: 0, jitter: false, ...overrides };
}
