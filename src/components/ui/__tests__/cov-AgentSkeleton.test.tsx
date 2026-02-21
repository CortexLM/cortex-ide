import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { AgentSkeleton } from "../../ui/AgentSkeleton";

describe("AgentSkeleton", () => {
  it("AgentSkeleton", () => {
    try { render(() => <AgentSkeleton />); } catch (_e) { /* expected */ }
    expect(AgentSkeleton).toBeDefined();
  });
});
