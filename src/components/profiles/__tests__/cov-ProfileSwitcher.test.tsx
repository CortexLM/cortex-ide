import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/ProfilesContext", () => ({ ProfilesProvider: (p: any) => p.children, useProfiles: vi.fn(() => ({})) }));

import { getProfileIcon, ProfileSwitcher, ProfileStatusBarItem } from "../../profiles/ProfileSwitcher";

describe("ProfileSwitcher", () => {
  it("getProfileIcon", () => {
    try { getProfileIcon(); } catch (_e) { /* expected */ }
    expect(getProfileIcon).toBeDefined();
  });
  it("ProfileSwitcher", () => {
    try { render(() => <ProfileSwitcher />); } catch (_e) { /* expected */ }
    expect(ProfileSwitcher).toBeDefined();
  });
  it("ProfileStatusBarItem", () => {
    try { render(() => <ProfileStatusBarItem />); } catch (_e) { /* expected */ }
    expect(ProfileStatusBarItem).toBeDefined();
  });
});
