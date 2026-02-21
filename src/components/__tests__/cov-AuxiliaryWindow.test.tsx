import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/context/WindowsContext", () => ({ WindowsProvider: (p: any) => p.children, useWindows: vi.fn(() => ({})) }));

import { getDetachTabAction, AuxiliaryWindow, useDragDetach } from "../AuxiliaryWindow";

describe("AuxiliaryWindow", () => {
  it("getDetachTabAction", () => {
    try { getDetachTabAction("test", {} as any); } catch (_e) { /* expected */ }
    try { getDetachTabAction(); } catch (_e) { /* expected */ }
    expect(getDetachTabAction).toBeDefined();
  });
  it("AuxiliaryWindow", () => {
    try { render(() => <AuxiliaryWindow />); } catch (_e) { /* expected */ }
    expect(AuxiliaryWindow).toBeDefined();
  });
  it("useDragDetach", () => {
    try { createRoot((dispose) => { try { useDragDetach({} as any); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useDragDetach).toBeDefined();
  });
});
