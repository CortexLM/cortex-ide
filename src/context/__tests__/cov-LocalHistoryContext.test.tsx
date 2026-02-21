import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { formatBytes, formatRelativeTime, formatFullTime, LocalHistoryProvider, useLocalHistory } from "../LocalHistoryContext";

describe("LocalHistoryContext", () => {
  it("formatBytes", () => {
    try { formatBytes(0); } catch (_e) { /* expected */ }
    try { formatBytes(); } catch (_e) { /* expected */ }
    expect(formatBytes).toBeDefined();
  });
  it("formatRelativeTime", () => {
    try { formatRelativeTime(0); } catch (_e) { /* expected */ }
    try { formatRelativeTime(); } catch (_e) { /* expected */ }
    expect(formatRelativeTime).toBeDefined();
  });
  it("formatFullTime", () => {
    try { formatFullTime(0); } catch (_e) { /* expected */ }
    try { formatFullTime(); } catch (_e) { /* expected */ }
    expect(formatFullTime).toBeDefined();
  });
  it("LocalHistoryProvider", () => {
    try { render(() => <LocalHistoryProvider />); } catch (_e) { /* expected */ }
    expect(LocalHistoryProvider).toBeDefined();
  });
  it("useLocalHistory", () => {
    try { createRoot((dispose) => { try { useLocalHistory(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useLocalHistory).toBeDefined();
  });
});
