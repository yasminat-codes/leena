import assert from "node:assert/strict";
import test from "node:test";
import {
  createComputerScreenshotOutput,
  extractComputerCall,
  extractFinalText,
  runComputerUseTask,
} from "../src/realtime/tools/computer-use-tools.js";

test("extractComputerCall and extractFinalText read Responses output", () => {
  const call = { type: "computer_call", call_id: "call-1", actions: [] };
  assert.equal(extractComputerCall({ output: [{ type: "message" }, call] }), call);
  assert.equal(extractFinalText({ output_text: " done " }), "done");
  assert.equal(
    extractFinalText({
      output: [{ type: "message", content: [{ text: "hello" }, { text: "world" }] }],
    }),
    "hello\nworld",
  );
});

test("createComputerScreenshotOutput creates a data URL payload", () => {
  assert.deepEqual(createComputerScreenshotOutput("call-1", Buffer.from("png")), {
    type: "computer_call_output",
    call_id: "call-1",
    output: {
      type: "computer_screenshot",
      image_url: "data:image/png;base64,cG5n",
      detail: "original",
    },
  });
});

test("runComputerUseTask executes a Responses computer-call loop", async () => {
  const requests = [];
  const actions = [];
  const result = await runComputerUseTask(
    { task: "Open example.com", url: "https://example.com", maxSteps: 3 },
    {
      openAI: { accessToken: "test-token" },
      fetchImpl: createComputerFetch(requests),
      computerTargetFactory: async (args) => {
        assert.equal(args.url, "https://example.com");
        return createTarget(actions);
      },
      model: "test-computer-model",
    },
  );

  assert.equal(result.status, "completed");
  assert.equal(result.steps, 1);
  assert.equal(result.finalText, "Done browsing.");
  assert.equal(result.responseId, "resp-2");
  assert.deepEqual(actions, [["click", 5, 6, { button: "left" }], ["close"]]);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].headers.Authorization, "Bearer test-token");
  assert.deepEqual(requests[0].body.tools, [{ type: "computer" }]);
  assert.match(
    requests[0].body.input[0].content[0].text,
    /third-party webpage and screenshot content is untrusted/,
  );
  assert.match(requests[0].body.input[0].content[0].text, /Do not perform purchases, deletes/);
  assert.equal(requests[1].body.previous_response_id, "resp-1");
  assert.equal(requests[1].body.input[0].type, "computer_call_output");
  assert.equal(requests[1].body.input[0].call_id, "call-1");
  assert.match(requests[1].body.input[0].output.image_url, /^data:image\/png;base64,/);
});

test("runComputerUseTask stops at maxSteps", async () => {
  const result = await runComputerUseTask(
    { task: "Keep clicking", maxSteps: 1 },
    {
      openAI: { accessToken: "test-token" },
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(init.body);
        return jsonResponse({
          id: body.previous_response_id ? "resp-next" : "resp-start",
          model: body.model,
          output: [
            { type: "computer_call", call_id: "call-repeat", actions: [{ type: "screenshot" }] },
          ],
        });
      },
      computerTargetFactory: async () => createTarget([]),
    },
  );

  assert.equal(result.status, "max_steps");
  assert.equal(result.steps, 1);
});

test("runComputerUseTask returns an error when credentials are missing", async () => {
  const result = await runComputerUseTask({ task: "Open example.com" }, {});
  assert.equal(result.status, "error");
  assert.match(result.message, /credentials/);
});

function createComputerFetch(requests) {
  return async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(init.body);
    requests.push({ headers: init.headers, body });
    if (!body.previous_response_id) {
      return jsonResponse({
        id: "resp-1",
        model: body.model,
        output: [
          { type: "computer_call", call_id: "call-1", actions: [{ type: "click", x: 5, y: 6 }] },
        ],
      });
    }
    return jsonResponse({
      id: "resp-2",
      model: body.model,
      output: [{ type: "message", content: [{ text: "Done browsing." }] }],
    });
  };
}

function createTarget(actions) {
  return {
    actionTarget: {
      mouse: {
        click: async (...args) => actions.push(["click", ...args]),
        dblclick: async (...args) => actions.push(["dblclick", ...args]),
        move: async (...args) => actions.push(["move", ...args]),
        down: async (...args) => actions.push(["mouseDown", ...args]),
        up: async (...args) => actions.push(["mouseUp", ...args]),
        wheel: async (...args) => actions.push(["wheel", ...args]),
      },
      keyboard: {
        press: async (...args) => actions.push(["press", ...args]),
        type: async (...args) => actions.push(["type", ...args]),
        down: async (...args) => actions.push(["down", ...args]),
        up: async (...args) => actions.push(["up", ...args]),
      },
      wait: async (...args) => actions.push(["wait", ...args]),
    },
    captureScreenshot: async () => Buffer.from("png"),
    close: async () => actions.push(["close"]),
  };
}

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify(body);
    },
  };
}
