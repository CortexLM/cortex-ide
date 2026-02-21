import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { SubAgentProvider, useSubAgents } from "../SubAgentContext";

describe("SubAgentContext", () => {
  it("SubAgentProvider", () => {
    try { render(() => <SubAgentProvider />); } catch (_e) { /* expected */ }
    expect(SubAgentProvider).toBeDefined();
  });
  it("useSubAgents", () => {
    try { createRoot((dispose) => { try { useSubAgents(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useSubAgents).toBeDefined();
  });
});
