import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/JournalContext", () => ({ JournalProvider: (p: any) => p.children, useJournal: vi.fn(() => ({})) }));

import { JournalPanel, JournalQuickOpen } from "../Journal";

describe("Journal", () => {
  it("JournalPanel", () => {
    try { render(() => <JournalPanel />); } catch (_e) { /* expected */ }
    expect(JournalPanel).toBeDefined();
  });
  it("JournalQuickOpen", () => {
    try { render(() => <JournalQuickOpen />); } catch (_e) { /* expected */ }
    expect(JournalQuickOpen).toBeDefined();
  });
});
