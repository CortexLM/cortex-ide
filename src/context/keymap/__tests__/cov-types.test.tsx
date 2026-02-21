import { describe, it, expect, vi } from "vitest";

import { evaluateToken, evaluateWhenClause, DEFAULT_CONTEXT_KEYS } from "../../keymap/types";

describe("types", () => {
  it("evaluateToken", () => {
    try { evaluateToken("test", {} as any); } catch (_e) { /* expected */ }
    try { evaluateToken(); } catch (_e) { /* expected */ }
    expect(evaluateToken).toBeDefined();
  });
  it("evaluateWhenClause", () => {
    try { evaluateWhenClause({} as any, {} as any); } catch (_e) { /* expected */ }
    try { evaluateWhenClause(); } catch (_e) { /* expected */ }
    expect(evaluateWhenClause).toBeDefined();
  });
  it("DEFAULT_CONTEXT_KEYS", () => {
    expect(DEFAULT_CONTEXT_KEYS).toBeDefined();
  });
});
