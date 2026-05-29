import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { __setHostResolverForTests, executeWebTool } from "../src/realtime/tools/web-tools.js";

beforeEach(() => {
  // Avoid real DNS in tests: resolve every hostname to a public address.
  __setHostResolverForTests(async () => ["93.184.216.34"]);
});

function mockFetch(handler) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

function createResponse({
  body,
  contentType = "text/html",
  ok = true,
  status = 200,
  url = "https://example.com",
}) {
  return {
    ok,
    status,
    url,
    headers: {
      get(name) {
        return name.toLowerCase() === "content-type" ? contentType : null;
      },
    },
    async text() {
      return body;
    },
  };
}

test("web_fetch rejects non-http URLs before network access", async () => {
  const restoreFetch = mockFetch(() => {
    throw new Error("fetch should not be called");
  });
  try {
    assert.deepEqual(await executeWebTool("web_fetch", { url: "file:///etc/passwd" }), {
      status: "invalid_arguments",
      message: "Only http:// and https:// URLs are allowed.",
    });
  } finally {
    restoreFetch();
  }
});

test("web_fetch strips HTML chrome and truncates extracted text", async () => {
  const restoreFetch = mockFetch(async (url) =>
    createResponse({
      url,
      body: `<!doctype html>
        <html>
          <head><title>Example &amp; Test</title><style>.x{}</style></head>
          <body><nav>Skip this</nav><main><h1>Hello &amp; welcome</h1><p>This is useful text.</p></main><script>bad()</script></body>
        </html>`,
    }),
  );
  try {
    const result = await executeWebTool("web_fetch", {
      url: "https://example.com/page",
      maxLength: 500,
    });
    assert.equal(result.status, 200);
    assert.equal(result.ok, true);
    assert.equal(result.title, "Example & Test");
    assert.match(result.text, /Hello & welcome/);
    assert.match(result.text, /This is useful text/);
    assert.doesNotMatch(result.text, /bad\(\)|Skip this/);
    assert.equal(result.truncated, false);
  } finally {
    restoreFetch();
  }
});

test("web_search parses and deduplicates DuckDuckGo HTML results", async () => {
  const restoreFetch = mockFetch(async (url) => {
    assert.equal(new URL(url).searchParams.get("q"), "openai realtime");
    return createResponse({
      url,
      body: `
        <div class="result">
          <h2><a class="result__a" href="/l/?uddg=https%3A%2F%2Fexample.com%2Fa">First &amp; Result</a></h2>
          <a class="result__snippet">Useful &lt;b&gt;summary&lt;/b&gt; text.</a>
        </div></div>
        <div class="result">
          <h2><a class="result__a" href="/l/?uddg=https%3A%2F%2Fexample.com%2Fa">Duplicate</a></h2>
          <a class="result__snippet">Duplicate.</a>
        </div></div>
        <div class="result">
          <h2><a class="result__a" href="https://example.com/b">Second Result</a></h2>
          <a class="result__snippet">Second summary.</a>
        </div></div>
      `,
    });
  });
  try {
    const result = await executeWebTool("web_search", {
      query: "openai realtime",
      maxResults: 10,
    });
    assert.equal(result.status, "searched");
    assert.equal(result.resultCount, 2);
    assert.match(result.message, /1\. First & Result — https:\/\/example\.com\/a/);
    assert.deepEqual(result.results, [
      {
        title: "First & Result",
        url: "https://example.com/a",
        snippet: "Useful <b>summary</b> text.",
      },
      {
        title: "Second Result",
        url: "https://example.com/b",
        snippet: "Second summary.",
      },
    ]);
  } finally {
    restoreFetch();
  }
});

test("web_fetch blocks private, loopback, and link-local hosts before network access", async () => {
  const blockedUrls = [
    "http://127.0.0.1:1455/",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.5/",
    "http://192.168.1.1/",
    "http://localhost/",
    "http://[::1]/",
    "http://2130706433/", // decimal 127.0.0.1
  ];
  for (const url of blockedUrls) {
    const restoreFetch = mockFetch(() => {
      throw new Error(`fetch should not be called for ${url}`);
    });
    try {
      const result = await executeWebTool("web_fetch", { url });
      assert.equal(result.status, "invalid_arguments", `expected ${url} to be rejected`);
    } finally {
      restoreFetch();
    }
  }
});

test("web_fetch blocks hosts that resolve to private addresses (DNS rebinding)", async () => {
  __setHostResolverForTests(async () => ["10.1.2.3"]);
  const restoreFetch = mockFetch(() => {
    throw new Error("fetch should not be called");
  });
  try {
    const result = await executeWebTool("web_fetch", { url: "https://rebind.example.com/" });
    assert.equal(result.status, "invalid_arguments");
  } finally {
    restoreFetch();
  }
});

test("unknown web tool names pass through as null", async () => {
  assert.equal(await executeWebTool("not_a_web_tool", {}), null);
});
