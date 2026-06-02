import { ProviderError } from "../utils/errors.js";
import { BaseProvider } from "./base-provider.js";
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
    return Array.from(this.providers.values()).filter((provider) => provider.supports(capability));
  }

  getDefault(capability) {
    const savedProviderName = loadProviderDefault(capability, this.storePath);
    if (savedProviderName) {
      const savedProvider = this.providers.get(savedProviderName);
      if (savedProvider?.supports(capability)) {
        return savedProvider;
      }
    }
    return this.getForCapability(capability)[0] ?? null;
  }

  setDefault(capability, providerName) {
    const provider = this.get(providerName);
    if (!provider.supports(capability)) {
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
    registry = new ProviderRegistry();
  }
  return registry;
}

function normalizeProviderName(name) {
  return typeof name === "string" ? name.trim() : "";
}
