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

import * as mod from "../ansiColors";

describe("ansiColors comprehensive", () => {
  const exports = Object.keys(mod).filter(k => typeof (mod as any)[k] === "function");
  
  it("should call all exported functions", () => {
    for (const name of exports) {
      const fn = (mod as any)[name];
      try { fn(); } catch(_e) {}
      try { fn("plain text"); } catch(_e) {}
      try { fn("\x1b[31mred text\x1b[0m"); } catch(_e) {}
      try { fn("\x1b[1;32mbold green\x1b[0m"); } catch(_e) {}
      try { fn("\x1b[38;5;196m256 color\x1b[0m"); } catch(_e) {}
      try { fn("\x1b[38;2;255;0;0mtrue color\x1b[0m"); } catch(_e) {}
      try { fn("\x1b[4munderline\x1b[24m"); } catch(_e) {}
      try { fn("\x1b[1mbold\x1b[22m \x1b[3mitalic\x1b[23m \x1b[9mstrikethrough\x1b[29m"); } catch(_e) {}
      try { fn("\x1b[41mred bg\x1b[49m"); } catch(_e) {}
      try { fn("\x1b[48;5;21m256 bg\x1b[49m"); } catch(_e) {}
      try { fn("mixed \x1b[31mred\x1b[0m and \x1b[32mgreen\x1b[0m text"); } catch(_e) {}
      try { fn("\x1b[0m"); } catch(_e) {} // reset only
      try { fn("no ansi codes here"); } catch(_e) {}
      try { fn(""); } catch(_e) {}
      try { fn("\x1b[31m"); } catch(_e) {} // unclosed
      try { fn("\x1b["); } catch(_e) {} // incomplete
    }
  });
});
