import assert from "node:assert/strict";
import test from "node:test";
import { RetryExhaustedError } from "../src/utils/errors.js";
import { withRetry, withRetryDefaults } from "../src/utils/retry.js";

test("withRetry returns the first successful result without retrying", async () => {
  let attempts = 0;

  const result = await withRetry(async () => {
    attempts += 1;
    return "ok";
  });

  assert.equal(result, "ok");
  assert.equal(attempts, 1);
});

test("withRetry retries transient failures until the function succeeds", async () => {
  let attempts = 0;

  const result = await withRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) {
        const error = new Error("socket reset");
        error.code = "ECONNRESET";
        throw error;
      }
      return "recovered";
    },
    { baseDelay: 1, jitter: false },
  );

  assert.equal(result, "recovered");
  assert.equal(attempts, 3);
});

test("withRetry throws RetryExhaustedError with attempt fields after retryable failures", async () => {
  let attempts = 0;
  const lastError = new Error("upstream unavailable");
  lastError.status = 503;

  await assert.rejects(
    withRetry(
      async () => {
        attempts += 1;
        throw lastError;
      },
      { maxAttempts: 2, baseDelay: 1, jitter: false },
    ),
    (error) => {
      assert.ok(error instanceof RetryExhaustedError);
      assert.equal(error.code, "RETRY_EXHAUSTED");
      assert.equal(error.attempts, 2);
      assert.equal(error.lastError, lastError);
      assert.equal(error.cause, lastError);
      return true;
    },
  );
  assert.equal(attempts, 2);
});

test("withRetry does not retry non-retryable HTTP statuses", async () => {
  let attempts = 0;
  const unauthorized = new Error("unauthorized");
  unauthorized.status = 401;

  await assert.rejects(
    withRetry(
      async () => {
        attempts += 1;
        throw unauthorized;
      },
      { maxAttempts: 3, baseDelay: 1, jitter: false },
    ),
    unauthorized,
  );
  assert.equal(attempts, 1);
});

test("withRetry aborts immediately when the signal is aborted between retries", async () => {
  const controller = new AbortController();
  let attempts = 0;

  const retryPromise = withRetry(
    async () => {
      attempts += 1;
      const error = new Error("temporary outage");
      error.code = "ETIMEDOUT";
      throw error;
    },
    {
      maxAttempts: 3,
      baseDelay: 100,
      jitter: false,
      signal: controller.signal,
    },
  );

  controller.abort();

  await assert.rejects(retryPromise, { name: "AbortError" });
  assert.equal(attempts, 1);
});

test("withRetry uses exponential timing and honors Retry-After for HTTP 429", async () => {
  let attempts = 0;
  const attemptTimes = [];
  const startedAt = Date.now();

  const result = await withRetry(
    async () => {
      attempts += 1;
      attemptTimes.push(Date.now() - startedAt);

      if (attempts === 1) {
        const error = new Error("rate limited");
        error.status = 429;
        error.headers = { "Retry-After": "0.02" };
        throw error;
      }
      if (attempts === 2) {
        const error = new Error("bad gateway");
        error.status = 502;
        throw error;
      }

      return "ok";
    },
    { baseDelay: 30, maxDelay: 1000, jitter: false },
  );

  assert.equal(result, "ok");
  assert.equal(attempts, 3);
  assert.ok(attemptTimes[1] - attemptTimes[0] >= 15);
  assert.ok(attemptTimes[2] - attemptTimes[1] >= 25);
});

test("withRetryDefaults delegates to withRetry defaults", async () => {
  const result = await withRetryDefaults(async () => "default-ok", { jitter: false });

  assert.equal(result, "default-ok");
});
