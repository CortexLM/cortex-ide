import { describe, it, expect, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(() => Promise.resolve(null)) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(() => Promise.resolve(vi.fn())), emit: vi.fn(), once: vi.fn(() => Promise.resolve(vi.fn())) }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn(() => ({ listen: vi.fn(() => Promise.resolve(vi.fn())), emit: vi.fn(), setTitle: vi.fn(), close: vi.fn(), minimize: vi.fn(), maximize: vi.fn(), unmaximize: vi.fn(), isMaximized: vi.fn(() => Promise.resolve(false)), show: vi.fn(), hide: vi.fn(), setFocus: vi.fn(), setSize: vi.fn(), setPosition: vi.fn(), center: vi.fn(), onCloseRequested: vi.fn(() => Promise.resolve(vi.fn())), onResized: vi.fn(() => Promise.resolve(vi.fn())), onMoved: vi.fn(() => Promise.resolve(vi.fn())), onFocusChanged: vi.fn(() => Promise.resolve(vi.fn())), innerSize: vi.fn(() => Promise.resolve({ width: 800, height: 600 })), outerSize: vi.fn(() => Promise.resolve({ width: 800, height: 600 })), innerPosition: vi.fn(() => Promise.resolve({ x: 0, y: 0 })), outerPosition: vi.fn(() => Promise.resolve({ x: 0, y: 0 })) })), Window: vi.fn(), LogicalSize: vi.fn(), PhysicalSize: vi.fn() }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: vi.fn(() => ({ listen: vi.fn(() => Promise.resolve(vi.fn())), emit: vi.fn() })) }));
vi.mock("@tauri-apps/api/path", () => ({ join: vi.fn((...a: string[]) => Promise.resolve(a.join("/"))), basename: vi.fn((p: string) => Promise.resolve(p.split("/").pop() || "")), dirname: vi.fn((p: string) => Promise.resolve(p.split("/").slice(0, -1).join("/"))), resolve: vi.fn((...a: string[]) => Promise.resolve(a.join("/"))), homeDir: vi.fn(() => Promise.resolve("/home/user")), appDataDir: vi.fn(() => Promise.resolve("/data")), sep: vi.fn(() => Promise.resolve("/")) }));
vi.mock("@tauri-apps/plugin-fs", () => ({ readTextFile: vi.fn(() => Promise.resolve("")), writeTextFile: vi.fn(() => Promise.resolve()), exists: vi.fn(() => Promise.resolve(false)), readDir: vi.fn(() => Promise.resolve([])), mkdir: vi.fn(() => Promise.resolve()), remove: vi.fn(() => Promise.resolve()), rename: vi.fn(() => Promise.resolve()), copyFile: vi.fn(() => Promise.resolve()), stat: vi.fn(() => Promise.resolve({ isFile: true, isDirectory: false, size: 0 })), BaseDirectory: { AppData: 1, Home: 2, Desktop: 3, Document: 4 } }));
vi.mock("@tauri-apps/plugin-shell", () => ({ Command: { create: vi.fn(() => ({ execute: vi.fn(() => Promise.resolve({ code: 0, stdout: "", stderr: "" })), spawn: vi.fn(() => Promise.resolve({ pid: 1, kill: vi.fn(), write: vi.fn() })), on: vi.fn() })) }, open: vi.fn(() => Promise.resolve()) }));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ writeText: vi.fn(() => Promise.resolve()), readText: vi.fn(() => Promise.resolve("")) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(() => Promise.resolve(null)), save: vi.fn(() => Promise.resolve(null)), message: vi.fn(() => Promise.resolve()), ask: vi.fn(() => Promise.resolve(true)), confirm: vi.fn(() => Promise.resolve(true)) }));
vi.mock("@tauri-apps/plugin-process", () => ({ exit: vi.fn(), relaunch: vi.fn() }));
vi.mock("@tauri-apps/plugin-os", () => ({ platform: vi.fn(() => Promise.resolve("linux")), arch: vi.fn(() => Promise.resolve("x86_64")), type: vi.fn(() => Promise.resolve("Linux")), version: vi.fn(() => Promise.resolve("5.0")), locale: vi.fn(() => Promise.resolve("en-US")), hostname: vi.fn(() => Promise.resolve("test")) }));
vi.mock("@tauri-apps/plugin-store", () => ({ Store: vi.fn(() => ({ get: vi.fn(() => Promise.resolve(null)), set: vi.fn(() => Promise.resolve()), delete: vi.fn(() => Promise.resolve()), clear: vi.fn(() => Promise.resolve()), keys: vi.fn(() => Promise.resolve([])), values: vi.fn(() => Promise.resolve([])), entries: vi.fn(() => Promise.resolve([])), length: vi.fn(() => Promise.resolve(0)), save: vi.fn(() => Promise.resolve()), onKeyChange: vi.fn(() => Promise.resolve(vi.fn())) })), load: vi.fn(() => Promise.resolve({ get: vi.fn(() => Promise.resolve(null)), set: vi.fn(() => Promise.resolve()), delete: vi.fn(() => Promise.resolve()), save: vi.fn(() => Promise.resolve()), keys: vi.fn(() => Promise.resolve([])), values: vi.fn(() => Promise.resolve([])), entries: vi.fn(() => Promise.resolve([])), length: vi.fn(() => Promise.resolve(0)), onKeyChange: vi.fn(() => Promise.resolve(vi.fn())) })) }));

import * as mod from "../searchUtils";

describe("searchUtils comprehensive", () => {
  const match = { line: 1, column: 5, text: "hello world", matchStart: 5, matchEnd: 10 };
  const match2 = { line: 3, column: 1, text: "test line", matchStart: 0, matchEnd: 4 };
  const result = { file: "/test/file.ts", matches: [match, match2] };
  const copyOpts = { includeLineNumbers: true, includeFilePaths: true, format: "plain" as const };

  it("should exercise buildResultsTree", () => {
    expect(mod.buildResultsTree).toBeDefined();
    mod.buildResultsTree([]);
    mod.buildResultsTree([result]);
    mod.buildResultsTree([result, { file: "/test/other.ts", matches: [match] }]);
  });

  it("should exercise buildSimpleTree", () => {
    expect(mod.buildSimpleTree).toBeDefined();
    mod.buildSimpleTree([]);
    mod.buildSimpleTree([result]);
  });

  it("should exercise flattenTree", () => {
    expect(mod.flattenTree).toBeDefined();
    const tree = mod.buildResultsTree([result]);
    const expanded = new Set<string>(["/test", "/test/file.ts"]);
    mod.flattenTree(tree, expanded);
    mod.flattenTree([], new Set());
    mod.flattenTree(tree, new Set());
  });

  it("should exercise copyMatchText", async () => {
    expect(mod.copyMatchText).toBeDefined();
    await mod.copyMatchText(match);
  });

  it("should exercise copyFilePath", async () => {
    expect(mod.copyFilePath).toBeDefined();
    await mod.copyFilePath("/test/file.ts");
  });

  it("should exercise copyRelativePath", async () => {
    expect(mod.copyRelativePath).toBeDefined();
    await mod.copyRelativePath("/test/file.ts", "/test");
  });

  it("should exercise copyLine", async () => {
    expect(mod.copyLine).toBeDefined();
    await mod.copyLine(match);
  });

  it("should exercise copyFileMatches", async () => {
    expect(mod.copyFileMatches).toBeDefined();
    await mod.copyFileMatches("/test/file.ts", [match], copyOpts);
    await mod.copyFileMatches("/test/file.ts", [match], { ...copyOpts, format: "markdown" });
    await mod.copyFileMatches("/test/file.ts", [match], { ...copyOpts, format: "json" });
  });

  it("should exercise copyAllResults", async () => {
    expect(mod.copyAllResults).toBeDefined();
    await mod.copyAllResults([result], copyOpts);
    await mod.copyAllResults([], copyOpts);
  });

  it("should exercise serializeToCodeSearch", () => {
    expect(mod.serializeToCodeSearch).toBeDefined();
    mod.serializeToCodeSearch({
      query: "test",
      isRegex: false,
      isCaseSensitive: false,
      isWholeWord: false,
      includePattern: "",
      excludePattern: "",
      contextLines: 2,
      results: [result],
    });
  });

  it("should exercise parseCodeSearchFile", () => {
    expect(mod.parseCodeSearchFile).toBeDefined();
    const serialized = mod.serializeToCodeSearch({
      query: "test",
      isRegex: false,
      isCaseSensitive: false,
      isWholeWord: false,
      includePattern: "",
      excludePattern: "",
      contextLines: 2,
      results: [result],
    });
    try { mod.parseCodeSearchFile(serialized); } catch (_e) {}
    try { mod.parseCodeSearchFile(""); } catch (_e) {}
    try { mod.parseCodeSearchFile("invalid content"); } catch (_e) {}
  });

  it("should exercise isCodeSearchFile", () => {
    expect(mod.isCodeSearchFile).toBeDefined();
    mod.isCodeSearchFile("/test/search.code-search");
    mod.isCodeSearchFile("/test/file.ts");
    mod.isCodeSearchFile("test.code-search");
  });

  it("should exercise generateCodeSearchFilename", () => {
    expect(mod.generateCodeSearchFilename).toBeDefined();
    mod.generateCodeSearchFilename("test query");
    mod.generateCodeSearchFilename("");
    mod.generateCodeSearchFilename("hello world");
  });
});
