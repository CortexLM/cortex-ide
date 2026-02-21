import { describe, it, expect, vi } from "vitest";

import { MENU_LABELS, DEFAULT_MENUS } from "../../../cortex/titlebar/defaultMenus";

describe("defaultMenus", () => {
  it("MENU_LABELS", () => {
    expect(MENU_LABELS).toBeDefined();
  });
  it("DEFAULT_MENUS", () => {
    expect(DEFAULT_MENUS).toBeDefined();
  });
});
