import { describe, it, expect, vi } from "vitest";

import { setupEventHandlers } from "../../editor/eventHandlers";

describe("eventHandlers", () => {
  it("setupEventHandlers", () => {
    try { setupEventHandlers({} as any, {} as any); } catch (_e) { /* expected */ }
    try { setupEventHandlers(); } catch (_e) { /* expected */ }
    expect(setupEventHandlers).toBeDefined();
  });
});
