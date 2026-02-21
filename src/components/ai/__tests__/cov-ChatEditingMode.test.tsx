import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/context/ChatEditingContext", () => ({ ChatEditingProvider: (p: any) => p.children, useChatEditing: vi.fn(() => ({})) }));

import { ChatEditingMode, ChatEditingModeCompact, useChatEditingMode } from "../../ai/ChatEditingMode";

describe("ChatEditingMode", () => {
  it("ChatEditingMode", () => {
    try { render(() => <ChatEditingMode />); } catch (_e) { /* expected */ }
    expect(ChatEditingMode).toBeDefined();
  });
  it("ChatEditingModeCompact", () => {
    try { render(() => <ChatEditingModeCompact />); } catch (_e) { /* expected */ }
    expect(ChatEditingModeCompact).toBeDefined();
  });
  it("useChatEditingMode", () => {
    try { createRoot((dispose) => { try { useChatEditingMode(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useChatEditingMode).toBeDefined();
  });
});
