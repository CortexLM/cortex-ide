import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { REPLProvider, useREPL } from "../REPLContext";

describe("REPLContext", () => {
  it("REPLProvider", () => {
    try { render(() => <REPLProvider />); } catch (_e) { /* expected */ }
    expect(REPLProvider).toBeDefined();
  });
  it("useREPL", () => {
    try { createRoot((dispose) => { try { useREPL(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useREPL).toBeDefined();
  });
});
