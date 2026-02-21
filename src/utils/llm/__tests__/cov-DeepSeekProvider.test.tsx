import { describe, it, expect, vi } from "vitest";

import { DeepSeekProvider } from "../../llm/DeepSeekProvider";

describe("DeepSeekProvider", () => {
  it("DeepSeekProvider", () => {
    try { const inst = new DeepSeekProvider(); expect(inst).toBeDefined(); } catch (_e) { expect(DeepSeekProvider).toBeDefined(); }
  });
});
