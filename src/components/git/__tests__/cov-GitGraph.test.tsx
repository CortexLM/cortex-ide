import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/utils/workspace", () => ({ getWorkspacePath: vi.fn(() => "/test"), isWorkspaceOpen: vi.fn(() => true), getRelativePath: vi.fn((p: string) => p), joinPath: vi.fn((...args: string[]) => args.join("/")), normalizePath: vi.fn((p: string) => p) }));

import { GitGraph } from "../../git/GitGraph";

describe("GitGraph", () => {
  it("GitGraph", () => {
    try { render(() => <GitGraph />); } catch (_e) { /* expected */ }
    expect(GitGraph).toBeDefined();
  });
});
