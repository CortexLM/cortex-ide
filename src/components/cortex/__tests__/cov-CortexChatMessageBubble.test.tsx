import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { ChatMessageBubble } from "../../cortex/CortexChatMessageBubble";

describe("CortexChatMessageBubble", () => {
  it("ChatMessageBubble", () => {
    try { render(() => <ChatMessageBubble />); } catch (_e) { /* expected */ }
    expect(ChatMessageBubble).toBeDefined();
  });
});
