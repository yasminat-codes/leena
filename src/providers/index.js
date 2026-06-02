import { ProviderError } from "../utils/errors.js";
import { BaseProvider } from "./base-provider.js";
import { createOllamaProvider } from "./ollama-provider.js";
import { createOpenAIProvider } from "./openai-provider.js";
import { createOpenRouterProvider } from "./openrouter-provider.js";
import { loadProviderDefault, saveProviderDefault } from "./provider-settings.js";

let registry = null;

export class ProviderRegistry {
  constructor({ storePath } = {}) {
    this.providers = new Map();
    this.storePath = storePath;
  }

  register(provider) {
    if (!(provider instanceof BaseProvider)) {
      throw new ProviderError("Provider must extend BaseProvider", { code: "INVALID_PROVIDER" });
    }
    if (typeof provider.name !== "string" || !provider.name.trim()) {
      throw new ProviderError("Provider name is required", { code: "INVALID_PROVIDER" });
    }
    this.providers.set(provider.name, provider);
    return provider;
  }

  get(name) {
    const providerName = normalizeProviderName(name);
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new ProviderError(`Provider not found: ${providerName}`, {
        code: "PROVIDER_NOT_FOUND",
        provider: providerName,
      });
    }
    return provider;
  }

  list() {
    return Array.from(this.providers.values()).map((provider) => ({
      name: provider.name,
      displayName: provider.displayName,
      capabilities: { ...provider.capabilities },
    }));
  }

  getForCapability(capability) {
    return Array.from(this.providers.values()).filter((provider) =>
      providerCanProvide(provider, capability),
    );
  }

  getDefault(capability) {
    const savedProviderName = loadProviderDefault(capability, this.storePath);
    if (savedProviderName) {
      const savedProvider = this.providers.get(savedProviderName);
      if (savedProvider && providerCanProvide(savedProvider, capability)) {
        return savedProvider;
      }
    }
    return this.getForCapability(capability)[0] ?? null;
  }

  setDefault(capability, providerName) {
    const provider = this.get(providerName);
    if (!providerCanProvide(provider, capability)) {
      throw new ProviderError(`${provider.displayName} does not support ${capability}`, {
        code: "CAPABILITY_NOT_SUPPORTED",
        provider: provider.name,
      });
    }
    saveProviderDefault(capability, provider.name, this.storePath);
    return provider;
  }
}

export function getRegistry() {
  if (!registry) {
    registry = registerDefaultProviders(new ProviderRegistry());
  }
  return registry;
}

export function registerDefaultProviders(targetRegistry, config = {}) {
  if (!(targetRegistry instanceof ProviderRegistry)) {
    throw new ProviderError("Provider registry is required", { code: "INVALID_PROVIDER_REGISTRY" });
  }
  const providerFactories = [
    () => createOpenAIProvider(config.openai),
    () => createOpenRouterProvider(config.openrouter),
    () => createOllamaProvider(config.ollama),
  ];
  for (const createProvider of providerFactories) {
    const provider = createProvider();
    if (!targetRegistry.providers.has(provider.name)) {
      targetRegistry.register(provider);
    }
  }
  return targetRegistry;
}

function providerCanProvide(provider, capability) {
  return typeof provider.canProvide === "function"
    ? provider.canProvide(capability)
    : provider.supports(capability);
}

function normalizeProviderName(name) {
  return typeof name === "string" ? name.trim() : "";
}
