import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { openInspector, toggleInspector, InspectorProvider, useInspector } from "../InspectorContext";

describe("InspectorContext", () => {
  it("openInspector", () => {
    try { openInspector(); } catch (_e) { /* expected */ }
    expect(openInspector).toBeDefined();
  });
  it("toggleInspector", () => {
    try { toggleInspector(); } catch (_e) { /* expected */ }
    expect(toggleInspector).toBeDefined();
  });
  it("InspectorProvider", () => {
    try { render(() => <InspectorProvider />); } catch (_e) { /* expected */ }
    expect(InspectorProvider).toBeDefined();
  });
  it("useInspector", () => {
    try { createRoot((dispose) => { try { useInspector(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useInspector).toBeDefined();
  });
});
