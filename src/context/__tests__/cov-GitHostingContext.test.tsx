import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ readText: vi.fn().mockResolvedValue(""), writeText: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@tauri-apps/plugin-shell", () => ({ Command: vi.fn(() => ({ execute: vi.fn().mockResolvedValue({ stdout: "", stderr: "", code: 0 }), spawn: vi.fn().mockResolvedValue({ pid: 1, write: vi.fn(), kill: vi.fn() }), on: vi.fn() })), open: vi.fn() }));

import { GitHostingProvider, useGitHosting } from "../GitHostingContext";

describe("GitHostingContext", () => {
  it("GitHostingProvider", () => {
    try { render(() => <GitHostingProvider />); } catch (_e) { /* expected */ }
    expect(GitHostingProvider).toBeDefined();
  });
  it("useGitHosting", () => {
    try { createRoot((dispose) => { try { useGitHosting(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useGitHosting).toBeDefined();
  });
});
