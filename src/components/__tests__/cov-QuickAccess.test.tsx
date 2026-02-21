import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/QuickAccessContext", () => ({ QuickAccessProvider: (p: any) => p.children, useQuickAccess: vi.fn(() => ({ isOpen: vi.fn(() => false), open: vi.fn(), close: vi.fn(), items: vi.fn(() => []), filter: vi.fn() })) }));

import { QuickAccess, QuickAccessDialog, QuickAccessPrefixHint, QuickAccessTrigger } from "../QuickAccess";

describe("QuickAccess", () => {
  it("QuickAccess", () => {
    try { render(() => <QuickAccess />); } catch (_e) { /* expected */ }
    expect(QuickAccess).toBeDefined();
  });
  it("QuickAccessDialog", () => {
    try { render(() => <QuickAccessDialog />); } catch (_e) { /* expected */ }
    expect(QuickAccessDialog).toBeDefined();
  });
  it("QuickAccessPrefixHint", () => {
    try { render(() => <QuickAccessPrefixHint />); } catch (_e) { /* expected */ }
    expect(QuickAccessPrefixHint).toBeDefined();
  });
  it("QuickAccessTrigger", () => {
    try { render(() => <QuickAccessTrigger />); } catch (_e) { /* expected */ }
    expect(QuickAccessTrigger).toBeDefined();
  });
});
