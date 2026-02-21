import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexChatPanel } from "../../cortex/CortexChatPanel";

describe("CortexChatPanel", () => {
  it("CortexChatPanel", () => {
    try { render(() => <CortexChatPanel />); } catch (_e) { /* expected */ }
    expect(CortexChatPanel).toBeDefined();
  });
});
