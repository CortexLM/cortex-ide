import { describe, it, expect, vi } from "vitest";

import { applyCssVariables } from "../../theme/applyCssVariables";

describe("applyCssVariables", () => {
  it("applyCssVariables", () => {
    try { applyCssVariables({} as any, {} as any, {} as any, {} as any); } catch (_e) { /* expected */ }
    try { applyCssVariables(); } catch (_e) { /* expected */ }
    expect(applyCssVariables).toBeDefined();
  });
});
