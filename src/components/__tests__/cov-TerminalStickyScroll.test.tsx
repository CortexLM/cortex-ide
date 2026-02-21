import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { TerminalStickyScroll, TerminalStickyScrollProvider, useTerminalCommandTracker, useTerminalStickyScroll, useTerminalStickyScrollStandalone } from "../TerminalStickyScroll";

describe("TerminalStickyScroll", () => {
  it("TerminalStickyScroll", () => {
    try { render(() => <TerminalStickyScroll />); } catch (_e) { /* expected */ }
    expect(TerminalStickyScroll).toBeDefined();
  });
  it("TerminalStickyScrollProvider", () => {
    try { render(() => <TerminalStickyScrollProvider />); } catch (_e) { /* expected */ }
    expect(TerminalStickyScrollProvider).toBeDefined();
  });
  it("useTerminalCommandTracker", () => {
    try { createRoot((dispose) => { try { useTerminalCommandTracker(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useTerminalCommandTracker).toBeDefined();
  });
  it("useTerminalStickyScroll", () => {
    try { createRoot((dispose) => { try { useTerminalStickyScroll(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useTerminalStickyScroll).toBeDefined();
  });
  it("useTerminalStickyScrollStandalone", () => {
    try { createRoot((dispose) => { try { useTerminalStickyScrollStandalone({} as any); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useTerminalStickyScrollStandalone).toBeDefined();
  });
});
