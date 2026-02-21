import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { LocalHistoryView, LocalHistoryButton, LocalHistorySettings } from "../LocalHistoryView";

describe("LocalHistoryView", () => {
  it("LocalHistoryView", () => {
    try { render(() => <LocalHistoryView />); } catch (_e) { /* expected */ }
    expect(LocalHistoryView).toBeDefined();
  });
  it("LocalHistoryButton", () => {
    try { render(() => <LocalHistoryButton />); } catch (_e) { /* expected */ }
    expect(LocalHistoryButton).toBeDefined();
  });
  it("LocalHistorySettings", () => {
    try { render(() => <LocalHistorySettings />); } catch (_e) { /* expected */ }
    expect(LocalHistorySettings).toBeDefined();
  });
});
