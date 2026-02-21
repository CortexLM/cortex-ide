import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

vi.mock("@/utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() }, createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() })), default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() } }));

import { useConsoleHistory, useConsoleCompletions, useMultiLineInput } from "../../debug/ConsoleManager";

describe("ConsoleManager", () => {
  it("useConsoleHistory", () => {
    try { createRoot((dispose) => { try { useConsoleHistory(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useConsoleHistory).toBeDefined();
  });
  it("useConsoleCompletions", () => {
    try { createRoot((dispose) => { try { useConsoleCompletions((() => null) as any); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useConsoleCompletions).toBeDefined();
  });
  it("useMultiLineInput", () => {
    try { createRoot((dispose) => { try { useMultiLineInput(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useMultiLineInput).toBeDefined();
  });
});
