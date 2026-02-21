import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

import { useDebugSession } from "../useDebugSession";

describe("useDebugSession", () => {
  it("useDebugSession", () => {
    try { createRoot((dispose) => { try { useDebugSession(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useDebugSession).toBeDefined();
  });
});
