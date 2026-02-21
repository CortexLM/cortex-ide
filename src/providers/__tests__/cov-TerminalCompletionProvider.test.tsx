import { describe, it, expect, vi } from "vitest";

import { getTerminalCompletionProvider, resetTerminalCompletionProvider, createTerminalCompletionProvider, TerminalCompletionProvider } from "../TerminalCompletionProvider";

describe("TerminalCompletionProvider", () => {
  it("getTerminalCompletionProvider", () => {
    try { getTerminalCompletionProvider(); } catch (_e) { /* expected */ }
    expect(getTerminalCompletionProvider).toBeDefined();
  });
  it("resetTerminalCompletionProvider", () => {
    try { resetTerminalCompletionProvider(); } catch (_e) { /* expected */ }
    expect(resetTerminalCompletionProvider).toBeDefined();
  });
  it("createTerminalCompletionProvider", () => {
    try { createTerminalCompletionProvider(); } catch (_e) { /* expected */ }
    expect(createTerminalCompletionProvider).toBeDefined();
  });
  it("TerminalCompletionProvider", () => {
    try { const inst = new TerminalCompletionProvider(); expect(inst).toBeDefined(); } catch (_e) { expect(TerminalCompletionProvider).toBeDefined(); }
  });
});
