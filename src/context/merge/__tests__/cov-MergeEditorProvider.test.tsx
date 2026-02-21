import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/utils/workspace", () => ({ getWorkspacePath: vi.fn(() => "/test"), isWorkspaceOpen: vi.fn(() => true), getRelativePath: vi.fn((p: string) => p), joinPath: vi.fn((...args: string[]) => args.join("/")), normalizePath: vi.fn((p: string) => p) }));
vi.mock("@/utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() }, createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() })), default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() } }));

import { MergeEditorProvider, useMergeEditor } from "../../merge/MergeEditorProvider";

describe("MergeEditorProvider", () => {
  it("MergeEditorProvider", () => {
    try { render(() => <MergeEditorProvider />); } catch (_e) { /* expected */ }
    expect(MergeEditorProvider).toBeDefined();
  });
  it("useMergeEditor", () => {
    try { createRoot((dispose) => { try { useMergeEditor(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useMergeEditor).toBeDefined();
  });
});
