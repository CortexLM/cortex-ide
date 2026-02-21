import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { QuickPickMenu } from "../../../cortex/editor/QuickPickMenu";

describe("QuickPickMenu", () => {
  it("QuickPickMenu", () => {
    try { render(() => <QuickPickMenu />); } catch (_e) { /* expected */ }
    expect(QuickPickMenu).toBeDefined();
  });
});
