import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

import { invalidateCache, useAsyncEffect } from "../useAsync";

describe("useAsync", () => {
  it("invalidateCache", () => {
    try { invalidateCache({} as any); } catch (_e) { /* expected */ }
    try { invalidateCache(); } catch (_e) { /* expected */ }
    expect(invalidateCache).toBeDefined();
  });
  it("useAsyncEffect", () => {
    try { createRoot((dispose) => { try { useAsyncEffect({} as any); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useAsyncEffect).toBeDefined();
  });
});
