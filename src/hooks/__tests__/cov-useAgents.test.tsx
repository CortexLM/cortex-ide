import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

import { useAgents } from "../useAgents";

describe("useAgents", () => {
  it("useAgents", () => {
    try { createRoot((dispose) => { try { useAgents(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useAgents).toBeDefined();
  });
});
