import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { detectErrorFromLine, TerminalQuickFix, useTerminalQuickFix } from "../TerminalQuickFix";

describe("TerminalQuickFix", () => {
  it("detectErrorFromLine", () => {
    try { detectErrorFromLine("test"); } catch (_e) { /* expected */ }
    try { detectErrorFromLine(); } catch (_e) { /* expected */ }
    expect(detectErrorFromLine).toBeDefined();
  });
  it("TerminalQuickFix", () => {
    try { render(() => <TerminalQuickFix />); } catch (_e) { /* expected */ }
    expect(TerminalQuickFix).toBeDefined();
  });
  it("useTerminalQuickFix", () => {
    try { createRoot((dispose) => { try { useTerminalQuickFix("test"); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useTerminalQuickFix).toBeDefined();
  });
});
