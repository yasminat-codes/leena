import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createChatIpcHandlers } from "../src/ipc/chat-handlers.js";
import { ProviderRegistry, registerDefaultProviders } from "../src/providers/index.js";
import { CHAT } from "../src/providers/types.js";
import { closeDatabase } from "../src/realtime/tools/database.js";

const OPENAI_KEY = "sk-e2e-provider-switching-openai";
const OPENROUTER_KEY = "or-e2e-provider-switching-openrouter";

test("chat IPC routes to the newly selected default chat provider", async () => {
  await withProviderDb(async (storePath) => {
    const openAiFetch = createChatFetch("gpt-4o-mini", "OpenAI handled this.");
    const openRouterFetch = createChatFetch("openrouter/auto", "OpenRouter handled this.");
    const registry = registerDefaultProviders(new ProviderRegistry({ storePath }), {
      openai: {
        apiKey: OPENAI_KEY,
        fetchImpl: openAiFetch,
        retryOptions: testRetryOptions(),
      },
      openrouter: {
        apiKey: OPENROUTER_KEY,
        fetch: openRouterFetch,
        retryOptions: testRetryOptions(),
      },
    });
    const chunks = [];
    const handlers = createChatIpcHandlers({
      registry,
      chunkSender: (payload) => chunks.push(payload),
      createId: (prefix) => `${prefix}-e2e`,
      getToolDefinitions: () => [],
      now: () => 123,
    });

    registry.setDefault(CHAT, "openai");
    const openAiResult = await handlers.send(null, {
      message: "Which chat provider is active?",
      tools: false,
    });

    registry.setDefault(CHAT, "openrouter");
    const openRouterResult = await handlers.send(null, {
      message: "Which chat provider is active?",
      tools: false,
    });

    assert.equal(openAiResult.ok, true);
    assert.equal(openAiResult.provider, "openai");
    assert.equal(openAiResult.content, "OpenAI handled this.");
    assert.equal(openRouterResult.ok, true);
    assert.equal(openRouterResult.provider, "openrouter");
    assert.equal(openRouterResult.content, "OpenRouter handled this.");

    assert.equal(openAiFetch.calls.length, 1);
    assert.equal(openRouterFetch.calls.length, 1);
    assert.equal(openAiFetch.calls[0].url, "https://api.openai.com/v1/chat/completions");
    assert.equal(openRouterFetch.calls[0].url, "https://openrouter.ai/api/v1/chat/completions");
    assert.equal(
      openAiFetch.calls[0].body.messages.at(-1).content,
      "Which chat provider is active?",
    );
    assert.equal(
      openRouterFetch.calls[0].body.messages.at(-1).content,
      "Which chat provider is active?",
    );
    assert.deepEqual(
      chunks.filter((chunk) => chunk.type === "start").map((chunk) => chunk.provider),
      ["openai", "openrouter"],
    );
  });
});

async function withProviderDb(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "leena-e2e-provider-"));
  const storePath = path.join(directory, "lena.db");
  try {
    await callback(storePath);
  } finally {
    closeDatabase(storePath);
    await rm(directory, { force: true, recursive: true });
  }
}

function createChatFetch(model, content) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({
      url: String(url),
      body: parseBody(init.body),
      headers: init.headers,
      method: init.method,
    });
    return sseResponse([
      {
        model,
        choices: [
          {
            delta: { content },
            finish_reason: "stop",
          },
        ],
      },
      "[DONE]",
    ]);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function parseBody(body) {
  assert.equal(typeof body, "string");
  return JSON.parse(body);
}

function sseResponse(events) {
  const text = events
    .map((event) => `data: ${typeof event === "string" ? event : JSON.stringify(event)}`)
    .join("\n\n");
  return new Response(`${text}\n\n`, {
    headers: { "content-type": "text/event-stream" },
  });
}

function testRetryOptions() {
  return { maxAttempts: 1, baseDelay: 0, maxDelay: 0, jitter: false };
}
