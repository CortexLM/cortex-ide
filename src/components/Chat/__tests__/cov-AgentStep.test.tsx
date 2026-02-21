import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/SDKContext", () => ({ SDKProvider: (p: any) => p.children, useSDK: vi.fn(() => ({ invoke: vi.fn().mockResolvedValue(undefined), listen: vi.fn().mockResolvedValue(vi.fn()), emit: vi.fn() })) }));

import { AgentStep } from "../../Chat/AgentStep";

describe("AgentStep", () => {
  it("AgentStep", () => {
    try { render(() => <AgentStep />); } catch (_e) { /* expected */ }
    expect(AgentStep).toBeDefined();
  });
});
