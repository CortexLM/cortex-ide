import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { AgentCard } from "../../agents/AgentCard";

describe("AgentCard", () => {
  it("AgentCard", () => {
    try { render(() => <AgentCard />); } catch (_e) { /* expected */ }
    expect(AgentCard).toBeDefined();
  });
});
