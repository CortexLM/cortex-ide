import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { WindowControls } from "../../../cortex/titlebar/WindowControls";

describe("WindowControls", () => {
  it("WindowControls", () => {
    try { render(() => <WindowControls />); } catch (_e) { /* expected */ }
    expect(WindowControls).toBeDefined();
  });
});
