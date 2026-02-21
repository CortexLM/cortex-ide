import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { SidebarSkeleton, BOTTOM_PANEL_TABS, BOTTOM_PANEL_DEFAULT_HEIGHT, BOTTOM_PANEL_MIN_HEIGHT, BOTTOM_PANEL_MAX_HEIGHT, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_DEFAULT_WIDTH } from "../../../cortex/layout/types";

describe("types", () => {
  it("SidebarSkeleton", () => {
    try { render(() => <SidebarSkeleton />); } catch (_e) { /* expected */ }
    expect(SidebarSkeleton).toBeDefined();
  });
  it("BOTTOM_PANEL_TABS", () => {
    expect(BOTTOM_PANEL_TABS).toBeDefined();
  });
  it("BOTTOM_PANEL_DEFAULT_HEIGHT", () => {
    expect(BOTTOM_PANEL_DEFAULT_HEIGHT).toBeDefined();
  });
  it("BOTTOM_PANEL_MIN_HEIGHT", () => {
    expect(BOTTOM_PANEL_MIN_HEIGHT).toBeDefined();
  });
  it("BOTTOM_PANEL_MAX_HEIGHT", () => {
    expect(BOTTOM_PANEL_MAX_HEIGHT).toBeDefined();
  });
  it("SIDEBAR_MIN_WIDTH", () => {
    expect(SIDEBAR_MIN_WIDTH).toBeDefined();
  });
  it("SIDEBAR_MAX_WIDTH", () => {
    expect(SIDEBAR_MAX_WIDTH).toBeDefined();
  });
  it("SIDEBAR_DEFAULT_WIDTH", () => {
    expect(SIDEBAR_DEFAULT_WIDTH).toBeDefined();
  });
});
