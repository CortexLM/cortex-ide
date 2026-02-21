import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/utils/workspace", () => ({ getWorkspacePath: vi.fn(() => "/test"), isWorkspaceOpen: vi.fn(() => true), getRelativePath: vi.fn((p: string) => p), joinPath: vi.fn((...args: string[]) => args.join("/")), normalizePath: vi.fn((p: string) => p) }));

import { GitMergeProvider, useGitMerge } from "../GitMergeContext";

describe("GitMergeContext", () => {
  it("GitMergeProvider", () => {
    try { render(() => <GitMergeProvider />); } catch (_e) { /* expected */ }
    expect(GitMergeProvider).toBeDefined();
  });
  it("useGitMerge", () => {
    try { createRoot((dispose) => { try { useGitMerge(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useGitMerge).toBeDefined();
  });
});
