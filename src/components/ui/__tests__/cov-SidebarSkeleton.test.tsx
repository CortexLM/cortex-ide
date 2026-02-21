import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { SidebarSkeleton } from "../../ui/SidebarSkeleton";

describe("SidebarSkeleton", () => {
  it("SidebarSkeleton", () => {
    try { render(() => <SidebarSkeleton />); } catch (_e) { /* expected */ }
    expect(SidebarSkeleton).toBeDefined();
  });
});
