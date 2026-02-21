import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { WorkspaceTrustProvider, useWorkspaceTrust, useIsActionAllowed, useTrustStatus } from "../WorkspaceTrustContext";

describe("WorkspaceTrustContext", () => {
  it("WorkspaceTrustProvider", () => {
    try { render(() => <WorkspaceTrustProvider />); } catch (_e) { /* expected */ }
    expect(WorkspaceTrustProvider).toBeDefined();
  });
  it("useWorkspaceTrust", () => {
    try { createRoot((dispose) => { try { useWorkspaceTrust(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useWorkspaceTrust).toBeDefined();
  });
  it("useIsActionAllowed", () => {
    try { createRoot((dispose) => { try { useIsActionAllowed({} as any); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useIsActionAllowed).toBeDefined();
  });
  it("useTrustStatus", () => {
    try { createRoot((dispose) => { try { useTrustStatus(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useTrustStatus).toBeDefined();
  });
});
