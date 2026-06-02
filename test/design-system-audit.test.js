import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const rendererRoot = join(repoRoot, "src", "renderer");
const leenaCssPath = join(rendererRoot, "leena.css");
const sourceExtensions = new Set([".css", ".html", ".js"]);

function listSourceFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(path));
    } else if (sourceExtensions.has(extname(entry.name))) {
      files.push(path);
    }
  }

  return files.sort();
}

function preserveNewlines(value) {
  return "\n".repeat(value.match(/\n/g)?.length ?? 0);
}

function stripComments(source, extension) {
  let stripped = source.replace(/\/\*[\s\S]*?\*\//g, preserveNewlines);

  if (extension === ".html") {
    stripped = stripped.replace(/<!--[\s\S]*?-->/g, preserveNewlines);
  }

  if (extension === ".js") {
    stripped = stripped.replace(/(^|[^:])\/\/[^\n\r]*/g, (_match, prefix) => prefix);
  }

  return stripped;
}

function stripUrlPayloads(source) {
  return source
    .replace(/url\(\s*(["'])?[\s\S]*?\1\s*\)/gi, "url()")
    .replace(/\bdata:[^\s"'`)<>]+/gi, "data:")
    .replace(/\bhttps?:\/\/[^\s"'`)<>]+/gi, "https://")
    .replace(/\bfile:\/\/[^\s"'`)<>]+/gi, "file://");
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

function collectCssBlocks(source) {
  const blocks = [];
  const stack = [];
  let preludeStart = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      stack.push({ prelude: source.slice(preludeStart, index).trim(), start: index + 1 });
      preludeStart = index + 1;
    } else if (char === "}") {
      const block = stack.pop();
      assert.ok(block, "Unbalanced CSS closing brace");
      blocks.push({ ...block, end: index });
      preludeStart = index + 1;
    }
  }

  assert.equal(stack.length, 0, "CSS has unbalanced opening braces");
  return blocks;
}

function findContainingBlock(blocks, index) {
  return blocks
    .filter((block) => block.start <= index && index < block.end)
    .sort((left, right) => left.end - left.start - (right.end - right.start))[0];
}

function formatFinding(filePath, source, index, detail) {
  return `${relative(repoRoot, filePath)}:${lineNumberAt(source, index)} ${detail}`;
}

const sourceFiles = listSourceFiles(rendererRoot);

test("renderer source has zero hardcoded hex colors outside leena.css", () => {
  const findings = [];

  for (const filePath of sourceFiles) {
    if (filePath === leenaCssPath) {
      continue;
    }

    const source = readFileSync(filePath, "utf8");
    const sanitized = stripUrlPayloads(stripComments(source, extname(filePath)));
    const matches = sanitized.matchAll(/(?<![%\w])#[0-9a-fA-F]{3,8}\b/g);

    for (const match of matches) {
      findings.push(formatFinding(filePath, sanitized, match.index ?? 0, match[0]));
    }
  }

  assert.deepEqual(findings, []);
});

test("runtime CSS font-family declarations use font tokens", () => {
  const findings = [];

  for (const filePath of sourceFiles.filter((path) => extname(path) === ".css")) {
    const source = stripComments(readFileSync(filePath, "utf8"), ".css");
    const blocks = collectCssBlocks(source);

    for (const match of source.matchAll(/font-family\s*:\s*([^;{}]+);/gi)) {
      const block = findContainingBlock(blocks, match.index ?? 0);
      if (block?.prelude === "@font-face") {
        continue;
      }

      const value = match[1].trim();
      if (!value.startsWith("var(--font-")) {
        findings.push(formatFinding(filePath, source, match.index ?? 0, value));
      }
    }
  }

  assert.deepEqual(findings, []);
});

test("runtime CSS border-radius declarations use radius tokens", () => {
  const findings = [];
  const runtimeCssFiles = sourceFiles.filter((path) => extname(path) === ".css");

  for (const filePath of runtimeCssFiles) {
    const source = stripComments(readFileSync(filePath, "utf8"), ".css");

    for (const match of source.matchAll(/border-radius\s*:\s*([^;{}]+);/gi)) {
      const value = match[1].trim();
      if (value !== "0" && !value.startsWith("var(--r-")) {
        findings.push(formatFinding(filePath, source, match.index ?? 0, value));
      }
    }
  }

  assert.deepEqual(findings, []);
});
