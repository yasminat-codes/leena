import assert from "node:assert/strict";
import test from "node:test";
import { BaseProvider } from "../src/providers/base-provider.js";
import { ProviderRegistry, registerDefaultProviders } from "../src/providers/index.js";
import { CHAT, EMBEDDINGS } from "../src/providers/types.js";

test("rapid provider register and unregister cycles keep registry state consistent", () => {
  const registry = new ProviderRegistry();

  for (let index = 0; index < 250; index += 1) {
    const provider = createProvider(`mock-${index}`, {
      [CHAT]: index % 2 === 0,
      [EMBEDDINGS]: index % 3 === 0,
    });
    registry.register(provider);
    assert.equal(registry.get(provider.name), provider);

    const shouldUnregister = index % 4 !== 0;
    if (shouldUnregister) {
      assert.equal(registry.providers.delete(provider.name), true);
      assert.equal(registry.providers.has(provider.name), false);
    }
  }

  const remainingNames = registry.list().map((provider) => provider.name);
  assert.equal(remainingNames.length, 63);
  assert.deepEqual(remainingNames.slice(0, 5), [
    "mock-0",
    "mock-4",
    "mock-8",
    "mock-12",
    "mock-16",
  ]);
  assert.deepEqual(new Set(remainingNames).size, remainingNames.length);
  assert.equal(
    registry.getForCapability(CHAT).every((provider) => provider.supports(CHAT)),
    true,
  );
  assert.equal(
    registry.getForCapability(EMBEDDINGS).every((provider) => provider.supports(EMBEDDINGS)),
    true,
  );
});

test("re-registering the same provider name replaces the prior provider without duplicates", () => {
  const registry = new ProviderRegistry();
  const first = createProvider("switchable", { [CHAT]: true, [EMBEDDINGS]: false });
  const second = createProvider("switchable", { [CHAT]: false, [EMBEDDINGS]: true });

  registry.register(first);
  registry.register(second);

  assert.equal(registry.get("switchable"), second);
  assert.equal(registry.list().length, 1);
  assert.deepEqual(
    registry.getForCapability(CHAT).map((provider) => provider.name),
    [],
  );
  assert.deepEqual(
    registry.getForCapability(EMBEDDINGS).map((provider) => provider.name),
    ["switchable"],
  );
});

test("default provider registration is idempotent under repeated register and delete churn", () => {
  const registry = new ProviderRegistry();

  for (let index = 0; index < 50; index += 1) {
    registerDefaultProviders(registry, {
      openai: { apiKey: "sk-stress-openai-1234567890", fetchImpl: unreachableFetch },
      openrouter: { apiKey: "or-stress-openrouter-1234567890", fetch: unreachableFetch },
      ollama: { fetch: unreachableFetch },
    });
    const providerNames = registry.list().map((provider) => provider.name);
    assert.equal(providerNames.length, 3);
    assert.deepEqual(new Set(providerNames), new Set(["openai", "openrouter", "ollama"]));

    if (index % 2 === 0) {
      assert.equal(registry.providers.delete("openrouter"), true);
      registerDefaultProviders(registry, {
        openai: { apiKey: "sk-stress-openai-1234567890", fetchImpl: unreachableFetch },
        openrouter: { apiKey: "or-stress-openrouter-1234567890", fetch: unreachableFetch },
        ollama: { fetch: unreachableFetch },
      });
    }
  }

  assert.deepEqual(
    registry.list().map((provider) => provider.name),
    ["openai", "ollama", "openrouter"],
  );
  assert.equal(registry.providers.size, 3);
  assert.deepEqual(
    registry.getForCapability(CHAT).map((provider) => provider.name),
    ["openai", "ollama", "openrouter"],
  );
});

test("provider registry churn does not add process-level listeners", () => {
  const processEvents = ["warning", "unhandledRejection", "rejectionHandled"];
  const before = countListeners(processEvents);
  const registry = new ProviderRegistry();

  for (let index = 0; index < 500; index += 1) {
    registry.register(createProvider(`listener-${index}`, { [CHAT]: true }));
    registry.providers.delete(`listener-${index}`);
  }

  assert.deepEqual(countListeners(processEvents), before);
  assert.equal(registry.list().length, 0);
});

function createProvider(name, capabilities = {}) {
  return new BaseProvider({
    name,
    displayName: name,
    capabilities,
    models: {
      [CHAT]: capabilities[CHAT] ? [`${name}-chat`] : [],
      [EMBEDDINGS]: capabilities[EMBEDDINGS] ? [`${name}-embedding`] : [],
    },
  });
}

function countListeners(events) {
  return Object.fromEntries(events.map((event) => [event, process.listenerCount(event)]));
}

async function unreachableFetch(url) {
  throw new Error(`Unexpected network call in provider stress test: ${url}`);
}
