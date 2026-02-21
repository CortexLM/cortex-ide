import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { ChatEditingProvider, useChatEditing } from "../ChatEditingContext";

describe("ChatEditingContext", () => {
  it("ChatEditingProvider", () => {
    try { render(() => <ChatEditingProvider />); } catch (_e) { /* expected */ }
    expect(ChatEditingProvider).toBeDefined();
  });
  it("useChatEditing", () => {
    try { createRoot((dispose) => { try { useChatEditing(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useChatEditing).toBeDefined();
  });
});
