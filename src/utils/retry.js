import { RetryExhaustedError } from "./errors.js";

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY = 1000;
const DEFAULT_MAX_DELAY = 30_000;
const DEFAULT_BACKOFF = "exponential";
const DEFAULT_JITTER = true;
const RETRYABLE_NETWORK_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE"]);
const RETRYABLE_HTTP_STATUSES = new Set([429, 500, 502, 503, 504]);
const NON_RETRYABLE_HTTP_STATUSES = new Set([400, 401, 403, 404]);

const DEFAULT_OPTIONS = Object.freeze({
  maxAttempts: DEFAULT_MAX_ATTEMPTS,
  baseDelay: DEFAULT_BASE_DELAY,
  maxDelay: DEFAULT_MAX_DELAY,
  backoff: DEFAULT_BACKOFF,
  jitter: DEFAULT_JITTER,
  signal: null,
});

export async function withRetry(fn, options = {}) {
  if (typeof fn !== "function") {
    throw new TypeError("withRetry expected fn to be a function.");
  }

  const config = normalizeOptions(options);
  let attempts = 0;

  while (attempts < config.maxAttempts) {
    throwIfAborted(config.signal);

    try {
      return await fn();
    } catch (error) {
      attempts += 1;

      if (isAbortError(error)) {
        throw error;
      }

      const retryable = Boolean(await config.retryOn(error));
      if (!retryable) {
        throw new RetryExhaustedError("Retry attempts exhausted", {
          attempts,
          lastError: error,
        });
      }

      if (attempts >= config.maxAttempts) {
        throw new RetryExhaustedError("Retry attempts exhausted", {
          attempts,
          lastError: error,
        });
      }

      await sleep(getDelay(error, attempts - 1, config), config.signal);
    }
  }
}

export const withRetryDefaults = (fn, options = {}) =>
  withRetry(fn, { ...DEFAULT_OPTIONS, ...options });

function normalizeOptions(options) {
  const normalized = isRecord(options) ? options : {};
  return {
    maxAttempts: normalizePositiveInteger(normalized.maxAttempts, DEFAULT_MAX_ATTEMPTS),
    baseDelay: normalizeNonNegativeNumber(normalized.baseDelay, DEFAULT_BASE_DELAY),
    maxDelay: normalizeNonNegativeNumber(normalized.maxDelay, DEFAULT_MAX_DELAY),
    backoff: normalized.backoff === DEFAULT_BACKOFF ? normalized.backoff : DEFAULT_BACKOFF,
    jitter: typeof normalized.jitter === "boolean" ? normalized.jitter : DEFAULT_JITTER,
    retryOn: typeof normalized.retryOn === "function" ? normalized.retryOn : defaultRetryOn,
    signal: normalized.signal ?? null,
  };
}

function defaultRetryOn(error) {
  if (isAbortError(error)) {
    return false;
  }

  const status = getHttpStatus(error);
  if (NON_RETRYABLE_HTTP_STATUSES.has(status)) {
    return false;
  }
  if (RETRYABLE_HTTP_STATUSES.has(status)) {
    return true;
  }

  const code = getErrorCode(error);
  if (RETRYABLE_NETWORK_CODES.has(code)) {
    return true;
  }

  return isFetchNetworkError(error);
}

function getDelay(error, retryIndex, config) {
  const retryAfterDelay = getRetryAfterDelay(error);
  if (retryAfterDelay !== null) {
    return Math.min(retryAfterDelay, config.maxDelay);
  }

  const multiplier = config.backoff === DEFAULT_BACKOFF ? 2 ** retryIndex : 1;
  const delay = Math.min(config.baseDelay * multiplier, config.maxDelay);
  if (!config.jitter || delay === 0) {
    return delay;
  }
  return Math.round(delay * (0.75 + Math.random() * 0.5));
}

function getRetryAfterDelay(error) {
  if (getHttpStatus(error) !== 429) {
    return null;
  }

  const value = getHeader(error, "retry-after");
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return Math.max(0, timestamp - Date.now());
}

function getHttpStatus(error) {
  for (const value of [error?.status, error?.statusCode, error?.response?.status]) {
    if (Number.isInteger(value)) {
      return value;
    }
  }
  return undefined;
}

function getHeader(error, name) {
  const headers = error?.headers ?? error?.response?.headers;
  if (!headers) {
    return undefined;
  }

  if (typeof headers.get === "function") {
    return headers.get(name) ?? headers.get(name.toLowerCase()) ?? headers.get(name.toUpperCase());
  }

  if (isRecord(headers)) {
    const lowerName = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === lowerName) {
        return Array.isArray(value) ? value[0] : value;
      }
    }
  }

  return undefined;
}

function getErrorCode(error) {
  for (const value of [error?.code, error?.cause?.code]) {
    if (typeof value === "string") {
      return value;
    }
  }
  return undefined;
}

function isFetchNetworkError(error) {
  return (
    error instanceof TypeError &&
    /\b(fetch failed|failed to fetch|networkerror|network error|load failed)\b/i.test(error.message)
  );
}

function isAbortError(error) {
  return error?.name === "AbortError" || /\babort(ed)?\b/i.test(error?.message ?? "");
}

function sleep(delay, signal) {
  throwIfAborted(signal);
  if (delay <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      settle(resolve);
    }, delay);

    const onAbort = () => {
      clearTimeout(timeout);
      settle(reject, createAbortError(signal?.reason));
    };

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }

    function settle(callback, value) {
      if (settled) {
        return;
      }
      settled = true;
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
      callback(value);
    }
  });
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw createAbortError(signal.reason);
  }
}

function createAbortError(reason) {
  if (reason instanceof Error && reason.name === "AbortError") {
    return reason;
  }
  if (typeof DOMException === "function") {
    return new DOMException("The operation was aborted.", "AbortError");
  }
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  if (reason !== undefined) {
    error.cause = reason;
  }
  return error;
}

function normalizePositiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function normalizeNonNegativeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
