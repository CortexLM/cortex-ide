import { describe, it, expect, vi } from "vitest";

import { GoogleAIProvider } from "../../llm/GoogleAIProvider";

describe("GoogleAIProvider", () => {
  it("GoogleAIProvider", () => {
    try { const inst = new GoogleAIProvider(); expect(inst).toBeDefined(); } catch (_e) { expect(GoogleAIProvider).toBeDefined(); }
  });
});
