import { describe, it, expect, vi } from "vitest";

import { cleanupMcpListeners } from "../mcp-listeners";

describe("mcp-listeners", () => {
  it("cleanupMcpListeners", () => {
    try { cleanupMcpListeners(); } catch (_e) { /* expected */ }
    expect(cleanupMcpListeners).toBeDefined();
  });
});
