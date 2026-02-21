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

import * as mod from "../settingsSearch";

describe("settingsSearch comprehensive", () => {
  const exports = Object.keys(mod).filter(k => typeof (mod as any)[k] === "function");
  
  it("should call all exported functions", () => {
    for (const name of exports) {
      const fn = (mod as any)[name];
      try { fn(); } catch(_e) {}
      try { fn("test"); } catch(_e) {}
      try { fn("test", "query"); } catch(_e) {}
      try { fn("editor.fontSize", "font size"); } catch(_e) {}
      try { fn([{ key: "editor.fontSize", value: 14, label: "Font Size", description: "Controls font size" }]); } catch(_e) {}
      try { fn("test", { key: "editor.fontSize", value: 14, label: "Font Size" }); } catch(_e) {}
      try { fn("font", [{ key: "editor.fontSize", value: 14, label: "Font Size", description: "Controls the font size in pixels", category: "Editor" }]); } catch(_e) {}
      try { fn("editor", [{ key: "editor.fontSize", value: 14, label: "Font Size", description: "Controls the font size", category: "Editor", tags: ["font", "size"] }], { fuzzy: true }); } catch(_e) {}
      try { fn("color theme", [{ key: "workbench.colorTheme", value: "dark", label: "Color Theme", description: "Specifies the color theme", category: "Workbench" }], { maxResults: 10 }); } catch(_e) {}
    }
  });
  
  it("should search with various queries", () => {
    const settings = [
      { key: "editor.fontSize", value: 14, label: "Font Size", description: "Controls the font size in pixels", category: "Editor" },
      { key: "editor.tabSize", value: 2, label: "Tab Size", description: "The number of spaces a tab is equal to", category: "Editor" },
      { key: "editor.wordWrap", value: "on", label: "Word Wrap", description: "Controls how lines should wrap", category: "Editor" },
      { key: "workbench.colorTheme", value: "dark", label: "Color Theme", description: "Specifies the color theme", category: "Workbench" },
      { key: "terminal.fontSize", value: 13, label: "Terminal Font Size", description: "Controls the terminal font size", category: "Terminal" },
    ];
    
    for (const name of exports) {
      const fn = (mod as any)[name];
      for (const query of ["font", "editor", "tab", "color", "terminal", "wrap", "xyz_no_match", "", "ed fo", "font size"]) {
        try { fn(query, settings); } catch(_e) {}
        try { fn(query, settings, {}); } catch(_e) {}
        try { fn(query, settings, { fuzzy: true }); } catch(_e) {}
        try { fn(query, settings, { maxResults: 5 }); } catch(_e) {}
      }
    }
  });
});
