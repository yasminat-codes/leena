import assert from "node:assert/strict";
import test from "node:test";
import {
  deserializeError,
  LeenaError,
  MCPError,
  MemoryError,
  ProviderError,
  RetryExhaustedError,
  redactSensitiveText,
  serializeError,
  WakeError,
} from "../src/utils/errors.js";

const subclassCases = [
  {
    ErrorClass: LeenaError,
    message: "base failed",
    options: { code: "BASE_CUSTOM" },
  },
  {
    ErrorClass: ProviderError,
    message: "provider failed",
    options: { provider: "openai", model: "gpt-realtime-2" },
    fields: { provider: "openai", model: "gpt-realtime-2" },
  },
  {
    ErrorClass: MCPError,
    message: "mcp failed",
    options: { serverName: "calendar", transport: "stdio" },
    fields: { serverName: "calendar", transport: "stdio" },
  },
  {
    ErrorClass: MemoryError,
    message: "memory failed",
    options: {},
  },
  {
    ErrorClass: WakeError,
    message: "wake failed",
    options: {},
  },
  {
    ErrorClass: RetryExhaustedError,
    message: "retry failed",
    options: { attempts: 3, lastError: new ProviderError("last provider failure") },
    fields: { attempts: 3 },
  },
];

test("subclasses expose codes and custom fields", () => {
  const provider = new ProviderError("bad response", {
    code: "OPENAI_500",
    provider: "openai",
    model: "gpt-realtime-2",
  });
  assert.equal(provider.name, "ProviderError");
  assert.equal(provider.code, "OPENAI_500");
  assert.equal(provider.provider, "openai");
  assert.equal(provider.model, "gpt-realtime-2");

  const mcp = new MCPError("server lost", {
    serverName: "mail",
    transport: "websocket",
  });
  assert.equal(mcp.code, "MCP_ERROR");
  assert.equal(mcp.serverName, "mail");
  assert.equal(mcp.transport, "websocket");

  const lastError = new MemoryError("write failed");
  const retry = new RetryExhaustedError("gave up", { attempts: 4, lastError });
  assert.equal(retry.code, "RETRY_EXHAUSTED");
  assert.equal(retry.attempts, 4);
  assert.equal(retry.lastError, lastError);
  assert.equal(retry.cause, lastError);
});

test("serializeError and deserializeError round trip every subclass", () => {
  for (const { ErrorClass, message, options, fields = {} } of subclassCases) {
    const error = new ErrorClass(message, options);
    error.extra = { requestId: "req_123" };

    const serialized = serializeError(error);
    const deserialized = deserializeError(serialized);

    assert.equal(deserialized.constructor, ErrorClass);
    assert.equal(deserialized.name, ErrorClass.name);
    assert.equal(deserialized.message, message);
    assert.equal(deserialized.code, error.code);
    assert.deepEqual(deserialized.extra, { requestId: "req_123" });
    for (const [key, value] of Object.entries(fields)) {
      assert.equal(deserialized[key], value);
    }
  }
});

test("nested cause chains are serialized and reconstructed", () => {
  const root = new Error("socket closed");
  const middle = new MCPError("calendar server failed", {
    serverName: "calendar",
    transport: "stdio",
    cause: root,
  });
  const top = new ProviderError("tool provider failed", {
    provider: "openai",
    model: "gpt-realtime-2",
    cause: middle,
  });

  const roundTripped = deserializeError(serializeError(top));

  assert.ok(roundTripped instanceof ProviderError);
  assert.ok(roundTripped.cause instanceof MCPError);
  assert.equal(roundTripped.cause.serverName, "calendar");
  assert.ok(roundTripped.cause.cause instanceof LeenaError);
  assert.equal(roundTripped.cause.cause.message, "socket closed");
});

test("unknown serialized error types fall back to LeenaError", () => {
  const error = deserializeError({
    name: "FutureSubsystemError",
    message: "future failed",
    code: "FUTURE_FAILED",
    subsystem: "future",
  });

  assert.equal(error.constructor, LeenaError);
  assert.equal(error.name, "LeenaError");
  assert.equal(error.message, "future failed");
  assert.equal(error.code, "FUTURE_FAILED");
  assert.equal(error.subsystem, "future");
});

test("toJSON matches serializeError", () => {
  const error = new WakeError("wake model failed", {
    cause: new Error("model file missing"),
  });

  assert.deepEqual(error.toJSON(), serializeError(error));
});

test("serializeError strips stack in production", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    assert.equal("stack" in serializeError(new MemoryError("db failed")), false);
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});

test("serializeError can produce renderer-safe redacted payloads", () => {
  const cause = new Error("nested failure with Bearer sk-nestedsecret123456789");
  cause.stack = "Error: nested failure\n    at sk-nestedsecret123456789";
  const error = new ProviderError("provider failed with Bearer sk-mainsecret123456789", {
    provider: "openai",
    model: "gpt-realtime-2",
    cause,
  });
  error.stack = "ProviderError: provider failed\n    at sk-mainsecret123456789";
  error.accessToken = "sk-fieldsecret123456789";
  error.details = {
    apiKey: "sk-objectsecret123456789",
    callbackUrl: "https://example.test/callback?code=abc#token",
    headers: ["Authorization: Bearer sk-headersecret123456789"],
  };

  const serialized = serializeError(error, { includeStack: false, redactSecrets: true });

  assert.equal("stack" in serialized, false);
  assert.equal("stack" in serialized.cause, false);
  assert.equal(serialized.message, "provider failed with [redacted]");
  assert.equal(serialized.accessToken, "[redacted]");
  assert.equal(serialized.details.apiKey, "[redacted]");
  assert.equal(serialized.details.callbackUrl, "https://example.test/callback?[redacted]");
  assert.deepEqual(serialized.details.headers, ["Authorization: [redacted]"]);
  assert.equal(serialized.cause.message, "nested failure with [redacted]");
});

test("serializeError redacts embedded callback URLs in renderer-safe payloads", () => {
  const error = new ProviderError(
    "failed callback at https://example.test/callback?code=SECRET#frag.",
  );
  error.details = {
    note: "Retry https://app.example.test/oauth?state=abc and then continue.",
    nested: {
      message: "See https://example.test/path#access_token=SECRET!",
    },
  };

  const serialized = serializeError(error, { includeStack: false, redactSecrets: true });

  assert.equal(serialized.message, "failed callback at https://example.test/callback?[redacted].");
  assert.equal(
    serialized.details.note,
    "Retry https://app.example.test/oauth?[redacted] and then continue.",
  );
  assert.equal(serialized.details.nested.message, "See https://example.test/path?[redacted]!");
});

test("redactSensitiveText covers diagnostic-safe embedded URLs and tokens", () => {
  assert.equal(
    redactSensitiveText(
      "failed callback at https://example.test/callback?code=SECRET#frag with Bearer sk-secret123456789",
    ),
    "failed callback at https://example.test/callback?[redacted] with [redacted]",
  );
  assert.equal(
    redactSensitiveText("plain token sk-secret1234567890 and https://example.test/no-query"),
    "plain token [redacted] and https://example.test/no-query",
  );
});
