import { getRegistry } from "../providers/index.js";
import { createOllamaProvider } from "../providers/ollama-provider.js";
import { createOpenAIProvider } from "../providers/openai-provider.js";
import { createOpenRouterProvider } from "../providers/openrouter-provider.js";
import {
  loadOllamaBaseUrl,
  loadProviderApiKey,
  saveOllamaBaseUrl,
  saveProviderApiKey,
} from "../providers/provider-settings.js";
import { CHAT, EMBEDDINGS, PROVIDER_CAPABILITIES, STT, TTS } from "../providers/types.js";
import { getSetting, setSetting } from "../settings-store.js";
import { ProviderError, serializeError } from "../utils/errors.js";

export const PROVIDER_IPC_CHANNELS = Object.freeze({
  list: "providers:list",
  getConfig: "providers:get-config",
  setConfig: "providers:set-config",
  testConnection: "providers:test-connection",
  getModels: "providers:get-models",
  pullOllamaModel: "ollama:pull-model",
});

const REDACTED_API_KEY_PREFIX = "[REDACTED]";
const PROVIDERS_WITH_API_KEYS = new Set(["openai", "openrouter"]);
const DEFAULT_TEST_TIMEOUT_MS = 10_000;
const MODEL_SELECTION_CAPABILITIES = Object.freeze([CHAT, EMBEDDINGS, TTS, STT]);
const PROVIDER_FACTORIES = Object.freeze({
  openai: createOpenAIProvider,
  openrouter: createOpenRouterProvider,
  ollama: createOllamaProvider,
});

export function registerProviderHandlers(ipcMain, options = {}) {
  if (typeof ipcMain?.handle !== "function") {
    throw new TypeError("ipcMain.handle is required to register provider handlers.");
  }
  const handlers = createProviderIpcHandlers(options);
  ipcMain.handle(PROVIDER_IPC_CHANNELS.list, handlers.listProviders);
  ipcMain.handle(PROVIDER_IPC_CHANNELS.getConfig, handlers.getConfig);
  ipcMain.handle(PROVIDER_IPC_CHANNELS.setConfig, handlers.setConfig);
  ipcMain.handle(PROVIDER_IPC_CHANNELS.testConnection, handlers.testConnection);
  ipcMain.handle(PROVIDER_IPC_CHANNELS.getModels, handlers.getModels);
  ipcMain.handle(PROVIDER_IPC_CHANNELS.pullOllamaModel, handlers.pullOllamaModel);
  return handlers;
}

export function createProviderIpcHandlers(options = {}) {
  const deps = normalizeDependencies(options);

  return {
    listProviders: wrapIpcHandler(() => listProviders(deps)),
    getConfig: wrapIpcHandler((_event, providerIdOrPayload) =>
      getProviderConfig(providerIdOrPayload, deps),
    ),
    setConfig: wrapIpcHandler((_event, providerIdOrPayload, config) =>
      setProviderConfig(providerIdOrPayload, config, deps),
    ),
    testConnection: wrapIpcHandler((_event, providerIdOrPayload) =>
      testProviderConnection(providerIdOrPayload, deps),
    ),
    getModels: wrapIpcHandler((_event, providerIdOrPayload, capability) =>
      getProviderModels(providerIdOrPayload, capability, deps),
    ),
    pullOllamaModel: wrapIpcHandler((event, payload) => pullOllamaModel(event, payload, deps)),
  };
}

export function createSafeStorageSecretCodec(safeStorage) {
  return {
    protect(secret) {
      assertSafeStorageAvailable(safeStorage);
      return safeStorage.encryptString(String(secret)).toString("base64");
    },
    reveal(payload) {
      assertSafeStorageAvailable(safeStorage);
      return safeStorage.decryptString(Buffer.from(String(payload), "base64"));
    },
  };
}

export function serializeProviderIpcError(error) {
  const providerError =
    error instanceof ProviderError
      ? error
      : new ProviderError(error instanceof Error ? error.message : String(error), {
          code: "PROVIDER_IPC_ERROR",
          cause: error,
        });
  return serializeError(providerError, { includeStack: false, redactSecrets: true });
}

export function redactProviderApiKey(apiKey) {
  const normalized = normalizeString(apiKey);
  return normalized ? `${REDACTED_API_KEY_PREFIX}${normalized.slice(-4)}` : null;
}

export function isRedactedProviderApiKey(apiKey) {
  return normalizeString(apiKey).startsWith(REDACTED_API_KEY_PREFIX);
}

export function getProviderDefaultModelSettingKey(providerName, capability) {
  return `provider:${normalizeProviderName(providerName)}:defaultModel:${normalizeCapability(
    capability,
  )}`;
}

function normalizeDependencies(options) {
  return {
    registry: options.registry ?? getRegistry(),
    storePath: options.storePath,
    secretCodec: options.secretCodec,
    settingsStore: options.settingsStore ?? { getSetting, setSetting },
    connectionStatuses: options.connectionStatuses ?? new Map(),
    now: typeof options.now === "function" ? options.now : Date.now,
    timeoutMs:
      Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
        ? options.timeoutMs
        : DEFAULT_TEST_TIMEOUT_MS,
    reconfigureProvider:
      typeof options.reconfigureProvider === "function"
        ? options.reconfigureProvider
        : defaultReconfigureProvider,
    progressSender: options.progressSender,
  };
}

function wrapIpcHandler(handler) {
  return async (event, ...args) => {
    try {
      return await handler(event, ...args);
    } catch (error) {
      return {
        ok: false,
        error: serializeProviderIpcError(error),
      };
    }
  };
}

function listProviders(deps) {
  return deps.registry.list().map((summary) => {
    const provider = deps.registry.get(summary.name);
    const connectionStatus = deps.connectionStatuses.get(provider.name);
    return {
      id: provider.name,
      name: provider.displayName ?? summary.displayName ?? provider.name,
      capabilities: { ...provider.capabilities },
      configured: isProviderConfigured(provider, deps),
      connected: connectionStatus?.ok === true,
    };
  });
}

function getProviderConfig(providerIdOrPayload, deps) {
  const provider = getProviderFromRegistry(deps.registry, extractProviderId(providerIdOrPayload));
  return {
    apiKey: redactProviderApiKey(readProviderApiKey(provider, deps)),
    baseUrl: readProviderBaseUrl(provider, deps),
    defaultModels: readProviderDefaultModels(provider, deps),
  };
}

function setProviderConfig(providerIdOrPayload, config, deps) {
  const { providerId, config: normalizedConfig } = parseProviderConfigArgs(
    providerIdOrPayload,
    config,
  );
  const provider = getProviderFromRegistry(deps.registry, providerId);

  if (
    Object.hasOwn(normalizedConfig, "apiKey") &&
    !isRedactedProviderApiKey(normalizedConfig.apiKey)
  ) {
    saveProviderApiKey(
      provider.name,
      normalizeNullableString(normalizedConfig.apiKey),
      deps.storePath,
      deps.secretCodec,
    );
  }
  if (Object.hasOwn(normalizedConfig, "baseUrl")) {
    saveProviderBaseUrl(provider.name, normalizedConfig.baseUrl, deps);
  }
  if (isRecord(normalizedConfig.defaultModels)) {
    saveProviderDefaultModels(provider.name, normalizedConfig.defaultModels, deps);
  }

  const runtimeConfig = buildProviderRuntimeConfig(provider, deps);
  const nextProvider = deps.reconfigureProvider(provider.name, runtimeConfig, {
    registry: deps.registry,
    previousProvider: provider,
  });

  return {
    ok: true,
    provider: nextProvider?.name ?? provider.name,
    configured: isProviderConfigured(nextProvider ?? provider, deps),
  };
}

async function testProviderConnection(providerIdOrPayload, deps) {
  const provider = getProviderFromRegistry(deps.registry, extractProviderId(providerIdOrPayload));
  const startedAt = deps.now();
  try {
    const result = await runWithTimeout(
      (signal) => runProviderConnectionTest(provider, signal),
      deps.timeoutMs,
      provider.name,
    );
    const response = normalizeConnectionResult(result, provider.name, deps.now() - startedAt);
    deps.connectionStatuses.set(provider.name, {
      ok: response.ok,
      testedAt: new Date().toISOString(),
    });
    return response;
  } catch (error) {
    const response = {
      ok: false,
      latencyMs: Math.max(0, deps.now() - startedAt),
      error: serializeProviderIpcError(error),
    };
    deps.connectionStatuses.set(provider.name, { ok: false, testedAt: new Date().toISOString() });
    return response;
  }
}

async function getProviderModels(providerIdOrPayload, capabilityOrPayload, deps) {
  const { providerId, capability } = parseModelsArgs(providerIdOrPayload, capabilityOrPayload);
  const provider = getProviderFromRegistry(deps.registry, providerId);
  const normalizedCapability = normalizeCapability(capability);
  const rawModels = await readProviderModels(provider, normalizedCapability);
  return rawModels
    .map((model) => normalizeProviderModel(model, provider, normalizedCapability))
    .filter((model) => model.capabilities[normalizedCapability] === true);
}

async function pullOllamaModel(event, payload, deps) {
  const model = extractModelName(payload);
  if (!model) {
    throw new ProviderError("Ollama model name is required.", {
      code: "MODEL_MISSING",
      provider: "ollama",
    });
  }
  const provider = getProviderFromRegistry(deps.registry, "ollama");
  if (typeof provider.pullModel !== "function") {
    throw new ProviderError("Ollama provider does not support model pulls.", {
      code: "PROVIDER_PULL_UNSUPPORTED",
      provider: "ollama",
      model,
    });
  }
  const result = await provider.pullModel(model, (progress) => {
    sendOllamaPullProgress(event, model, progress, deps);
  });
  return { ok: true, ...(isRecord(result) ? result : {}), model };
}

function parseProviderConfigArgs(providerIdOrPayload, config) {
  if (typeof providerIdOrPayload === "string") {
    return {
      providerId: providerIdOrPayload,
      config: isRecord(config) ? config : {},
    };
  }
  if (isRecord(providerIdOrPayload)) {
    return {
      providerId: extractProviderId(providerIdOrPayload),
      config: isRecord(providerIdOrPayload.config)
        ? providerIdOrPayload.config
        : providerIdOrPayload,
    };
  }
  return { providerId: "", config: {} };
}

function parseModelsArgs(providerIdOrPayload, capabilityOrPayload) {
  if (typeof providerIdOrPayload === "string") {
    return {
      providerId: providerIdOrPayload,
      capability: capabilityOrPayload,
    };
  }
  if (isRecord(providerIdOrPayload)) {
    return {
      providerId: extractProviderId(providerIdOrPayload),
      capability: providerIdOrPayload.capability,
    };
  }
  return { providerId: "", capability: "" };
}

function extractProviderId(payload) {
  if (typeof payload === "string") {
    return payload;
  }
  if (isRecord(payload)) {
    return payload.providerId ?? payload.provider ?? payload.id ?? "";
  }
  return "";
}

function extractModelName(payload) {
  if (typeof payload === "string") {
    return payload.trim();
  }
  if (isRecord(payload)) {
    return normalizeString(payload.model ?? payload.name);
  }
  return "";
}

function getProviderFromRegistry(registry, providerId) {
  return registry.get(normalizeProviderName(providerId));
}

function isProviderConfigured(provider, deps) {
  if (PROVIDERS_WITH_API_KEYS.has(provider.name)) {
    return Boolean(readProviderApiKey(provider, deps));
  }
  if (provider.name === "ollama") {
    return Boolean(readProviderBaseUrl(provider, deps));
  }
  return true;
}

function readProviderApiKey(provider, deps) {
  if (PROVIDERS_WITH_API_KEYS.has(provider.name)) {
    return (
      loadProviderApiKey(provider.name, deps.storePath, deps.secretCodec) ?? provider.apiKey ?? null
    );
  }
  return typeof provider.apiKey === "string" ? provider.apiKey : null;
}

function readProviderBaseUrl(provider, deps) {
  if (provider.name === "ollama") {
    return loadOllamaBaseUrl(deps.storePath) ?? provider.baseUrl ?? null;
  }
  const saved = readSetting(providerBaseUrlSettingKey(provider.name), null, deps);
  return normalizeNullableString(saved ?? provider.baseUrl);
}

function saveProviderBaseUrl(providerName, baseUrl, deps) {
  const normalized = normalizeNullableString(baseUrl);
  if (normalizeProviderName(providerName) === "ollama") {
    return saveOllamaBaseUrl(normalized, deps.storePath);
  }
  return writeSetting(providerBaseUrlSettingKey(providerName), normalized, deps);
}

function readProviderDefaultModels(provider, deps) {
  return Object.fromEntries(
    MODEL_SELECTION_CAPABILITIES.map((capability) => [
      capability,
      readSetting(
        getProviderDefaultModelSettingKey(provider.name, capability),
        getProviderFallbackModel(provider, capability),
        deps,
      ),
    ]),
  );
}

function saveProviderDefaultModels(providerName, defaultModels, deps) {
  for (const [capability, model] of Object.entries(defaultModels)) {
    const normalizedCapability = normalizeString(capability);
    if (!MODEL_SELECTION_CAPABILITIES.includes(normalizedCapability)) {
      continue;
    }
    writeSetting(
      getProviderDefaultModelSettingKey(providerName, normalizedCapability),
      normalizeNullableString(model),
      deps,
    );
  }
}

function getProviderFallbackModel(provider, capability) {
  if (typeof provider.getDefaultModel === "function") {
    return provider.getDefaultModel(capability);
  }
  const models = provider.models?.[capability];
  return Array.isArray(models) ? (models[0] ?? null) : null;
}

function buildProviderRuntimeConfig(provider, deps) {
  return {
    apiKey: readProviderApiKey(provider, deps) ?? "",
    baseUrl: readProviderBaseUrl(provider, deps) ?? undefined,
    defaultModels: readProviderDefaultModels(provider, deps),
  };
}

function defaultReconfigureProvider(providerName, config, { registry, previousProvider }) {
  const normalizedProviderName = normalizeProviderName(providerName);
  const createProvider = PROVIDER_FACTORIES[normalizedProviderName];
  if (createProvider && registry.providers instanceof Map) {
    const provider = createProvider(config);
    registry.providers.set(provider.name, provider);
    return provider;
  }
  Object.assign(previousProvider, config);
  if (Object.hasOwn(previousProvider, "modelCache")) {
    previousProvider.modelCache = null;
  }
  return previousProvider;
}

async function runProviderConnectionTest(provider, signal) {
  if (typeof provider.testConnection === "function") {
    return provider.testConnection({ signal });
  }
  if (typeof provider.healthCheck === "function") {
    return provider.healthCheck({ signal });
  }
  if (typeof provider.getModels === "function") {
    const models = await provider.getModels({ forceRefresh: true, force: true, signal });
    return { ok: true, modelCount: Array.isArray(models) ? models.length : undefined };
  }
  throw new ProviderError(`${provider.displayName ?? provider.name} cannot test connections.`, {
    code: "PROVIDER_TEST_UNSUPPORTED",
    provider: provider.name,
  });
}

async function runWithTimeout(operation, timeoutMs, providerName) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new ProviderError("Provider connection test timed out.", {
          code: "PROVIDER_TEST_TIMEOUT",
          provider: providerName,
        }),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function normalizeConnectionResult(result, providerName, latencyMs) {
  if (isRecord(result) && result.ok === false) {
    return {
      ok: false,
      latencyMs: Math.max(0, latencyMs),
      error: serializeProviderIpcError(
        new ProviderError(normalizeString(result.error) || "Provider connection test failed.", {
          code: normalizeString(result.code) || "PROVIDER_TEST_FAILED",
          provider: providerName,
        }),
      ),
      modelCount: normalizeModelCount(result),
    };
  }
  return {
    ok: true,
    latencyMs: Math.max(0, latencyMs),
    modelCount: normalizeModelCount(result),
  };
}

function normalizeModelCount(result) {
  if (Array.isArray(result)) {
    return result.length;
  }
  if (Number.isInteger(result?.modelCount)) {
    return result.modelCount;
  }
  if (Array.isArray(result?.models)) {
    return result.models.length;
  }
  return undefined;
}

async function readProviderModels(provider, capability) {
  if (typeof provider.getModels === "function") {
    return provider.getModels({ capability });
  }
  const models = provider.models?.[capability];
  return Array.isArray(models) ? models : [];
}

function normalizeProviderModel(model, provider, requestedCapability) {
  if (typeof model === "string") {
    return {
      id: model,
      name: model,
      model,
      displayName: model,
      capabilities: { [requestedCapability]: provider.canProvide(requestedCapability) },
    };
  }

  const modelId = normalizeString(model?.id ?? model?.model ?? model?.name);
  const name = normalizeString(model?.name ?? model?.displayName ?? modelId);
  return {
    ...model,
    id: modelId,
    name,
    model: normalizeString(model?.model) || modelId,
    displayName: normalizeString(model?.displayName) || name || modelId,
    capabilities: normalizeModelCapabilities(model?.capabilities, requestedCapability),
  };
}

function normalizeModelCapabilities(capabilities, requestedCapability) {
  if (!isRecord(capabilities)) {
    return { [requestedCapability]: true };
  }
  const normalized = {};
  for (const [capability, supported] of Object.entries(capabilities)) {
    const normalizedCapability = normalizeString(capability);
    if (normalizedCapability) {
      normalized[normalizedCapability] = supported === true;
    }
  }
  return normalized;
}

function sendOllamaPullProgress(event, model, progress, deps) {
  const payload = {
    model,
    pct: Number.isFinite(progress?.pct) ? progress.pct : undefined,
    status: typeof progress?.status === "string" ? progress.status : "",
  };
  if (typeof deps.progressSender === "function") {
    deps.progressSender(payload, event);
    return;
  }
  event?.sender?.send?.("ollama:pull-progress", payload);
}

function providerBaseUrlSettingKey(providerName) {
  return `provider:${normalizeProviderName(providerName)}:baseUrl`;
}

function readSetting(key, defaultValue, deps) {
  return deps.settingsStore.getSetting(key, defaultValue, deps.storePath);
}

function writeSetting(key, value, deps) {
  return deps.settingsStore.setSetting(key, value, deps.storePath);
}

function assertSafeStorageAvailable(safeStorage) {
  if (
    !safeStorage ||
    typeof safeStorage.encryptString !== "function" ||
    typeof safeStorage.decryptString !== "function" ||
    safeStorage.isEncryptionAvailable?.() !== true
  ) {
    throw new ProviderError("Secure provider API key storage is unavailable", {
      code: "PROVIDER_API_KEY_STORAGE_UNAVAILABLE",
    });
  }
}

function normalizeProviderName(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeCapability(value) {
  const capability = normalizeString(value);
  if (!PROVIDER_CAPABILITIES.includes(capability)) {
    throw new ProviderError(`Unsupported provider capability: ${capability || "(empty)"}`, {
      code: "PROVIDER_CAPABILITY_UNSUPPORTED",
    });
  }
  return capability;
}

function normalizeNullableString(value) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
