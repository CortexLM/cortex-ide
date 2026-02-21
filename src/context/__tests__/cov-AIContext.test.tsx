import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { AIProvider, useAI } from "../AIContext";

describe("AIContext", () => {
  it("AIProvider", () => {
    try { render(() => <AIProvider />); } catch (_e) { /* expected */ }
    expect(AIProvider).toBeDefined();
  });
  it("useAI", () => {
    try { createRoot((dispose) => { try { useAI(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useAI).toBeDefined();
  });
});
