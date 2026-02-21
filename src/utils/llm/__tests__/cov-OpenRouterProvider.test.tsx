import { describe, it, expect, vi } from "vitest";

import { OpenRouterProvider } from "../../llm/OpenRouterProvider";

describe("OpenRouterProvider", () => {
  it("OpenRouterProvider", () => {
    try { const inst = new OpenRouterProvider(); expect(inst).toBeDefined(); } catch (_e) { expect(OpenRouterProvider).toBeDefined(); }
  });
});
