const DEFAULT_CODES = Object.freeze({
  LeenaError: "LEENA_ERROR",
  ProviderError: "PROVIDER_ERROR",
  MCPError: "MCP_ERROR",
  MemoryError: "MEMORY_ERROR",
  WakeError: "WAKE_ERROR",
  RetryExhaustedError: "RETRY_EXHAUSTED",
});

const ERROR_CLASSES = new Map();
const REDACTED = "[redacted]";
const SECRET_KEY =
  /(token|secret|authorization|bearer|password|passwd|api[-_]?key|apikey|client_secret|refresh|access_token|cookie|credential|private[-_]?key)/i;
const SECRET_HEADER_VALUE =
  /\b((?:authorization|proxy-authorization|x[-_]?api[-_]?key|api[-_]?key|apikey|token|secret|cookie|set-cookie|password|passwd|credential|client[-_]?secret|refresh[-_]?token|access[-_]?token)\s*:\s*)[^,;\n\r]+/gi;
const SECRET_VALUE =
  /\b(sk-[A-Za-z0-9_-]{16,}|ek_[A-Za-z0-9]+|eyJ[A-Za-z0-9._-]{20,}|Bearer\s+[A-Za-z0-9._-]+)\b/g;
const EMBEDDED_URL = /\bhttps?:\/\/[^\s<>"'`]+/g;
const URL_TRAILING_PUNCTUATION = /[),.;!?]+$/;

export class LeenaError extends Error {
  constructor(message = "Leena error", options = {}) {
    const normalized = normalizeOptions(options);
    super(message, normalized.cause === undefined ? undefined : { cause: normalized.cause });
    this.name = this.constructor.name;
    this.code = normalized.code ?? DEFAULT_CODES.LeenaError;
    if (normalized.cause !== undefined) {
      this.cause = normalized.cause;
    }
  }

  toJSON() {
    return serializeError(this);
  }
}

export class ProviderError extends LeenaError {
  constructor(message = "Provider error", options = {}) {
    const normalized = normalizeOptions(options);
    super(message, { ...normalized, code: normalized.code ?? DEFAULT_CODES.ProviderError });
    if (normalized.provider !== undefined) {
      this.provider = normalized.provider;
    }
    if (normalized.model !== undefined) {
      this.model = normalized.model;
    }
  }
}

export class MCPError extends LeenaError {
  constructor(message = "MCP error", options = {}) {
    const normalized = normalizeOptions(options);
    super(message, { ...normalized, code: normalized.code ?? DEFAULT_CODES.MCPError });
    if (normalized.serverName !== undefined) {
      this.serverName = normalized.serverName;
    }
    if (normalized.transport !== undefined) {
      this.transport = normalized.transport;
    }
  }
}

export class MemoryError extends LeenaError {
  constructor(message = "Memory error", options = {}) {
    const normalized = normalizeOptions(options);
    super(message, { ...normalized, code: normalized.code ?? DEFAULT_CODES.MemoryError });
  }
}

export class WakeError extends LeenaError {
  constructor(message = "Wake error", options = {}) {
    const normalized = normalizeOptions(options);
    super(message, { ...normalized, code: normalized.code ?? DEFAULT_CODES.WakeError });
  }
}

export class RetryExhaustedError extends LeenaError {
  constructor(message = "Retry attempts exhausted", options = {}) {
    const normalized = normalizeOptions(options);
    const lastError = normalized.lastError;
    super(message, {
      ...normalized,
      code: normalized.code ?? DEFAULT_CODES.RetryExhaustedError,
      cause: normalized.cause ?? lastError,
    });
    if (normalized.attempts !== undefined) {
      this.attempts = normalized.attempts;
    }
    if (lastError !== undefined) {
      this.lastError = lastError;
    }
  }
}

for (const ErrorClass of [
  LeenaError,
  ProviderError,
  MCPError,
  MemoryError,
  WakeError,
  RetryExhaustedError,
]) {
  ERROR_CLASSES.set(ErrorClass.name, ErrorClass);
}

export function serializeError(error, options = {}) {
  return serializeErrorValue(error, new WeakSet(), normalizeSerializeOptions(options));
}

export function deserializeError(value) {
  if (value instanceof LeenaError) {
    return value;
  }
  if (value instanceof Error) {
    return deserializeError(serializeError(value));
  }
  if (!isRecord(value)) {
    return new LeenaError(String(value), { code: DEFAULT_CODES.LeenaError });
  }

  const type = typeof value.name === "string" ? value.name : "LeenaError";
  const ErrorClass = ERROR_CLASSES.get(type) ?? LeenaError;
  const message = typeof value.message === "string" ? value.message : "Leena error";
  const options = buildDeserializeOptions(ErrorClass, value);
  const error = new ErrorClass(message, options);

  if (typeof value.stack === "string") {
    error.stack = value.stack;
  }

  for (const [key, item] of Object.entries(value)) {
    if (isKnownSerializedErrorField(key)) {
      continue;
    }
    error[key] = deserializeValue(item);
  }

  return error;
}

function normalizeOptions(options) {
  return isRecord(options) ? options : {};
}

function serializeErrorValue(error, seen, options) {
  if (!(error instanceof Error)) {
    return {
      name: "LeenaError",
      message: serializeString(String(error), options),
      code: DEFAULT_CODES.LeenaError,
      value: serializeValue(error, seen, options),
    };
  }

  if (seen.has(error)) {
    return {
      name: "LeenaError",
      message: "Circular error reference",
      code: DEFAULT_CODES.LeenaError,
    };
  }
  seen.add(error);

  const payload = {
    name: error.name || error.constructor.name || "Error",
    message: serializeString(error.message, options),
    code: serializeString(
      typeof error.code === "string"
        ? error.code
        : (DEFAULT_CODES[error.name] ?? DEFAULT_CODES.LeenaError),
      options,
    ),
  };

  if (options.includeStack && typeof error.stack === "string") {
    payload.stack = serializeString(error.stack, options);
  }

  for (const [key, value] of Object.entries(error)) {
    if (key === "name" || key === "message" || key === "stack" || key === "cause") {
      continue;
    }
    payload[key] = serializeValue(value, seen, options, key);
  }

  if (error.cause !== undefined) {
    payload.cause = serializeErrorValue(error.cause, seen, options);
  }

  seen.delete(error);
  return payload;
}

function serializeValue(value, seen, options, key) {
  if (options.redactSecrets && typeof key === "string" && SECRET_KEY.test(key)) {
    return REDACTED;
  }
  if (value instanceof Error) {
    return serializeErrorValue(value, seen, options);
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item, seen, options));
  }
  if (isRecord(value)) {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);
    const serialized = {};
    for (const [key, item] of Object.entries(value)) {
      const nextValue = serializeValue(item, seen, options, key);
      if (nextValue !== undefined) {
        serialized[key] = nextValue;
      }
    }
    seen.delete(value);
    return serialized;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "function" || typeof value === "symbol") {
    return undefined;
  }
  if (typeof value === "string") {
    return serializeString(value, options);
  }
  return value;
}

function normalizeSerializeOptions(options) {
  const normalized = normalizeOptions(options);
  return {
    includeStack:
      typeof normalized.includeStack === "boolean" ? normalized.includeStack : shouldIncludeStack(),
    redactSecrets: Boolean(normalized.redactSecrets),
  };
}

function serializeString(value, options) {
  return options.redactSecrets ? redactSensitiveText(value) : value;
}

export function redactSensitiveText(str) {
  return str
    .replace(SECRET_HEADER_VALUE, (_match, prefix) => `${prefix}${REDACTED}`)
    .replace(SECRET_VALUE, REDACTED)
    .replace(EMBEDDED_URL, scrubUrlMatch)
    .slice(0, 500);
}

function scrubUrlMatch(match) {
  const trailing = match.match(URL_TRAILING_PUNCTUATION)?.[0] ?? "";
  const rawUrl = trailing ? match.slice(0, -trailing.length) : match;
  try {
    const url = new URL(rawUrl);
    if ((url.protocol === "http:" || url.protocol === "https:") && (url.search || url.hash)) {
      return `${url.origin}${url.pathname}?[redacted]${trailing}`;
    }
  } catch {
    /* not a URL */
  }
  return match;
}

function deserializeValue(value) {
  if (Array.isArray(value)) {
    return value.map(deserializeValue);
  }
  if (isSerializedError(value)) {
    return deserializeError(value);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, deserializeValue(item)]),
    );
  }
  return value;
}

function buildDeserializeOptions(ErrorClass, value) {
  const options = {
    code: typeof value.code === "string" ? value.code : DEFAULT_CODES[ErrorClass.name],
  };
  if (value.cause !== undefined) {
    options.cause = deserializeValue(value.cause);
  }
  if (ErrorClass === ProviderError) {
    if (value.provider !== undefined) {
      options.provider = value.provider;
    }
    if (value.model !== undefined) {
      options.model = value.model;
    }
  }
  if (ErrorClass === MCPError) {
    if (value.serverName !== undefined) {
      options.serverName = value.serverName;
    }
    if (value.transport !== undefined) {
      options.transport = value.transport;
    }
  }
  if (ErrorClass === RetryExhaustedError) {
    if (value.attempts !== undefined) {
      options.attempts = value.attempts;
    }
    if (value.lastError !== undefined) {
      options.lastError = deserializeValue(value.lastError);
    }
  }
  return options;
}

function shouldIncludeStack() {
  return process.env.NODE_ENV !== "production";
}

function isSerializedError(value) {
  return (
    isRecord(value) &&
    typeof value.message === "string" &&
    typeof value.name === "string" &&
    (typeof value.code === "string" ||
      typeof value.stack === "string" ||
      value.cause !== undefined ||
      ERROR_CLASSES.has(value.name))
  );
}

function isKnownSerializedErrorField(key) {
  return [
    "name",
    "message",
    "code",
    "stack",
    "cause",
    "provider",
    "model",
    "serverName",
    "transport",
    "attempts",
    "lastError",
  ].includes(key);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
