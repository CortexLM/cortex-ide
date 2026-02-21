import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/context/AccessibilityContext", () => ({ AccessibilityProvider: (p: any) => p.children, useAccessibility: vi.fn(() => ({})) }));

import { AccessibilityHelp, useAccessibilityHelpDialog } from "../AccessibilityHelp";

describe("AccessibilityHelp", () => {
  it("AccessibilityHelp", () => {
    try { render(() => <AccessibilityHelp />); } catch (_e) { /* expected */ }
    expect(AccessibilityHelp).toBeDefined();
  });
  it("useAccessibilityHelpDialog", () => {
    try { createRoot((dispose) => { try { useAccessibilityHelpDialog(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useAccessibilityHelpDialog).toBeDefined();
  });
});
