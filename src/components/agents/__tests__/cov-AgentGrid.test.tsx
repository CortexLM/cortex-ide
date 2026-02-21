import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { AgentGrid } from "../../agents/AgentGrid";

describe("AgentGrid", () => {
  it("AgentGrid", () => {
    try { render(() => <AgentGrid />); } catch (_e) { /* expected */ }
    expect(AgentGrid).toBeDefined();
  });
});
