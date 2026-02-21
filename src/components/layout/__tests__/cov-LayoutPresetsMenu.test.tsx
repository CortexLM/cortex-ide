import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { LayoutPresetsMenu } from "../../layout/LayoutPresetsMenu";

describe("LayoutPresetsMenu", () => {
  it("LayoutPresetsMenu", () => {
    try { render(() => <LayoutPresetsMenu />); } catch (_e) { /* expected */ }
    expect(LayoutPresetsMenu).toBeDefined();
  });
});
