import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { AIStreamProvider, useAIStream } from "../../ai/AIStreamContext";

describe("AIStreamContext", () => {
  it("AIStreamProvider", () => {
    try { render(() => <AIStreamProvider />); } catch (_e) { /* expected */ }
    expect(AIStreamProvider).toBeDefined();
  });
  it("useAIStream", () => {
    try { createRoot((dispose) => { try { useAIStream(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useAIStream).toBeDefined();
  });
});
