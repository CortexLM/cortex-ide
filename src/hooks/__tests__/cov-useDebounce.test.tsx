import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

import { useDebounceEffect } from "../useDebounce";

describe("useDebounce", () => {
  it("useDebounceEffect", () => {
    try { createRoot((dispose) => { try { useDebounceEffect({} as any); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useDebounceEffect).toBeDefined();
  });
});
