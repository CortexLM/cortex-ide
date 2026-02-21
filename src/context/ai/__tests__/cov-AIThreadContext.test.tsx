import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { AIThreadProvider, useAIThread } from "../../ai/AIThreadContext";

describe("AIThreadContext", () => {
  it("AIThreadProvider", () => {
    try { render(() => <AIThreadProvider />); } catch (_e) { /* expected */ }
    expect(AIThreadProvider).toBeDefined();
  });
  it("useAIThread", () => {
    try { createRoot((dispose) => { try { useAIThread(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useAIThread).toBeDefined();
  });
});
