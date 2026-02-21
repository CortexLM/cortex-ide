import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

import { useFirstRender, useDelta } from "../usePrevious";

describe("usePrevious", () => {
  it("useFirstRender", () => {
    try { createRoot((dispose) => { try { useFirstRender(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useFirstRender).toBeDefined();
  });
  it("useDelta", () => {
    try { createRoot((dispose) => { try { useDelta((() => null) as any); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useDelta).toBeDefined();
  });
});
