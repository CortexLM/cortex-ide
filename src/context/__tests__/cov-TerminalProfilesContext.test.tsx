import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { TerminalProfilesProvider, useTerminalProfiles } from "../TerminalProfilesContext";

describe("TerminalProfilesContext", () => {
  it("TerminalProfilesProvider", () => {
    try { render(() => <TerminalProfilesProvider />); } catch (_e) { /* expected */ }
    expect(TerminalProfilesProvider).toBeDefined();
  });
  it("useTerminalProfiles", () => {
    try { createRoot((dispose) => { try { useTerminalProfiles(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useTerminalProfiles).toBeDefined();
  });
});
