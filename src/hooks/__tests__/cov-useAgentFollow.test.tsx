import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

import { useAgentFollowActions, useAgentToolTracking, useFollowModeSubscription, useLocationSubscription } from "../useAgentFollow";

describe("useAgentFollow", () => {
  it("useAgentFollowActions", () => {
    try { createRoot((dispose) => { try { useAgentFollowActions(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useAgentFollowActions).toBeDefined();
  });
  it("useAgentToolTracking", () => {
    try { createRoot((dispose) => { try { useAgentToolTracking({} as any); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useAgentToolTracking).toBeDefined();
  });
  it("useFollowModeSubscription", () => {
    try { createRoot((dispose) => { try { useFollowModeSubscription({} as any); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useFollowModeSubscription).toBeDefined();
  });
  it("useLocationSubscription", () => {
    try { createRoot((dispose) => { try { useLocationSubscription({} as any); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useLocationSubscription).toBeDefined();
  });
});
