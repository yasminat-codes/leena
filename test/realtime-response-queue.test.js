import assert from "node:assert/strict";
import test from "node:test";
import {
  createRealtimeResponseCoordinator,
  isActiveResponseConflictError,
} from "../src/renderer/realtime-response-queue.js";

const createEvent = (id) => ({ type: "response.create", id });

test("first create is allowed and marks a response active", () => {
  const coordinator = createRealtimeResponseCoordinator();
  const event = createEvent("welcome");
  assert.equal(coordinator.requestCreate(event), event);
  assert.deepEqual(coordinator.state, { activeResponse: true, hasPending: false });
});

test("a create while active is queued, not sent", () => {
  const coordinator = createRealtimeResponseCoordinator();
  coordinator.requestCreate(createEvent("first"));
  const queued = createEvent("tool-output");
  assert.equal(coordinator.requestCreate(queued), null);
  assert.deepEqual(coordinator.state, { activeResponse: true, hasPending: true });
});

test("response.done flushes the queued create and reactivates", () => {
  const coordinator = createRealtimeResponseCoordinator();
  coordinator.requestCreate(createEvent("first"));
  const queued = createEvent("tool-output");
  coordinator.requestCreate(queued);

  const flushed = coordinator.observe({ type: "response.done" });
  assert.equal(flushed, queued);
  assert.deepEqual(coordinator.state, { activeResponse: false, hasPending: false });

  // Re-sending the flushed create marks a response active again.
  assert.equal(coordinator.requestCreate(flushed), flushed);
  assert.deepEqual(coordinator.state, { activeResponse: true, hasPending: false });
});

test("response.done with nothing queued returns null", () => {
  const coordinator = createRealtimeResponseCoordinator();
  coordinator.requestCreate(createEvent("first"));
  assert.equal(coordinator.observe({ type: "response.done" }), null);
});

test("server-initiated response.created blocks the next create until done", () => {
  const coordinator = createRealtimeResponseCoordinator();
  // Semantic VAD auto-created a response we did not request.
  coordinator.observe({ type: "response.created" });
  const queued = createEvent("tool-output");
  assert.equal(coordinator.requestCreate(queued), null);
  assert.equal(coordinator.observe({ type: "response.done" }), queued);
});

test("an active-response conflict re-queues the last sent create", () => {
  const coordinator = createRealtimeResponseCoordinator();
  const sent = createEvent("raced");
  coordinator.requestCreate(sent);
  coordinator.noteActiveResponseConflict();
  assert.deepEqual(coordinator.state, { activeResponse: true, hasPending: true });
  assert.equal(coordinator.observe({ type: "response.done" }), sent);
});

test("reset clears active and pending state", () => {
  const coordinator = createRealtimeResponseCoordinator();
  coordinator.requestCreate(createEvent("first"));
  coordinator.requestCreate(createEvent("queued"));
  coordinator.reset();
  assert.deepEqual(coordinator.state, { activeResponse: false, hasPending: false });
});

test("isActiveResponseConflictError matches the OpenAI conflict code and message", () => {
  assert.equal(
    isActiveResponseConflictError({ code: "conversation_already_has_active_response" }),
    true,
  );
  assert.equal(
    isActiveResponseConflictError({
      message: "Conversation already has an active response in progress: resp_x.",
    }),
    true,
  );
  assert.equal(isActiveResponseConflictError({ code: "response_cancel_not_active" }), false);
  assert.equal(isActiveResponseConflictError(undefined), false);
});
