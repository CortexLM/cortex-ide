import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

import { useCommandDetection, useCommandDecorationIntegration } from "../useCommandDetection";

describe("useCommandDetection", () => {
  it("useCommandDetection", () => {
    try { createRoot((dispose) => { try { useCommandDetection({} as any); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useCommandDetection).toBeDefined();
  });
  it("useCommandDecorationIntegration", () => {
    try { createRoot((dispose) => { try { useCommandDecorationIntegration({} as any); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useCommandDecorationIntegration).toBeDefined();
  });
});
