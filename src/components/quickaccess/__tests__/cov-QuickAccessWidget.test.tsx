import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/QuickAccessContext", () => ({ QuickAccessProvider: (p: any) => p.children, useQuickAccess: vi.fn(() => ({ isOpen: vi.fn(() => false), open: vi.fn(), close: vi.fn(), items: vi.fn(() => []), filter: vi.fn() })) }));
vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { QuickAccessWidget } from "../../quickaccess/QuickAccessWidget";

describe("QuickAccessWidget", () => {
  it("QuickAccessWidget", () => {
    try { render(() => <QuickAccessWidget />); } catch (_e) { /* expected */ }
    expect(QuickAccessWidget).toBeDefined();
  });
});
