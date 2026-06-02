export const CHAT = "chat";
export const EMBEDDINGS = "embeddings";
export const REALTIME = "realtime";
export const TTS = "tts";
export const STT = "stt";

export const PROVIDER_CAPABILITIES = Object.freeze([CHAT, EMBEDDINGS, REALTIME, TTS, STT]);

/**
 * @typedef {typeof CHAT | typeof EMBEDDINGS | typeof REALTIME | typeof TTS | typeof STT} ProviderCapability
 */

/**
 * @typedef {Partial<Record<ProviderCapability, boolean>>} ProviderCapabilities
 */

/**
 * @typedef {{
 *   role: "system" | "user" | "assistant" | "tool";
 *   content: string;
 *   name?: string;
 * }} ChatMessage
 */

/**
 * @typedef {{
 *   messages: ChatMessage[];
 *   model?: string;
 *   temperature?: number;
 *   maxTokens?: number;
 *   signal?: AbortSignal;
 * }} ChatRequest
 */

/**
 * @typedef {{
 *   promptTokens?: number;
 *   completionTokens?: number;
 *   totalTokens?: number;
 * }} ProviderUsage
 */

/**
 * @typedef {{
 *   content: string;
 *   model: string;
 *   usage?: ProviderUsage;
 * }} ChatResponse
 */

/**
 * @typedef {{
 *   input: string | string[];
 *   model?: string;
 * }} EmbeddingRequest
 */

/**
 * @typedef {{
 *   embeddings: number[][];
 *   model: string;
 *   usage?: ProviderUsage;
 * }} EmbeddingResponse
 */
