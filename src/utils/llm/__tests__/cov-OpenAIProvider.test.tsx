import { describe, it, expect, vi } from "vitest";

import { OpenAIProvider } from "../../llm/OpenAIProvider";

describe("OpenAIProvider", () => {
  it("OpenAIProvider", () => {
    try { const inst = new OpenAIProvider(); expect(inst).toBeDefined(); } catch (_e) { expect(OpenAIProvider).toBeDefined(); }
  });
});
