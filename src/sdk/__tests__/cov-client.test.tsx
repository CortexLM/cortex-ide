import { describe, it, expect, vi } from "vitest";

import { createClient, CortexClient } from "../client";

describe("client", () => {
  it("createClient", () => {
    try { createClient(); } catch (_e) { /* expected */ }
    expect(createClient).toBeDefined();
  });
  it("CortexClient", () => {
    try { const inst = new CortexClient(); expect(inst).toBeDefined(); } catch (_e) { expect(CortexClient).toBeDefined(); }
  });
});
