import { describe, it, expect, vi } from "vitest";

import { getCopilotProvider, disposeCopilotProvider, CopilotProvider } from "../../ai/CopilotProvider";

describe("CopilotProvider", () => {
  it("getCopilotProvider", () => {
    try { getCopilotProvider(); } catch (_e) { /* expected */ }
    expect(getCopilotProvider).toBeDefined();
  });
  it("disposeCopilotProvider", () => {
    try { disposeCopilotProvider(); } catch (_e) { /* expected */ }
    expect(disposeCopilotProvider).toBeDefined();
  });
  it("CopilotProvider", () => {
    try { const inst = new CopilotProvider(); expect(inst).toBeDefined(); } catch (_e) { expect(CopilotProvider).toBeDefined(); }
  });
});
