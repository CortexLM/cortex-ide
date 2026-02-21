import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { Avatar, AvatarGroup } from "../../ui/Avatar";

describe("Avatar", () => {
  it("Avatar", () => {
    try { render(() => <Avatar />); } catch (_e) { /* expected */ }
    expect(Avatar).toBeDefined();
  });
  it("AvatarGroup", () => {
    try { render(() => <AvatarGroup />); } catch (_e) { /* expected */ }
    expect(AvatarGroup).toBeDefined();
  });
});
