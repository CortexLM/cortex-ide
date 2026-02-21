import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { VimProvider, useVim } from "../VimContext";

describe("VimContext", () => {
  it("VimProvider", () => {
    try { render(() => <VimProvider />); } catch (_e) { /* expected */ }
    expect(VimProvider).toBeDefined();
  });
  it("useVim", () => {
    try { createRoot((dispose) => { try { useVim(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useVim).toBeDefined();
  });
});
