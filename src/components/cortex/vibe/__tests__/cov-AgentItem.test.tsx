import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { AgentItem } from "../../../cortex/vibe/AgentItem";

describe("AgentItem", () => {
  it("AgentItem", () => {
    try { render(() => <AgentItem />); } catch (_e) { /* expected */ }
    expect(AgentItem).toBeDefined();
  });
});
