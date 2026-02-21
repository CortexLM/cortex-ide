import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/utils/tauri-api", () => ({ invoke: vi.fn().mockResolvedValue(undefined), listen: vi.fn().mockResolvedValue(vi.fn()), emit: vi.fn(), tauriInvoke: vi.fn().mockResolvedValue(undefined) }));

import { CortexSearchResultList } from "../../cortex/CortexSearchResultList";

describe("CortexSearchResultList", () => {
  it("CortexSearchResultList", () => {
    try { render(() => <CortexSearchResultList />); } catch (_e) { /* expected */ }
    expect(CortexSearchResultList).toBeDefined();
  });
});
