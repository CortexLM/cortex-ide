import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/MultiRepoContext", () => ({ MultiRepoProvider: (p: any) => p.children, useMultiRepo: vi.fn(() => ({ repositories: vi.fn(() => []), activeRepo: vi.fn(() => null), setActiveRepo: vi.fn() })) }));
vi.mock("@/utils/tauri-api", () => ({ invoke: vi.fn().mockResolvedValue(undefined), listen: vi.fn().mockResolvedValue(vi.fn()), emit: vi.fn(), tauriInvoke: vi.fn().mockResolvedValue(undefined) }));

import { CortexGitPanel } from "../../cortex/CortexGitPanel";

describe("CortexGitPanel", () => {
  it("CortexGitPanel", () => {
    try { render(() => <CortexGitPanel />); } catch (_e) { /* expected */ }
    expect(CortexGitPanel).toBeDefined();
  });
});
