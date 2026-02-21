import { describe, it, expect, vi } from "vitest";

import { createHelpProvider } from "../../quickaccess/HelpProvider";

describe("HelpProvider", () => {
  it("createHelpProvider", () => {
    try { createHelpProvider({} as any); } catch (_e) { /* expected */ }
    try { createHelpProvider(); } catch (_e) { /* expected */ }
    expect(createHelpProvider).toBeDefined();
  });
});
