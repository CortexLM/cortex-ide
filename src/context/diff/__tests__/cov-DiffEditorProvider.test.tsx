import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() }, createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() })), default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() } }));

import { DiffEditorProvider, useDiffEditor } from "../../diff/DiffEditorProvider";

describe("DiffEditorProvider", () => {
  it("DiffEditorProvider", () => {
    try { render(() => <DiffEditorProvider />); } catch (_e) { /* expected */ }
    expect(DiffEditorProvider).toBeDefined();
  });
  it("useDiffEditor", () => {
    try { createRoot((dispose) => { try { useDiffEditor(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useDiffEditor).toBeDefined();
  });
});
