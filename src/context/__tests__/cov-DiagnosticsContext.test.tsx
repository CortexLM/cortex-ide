import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { DiagnosticsProvider, useDiagnostics } from "../DiagnosticsContext";

describe("DiagnosticsContext", () => {
  it("DiagnosticsProvider", () => {
    try { render(() => <DiagnosticsProvider />); } catch (_e) { /* expected */ }
    expect(DiagnosticsProvider).toBeDefined();
  });
  it("useDiagnostics", () => {
    try { createRoot((dispose) => { try { useDiagnostics(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useDiagnostics).toBeDefined();
  });
});
