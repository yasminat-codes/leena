const defaultFetchMaxLength = 8000;
const maxFetchMaxLength = 20_000;
const defaultSearchMaxResults = 5;
const maxSearchResults = 10;
const requestTimeoutMs = 10_000;
const userAgent = "Brah/0.1 RealtimeTool (+https://openai.com)";

export async function executeWebTool(name, args) {
  switch (name) {
    case "web_fetch":
      return webFetch(args);
    case "web_search":
      return webSearch(args);
    default:
      return null;
  }
}

async function webFetch(args) {
  if (!isRecord(args) || typeof args.url !== "string") {
    return invalidArguments("url must be a string.");
  }
  const url = parsePublicHttpUrl(args.url);
  if (!url.ok) {
    return invalidArguments(url.message);
  }
  const maxLength = clampInteger(args.maxLength, defaultFetchMaxLength, 500, maxFetchMaxLength);

  try {
    const response = await fetchWithTimeout(url.value.toString());
    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text();
    const extracted = contentType.includes("text/html") ? extractHtmlText(body) : cleanupText(body);
    return {
      status: response.status,
      ok: response.ok,
      url: response.url,
      title: contentType.includes("text/html") ? extractHtmlTitle(body) : undefined,
      text: extracted.slice(0, maxLength),
      truncated: extracted.length > maxLength,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Failed to fetch URL.",
    };
  }
}

async function webSearch(args) {
  if (!isRecord(args) || typeof args.query !== "string" || !args.query.trim()) {
    return invalidArguments("query must be a non-empty string.");
  }
  const maxResults = clampInteger(args.maxResults, defaultSearchMaxResults, 1, maxSearchResults);
  const searchUrl = new URL("https://duckduckgo.com/html/");
  searchUrl.searchParams.set("q", args.query.trim());

  try {
    const response = await fetchWithTimeout(searchUrl.toString());
    const html = await response.text();
    const results = parseSearchResults(html).slice(0, maxResults);
    const summary = {
      status: "searched",
      provider: "DuckDuckGo HTML",
      query: args.query.trim(),
      resultCount: results.length,
      results,
      message:
        results.length > 0
          ? formatSearchResultSummary(results)
          : `No search results were parsed from HTTP ${response.status}; the provider may have blocked the request.`,
    };
    console.info("web_search completed", {
      query: summary.query,
      resultCount: summary.resultCount,
      status: response.status,
    });
    return summary;
  } catch (error) {
    return {
      status: "error",
      provider: "DuckDuckGo HTML",
      message: error instanceof Error ? error.message : "Search failed.",
      results: [],
    };
  }
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function parseSearchResults(html) {
  return dedupeResults([...parseDuckDuckGoResults(html), ...parseGenericAnchorResults(html)]);
}

function parseDuckDuckGoResults(html) {
  const results = [];
  const resultBlockPattern = /<div[^>]+class="[^"]*result[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi;
  const blocks = html.match(resultBlockPattern) ?? [];
  for (const block of blocks) {
    const linkMatch = block.match(
      /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!linkMatch) {
      continue;
    }
    const title = decodeHtmlEntities(stripTags(linkMatch[2]));
    const url = normalizeDuckDuckGoUrl(decodeHtmlEntities(linkMatch[1]));
    const snippetMatch = block.match(
      /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
    );
    const snippet = snippetMatch ? decodeHtmlEntities(stripTags(snippetMatch[1])) : "";
    if (title && url) {
      results.push({ title, url, snippet });
    }
  }
  return results;
}

function parseGenericAnchorResults(html) {
  const results = [];
  const anchorPattern = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const url = normalizeDuckDuckGoUrl(decodeHtmlEntities(match[1]));
    const title = decodeHtmlEntities(stripTags(match[2]));
    if (!isUsableSearchResult(url, title)) {
      continue;
    }
    results.push({ title, url, snippet: "" });
  }
  return results;
}

function normalizeDuckDuckGoUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl, "https://duckduckgo.com");
    const uddg = parsed.searchParams.get("uddg");
    if (uddg) {
      return decodeURIComponent(uddg);
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

function formatSearchResultSummary(results) {
  return results
    .slice(0, 5)
    .map((result, index) => `${index + 1}. ${result.title} — ${result.url}`)
    .join("\n");
}

function isUsableSearchResult(url, title) {
  if (!title || title.length < 2) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function dedupeResults(results) {
  const seen = new Set();
  const deduped = [];
  for (const result of results) {
    if (seen.has(result.url)) {
      continue;
    }
    seen.add(result.url);
    deduped.push(result);
  }
  return deduped;
}

function parsePublicHttpUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, message: "Only http:// and https:// URLs are allowed." };
    }
    return { ok: true, value: url };
  } catch {
    return { ok: false, message: "url must be a valid URL." };
  }
}

function extractHtmlTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(cleanupText(match[1])).slice(0, 200) : undefined;
}

function extractHtmlText(html) {
  return cleanupText(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ")
      .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, " ")
      .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|section|article|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );
}

function stripTags(value) {
  return cleanupText(value.replace(/<[^>]+>/g, " "));
}

function cleanupText(value) {
  return decodeHtmlEntities(String(value))
    .replace(/\r/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n[\t ]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtmlEntities(value) {
  return String(value)
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function clampInteger(value, fallback, minimum, maximum) {
  if (!Number.isInteger(value)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, value));
}

function invalidArguments(message) {
  return {
    status: "invalid_arguments",
    message,
  };
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
