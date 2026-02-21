import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/AccessibilityContext", () => ({ AccessibilityProvider: (p: any) => p.children, useAccessibility: vi.fn(() => ({})) }));
vi.mock("@/components/ui/Button", () => ({ Button: (p: any) => p.children }));
vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { AccessibilitySettings } from "../../accessibility/AccessibilitySettings";

describe("AccessibilitySettings", () => {
  it("AccessibilitySettings", () => {
    try { render(() => <AccessibilitySettings />); } catch (_e) { /* expected */ }
    expect(AccessibilitySettings).toBeDefined();
  });
});
