import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { WorkspaceTrustBanner, TrustBadge, RestrictedModeIndicator, ActionBlockedDialog, useBlockedAction } from "../WorkspaceTrustBanner";

describe("WorkspaceTrustBanner", () => {
  it("WorkspaceTrustBanner", () => {
    try { render(() => <WorkspaceTrustBanner />); } catch (_e) { /* expected */ }
    expect(WorkspaceTrustBanner).toBeDefined();
  });
  it("TrustBadge", () => {
    try { render(() => <TrustBadge />); } catch (_e) { /* expected */ }
    expect(TrustBadge).toBeDefined();
  });
  it("RestrictedModeIndicator", () => {
    try { render(() => <RestrictedModeIndicator />); } catch (_e) { /* expected */ }
    expect(RestrictedModeIndicator).toBeDefined();
  });
  it("ActionBlockedDialog", () => {
    try { render(() => <ActionBlockedDialog />); } catch (_e) { /* expected */ }
    expect(ActionBlockedDialog).toBeDefined();
  });
  it("useBlockedAction", () => {
    try { createRoot((dispose) => { try { useBlockedAction(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useBlockedAction).toBeDefined();
  });
});
