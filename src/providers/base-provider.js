import { ProviderError } from "../utils/errors.js";
import { CHAT, EMBEDDINGS, REALTIME, STT, TTS } from "./types.js";

export class BaseProvider {
  constructor({ name, displayName, capabilities = {}, models = {} } = {}) {
    this.name = name;
    this.displayName = displayName ?? name;
    this.capabilities = { ...capabilities };
    this.models = { ...models };
  }

  supports(capability) {
    return this.capabilities[capability] === true;
  }

  async chat(request = {}) {
    throwNotImplemented(this, CHAT, request.model);
  }

  async embed(request = {}) {
    throwNotImplemented(this, EMBEDDINGS, request.model);
  }

  async speak(_text, options = {}) {
    throwNotImplemented(this, TTS, options.model);
  }

  async transcribe(_audioBuffer, options = {}) {
    throwNotImplemented(this, STT, options.model);
  }

  createRealtimeSession(config = {}) {
    throwNotImplemented(this, REALTIME, config.model);
  }
}

function throwNotImplemented(provider, capability, model) {
  throw new ProviderError(
    `${provider.displayName ?? provider.name ?? "Provider"} does not implement ${capability}`,
    {
      code: "NOT_IMPLEMENTED",
      provider: provider.name,
      model,
    },
  );
}
