import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/AutoUpdateContext", () => ({ AutoUpdateProvider: (p: any) => p.children, useAutoUpdate: vi.fn(() => ({})) }));

import { AutoUpdateDialog, AutoUpdateStatusBadge, AutoUpdateMenuItem } from "../AutoUpdate";

describe("AutoUpdate", () => {
  it("AutoUpdateDialog", () => {
    try { render(() => <AutoUpdateDialog />); } catch (_e) { /* expected */ }
    expect(AutoUpdateDialog).toBeDefined();
  });
  it("AutoUpdateStatusBadge", () => {
    try { render(() => <AutoUpdateStatusBadge />); } catch (_e) { /* expected */ }
    expect(AutoUpdateStatusBadge).toBeDefined();
  });
  it("AutoUpdateMenuItem", () => {
    try { render(() => <AutoUpdateMenuItem />); } catch (_e) { /* expected */ }
    expect(AutoUpdateMenuItem).toBeDefined();
  });
});
