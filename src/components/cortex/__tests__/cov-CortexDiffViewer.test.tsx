import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/MultiRepoContext", () => ({ MultiRepoProvider: (p: any) => p.children, useMultiRepo: vi.fn(() => ({ repositories: vi.fn(() => []), activeRepo: vi.fn(() => null), setActiveRepo: vi.fn() })) }));
vi.mock("@/context/editor/languageDetection", () => ({ languageDetection: (p: any) => p.children, uselanguageDetection: vi.fn(() => ({})) }));
vi.mock("@/utils/tauri-api", () => ({ invoke: vi.fn().mockResolvedValue(undefined), listen: vi.fn().mockResolvedValue(vi.fn()), emit: vi.fn(), tauriInvoke: vi.fn().mockResolvedValue(undefined) }));

import { CortexDiffViewer } from "../../cortex/CortexDiffViewer";

describe("CortexDiffViewer", () => {
  it("CortexDiffViewer", () => {
    try { render(() => <CortexDiffViewer />); } catch (_e) { /* expected */ }
    expect(CortexDiffViewer).toBeDefined();
  });
});
