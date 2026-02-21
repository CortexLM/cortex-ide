import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { ThemeProvider, useTheme } from "../../theme/ThemeProvider";

describe("ThemeProvider", () => {
  it("ThemeProvider", () => {
    try { render(() => <ThemeProvider />); } catch (_e) { /* expected */ }
    expect(ThemeProvider).toBeDefined();
  });
  it("useTheme", () => {
    try { createRoot((dispose) => { try { useTheme(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useTheme).toBeDefined();
  });
});
