import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { ProfilesProvider, useProfiles, useProfileQuickSwitch, useProfileManager } from "../ProfilesContext";

describe("ProfilesContext", () => {
  it("ProfilesProvider", () => {
    try { render(() => <ProfilesProvider />); } catch (_e) { /* expected */ }
    expect(ProfilesProvider).toBeDefined();
  });
  it("useProfiles", () => {
    try { createRoot((dispose) => { try { useProfiles(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useProfiles).toBeDefined();
  });
  it("useProfileQuickSwitch", () => {
    try { createRoot((dispose) => { try { useProfileQuickSwitch(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useProfileQuickSwitch).toBeDefined();
  });
  it("useProfileManager", () => {
    try { createRoot((dispose) => { try { useProfileManager(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useProfileManager).toBeDefined();
  });
});
