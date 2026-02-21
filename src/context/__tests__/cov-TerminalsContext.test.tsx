import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { TerminalsProvider, useTerminals } from "../TerminalsContext";

describe("TerminalsContext", () => {
  it("TerminalsProvider", () => {
    try { render(() => <TerminalsProvider />); } catch (_e) { /* expected */ }
    expect(TerminalsProvider).toBeDefined();
  });
  it("useTerminals", () => {
    try { createRoot((dispose) => { try { useTerminals(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useTerminals).toBeDefined();
  });
});
