import { describe, it, expect, vi } from "vitest";

import { FIGMA_ICON_MAP, FIGMA_FILE_KEY, FIGMA_SECTIONS } from "../../../cortex/icons/figma-icon-map";

describe("figma-icon-map", () => {
  it("FIGMA_ICON_MAP", () => {
    expect(FIGMA_ICON_MAP).toBeDefined();
  });
  it("FIGMA_FILE_KEY", () => {
    expect(FIGMA_FILE_KEY).toBeDefined();
  });
  it("FIGMA_SECTIONS", () => {
    expect(FIGMA_SECTIONS).toBeDefined();
  });
});
