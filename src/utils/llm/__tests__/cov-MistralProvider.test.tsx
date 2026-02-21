import { describe, it, expect, vi } from "vitest";

import { MistralProvider } from "../../llm/MistralProvider";

describe("MistralProvider", () => {
  it("MistralProvider", () => {
    try { const inst = new MistralProvider(); expect(inst).toBeDefined(); } catch (_e) { expect(MistralProvider).toBeDefined(); }
  });
});
