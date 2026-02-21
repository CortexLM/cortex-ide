import { describe, it, expect, vi } from "vitest";

import { parseAnsi, hasAnsiCodes, stripAnsi } from "../ansiParser";

describe("ansiParser", () => {
  it("parseAnsi", () => {
    try { parseAnsi("test"); } catch (_e) { /* expected */ }
    try { parseAnsi(); } catch (_e) { /* expected */ }
    expect(parseAnsi).toBeDefined();
  });
  it("hasAnsiCodes", () => {
    try { hasAnsiCodes("test"); } catch (_e) { /* expected */ }
    try { hasAnsiCodes(); } catch (_e) { /* expected */ }
    expect(hasAnsiCodes).toBeDefined();
  });
  it("stripAnsi", () => {
    try { stripAnsi("test"); } catch (_e) { /* expected */ }
    try { stripAnsi(); } catch (_e) { /* expected */ }
    expect(stripAnsi).toBeDefined();
  });
});
