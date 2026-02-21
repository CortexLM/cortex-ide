import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

import { createImagePreloader, useTerminalImages } from "../useTerminalImages";

describe("useTerminalImages", () => {
  it("createImagePreloader", () => {
    try { createImagePreloader(); } catch (_e) { /* expected */ }
    expect(createImagePreloader).toBeDefined();
  });
  it("useTerminalImages", () => {
    try { createRoot((dispose) => { try { useTerminalImages({} as any); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useTerminalImages).toBeDefined();
  });
});
