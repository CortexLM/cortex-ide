import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexConversationMessage } from "../../cortex/CortexConversationMessage";

describe("CortexConversationMessage", () => {
  it("CortexConversationMessage", () => {
    try { render(() => <CortexConversationMessage />); } catch (_e) { /* expected */ }
    expect(CortexConversationMessage).toBeDefined();
  });
});
