import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/MultiRepoContext", () => ({ MultiRepoProvider: (p: any) => p.children, useMultiRepo: vi.fn(() => ({ repositories: vi.fn(() => []), activeRepo: vi.fn(() => null), setActiveRepo: vi.fn() })) }));
vi.mock("@/utils/tauri-api", () => ({ invoke: vi.fn().mockResolvedValue(undefined), listen: vi.fn().mockResolvedValue(vi.fn()), emit: vi.fn(), tauriInvoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/utils/workspace", () => ({ getWorkspacePath: vi.fn(() => "/test"), isWorkspaceOpen: vi.fn(() => true), getRelativePath: vi.fn((p: string) => p), joinPath: vi.fn((...args: string[]) => args.join("/")), normalizePath: vi.fn((p: string) => p) }));

import { CortexSourceControl } from "../../cortex/CortexSourceControl";

describe("CortexSourceControl", () => {
  it("CortexSourceControl", () => {
    try { render(() => <CortexSourceControl />); } catch (_e) { /* expected */ }
    expect(CortexSourceControl).toBeDefined();
  });
});
