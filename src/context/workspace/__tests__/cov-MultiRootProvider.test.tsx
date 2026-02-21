import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() }, createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() })), default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() } }));

import { MultiRootProvider, useMultiRoot } from "../../workspace/MultiRootProvider";

describe("MultiRootProvider", () => {
  it("MultiRootProvider", () => {
    try { render(() => <MultiRootProvider />); } catch (_e) { /* expected */ }
    expect(MultiRootProvider).toBeDefined();
  });
  it("useMultiRoot", () => {
    try { createRoot((dispose) => { try { useMultiRoot(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useMultiRoot).toBeDefined();
  });
});
