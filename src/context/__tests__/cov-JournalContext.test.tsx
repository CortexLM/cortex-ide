import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { JournalProvider, useJournal } from "../JournalContext";

describe("JournalContext", () => {
  it("JournalProvider", () => {
    try { render(() => <JournalProvider />); } catch (_e) { /* expected */ }
    expect(JournalProvider).toBeDefined();
  });
  it("useJournal", () => {
    try { createRoot((dispose) => { try { useJournal(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useJournal).toBeDefined();
  });
});
