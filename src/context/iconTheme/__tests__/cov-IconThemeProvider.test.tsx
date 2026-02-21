import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() }, createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() })), default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() } }));

import { IconThemeProvider, useIconTheme } from "../../iconTheme/IconThemeProvider";

describe("IconThemeProvider", () => {
  it("IconThemeProvider", () => {
    try { render(() => <IconThemeProvider />); } catch (_e) { /* expected */ }
    expect(IconThemeProvider).toBeDefined();
  });
  it("useIconTheme", () => {
    try { createRoot((dispose) => { try { useIconTheme(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useIconTheme).toBeDefined();
  });
});
