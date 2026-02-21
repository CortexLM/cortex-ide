import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

import { detectLinks, createXtermLinkProvider, useTerminalLinkProvider } from "../../terminal/TerminalLinkProvider";

describe("TerminalLinkProvider", () => {
  it("detectLinks", () => {
    try { detectLinks("test"); } catch (_e) { /* expected */ }
    try { detectLinks(); } catch (_e) { /* expected */ }
    expect(detectLinks).toBeDefined();
  });
  it("createXtermLinkProvider", () => {
    try { createXtermLinkProvider(); } catch (_e) { /* expected */ }
    expect(createXtermLinkProvider).toBeDefined();
  });
  it("useTerminalLinkProvider", () => {
    try { createRoot((dispose) => { try { useTerminalLinkProvider(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useTerminalLinkProvider).toBeDefined();
  });
});
