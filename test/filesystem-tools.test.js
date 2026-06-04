import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { executeFileSystemTool } from "../src/realtime/tools/filesystem-tools.js";

async function withWorkspace(callback) {
  const root = await mkdtemp(path.join(tmpdir(), "leena-fs-"));
  try {
    await callback(root, { rootPath: root });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

function withWriteApproval(options) {
  return { ...options, confirmed: true };
}

test("unknown filesystem tool names pass through as null", async () => {
  await withWorkspace(async (_root, options) => {
    assert.equal(await executeFileSystemTool("web_search", {}, options), null);
  });
});

test("write_file creates a file then reports overwrite on the second write", async () => {
  await withWorkspace(async (root, options) => {
    const created = await executeFileSystemTool(
      "write_file",
      { path: "notes/todo.md", content: "first" },
      withWriteApproval(options),
    );
    assert.equal(created.status, "created");
    assert.equal(await readFile(path.join(root, "notes/todo.md"), "utf8"), "first");

    const overwritten = await executeFileSystemTool(
      "write_file",
      { path: "notes/todo.md", content: "second" },
      withWriteApproval(options),
    );
    assert.equal(overwritten.status, "overwritten");
    assert.equal(await readFile(path.join(root, "notes/todo.md"), "utf8"), "second");
  });
});

test("read_file returns contents and a missing file reports an error", async () => {
  await withWorkspace(async (root, options) => {
    await writeFile(path.join(root, "hello.txt"), "hi there", "utf8");
    const read = await executeFileSystemTool("read_file", { path: "hello.txt" }, options);
    assert.equal(read.status, "read");
    assert.equal(read.content, "hi there");
    assert.equal(read.truncated, false);

    const missing = await executeFileSystemTool("read_file", { path: "nope.txt" }, options);
    assert.equal(missing.status, "error");
  });
});

test("read_file truncates content beyond maxBytes", async () => {
  await withWorkspace(async (root, options) => {
    await writeFile(path.join(root, "big.txt"), "abcdefghij", "utf8");
    const read = await executeFileSystemTool(
      "read_file",
      { path: "big.txt", maxBytes: 4 },
      options,
    );
    assert.equal(read.content, "abcd");
    assert.equal(read.truncated, true);
    assert.equal(read.bytes, 10);
  });
});

test("broad read requires Full Disk Access or an explicit file scope", async () => {
  await withWorkspace(async (root, options) => {
    await writeFile(path.join(root, "notes.txt"), "safe note", "utf8");

    for (const fullDiskAccessStatus of [undefined, "unknown", "stale", "denied", "surprise"]) {
      const denied = await executeFileSystemTool(
        "read_file",
        { path: "notes.txt" },
        { ...options, fileAccessScope: "full-disk", fullDiskAccessStatus },
      );
      assert.equal(denied.status, "permission_denied", String(fullDiskAccessStatus));
      assert.equal("content" in denied, false);
    }

    const granted = await executeFileSystemTool(
      "read_file",
      { path: "notes.txt" },
      { ...options, fileAccessScope: "full-disk", fullDiskAccessStatus: "granted" },
    );
    assert.equal(granted.status, "read");
    assert.equal(granted.content, "safe note");

    const explicit = await executeFileSystemTool(
      "read_file",
      { path: "notes.txt" },
      { ...options, fileAccessScope: "explicit", fullDiskAccessStatus: "unknown" },
    );
    assert.equal(explicit.status, "read");
    assert.equal(explicit.content, "safe note");
  });
});

test("write_file requires host confirmation or trusted write policy", async () => {
  await withWorkspace(async (root, options) => {
    const pending = await executeFileSystemTool(
      "write_file",
      { path: "notes/todo.md", content: "first" },
      options,
    );
    assert.equal(pending.status, "permission_pending");
    await assert.rejects(readFile(path.join(root, "notes/todo.md")));

    const modelSuppliedConfirmation = await executeFileSystemTool(
      "write_file",
      { path: "notes/model.md", content: "unsafe", confirmed: true },
      options,
    );
    assert.equal(modelSuppliedConfirmation.status, "permission_pending");
    await assert.rejects(readFile(path.join(root, "notes/model.md")));

    const trustedWriteWithoutMacTrust = await executeFileSystemTool(
      "write_file",
      { path: "notes/untrusted.md", content: "blocked" },
      { ...options, trustedWriteMode: true },
    );
    assert.equal(trustedWriteWithoutMacTrust.status, "permission_pending");
    await assert.rejects(readFile(path.join(root, "notes/untrusted.md")));

    const trusted = await executeFileSystemTool(
      "write_file",
      { path: "notes/trusted.md", content: "allowed" },
      { ...options, trustedMacAccess: true, trustedWriteMode: true },
    );
    assert.equal(trusted.status, "created");
    assert.equal(await readFile(path.join(root, "notes/trusted.md"), "utf8"), "allowed");

    const broadUnknown = await executeFileSystemTool(
      "write_file",
      { path: "notes/broad.md", content: "blocked" },
      {
        ...options,
        fileAccessScope: "full-disk",
        fullDiskAccessStatus: "unknown",
        trustedMacAccess: true,
        trustedWriteMode: true,
      },
    );
    assert.equal(broadUnknown.status, "permission_denied");
    await assert.rejects(readFile(path.join(root, "notes/broad.md")));
  });
});

test("edit_file requires host confirmation by default", async () => {
  await withWorkspace(async (root, options) => {
    await writeFile(path.join(root, "doc.txt"), "alpha beta", "utf8");

    const pending = await executeFileSystemTool(
      "edit_file",
      { path: "doc.txt", oldText: "beta", newText: "BETA" },
      options,
    );
    assert.equal(pending.status, "permission_pending");
    assert.equal(await readFile(path.join(root, "doc.txt"), "utf8"), "alpha beta");
  });
});

test("edit_file replaces a unique snippet", async () => {
  await withWorkspace(async (root, options) => {
    await writeFile(path.join(root, "doc.txt"), "alpha beta gamma", "utf8");
    const edited = await executeFileSystemTool(
      "edit_file",
      { path: "doc.txt", oldText: "beta", newText: "BETA" },
      withWriteApproval(options),
    );
    assert.equal(edited.status, "edited");
    assert.equal(edited.replacements, 1);
    assert.equal(await readFile(path.join(root, "doc.txt"), "utf8"), "alpha BETA gamma");
  });
});

test("edit_file rejects ambiguous matches unless replaceAll is set", async () => {
  await withWorkspace(async (root, options) => {
    await writeFile(path.join(root, "dup.txt"), "x x x", "utf8");
    const ambiguous = await executeFileSystemTool(
      "edit_file",
      { path: "dup.txt", oldText: "x", newText: "y" },
      withWriteApproval(options),
    );
    assert.equal(ambiguous.status, "error");

    const all = await executeFileSystemTool(
      "edit_file",
      { path: "dup.txt", oldText: "x", newText: "y", replaceAll: true },
      withWriteApproval(options),
    );
    assert.equal(all.status, "edited");
    assert.equal(all.replacements, 3);
    assert.equal(await readFile(path.join(root, "dup.txt"), "utf8"), "y y y");
  });
});

test("edit_file reports when the snippet is not found", async () => {
  await withWorkspace(async (root, options) => {
    await writeFile(path.join(root, "doc.txt"), "content", "utf8");
    const missing = await executeFileSystemTool(
      "edit_file",
      { path: "doc.txt", oldText: "absent", newText: "x" },
      withWriteApproval(options),
    );
    assert.equal(missing.status, "error");
  });
});

test("paths escaping the workspace root are rejected", async () => {
  await withWorkspace(async (_root, options) => {
    for (const badPath of ["../escape.txt", "../../etc/passwd", "/etc/passwd"]) {
      const result = await executeFileSystemTool(
        "write_file",
        { path: badPath, content: "x" },
        options,
      );
      assert.equal(result.status, "invalid_arguments", badPath);
    }
  });
});

test("paths that resolve through a symlink outside the root are rejected", async () => {
  await withWorkspace(async (root, options) => {
    const outside = await mkdtemp(path.join(tmpdir(), "leena-outside-"));
    try {
      await writeFile(path.join(outside, "secret.txt"), "top secret", "utf8");
      // A symlink inside the workspace pointing at an external directory must
      // not let reads or writes escape the sandbox.
      await symlink(outside, path.join(root, "link"), "dir");

      const read = await executeFileSystemTool("read_file", { path: "link/secret.txt" }, options);
      assert.equal(read.status, "invalid_arguments");

      const write = await executeFileSystemTool(
        "write_file",
        { path: "link/planted.txt", content: "x" },
        options,
      );
      assert.equal(write.status, "invalid_arguments");
      await assert.rejects(readFile(path.join(outside, "planted.txt")));
    } finally {
      await rm(outside, { force: true, recursive: true });
    }
  });
});

test("protected secret paths are denied for read, write, and edit", async () => {
  await withWorkspace(async (root, options) => {
    const secrets = [".ssh/id_rsa", ".aws/credentials", ".zshrc", "Leena/openai-credentials.json"];
    for (const secret of secrets) {
      await mkdir(path.dirname(path.join(root, secret)), { recursive: true });
      await writeFile(path.join(root, secret), "secret", "utf8");

      const read = await executeFileSystemTool("read_file", { path: secret }, options);
      assert.equal(read.status, "invalid_arguments", `read ${secret}`);

      const write = await executeFileSystemTool(
        "write_file",
        { path: secret, content: "x" },
        options,
      );
      assert.equal(write.status, "invalid_arguments", `write ${secret}`);

      const edit = await executeFileSystemTool(
        "edit_file",
        { path: secret, oldText: "secret", newText: "x" },
        options,
      );
      assert.equal(edit.status, "invalid_arguments", `edit ${secret}`);
    }

    const ok = await executeFileSystemTool(
      "write_file",
      { path: "notes/todo.md", content: "fine" },
      withWriteApproval(options),
    );
    assert.equal(ok.status, "created");
  });
});

test("write_file rejects non-string content", async () => {
  await withWorkspace(async (_root, options) => {
    const result = await executeFileSystemTool(
      "write_file",
      { path: "a.txt", content: 123 },
      options,
    );
    assert.equal(result.status, "invalid_arguments");
  });
});
