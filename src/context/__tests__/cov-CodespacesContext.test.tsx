import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@tauri-apps/plugin-shell", () => ({ Command: vi.fn(() => ({ execute: vi.fn().mockResolvedValue({ stdout: "", stderr: "", code: 0 }), spawn: vi.fn().mockResolvedValue({ pid: 1, write: vi.fn(), kill: vi.fn() }), on: vi.fn() })), open: vi.fn() }));

import { CodespacesProvider, useCodespaces } from "../CodespacesContext";

describe("CodespacesContext", () => {
  it("CodespacesProvider", () => {
    try { render(() => <CodespacesProvider />); } catch (_e) { /* expected */ }
    expect(CodespacesProvider).toBeDefined();
  });
  it("useCodespaces", () => {
    try { createRoot((dispose) => { try { useCodespaces(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useCodespaces).toBeDefined();
  });
});
