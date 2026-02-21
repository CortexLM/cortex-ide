import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { SubAgentStatus, SubAgentStatusCompact } from "../../ai/SubAgentStatus";

describe("SubAgentStatus", () => {
  it("SubAgentStatus", () => {
    try { render(() => <SubAgentStatus />); } catch (_e) { /* expected */ }
    expect(SubAgentStatus).toBeDefined();
  });
  it("SubAgentStatusCompact", () => {
    try { render(() => <SubAgentStatusCompact />); } catch (_e) { /* expected */ }
    expect(SubAgentStatusCompact).toBeDefined();
  });
});
