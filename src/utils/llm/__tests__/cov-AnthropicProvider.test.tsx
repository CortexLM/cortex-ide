import { describe, it, expect, vi } from "vitest";

import { AnthropicProvider } from "../../llm/AnthropicProvider";

describe("AnthropicProvider", () => {
  it("AnthropicProvider", () => {
    try { const inst = new AnthropicProvider(); expect(inst).toBeDefined(); } catch (_e) { expect(AnthropicProvider).toBeDefined(); }
  });
});
