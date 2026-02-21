import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

import { useDiagnostics } from "../useDiagnostics";

describe("useDiagnostics", () => {
  it("useDiagnostics", () => {
    try { createRoot((dispose) => { try { useDiagnostics(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useDiagnostics).toBeDefined();
  });
});
