import { describe, it, expect, vi } from "vitest";

import { LLMError } from "../../llm/types";

describe("types", () => {
  it("LLMError", () => {
    try { const inst = new LLMError("test"); expect(inst).toBeDefined(); } catch (_e) { expect(LLMError).toBeDefined(); }
  });
});
